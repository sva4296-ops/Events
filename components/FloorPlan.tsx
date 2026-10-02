import Feather from '@expo/vector-icons/Feather';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector, type GestureType } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useTheme } from '@/hooks/useTheme';
import type { SeatingTable } from '@/types/guest';
import { chairOffsets, PLAN_MAX, PLAN_MIN, tablePosition, tableSize } from '@/utils/floorPlan';
import { haptics } from '@/utils/haptics';
import { themeRadius, type ThemeTokens } from '@/utils/themeTokens';

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const CHAIR = 12;

interface FloorPlanProps {
  tables: SeatingTable[];
  /** Organizer: long-press + drag moves a table, tap opens its editor. */
  owner: boolean;
  /** Guest's own table: highlighted, and the camera starts centered on it. */
  myTableId: string | null;
  selectedTableId: string | null;
  /** Owner only: assigned guests per table, fills that many chair dots. */
  assignedByTable: Map<string, number>;
  onTapTable: (tableId: string) => void;
  onMoveTable: (tableId: string, x: number, y: number) => void;
  youAreHereLabel: string;
  fitLabel: string;
  locateLabel: string;
}

/**
 * Pinch-zoom + pan floor plan of the seating tables. Camera math: a world
 * point p is drawn at p * scale + translate (content view uses a top-left
 * transform origin). Table positions are centers, in world units.
 */
export function FloorPlan({
  tables,
  owner,
  myTableId,
  selectedTableId,
  assignedByTable,
  onTapTable,
  onMoveTable,
  youAreHereLabel,
  fitLabel,
  locateLabel,
}: FloorPlanProps) {
  const { tokens } = useTheme();
  const reduceMotion = useReducedMotion();
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const placed = useRef(false);

  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const pinchPrev = useSharedValue(1);

  const applyCamera = (animated: boolean) => {
    if (size === null || tables.length === 0) return;
    const positions = tables.map((table, index) => ({ table, ...tablePosition(table, index) }));
    const mine = positions.find((entry) => entry.table.id === myTableId);

    let nextScale: number;
    let cx: number;
    let cy: number;
    if (mine !== undefined) {
      nextScale = 1;
      cx = mine.x;
      cy = mine.y;
    } else {
      const pad = 90;
      const minX = Math.min(...positions.map((p) => p.x)) - pad;
      const maxX = Math.max(...positions.map((p) => p.x)) + pad;
      const minY = Math.min(...positions.map((p) => p.y)) - pad;
      const maxY = Math.max(...positions.map((p) => p.y)) + pad;
      nextScale = Math.min(1.25, Math.max(MIN_ZOOM, Math.min(size.width / (maxX - minX), size.height / (maxY - minY))));
      cx = (minX + maxX) / 2;
      cy = (minY + maxY) / 2;
    }
    const nextTx = size.width / 2 - cx * nextScale;
    const nextTy = size.height / 2 - cy * nextScale;

    if (animated && !reduceMotion) {
      scale.set(withTiming(nextScale, { duration: 320 }));
      tx.set(withTiming(nextTx, { duration: 320 }));
      ty.set(withTiming(nextTy, { duration: 320 }));
    } else {
      scale.set(nextScale);
      tx.set(nextTx);
      ty.set(nextTy);
    }
  };

  // Place the camera once, on the first layout.
  useEffect(() => {
    if (size !== null && !placed.current) {
      placed.current = true;
      applyCamera(false);
    }
  });

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (size === null || size.width !== width || size.height !== height) setSize({ width, height });
  };

  const canvasPan = useMemo(
    () =>
      Gesture.Pan()
        .averageTouches(true)
        .onChange((event) => {
          tx.set(tx.get() + event.changeX);
          ty.set(ty.get() + event.changeY);
        }),
    [tx, ty],
  );

  const pinch = useMemo(
    () =>
      Gesture.Pinch()
        .onStart(() => {
          pinchPrev.set(1);
        })
        .onUpdate((event) => {
          const current = scale.get();
          const target = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, (current * event.scale) / pinchPrev.get()));
          const factor = target / current;
          // Zoom around the fingers: keep the world point under the focal point fixed.
          tx.set(event.focalX - (event.focalX - tx.get()) * factor);
          ty.set(event.focalY - (event.focalY - ty.get()) * factor);
          scale.set(target);
          pinchPrev.set(event.scale);
        }),
    [pinchPrev, scale, tx, ty],
  );

  const canvasGesture = useMemo(() => Gesture.Simultaneous(canvasPan, pinch), [canvasPan, pinch]);
  // A table drag makes the canvas wait until it fails (finger moved before the long press).
  const tableBlocks = useMemo(() => [canvasPan, pinch], [canvasPan, pinch]);

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.get() }, { translateY: ty.get() }, { scale: scale.get() }],
  }));

  const hasMine = myTableId !== null && tables.some((table) => table.id === myTableId);

  return (
    <View
      style={[styles.container, { backgroundColor: tokens.surface2, borderColor: tokens.border }]}
      onLayout={onLayout}
    >
      <GestureDetector gesture={canvasGesture}>
        <View style={StyleSheet.absoluteFill}>
          <Animated.View style={[styles.content, contentStyle]}>
            {tables.map((table, index) => (
              <TableNode
                key={table.id}
                table={table}
                index={index}
                owner={owner}
                isMine={!owner && table.id === myTableId}
                selected={table.id === selectedTableId}
                assigned={owner ? (assignedByTable.get(table.id) ?? 0) : 0}
                scale={scale}
                blocks={tableBlocks}
                tokens={tokens}
                onTap={onTapTable}
                onMove={onMoveTable}
                youAreHereLabel={youAreHereLabel}
              />
            ))}
          </Animated.View>
        </View>
      </GestureDetector>

      <TouchableOpacity
        style={[styles.fitButton, { backgroundColor: tokens.surface, borderColor: tokens.border }]}
        onPress={() => {
          haptics.tap();
          applyCamera(true);
        }}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={hasMine ? locateLabel : fitLabel}
      >
        <Feather name={hasMine ? 'crosshair' : 'maximize'} size={18} color={tokens.textPrimary} />
      </TouchableOpacity>
    </View>
  );
}

