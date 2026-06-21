import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';

type PlacementType = 'LEFT_CHEST' | 'FULL_FRONT' | 'FULL_BACK' | 'YOKE' | 'SLEEVE_LEFT' | 'SLEEVE_RIGHT';
type GarmentSide = 'FRONT' | 'BACK' | 'LEFT' | 'RIGHT';

export interface ZoneData {
  id: string;
  placementType: PlacementType;
  side: GarmentSide;
  x: number;
  y: number;
  width: number;
  height: number;
  isActive: boolean;
}

interface PlacementEditorProps {
  placements: ZoneData[];
  frontAssetId: string | null;
  backAssetId: string | null;
  leftAssetId?: string | null;
  rightAssetId?: string | null;
  onSavePlacement: (id: string, data: { x: number; y: number; width: number; height: number }) => Promise<void>;
}

const ZONE_STYLE: Record<PlacementType, { bg: string; border: string; label: string }> = {
  LEFT_CHEST:   { bg: 'rgba(37, 99, 235, 0.18)',  border: '#2563EB', label: 'Left Chest' },
  FULL_FRONT:   { bg: 'rgba(5, 150, 105, 0.18)',  border: '#059669', label: 'Full Front' },
  FULL_BACK:    { bg: 'rgba(5, 150, 105, 0.18)',  border: '#059669', label: 'Full Back' },
  YOKE:         { bg: 'rgba(124, 58, 237, 0.18)', border: '#7C3AED', label: 'Yoke' },
  SLEEVE_LEFT:  { bg: 'rgba(217, 119, 6, 0.18)',  border: '#D97706', label: 'Sleeve L' },
  SLEEVE_RIGHT: { bg: 'rgba(220, 38, 38, 0.18)',  border: '#DC2626', label: 'Sleeve R' },
};

const CANVAS_W = 460;
const CANVAS_H = 552;
const MIN_PX = 16;

