import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
  Platform,
  ActivityIndicator,
  Image,
  TextInput,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Path, Rect, Circle, Line, G } from 'react-native-svg';
import {
  X,
  Save,
  ChevronDown,
  Trash2,
  Check,
  CheckCircle,
  Pencil,
  RotateCcw,
  Eye,
  EyeOff,
  Search,
  Plus,
  Star,
  MousePointer2,
  Type as TypeIcon,
  ImagePlus,
  LayoutTemplate,
  Undo2,
  Redo2,
  Maximize2,
  ZoomIn,
  Crosshair,
} from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import Colors from '@/constants/colors';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import {
  CANVAS_W,
  CANVAS_H,
  GARMENTS,
  GARMENT_COLORS,
  GarmentType,
  GarmentView,
  PrintLocation,
  ZoneDefinition,
  PrintTemplate,
  DecorationMethod,
  SnapPosition,
  DECORATION_METHODS,
  SNAP_POSITIONS,
  TemplateSizingOverride,
  resolveTemplate,
  fitDefault,
  computeArtRect,
  approxEqual,
  PLACEMENT_TYPE_TO_LOCATION,
} from './garmentData';
import OverlayMenu from '@/components/OverlayMenu';
import { apiFetch } from '@/lib/apiFetch';
import { generateId } from '@/utils/quoteCalculations';
import { ConfiguredProductEditor } from '@/components/configured-product/ConfiguredProductEditor';
import type { ConfiguredProduct } from '@/types/configuredProduct';
import { categoryToGarmentType } from '@/utils/garmentPreview';

// ─── Constants ────────────────────────────────────────────────────────────────
const DISPLAY_W = 360;
const DISPLAY_H = (CANVAS_H / CANVAS_W) * DISPLAY_W;
const SCALE = DISPLAY_W / CANVAS_W;
const KO_LOGO_URL = '/ko-logo-horizontal.png';

// ─── Types ────────────────────────────────────────────────────────────────────
interface UploadedArtwork {
  id: string;
  uri: string;
  name: string;
  naturalW?: number;
  naturalH?: number;
}

interface Placement {
  zoneId: PrintLocation;
  artworkId: string;
  artworkUri: string;
  artWidthIn?: string;
  artHeightIn?: string;
  offsetXIn: number;
  offsetYIn: number;
  snap: SnapPosition;
  decorationMethod: DecorationMethod;
  rotation: number;
  opacity: number;
  hidden?: boolean;
}

interface PlacementStatus {
  usingTemplate: boolean;
  customSize: boolean;
  customPosition: boolean;
  customMethod: boolean;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave: (finalImageUri: string) => void;
  initialMockupUri?: string;
  suggestedLocations?: string[];
  initialVariant?: { vendor?: string; product?: string; color?: string };
  onRequestChangeProduct?: () => void;
  onColorChange?: (colorName: string) => void;
  configuredProduct?: ConfiguredProduct;
  onConfiguredProductChange?: (cp: ConfiguredProduct) => void;
}

type MobileTab = 'library' | 'canvas' | 'properties';