interface TableNodeProps {
  table: SeatingTable;
  index: number;
  owner: boolean;
  isMine: boolean;
  selected: boolean;
  assigned: number;
  scale: SharedValue<number>;
  blocks: GestureType[];
  tokens: ThemeTokens;
  onTap: (tableId: string) => void;
  onMove: (tableId: string, x: number, y: number) => void;
  youAreHereLabel: string;
}

function TableNode({
  table,
  index,
  owner,
  isMine,
  selected,
  assigned,
  scale,
  blocks,
  tokens,
  onTap,
  onMove,
  youAreHereLabel,
}: TableNodeProps) {
  const position = tablePosition(table, index);
  const { width, height } = tableSize(table.shape);
  const chairs = useMemo(() => chairOffsets(table.shape, table.seat_count), [table.shape, table.seat_count]);

  const x = useSharedValue(position.x);
  const y = useSharedValue(position.y);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const lifted = useSharedValue(0);

  // Server/cache position changed (refetch, or the optimistic patch after a drop).
  useEffect(() => {
    x.set(position.x);
    y.set(position.y);
  }, [position.x, position.y, x, y]);

  const tableId = table.id;
  const gesture = useMemo(() => {
    const tap = Gesture.Tap()
      .maxDuration(250)
      .onEnd((_event, success) => {
        if (success) scheduleOnRN(onTap, tableId);
      });
    if (!owner) return tap;

    const drag = Gesture.Pan()
      .activateAfterLongPress(280)
      .blocksExternalGesture(...blocks)
      .onStart(() => {
        startX.set(x.get());
        startY.set(y.get());
        lifted.set(withSpring(1));
        scheduleOnRN(haptics.press);
      })
      .onUpdate((event) => {
        const s = scale.get();
        x.set(Math.min(PLAN_MAX, Math.max(PLAN_MIN, startX.get() + event.translationX / s)));
        y.set(Math.min(PLAN_MAX, Math.max(PLAN_MIN, startY.get() + event.translationY / s)));
      })
      .onEnd(() => {
        scheduleOnRN(onMove, tableId, Math.round(x.get()), Math.round(y.get()));
      })
      .onFinalize(() => {
        lifted.set(withSpring(0));
      });
    return Gesture.Exclusive(drag, tap);
  }, [owner, blocks, onTap, onMove, tableId, startX, startY, x, y, lifted, scale]);

  const nodeStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.get() - width / 2 },
      { translateY: y.get() - height / 2 },
      { scale: 1 + lifted.get() * 0.08 },
    ],
    opacity: 1 - lifted.get() * 0.1,
  }));

  const highlighted = isMine || selected;
  const tableFill = isMine ? tokens.accentFill : tokens.surface;
  const textColor = isMine ? tokens.onAccent : tokens.textPrimary;
  const metaColor = isMine ? tokens.onAccent : tokens.textSecondary;

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[styles.node, { width, height }, nodeStyle]}
        accessible
        accessibilityRole="button"
        accessibilityLabel={`${table.name}, ${owner ? `${assigned}/${table.seat_count}` : table.seat_count}`}
        accessibilityState={{ selected }}
      >
        {chairs.map((chair, chairIndex) => (
          <View
            // Chairs are positional, the index is their identity.
            key={chairIndex}
            style={[
              styles.chair,
              {
                left: chair.x - CHAIR / 2,
                top: chair.y - CHAIR / 2,
                backgroundColor: chairIndex < assigned || isMine ? tokens.accentFill : tokens.surface,
                borderColor: isMine ? tokens.accentFill : tokens.border,
              },
            ]}
          />
        ))}
        <View
          style={[
            styles.table,
            {
              width,
              height,
              borderRadius: table.shape === 'round' ? width / 2 : 14,
              backgroundColor: tableFill,
              borderColor: highlighted ? tokens.accentFill : tokens.border,
              borderWidth: highlighted ? 2 : 1,
            },
          ]}
        >
          <Text style={[styles.tableName, { color: textColor }]} numberOfLines={2}>
            {table.name}
          </Text>
          <Text style={[styles.tableMeta, { color: metaColor }]}>
            {owner ? `${assigned}/${table.seat_count}` : table.seat_count}
          </Text>
        </View>
        {isMine ? (
          <View style={[styles.hereBadge, { top: -CHAIR - 34, backgroundColor: tokens.accentFill }]}>
            <Feather name="map-pin" size={11} color={tokens.onAccent} />
            <Text style={[styles.hereText, { color: tokens.onAccent }]} numberOfLines={1}>
              {youAreHereLabel}
            </Text>
          </View>
        ) : null}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 320,
    borderRadius: themeRadius.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  content: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: PLAN_MAX + PLAN_MIN,
    height: PLAN_MAX + PLAN_MIN,
    transformOrigin: 'left top',
  },
  node: {
    position: 'absolute',
    left: 0,
    top: 0,
    alignItems: 'center',
  },
  chair: {
    position: 'absolute',
    width: CHAIR,
    height: CHAIR,
    borderRadius: CHAIR / 2,
    borderWidth: 1,
  },
  table: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  tableName: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  tableMeta: {
    fontSize: 11,
    marginTop: 1,
  },
  hereBadge: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    minWidth: 90,
    justifyContent: 'center',
  },
  hereText: {
    fontSize: 11,
    fontWeight: '700',
  },
  fitButton: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