interface Interaction {
  type: 'drag' | 'resize';
  zoneId: string;
  startPageX: number;
  startPageY: number;
  startX: number;
  startY: number;
  startW: number;
  startH: number;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function DraggableZone({
  zone,
  active,
  interactionRef,
  onInteractionStart,
  onZoneChange,
}: {
  zone: ZoneData;
  active: boolean;
  interactionRef: React.MutableRefObject<Interaction | null>;
  onInteractionStart: (type: 'drag' | 'resize', zone: ZoneData, pageX: number, pageY: number) => void;
  onZoneChange: (id: string, x: number, y: number, w: number, h: number) => void;
}) {
  const zs = ZONE_STYLE[zone.placementType];
  const left = zone.x * CANVAS_W;
  const top = zone.y * CANVAS_H;
  const width = zone.width * CANVAS_W;
  const height = zone.height * CANVAS_H;

  const bodyHandlers = {
    onStartShouldSetResponder: () => true,
    onResponderGrant: (e: any) => {
      onInteractionStart('drag', zone, e.nativeEvent.pageX, e.nativeEvent.pageY);
    },
    onResponderMove: (e: any) => {
      const ia = interactionRef.current;
      if (!ia || ia.zoneId !== zone.id || ia.type !== 'drag') return;
      const dx = (e.nativeEvent.pageX - ia.startPageX) / CANVAS_W;
      const dy = (e.nativeEvent.pageY - ia.startPageY) / CANVAS_H;
      onZoneChange(
        zone.id,
        clamp(ia.startX + dx, 0, 1 - ia.startW),
        clamp(ia.startY + dy, 0, 1 - ia.startH),
        ia.startW,
        ia.startH,
      );
    },
    onResponderRelease: () => {
      interactionRef.current = null;
    },
  };

  const resizeHandlers = {
    onStartShouldSetResponderCapture: () => true,
    onStartShouldSetResponder: () => true,
    onResponderGrant: (e: any) => {
      onInteractionStart('resize', zone, e.nativeEvent.pageX, e.nativeEvent.pageY);
    },
    onResponderMove: (e: any) => {
      const ia = interactionRef.current;
      if (!ia || ia.zoneId !== zone.id || ia.type !== 'resize') return;
      const dx = (e.nativeEvent.pageX - ia.startPageX) / CANVAS_W;
      const dy = (e.nativeEvent.pageY - ia.startPageY) / CANVAS_H;
      onZoneChange(
        zone.id,
        ia.startX,
        ia.startY,
        clamp(ia.startW + dx, MIN_PX / CANVAS_W, 1 - ia.startX),
        clamp(ia.startH + dy, MIN_PX / CANVAS_H, 1 - ia.startY),
      );
    },
    onResponderRelease: () => {
      interactionRef.current = null;
    },
  };

  return (
    <View
      {...bodyHandlers}
      style={[
        st.zone,
        {
          left,
          top,
          width,
          height,
          backgroundColor: zs.bg,
          borderColor: active ? zs.border : `${zs.border}88`,
          borderWidth: active ? 2 : 1.5,
        },
      ]}
    >
      <Text style={[st.zoneLabel, { color: zs.border }]} numberOfLines={1}>
        {zs.label}
      </Text>
      <View {...resizeHandlers} style={[st.resizeHandle, { backgroundColor: zs.border }]} />
    </View>
  );
}

export default function PlacementEditor({
  placements,
  frontAssetId,
  backAssetId,
  leftAssetId = null,
  rightAssetId = null,
  onSavePlacement,
}: PlacementEditorProps) {
  const [side, setSide] = useState<GarmentSide>('FRONT');
  const [zones, setZones] = useState<ZoneData[]>(placements);
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const interactionRef = useRef<Interaction | null>(null);

  useEffect(() => {
    setZones(placements);
    setDirtyIds(new Set());
  }, [placements]);

  const visibleZones = zones.filter(z => z.side === side && z.isActive);
  const bgAssetId =
    side === 'FRONT' ? frontAssetId :
    side === 'BACK'  ? backAssetId  :
    side === 'LEFT'  ? leftAssetId  :
    rightAssetId;

  const handleInteractionStart = useCallback(
    (type: 'drag' | 'resize', zone: ZoneData, pageX: number, pageY: number) => {
      setActiveId(zone.id);
      interactionRef.current = {
        type,
        zoneId: zone.id,
        startPageX: pageX,
        startPageY: pageY,
        startX: zone.x,
        startY: zone.y,
        startW: zone.width,
        startH: zone.height,
      };
    },
    [],
  );

  const handleZoneChange = useCallback(
    (id: string, x: number, y: number, w: number, h: number) => {
      setZones(prev => prev.map(z => (z.id === id ? { ...z, x, y, width: w, height: h } : z)));
      setDirtyIds(prev => new Set(prev).add(id));
    },
    [],
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      const dirty = zones.filter(z => dirtyIds.has(z.id));
      await Promise.all(
        dirty.map(z =>
          onSavePlacement(z.id, { x: z.x, y: z.y, width: z.width, height: z.height }),
        ),
      );
      setDirtyIds(new Set());
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={st.container}>
      <View style={st.toolbar}>
        <View style={st.toggle}>
          {(['FRONT', 'BACK', 'LEFT', 'RIGHT'] as GarmentSide[]).map(s => (
            <TouchableOpacity
              key={s}
              style={[st.toggleBtn, side === s && st.toggleBtnActive]}
              onPress={() => setSide(s)}
            >
              <Text style={[st.toggleBtnText, side === s && st.toggleBtnTextActive]}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={st.legend}>
          {visibleZones.map(z => (
            <View key={z.id} style={st.legendItem}>
              <View style={[st.legendDot, { backgroundColor: ZONE_STYLE[z.placementType].border }]} />
              <Text style={st.legendText}>{ZONE_STYLE[z.placementType].label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={st.canvas}>
        {bgAssetId ? (
          <Image
            source={{ uri: `/api/products/assets/${bgAssetId}` }}
            style={st.bgImage}
            resizeMode="contain"
          />
        ) : (
          <View style={st.bgEmpty}>
            <Text style={st.bgEmptyText}>
              {`No ${side === 'FRONT' ? 'Front' : side === 'BACK' ? 'Back' : side === 'LEFT' ? 'Left Side' : 'Right Side'} image\nUpload one in the Assets tab`}
            </Text>
          </View>
        )}

        {visibleZones.map(zone => (
          <DraggableZone
            key={zone.id}
            zone={zone}
            active={activeId === zone.id}
            interactionRef={interactionRef}
            onInteractionStart={handleInteractionStart}
            onZoneChange={handleZoneChange}
          />
        ))}
      </View>

      <Text style={st.hint}>Drag to move · Drag bottom-right corner to resize</Text>

      {dirtyIds.size > 0 && (
        <TouchableOpacity style={st.saveBtn} onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={st.saveBtnText}>
              Save {dirtyIds.size} change{dirtyIds.size > 1 ? 's' : ''}
            </Text>
          )}
        </TouchableOpacity>
      )}

      {dirtyIds.size === 0 && !saving && (
        <Text style={st.savedText}>All placements saved</Text>
      )}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  container: { padding: 20, gap: 14 },
  toolbar: { gap: 10 },
  toggle: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 3,
    alignSelf: 'flex-start',
    gap: 2,
  },
  toggleBtn: { paddingHorizontal: 24, paddingVertical: 7, borderRadius: 6 },
  toggleBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  toggleBtnText: { fontSize: 13, fontWeight: '500', color: '#6B7280' },
  toggleBtnTextActive: { color: '#111827' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 9, height: 9, borderRadius: 4.5 },
  legendText: { fontSize: 12, color: '#6B7280' },
  canvas: {
    width: CANVAS_W,
    height: CANVAS_H,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    position: 'relative' as any,
  },
  bgImage: {
    position: 'absolute' as any,
    top: 0,
    left: 0,
    width: CANVAS_W,
    height: CANVAS_H,
  },
  bgEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bgEmptyText: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', lineHeight: 20 },
  zone: {
    position: 'absolute' as any,
    borderRadius: 4,
    cursor: 'move' as any,
    userSelect: 'none' as any,
  },
  zoneLabel: {
    position: 'absolute' as any,
    top: 3,
    left: 4,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  resizeHandle: {
    position: 'absolute' as any,
    right: 0,
    bottom: 0,
    width: 14,
    height: 14,
    borderRadius: 2,
    opacity: 0.75,
    cursor: 'nwse-resize' as any,
  },
  hint: { fontSize: 12, color: '#9CA3AF', textAlign: 'center' },
  saveBtn: {
    backgroundColor: '#FF5A00',
    borderRadius: 8,
    paddingVertical: 11,
    paddingHorizontal: 28,
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  saveBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  savedText: { fontSize: 12, color: '#10B981' },
});