// ─── Sub-components ───────────────────────────────────────────────────────────
function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function MockupDesigner({
  visible,
  onClose,
  onSave,
  suggestedLocations,
  initialVariant,
  onColorChange,
  onRequestChangeProduct,
  configuredProduct,
  onConfiguredProductChange,
}: Props) {
  const { isMobile } = useBreakpoint();

  // ── Core canvas state ──
  const [garmentType, setGarmentType] = useState<GarmentType>('tshirt');
  const [garmentColor, setGarmentColor] = useState('#FFFFFF');
  const [currentView, setCurrentView] = useState<GarmentView>('front');
  const [uploadedArtworks, setUploadedArtworks] = useState<UploadedArtwork[]>([]);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [selectedArtworkId, setSelectedArtworkId] = useState<string | null>(null);
  const [activeZoneId, setActiveZoneId] = useState<PrintLocation | null>(null);
  const [saving, setSaving] = useState(false);

  // ── UI state ──
  const [mobileTab, setMobileTab] = useState<MobileTab>('library');
  const [artworkDragOver, setArtworkDragOver] = useState(false);
  const [draggedArtworkId, setDraggedArtworkId] = useState<string | null>(null);
  const [mdActiveColorIdx, setMdActiveColorIdx] = useState(0);
  const [lockAspectRatio, setLockAspectRatio] = useState(true);
  const [editingProduct, setEditingProduct] = useState(true);
  const [mediaSearch, setMediaSearch] = useState('');
  const [tool, setTool] = useState<'select' | 'text' | 'image' | 'templates'>('select');
  const [zoom, setZoom] = useState(1);
  const [historyTick, setHistoryTick] = useState(0);

  // ── Sync garment from ConfiguredProduct on open ──
  useEffect(() => {
    if (!visible) return;
    if (configuredProduct) {
      const gt = categoryToGarmentType(configuredProduct.category ?? configuredProduct.productType);
      if (gt) setGarmentType(gt);
      const activeHex = configuredProduct.colorVariants[0]?.colorHex;
      if (activeHex) setGarmentColor(activeHex);
      setMdActiveColorIdx(0);
    } else if (initialVariant?.color) {
      setGarmentColor('#FFFFFF');
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Refs ──
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const artworkDropRef = useRef<any>(null);
  const canvasContainerRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const draggedArtworkIdRef = useRef<string | null>(null);
  useEffect(() => { draggedArtworkIdRef.current = draggedArtworkId; }, [draggedArtworkId]);

  // ── Catalog template enhancement ──
  const linkedProductId = configuredProduct?.productId;
  const { data: effectivePlacementsData } = useQuery<{ placements?: any[] }>({
    queryKey: ['product-effective-placements', linkedProductId],
    queryFn: () => apiFetch(`/api/products/${linkedProductId}/effective-placements`),
    enabled: !!linkedProductId,
  });

  const dbOverrideByZone = useMemo(() => {
    const map: Partial<Record<PrintLocation, TemplateSizingOverride>> = {};
    const rows = effectivePlacementsData?.placements ?? [];
    for (const row of rows) {
      const loc = PLACEMENT_TYPE_TO_LOCATION[String(row.placementType)];
      if (!loc) continue;
      map[loc as PrintLocation] = {
        defaultWidthIn: row.defaultArtworkWidth ?? null,
        defaultHeightIn: row.defaultArtworkHeight ?? null,
        maxWidthIn: row.maxArtworkWidth ?? null,
        maxHeightIn: row.maxArtworkHeight ?? null,
      };
    }
    return map;
  }, [effectivePlacementsData]);

  const dbOverrideRef = useRef(dbOverrideByZone);
  useEffect(() => { dbOverrideRef.current = dbOverrideByZone; }, [dbOverrideByZone]);

  const templateForZone = (zone: ZoneDefinition): PrintTemplate =>
    resolveTemplate(zone, dbOverrideByZone[zone.id]);

  // ── Artwork management ──
  const addArtworkFromUri = useCallback((uri: string, name: string, naturalW?: number, naturalH?: number) => {
    const newArtwork: UploadedArtwork = { id: generateId(), uri, name, naturalW, naturalH };
    setUploadedArtworks(prev => [...prev, newArtwork]);
    setSelectedArtworkId(newArtwork.id);
  }, []);

  const MAX_ARTWORKS = 5;

  const handleUploadArtwork = useCallback(() => {
    if (uploadedArtworks.length >= MAX_ARTWORKS) return;
    if (Platform.OS === 'web') {
      if (!fileInputRef.current) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.multiple = true;
        fileInputRef.current = input;
      }
      const input = fileInputRef.current;
      input.onchange = (e: any) => {
        const files: File[] = Array.from(e.target.files || []);
        const remaining = MAX_ARTWORKS - uploadedArtworks.length;
        files.slice(0, remaining).forEach(file => {
          const reader = new FileReader();
          reader.onload = ev => {
            const uri = ev.target?.result as string;
            if (!uri) return;
            const img = new (window as any).Image();
            img.onload = () => addArtworkFromUri(uri, file.name, img.naturalWidth, img.naturalHeight);
            img.src = uri;
          };
          reader.readAsDataURL(file);
        });
        input.value = '';
      };
      input.click();
    } else {
      ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
        base64: true,
      }).then(result => {
        if (!result.canceled && result.assets[0]) {
          const asset = result.assets[0];
          const mimeType = asset.mimeType || 'image/png';
          const uri = asset.base64 ? `data:${mimeType};base64,${asset.base64}` : asset.uri;
          addArtworkFromUri(uri, asset.fileName || `Artwork ${uploadedArtworks.length + 1}`, asset.width ?? undefined, asset.height ?? undefined);
        }
      });
    }
  }, [addArtworkFromUri, uploadedArtworks.length]);

  const handleAddKoLogo = useCallback(() => {
    if (Platform.OS !== 'web') return;
    const img = new (window as any).Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const cv = document.createElement('canvas');
      cv.width = img.naturalWidth;
      cv.height = img.naturalHeight;
      cv.getContext('2d')!.drawImage(img, 0, 0);
      try {
        const uri = cv.toDataURL('image/png');
        addArtworkFromUri(uri, 'KO Logo', img.naturalWidth, img.naturalHeight);
      } catch {
        addArtworkFromUri(KO_LOGO_URL, 'KO Logo');
      }
    };
    img.onerror = () => addArtworkFromUri(KO_LOGO_URL, 'KO Logo');
    img.src = KO_LOGO_URL;
  }, [addArtworkFromUri]);

  const handleRemoveArtwork = (artworkId: string) => {
    setUploadedArtworks(prev => prev.filter(a => a.id !== artworkId));
    setPlacements(prev => prev.filter(p => p.artworkId !== artworkId));
    if (selectedArtworkId === artworkId) setSelectedArtworkId(null);
  };

  // ── Placement management ──
  const placeArtworkInZone = useCallback((artworkId: string, zone: ZoneDefinition) => {
    setUploadedArtworks(prev => {
      const artwork = prev.find(a => a.id === artworkId);
      if (!artwork) return prev;
      const tpl = resolveTemplate(zone, dbOverrideRef.current[zone.id]);
      const { widthIn, heightIn } = fitDefault(tpl, artwork.naturalW, artwork.naturalH);
      setPlacements(curr => {
        const filtered = curr.filter(p => p.zoneId !== zone.id);
        return [...filtered, {
          zoneId: zone.id,
          artworkId: artwork.id,
          artworkUri: artwork.uri,
          artWidthIn: widthIn.toFixed(2),
          artHeightIn: heightIn.toFixed(2),
          offsetXIn: tpl.defaultOffsetXIn,
          offsetYIn: tpl.defaultOffsetYIn,
          snap: tpl.snap,
          decorationMethod: tpl.decorationMethod,
          rotation: 0,
          opacity: 100,
        }];
      });
      setActiveZoneId(zone.id);
      return prev;
    });
  }, []);

  const handleZonePress = (zone: ZoneDefinition) => {
    if (selectedArtworkId) {
      placeArtworkInZone(selectedArtworkId, zone);
    } else {
      setActiveZoneId(prev => prev === zone.id ? null : zone.id);
    }
  };

  const handleRemovePlacement = (zoneId: PrintLocation) => {
    setPlacements(prev => prev.filter(p => p.zoneId !== zoneId));
    if (activeZoneId === zoneId) setActiveZoneId(null);
  };

  const handleReset = () => {
    setPlacements([]);
    setActiveZoneId(null);
    setSelectedArtworkId(null);
  };

  const toggleLayerHidden = (zoneId: PrintLocation) =>
    setPlacements(curr => curr.map(p => (p.zoneId === zoneId ? { ...p, hidden: !p.hidden } : p)));

  // Select/toggle a zone and snap the garment view to that zone's side so the
  // Properties / template card / crosshair stay coherent.
  const selectZone = (zoneId: PrintLocation) => {
    if (activeZoneId === zoneId) {
      setActiveZoneId(null);
      return;
    }
    const zone = GARMENTS[garmentType].zones.find(z => z.id === zoneId);
    if (zone) setCurrentView(zone.view);
    setActiveZoneId(zoneId);
  };

  // ── Undo / redo (placement history) ──
  const historyRef = useRef<Placement[][]>([]);
  const futureRef = useRef<Placement[][]>([]);
  const prevPlacementsRef = useRef<Placement[]>([]);
  const skipHistoryRef = useRef(false);
  const historyMountedRef = useRef(false);

  useEffect(() => {
    if (!historyMountedRef.current) {
      historyMountedRef.current = true;
      prevPlacementsRef.current = placements;
      return;
    }
    if (skipHistoryRef.current) {
      skipHistoryRef.current = false;
      prevPlacementsRef.current = placements;
      return;
    }
    historyRef.current = [...historyRef.current, prevPlacementsRef.current].slice(-50);
    futureRef.current = [];
    prevPlacementsRef.current = placements;
    setHistoryTick(t => t + 1);
  }, [placements]);

  const canUndo = historyRef.current.length > 0;
  const canRedo = futureRef.current.length > 0;

  const handleUndo = () => {
    if (!historyRef.current.length) return;
    const prev = historyRef.current[historyRef.current.length - 1];
    historyRef.current = historyRef.current.slice(0, -1);
    futureRef.current = [...futureRef.current, prevPlacementsRef.current];
    skipHistoryRef.current = true;
    prevPlacementsRef.current = prev;
    setPlacements(prev);
    setHistoryTick(t => t + 1);
  };

  const handleRedo = () => {
    if (!futureRef.current.length) return;
    const next = futureRef.current[futureRef.current.length - 1];
    futureRef.current = futureRef.current.slice(0, -1);
    historyRef.current = [...historyRef.current, prevPlacementsRef.current];
    skipHistoryRef.current = true;
    prevPlacementsRef.current = next;
    setPlacements(next);
    setHistoryTick(t => t + 1);
  };

  // ── Zoom controls ──
  const ZOOM_STEPS = [0.75, 1, 1.25, 1.5, 2];
  const cycleZoom = () =>
    setZoom(z => {
      const idx = ZOOM_STEPS.indexOf(z);
      return ZOOM_STEPS[(idx + 1) % ZOOM_STEPS.length] ?? 1;
    });
  const fitZoom = () => setZoom(1);

  // ── Template logic ──
  const resetPlacementToTemplate = (zoneId: PrintLocation) => {
    const zone = currentZones.find(z => z.id === zoneId);
    if (!zone) return;
    const tpl = resolveTemplate(zone, dbOverrideByZone[zoneId]);
    setPlacements(curr => curr.map(p => {
      if (p.zoneId !== zoneId) return p;
      const art = uploadedArtworks.find(a => a.id === p.artworkId);
      const { widthIn, heightIn } = fitDefault(tpl, art?.naturalW, art?.naturalH);
      return {
        ...p,
        artWidthIn: widthIn.toFixed(2),
        artHeightIn: heightIn.toFixed(2),
        offsetXIn: tpl.defaultOffsetXIn,
        offsetYIn: tpl.defaultOffsetYIn,
        snap: tpl.snap,
        decorationMethod: tpl.decorationMethod,
        rotation: 0,
        opacity: 100,
      };
    }));
  };

  const getPlacementStatus = (zone: ZoneDefinition, placement: Placement): PlacementStatus => {
    const tpl = resolveTemplate(zone, dbOverrideByZone[zone.id]);
    const art = uploadedArtworks.find(a => a.id === placement.artworkId);
    const def = fitDefault(tpl, art?.naturalW, art?.naturalH);
    const w = parseFloat(placement.artWidthIn || '');
    const h = parseFloat(placement.artHeightIn || '');
    const customSize =
      !Number.isFinite(w) || !Number.isFinite(h) ||
      !approxEqual(w, def.widthIn) || !approxEqual(h, def.heightIn);
    const customPosition =
      placement.snap !== tpl.snap ||
      !approxEqual(placement.offsetXIn, tpl.defaultOffsetXIn, 0.01) ||
      !approxEqual(placement.offsetYIn, tpl.defaultOffsetYIn, 0.01);
    const customMethod = placement.decorationMethod !== tpl.decorationMethod;
    return {
      usingTemplate: !customSize && !customPosition && !customMethod,
      customSize,
      customPosition,
      customMethod,
    };
  };

  const clampPairToMax = (
    wStr: string | undefined,
    hStr: string | undefined,
    tpl: PrintTemplate,
    ar: number | null,
  ): { w: string | undefined; h: string | undefined } => {
    let w = wStr;
    let h = hStr;
    const wn = parseFloat(w ?? '');
    if (Number.isFinite(wn) && wn > tpl.maxWidthIn) {
      w = tpl.maxWidthIn.toFixed(2);
      if (ar) h = (tpl.maxWidthIn * ar).toFixed(2);
    }
    const hn = parseFloat(h ?? '');
    if (Number.isFinite(hn) && hn > tpl.maxHeightIn) {
      h = tpl.maxHeightIn.toFixed(2);
      if (ar) w = (tpl.maxHeightIn / ar).toFixed(2);
    }
    return { w, h };
  };

  const setPlacementSnap = (zoneId: PrintLocation, snap: SnapPosition) =>
    setPlacements(curr => curr.map(p => (p.zoneId === zoneId ? { ...p, snap } : p)));

  const setPlacementDecoration = (zoneId: PrintLocation, decorationMethod: DecorationMethod) =>
    setPlacements(curr => curr.map(p => (p.zoneId === zoneId ? { ...p, decorationMethod } : p)));

  const centerOnArtboard = (zoneId: PrintLocation) =>
    setPlacements(curr => curr.map(p =>
      p.zoneId === zoneId ? { ...p, snap: 'center', offsetXIn: 0, offsetYIn: 0 } : p
    ));

  // ── Derived canvas values ──
  const isColorDark = useCallback((hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 < 128;
  }, []);

  const getOutlineColor = () => (isColorDark(garmentColor) ? '#444' : '#888');
  const getDetailColor = () => (isColorDark(garmentColor) ? '#555' : '#ccc');

  const garment = GARMENTS[garmentType];
  const svgPath = currentView === 'front' ? garment.frontPath : garment.backPath;
  const currentZones = garment.zones
    .filter(z => z.view === currentView)
    .sort((a, b) => {
      const aFull = a.id === 'Full Front' || a.id === 'Full Back';
      const bFull = b.id === 'Full Front' || b.id === 'Full Back';
      if (aFull && !bFull) return -1;
      if (!aFull && bFull) return 1;
      return 0;
    });
  const isDark = GARMENT_COLORS.find(c => c.value === garmentColor)?.dark ?? isColorDark(garmentColor);
  const zoneLabelColor = isDark ? 'rgba(255,255,255,0.88)' : 'rgba(40,40,40,0.75)';

  const placementForZone = (zoneId: PrintLocation) => placements.find(p => p.zoneId === zoneId);
  const isSuggestedZone = (zoneId: string) =>
    suggestedLocations?.some(l => l.toLowerCase().includes(zoneId.toLowerCase())) ?? false;

  // ── Active zone derived values (Properties panel) ──
  const activePlacement = activeZoneId ? placements.find(p => p.zoneId === activeZoneId) ?? null : null;
  const activeZone = activeZoneId ? currentZones.find(z => z.id === activeZoneId) ?? null : null;
  const activeTpl = activeZone ? templateForZone(activeZone) : null;
  const activeStatus = (activeZone && activePlacement) ? getPlacementStatus(activeZone, activePlacement) : null;
  const activePlacedArtwork = activePlacement
    ? uploadedArtworks.find(a => a.id === activePlacement.artworkId) ?? null
    : null;
  const activeAspectRatio =
    (activePlacedArtwork?.naturalH && activePlacedArtwork?.naturalW)
      ? activePlacedArtwork.naturalH / activePlacedArtwork.naturalW
      : (activePlacement?.artWidthIn && activePlacement?.artHeightIn)
        ? parseFloat(activePlacement.artHeightIn) / parseFloat(activePlacement.artWidthIn)
        : null;

  const handleActiveWChange = (val: string) => {
    if (!activeZoneId || !activeTpl) return;
    const num = parseFloat(val);
    const linkedH = (lockAspectRatio && activeAspectRatio && !isNaN(num) && val.trim() !== '' && val !== '.')
      ? (num * activeAspectRatio).toFixed(2)
      : activePlacement?.artHeightIn;
    const { w, h } = clampPairToMax(val, linkedH, activeTpl, lockAspectRatio ? activeAspectRatio : null);
    setPlacements(prev => prev.map(p => p.zoneId === activeZoneId ? { ...p, artWidthIn: w, artHeightIn: h } : p));
  };

  const handleActiveHChange = (val: string) => {
    if (!activeZoneId || !activeTpl) return;
    const num = parseFloat(val);
    const linkedW = (lockAspectRatio && activeAspectRatio && !isNaN(num) && val.trim() !== '' && val !== '.')
      ? (num / activeAspectRatio).toFixed(2)
      : activePlacement?.artWidthIn;
    const { w, h } = clampPairToMax(linkedW, val, activeTpl, lockAspectRatio ? activeAspectRatio : null);
    setPlacements(prev => prev.map(p => p.zoneId === activeZoneId ? { ...p, artWidthIn: w, artHeightIn: h } : p));
  };

  // ── Print Locations from ConfiguredProduct ──
  const cpLocations: string[] = configuredProduct?.printLocations ?? [];

  // ── Dimension helper for layers / cards ──
  const placementDims = (p: Placement): { w: number; h: number } => {
    const zone = garment.zones.find(z => z.id === p.zoneId);
    const tpl = zone ? resolveTemplate(zone, dbOverrideByZone[p.zoneId]) : null;
    const w = parseFloat(p.artWidthIn || '') || tpl?.defaultWidthIn || 0;
    const h = parseFloat(p.artHeightIn || '') || tpl?.defaultHeightIn || 0;
    return { w, h };
  };

  // ── Header product breadcrumb ──
  const activeColorName =
    configuredProduct?.colorVariants[mdActiveColorIdx]?.color ?? initialVariant?.color ?? '';
  const breadcrumbParts = [
    configuredProduct?.styleNumber && configuredProduct?.styleName
      ? `${configuredProduct.styleNumber} – ${configuredProduct.styleName}`
      : configuredProduct?.styleName ?? configuredProduct?.styleNumber ?? configuredProduct?.productLabel ?? '',
    activeColorName,
    configuredProduct?.vendorName ?? '',
  ].filter(Boolean);

  // ── Active artwork rect on canvas (crosshair + resize handle) ──
  let activeArtRect: { left: number; top: number; width: number; height: number } | null = null;
  if (activePlacement && !activePlacement.hidden && activeZone) {
    const tpl = resolveTemplate(activeZone, dbOverrideByZone[activeZone.id]);
    const widthIn = parseFloat(activePlacement.artWidthIn || '') || tpl.defaultWidthIn;
    const heightIn = parseFloat(activePlacement.artHeightIn || '') || tpl.defaultHeightIn;
    const rect = computeArtRect(activeZone, {
      widthIn,
      heightIn,
      snap: activePlacement.snap,
      offsetXIn: activePlacement.offsetXIn,
      offsetYIn: activePlacement.offsetYIn,
      safeAreaIn: tpl.safeAreaIn,
    });
    activeArtRect = {
      left: rect.x * SCALE,
      top: (rect.y + 30) * SCALE,
      width: rect.w * SCALE,
      height: rect.h * SCALE,
    };
  }

  // ── Canvas composition ──
  const composeCanvas = useCallback(async (): Promise<string | null> => {
    if (Platform.OS !== 'web') return null;
    const scale = 2;
    const W = CANVAS_W * scale;
    const H = CANVAS_H * scale;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.scale(scale, scale);
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    const garmentPath = new Path2D(svgPath);
    ctx.fillStyle = garmentColor;
    ctx.fill(garmentPath);
    ctx.strokeStyle = getOutlineColor();
    ctx.lineWidth = 1.5;
    ctx.stroke(garmentPath);
    const placementPromises = currentZones
      .map(zone => placements.find(p => p.zoneId === zone.id))
      .filter((p): p is Placement => !!p && !p.hidden)
      .map(placement => new Promise<void>(resolve => {
        if (!placement) { resolve(); return; }
        const zone = currentZones.find(z => z.id === placement.zoneId);
        if (!zone) { resolve(); return; }
        const img = new window.Image();
        img.onload = () => {
          const tpl = resolveTemplate(zone, dbOverrideByZone[zone.id]);
          const widthIn = parseFloat(placement.artWidthIn || '') || tpl.defaultWidthIn;
          const heightIn = parseFloat(placement.artHeightIn || '') || tpl.defaultHeightIn;
          const rect = computeArtRect(zone, {
            widthIn,
            heightIn,
            snap: placement.snap,
            offsetXIn: placement.offsetXIn,
            offsetYIn: placement.offsetYIn,
            safeAreaIn: tpl.safeAreaIn,
          });
          const cx = rect.x + rect.w / 2;
          const cy = rect.y + rect.h / 2;
          const deg = placement.rotation ?? 0;
          ctx.save();
          ctx.globalAlpha = (placement.opacity ?? 100) / 100;
          ctx.translate(cx, cy);
          ctx.rotate(deg * Math.PI / 180);
          ctx.drawImage(img, -rect.w / 2, -rect.h / 2, rect.w, rect.h);
          ctx.restore();
          resolve();
        };
        img.onerror = () => resolve();
        img.src = placement.artworkUri;
      }));
    await Promise.all(placementPromises);
    return canvas.toDataURL('image/png');
  }, [svgPath, garmentColor, currentZones, placements, dbOverrideByZone]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const uri = await composeCanvas();
      if (uri) { onSave(uri); onClose(); }
    } finally {
      setSaving(false);
    }
  };

  // ── Drag-drop: prevent browser default while modal open ──
  useEffect(() => {
    if (Platform.OS !== 'web' || !visible) return;
    const prevent = (e: Event) => { e.preventDefault(); };
    document.addEventListener('dragover', prevent);
    document.addEventListener('drop', prevent);
    return () => {
      document.removeEventListener('dragover', prevent);
      document.removeEventListener('drop', prevent);
    };
  }, [visible]);

  // ── Drag-drop: files into artwork area ──
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = artworkDropRef.current;
    if (!el) return;
    const domEl = el as HTMLElement;
    const onDragOver = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); setArtworkDragOver(true); };
    const onDragLeave = (e: DragEvent) => { if (!domEl.contains(e.relatedTarget as Node)) setArtworkDragOver(false); };
    const onDrop = (e: DragEvent) => {
      e.preventDefault(); e.stopPropagation(); setArtworkDragOver(false);
      const files = e.dataTransfer?.files;
      if (!files) return;
      Array.from(files).forEach(file => {
        if (!file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = ev => {
          const uri = ev.target?.result as string;
          if (!uri) return;
          const img = new (window as any).Image();
          img.onload = () => addArtworkFromUri(uri, file.name, img.naturalWidth, img.naturalHeight);
          img.src = uri;
        };
        reader.readAsDataURL(file);
      });
    };
    domEl.addEventListener('dragover', onDragOver);
    domEl.addEventListener('dragleave', onDragLeave);
    domEl.addEventListener('drop', onDrop);
    return () => {
      domEl.removeEventListener('dragover', onDragOver);
      domEl.removeEventListener('dragleave', onDragLeave);
      domEl.removeEventListener('drop', onDrop);
    };
  }, [addArtworkFromUri, artworkDropRef.current]);

  // ── Drag-drop: artwork onto canvas zones ──
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = canvasContainerRef.current;
    if (!el) return;
    const domEl = el as HTMLElement;
    const onDragOver = (e: DragEvent) => { e.preventDefault(); };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      const artId = (e as any).dataTransfer?.getData('text/artwork-id') || draggedArtworkIdRef.current;
      if (!artId) return;
      const rect = domEl.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const canvasX = mouseX / SCALE;
      const canvasY = (mouseY / SCALE) - 30;
      const allZones = GARMENTS[garmentType].zones.filter(z => z.view === currentView);
      const hit = allZones.find(z =>
        canvasX >= z.x && canvasX <= z.x + z.w &&
        canvasY >= z.y && canvasY <= z.y + z.h
      );
      if (hit) placeArtworkInZone(artId, hit);
      setDraggedArtworkId(null);
    };
    domEl.addEventListener('dragover', onDragOver);
    domEl.addEventListener('drop', onDrop);
    return () => {
      domEl.removeEventListener('dragover', onDragOver);
      domEl.removeEventListener('drop', onDrop);
    };
  }, [garmentType, currentView, placeArtworkInZone]);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.panel}>

          {/* ── Header ── */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Pencil size={16} color={Colors.light.tint} />
              <Text style={styles.headerTitle}>Mockup Designer</Text>
            </View>
            {!isMobile && breadcrumbParts.length > 0 && (
              <View style={styles.headerCenter}>
                <Text style={styles.headerBreadcrumb} numberOfLines={1}>
                  {breadcrumbParts.join('   •   ')}
                </Text>
              </View>
            )}
            <View style={styles.headerRight}>
              {configuredProduct && (
                <TouchableOpacity
                  style={styles.changeProductBtn}
                  onPress={() => {
                    if (onRequestChangeProduct) onRequestChangeProduct();
                    else setEditingProduct(v => !v);
                  }}
                >
                  <Pencil size={12} color="#fff" />
                  <Text style={styles.changeProductText}>Change Product</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                <X size={20} color="rgba(255,255,255,0.85)" />
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Mobile Tab Bar ── */}
          {isMobile && (
            <View style={styles.mobileTabBar}>
              {(['library', 'canvas', 'properties'] as MobileTab[]).map(tab => (
                <TouchableOpacity
                  key={tab}
                  style={[styles.mobileTabBtn, mobileTab === tab && styles.mobileTabBtnActive]}
                  onPress={() => setMobileTab(tab)}
                >
                  <Text style={[styles.mobileTabText, mobileTab === tab && styles.mobileTabTextActive]}>
                    {tab === 'library' ? 'Library' : tab === 'canvas' ? 'Canvas' : 'Properties'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* ── Sub-header: product editor ── */}
          {editingProduct && (
            <View style={styles.toolbar}>
              {configuredProduct ? (
                <View style={styles.toolbarRow}>
                  <View style={styles.toolbarEditor}>
                    <ConfiguredProductEditor
                      value={configuredProduct}
                      onChange={(cp) => {
                        onConfiguredProductChange?.(cp);
                        const hex = cp.colorVariants[mdActiveColorIdx]?.colorHex;
                        if (hex) setGarmentColor(hex);
                        const gt = categoryToGarmentType(cp.category ?? cp.productType);
                        if (gt) setGarmentType(gt);
                      }}
                      layout="toolbar"
                      surface="mockupDesigner"
                      mode="internal"
                      showSizes={false}
                      showPreview={false}
                      showLocations={false}
                      activeColorIndex={mdActiveColorIdx}
                      onActiveColorChange={(idx) => {
                        setMdActiveColorIdx(idx);
                        const hex = configuredProduct.colorVariants[idx]?.colorHex;
                        if (hex) setGarmentColor(hex);
                      }}
                    />
                  </View>
                  <TouchableOpacity style={styles.doneEditingBtn} onPress={() => setEditingProduct(false)}>
                    <Check size={13} color={Colors.light.text} />
                    <Text style={styles.doneEditingText}>Done Editing</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.toolbarEmpty}>
                  <Text style={styles.toolbarEmptyText}>No product configured</Text>
                </View>
              )}
            </View>
          )}

          {/* ── Body ── */}
          <View style={[styles.body, isMobile && styles.bodyMobile]}>

            {/* ════ LEFT SIDEBAR ════ */}
            <ScrollView
              style={[
                styles.leftSidebar,
                isMobile && mobileTab !== 'library' && { display: 'none' },
                isMobile && { width: '100%' },
              ]}
              showsVerticalScrollIndicator={false}
            >
              <SectionHeader title="MEDIA LIBRARY" />

              {/* Search + add */}
              <View style={styles.searchRow}>
                <View style={styles.searchBox}>
                  <Search size={13} color={Colors.light.textSecondary} />
                  <TextInput
                    style={styles.searchInput}
                    value={mediaSearch}
                    onChangeText={setMediaSearch}
                    placeholder="Search media"
                    placeholderTextColor="#9aa0a6"
                  />
                </View>
                <TouchableOpacity style={styles.addMediaBtn} onPress={handleUploadArtwork}>
                  <Plus size={16} color="#fff" />
                </TouchableOpacity>
              </View>

              {/* Company Logos */}
              <View style={styles.libSectionRow}>
                <Text style={styles.libSectionTitle}>Company Logos</Text>
                <TouchableOpacity onPress={handleAddKoLogo}>
                  <Text style={styles.viewAll}>View all ›</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.tileGrid}>
                {(!mediaSearch.trim() || 'ko logo katalyst ko.'.includes(mediaSearch.trim().toLowerCase())) ? (
                  <TouchableOpacity style={styles.mediaTile} onPress={handleAddKoLogo} activeOpacity={0.75}>
                    <Image source={{ uri: KO_LOGO_URL }} style={styles.mediaTileLogo} resizeMode="contain" />
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.emptyNote}>No matches</Text>
                )}
              </View>

              {/* Client Artwork */}
              <View style={styles.libSectionRow}>
                <Text style={styles.libSectionTitle}>Client Artwork</Text>
                <TouchableOpacity onPress={handleUploadArtwork}>
                  <Text style={styles.viewAll}>View all ›</Text>
                </TouchableOpacity>
              </View>
              <View
                ref={artworkDropRef}
                style={[styles.artworkSection, artworkDragOver && styles.artworkSectionDragOver]}
              >
                <View style={styles.tileGrid}>
                  {uploadedArtworks
                    .filter(a => a.name.toLowerCase().includes(mediaSearch.trim().toLowerCase()))
                    .map(artwork => (
                      <TouchableOpacity
                        key={artwork.id}
                        style={[
                          styles.mediaTile,
                          selectedArtworkId === artwork.id && styles.mediaTileSelected,
                          draggedArtworkId === artwork.id && styles.mediaTileDragging,
                        ]}
                        onPress={() => setSelectedArtworkId(prev => prev === artwork.id ? null : artwork.id)}
                        {...(Platform.OS === 'web' ? {
                          draggable: true,
                          onDragStart: (e: any) => {
                            setDraggedArtworkId(artwork.id);
                            setSelectedArtworkId(artwork.id);
                            e.dataTransfer?.setData('text/artwork-id', artwork.id);
                          },
                          onDragEnd: () => setDraggedArtworkId(null),
                        } : {})}
                      >
                        <Image source={{ uri: artwork.uri }} style={styles.mediaTileImg} resizeMode="contain" />
                        <TouchableOpacity
                          style={styles.mediaTileDelete}
                          onPress={() => handleRemoveArtwork(artwork.id)}
                        >
                          <X size={9} color="#fff" />
                        </TouchableOpacity>
                      </TouchableOpacity>
                    ))}
                  {uploadedArtworks.length < MAX_ARTWORKS && (
                    <TouchableOpacity
                      style={[styles.mediaTile, styles.mediaTileAdd, artworkDragOver && styles.mediaTileAddDragOver]}
                      onPress={handleUploadArtwork}
                      activeOpacity={0.75}
                    >
                      <Plus size={18} color={artworkDragOver ? Colors.light.tint : Colors.light.borderDark} />
                    </TouchableOpacity>
                  )}
                </View>
                {selectedArtworkId && (
                  <View style={styles.placingHint}>
                    <Text style={styles.placingHintText}>Tap a zone or drag onto the garment</Text>
                  </View>
                )}
              </View>

              {/* Layers */}
              <View style={styles.libSectionRow}>
                <Text style={styles.libSectionTitle}>Layers</Text>
                <TouchableOpacity onPress={handleUploadArtwork}>
                  <Text style={styles.addLayer}>+ Add Layer</Text>
                </TouchableOpacity>
              </View>
              {placements.length === 0 ? (
                <Text style={styles.emptyNote}>No placed artwork yet</Text>
              ) : (
                placements.map(p => {
                  const isActive = activeZoneId === p.zoneId;
                  const dims = placementDims(p);
                  return (
                    <TouchableOpacity
                      key={p.zoneId}
                      style={[styles.layerItem, isActive && styles.layerItemActive]}
                      onPress={() => selectZone(p.zoneId)}
                    >
                      <View style={styles.layerInfo}>
                        <Text style={[styles.layerZone, isActive && styles.layerZoneActive]} numberOfLines={1}>{p.zoneId}</Text>
                        <Text style={styles.layerDims} numberOfLines={1}>
                          {dims.w.toFixed(2)}&quot; W x {dims.h.toFixed(2)}&quot; H
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.layerIconBtn}
                        onPress={() => toggleLayerHidden(p.zoneId)}
                      >
                        {p.hidden
                          ? <EyeOff size={13} color={Colors.light.textSecondary} />
                          : <Eye size={13} color={isActive ? Colors.light.tint : Colors.light.textSecondary} />}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.layerIconBtn}
                        onPress={() => handleRemovePlacement(p.zoneId)}
                      >
                        <Trash2 size={12} color={Colors.light.error} />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            {/* ════ VERTICAL TOOLBAR ════ */}
            {!isMobile && (
              <View style={styles.verticalToolbar}>
                <TouchableOpacity
                  style={[styles.toolBtn, tool === 'select' && styles.toolBtnActive]}
                  onPress={() => setTool('select')}
                >
                  <MousePointer2 size={17} color={tool === 'select' ? Colors.light.tint : Colors.light.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toolBtn, tool === 'text' && styles.toolBtnActive]}
                  onPress={() => setTool('text')}
                >
                  <TypeIcon size={17} color={tool === 'text' ? Colors.light.tint : Colors.light.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.toolBtn}
                  onPress={() => { setTool('image'); handleUploadArtwork(); }}
                >
                  <ImagePlus size={17} color={Colors.light.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toolBtn, tool === 'templates' && styles.toolBtnActive]}
                  onPress={() => setTool('templates')}
                >
                  <LayoutTemplate size={17} color={tool === 'templates' ? Colors.light.tint : Colors.light.textSecondary} />
                </TouchableOpacity>

                <View style={styles.toolbarDivider} />

                <TouchableOpacity
                  style={[styles.toolBtn, !canUndo && styles.toolBtnDisabled]}
                  onPress={handleUndo}
                  disabled={!canUndo}
                >
                  <Undo2 size={17} color={canUndo ? Colors.light.textSecondary : Colors.light.border} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toolBtn, !canRedo && styles.toolBtnDisabled]}
                  onPress={handleRedo}
                  disabled={!canRedo}
                >
                  <Redo2 size={17} color={canRedo ? Colors.light.textSecondary : Colors.light.border} />
                </TouchableOpacity>

                <View style={{ flex: 1 }} />

                <TouchableOpacity style={styles.toolBtn} onPress={fitZoom}>
                  <Maximize2 size={16} color={Colors.light.textSecondary} />
                  <Text style={styles.toolBtnLabel}>Fit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.toolBtn} onPress={cycleZoom}>
                  <ZoomIn size={16} color={Colors.light.textSecondary} />
                  <Text style={styles.toolBtnLabel}>{Math.round(zoom * 100)}%</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ════ CENTER CANVAS ════ */}
            <View style={[
              styles.centerPanel,
              isMobile && mobileTab !== 'canvas' && { display: 'none' },
              isMobile && { width: '100%' },
            ]}>
              {/* Front / Back tabs */}
              {garmentType !== 'hat' && (
                <View style={styles.viewTabs}>
                  <TouchableOpacity
                    style={[styles.viewTab, currentView === 'front' && styles.viewTabActive]}
                    onPress={() => setCurrentView('front')}
                  >
                    <Text style={[styles.viewTabText, currentView === 'front' && styles.viewTabTextActive]}>Front</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.viewTab, currentView === 'back' && styles.viewTabActive]}
                    onPress={() => setCurrentView('back')}
                  >
                    <Text style={[styles.viewTabText, currentView === 'back' && styles.viewTabTextActive]}>Back</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Canvas */}
              <View
                ref={canvasContainerRef}
                style={[
                  styles.canvasContainer,
                  { width: DISPLAY_W, height: DISPLAY_H, transform: [{ scale: zoom }] },
                ]}
              >
                {/* Garment SVG */}
                <Svg
                  width={DISPLAY_W}
                  height={DISPLAY_H}
                  viewBox={`0 -30 ${CANVAS_W} ${CANVAS_H + 30}`}
                  style={styles.garmentSvg}
                >
                  <G>
                    <Path
                      d={svgPath}
                      fill={garmentColor}
                      stroke={getOutlineColor()}
                      strokeWidth={2}
                    />
                    {garmentType === 'hoodie' && currentView === 'front' && (
                      <>
                        <Line x1={250} y1={80} x2={250} y2={560} stroke={getDetailColor()} strokeWidth={2} />
                        <Rect x={165} y={450} width={170} height={100} rx={8} ry={8}
                          fill="none" stroke={getDetailColor()} strokeWidth={1.5} />
                        <Line x1={165} y1={500} x2={335} y2={500} stroke={getDetailColor()} strokeWidth={1} />
                      </>
                    )}
                    {garmentType === 'polo' && currentView === 'front' && (
                      <>
                        <Rect x={234} y={100} width={32} height={130} rx={3}
                          fill="none" stroke={getDetailColor()} strokeWidth={1.5} />
                        <Circle cx={250} cy={116} r={3.5} fill={getDetailColor()} />
                        <Circle cx={250} cy={136} r={3.5} fill={getDetailColor()} />
                        <Circle cx={250} cy={156} r={3.5} fill={getDetailColor()} />
                        <Circle cx={250} cy={176} r={3.5} fill={getDetailColor()} />
                        <Path d="M 185,55 C 210,75 220,100 228,135 L 250,108 Z"
                          fill={garmentColor} stroke={getDetailColor()} strokeWidth={1.5} />
                        <Path d="M 315,55 C 290,75 280,100 272,135 L 250,108 Z"
                          fill={garmentColor} stroke={getDetailColor()} strokeWidth={1.5} />
                      </>
                    )}
                    {garmentType === 'hat' && (
                      <>
                        <Line x1={250} y1={60} x2={250} y2={260} stroke={getDetailColor()} strokeWidth={1.5} strokeDasharray="4,3" />
                        <Circle cx={250} cy={50} r={8} fill={getDetailColor()} />
                      </>
                    )}
                  </G>
                </Svg>

                {/* Zone overlays */}
                {currentZones.map(zone => {
                  const placement = placementForZone(zone.id);
                  const isActive = activeZoneId === zone.id;
                  const isSuggested = isSuggestedZone(zone.id);
                  const hasArtwork = !!placement;

                  let artStyle: { left: number; top: number; width: number; height: number } | null = null;
                  if (placement && !placement.hidden) {
                    const tpl = resolveTemplate(zone, dbOverrideByZone[zone.id]);
                    const widthIn = parseFloat(placement.artWidthIn || '') || tpl.defaultWidthIn;
                    const heightIn = parseFloat(placement.artHeightIn || '') || tpl.defaultHeightIn;
                    const rect = computeArtRect(zone, {
                      widthIn,
                      heightIn,
                      snap: placement.snap,
                      offsetXIn: placement.offsetXIn,
                      offsetYIn: placement.offsetYIn,
                      safeAreaIn: tpl.safeAreaIn,
                    });
                    artStyle = {
                      left: (rect.x - zone.x) * SCALE,
                      top: (rect.y - zone.y) * SCALE,
                      width: rect.w * SCALE,
                      height: rect.h * SCALE,
                    };
                  }

                  return (
                    <TouchableOpacity
                      key={zone.id}
                      style={[
                        styles.zone,
                        {
                          left: zone.x * SCALE,
                          top: (zone.y + 30) * SCALE,
                          width: zone.w * SCALE,
                          height: zone.h * SCALE,
                        },
                        isSuggested && styles.zoneSuggested,
                        isActive && styles.zoneActive,
                        hasArtwork && styles.zoneHasArtwork,
                      ]}
                      onPress={() => handleZonePress(zone)}
                      activeOpacity={0.7}
                    >
                      {placement && artStyle ? (
                        <>
                          <Image
                            source={{ uri: placement.artworkUri }}
                            style={[
                              styles.zoneArtworkImage,
                              artStyle,
                              {
                                opacity: (placement.opacity ?? 100) / 100,
                                transform: [{ rotate: `${placement.rotation ?? 0}deg` }],
                              },
                            ]}
                            resizeMode="contain"
                          />
                          <TouchableOpacity
                            style={styles.zoneRemoveBtn}
                            onPress={() => handleRemovePlacement(zone.id)}
                          >
                            <X size={8} color="#fff" />
                          </TouchableOpacity>
                        </>
                      ) : (
                        <Text style={[
                          styles.zoneLabel,
                          { fontSize: Math.max(7, zone.w * SCALE * 0.09), color: zoneLabelColor },
                        ]}>
                          {zone.id}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}

                {/* Alignment crosshair + resize handle on active artwork */}
                {activeArtRect && (
                  <>
                    <View
                      pointerEvents="none"
                      style={[
                        styles.crosshairV,
                        { left: activeArtRect.left + activeArtRect.width / 2 },
                      ]}
                    />
                    <View
                      pointerEvents="none"
                      style={[
                        styles.crosshairH,
                        { top: activeArtRect.top + activeArtRect.height / 2 },
                      ]}
                    />
                    <View
                      pointerEvents="none"
                      style={[
                        styles.artSelectBox,
                        {
                          left: activeArtRect.left,
                          top: activeArtRect.top,
                          width: activeArtRect.width,
                          height: activeArtRect.height,
                        },
                      ]}
                    />
                    <View
                      pointerEvents="none"
                      style={[
                        styles.resizeHandle,
                        {
                          left: activeArtRect.left + activeArtRect.width - 5,
                          top: activeArtRect.top + activeArtRect.height - 5,
                        },
                      ]}
                    />
                  </>
                )}
              </View>

              {/* Zoom badge */}
              <View style={styles.zoomBadge}>
                <Text style={styles.zoomBadgeText}>{Math.round(zoom * 100)}%</Text>
              </View>
            </View>

            {/* ════ RIGHT SIDEBAR ════ */}
            <ScrollView
              style={[
                styles.rightSidebar,
                isMobile && mobileTab !== 'properties' && { display: 'none' },
                isMobile && { width: '100%' },
              ]}
              showsVerticalScrollIndicator={false}
            >
              {/* PRINT LOCATIONS */}
              <SectionHeader title="PRINT LOCATIONS" />
              {cpLocations.length === 0 ? (
                <Text style={styles.emptyNote}>No locations configured{'\n'}Add locations via the product editor</Text>
              ) : (
                cpLocations.map(loc => {
                  const hasPlacement = placements.some(p => p.zoneId === loc && !p.hidden);
                  const isActive = activeZoneId === loc;
                  return (
                    <TouchableOpacity
                      key={loc}
                      style={[styles.locRow, isActive && styles.locRowActive]}
                      onPress={() => selectZone(loc as PrintLocation)}
                    >
                      <Star
                        size={13}
                        color={isActive || hasPlacement ? Colors.light.tint : Colors.light.borderDark}
                        fill={hasPlacement ? Colors.light.tint : 'none'}
                      />
                      <Text style={[styles.locName, isActive && styles.locNameActive, hasPlacement && styles.locNameFilled]}>
                        {loc}
                      </Text>
                      {hasPlacement && <View style={styles.locCheckDot} />}
                    </TouchableOpacity>
                  );
                })
              )}

              {/* Template reference card */}
              {activeZone && activeTpl && (
                <View style={styles.templateCard}>
                  <View style={styles.templateThumb}>
                    <LayoutTemplate size={22} color={Colors.light.tint} />
                  </View>
                  <View style={styles.templateInfo}>
                    <Text style={styles.templateTitle} numberOfLines={1}>{activeZoneId} Template</Text>
                    <View style={styles.templateMetaRow}>
                      <Text style={styles.templateMetaLabel}>Default</Text>
                      <Text style={styles.templateMetaValue}>
                        {activeTpl.defaultWidthIn.toFixed(1)}&quot; × {activeTpl.defaultHeightIn.toFixed(1)}&quot;
                      </Text>
                    </View>
                    <View style={styles.templateMetaRow}>
                      <Text style={styles.templateMetaLabel}>Max</Text>
                      <Text style={styles.templateMetaValue}>
                        {activeTpl.maxWidthIn.toFixed(1)}&quot; × {activeTpl.maxHeightIn.toFixed(1)}&quot;
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* PROPERTIES */}
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionHeaderRowText}>PROPERTIES</Text>
                {activePlacement && (
                  <TouchableOpacity onPress={() => activeZoneId && resetPlacementToTemplate(activeZoneId)}>
                    <Text style={styles.resetTemplateLink}>Reset Template</Text>
                  </TouchableOpacity>
                )}
              </View>
              {!activePlacement ? (
                <Text style={styles.emptyNote}>
                  {activeZoneId
                    ? 'Drop artwork onto this zone to edit'
                    : 'Select a zone or layer to edit'}
                </Text>
              ) : (
                <View style={styles.propsPanel}>
                  {/* Width / Height */}
                  <View style={styles.propGrid}>
                    <View style={styles.propField}>
                      <Text style={styles.propFieldLabel}>Width</Text>
                      <View style={styles.propInputWrap}>
                        <TextInput
                          style={styles.propFieldInput}
                          value={activePlacement.artWidthIn ?? ''}
                          onChangeText={handleActiveWChange}
                          keyboardType="decimal-pad"
                          placeholder={activeTpl?.defaultWidthIn.toFixed(1)}
                          placeholderTextColor="#aaa"
                        />
                        <Text style={styles.propInputUnit}>&quot;</Text>
                      </View>
                    </View>
                    <View style={styles.propField}>
                      <Text style={styles.propFieldLabel}>Height</Text>
                      <View style={styles.propInputWrap}>
                        <TextInput
                          style={styles.propFieldInput}
                          value={activePlacement.artHeightIn ?? ''}
                          onChangeText={handleActiveHChange}
                          keyboardType="decimal-pad"
                          placeholder={activeTpl?.defaultHeightIn.toFixed(1)}
                          placeholderTextColor="#aaa"
                        />
                        <Text style={styles.propInputUnit}>&quot;</Text>
                      </View>
                    </View>
                  </View>

                  {/* Lock aspect ratio toggle */}
                  <TouchableOpacity style={styles.toggleRow} onPress={() => setLockAspectRatio(v => !v)} activeOpacity={0.8}>
                    <Text style={styles.toggleLabel}>Lock Aspect Ratio</Text>
                    <View style={[styles.switchTrack, lockAspectRatio && styles.switchTrackOn]}>
                      <View style={[styles.switchThumb, lockAspectRatio && styles.switchThumbOn]} />
                    </View>
                  </TouchableOpacity>

                  {/* Position from center */}
                  <Text style={styles.propGroupLabel}>Position (from center)</Text>
                  <View style={styles.propGrid}>
                    <View style={styles.propField}>
                      <Text style={styles.propFieldLabel}>X</Text>
                      <View style={styles.propInputWrap}>
                        <TextInput
                          style={styles.propFieldInput}
                          value={(activePlacement.offsetXIn ?? 0).toFixed(2)}
                          onChangeText={(val) => {
                            const n = parseFloat(val);
                            if (!isNaN(n)) setPlacements(prev => prev.map(p =>
                              p.zoneId === activeZoneId ? { ...p, offsetXIn: n } : p
                            ));
                          }}
                          keyboardType="decimal-pad"
                          placeholder="0.00"
                          placeholderTextColor="#aaa"
                        />
                        <Text style={styles.propInputUnit}>&quot;</Text>
                      </View>
                    </View>
                    <View style={styles.propField}>
                      <Text style={styles.propFieldLabel}>Y</Text>
                      <View style={styles.propInputWrap}>
                        <TextInput
                          style={styles.propFieldInput}
                          value={(activePlacement.offsetYIn ?? 0).toFixed(2)}
                          onChangeText={(val) => {
                            const n = parseFloat(val);
                            if (!isNaN(n)) setPlacements(prev => prev.map(p =>
                              p.zoneId === activeZoneId ? { ...p, offsetYIn: n } : p
                            ));
                          }}
                          keyboardType="decimal-pad"
                          placeholder="0.00"
                          placeholderTextColor="#aaa"
                        />
                        <Text style={styles.propInputUnit}>&quot;</Text>
                      </View>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.centerArtBtn}
                    onPress={() => activeZoneId && centerOnArtboard(activeZoneId)}
                  >
                    <Crosshair size={12} color={Colors.light.textSecondary} />
                    <Text style={styles.centerArtText}>Center on Artboard</Text>
                  </TouchableOpacity>

                  {/* Rotation / Opacity */}
                  <View style={styles.propGrid}>
                    <View style={styles.propField}>
                      <Text style={styles.propFieldLabel}>Rotation</Text>
                      <OverlayMenu
                        menuWidth={120}
                        align="left"
                        trigger={({ open }) => (
                          <TouchableOpacity style={styles.propSelect} onPress={open}>
                            <Text style={styles.propSelectText} numberOfLines={1}>
                              {activePlacement.rotation ?? 0}°
                            </Text>
                            <ChevronDown size={12} color={Colors.light.textSecondary} />
                          </TouchableOpacity>
                        )}
                      >
                        {({ close }) => (
                          <>
                            {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => (
                              <TouchableOpacity
                                key={deg}
                                style={styles.menuOption}
                                onPress={() => {
                                  close();
                                  setPlacements(prev => prev.map(p =>
                                    p.zoneId === activeZoneId ? { ...p, rotation: deg } : p
                                  ));
                                }}
                              >
                                <Text style={[styles.menuOptionText, (activePlacement.rotation ?? 0) === deg && styles.menuOptionTextActive]}>
                                  {deg}°
                                </Text>
                                {(activePlacement.rotation ?? 0) === deg && (
                                  <CheckCircle size={12} color={Colors.light.tint} />
                                )}
                              </TouchableOpacity>
                            ))}
                          </>
                        )}
                      </OverlayMenu>
                    </View>
                    <View style={styles.propField}>
                      <Text style={styles.propFieldLabel}>Opacity</Text>
                      <View style={styles.propInputWrap}>
                        <TextInput
                          style={styles.propFieldInput}
                          value={String(activePlacement.opacity ?? 100)}
                          onChangeText={(val) => {
                            const n = Math.min(100, Math.max(0, parseFloat(val) || 0));
                            setPlacements(prev => prev.map(p =>
                              p.zoneId === activeZoneId ? { ...p, opacity: n } : p
                            ));
                          }}
                          keyboardType="decimal-pad"
                          placeholder="100"
                          placeholderTextColor="#aaa"
                        />
                        <Text style={styles.propInputUnit}>%</Text>
                      </View>
                    </View>
                  </View>

                  {/* Decoration Method */}
                  <Text style={styles.propGroupLabel}>Decoration Method</Text>
                  <OverlayMenu
                    menuWidth={200}
                    align="right"
                    trigger={({ open }) => (
                      <TouchableOpacity style={styles.propSelect} onPress={open}>
                        <Text style={styles.propSelectText} numberOfLines={1}>
                          {activePlacement.decorationMethod}
                        </Text>
                        <ChevronDown size={12} color={Colors.light.textSecondary} />
                      </TouchableOpacity>
                    )}
                  >
                    {({ close }) => (
                      <>
                        {DECORATION_METHODS.map(m => (
                          <TouchableOpacity
                            key={m}
                            style={styles.menuOption}
                            onPress={() => { close(); setPlacementDecoration(activeZoneId!, m); }}
                          >
                            <Text style={[styles.menuOptionText, m === activePlacement.decorationMethod && styles.menuOptionTextActive]}>
                              {m}
                            </Text>
                            {m === activePlacement.decorationMethod && (
                              <CheckCircle size={12} color={Colors.light.tint} />
                            )}
                          </TouchableOpacity>
                        ))}
                      </>
                    )}
                  </OverlayMenu>

                  {/* Snap Position */}
                  <Text style={styles.propGroupLabel}>Snap Position</Text>
                  <OverlayMenu
                    menuWidth={200}
                    align="right"
                    trigger={({ open }) => (
                      <TouchableOpacity style={styles.propSelect} onPress={open}>
                        <Text style={styles.propSelectText} numberOfLines={1}>
                          {SNAP_POSITIONS.find(s => s.value === activePlacement.snap)?.label ?? activePlacement.snap}
                        </Text>
                        <ChevronDown size={12} color={Colors.light.textSecondary} />
                      </TouchableOpacity>
                    )}
                  >
                    {({ close }) => (
                      <>
                        {SNAP_POSITIONS.map(s => (
                          <TouchableOpacity
                            key={s.value}
                            style={styles.menuOption}
                            onPress={() => { close(); setPlacementSnap(activeZoneId!, s.value); }}
                          >
                            <Text style={[styles.menuOptionText, s.value === activePlacement.snap && styles.menuOptionTextActive]}>
                              {s.label}
                            </Text>
                            {s.value === activePlacement.snap && (
                              <CheckCircle size={12} color={Colors.light.tint} />
                            )}
                          </TouchableOpacity>
                        ))}
                      </>
                    )}
                  </OverlayMenu>
                </View>
              )}

              {/* TEMPLATE STATUS */}
              {activeStatus && (
                <View style={[styles.statusCard, activeStatus.usingTemplate ? styles.statusCardOk : styles.statusCardWarn]}>
                  <View style={styles.statusHeadRow}>
                    {activeStatus.usingTemplate
                      ? <Check size={14} color="#16894e" />
                      : <RotateCcw size={14} color="#b45309" />}
                    <Text style={[styles.statusHeadText, activeStatus.usingTemplate ? styles.statusHeadTextOk : styles.statusHeadTextWarn]}>
                      {activeStatus.usingTemplate ? 'Using Template' : 'Custom Placement'}
                    </Text>
                  </View>
                  <View style={styles.statusMetaRow}>
                    <Text style={styles.statusMetaLabel}>Size</Text>
                    <Text style={styles.statusMetaValue}>{activeStatus.customSize ? 'Custom' : 'Template default'}</Text>
                  </View>
                  <View style={styles.statusMetaRow}>
                    <Text style={styles.statusMetaLabel}>Position</Text>
                    <Text style={styles.statusMetaValue}>{activeStatus.customPosition ? 'Custom' : 'On template'}</Text>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>

          {/* ── Footer ── */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
              <RotateCcw size={14} color={Colors.light.textSecondary} />
              <Text style={styles.resetBtnText}>Reset All</Text>
            </TouchableOpacity>
            {!isMobile && (
              <Text style={styles.autosaveText}>All changes are saved automatically</Text>
            )}
            <View style={styles.footerRight}>
              <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Save size={14} color="#fff" />
                    <Text style={styles.saveBtnText}>Save Changes</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>

        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  panel: {
    backgroundColor: '#fff',
    borderRadius: 14,
    width: '100%',
    maxWidth: 1280,
    maxHeight: '96%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32,
    shadowRadius: 28,
  },

  // Header (dark)
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: '#0F1115',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 180 },
  headerTitle: { fontSize: 15, fontWeight: '700', color: '#fff' },
  headerCenter: { flex: 1, alignItems: 'center', paddingHorizontal: 12 },
  headerBreadcrumb: { fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: '500' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 180, justifyContent: 'flex-end' },
  changeProductBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  changeProductText: { fontSize: 12, color: '#fff', fontWeight: '600' },
  closeBtn: { padding: 4 },

  // Mobile tab bar
  mobileTabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    backgroundColor: Colors.light.surface,
  },
  mobileTabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  mobileTabBtnActive: { borderBottomColor: Colors.light.tint },
  mobileTabText: { fontSize: 12, fontWeight: '500', color: Colors.light.textSecondary },
  mobileTabTextActive: { color: Colors.light.tint, fontWeight: '700' },

  // Sub-header toolbar
  toolbar: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    backgroundColor: '#F4F5F7',
  },
  toolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  toolbarEditor: { flex: 1, minWidth: 0 },
  doneEditingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: '#fff',
  },
  doneEditingText: { fontSize: 12, color: Colors.light.text, fontWeight: '600' },
  toolbarEmpty: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  toolbarEmptyText: { fontSize: 13, color: Colors.light.textSecondary },

  // Body
  body: {
    flexDirection: 'row',
    flex: 1,
    overflow: 'hidden',
    minHeight: 460,
  },
  bodyMobile: { flexDirection: 'column' },

  // Black section headers
  sectionHeader: {
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginHorizontal: -12,
    marginTop: 8,
  },
  sectionHeaderText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.9,
  },
  subLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.light.textSecondary,
    letterSpacing: 0.6,
    marginTop: 10,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  emptyNote: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    paddingVertical: 10,
    paddingHorizontal: 4,
    lineHeight: 16,
  },

  // Left Sidebar
  leftSidebar: {
    width: 224,
    borderRightWidth: 1,
    borderRightColor: Colors.light.border,
    backgroundColor: Colors.light.surface,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },

  // Search row
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    marginBottom: 4,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    paddingHorizontal: 9,
    backgroundColor: '#fff',
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: Colors.light.text,
    padding: 0,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
  },
  addMediaBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.light.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Library sections
  libSectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    marginBottom: 7,
  },
  libSectionTitle: { fontSize: 12, fontWeight: '700', color: Colors.light.text },
  viewAll: { fontSize: 10, color: Colors.light.textSecondary, fontWeight: '500' },
  addLayer: { fontSize: 11, color: Colors.light.tint, fontWeight: '600' },

  // Media tiles
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  mediaTile: {
    width: 60,
    height: 60,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  mediaTileSelected: { borderColor: Colors.light.tint, borderWidth: 2 },
  mediaTileDragging: { opacity: 0.4 },
  mediaTileLogo: { width: 48, height: 30 },
  mediaTileImg: { width: 52, height: 52 },
  mediaTileDelete: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaTileAdd: {
    borderStyle: 'dashed',
    borderColor: Colors.light.borderDark,
    backgroundColor: '#FAFAFA',
  },
  mediaTileAddDragOver: {
    borderColor: Colors.light.tint,
    backgroundColor: '#FFF8F5',
  },

  // Artwork section (drag target)
  artworkSection: {
    borderRadius: 8,
  },
  artworkSectionDragOver: {
    backgroundColor: '#FFF8F5',
    borderWidth: 1.5,
    borderColor: Colors.light.tint,
    borderStyle: 'dashed',
  },

  placingHint: {
    marginTop: 8,
    padding: 7,
    backgroundColor: '#EFF6FF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  placingHintText: { fontSize: 9, color: '#1D4ED8', textAlign: 'center', lineHeight: 13 },

  // Layers
  layerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginBottom: 5,
    backgroundColor: '#fff',
  },
  layerItemActive: { borderColor: Colors.light.tint, backgroundColor: '#FFF8F5' },
  layerInfo: { flex: 1, minWidth: 0 },
  layerZone: { fontSize: 11, fontWeight: '700', color: Colors.light.text },
  layerZoneActive: { color: Colors.light.tint },
  layerDims: { fontSize: 9, color: Colors.light.textSecondary, marginTop: 1 },
  layerIconBtn: { padding: 4 },

  // Vertical toolbar
  verticalToolbar: {
    width: 48,
    borderRightWidth: 1,
    borderRightColor: Colors.light.border,
    backgroundColor: '#fff',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 4,
  },
  toolBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  toolBtnActive: { backgroundColor: '#FFF0E8' },
  toolBtnDisabled: { opacity: 0.4 },
  toolbarDivider: { width: 24, height: 1, backgroundColor: Colors.light.border, marginVertical: 5 },
  toolBtnLabel: { fontSize: 8, color: Colors.light.textSecondary, fontWeight: '600' },

  // Center canvas
  centerPanel: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: 14,
    backgroundColor: '#E8EAF0',
    position: 'relative',
  },
  viewTabs: {
    flexDirection: 'row',
    gap: 0,
    marginBottom: 12,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: '#fff',
  },
  viewTab: {
    paddingVertical: 7,
    paddingHorizontal: 22,
    backgroundColor: '#fff',
  },
  viewTabActive: { backgroundColor: Colors.light.tint },
  viewTabText: { fontSize: 12, fontWeight: '600', color: Colors.light.textSecondary },
  viewTabTextActive: { color: '#fff' },

  canvasContainer: {
    position: 'relative',
    backgroundColor: '#E8EAF0',
    overflow: 'visible',
  },
  garmentSvg: { position: 'absolute', top: 0, left: 0 },

  zone: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: 'rgba(100,100,100,0.35)',
    borderStyle: 'dashed',
    borderRadius: 3,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  zoneSuggested: {
    borderColor: 'rgba(255,90,0,0.6)',
    backgroundColor: 'rgba(255,90,0,0.06)',
  },
  zoneActive: {
    borderColor: Colors.light.tint,
    borderWidth: 2,
    backgroundColor: 'rgba(255,90,0,0.1)',
  },
  zoneHasArtwork: {
    borderColor: '#22C55E',
    borderWidth: 2,
    borderStyle: 'solid',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  zoneLabel: {
    fontWeight: '600',
    textAlign: 'center',
    padding: 2,
  },
  zoneArtworkImage: { position: 'absolute' },
  zoneRemoveBtn: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 8,
    width: 14,
    height: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },

  crosshairV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(239,68,68,0.55)',
  },
  crosshairH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(239,68,68,0.55)',
  },
  artSelectBox: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: Colors.light.tint,
    borderStyle: 'dashed',
    borderRadius: 2,
  },
  resizeHandle: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: Colors.light.tint,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  zoomBadge: {
    position: 'absolute',
    bottom: 12,
    right: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 6,
  },
  zoomBadgeText: { fontSize: 11, color: '#fff', fontWeight: '600' },

  // Right Sidebar
  rightSidebar: {
    width: 210,
    borderLeftWidth: 1,
    borderLeftColor: Colors.light.border,
    backgroundColor: Colors.light.surface,
    paddingHorizontal: 12,
    paddingBottom: 16,
  },

  // Print Locations
  locRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderRadius: 6,
    marginBottom: 2,
  },
  locRowActive: { backgroundColor: '#FFF8F5' },
  locName: { fontSize: 12, color: Colors.light.textSecondary, flex: 1 },
  locNameActive: { color: Colors.light.tint, fontWeight: '600' },
  locNameFilled: { color: Colors.light.text, fontWeight: '600' },
  locCheckDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E' },

  // Template card
  templateCard: {
    flexDirection: 'row',
    gap: 10,
    padding: 10,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: '#fff',
    marginTop: 10,
  },
  templateThumb: {
    width: 46,
    height: 46,
    borderRadius: 7,
    backgroundColor: '#FFF0E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateInfo: { flex: 1, minWidth: 0, gap: 3 },
  templateTitle: { fontSize: 12, fontWeight: '700', color: Colors.light.text },
  templateMetaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  templateMetaLabel: { fontSize: 10, color: Colors.light.textSecondary },
  templateMetaValue: { fontSize: 10, color: Colors.light.text, fontWeight: '600' },

  // Section header row (PROPERTIES)
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginHorizontal: -12,
    marginTop: 14,
  },
  sectionHeaderRowText: { fontSize: 10, fontWeight: '700', color: '#fff', letterSpacing: 0.9 },
  resetTemplateLink: { fontSize: 10, color: Colors.light.tint, fontWeight: '600' },

  // Properties panel
  propsPanel: { paddingTop: 10, gap: 10 },
  propGrid: { flexDirection: 'row', gap: 8 },
  propField: { flex: 1, gap: 4 },
  propFieldLabel: { fontSize: 10, fontWeight: '600', color: Colors.light.textSecondary },
  propInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 7,
    paddingHorizontal: 8,
    backgroundColor: '#fff',
  },
  propFieldInput: {
    flex: 1,
    fontSize: 12,
    color: Colors.light.text,
    padding: 0,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
  },
  propInputUnit: { fontSize: 11, color: Colors.light.textSecondary, marginLeft: 2 },
  propGroupLabel: { fontSize: 10, fontWeight: '700', color: Colors.light.textSecondary, letterSpacing: 0.4 },

  // Toggle (lock aspect)
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  toggleLabel: { fontSize: 12, color: Colors.light.text, fontWeight: '500' },
  switchTrack: {
    width: 38,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#D1D5DB',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  switchTrackOn: { backgroundColor: Colors.light.tint },
  switchThumb: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff' },
  switchThumbOn: { marginLeft: 16 },

  // Center artboard button
  centerArtBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    height: 30,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: '#fff',
  },
  centerArtText: { fontSize: 11, color: Colors.light.textSecondary, fontWeight: '600' },

  // Select dropdown
  propSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 32,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 7,
    paddingHorizontal: 8,
    backgroundColor: '#fff',
  },
  propSelectText: { flex: 1, fontSize: 12, color: Colors.light.text },

  // OverlayMenu options (shared)
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  menuOptionText: { fontSize: 12, color: Colors.light.text },
  menuOptionTextActive: { color: Colors.light.tint, fontWeight: '600' },

  // Template status card
  statusCard: {
    padding: 11,
    borderRadius: 9,
    borderWidth: 1,
    gap: 6,
    marginTop: 14,
  },
  statusCardOk: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  statusCardWarn: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  statusHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  statusHeadText: { fontSize: 12, fontWeight: '700' },
  statusHeadTextOk: { color: '#16894e' },
  statusHeadTextWarn: { color: '#b45309' },
  statusMetaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statusMetaLabel: { fontSize: 10, color: Colors.light.textSecondary },
  statusMetaValue: { fontSize: 10, color: Colors.light.text, fontWeight: '600' },

  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    backgroundColor: Colors.light.surface,
  },
  footerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  resetBtnText: { fontSize: 12, color: Colors.light.textSecondary },
  autosaveText: { fontSize: 11, color: Colors.light.textSecondary, fontStyle: 'italic' },
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: '#fff',
  },
  cancelBtnText: { fontSize: 13, color: Colors.light.text, fontWeight: '600' },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 18,
    backgroundColor: Colors.light.tint,
    borderRadius: 7,
    minWidth: 130,
    justifyContent: 'center',
  },
  saveBtnText: { fontSize: 13, color: '#fff', fontWeight: '700' },
});
