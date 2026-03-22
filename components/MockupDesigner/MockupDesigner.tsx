import React, { useState, useRef, useCallback, useEffect } from 'react';
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
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Trash2,
  CheckCircle,
  Image as ImageIcon,
  Brush,
  RotateCcw,
} from 'lucide-react-native';
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
} from './garmentData';
import { VENDOR_CATALOG, ProductColor } from './vendorCatalog';
import { generateId } from '@/utils/quoteCalculations';

const DISPLAY_W = 340;
const DISPLAY_H = (CANVAS_H / CANVAS_W) * DISPLAY_W;
const SCALE = DISPLAY_W / CANVAS_W;

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
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave: (finalImageUri: string) => void;
  initialMockupUri?: string;
  suggestedLocations?: string[];
}

type MobileTab = 'controls' | 'canvas' | 'artwork';

export function MockupDesigner({ visible, onClose, onSave, initialMockupUri, suggestedLocations }: Props) {
  const { isMobile } = useBreakpoint();
  const [garmentType, setGarmentType] = useState<GarmentType>('tshirt');
  const [garmentColor, setGarmentColor] = useState('#FFFFFF');
  const [hoveredSwatchColor, setHoveredSwatchColor] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<GarmentView>('front');
  const [uploadedArtworks, setUploadedArtworks] = useState<UploadedArtwork[]>([]);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [selectedArtworkId, setSelectedArtworkId] = useState<string | null>(null);
  const [activeZoneId, setActiveZoneId] = useState<PrintLocation | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [selectedStyleNumber, setSelectedStyleNumber] = useState<string | null>(null);
  const [isCustomStyle, setIsCustomStyle] = useState(false);
  const [styleSearchTerm, setStyleSearchTerm] = useState('');
  const [styleDropdownOpen, setStyleDropdownOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>('controls');
  const [artworkDragOver, setArtworkDragOver] = useState(false);
  const [draggedArtworkId, setDraggedArtworkId] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setSelectedVendorId('ss-activewear');
    setSelectedStyleNumber('NL6210');
    setGarmentColor('#2C2C2C');
    setStyleSearchTerm('');
    setStyleDropdownOpen(false);
  }, [visible]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const artworkDropRef = useRef<any>(null);
  const canvasContainerRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const addArtworkFromUri = useCallback((uri: string, name: string, naturalW?: number, naturalH?: number) => {
    const newArtwork: UploadedArtwork = { id: generateId(), uri, name, naturalW, naturalH };
    setUploadedArtworks(prev => [...prev, newArtwork]);
    setSelectedArtworkId(newArtwork.id);
  }, []);

  const placeArtworkInZone = useCallback((artworkId: string, zone: ZoneDefinition) => {
    setUploadedArtworks(prev => {
      const artwork = prev.find(a => a.id === artworkId);
      if (!artwork) return prev;
      const zoneMaxWIn = zone.w / 25;
      const zoneMaxHIn = zone.h / 25;
      let autoW: string | undefined;
      let autoH: string | undefined;
      if (artwork.naturalW && artwork.naturalH) {
        const ratio = artwork.naturalW / artwork.naturalH;
        let fitW = Math.min(14, artwork.naturalW / 96);
        let fitH = Math.min(14, artwork.naturalH / 96);
        if (fitW > zoneMaxWIn) { fitW = zoneMaxWIn; fitH = fitW / ratio; }
        if (fitH > zoneMaxHIn) { fitH = zoneMaxHIn; fitW = fitH * ratio; }
        autoW = fitW.toFixed(1);
        autoH = fitH.toFixed(1);
      }
      setPlacements(curr => {
        const filtered = curr.filter(p => p.zoneId !== zone.id);
        return [...filtered, { zoneId: zone.id, artworkId: artwork.id, artworkUri: artwork.uri, artWidthIn: autoW, artHeightIn: autoH }];
      });
      setActiveZoneId(zone.id);
      return prev;
    });
  }, []);

  // Drag-drop image files into the artwork panel
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
  }, [addArtworkFromUri]);

  // Drag artwork items from the bin and drop onto a canvas zone
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

  const draggedArtworkIdRef = useRef<string | null>(null);
  useEffect(() => { draggedArtworkIdRef.current = draggedArtworkId; }, [draggedArtworkId]);

  const selectedVendor = selectedVendorId
    ? VENDOR_CATALOG.find(v => v.id === selectedVendorId) ?? null
    : null;
  const selectedStyle = selectedVendor && selectedStyleNumber
    ? selectedVendor.styles.find(s => s.styleNumber === selectedStyleNumber) ?? null
    : null;
  const genericColors: ProductColor[] = GARMENT_COLORS.map(c => ({ name: c.label, hex: c.value, dark: c.dark }));
  const activeColors: ProductColor[] = selectedStyle ? selectedStyle.colors : genericColors;
  const activeColorName = activeColors.find(c => c.hex === garmentColor)?.name ?? '';

  // Vendors that carry at least one product matching the current garment template
  const vendorsByTemplate = VENDOR_CATALOG.filter(v =>
    v.styles.some(s => s.garmentType === garmentType)
  );
  // Products from the selected vendor that match the current garment template
  const filteredStyles = selectedVendor
    ? selectedVendor.styles.filter(s => s.garmentType === garmentType)
    : [];

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
  // Full Front / Full Back rendered first so smaller zones overlap them (stay clickable on top)
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

  const selectedArtwork = uploadedArtworks.find(a => a.id === selectedArtworkId) ?? null;
  const artworkSizeIn = selectedArtwork?.naturalW && selectedArtwork?.naturalH
    ? { w: Math.min(14, selectedArtwork.naturalW / 96), h: Math.min(14, selectedArtwork.naturalH / 96) }
    : null;
  const artworkSizeSuggest = artworkSizeIn
    ? artworkSizeIn.w > 8 ? 'Best fit: Full Front'
      : artworkSizeIn.w > 5 ? 'Best fit: Center Chest or Full Front'
      : artworkSizeIn.w > 3 ? 'Best fit: Left/Right Chest'
      : 'Best fit: small locations (Chest / Neck Tag)'
    : '';

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

  const handleVendorSelect = (vendorId: string) => {
    if (selectedVendorId === vendorId) {
      setSelectedVendorId(null);
      setSelectedStyleNumber(null);
      setIsCustomStyle(false);
      setStyleDropdownOpen(false);
    } else {
      setSelectedVendorId(vendorId);
      setSelectedStyleNumber(null);
      setIsCustomStyle(false);
      setStyleDropdownOpen(true);
    }
    setStyleSearchTerm('');
  };

  const handleGarmentTypeChange = (type: GarmentType) => {
    setGarmentType(type);
    setCurrentView('front');
    setSelectedStyleNumber(null);
    setIsCustomStyle(false);
    setStyleSearchTerm('');
    setStyleDropdownOpen(false);
    if (selectedVendorId) {
      const v = VENDOR_CATALOG.find(v => v.id === selectedVendorId);
      if (v && !v.styles.some(s => s.garmentType === type)) {
        setSelectedVendorId(null);
      } else if (v) {
        setStyleDropdownOpen(true);
      }
    }
  };

  const handleStyleSelect = (styleNumber: string) => {
    const vendor = VENDOR_CATALOG.find(v => v.id === selectedVendorId);
    const style = vendor?.styles.find(s => s.styleNumber === styleNumber);
    if (!style) return;
    setSelectedStyleNumber(styleNumber);
    setIsCustomStyle(false);
    // Template stays as-is; only color auto-selects from this style's palette
    const firstColor = style.colors[0];
    if (firstColor) setGarmentColor(firstColor.hex);
  };

  const handleUseCustomStyle = (term: string) => {
    setSelectedStyleNumber(term);
    setIsCustomStyle(true);
    setStyleDropdownOpen(false);
    setStyleSearchTerm('');
  };

  const handleRemoveArtwork = (artworkId: string) => {
    setUploadedArtworks(prev => prev.filter(a => a.id !== artworkId));
    setPlacements(prev => prev.filter(p => p.artworkId !== artworkId));
    if (selectedArtworkId === artworkId) setSelectedArtworkId(null);
  };

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
      .map(placement => {
        return new Promise<void>(resolve => {
          if (!placement) { resolve(); return; }
          const zone = currentZones.find(z => z.id === placement.zoneId);
          if (!zone) { resolve(); return; }
          const img = new window.Image();
          img.onload = () => {
            const padding = 6;
            const zx = zone.x + padding;
            const zy = zone.y + padding;
            const zw = zone.w - padding * 2;
            const zh = zone.h - padding * 2;
            const imgRatio = img.width / img.height;
            const zoneRatio = zw / zh;
            let dw = zw, dh = zh;
            if (imgRatio > zoneRatio) { dh = zw / imgRatio; } else { dw = zh * imgRatio; }
            const dx = zx + (zw - dw) / 2;
            const dy = zy + (zh - dh) / 2;
            ctx.drawImage(img, dx, dy, dw, dh);
            resolve();
          };
          img.onerror = () => resolve();
          img.src = placement.artworkUri;
        });
      });

    await Promise.all(placementPromises);
    return canvas.toDataURL('image/png');
  }, [svgPath, garmentColor, currentZones, placements]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const uri = await composeCanvas();
      if (uri) {
        onSave(uri);
        onClose();
      }
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
      win.document.write(`
        <html><head><title>Mockup</title><style>
          body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #fff; }
          img { max-width: 100%; max-height: 100vh; }
        </style></head>
        <body><img src="${uri}" onload="window.print()"/></body></html>
      `);
      win.document.close();
    }
  };

  const handleReset = () => {
    setPlacements([]);
    setActiveZoneId(null);
    setSelectedArtworkId(null);
  };

  const isSuggestedZone = (zoneId: string) =>
    suggestedLocations?.some(l => l.toLowerCase().includes(zoneId.toLowerCase())) ?? false;

  const placementForZone = (zoneId: PrintLocation) =>
    placements.find(p => p.zoneId === zoneId);

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.panel}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Brush size={18} color={Colors.light.tint} />
              <Text style={styles.headerTitle}>Mockup Designer</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <X size={20} color={Colors.light.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Mobile Tab Bar */}
          {isMobile && (
            <View style={styles.mobileTabBar}>
              {(['controls', 'canvas', 'artwork'] as MobileTab[]).map(tab => (
                <TouchableOpacity
                  key={tab}
                  style={[styles.mobileTabBtn, mobileTab === tab && styles.mobileTabBtnActive]}
                  onPress={() => setMobileTab(tab)}
                >
                  <Text style={[styles.mobileTabText, mobileTab === tab && styles.mobileTabTextActive]}>
                    {tab === 'controls' ? 'Controls' : tab === 'canvas' ? 'Canvas' : 'Artwork'}
                  </Text>
                  {tab === 'artwork' && placements.length > 0 && (
                    <View style={styles.mobileTabBadge}>
                      <Text style={styles.mobileTabBadgeText}>{placements.length}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={[styles.body, isMobile && styles.bodyMobile]}>
            {/* ── Left Panel: Controls ── */}
            <ScrollView style={[styles.leftPanel, isMobile && mobileTab !== 'controls' && { display: 'none' }, isMobile && { width: '100%' }]} showsVerticalScrollIndicator={false}>

              {/* 1 + 2. Garment Template & Vendor — side by side */}
              <View style={styles.templateVendorRow}>
                <View style={styles.templateVendorCol}>
                  <Text style={styles.sectionLabel}>GARMENT TEMPLATE</Text>
                  <View style={styles.garmentTypes}>
                    {(Object.keys(GARMENTS) as GarmentType[]).map(type => (
                      <TouchableOpacity
                        key={type}
                        style={[styles.typeBtn, garmentType === type && styles.typeBtnActive]}
                        onPress={() => handleGarmentTypeChange(type)}
                      >
                        <Text style={[styles.typeBtnText, garmentType === type && styles.typeBtnTextActive]}>
                          {GARMENTS[type].label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.templateVendorCol}>
                  <Text style={styles.sectionLabel}>VENDOR</Text>
                  <View style={styles.garmentTypes}>
                    {vendorsByTemplate.map(vendor => (
                      <TouchableOpacity
                        key={vendor.id}
                        style={[styles.typeBtn, selectedVendorId === vendor.id && styles.typeBtnActive]}
                        onPress={() => handleVendorSelect(vendor.id)}
                      >
                        <Text style={[styles.typeBtnText, selectedVendorId === vendor.id && styles.typeBtnTextActive]} numberOfLines={1}>
                          {vendor.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              {/* 3. Product Style — searchable dropdown */}
              {selectedVendor && (
                <>
                  <Text style={styles.sectionLabel}>PRODUCT STYLE</Text>
                  {styleDropdownOpen ? (
                    <View>
                      <View style={styles.styleSearchRow}>
                        <TextInput
                          style={styles.styleSearchInput}
                          placeholder="Search or enter style #…"
                          placeholderTextColor={Colors.light.textSecondary}
                          value={styleSearchTerm}
                          onChangeText={setStyleSearchTerm}
                          autoFocus
                        />
                        <TouchableOpacity style={styles.styleSearchClose} onPress={() => { setStyleDropdownOpen(false); setStyleSearchTerm(''); }}>
                          <X size={14} color={Colors.light.textSecondary} />
                        </TouchableOpacity>
                      </View>
                      <ScrollView style={styles.styleDropdownScroll} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                        {filteredStyles
                          .filter(s =>
                            styleSearchTerm.trim() === '' ||
                            s.styleNumber.toLowerCase().includes(styleSearchTerm.toLowerCase()) ||
                            s.name.toLowerCase().includes(styleSearchTerm.toLowerCase())
                          )
                          .map(style => {
                            const isSelected = selectedStyleNumber === style.styleNumber;
                            return (
                              <TouchableOpacity
                                key={style.styleNumber}
                                style={[styles.styleDropdownRow, isSelected && styles.styleDropdownRowActive]}
                                onPress={() => { handleStyleSelect(style.styleNumber); setStyleDropdownOpen(false); setStyleSearchTerm(''); }}
                              >
                                <Text style={[styles.styleDropdownNum, isSelected && styles.styleDropdownNumActive]}>
                                  {style.styleNumber}{style.isYouth ? ' (Y)' : ''}
                                </Text>
                                <Text style={[styles.styleDropdownName, isSelected && styles.styleDropdownNameActive]} numberOfLines={1}>
                                  {style.name}
                                </Text>
                              </TouchableOpacity>
                            );
                          })
                        }
                        {styleSearchTerm.trim().length > 0 && (
                          <TouchableOpacity
                            style={styles.styleCustomRow}
                            onPress={() => handleUseCustomStyle(styleSearchTerm.trim())}
                          >
                            <Text style={styles.styleCustomText}>Use "{styleSearchTerm.trim()}" as custom style</Text>
                          </TouchableOpacity>
                        )}
                      </ScrollView>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.styleSelectedBtn}
                      onPress={() => setStyleDropdownOpen(true)}
                    >
                      <Text style={styles.styleSelectedBtnText} numberOfLines={1}>
                        {selectedStyleNumber
                          ? isCustomStyle
                            ? `Custom: ${selectedStyleNumber}`
                            : `${selectedStyleNumber} — ${filteredStyles.find(s => s.styleNumber === selectedStyleNumber)?.name ?? ''}`
                          : filteredStyles.length === 0
                            ? `No catalog styles — tap to enter custom`
                            : 'Select a style…'
                        }
                      </Text>
                      <ChevronDown size={14} color={Colors.light.textSecondary} />
                    </TouchableOpacity>
                  )}
                </>
              )}

              {/* 4. Color palette */}
              <Text style={styles.sectionLabel}>
                {selectedStyle ? `COLOR — ${selectedStyle.styleNumber} (${activeColors.length})` : 'GARMENT COLOR'}
              </Text>
              <View style={styles.colorGrid}>
                {activeColors.map(color => (
                  <TouchableOpacity
                    key={color.hex + color.name}
                    style={[
                      styles.colorSwatch,
                      { backgroundColor: color.hex },
                      garmentColor === color.hex && styles.colorSwatchSelected,
                      color.hex === '#FFFFFF' && styles.colorSwatchWhite,
                    ]}
                    onPress={() => setGarmentColor(color.hex)}
                    {...(Platform.OS === 'web' ? {
                      onMouseEnter: () => setHoveredSwatchColor(color.name),
                      onMouseLeave: () => setHoveredSwatchColor(null),
                    } : {})}
                  >
                    {garmentColor === color.hex && (
                      <CheckCircle size={14} color={color.dark ? '#fff' : '#333'} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.colorLabel}>{hoveredSwatchColor ?? activeColorName}</Text>

              {/* View toggle */}
              {garmentType !== 'hat' && (
                <>
                  <Text style={styles.sectionLabel}>VIEW</Text>
                  <View style={styles.viewToggle}>
                    <TouchableOpacity
                      style={[styles.viewBtn, currentView === 'front' && styles.viewBtnActive]}
                      onPress={() => setCurrentView('front')}
                    >
                      <Text style={[styles.viewBtnText, currentView === 'front' && styles.viewBtnTextActive]}>Front</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.viewBtn, currentView === 'back' && styles.viewBtnActive]}
                      onPress={() => setCurrentView('back')}
                    >
                      <Text style={[styles.viewBtnText, currentView === 'back' && styles.viewBtnTextActive]}>Back</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {/* Instructions */}
              <View style={styles.instructions}>
                <Text style={styles.instructionsTitle}>How to use:</Text>
                <Text style={styles.instructionsText}>1. Pick a garment template</Text>
                <Text style={styles.instructionsText}>2. Select a vendor &amp; product</Text>
                <Text style={styles.instructionsText}>3. Choose a color</Text>
                <Text style={styles.instructionsText}>4. Upload &amp; place artwork</Text>
                <Text style={styles.instructionsText}>5. Enter art size → Save</Text>
              </View>
            </ScrollView>

            {/* ── Center: Garment Canvas ── */}
            <View style={[styles.centerPanel, isMobile && mobileTab !== 'canvas' && { display: 'none' }, isMobile && { width: '100%' }]}>
              <View ref={canvasContainerRef} style={[styles.canvasContainer, { width: DISPLAY_W, height: DISPLAY_H }]}>
                {/* SVG Garment */}
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
                    {/* Collar/pocket details */}
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
                        {/* Button placket strip */}
                        <Rect x={234} y={100} width={32} height={130} rx={3}
                          fill="none" stroke={getDetailColor()} strokeWidth={1.5} />
                        {/* Buttons */}
                        <Circle cx={250} cy={116} r={3.5} fill={getDetailColor()} />
                        <Circle cx={250} cy={136} r={3.5} fill={getDetailColor()} />
                        <Circle cx={250} cy={156} r={3.5} fill={getDetailColor()} />
                        <Circle cx={250} cy={176} r={3.5} fill={getDetailColor()} />
                        {/* Left collar lapel */}
                        <Path d="M 185,55 C 210,75 220,100 228,135 L 250,108 Z"
                          fill={garmentColor} stroke={getDetailColor()} strokeWidth={1.5} />
                        {/* Right collar lapel */}
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
                      {placement ? (
                        <View style={styles.zoneArtworkContainer}>
                          <Image
                            source={{ uri: placement.artworkUri }}
                            style={styles.zoneArtworkImage}
                            resizeMode="contain"
                          />
                          <TouchableOpacity
                            style={styles.zoneRemoveBtn}
                            onPress={() => handleRemovePlacement(zone.id)}
                          >
                            <X size={8} color="#fff" />
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <Text style={[
                          styles.zoneLabel,
                          { fontSize: Math.max(7, zone.w * SCALE * 0.09), color: zoneLabelColor }
                        ]}>
                          {zone.id}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Product info bar */}
              <View style={styles.productInfoBar}>
                {selectedStyle ? (
                  <>
                    <Text style={styles.productInfoName} numberOfLines={1}>
                      {selectedStyle.name}
                    </Text>
                    <Text style={styles.productInfoSub} numberOfLines={1}>
                      {selectedStyle.styleNumber} · {selectedVendor?.name} · {activeColorName || 'Select color'}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.productInfoSub}>
                    No product selected · {activeColorName || 'Select color'}
                  </Text>
                )}
              </View>

              {/* Placement summary */}
              {placements.length > 0 && (
                <View style={styles.placementSummary}>
                  <Text style={styles.placementSummaryTitle}>Placements: {placements.length}</Text>
                  <View style={styles.placementChips}>
                    {placements.map(p => (
                      <View key={p.zoneId} style={styles.placementChip}>
                        <Text style={styles.placementChipText}>{p.zoneId}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>

            {/* ── Right Panel: Artwork ── */}
            <View
              ref={artworkDropRef}
              style={[
                styles.rightPanel,
                artworkDragOver && styles.rightPanelDragOver,
                isMobile && mobileTab !== 'artwork' && { display: 'none' },
                isMobile && { width: '100%' },
              ]}
            >
              <Text style={styles.sectionLabel}>ARTWORK</Text>
              {uploadedArtworks.length < MAX_ARTWORKS ? (
                <TouchableOpacity style={styles.uploadArtworkBtn} onPress={handleUploadArtwork}>
                  <Upload size={16} color={Colors.light.tint} />
                  <Text style={styles.uploadArtworkText}>Upload or Drop Image</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.artworkMaxReached}>
                  <Text style={styles.artworkMaxText}>Max 5 artworks — delete one to add more</Text>
                </View>
              )}

              {uploadedArtworks.length === 0 ? (
                <View style={styles.artworkEmptyState}>
                  <ImageIcon size={32} color={artworkDragOver ? Colors.light.tint : Colors.light.borderDark} />
                  <Text style={styles.artworkEmptyText}>
                    {artworkDragOver ? 'Drop to add artwork' : 'Drop images here'}
                  </Text>
                </View>
              ) : (
                <ScrollView style={styles.artworkList} showsVerticalScrollIndicator={false}>
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
                      <Image source={{ uri: artwork.uri }} style={styles.artworkThumbnail} resizeMode="contain" />
                      <Text style={styles.artworkName} numberOfLines={1}>{artwork.name}</Text>
                      {selectedArtworkId === artwork.id && (
                        <View style={styles.artworkSelectedBadge}>
                          <Text style={styles.artworkSelectedText}>Selected</Text>
                        </View>
                      )}
                      <TouchableOpacity
                        style={styles.artworkDeleteBtn}
                        onPress={() => handleRemoveArtwork(artwork.id)}
                      >
                        <Trash2 size={11} color={Colors.light.error} />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              {selectedArtworkId && (
                <View style={styles.placingHint}>
                  <Text style={styles.placingHintText}>
                    Tap a zone or drag artwork onto the garment to place it
                  </Text>
                </View>
              )}

              {/* Artwork size detection */}
              {artworkSizeIn && (
                <>
                  <Text style={[styles.sectionLabel, { marginTop: 12 }]}>ARTWORK SIZE</Text>
                  <View style={styles.artworkSizeBanner}>
                    <Text style={styles.artworkSizeVal}>{artworkSizeIn.w.toFixed(1)}&quot; × {artworkSizeIn.h.toFixed(1)}&quot;</Text>
                    <Text style={styles.artworkSizeSuggest}>{artworkSizeSuggest}</Text>
                  </View>
                </>
              )}

              {/* Zone reference + art size inputs */}
              <Text style={[styles.sectionLabel, { marginTop: 16 }]}>PRINT LOCATIONS</Text>
              <ScrollView style={styles.zoneRef} showsVerticalScrollIndicator={false}>
                {currentZones.map(zone => {
                  const placement = placementForZone(zone.id);
                  const zoneMaxW = (zone.w / 25).toFixed(1);
                  const zoneMaxH = (zone.h / 25).toFixed(1);
                  return (
                    <View key={zone.id} style={styles.zoneRefItem}>
                      <View style={[styles.zoneRefDot, placement && styles.zoneRefDotFilled]} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.zoneRefText, placement && styles.zoneRefTextFilled]}>
                          {zone.id}
                        </Text>
                        {placement ? (
                          <View style={styles.artSizeRow}>
                            <View style={styles.artSizeField}>
                              <Text style={styles.artSizeLabel}>W&quot;</Text>
                              <TextInput
                                style={styles.artSizeInput}
                                placeholder={zoneMaxW}
                                placeholderTextColor="#aaa"
                                keyboardType="decimal-pad"
                                value={placement.artWidthIn ?? ''}
                                onChangeText={val => setPlacements(prev =>
                                  prev.map(p => p.zoneId === zone.id ? { ...p, artWidthIn: val } : p)
                                )}
                              />
                            </View>
                            <Text style={styles.artSizeSep}>×</Text>
                            <View style={styles.artSizeField}>
                              <Text style={styles.artSizeLabel}>H&quot;</Text>
                              <TextInput
                                style={styles.artSizeInput}
                                placeholder={zoneMaxH}
                                placeholderTextColor="#aaa"
                                keyboardType="decimal-pad"
                                value={placement.artHeightIn ?? ''}
                                onChangeText={val => setPlacements(prev =>
                                  prev.map(p => p.zoneId === zone.id ? { ...p, artHeightIn: val } : p)
                                )}
                              />
                            </View>
                            <Text style={styles.artSizeMax}>(max {zoneMaxW}×{zoneMaxH}&quot;)</Text>
                          </View>
                        ) : (
                          <Text style={styles.artSizeMax}>Max {zoneMaxW}&quot; × {zoneMaxH}&quot;</Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          </View>

          {/* Footer */}
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

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  panel: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 1100,
    maxHeight: '95%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    backgroundColor: Colors.light.surface,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: Colors.light.text },
  closeBtn: { padding: 4 },
  body: {
    flexDirection: 'row',
    flex: 1,
    overflow: 'hidden',
    minHeight: 480,
  },
  leftPanel: {
    width: 210,
    borderRightWidth: 1,
    borderRightColor: Colors.light.border,
    backgroundColor: Colors.light.surface,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  centerPanel: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: 12,
    backgroundColor: '#EAECF0',
  },
  rightPanel: {
    width: 180,
    borderLeftWidth: 1,
    borderLeftColor: Colors.light.border,
    backgroundColor: Colors.light.surface,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    backgroundColor: Colors.light.surface,
  },
  footerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.light.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 14,
  },
  templateVendorRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 0,
  },
  templateVendorCol: {
    flex: 1,
  },
  garmentTypes: { gap: 4 },
  typeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: '#fff',
  },
  typeBtnActive: {
    backgroundColor: Colors.light.tint,
    borderColor: Colors.light.tint,
  },
  typeBtnText: { fontSize: 12, color: Colors.light.text, fontWeight: '500' },
  typeBtnTextActive: { color: '#fff', fontWeight: '600' },

  styleBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: '#fff',
  },
  styleBtnActive: {
    backgroundColor: '#FFF0E8',
    borderColor: Colors.light.tint,
  },
  styleNumber: { fontSize: 11, fontWeight: '700', color: Colors.light.tint },
  styleNumberActive: { color: Colors.light.tint },
  styleName: { fontSize: 11, color: Colors.light.textSecondary, lineHeight: 14, marginTop: 1 },
  styleNameActive: { color: Colors.light.text },

  styleSelectedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: '#fff',
  },
  styleSelectedBtnText: {
    fontSize: 12,
    color: Colors.light.text,
    fontWeight: '500',
    flex: 1,
    marginRight: 6,
  },
  styleSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.light.tint,
    borderRadius: 8,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    backgroundColor: '#fff',
    paddingHorizontal: 8,
  },
  styleSearchInput: {
    flex: 1,
    height: 34,
    fontSize: 12,
    color: Colors.light.text,
  },
  styleSearchClose: {
    padding: 4,
  },
  styleDropdownScroll: {
    maxHeight: 5 * 42,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: Colors.light.border,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    backgroundColor: '#fff',
  },
  styleCustomRow: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    backgroundColor: '#FFF8F5',
  },
  styleCustomText: {
    fontSize: 11,
    color: Colors.light.tint,
    fontWeight: '600',
    fontStyle: 'italic',
  },
  styleDropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  styleDropdownRowActive: {
    backgroundColor: '#FFF4EE',
  },
  styleDropdownNum: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.light.tint,
    minWidth: 80,
    flexShrink: 0,
  },
  styleDropdownNumActive: {
    color: Colors.light.tint,
  },
  styleDropdownName: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    flex: 1,
  },
  styleDropdownNameActive: {
    color: Colors.light.text,
  },

  productInfoBar: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 6,
    alignItems: 'center',
  },
  productInfoName: { fontSize: 12, fontWeight: '700', color: '#fff' },
  productInfoSub: { fontSize: 10, color: 'rgba(255,255,255,0.75)', marginTop: 1 },

  bodyMobile: {
    flexDirection: 'column',
  },

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
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  mobileTabBtnActive: {
    borderBottomColor: Colors.light.tint,
  },
  mobileTabText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.light.textSecondary,
  },
  mobileTabTextActive: {
    color: Colors.light.tint,
    fontWeight: '700',
  },
  mobileTabBadge: {
    backgroundColor: Colors.light.tint,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  mobileTabBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '700',
  },

  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  colorSwatch: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorSwatchWhite: { borderWidth: 1, borderColor: '#ddd' },
  colorSwatchSelected: { borderWidth: 2.5, borderColor: Colors.light.tint },
  colorLabel: { fontSize: 11, color: Colors.light.textSecondary, marginTop: 4 },

  viewToggle: { flexDirection: 'row', gap: 6 },
  viewBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  viewBtnActive: { backgroundColor: Colors.light.tint, borderColor: Colors.light.tint },
  viewBtnText: { fontSize: 11, color: Colors.light.textSecondary, fontWeight: '500' },
  viewBtnTextActive: { color: '#fff', fontWeight: '600' },

  instructions: {
    marginTop: 14,
    padding: 10,
    backgroundColor: '#FFF8F5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFD9C5',
  },
  instructionsTitle: { fontSize: 10, fontWeight: '700', color: Colors.light.tint, marginBottom: 4 },
  instructionsText: { fontSize: 10, color: Colors.light.textSecondary, lineHeight: 16 },

  canvasContainer: {
    position: 'relative',
    backgroundColor: '#EAECF0',
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
    color: 'rgba(60,60,60,0.7)',
    fontWeight: '600',
    textAlign: 'center',
    padding: 2,
  },
  zoneArtworkContainer: { width: '100%', height: '100%', position: 'relative' },
  zoneArtworkImage: { width: '100%', height: '100%' },
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

  placementSummary: {
    marginTop: 10,
    alignItems: 'center',
  },
  placementSummaryTitle: { fontSize: 11, color: Colors.light.textSecondary, marginBottom: 4 },
  placementChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, justifyContent: 'center' },
  placementChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#DCFCE7',
    borderRadius: 10,
  },
  placementChipText: { fontSize: 10, color: '#15803D', fontWeight: '600' },

  uploadArtworkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#FFF0E8',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.tint,
    justifyContent: 'center',
    marginBottom: 10,
  },
  uploadArtworkText: { fontSize: 12, color: Colors.light.tint, fontWeight: '600' },

  rightPanelDragOver: {
    backgroundColor: '#FFF8F5',
    borderLeftColor: Colors.light.tint,
    borderLeftWidth: 2,
  },
  artworkEmptyState: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  artworkEmptyText: { fontSize: 11, color: Colors.light.textSecondary, textAlign: 'center', lineHeight: 16 },
  artworkMaxReached: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#FFF8F5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFD9C5',
    marginBottom: 10,
    alignItems: 'center',
  },
  artworkMaxText: { fontSize: 11, color: Colors.light.tint, fontWeight: '600', textAlign: 'center' },
  artworkItemDragging: { opacity: 0.4 },
  artworkSizeBanner: {
    backgroundColor: '#EFF6FF',
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    gap: 2,
  },
  artworkSizeVal: { fontSize: 13, fontWeight: '700', color: '#1D4ED8', textAlign: 'center' },
  artworkSizeSuggest: { fontSize: 9, color: '#3B82F6', textAlign: 'center', lineHeight: 13 },

  artworkList: { maxHeight: 180 },
  artworkItem: {
    flexDirection: 'column',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    marginBottom: 6,
    backgroundColor: '#fff',
    gap: 4,
    position: 'relative',
  },
  artworkItemSelected: {
    borderColor: Colors.light.tint,
    backgroundColor: '#FFF8F5',
  },
  artworkThumbnail: { width: 60, height: 60 },
  artworkName: { fontSize: 10, color: Colors.light.textSecondary, textAlign: 'center' },
  artworkSelectedBadge: {
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  artworkSelectedText: { fontSize: 9, color: '#fff', fontWeight: '700' },
  artworkDeleteBtn: { position: 'absolute', top: 4, right: 4 },

  placingHint: {
    padding: 8,
    backgroundColor: '#EFF6FF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginTop: 4,
  },
  placingHintText: { fontSize: 10, color: '#1D4ED8', textAlign: 'center', lineHeight: 14 },

  zoneRef: { maxHeight: 260 },
  zoneRefItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingVertical: 4 },
  zoneRefDot: {
    width: 8, height: 8, borderRadius: 4, marginTop: 3,
    borderWidth: 1.5, borderColor: Colors.light.borderDark,
    backgroundColor: 'transparent',
  },
  zoneRefDotFilled: { backgroundColor: '#22C55E', borderColor: '#22C55E' },
  zoneRefText: { fontSize: 11, color: Colors.light.textSecondary },
  zoneRefTextFilled: { color: '#15803D', fontWeight: '600' },

  artSizeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, flexWrap: 'wrap' },
  artSizeField: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  artSizeLabel: { fontSize: 10, color: Colors.light.textSecondary, fontWeight: '600' },
  artSizeInput: {
    width: 42,
    height: 22,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 4,
    paddingHorizontal: 5,
    fontSize: 11,
    color: Colors.light.text,
    backgroundColor: '#fff',
  },
  artSizeSep: { fontSize: 11, color: Colors.light.textSecondary, marginHorizontal: 1 },
  artSizeMax: { fontSize: 9, color: Colors.light.textSecondary, marginTop: 2 },

  resetBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 8, paddingHorizontal: 12,
    borderRadius: 8, borderWidth: 1, borderColor: Colors.light.border,
  },
  resetBtnText: { fontSize: 13, color: Colors.light.textSecondary },

  downloadBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 8, paddingHorizontal: 12,
    borderRadius: 8, borderWidth: 1, borderColor: Colors.light.tint,
  },
  downloadBtnText: { fontSize: 13, color: Colors.light.tint, fontWeight: '600' },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 8, paddingHorizontal: 16,
    backgroundColor: Colors.light.tint, borderRadius: 8,
    minWidth: 120, justifyContent: 'center',
  },
  saveBtnText: { fontSize: 13, color: '#fff', fontWeight: '700' },
});
