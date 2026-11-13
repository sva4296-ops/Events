import { Directory, File, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';

import type { Photo } from '@/types/guest';
import { captureError } from '@/utils/sentry';

export type AlbumDownloadResult =
  | { status: 'denied' }
  | { status: 'done'; saved: number; failed: number };

/**
 * Saves every album photo (full resolution) to the phone's gallery, one at a
 * time so memory stays flat even for big albums: download to cache, hand it
 * to the gallery, delete the cached copy.
 *
 * Write-only permission: iOS asks only for "add photos", Android 13+ needs no
 * runtime permission at all (app.json blocks the READ_MEDIA_* ones).
 */
export async function saveAlbumToGallery(
  photos: Photo[],
  onProgress: (done: number, total: number) => void,
): Promise<AlbumDownloadResult> {
  const permission = await MediaLibrary.requestPermissionsAsync(true);
  if (!permission.granted) return { status: 'denied' };

  const dir = new Directory(Paths.cache, 'album-download');
  if (!dir.exists) dir.create({ intermediates: true });

  let saved = 0;
  let failed = 0;
  onProgress(0, photos.length);

  for (const photo of photos) {
    const url = photo.full_url ?? photo.url;
    if (url === null || url.length === 0) {
      failed += 1;
    } else {
      const target = new File(dir, `${photo.id}.jpg`);
      try {
        const file = await File.downloadFileAsync(url, target, { idempotent: true });
        await MediaLibrary.saveToLibraryAsync(file.uri);
        saved += 1;
      } catch (error) {
        failed += 1;
        captureError(error, { where: 'saveAlbumToGallery', photoId: photo.id });
      } finally {
        if (target.exists) target.delete();
      }
    }
    onProgress(saved + failed, photos.length);
  }

  return { status: 'done', saved, failed };
}
