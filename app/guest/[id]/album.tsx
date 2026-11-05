import Feather from "@expo/vector-icons/Feather";
import * as ImagePicker from "expo-image-picker";
import { useContext, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { showDialog } from "@/components/ActionSheet";
import { Button, buttonLabelColor } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { CoverStatusContext } from "@/components/guest/eventChrome";
import { GuestScreen } from "@/components/guest/GuestScreen";
import { PhotoTile } from "@/components/guest/PhotoTile";
import { PhotoGallery } from "@/components/PhotoViewer";
import { ProgressBar } from "@/components/guest/ProgressBar";
import { Skeleton } from "@/components/Skeleton";
import type { Photo } from "@/types/guest";
import { useAuth } from "@/hooks/useAuth";
import { useEventContent } from "@/hooks/useEventContent";
import { useEvents } from "@/hooks/useEvents";
import { useGuestEvent } from "@/hooks/useGuestEvent";
import { useTheme } from "@/hooks/useTheme";
import {
  GUEST_PHOTO_LIMIT,
  isPhotoUploadClosed,
  PHOTO_UPLOAD_DAYS_AFTER,
} from "@/utils/limits";
import { saveAlbumToGallery } from "@/utils/albumDownload";
import { floatingTabBar, gSpace, tabBarBottomInset } from "@/utils/guestTheme";
import { reportSupabaseError } from "@/utils/reportError";
import { themeRadius, typography } from "@/utils/themeTokens";

type AlbumFilter = "all" | "mine";

/** Per pick, so a large batch doesn't sit resizing for minutes. */
const MAX_PHOTOS_PER_BATCH = 30;

const COLUMNS = 3;
const TILE_GAP = 4;
const SIDE_PADDING = 20;

/** Inside GuestScreen, so the cover's status bar handling applies to this list too. */
function AlbumList(props: React.ComponentProps<typeof FlatList<Photo>>) {
  const coverStatus = useContext(CoverStatusContext);
  return (
    <FlatList
      {...props}
      scrollEventThrottle={64}
      onScroll={(event) => coverStatus?.onScrollY(event.nativeEvent.contentOffset.y)}
    />
  );
}

export default function AlbumScreen() {
  const { t } = useTranslation();
  const { id, event } = useGuestEvent();
  const { user } = useAuth();
  const { isOwner } = useEvents();
  const { tokens } = useTheme();
  const { content, addPhotos, deletePhoto, loadOlderPhotos, loadAllPhotos } = useEventContent(id);
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const tileSize = (windowWidth - SIDE_PADDING * 2 - TILE_GAP * (COLUMNS - 1)) / COLUMNS;
  const [reachedEnd, setReachedEnd] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState<AlbumFilter>("all");
  const [download, setDownload] = useState<{ done: number; total: number } | null>(null);
  const [upload, setUpload] = useState<{ done: number; total: number } | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const owner = isOwner(event);
  const loading = content === null;
  const photos = useMemo(() => content?.photos ?? [], [content?.photos]);
  // Totals come from the whole album: only some of its photos are loaded.
  const uploaderIds = content?.photoUploaderIds ?? [];
  const uploaders = new Set(uploaderIds).size;
  const visible = useMemo(
    () =>
      filter === "mine"
        ? photos.filter((photo) => photo.uploaded_by === user?.id)
        : photos,
    [filter, photos, user?.id],
  );
  const canDownload = event?.albumStatus === "ready" && uploaderIds.length > 0;
  const myCount = uploaderIds.filter((uploader) => uploader === user?.id).length;
  // Organizers have no limit; the server enforces it too (guest photo limit trigger).
  const limitReached = !owner && myCount >= GUEST_PHOTO_LIMIT;
  // 3 full days after the event nobody adds photos anymore (server enforces it too).
  const uploadClosed = event !== undefined && isPhotoUploadClosed(event.date);

  // Moved here from the Live tab (Live is video only now).
  const pickPhoto = async () => {
    if (limitReached || uploadClosed || upload !== null) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    // Several at once; a guest can pick only what's left of their limit.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsMultipleSelection: true,
      orderedSelection: true,
      selectionLimit: owner
        ? MAX_PHOTOS_PER_BATCH
        : Math.min(MAX_PHOTOS_PER_BATCH, GUEST_PHOTO_LIMIT - myCount),
    });
    if (result.canceled || result.assets.length === 0) return;

    const picked = result.assets.map((asset) => ({
      uri: asset.uri,
      width: asset.width,
      height: asset.height,
    }));
    setUpload({ done: 0, total: picked.length });
    await addPhotos(picked, (done, total) => setUpload({ done, total }));
    setUpload(null);
  };

  const downloadAll = async () => {
    if (download !== null) return;
    try {
      const result = await saveAlbumToGallery(await loadAllPhotos(), (done, total) =>
        setDownload({ done, total }),
      );
      if (result.status === "denied") {
        showDialog({
          title: t("album.downloadDeniedTitle"),
          message: t("album.downloadDeniedBody"),
        });
      } else if (result.failed === 0) {
        showDialog({
          title: t("album.downloadDoneTitle"),
          message: t("album.downloadDoneBody", { count: result.saved }),
        });
      } else {
        showDialog({
          title: t("album.downloadPartialTitle"),
          message: t("album.downloadPartialBody", {
            saved: result.saved,
            failed: result.failed,
          }),
        });
      }
    } catch (error) {
      reportSupabaseError(error);
    } finally {
      setDownload(null);
    }
  };

  const loadMore = async () => {
    if (loadingMore || reachedEnd || content === null) return;
    setLoadingMore(true);
    try {
      if (!(await loadOlderPhotos())) setReachedEnd(true);
    } catch (error) {
      // Scrolling down again retries.
      console.warn("[album] loading more photos failed", error);
    } finally {
      setLoadingMore(false);
    }
  };

  const filters: { key: AlbumFilter; label: string }[] = [
    { key: "all", label: t("album.filterAll") },
    { key: "mine", label: t("album.filterMine") },
  ];

  const listHeader = (
    <View style={styles.header}>
      <View style={styles.head}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: tokens.textPrimary }]}>
            {t("album.title")}
          </Text>
          <TouchableOpacity
            onPress={() =>
              showDialog({
                title: t("album.infoTitle"),
                message: t("album.infoBody", { limit: GUEST_PHOTO_LIMIT }),
              })
            }
            activeOpacity={0.7}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t("album.infoTitle")}
          >
            <Feather name="info" size={20} color={tokens.textSecondary} />
          </TouchableOpacity>
        </View>
        {!loading ? (
          <Text style={[styles.summary, { color: tokens.textSecondary }]}>
            {`${t("album.summary", { count: uploaderIds.length })} · ${t("album.summaryPeople", { count: uploaders })}`}
          </Text>
        ) : null}
      </View>

      <View
        style={[
          styles.uploadCard,
          { backgroundColor: tokens.surface, borderColor: tokens.border },
        ]}
      >
        <View style={styles.uploadHead}>
          <View
            style={[styles.uploadIcon, { backgroundColor: tokens.accentTint }]}
          >
            <Feather
              name={uploadClosed ? "lock" : "camera"}
              size={20}
              color={tokens.accentText}
            />
          </View>
          <View style={styles.uploadCopy}>
            <Text style={[styles.uploadTitle, { color: tokens.textPrimary }]}>
              {uploadClosed ? t("album.closedTitle") : t("album.yourPhotos")}
            </Text>
            <Text
              style={[styles.uploadCaption, { color: tokens.textSecondary }]}
            >
              {uploadClosed
                ? t("album.closedBody", { count: PHOTO_UPLOAD_DAYS_AFTER })
                : owner
                  ? t("album.noLimitOrganizer")
                  : t("album.uploadedOf", {
                      count: myCount,
                      limit: GUEST_PHOTO_LIMIT,
                    })}
            </Text>
          </View>
        </View>
        {!owner && !uploadClosed ? (
          <ProgressBar current={myCount} target={GUEST_PHOTO_LIMIT} />
        ) : null}
        {uploadClosed ? null : (
          <Button
            label={
              upload !== null
                ? t("album.uploadProgress", upload)
                : limitReached
                  ? t("album.limitReached")
                  : t("album.upload")
            }
            icon={
              limitReached ? undefined : (
                <Feather
                  name="upload"
                  size={20}
                  color={buttonLabelColor("primary", tokens)}
                />
              )
            }
            disabled={limitReached || upload !== null}
            onPress={() => void pickPhoto()}
          />
        )}
      </View>

      <View
        style={[styles.filters, { backgroundColor: tokens.surface2 }]}
        accessibilityRole="tablist"
      >
        {filters.map((item) => {
          const active = filter === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              onPress={() => setFilter(item.key)}
              activeOpacity={0.8}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={[
                styles.chip,
                active && { backgroundColor: tokens.surface },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: active ? tokens.textPrimary : tokens.textSecondary },
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.grid}>
          {Array.from({ length: 9 }, (_, index) => (
            <Skeleton
              key={index}
              style={{ width: tileSize, height: tileSize, borderRadius: 0 }}
              radius={0}
            />
          ))}
        </View>
      ) : null}
    </View>
  );

  const listFooter = (
    <View style={styles.footer}>
      {loadingMore ? <ActivityIndicator color={tokens.textSecondary} /> : null}
      {/* Download only once the server cron marks the album ready (events.album_status,
          ~72h after the event). The timing is explained in the ⓘ next to the title. */}
      {canDownload ? (
        <TouchableOpacity
          style={[
            styles.download,
            { backgroundColor: tokens.textPrimary },
            download !== null && styles.downloadBusy,
          ]}
          onPress={() => void downloadAll()}
          disabled={download !== null}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityState={{ busy: download !== null }}
        >
          <Feather name="download" size={20} color={tokens.surface} />
          <Text style={[styles.downloadText, { color: tokens.surface }]}>
            {download !== null
              ? t("album.downloadProgress", { done: download.done, total: download.total })
              : t("album.downloadAll")}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  return (
    <GuestScreen transparent scroll={false} contentStyle={styles.screen}>
      {/* Only the photos on screen get drawn, and the next page loads on the way down. */}
      <AlbumList
        data={loading ? [] : visible}
        keyExtractor={(photo) => photo.id}
        numColumns={COLUMNS}
        columnWrapperStyle={styles.row}
        renderItem={({ item: photo, index }) => (
          <PhotoTile
            photo={photo}
            style={{ width: tileSize, height: tileSize, backgroundColor: tokens.surface2 }}
            canDelete={owner || photo.uploaded_by === user?.id}
            onDelete={deletePhoto}
            labelFontSize={10}
            onOpen={() => setViewerIndex(index)}
          />
        )}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          loading ? null : (
            <EmptyState message={filter === "mine" ? t("album.emptyMine") : t("album.empty")} />
          )
        }
        ListFooterComponent={listFooter}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: tabBarBottomInset(insets.bottom) + floatingTabBar.gap + floatingTabBar.height + gSpace.lg },
        ]}
        showsVerticalScrollIndicator={false}
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={7}
        onEndReachedThreshold={0.6}
        onEndReached={() => void loadMore()}
      />

      {viewerIndex !== null ? (
        <PhotoGallery
          photos={visible.map((photo) => ({
            id: photo.id,
            uri: photo.full_url ?? photo.url ?? undefined,
            placeholderUri: photo.thumb_url ?? undefined,
            caption: photo.uploaded_by_label ?? undefined,
          }))}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      ) : null}

    </GuestScreen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingTop: 0,
    paddingBottom: 0,
  },
  list: {
    paddingHorizontal: SIDE_PADDING,
    paddingTop: gSpace.lg,
  },
  header: {
    gap: gSpace.lg,
    marginBottom: gSpace.lg,
  },
  row: {
    gap: TILE_GAP,
    marginBottom: TILE_GAP,
  },
  footer: {
    gap: gSpace.lg,
    marginTop: gSpace.lg,
  },
  head: {
    gap: 4,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  title: {
    ...typography.title2,
    fontSize: 26,
    lineHeight: 31,
  },
  summary: {
    fontSize: 13,
  },
  uploadCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    gap: 14,
  },
  uploadHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  uploadIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  uploadCopy: {
    flex: 1,
    gap: 2,
  },
  uploadTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  uploadCaption: {
    fontSize: 13,
  },
  filters: {
    flexDirection: "row",
    padding: 4,
    borderRadius: themeRadius.pill,
  },
  chip: {
    flex: 1,
    minHeight: 38,
    borderRadius: themeRadius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  chipText: {
    fontSize: 14,
    fontWeight: "600",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    borderRadius: 18,
    overflow: "hidden",
  },
  download: {
    minHeight: 54,
    borderRadius: themeRadius.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 22,
  },
  downloadBusy: {
    opacity: 0.7,
  },
  downloadText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
