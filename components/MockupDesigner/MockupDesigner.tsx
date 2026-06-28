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
  Upload,
  Download,
  Save,
  ChevronDown,
  Trash2,
  CheckCircle,
  Brush,
  RotateCcw,
  Link2,
  Lock,
  Unlock,
  Layers as LayersIcon,
  Target,
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

function SubLabel({ title }: { title: string }) {
  return <Text style={styles.subLabel}>{title}</Text>;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function MockupDesigner({
  visible,
  onClose,
  onSave,
  suggestedLocations,
  initialVariant,
  onColorChange,
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
      .filter(Boolean)
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

  const handleDownload = async (format: 'png' | 'pdf') => {
    if (Platform.OS !== 'web') return;
    const uri = await composeCanvas();
    if (!uri) return;
    if (format === 'png') {
      const link = document.createElement('a');
      link.href = uri;
      link.download = `mockup-${garmentType}-${Date.now()}.png`;
      link.click();
    } else {
      const win = window.open('', '_blank');
      if (!win) return;
      win.document.write(`<html><head><title>Mockup</title><style>body{margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#fff;}img{max-width:100%;max-height:100vh;}</style></head><body><img src="${uri}" onload="window.print()"/></body></html>`);
      win.document.close();
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
              <Brush size={18} color={Colors.light.tint} />
              <Text style={styles.headerTitle}>Mockup Designer</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <X size={20} color={Colors.light.textSecondary} />
            </TouchableOpacity>
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

          {/* ── Top Toolbar ── */}
          <View style={styles.toolbar}>
            {configuredProduct ? (
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
            ) : (
              <View style={styles.toolbarEmpty}>
                <Text style={styles.toolbarEmptyText}>No product configured</Text>
              </View>
            )}
          </View>

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

              <SubLabel title="COMPANY LOGOS" />
              <TouchableOpacity style={styles.logoItem} onPress={handleAddKoLogo} activeOpacity={0.75}>
                <Image source={{ uri: KO_LOGO_URL }} style={styles.logoItemImg} resizeMode="contain" />
                <Text style={styles.logoItemName}>KO Logo</Text>
              </TouchableOpacity>

              <SubLabel title="CLIENT ARTWORK" />
              <View
                ref={artworkDropRef}
                style={[styles.artworkSection, artworkDragOver && styles.artworkSectionDragOver]}
              >
                {uploadedArtworks.length === 0 ? (
                  <TouchableOpacity
                    style={[styles.artworkUploadZone, artworkDragOver && styles.artworkUploadZoneDragOver]}
                    onPress={handleUploadArtwork}
                    activeOpacity={0.75}
                  >
                    <Upload size={20} color={artworkDragOver ? Colors.light.tint : Colors.light.borderDark} />
                    <Text style={[styles.artworkUploadText, artworkDragOver && styles.artworkUploadTextActive]}>
                      {artworkDragOver ? 'Drop to add' : 'Upload or Drop Image'}
                    </Text>
                    <Text style={styles.artworkUploadSub}>Up to 5 artworks</Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    {uploadedArtworks.length < MAX_ARTWORKS ? (
                      <TouchableOpacity style={styles.uploadBtn} onPress={handleUploadArtwork}>
                        <Upload size={13} color={Colors.light.tint} />
                        <Text style={styles.uploadBtnText}>Upload / Drop Image</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.artworkMaxNote}>
                        <Text style={styles.artworkMaxText}>Max 5 — delete one to add more</Text>
                      </View>
                    )}
                    {uploadedArtworks.map(artwork => (
                      <TouchableOpacity
                        key={artwork.id}
                        style={[
                          styles.artworkItem,
                          selectedArtworkId === artwork.id && styles.artworkItemSelected,
                          draggedArtworkId === artwork.id && styles.artworkItemDragging,
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
                        <Image source={{ uri: artwork.uri }} style={styles.artworkThumb} resizeMode="contain" />
                        <View style={styles.artworkItemInfo}>
                          <Text style={styles.artworkItemName} numberOfLines={1}>{artwork.name}</Text>
                          {selectedArtworkId === artwork.id && (
                            <View style={styles.artworkSelectedBadge}>
                              <Text style={styles.artworkSelectedText}>Active</Text>
                            </View>
                          )}
                        </View>
                        <TouchableOpacity
                          style={styles.artworkDeleteBtn}
                          onPress={() => handleRemoveArtwork(artwork.id)}
                        >
                          <Trash2 size={11} color={Colors.light.error} />
                        </TouchableOpacity>
                      </TouchableOpacity>
                    ))}
                  </>
                )}
                {selectedArtworkId && (
                  <View style={styles.placingHint}>
                    <Text style={styles.placingHintText}>Tap a zone or drag onto the garment</Text>
                  </View>
                )}
              </View>

              <SectionHeader title="LAYERS" />
              {placements.length === 0 ? (
                <Text style={styles.emptyNote}>No placed artwork yet</Text>
              ) : (
                placements.map(p => {
                  const art = uploadedArtworks.find(a => a.id === p.artworkId);
                  const isActive = activeZoneId === p.zoneId;
                  return (
                    <TouchableOpacity
                      key={p.zoneId}
                      style={[styles.layerItem, isActive && styles.layerItemActive]}
                      onPress={() => setActiveZoneId(prev => prev === p.zoneId ? null : p.zoneId)}
                    >
                      {art?.uri ? (
                        <Image source={{ uri: art.uri }} style={styles.layerThumb} resizeMode="contain" />
                      ) : (
                        <View style={[styles.layerThumb, styles.layerThumbEmpty]} />
                      )}
                      <View style={styles.layerInfo}>
                        <Text style={styles.layerZone} numberOfLines={1}>{p.zoneId}</Text>
                        <Text style={styles.layerArt} numberOfLines={1}>{art?.name ?? '—'}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.layerDeleteBtn}
                        onPress={() => handleRemovePlacement(p.zoneId)}
                      >
                        <Trash2 size={10} color={Colors.light.error} />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

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
                style={[styles.canvasContainer, { width: DISPLAY_W, height: DISPLAY_H }]}
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
                  if (placement) {
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
              </View>

              {/* Canvas info bar */}
              {configuredProduct && (
                <View style={styles.canvasInfoBar}>
                  <Text style={styles.canvasInfoText} numberOfLines={1}>
                    {configuredProduct.productType}
                    {configuredProduct.colorVariants[mdActiveColorIdx]?.colorName
                      ? ` · ${configuredProduct.colorVariants[mdActiveColorIdx].colorName}`
                      : ''}
                    {placements.length > 0 ? ` · ${placements.length} placement${placements.length !== 1 ? 's' : ''}` : ''}
                  </Text>
                </View>
              )}
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
                  const hasPlacement = placements.some(p => p.zoneId === loc);
                  const isActive = activeZoneId === loc;
                  return (
                    <TouchableOpacity
                      key={loc}
                      style={[styles.locRow, isActive && styles.locRowActive]}
                      onPress={() => setActiveZoneId(prev => prev === loc as PrintLocation ? null : loc as PrintLocation)}
                    >
                      <View style={[styles.locDot, hasPlacement && styles.locDotFilled]} />
                      <Text style={[styles.locName, isActive && styles.locNameActive, hasPlacement && styles.locNameFilled]}>
                        {loc}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}

              {/* PROPERTIES */}
              <SectionHeader title="PROPERTIES" />
              {!activePlacement ? (
                <Text style={styles.emptyNote}>
                  {activeZoneId
                    ? 'Drop artwork onto this zone to edit'
                    : 'Select a zone or layer to edit'}
                </Text>
              ) : (
                <View style={styles.propsPanel}>
                  {/* Width */}
                  <View style={styles.propRow}>
                    <Text style={styles.propLabel}>W&quot;</Text>
                    <TextInput
                      style={styles.propInput}
                      value={activePlacement.artWidthIn ?? ''}
                      onChangeText={handleActiveWChange}
                      keyboardType="decimal-pad"
                      placeholder={activeTpl?.maxWidthIn.toFixed(1)}
                      placeholderTextColor="#aaa"
                    />
                  </View>
                  {/* Height + Lock */}
                  <View style={styles.propRow}>
                    <Text style={styles.propLabel}>H&quot;</Text>
                    <TextInput
                      style={styles.propInput}
                      value={activePlacement.artHeightIn ?? ''}
                      onChangeText={handleActiveHChange}
                      keyboardType="decimal-pad"
                      placeholder={activeTpl?.maxHeightIn.toFixed(1)}
                      placeholderTextColor="#aaa"
                    />
                    <TouchableOpacity
                      style={styles.lockBtn}
                      onPress={() => setLockAspectRatio(v => !v)}
                    >
                      {lockAspectRatio
                        ? <Lock size={13} color={Colors.light.tint} />
                        : <Unlock size={13} color={Colors.light.textSecondary} />
                      }
                    </TouchableOpacity>
                  </View>
                  {/* X */}
                  <View style={styles.propRow}>
                    <Text style={styles.propLabel}>X&quot;</Text>
                    <TextInput
                      style={styles.propInput}
                      value={activePlacement.offsetXIn.toFixed(2)}
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
                  </View>
                  {/* Y */}
                  <View style={styles.propRow}>
                    <Text style={styles.propLabel}>Y&quot;</Text>
                    <TextInput
                      style={styles.propInput}
                      value={activePlacement.offsetYIn.toFixed(2)}
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
                  </View>
                  {/* Rotation */}
                  <View style={styles.propRow}>
                    <Text style={styles.propLabel}>Rot</Text>
                    <TextInput
                      style={styles.propInput}
                      value={String(activePlacement.rotation ?? 0)}
                      onChangeText={(val) => {
                        const n = parseFloat(val);
                        if (!isNaN(n)) setPlacements(prev => prev.map(p =>
                          p.zoneId === activeZoneId ? { ...p, rotation: n } : p
                        ));
                      }}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor="#aaa"
                    />
                    <Text style={styles.propUnit}>°</Text>
                  </View>
                  {/* Opacity */}
                  <View style={styles.propRow}>
                    <Text style={styles.propLabel}>Opa</Text>
                    <TextInput
                      style={styles.propInput}
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
                    <Text style={styles.propUnit}>%</Text>
                  </View>

                  {/* Decoration Method */}
                  <Text style={styles.propFieldLabel}>Decoration</Text>
                  <OverlayMenu
                    menuWidth={168}
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
                  <Text style={styles.propFieldLabel}>Position</Text>
                  <OverlayMenu
                    menuWidth={168}
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

                  {/* Max size hint */}
                  {activeTpl && (
                    <Text style={styles.propHint}>
                      Max {activeTpl.maxWidthIn.toFixed(1)}&quot; × {activeTpl.maxHeightIn.toFixed(1)}&quot; · Safe {activeTpl.safeAreaIn}&quot;
                    </Text>
                  )}

                  {/* Action buttons */}
                  <TouchableOpacity
                    style={styles.propActionBtn}
                    onPress={() => activeZoneId && centerOnArtboard(activeZoneId)}
                  >
                    <Target size={12} color={Colors.light.textSecondary} />
                    <Text style={styles.propActionText}>Center on Artboard</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.propActionBtn, styles.propActionBtnPrimary]}
                    onPress={() => activeZoneId && resetPlacementToTemplate(activeZoneId)}
                  >
                    <RotateCcw size={12} color={Colors.light.tint} />
                    <Text style={[styles.propActionText, styles.propActionTextPrimary]}>Reset to Template</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* TEMPLATE STATUS */}
              <SectionHeader title="TEMPLATE STATUS" />
              {!activeStatus ? (
                <Text style={styles.emptyNote}>No active placement</Text>
              ) : (
                <View style={styles.statusPanel}>
                  <View style={[styles.statusRow, activeStatus.usingTemplate && styles.statusRowOk]}>
                    <View style={[styles.statusDot, activeStatus.usingTemplate ? styles.statusDotOk : styles.statusDotOff]} />
                    <Text style={[styles.statusLabel, activeStatus.usingTemplate && styles.statusLabelOk]}>Using Template</Text>
                  </View>
                  <View style={[styles.statusRow, activeStatus.customSize && styles.statusRowWarn]}>
                    <View style={[styles.statusDot, activeStatus.customSize ? styles.statusDotWarn : styles.statusDotOff]} />
                    <Text style={[styles.statusLabel, activeStatus.customSize && styles.statusLabelWarn]}>Custom Size</Text>
                  </View>
                  <View style={[styles.statusRow, activeStatus.customPosition && styles.statusRowWarn]}>
                    <View style={[styles.statusDot, activeStatus.customPosition ? styles.statusDotWarn : styles.statusDotOff]} />
                    <Text style={[styles.statusLabel, activeStatus.customPosition && styles.statusLabelWarn]}>Custom Position</Text>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>

          {/* ── Footer ── */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
              <RotateCcw size={14} color={Colors.light.textSecondary} />
              <Text style={styles.resetBtnText}>Reset</Text>
            </TouchableOpacity>
            <View style={styles.footerRight}>
              <TouchableOpacity style={styles.downloadBtn} onPress={() => handleDownload('pdf')}>
                <Download size={14} color={Colors.light.tint} />
                <Text style={styles.downloadBtnText}>PDF</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.downloadBtn} onPress={() => handleDownload('png')}>
                <Download size={14} color={Colors.light.tint} />
                <Text style={styles.downloadBtnText}>PNG</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Save size={14} color="#fff" />
                    <Text style={styles.saveBtnText}>Save Mockup</Text>
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
    maxWidth: 1140,
    maxHeight: '96%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32,
    shadowRadius: 28,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    backgroundColor: Colors.light.surface,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 15, fontWeight: '700', color: Colors.light.text },
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

  // Toolbar
  toolbar: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    backgroundColor: '#F4F5F7',
  },
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
    width: 210,
    borderRightWidth: 1,
    borderRightColor: Colors.light.border,
    backgroundColor: Colors.light.surface,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },

  // Company logo item
  logoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: '#fff',
    marginBottom: 4,
  },
  logoItemImg: { width: 56, height: 24 },
  logoItemName: { fontSize: 11, color: Colors.light.textSecondary, fontWeight: '500', flex: 1 },

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
  artworkUploadZone: {
    borderWidth: 1.5,
    borderColor: Colors.light.borderDark,
    borderStyle: 'dashed',
    borderRadius: 9,
    paddingVertical: 22,
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#FAFAFA',
  },
  artworkUploadZoneDragOver: {
    borderColor: Colors.light.tint,
    backgroundColor: '#FFF8F5',
  },
  artworkUploadText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  artworkUploadTextActive: { color: Colors.light.tint },
  artworkUploadSub: { fontSize: 9, color: Colors.light.textSecondary },

  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#FFF0E8',
    borderRadius: 7,
    borderWidth: 1,
    borderColor: Colors.light.tint,
    justifyContent: 'center',
    marginBottom: 8,
  },
  uploadBtnText: { fontSize: 11, color: Colors.light.tint, fontWeight: '600' },

  artworkMaxNote: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    backgroundColor: '#FFF8F5',
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#FFD9C5',
    marginBottom: 8,
    alignItems: 'center',
  },
  artworkMaxText: { fontSize: 10, color: Colors.light.tint, fontWeight: '600', textAlign: 'center' },

  artworkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 7,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    marginBottom: 5,
    backgroundColor: '#fff',
    gap: 7,
  },
  artworkItemSelected: { borderColor: Colors.light.tint, backgroundColor: '#FFF8F5' },
  artworkItemDragging: { opacity: 0.4 },
  artworkThumb: { width: 36, height: 36 },
  artworkItemInfo: { flex: 1, minWidth: 0 },
  artworkItemName: { fontSize: 10, color: Colors.light.textSecondary },
  artworkSelectedBadge: {
    backgroundColor: Colors.light.tint,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  artworkSelectedText: { fontSize: 8, color: '#fff', fontWeight: '700' },
  artworkDeleteBtn: { padding: 4 },

  placingHint: {
    marginTop: 6,
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
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginBottom: 4,
    backgroundColor: '#fff',
  },
  layerItemActive: { borderColor: Colors.light.tint, backgroundColor: '#FFF8F5' },
  layerThumb: { width: 28, height: 28 },
  layerThumbEmpty: { backgroundColor: Colors.light.border },
  layerInfo: { flex: 1, minWidth: 0 },
  layerZone: { fontSize: 10, fontWeight: '700', color: Colors.light.text },
  layerArt: { fontSize: 9, color: Colors.light.textSecondary },
  layerDeleteBtn: { padding: 3 },

  // Center canvas
  centerPanel: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: 14,
    backgroundColor: '#E8EAF0',
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

  canvasInfoBar: {
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 5,
    backgroundColor: 'rgba(0,0,0,0.48)',
    borderRadius: 6,
  },
  canvasInfoText: { fontSize: 11, color: '#fff', fontWeight: '500' },

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
  locDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: Colors.light.borderDark,
    backgroundColor: 'transparent',
  },
  locDotFilled: { backgroundColor: '#22C55E', borderColor: '#22C55E' },
  locName: { fontSize: 12, color: Colors.light.textSecondary, flex: 1 },
  locNameActive: { color: Colors.light.tint, fontWeight: '600' },
  locNameFilled: { color: '#15803D', fontWeight: '600' },

  // Properties panel
  propsPanel: {
    paddingTop: 4,
    gap: 4,
  },
  propRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 28,
  },
  propLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.light.textSecondary,
    width: 26,
  },
  propInput: {
    flex: 1,
    height: 26,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 5,
    paddingHorizontal: 7,
    fontSize: 12,
    color: Colors.light.text,
    backgroundColor: '#fff',
  },
  propUnit: {
    fontSize: 10,
    color: Colors.light.textSecondary,
    width: 12,
  },
  lockBtn: {
    width: 26,
    height: 26,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  propFieldLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.light.textSecondary,
    letterSpacing: 0.4,
    marginTop: 8,
    marginBottom: 3,
  },
  propSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 26,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 5,
    paddingHorizontal: 7,
    backgroundColor: '#fff',
  },
  propSelectText: { flex: 1, fontSize: 11, color: Colors.light.text },
  propHint: {
    fontSize: 9,
    color: Colors.light.textSecondary,
    marginTop: 6,
    fontStyle: 'italic',
  },
  propActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: '#fff',
    marginTop: 6,
  },
  propActionBtnPrimary: {
    borderColor: Colors.light.tint,
    backgroundColor: '#FFF0E8',
  },
  propActionText: { fontSize: 10, fontWeight: '600', color: Colors.light.textSecondary },
  propActionTextPrimary: { color: Colors.light.tint },

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

  // Template Status
  statusPanel: { paddingTop: 6, gap: 5 },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderRadius: 5,
  },
  statusRowOk: { backgroundColor: '#F0FDF4' },
  statusRowWarn: { backgroundColor: '#FFFBEB' },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: Colors.light.borderDark,
  },
  statusDotOff: { backgroundColor: 'transparent' },
  statusDotOk: { backgroundColor: '#22C55E', borderColor: '#22C55E' },
  statusDotWarn: { backgroundColor: '#F59E0B', borderColor: '#F59E0B' },
  statusLabel: { fontSize: 11, color: Colors.light.textSecondary },
  statusLabelOk: { color: '#15803D', fontWeight: '600' },
  statusLabelWarn: { color: '#B45309', fontWeight: '600' },

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
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  resetBtnText: { fontSize: 12, color: Colors.light.textSecondary },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: Colors.light.tint,
  },
  downloadBtnText: { fontSize: 12, color: Colors.light.tint, fontWeight: '600' },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 18,
    backgroundColor: Colors.light.tint,
    borderRadius: 7,
    minWidth: 120,
    justifyContent: 'center',
  },
  saveBtnText: { fontSize: 13, color: '#fff', fontWeight: '700' },
});
