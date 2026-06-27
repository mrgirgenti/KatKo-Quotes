import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Platform,
  Image,
  ScrollView,
  Modal,
  Pressable,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ChevronDown, ChevronUp, Trash2, Upload, RefreshCw, X, Brush, Plus, CheckCircle } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { MockupDesigner } from './MockupDesigner/MockupDesigner';
import type { ProductColor } from './MockupDesigner/vendorCatalog';
import type { GarmentType } from './MockupDesigner/garmentData';
import {
  LineItem,
  GarmentVariant,
  SERVICE_STYLES,
  EMPTY_SIZES,
  APPAREL_PROVIDERS,
  LOCATIONS,
  APPLICATORS,
  SizeQuantities,
  SIZE_LABELS,
} from '@/types/quote';
import { FormInput } from './FormInput';
import { CurrencyInput } from './CurrencyInput';
import { SegmentedControl } from './SegmentedControl';
import { ComboBox } from './ComboBox';
import { getTotalQuantity, calculateLineItemSubtotal, formatCurrency } from '@/utils/quoteCalculations';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useQuery, useQueries } from '@tanstack/react-query';
import { apiFetch } from '@/lib/apiFetch';

interface LineItemCardProps {
  item: LineItem;
  index: number;
  onChange: (item: LineItem) => void;
  onDelete: () => void;
}

const APPAREL_SIZES = SIZE_LABELS.filter((s) => s.key !== 'flat');


function getVariantQty(variant: GarmentVariant): number {
  return APPAREL_SIZES.reduce((sum, { key }) => sum + (variant.sizes[key] || 0), 0);
}

function mergeVariantSizes(variants: GarmentVariant[]): SizeQuantities {
  const merged = { ...EMPTY_SIZES };
  for (const v of variants) {
    for (const { key } of APPAREL_SIZES) {
      merged[key] = (merged[key] || 0) + (v.sizes[key] || 0);
    }
  }
  return merged;
}

// ── Catalog (DB Products) integration types/helpers (Phase 1) ──
interface CatalogProduct {
  id: string;
  styleNumber: string;
  brand: string;
  name: string;
  defaultBlankCost?: string | number | null;
}

interface VendorSourceInfo {
  name: string;
  isPreferred: boolean;
}

// Luminance check so the swatch check-icon contrasts against the color.
function isDarkHex(hex?: string | null): boolean {
  if (!hex) return false;
  const m = hex.replace('#', '');
  if (m.length !== 6) return false;
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return false;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum < 0.5;
}

export function LineItemCard({ item, index, onChange, onDelete }: LineItemCardProps) {
  const [expanded, setExpanded] = useState(true);
  const [showDesigner, setShowDesigner] = useState(false);
  const [variantPickerVisible, setVariantPickerVisible] = useState(false);
  const [mockupVariantIdx, setMockupVariantIdx] = useState(0);
  const [mockupLinkedVariantIdx, setMockupLinkedVariantIdx] = useState<number | null>(null);
  const [syncPromptVisible, setSyncPromptVisible] = useState(false);
  const [showLocation34, setShowLocation34] = useState(!!(item.location3 || item.location4));
  const [serviceDropdownOpen, setServiceDropdownOpen] = useState(false);

  const [dtfWidth1, setDtfWidth1] = useState('');
  const [dtfHeight1, setDtfHeight1] = useState('');
  const [dtfWidth2, setDtfWidth2] = useState('');
  const [dtfHeight2, setDtfHeight2] = useState('');
  const [dtfRate, setDtfRate] = useState('0.03');
  const [embStitchCount1, setEmbStitchCount1] = useState('');
  const [embStitchCount2, setEmbStitchCount2] = useState('');
  const [includeDigitization, setIncludeDigitization] = useState(false);

  const { isMobile } = useBreakpoint();
  const useSideBySide = Platform.OS === 'web' && !isMobile;

  const isPromotional = item.serviceStyle === 'Promotional';
  const isDTF = item.serviceStyle === 'Direct to Film';
  const isEmbroidery = item.serviceStyle === 'Embroidery';
  const isDTFTransfers = item.serviceStyle === 'DTF Transfers';
  const isDesignWork = item.serviceStyle === 'Design Work';
  const hasSecondLocation = !!(item.location2 && item.location2.length > 0);
  // Design Work has no garment sizes; treat it the same as Promotional for qty calc.
  const quantity = getTotalQuantity(item.sizes, isPromotional || isDesignWork);
  const lineItemCalcs = calculateLineItemSubtotal(item);

  // ── Garment variants ──
  const getInitialVariants = (): GarmentVariant[] => {
    if (item.garmentVariants && item.garmentVariants.length > 0) {
      return item.garmentVariants;
    }
    return [{ product: item.product, color: item.productColor, sizes: { ...item.sizes } }];
  };
  const [variants, setVariants] = useState<GarmentVariant[]>(getInitialVariants);

  const getInitialGarmentTypes = (): GarmentType[] => {
    return getInitialVariants().map(() => 'tshirt' as GarmentType);
  };
  const [variantGarmentTypes, setVariantGarmentTypes] = useState<GarmentType[]>(getInitialGarmentTypes);
  const [variantSearchTerms, setVariantSearchTerms] = useState<string[]>(() =>
    getInitialVariants().map((v) => v.product || '')
  );
  const [variantStyleFocused, setVariantStyleFocused] = useState<boolean[]>(() =>
    getInitialVariants().map(() => false)
  );
  const [variantColorOpen, setVariantColorOpen] = useState<boolean[]>(() =>
    getInitialVariants().map(() => false)
  );
  const [variantHoveredColors, setVariantHoveredColors] = useState<(string | null)[]>(() =>
    getInitialVariants().map(() => null)
  );
  const [variantCustomColorText, setVariantCustomColorText] = useState<string[]>(() =>
    getInitialVariants().map(() => '')
  );
  const dropZoneRef = useRef<any>(null);

  // ── Catalog (DB Products) data layer (Phase 1) ──
  // Catalog search is driven by whichever variant style box is currently focused.
  const focusedVariantIdx = variantStyleFocused.findIndex(Boolean);
  const activeSearchTerm =
    focusedVariantIdx >= 0 ? (variantSearchTerms[focusedVariantIdx] ?? '') : '';
  const [debouncedCatalogTerm, setDebouncedCatalogTerm] = useState('');
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedCatalogTerm(activeSearchTerm.trim()), 250);
    return () => clearTimeout(handle);
  }, [activeSearchTerm]);

  const catalogSearch = useQuery({
    queryKey: ['line-item-product-search', debouncedCatalogTerm],
    queryFn: () => apiFetch(`/api/products?q=${encodeURIComponent(debouncedCatalogTerm)}`),
    enabled: focusedVariantIdx >= 0 && debouncedCatalogTerm.length >= 2,
    staleTime: 30000,
  });
  const catalogResults: CatalogProduct[] = catalogSearch.data?.products ?? [];

  // Colors / vendors / placements for every catalog-linked variant in this line item.
  // useQueries keeps a stable single hook even as the selected-product set changes.
  const selectedProductIds = Array.from(
    new Set(variants.map((v) => v.productId).filter((pid): pid is string => !!pid)),
  );
  const colorQueries = useQueries({
    queries: selectedProductIds.map((pid) => ({
      queryKey: ['product-colors', pid],
      queryFn: () => apiFetch(`/api/products/${pid}/colors`),
      staleTime: 60000,
    })),
  });
  const vendorQueries = useQueries({
    queries: selectedProductIds.map((pid) => ({
      queryKey: ['product-vendor-sources', pid],
      queryFn: () => apiFetch(`/api/products/${pid}/vendor-sources`),
      staleTime: 60000,
    })),
  });
  // Effective placements are pre-fetched to warm the cache for future mockup work; no UI yet.
  useQueries({
    queries: selectedProductIds.map((pid) => ({
      queryKey: ['product-effective-placements', pid],
      queryFn: () => apiFetch(`/api/products/${pid}/effective-placements`),
      staleTime: 60000,
    })),
  });
  const dbColorsByProductId: Record<string, ProductColor[]> = {};
  const dbVendorsByProductId: Record<string, VendorSourceInfo[]> = {};
  selectedProductIds.forEach((pid, i) => {
    const colorRows = (colorQueries[i]?.data as { colors?: any[] } | undefined)?.colors ?? [];
    dbColorsByProductId[pid] = colorRows.map((c: any) => ({
      name: c.colorName,
      hex: c.hex || '#cccccc',
      dark: isDarkHex(c.hex),
    }));
    const vendorRows = (vendorQueries[i]?.data as { sources?: any[] } | undefined)?.sources ?? [];
    dbVendorsByProductId[pid] = vendorRows
      .filter((s: any) => s.isActive !== false)
      .map((s: any) => ({ name: s.vendorName as string, isPreferred: !!s.isPreferred }));
  });

  const handleVariantsChange = (newVariants: GarmentVariant[]) => {
    setVariants(newVariants);
    if (isPromotional) return;
    const mergedSizes = mergeVariantSizes(newVariants);
    onChange({
      ...item,
      garmentVariants: newVariants,
      sizes: mergedSizes,
      product: newVariants[0]?.product || item.product,
      productColor: newVariants.length === 1 ? (newVariants[0]?.color || item.productColor) : 'Multiple',
    });
  };

  const setVariantGarmentType = (vIdx: number, type: GarmentType) => {
    setVariantGarmentTypes((prev) => prev.map((t, i) => (i === vIdx ? type : t)));
    setVariantSearchTerms((prev) => prev.map((t, i) => (i === vIdx ? '' : t)));
    updateVariant(vIdx, {
      product: '',
      color: '',
      productId: undefined,
      styleNumber: undefined,
      brand: undefined,
      productName: undefined,
      productSource: undefined,
    });
  };

  const addVariant = () => {
    if (variants.length >= 10) return;
    handleVariantsChange([...variants, { product: '', color: '', sizes: { ...EMPTY_SIZES } }]);
    setVariantGarmentTypes((prev) => [...prev, 'tshirt']);
    setVariantSearchTerms((prev) => [...prev, '']);
    setVariantStyleFocused((prev) => [...prev, false]);
    setVariantColorOpen((prev) => [...prev, false]);
    setVariantCustomColorText((prev) => [...prev, '']);
  };

  const removeVariant = (idx: number) => {
    if (variants.length <= 1) return;
    handleVariantsChange(variants.filter((_, i) => i !== idx));
    setVariantGarmentTypes((prev) => prev.filter((_, i) => i !== idx));
    setVariantSearchTerms((prev) => prev.filter((_, i) => i !== idx));
    setVariantStyleFocused((prev) => prev.filter((_, i) => i !== idx));
    setVariantColorOpen((prev) => prev.filter((_, i) => i !== idx));
    setVariantCustomColorText((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateVariant = (idx: number, partial: Partial<GarmentVariant>) => {
    const updated = variants.map((v, i) => (i === idx ? { ...v, ...partial } : v));
    handleVariantsChange(updated);
  };

  const updateVariantSize = (variantIdx: number, sizeKey: keyof SizeQuantities, value: string) => {
    const num = parseInt(value) || 0;
    const updated = variants.map((v, i) =>
      i === variantIdx ? { ...v, sizes: { ...v.sizes, [sizeKey]: num } } : v
    );
    handleVariantsChange(updated);
  };

  // Bind a curated catalog product to a variant: snapshot style/brand/name + auto-fill
  // the default cost (quote stays the source of truth — user can override afterward).
  const handleSelectCatalogProduct = (vIdx: number, product: CatalogProduct) => {
    const label = `${product.styleNumber} — ${product.name}`;
    const updated = variants.map((v, i) =>
      i === vIdx
        ? {
            ...v,
            product: label,
            color: '',
            productId: product.id,
            styleNumber: product.styleNumber,
            brand: product.brand,
            productName: product.name,
            productSource: 'catalog' as const,
          }
        : v,
    );
    setVariants(updated);
    setVariantSearchTerms((prev) => prev.map((t, i) => (i === vIdx ? label : t)));
    setVariantStyleFocused((prev) => prev.map((f, i) => (i === vIdx ? false : f)));
    const rawCost = product.defaultBlankCost;
    const parsedCost =
      rawCost === null || rawCost === undefined || rawCost === ''
        ? item.productCostEach
        : Number(rawCost);
    const nextCost = Number.isFinite(parsedCost) ? parsedCost : item.productCostEach;
    const mergedSizes = mergeVariantSizes(updated);
    onChange({
      ...item,
      garmentVariants: updated,
      sizes: isPromotional ? item.sizes : mergedSizes,
      product: updated[0]?.product || item.product,
      productColor: updated.length === 1 ? (updated[0]?.color || item.productColor) : 'Multiple',
      productCostEach: nextCost,
    });
    if (item.mockupUri && mockupLinkedVariantIdx !== null && vIdx === mockupLinkedVariantIdx) {
      setSyncPromptVisible(true);
    }
  };

  // Choosing a hardcoded quick-pick or a custom free-text style clears any catalog binding.
  const markVariantManual = (vIdx: number, label: string) => {
    updateVariant(vIdx, {
      product: label,
      color: '',
      productId: undefined,
      styleNumber: undefined,
      brand: undefined,
      productName: undefined,
      productSource: 'manual',
    });
    if (item.mockupUri && mockupLinkedVariantIdx !== null && vIdx === mockupLinkedVariantIdx) {
      setSyncPromptVisible(true);
    }
  };

  // ── Mockup variant selection ───────────────────────────────────────────────
  const handleDesignMockup = () => {
    if (variants.length <= 1) {
      setMockupVariantIdx(0);
      setShowDesigner(true);
    } else {
      setVariantPickerVisible(true);
    }
  };

  const handlePickVariantForMockup = (idx: number) => {
    setMockupVariantIdx(idx);
    setVariantPickerVisible(false);
    setShowDesigner(true);
  };

  // Promotional flat quantity state
  const [flatQty, setFlatQty] = useState(item.sizes.flat > 0 ? item.sizes.flat.toString() : '');
  const handleFlatQtyChange = (val: string) => {
    const num = parseInt(val) || 0;
    setFlatQty(val);
    onChange({ ...item, sizes: { ...item.sizes, flat: num } });
  };

  const parseNumber = (value: string): number => {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  };

  const formatDecimalInput = (text: string): string => {
    const cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) return text.slice(0, -1);
    if (parts[1] && parts[1].length > 2) return `${parts[0]}.${parts[1].slice(0, 2)}`;
    return cleaned;
  };

  const dtfWidth1Num = parseNumber(dtfWidth1);
  const dtfHeight1Num = parseNumber(dtfHeight1);
  const dtfWidth2Num = parseNumber(dtfWidth2);
  const dtfHeight2Num = parseNumber(dtfHeight2);
  const dtfRateNum = parseNumber(dtfRate);
  const dtfSquareInches1 = dtfWidth1Num * dtfHeight1Num;
  const dtfCalculatedCost1 = Math.round(dtfSquareInches1 * dtfRateNum * 100) / 100;
  const dtfSquareInches2 = dtfWidth2Num * dtfHeight2Num;
  const dtfCalculatedCost2 = Math.round(dtfSquareInches2 * dtfRateNum * 100) / 100;
  const dtfTotalCalculatedCost = dtfCalculatedCost1 + dtfCalculatedCost2;

  const EMB_RATE_PER_1000 = 2.0;
  const EMB_MIN_STITCHES = 3000;
  const EMB_MAX_STITCHES = 20000;
  const DIGITIZATION_FEE = 50.0;

  const embStitchCount1Num = parseNumber(embStitchCount1);
  const embStitchCount2Num = parseNumber(embStitchCount2);
  const embCost1 = Math.round(EMB_RATE_PER_1000 * (embStitchCount1Num / 1000) * 100) / 100;
  const embCost2 = Math.round(EMB_RATE_PER_1000 * (embStitchCount2Num / 1000) * 100) / 100;
  const embTotalCost = embCost1 + embCost2;

  const handleStitchCountChange = (text: string, setter: (val: string) => void) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    const num = parseInt(cleaned, 10);
    if (cleaned === '' || (num >= 0 && num <= EMB_MAX_STITCHES)) setter(cleaned);
  };

  const handleServiceStyleChange = (style: typeof item.serviceStyle) => {
    const updatedItem: LineItem = {
      ...item,
      serviceStyle: style,
      sizes: style === 'Promotional' ? { ...EMPTY_SIZES, flat: item.sizes.flat || 0 } : item.sizes,
    };
    if (style === 'Direct to Film' && !item.applicator) {
      updatedItem.applicator = 'Katalyst Ko Printshop';
    }
    onChange(updatedItem);
  };

  const applyDTFCost = () => {
    if (dtfTotalCalculatedCost > 0) {
      onChange({ ...item, serviceCostEach: dtfTotalCalculatedCost });
    }
  };

  const applyEmbroideryCost = () => {
    if (embTotalCost > 0) {
      onChange({
        ...item,
        serviceCostEach: embTotalCost,
        serviceFeeEach: includeDigitization ? DIGITIZATION_FEE : 0,
      });
    }
  };

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const prevent = (e: Event) => { e.preventDefault(); };
    document.addEventListener('dragover', prevent);
    document.addEventListener('drop', prevent);
    return () => {
      document.removeEventListener('dragover', prevent);
      document.removeEventListener('drop', prevent);
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || !dropZoneRef.current) return;
    const node = dropZoneRef.current;
    const handleDragOver = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); };
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const file = (e as any).dataTransfer?.files?.[0];
      if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (ev: any) => {
          if (ev.target?.result) onChange({ ...item, mockupUri: ev.target.result as string });
        };
        reader.readAsDataURL(file);
      }
    };
    node.addEventListener('dragover', handleDragOver);
    node.addEventListener('drop', handleDrop);
    return () => {
      node.removeEventListener('dragover', handleDragOver);
      node.removeEventListener('drop', handleDrop);
    };
  }, [dropZoneRef.current, onChange, item.mockupUri]);

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.5,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const mimeType = asset.mimeType || 'image/jpeg';
      const uri = asset.base64 ? `data:${mimeType};base64,${asset.base64}` : asset.uri;
      onChange({ ...item, mockupUri: uri });
    }
  };

  return (
    <View style={styles.container}>
      {/* ── Card Header ── */}
      <TouchableOpacity style={styles.header} onPress={() => setExpanded(!expanded)}>
        <View style={styles.headerLeft}>
          <View style={styles.indexBadge}>
            <Text style={styles.indexText}>{index + 1}</Text>
          </View>
          {item.mockupUri && !expanded && (
            <Image source={{ uri: item.mockupUri }} style={styles.headerThumbnail} resizeMode="cover" />
          )}
          <View style={styles.headerTextWrap}>
            <Text style={styles.title} numberOfLines={1}>
              {item.designName || 'Untitled Design'}
            </Text>
            <Text style={styles.subtitle}>
              {item.serviceStyle} • {quantity} pcs
            </Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={onDelete} style={styles.deleteBtn}>
            <Trash2 size={18} color="#ff6b6b" />
          </TouchableOpacity>
          {expanded ? (
            <ChevronUp size={20} color="rgba(255,255,255,0.7)" />
          ) : (
            <ChevronDown size={20} color="rgba(255,255,255,0.7)" />
          )}
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={[styles.content, useSideBySide && styles.contentWeb, isMobile && styles.contentMobile]}>

          {/* ── Mockup Panel ── */}
          <View style={[styles.mockupPanel, useSideBySide && styles.mockupPanelWeb, isMobile && styles.mockupPanelMobile]}>
            <Text style={styles.mockupLabel}>MOCKUP</Text>
            {item.mockupUri ? (
              <View style={styles.mockupImageContainer}>
                <Image source={{ uri: item.mockupUri }} style={styles.mockupImage} resizeMode="contain" />
                <View style={styles.mockupActions}>
                  <TouchableOpacity style={styles.mockupDesignBtn} onPress={handleDesignMockup}>
                    <Brush size={12} color="#fff" />
                    <Text style={styles.mockupChangeBtnText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.mockupChangeBtn} onPress={handlePickImage}>
                    <RefreshCw size={12} color="#fff" />
                    <Text style={styles.mockupChangeBtnText}>Upload</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.mockupRemoveBtn}
                    onPress={() => onChange({ ...item, mockupUri: undefined })}
                  >
                    <X size={12} color={Colors.light.error} />
                    <Text style={styles.mockupRemoveBtnText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View
                ref={dropZoneRef}
                style={styles.mockupPlaceholderContainer}
              >
                <TouchableOpacity style={styles.mockupDesignBtnLarge} onPress={handleDesignMockup}>
                  <Brush size={22} color={Colors.light.tint} />
                  <Text style={styles.mockupDesignBtnTitle}>Design Mockup</Text>
                  <Text style={styles.mockupDesignBtnSub}>Select template + place artwork</Text>
                </TouchableOpacity>
                <View style={styles.mockupDivider}>
                  <View style={styles.mockupDividerLine} />
                  <Text style={styles.mockupDividerText}>or</Text>
                  <View style={styles.mockupDividerLine} />
                </View>
                <TouchableOpacity style={styles.mockupUploadBtn} onPress={handlePickImage}>
                  <Upload size={15} color={Colors.light.textSecondary} />
                  <Text style={styles.mockupUploadBtnText}>Upload or Drop Image</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Mockup Designer Modal */}
          <MockupDesigner
            visible={showDesigner}
            onClose={() => setShowDesigner(false)}
            onSave={(uri) => {
              onChange({ ...item, mockupUri: uri });
              setMockupLinkedVariantIdx(mockupVariantIdx);
              setShowDesigner(false);
            }}
            initialMockupUri={item.mockupUri}
            suggestedLocations={[item.location1, item.location2].filter(Boolean)}
            initialVariant={{
              vendor: item.apparelProvider,
              product: variants[mockupVariantIdx]?.product,
              color: variants[mockupVariantIdx]?.color,
            }}
            onRequestChangeProduct={variants.length > 1 ? () => {
              setShowDesigner(false);
              setVariantPickerVisible(true);
            } : undefined}
            onColorChange={(colorName) => {
              if (mockupVariantIdx < variants.length) {
                updateVariant(mockupVariantIdx, { color: colorName });
              }
            }}
          />

          {/* Variant Picker — choose which product row to mock up */}
          <Modal
            visible={variantPickerVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setVariantPickerVisible(false)}
          >
            <Pressable style={styles.vpOverlay} onPress={() => setVariantPickerVisible(false)} />
            <View style={styles.vpPanel}>
              <Text style={styles.vpTitle}>Which product to mock up?</Text>
              {variants.map((v, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.vpRow}
                  onPress={() => handlePickVariantForMockup(idx)}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.vpProduct} numberOfLines={1}>{v.product || '(No product)'}</Text>
                    <Text style={styles.vpColor} numberOfLines={1}>{v.color || 'No color specified'}</Text>
                  </View>
                  <CheckCircle size={16} color={idx === mockupVariantIdx ? Colors.light.tint : Colors.light.border} />
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.vpCancel} onPress={() => setVariantPickerVisible(false)}>
                <Text style={styles.vpCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </Modal>

          {/* Sync Prompt — garment changed after mockup was created */}
          <Modal
            visible={syncPromptVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setSyncPromptVisible(false)}
          >
            <Pressable style={styles.vpOverlay} onPress={() => setSyncPromptVisible(false)} />
            <View style={styles.syncPanel}>
              <Text style={styles.syncTitle}>Garment Changed</Text>
              <Text style={styles.syncBody}>
                The selected garment has changed since this mockup was created. Would you like to update the mockup to use the newly selected garment?
              </Text>
              <TouchableOpacity
                style={styles.syncBtnPrimary}
                onPress={() => {
                  setSyncPromptVisible(false);
                  if (mockupLinkedVariantIdx !== null) setMockupVariantIdx(mockupLinkedVariantIdx);
                  setShowDesigner(true);
                }}
              >
                <Text style={styles.syncBtnPrimaryText}>Update Mockup</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.syncBtnSecondary} onPress={() => setSyncPromptVisible(false)}>
                <Text style={styles.syncBtnSecondaryText}>Keep Existing Garment</Text>
              </TouchableOpacity>
            </View>
          </Modal>

          {/* ── Form Fields ── */}
          <View style={styles.formFieldsSection}>

            {/* 1. Design Name */}
            <FormInput
              label="Design Name"
              value={item.designName}
              onChangeText={(v) => onChange({ ...item, designName: v })}
              placeholder="Enter design name"
              autoTitleCase
            />

            {/* 2. Service Style */}
            {isMobile ? (
              <View style={styles.serviceDropdownWrap}>
                <Text style={styles.serviceDropdownLabel}>SERVICE STYLE</Text>
                <TouchableOpacity
                  style={styles.serviceDropdownBtn}
                  onPress={() => setServiceDropdownOpen(v => !v)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.serviceDropdownValue}>{item.serviceStyle || 'Select style'}</Text>
                  <ChevronDown size={14} color={Colors.light.textSecondary} />
                </TouchableOpacity>
                {serviceDropdownOpen && (
                  <View style={styles.serviceDropdownList}>
                    {(SERVICE_STYLES as readonly string[]).map((style) => {
                      const active = item.serviceStyle === style;
                      return (
                        <TouchableOpacity
                          key={style}
                          style={[styles.serviceDropdownItem, active && styles.serviceDropdownItemActive]}
                          onPress={() => {
                            handleServiceStyleChange(style as typeof item.serviceStyle);
                            setServiceDropdownOpen(false);
                          }}
                        >
                          <Text style={[styles.serviceDropdownItemText, active && styles.serviceDropdownItemTextActive]}>
                            {style}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            ) : (
              <SegmentedControl
                label="Service Style"
                options={SERVICE_STYLES}
                value={item.serviceStyle}
                onChange={handleServiceStyleChange}
                centered
              />
            )}

            {/* 3. Service Applicator + Product Source */}
            <View style={[styles.row, isMobile && styles.rowMobile]}>
              <View style={styles.halfField}>
                <ComboBox
                  label="Service Applicator"
                  value={item.applicator}
                  options={APPLICATORS}
                  onChange={(v) => onChange({ ...item, applicator: v })}
                  placeholder="Select applicator"
                  autoTitleCase
                />
              </View>
              <View style={styles.halfField}>
                <ComboBox
                  label="Product Source"
                  value={item.apparelProvider}
                  options={APPAREL_PROVIDERS}
                  onChange={(v) => onChange({ ...item, apparelProvider: v })}
                  placeholder="Select provider"
                  autoTitleCase
                />
              </View>
            </View>

            {/* 4. Location #1 + #2 */}
            {!isPromotional && (
              <View style={[styles.row, isMobile && styles.rowMobile]}>
                <View style={styles.halfField}>
                  <ComboBox
                    label="Location #1"
                    value={item.location1}
                    options={[...LOCATIONS]}
                    onChange={(v) => onChange({ ...item, location1: v })}
                    placeholder="Select location"
                    autoTitleCase
                  />
                </View>
                <View style={styles.halfField}>
                  <ComboBox
                    label="Location #2"
                    value={item.location2}
                    options={[...LOCATIONS]}
                    onChange={(v) => onChange({ ...item, location2: v })}
                    placeholder="Select location"
                    autoTitleCase
                  />
                </View>
              </View>
            )}

            {/* 5. Expandable Location #3 + #4 */}
            {!isPromotional && (
              <>
                {!showLocation34 ? (
                  <TouchableOpacity
                    style={styles.addLocationBtn}
                    onPress={() => setShowLocation34(true)}
                  >
                    <Plus size={13} color={Colors.light.tint} />
                    <Text style={styles.addLocationBtnText}>Add Location #3 / #4</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={[styles.row, isMobile && styles.rowMobile]}>
                    <View style={styles.halfField}>
                      <ComboBox
                        label="Location #3"
                        value={item.location3 || ''}
                        options={[...LOCATIONS]}
                        onChange={(v) => onChange({ ...item, location3: v })}
                        placeholder="Select location"
                        autoTitleCase
                      />
                    </View>
                    <View style={styles.halfField}>
                      <ComboBox
                        label="Location #4"
                        value={item.location4 || ''}
                        options={[...LOCATIONS]}
                        onChange={(v) => onChange({ ...item, location4: v })}
                        placeholder="Select location"
                        autoTitleCase
                      />
                    </View>
                  </View>
                )}
              </>
            )}

            {/* 6. Project Notes */}
            <FormInput
              label="Project Notes"
              value={item.locationDetails}
              onChangeText={(v) => onChange({ ...item, locationDetails: v })}
              placeholder="e.g., 4x4 Logo, Size, Design specifics"
              autoTitleCase
            />

            {/* ── 7. Product / Size Variants ── */}
            <View style={styles.variantSection}>
              <View style={styles.variantHeader}>
                <Text style={styles.variantHeaderTitle}>Products + Sizes</Text>
                {!isPromotional && variants.length < 10 && (
                  <TouchableOpacity style={styles.addVariantBtn} onPress={addVariant}>
                    <Plus size={13} color="#fff" />
                    <Text style={styles.addVariantBtnText}>Add Style/Color</Text>
                  </TouchableOpacity>
                )}
              </View>

              {isPromotional ? (
                <View style={styles.promotionalQty}>
                  <Text style={styles.promotionalQtyLabel}>Flat Quantity</Text>
                  <TextInput
                    style={styles.promotionalQtyInput}
                    value={flatQty}
                    onChangeText={handleFlatQtyChange}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor={Colors.light.textSecondary}
                  />
                </View>
              ) : (
                <View style={styles.variantTableWrap}>
                  <View style={styles.variantTable}>
                    {/* Variant rows */}
                    {variants.map((variant, vIdx) => {
                      const rowQty = getVariantQty(variant);
                      const isCatalogVariant = !!variant.productId;
                      const colorObjects: ProductColor[] = isCatalogVariant
                        ? (dbColorsByProductId[variant.productId as string] ?? [])
                        : [];
                      return (
                        <View key={vIdx} style={[styles.variantRow, vIdx % 2 === 1 && styles.variantRowAlt]}>
                          {/* Compact single-line 3-column picker */}
                          {(() => {
                            const rawSearch = variantSearchTerms[vIdx] ?? '';
                            const selectedColorObj = colorObjects.find((c) => c.name === variant.color);
                            return (
                              <View style={styles.variantPickerSection}>
                                {/* Single-line row: Type | Style search | Color | Delete */}
                                <View style={styles.variantPickerRow}>

                                  {/* Style search input */}
                                  <TextInput
                                    style={styles.variantStyleInput}
                                    value={variantSearchTerms[vIdx] ?? ''}
                                    onChangeText={(v) =>
                                      setVariantSearchTerms((prev) => prev.map((t, i) => (i === vIdx ? v : t)))
                                    }
                                    placeholder="Search style..."
                                    placeholderTextColor={Colors.light.textSecondary}
                                    onFocus={() =>
                                      setVariantStyleFocused((prev) => prev.map((_, i) => i === vIdx))
                                    }
                                    onBlur={() =>
                                      setTimeout(
                                        () => setVariantStyleFocused((prev) => prev.map((f, i) => (i === vIdx ? false : f))),
                                        180
                                      )
                                    }
                                  />

                                  {/* Color button or free-text input */}
                                  {colorObjects.length === 0 ? (
                                    <TextInput
                                      style={styles.variantColorFreeInput}
                                      value={variant.color}
                                      onChangeText={(v) => updateVariant(vIdx, { color: v })}
                                      placeholder="Colorway"
                                      placeholderTextColor={Colors.light.textSecondary}
                                    />
                                  ) : (
                                    <TouchableOpacity
                                      style={styles.variantColorBtn}
                                      onPress={() =>
                                        setVariantColorOpen((prev) => prev.map((o, i) => (i === vIdx ? !o : o)))
                                      }
                                    >
                                      <View
                                        style={[
                                          styles.variantColorDot,
                                          { backgroundColor: selectedColorObj?.hex ?? '#ccc' },
                                          !selectedColorObj && styles.variantColorDotEmpty,
                                          selectedColorObj?.hex === '#FFFFFF' && styles.variantColorSwatchWhite,
                                        ]}
                                      />
                                      <Text style={styles.variantColorBtnText} numberOfLines={1}>
                                        {variant.color || 'Color'}
                                      </Text>
                                      <ChevronDown size={12} color={Colors.light.textSecondary} />
                                    </TouchableOpacity>
                                  )}

                                  {/* Delete */}
                                  <TouchableOpacity
                                    style={[styles.variantDeleteBtn, variants.length <= 1 && { opacity: 0.2 }]}
                                    onPress={() => removeVariant(vIdx)}
                                    disabled={variants.length <= 1}
                                  >
                                    <X size={13} color={Colors.light.error} />
                                  </TouchableOpacity>
                                </View>

                                {/* Style dropdown (shows when focused) */}
                                {variantStyleFocused[vIdx] && (
                                  <View style={styles.variantStyleDropdown}>
                                    <ScrollView style={{ maxHeight: 240 }} nestedScrollEnabled showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                                      {vIdx === focusedVariantIdx && catalogResults.length > 0 && (
                                        <>
                                          <Text style={styles.variantDropdownSectionLabel}>Product Catalog</Text>
                                          {catalogResults.map((p) => {
                                            const isCatSelected = variant.productId === p.id;
                                            return (
                                              <TouchableOpacity
                                                key={p.id}
                                                style={[
                                                  styles.variantDropdownItem,
                                                  styles.variantCatalogItem,
                                                  isCatSelected && styles.variantDropdownItemActive,
                                                  styles.variantDropdownItemBorder,
                                                ]}
                                                onPress={() => handleSelectCatalogProduct(vIdx, p)}
                                              >
                                                <Text style={[styles.variantDropdownNum, isCatSelected && styles.variantDropdownNumActive]}>
                                                  {p.styleNumber}
                                                </Text>
                                                <View style={styles.variantCatalogTextWrap}>
                                                  <Text style={[styles.variantDropdownName, isCatSelected && styles.variantDropdownNameActive]} numberOfLines={1}>
                                                    {p.name}
                                                  </Text>
                                                  {!!p.brand && (
                                                    <Text style={styles.variantDropdownBrand} numberOfLines={1}>{p.brand}</Text>
                                                  )}
                                                </View>
                                                <View style={styles.variantCatalogBadge}>
                                                  <Text style={styles.variantCatalogBadgeText}>Catalog</Text>
                                                </View>
                                              </TouchableOpacity>
                                            );
                                          })}
                                        </>
                                      )}
                                      {vIdx === focusedVariantIdx && rawSearch.trim().length >= 2 && (catalogSearch.isFetching || debouncedCatalogTerm.length < 2) && catalogResults.length === 0 && (
                                        <Text style={styles.variantDropdownEmpty}>Searching…</Text>
                                      )}
                                      {vIdx === focusedVariantIdx && rawSearch.trim().length >= 2 && debouncedCatalogTerm.length >= 2 && !catalogSearch.isFetching && catalogResults.length === 0 && (
                                        <Text style={styles.variantDropdownEmpty}>No catalog matches — use custom entry below.</Text>
                                      )}
                                      {rawSearch.trim().length > 0 && (
                                        <TouchableOpacity
                                          style={styles.variantDropdownCustom}
                                          onPress={() => {
                                            const customVal = rawSearch.trim();
                                            markVariantManual(vIdx, customVal);
                                            setVariantSearchTerms((prev) => prev.map((t, i) => (i === vIdx ? customVal : t)));
                                            setVariantStyleFocused((prev) => prev.map((f, i) => (i === vIdx ? false : f)));
                                          }}
                                        >
                                          <Text style={styles.variantDropdownCustomText}>
                                            Use "{rawSearch.trim()}" as custom style
                                          </Text>
                                        </TouchableOpacity>
                                      )}
                                      {rawSearch.trim().length === 0 && (
                                        <Text style={styles.variantDropdownEmpty}>Search our catalog or type a custom style name.</Text>
                                      )}
                                    </ScrollView>
                                  </View>
                                )}

                                {/* Color swatches (shows when color button tapped) */}
                                {variantColorOpen[vIdx] && colorObjects.length > 0 && (
                                  <ScrollView style={styles.variantColorDropdown} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                                    <View style={styles.variantColorGrid}>
                                      {colorObjects.map((color) => (
                                        <TouchableOpacity
                                          key={color.hex + color.name}
                                          style={[
                                            styles.variantColorSwatch,
                                            { backgroundColor: color.hex },
                                            variant.color === color.name && styles.variantColorSwatchSelected,
                                            color.hex === '#FFFFFF' && styles.variantColorSwatchWhite,
                                          ]}
                                          onPress={() => {
                                            updateVariant(vIdx, { color: color.name });
                                            setVariantColorOpen((prev) => prev.map((o, i) => (i === vIdx ? false : o)));
                                          }}
                                          {...(Platform.OS === 'web' ? {
                                            onMouseEnter: () => setVariantHoveredColors(prev => prev.map((c, i) => i === vIdx ? color.name : c)),
                                            onMouseLeave: () => setVariantHoveredColors(prev => prev.map((c, i) => i === vIdx ? null : c)),
                                          } : {})}
                                        >
                                          {variant.color === color.name && (
                                            <CheckCircle size={12} color={color.dark ? '#fff' : '#333'} />
                                          )}
                                        </TouchableOpacity>
                                      ))}
                                    </View>
                                    {variantHoveredColors[vIdx] && (
                                      <Text style={styles.variantHoveredColorLabel}>{variantHoveredColors[vIdx]}</Text>
                                    )}
                                    {/* Custom colorway free-text entry */}
                                    <View style={styles.variantCustomColorRow}>
                                      <TextInput
                                        style={styles.variantCustomColorInput}
                                        value={variantCustomColorText[vIdx] ?? ''}
                                        onChangeText={(v) =>
                                          setVariantCustomColorText((prev) => prev.map((t, i) => (i === vIdx ? v : t)))
                                        }
                                        placeholder="Custom colorway…"
                                        placeholderTextColor={Colors.light.textSecondary}
                                        onSubmitEditing={() => {
                                          const val = (variantCustomColorText[vIdx] ?? '').trim();
                                          if (val) {
                                            updateVariant(vIdx, { color: val });
                                            setVariantCustomColorText((prev) => prev.map((t, i) => (i === vIdx ? '' : t)));
                                            setVariantColorOpen((prev) => prev.map((o, i) => (i === vIdx ? false : o)));
                                          }
                                        }}
                                        returnKeyType="done"
                                      />
                                      <TouchableOpacity
                                        style={[
                                          styles.variantCustomColorConfirm,
                                          !(variantCustomColorText[vIdx] ?? '').trim() && styles.variantCustomColorConfirmDisabled,
                                        ]}
                                        onPress={() => {
                                          const val = (variantCustomColorText[vIdx] ?? '').trim();
                                          if (val) {
                                            updateVariant(vIdx, { color: val });
                                            setVariantCustomColorText((prev) => prev.map((t, i) => (i === vIdx ? '' : t)));
                                            setVariantColorOpen((prev) => prev.map((o, i) => (i === vIdx ? false : o)));
                                          }
                                        }}
                                        disabled={!(variantCustomColorText[vIdx] ?? '').trim()}
                                      >
                                        <Text style={styles.variantCustomColorConfirmText}>Use</Text>
                                      </TouchableOpacity>
                                    </View>
                                  </ScrollView>
                                )}

                                {isCatalogVariant &&
                                  (dbVendorsByProductId[variant.productId as string]?.length ?? 0) > 0 && (
                                    <Text style={styles.variantVendorInfo} numberOfLines={2}>
                                      Available from:{' '}
                                      {dbVendorsByProductId[variant.productId as string]
                                        .map((v) => (v.isPreferred ? `${v.name} ★` : v.name))
                                        .join(', ')}
                                    </Text>
                                  )}
                              </View>
                            );
                          })()}

                          {/* Row D: Size inputs */}
                          <View style={styles.variantSizeSubRow}>
                            {APPAREL_SIZES.map(({ key, label }) => (
                              <View key={key} style={styles.variantSizeLabelCell}>
                                <Text style={styles.variantSizeColLabel}>{label}</Text>
                                <TextInput
                                  style={styles.variantSizeInput}
                                  value={variant.sizes[key] > 0 ? variant.sizes[key].toString() : ''}
                                  onChangeText={(v) => updateVariantSize(vIdx, key, v)}
                                  keyboardType="number-pad"
                                  placeholder=""
                                  placeholderTextColor={Colors.light.textSecondary}
                                  maxLength={3}
                                />
                              </View>
                            ))}
                            <View style={styles.variantTotalLabelCell}>
                              <Text style={styles.variantSizeColLabel}>Total</Text>
                              <Text style={styles.variantRowQty}>{rowQty > 0 ? rowQty : '—'}</Text>
                            </View>
                          </View>
                        </View>
                      );
                    })}

                    {/* Grand Total footer */}
                    <View style={styles.variantGrandTotalRow}>
                      <Text style={styles.variantGrandTotalLabel}>Grand Total</Text>
                      <View style={styles.variantGrandTotalSizesRow}>
                        {APPAREL_SIZES.map(({ key, label }) => {
                          const colTotal = variants.reduce((s, v) => s + (v.sizes[key] || 0), 0);
                          return (
                            <View key={label} style={styles.variantGrandTotalCell}>
                              <Text style={styles.variantGrandTotalSizeLabel}>{label}</Text>
                              <Text style={styles.variantGrandTotalNum}>{colTotal > 0 ? colTotal : ''}</Text>
                            </View>
                          );
                        })}
                        <View style={styles.variantGrandTotalCell}>
                          <Text style={styles.variantGrandTotalSizeLabel}>Total</Text>
                          <Text style={[styles.variantGrandTotalNum, styles.variantGrandTotalBold]}>{quantity}</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                </View>
              )}
            </View>

            {/* ── Embroidery Calculator ── */}
            {isEmbroidery && (
              <View style={styles.embCalcSection}>
                <Text style={styles.embCalcTitle}>Embroidery Cost Calculator</Text>
                <Text style={styles.embCalcSubtitle}>Rate: $2.00 per 1,000 stitches (min 3,000)</Text>

                <Text style={styles.embLocationLabel}>Location #1 {item.location1 ? `(${item.location1})` : ''}</Text>
                <View style={styles.embInputRow}>
                  <View style={styles.embInputGroup}>
                    <Text style={styles.embInputLabel}>Stitch Count</Text>
                    <View style={styles.embInputWrapper}>
                      <TextInput
                        style={styles.embInput}
                        value={embStitchCount1}
                        onChangeText={(text) => handleStitchCountChange(text, setEmbStitchCount1)}
                        keyboardType="number-pad"
                        placeholder="e.g. 5000"
                        placeholderTextColor={Colors.light.textSecondary}
                        maxLength={5}
                      />
                      {embStitchCount1 !== '' ? <Text style={styles.embInputSuffix}>stitches</Text> : null}
                    </View>
                  </View>
                  <View style={styles.embCostDisplay}>
                    <Text style={styles.embCostLabel}>Cost</Text>
                    <Text style={styles.embCostValue}>${embCost1.toFixed(2)}</Text>
                  </View>
                </View>
                {embStitchCount1Num > 0 && embStitchCount1Num < EMB_MIN_STITCHES && (
                  <Text style={styles.embMinNote}>Below minimum of 3,000 stitches</Text>
                )}

                {hasSecondLocation && (
                  <>
                    <View style={styles.embLocationDivider} />
                    <Text style={styles.embLocationLabel}>Location #2 ({item.location2})</Text>
                    <View style={styles.embInputRow}>
                      <View style={styles.embInputGroup}>
                        <Text style={styles.embInputLabel}>Stitch Count</Text>
                        <View style={styles.embInputWrapper}>
                          <TextInput
                            style={styles.embInput}
                            value={embStitchCount2}
                            onChangeText={(text) => handleStitchCountChange(text, setEmbStitchCount2)}
                            keyboardType="number-pad"
                            placeholder="e.g. 5000"
                            placeholderTextColor={Colors.light.textSecondary}
                            maxLength={5}
                          />
                          {embStitchCount2 !== '' ? <Text style={styles.embInputSuffix}>stitches</Text> : null}
                        </View>
                      </View>
                      <View style={styles.embCostDisplay}>
                        <Text style={styles.embCostLabel}>Cost</Text>
                        <Text style={styles.embCostValue}>${embCost2.toFixed(2)}</Text>
                      </View>
                    </View>
                    {embStitchCount2Num > 0 && embStitchCount2Num < EMB_MIN_STITCHES && (
                      <Text style={styles.embMinNote}>Below minimum of 3,000 stitches</Text>
                    )}
                  </>
                )}

                <View style={styles.embDigitizationRow}>
                  <TouchableOpacity
                    style={styles.embCheckbox}
                    onPress={() => setIncludeDigitization(!includeDigitization)}
                  >
                    <View style={[styles.embCheckboxBox, includeDigitization && styles.embCheckboxChecked]}>
                      {includeDigitization ? <Text style={styles.embCheckmark}>✓</Text> : null}
                    </View>
                    <Text style={styles.embCheckboxLabel}>Include Digitization Fee (+$50.00)</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.embResultRow}>
                  <View style={styles.embResultInfo}>
                    <Text style={styles.embResultLabel}>Service Total: </Text>
                    <Text style={styles.embResultValue}>${embTotalCost.toFixed(2)}</Text>
                    {includeDigitization && (
                      <Text style={styles.embDigitizationNote}> + $50 digitization</Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={[styles.embApplyButton, embTotalCost === 0 && styles.embApplyButtonDisabled]}
                    onPress={applyEmbroideryCost}
                    disabled={embTotalCost === 0}
                  >
                    <Text style={styles.embApplyText}>Apply</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ── Costs (Per Piece) ── */}
            <View style={styles.costsSection}>
              <Text style={styles.costsTitle}>
                <Text>COSTS (Per Piece)  </Text>
                <Text style={styles.costsNote}>*Fees = flat per line item</Text>
              </Text>

              {isDTF && (
                <View style={styles.dtfCalcSection}>
                  <Text style={styles.dtfCalcTitle}>DTF Cost Calculator</Text>

                  <Text style={styles.dtfLocationLabel}>Location #1 {item.location1 ? `(${item.location1})` : ''}</Text>
                  {isMobile ? (
                    <>
                      <View style={styles.dtfCalcRowMobile}>
                        <View style={styles.dtfInputGroup}>
                          <Text style={styles.dtfInputLabel}>Width</Text>
                          <View style={styles.dtfInputWrapper}>
                            <TextInput style={styles.dtfInput} value={dtfWidth1} onChangeText={t => setDtfWidth1(formatDecimalInput(t))} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={Colors.light.textSecondary} />
                            {dtfWidth1 !== '' ? <Text style={styles.dtfInputSuffix}>in</Text> : null}
                          </View>
                        </View>
                        <Text style={styles.dtfOperatorCenter}>×</Text>
                        <View style={styles.dtfInputGroup}>
                          <Text style={styles.dtfInputLabel}>Height</Text>
                          <View style={styles.dtfInputWrapper}>
                            <TextInput style={styles.dtfInput} value={dtfHeight1} onChangeText={t => setDtfHeight1(formatDecimalInput(t))} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={Colors.light.textSecondary} />
                            {dtfHeight1 !== '' ? <Text style={styles.dtfInputSuffix}>in</Text> : null}
                          </View>
                        </View>
                      </View>
                      <View style={[styles.dtfCalcRowMobile, { marginTop: 6 }]}>
                        <Text style={styles.dtfRateLabel}>Rate: $</Text>
                        <View style={[styles.dtfInputWrapper, { flex: 1 }]}>
                          <TextInput style={styles.dtfRateInputInline} value={dtfRate} onChangeText={t => setDtfRate(formatDecimalInput(t))} keyboardType="decimal-pad" placeholder="0.03" placeholderTextColor={Colors.light.textSecondary} />
                        </View>
                        <Text style={styles.dtfRateLabel}>/sq in</Text>
                      </View>
                    </>
                  ) : (
                    <View style={styles.dtfCalcRow}>
                      <View style={styles.dtfInputGroup}>
                        <Text style={styles.dtfInputLabel}>Width</Text>
                        <View style={styles.dtfInputWrapper}>
                          <TextInput style={styles.dtfInput} value={dtfWidth1} onChangeText={t => setDtfWidth1(formatDecimalInput(t))} keyboardType="decimal-pad" placeholder="0.00 in" placeholderTextColor={Colors.light.textSecondary} />
                          {dtfWidth1 !== '' ? <Text style={styles.dtfInputSuffix}>in</Text> : null}
                        </View>
                      </View>
                      <Text style={styles.dtfOperator}>x</Text>
                      <View style={styles.dtfInputGroup}>
                        <Text style={styles.dtfInputLabel}>Height</Text>
                        <View style={styles.dtfInputWrapper}>
                          <TextInput style={styles.dtfInput} value={dtfHeight1} onChangeText={t => setDtfHeight1(formatDecimalInput(t))} keyboardType="decimal-pad" placeholder="0.00 in" placeholderTextColor={Colors.light.textSecondary} />
                          {dtfHeight1 !== '' ? <Text style={styles.dtfInputSuffix}>in</Text> : null}
                        </View>
                      </View>
                      <Text style={styles.dtfOperator}>x</Text>
                      <View style={styles.dtfInputGroup}>
                        <Text style={styles.dtfInputLabel}>Rate</Text>
                        <View style={styles.dtfInputWrapper}>
                          <Text style={styles.dtfDollar}>$</Text>
                          <TextInput style={styles.dtfRateInputInline} value={dtfRate} onChangeText={t => setDtfRate(formatDecimalInput(t))} keyboardType="decimal-pad" placeholder="0.03" placeholderTextColor={Colors.light.textSecondary} />
                        </View>
                      </View>
                    </View>
                  )}
                  <View style={styles.dtfResultRowInline}>
                    <Text style={styles.dtfResultLabel}>
                      {dtfSquareInches1.toFixed(2)} sq in = ${dtfCalculatedCost1.toFixed(2)}
                    </Text>
                  </View>

                  {hasSecondLocation && (
                    <>
                      <View style={styles.dtfLocationDivider} />
                      <Text style={styles.dtfLocationLabel}>Location #2 ({item.location2})</Text>
                      {isMobile ? (
                        <>
                          <View style={styles.dtfCalcRowMobile}>
                            <View style={styles.dtfInputGroup}>
                              <Text style={styles.dtfInputLabel}>Width</Text>
                              <View style={styles.dtfInputWrapper}>
                                <TextInput style={styles.dtfInput} value={dtfWidth2} onChangeText={t => setDtfWidth2(formatDecimalInput(t))} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={Colors.light.textSecondary} />
                                {dtfWidth2 !== '' ? <Text style={styles.dtfInputSuffix}>in</Text> : null}
                              </View>
                            </View>
                            <Text style={styles.dtfOperatorCenter}>×</Text>
                            <View style={styles.dtfInputGroup}>
                              <Text style={styles.dtfInputLabel}>Height</Text>
                              <View style={styles.dtfInputWrapper}>
                                <TextInput style={styles.dtfInput} value={dtfHeight2} onChangeText={t => setDtfHeight2(formatDecimalInput(t))} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={Colors.light.textSecondary} />
                                {dtfHeight2 !== '' ? <Text style={styles.dtfInputSuffix}>in</Text> : null}
                              </View>
                            </View>
                          </View>
                          <View style={[styles.dtfCalcRowMobile, { marginTop: 6 }]}>
                            <Text style={styles.dtfRateLabel}>Rate: $</Text>
                            <View style={[styles.dtfInputWrapper, { flex: 1 }]}>
                              <TextInput style={styles.dtfRateInputInline} value={dtfRate} editable={false} keyboardType="decimal-pad" placeholder="0.03" placeholderTextColor={Colors.light.textSecondary} />
                            </View>
                            <Text style={styles.dtfRateLabel}>/sq in</Text>
                          </View>
                        </>
                      ) : (
                        <View style={styles.dtfCalcRow}>
                          <View style={styles.dtfInputGroup}>
                            <Text style={styles.dtfInputLabel}>Width</Text>
                            <View style={styles.dtfInputWrapper}>
                              <TextInput style={styles.dtfInput} value={dtfWidth2} onChangeText={t => setDtfWidth2(formatDecimalInput(t))} keyboardType="decimal-pad" placeholder="0.00 in" placeholderTextColor={Colors.light.textSecondary} />
                              {dtfWidth2 !== '' ? <Text style={styles.dtfInputSuffix}>in</Text> : null}
                            </View>
                          </View>
                          <Text style={styles.dtfOperator}>x</Text>
                          <View style={styles.dtfInputGroup}>
                            <Text style={styles.dtfInputLabel}>Height</Text>
                            <View style={styles.dtfInputWrapper}>
                              <TextInput style={styles.dtfInput} value={dtfHeight2} onChangeText={t => setDtfHeight2(formatDecimalInput(t))} keyboardType="decimal-pad" placeholder="0.00 in" placeholderTextColor={Colors.light.textSecondary} />
                              {dtfHeight2 !== '' ? <Text style={styles.dtfInputSuffix}>in</Text> : null}
                            </View>
                          </View>
                          <Text style={styles.dtfOperator}>x</Text>
                          <View style={styles.dtfInputGroup}>
                            <Text style={styles.dtfInputLabel}>Rate</Text>
                            <View style={styles.dtfInputWrapper}>
                              <Text style={styles.dtfDollar}>$</Text>
                              <TextInput style={styles.dtfRateInputInline} value={dtfRate} editable={false} keyboardType="decimal-pad" placeholder="0.03" placeholderTextColor={Colors.light.textSecondary} />
                            </View>
                          </View>
                        </View>
                      )}
                      <View style={styles.dtfResultRowInline}>
                        <Text style={styles.dtfResultLabel}>
                          {dtfSquareInches2.toFixed(2)} sq in = ${dtfCalculatedCost2.toFixed(2)}
                        </Text>
                      </View>
                    </>
                  )}

                  <View style={styles.dtfResultRow}>
                    <View style={styles.dtfResultInfo}>
                      <Text style={styles.dtfResultLabel}>Total: </Text>
                      <Text style={styles.dtfResultValue}>${dtfTotalCalculatedCost.toFixed(2)}</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.dtfApplyButton, dtfTotalCalculatedCost === 0 && styles.dtfApplyButtonDisabled]}
                      onPress={applyDTFCost}
                      disabled={dtfTotalCalculatedCost === 0}
                    >
                      <Text style={styles.dtfApplyText}>Apply</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <View style={[styles.costsRow, isMobile && styles.costsRowMobile]}>
                <View style={[styles.costField, isMobile && styles.costFieldMobile]}>
                  <CurrencyInput label="Product" value={item.productCostEach} onChange={(v) => onChange({ ...item, productCostEach: v })} />
                </View>
                <View style={[styles.costField, isMobile && styles.costFieldMobile]}>
                  <CurrencyInput label="Service" value={item.serviceCostEach} onChange={(v) => onChange({ ...item, serviceCostEach: v })} />
                </View>
                <View style={[styles.costField, isMobile && styles.costFieldMobile]}>
                  <CurrencyInput label="Fees*" value={item.serviceFeeEach} onChange={(v) => onChange({ ...item, serviceFeeEach: v })} />
                </View>
                <View style={[styles.costField, isMobile && styles.costFieldMobile]}>
                  <CurrencyInput label="Markup" value={item.markupEach || 0} onChange={(v) => onChange({ ...item, markupEach: v })} />
                </View>
              </View>

              {/* Subtotal */}
              <View style={styles.subtotalSection}>
                <View style={styles.subtotalHeader}>
                  <Text style={styles.subtotalTitle}>LINE ITEM SUBTOTAL</Text>
                </View>
                <View style={styles.subtotalContent}>
                  <View style={styles.tableHeader}>
                    <Text style={styles.tableHeaderCell} />
                    <Text style={styles.tableHeaderCellRight}>Each</Text>
                    <Text style={styles.tableHeaderCellRight}>Total</Text>
                  </View>
                  <View style={styles.tableRow}>
                    <Text style={styles.tableCell}>Cost of Goods</Text>
                    <Text style={styles.tableCellRight}>
                      {formatCurrency(lineItemCalcs.quantity > 0 ? lineItemCalcs.cogTotal / lineItemCalcs.quantity : 0)}
                    </Text>
                    <Text style={styles.tableCellRight}>{formatCurrency(lineItemCalcs.cogTotal)}</Text>
                  </View>
                  <View style={styles.tableRow}>
                    <Text style={styles.tableCell}>Fees</Text>
                    <Text style={styles.tableCellRight}>
                      {formatCurrency(lineItemCalcs.quantity > 0 ? lineItemCalcs.serviceFeeTotal / lineItemCalcs.quantity : 0)}
                    </Text>
                    <Text style={styles.tableCellRight}>{formatCurrency(lineItemCalcs.serviceFeeTotal)}</Text>
                  </View>
                  <View style={styles.tableRow}>
                    <Text style={styles.tableCell}>Markup</Text>
                    <Text style={styles.tableCellRight}>{formatCurrency(item.markupEach || 0)}</Text>
                    <Text style={styles.tableCellRight}>{formatCurrency(lineItemCalcs.markupTotal)}</Text>
                  </View>
                  <View style={styles.subtotalDivider} />
                  <View style={styles.subtotalTableRow}>
                    <Text style={styles.subtotalTotalLabel}>Subtotal ({lineItemCalcs.quantity} pcs)</Text>
                    <Text style={styles.subtotalTableCellRight}>{formatCurrency(lineItemCalcs.perPiece)}</Text>
                    <Text style={styles.subtotalTableCellRightBold}>{formatCurrency(lineItemCalcs.subtotal)}</Text>
                  </View>
                </View>
              </View>
            </View>

          </View>{/* closes formFieldsSection */}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginBottom: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#000000',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  indexBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.light.tint,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  indexText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#fff',
  },
  title: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#fff',
    maxWidth: 220,
  },
  subtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deleteBtn: {
    padding: 4,
  },
  headerThumbnail: {
    width: 40,
    height: 40,
    borderRadius: 6,
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  content: {
    padding: 14,
  },
  contentWeb: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 16,
  },
  contentMobile: {
    padding: 10,
  },
  mockupPanel: {
    marginBottom: 14,
  },
  mockupPanelWeb: {
    width: 280,
    flexShrink: 0,
    marginBottom: 0,
  },
  mockupPanelMobile: {
    marginBottom: 16,
    width: '100%' as any,
  },
  mockupLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.light.textSecondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
    marginBottom: 8,
  },
  mockupImageContainer: {
    borderRadius: 10,
    overflow: 'hidden' as const,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.background,
  },
  mockupImage: {
    width: '100%' as any,
    height: 200,
    backgroundColor: Colors.light.background,
  },
  mockupActions: {
    flexDirection: 'row' as const,
    gap: 6,
    padding: 8,
    backgroundColor: Colors.light.surface,
  },
  mockupChangeBtn: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 4,
    backgroundColor: Colors.light.tint,
    paddingVertical: 7,
    borderRadius: 6,
  },
  mockupChangeBtnText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#fff',
  },
  mockupRemoveBtn: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 4,
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  mockupRemoveBtnText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.light.error,
  },
  mockupDesignBtn: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 4,
    backgroundColor: '#0D1B2A',
    paddingVertical: 7,
    borderRadius: 6,
  },
  mockupPlaceholderContainer: {
    borderWidth: 2,
    borderStyle: 'dashed' as const,
    borderColor: Colors.light.border,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: Colors.light.background,
    gap: 10,
  },
  mockupDesignBtnLarge: {
    alignItems: 'center' as const,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Colors.light.tint,
    backgroundColor: '#FFF8F5',
    gap: 4,
  },
  mockupDesignBtnTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.light.tint,
  },
  mockupDesignBtnSub: {
    fontSize: 10,
    color: Colors.light.textSecondary,
    textAlign: 'center' as const,
  },
  mockupDivider: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  mockupDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.light.border,
  },
  mockupDividerText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  mockupUploadBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.surface,
  },
  mockupUploadBtnText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    fontWeight: '500' as const,
  },
  formFieldsSection: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  rowMobile: {
    flexDirection: 'column',
    gap: 0,
  },
  halfField: {
    flex: 1,
  },
  // ── Service Style mobile dropdown ──
  serviceDropdownWrap: {
    gap: 4,
    marginBottom: 2,
  },
  serviceDropdownLabel: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.light.textSecondary,
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
  },
  serviceDropdownBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  serviceDropdownValue: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.text,
    flex: 1,
  },
  serviceDropdownList: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    overflow: 'hidden' as const,
    backgroundColor: Colors.light.surface,
  },
  serviceDropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  serviceDropdownItemActive: {
    backgroundColor: Colors.light.tint + '12',
  },
  serviceDropdownItemText: {
    fontSize: 14,
    color: Colors.light.text,
  },
  serviceDropdownItemTextActive: {
    color: Colors.light.tint,
    fontWeight: '700' as const,
  },
  // Location expand button
  addLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    marginBottom: 10,
  },
  addLocationBtnText: {
    fontSize: 12,
    color: Colors.light.tint,
    fontWeight: '600' as const,
  },
  // ── Garment Variants ──
  variantSection: {
    marginBottom: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    overflow: 'hidden',
  },
  variantHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  variantHeaderTitle: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#fff',
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
  },
  addVariantBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  addVariantBtnText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#fff',
  },
  variantTableWrap: {
    backgroundColor: Colors.light.background,
  },
  variantTable: {
    width: '100%' as any,
  },
  variantRow: {
    flexDirection: 'column',
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    backgroundColor: Colors.light.background,
  },
  variantRowAlt: {
    backgroundColor: '#fafafa',
  },
  variantTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 4,
  },
  variantPickerSection: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 8,
  },
  variantPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  variantTypeSelectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 34,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    gap: 4,
    minWidth: 90,
  },
  variantTypeBtnText: {
    fontSize: 12,
    color: Colors.light.text,
    fontWeight: '500' as const,
    flex: 1,
  },
  variantStyleInput: {
    flex: 1,
    height: 34,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: 10,
    fontSize: 12,
    color: Colors.light.text,
    backgroundColor: '#fff',
    minWidth: 0,
  },
  variantColorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 34,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    gap: 5,
    minWidth: 90,
    maxWidth: 130,
  },
  variantColorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    flexShrink: 0,
  },
  variantColorDotEmpty: {
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  variantColorBtnText: {
    flex: 1,
    fontSize: 12,
    color: Colors.light.text,
  },
  variantStyleDropdown: {
    marginTop: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: '#fff',
    overflow: 'hidden' as const,
  },
  variantDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 8,
  },
  variantDropdownItemActive: {
    backgroundColor: '#FFF0E8',
  },
  variantDropdownItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  variantDropdownNum: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.light.tint,
    minWidth: 48,
  },
  variantDropdownNumActive: {
    color: Colors.light.tint,
  },
  variantDropdownName: {
    flex: 1,
    fontSize: 11,
    color: Colors.light.textSecondary,
  },
  variantDropdownNameActive: {
    color: Colors.light.text,
  },
  variantDropdownEmpty: {
    padding: 10,
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  variantDropdownSectionLabel: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 4,
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
    color: Colors.light.textSecondary,
    backgroundColor: '#F7F7F7',
  },
  variantCatalogItem: {
    alignItems: 'center',
  },
  variantCatalogTextWrap: {
    flex: 1,
    marginLeft: 6,
  },
  variantDropdownBrand: {
    fontSize: 10,
    color: Colors.light.textSecondary,
  },
  variantCatalogBadge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: Colors.light.tint,
  },
  variantCatalogBadgeText: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: '#fff',
  },
  variantVendorInfo: {
    marginTop: 4,
    paddingHorizontal: 2,
    fontSize: 10,
    fontStyle: 'italic' as const,
    color: Colors.light.textSecondary,
  },
  variantDropdownCustom: {
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    backgroundColor: '#FFF8F5',
  },
  variantDropdownCustomText: {
    fontSize: 11,
    color: Colors.light.tint,
    fontWeight: '600' as const,
    fontStyle: 'italic' as const,
  },
  variantColorFreeInput: {
    height: 34,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    fontSize: 12,
    color: Colors.light.text,
    minWidth: 90,
    maxWidth: 130,
  },
  variantColorDropdown: {
    marginTop: 6,
    maxHeight: 120,
  },
  variantStyleList: {
    gap: 4,
  },
  variantStyleBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: '#fff',
  },
  variantStyleBtnActive: {
    backgroundColor: '#FFF0E8',
    borderColor: Colors.light.tint,
  },
  variantStyleNumber: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.light.tint,
  },
  variantStyleNumberActive: {
    color: Colors.light.tint,
  },
  variantStyleName: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    lineHeight: 14,
    marginTop: 1,
  },
  variantStyleNameActive: {
    color: Colors.light.text,
  },
  variantColorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    padding: 8,
  },
  variantColorSwatch: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  variantColorSwatchWhite: {
    borderWidth: 1,
    borderColor: '#ddd',
  },
  variantColorSwatchSelected: {
    borderWidth: 2.5,
    borderColor: Colors.light.tint,
  },
  variantColorLabel: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginTop: 4,
  },
  variantHoveredColorLabel: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginTop: 6,
    textAlign: 'right',
    paddingHorizontal: 4,
  },
  variantCustomColorRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 4,
    paddingBottom: 4,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    paddingTop: 8,
  },
  variantCustomColorInput: {
    flex: 1,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 12,
    color: Colors.light.text,
  },
  variantCustomColorConfirm: {
    backgroundColor: Colors.light.tint,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  variantCustomColorConfirmDisabled: {
    backgroundColor: Colors.light.border,
  },
  variantCustomColorConfirmText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#fff',
  },
  variantDeleteBtn: {
    width: 28,
    height: 28,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexShrink: 0,
  },
  variantSizeSubRow: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingBottom: 8,
    gap: 4,
  },
  variantSizeLabelCell: {
    flex: 1,
    alignItems: 'center' as const,
  },
  variantSizeColLabel: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.3,
    marginBottom: 3,
  },
  variantTotalLabelCell: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'flex-end' as const,
  },
  variantSizeInput: {
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 4,
    width: '100%' as any,
    height: 32,
    textAlign: 'center',
    fontSize: 13,
    color: Colors.light.text,
  },
  variantRowQty: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.light.tint,
    textAlign: 'center' as const,
    paddingTop: 6,
  },
  variantGrandTotalRow: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  variantGrandTotalLabel: {
    fontSize: 10,
    fontWeight: '800' as const,
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  variantGrandTotalSizesRow: {
    flexDirection: 'row',
    gap: 4,
  },
  variantGrandTotalCell: {
    flex: 1,
    alignItems: 'center' as const,
  },
  variantGrandTotalSizeLabel: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.3,
    marginBottom: 3,
    textAlign: 'center' as const,
  },
  variantGrandTotalNum: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#fff',
    textAlign: 'center' as const,
  },
  variantGrandTotalBold: {
    color: Colors.light.tint,
    fontSize: 15,
    fontWeight: '800' as const,
  },
  // Promotional
  promotionalQty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: Colors.light.background,
  },
  promotionalQtyLabel: {
    fontSize: 14,
    color: Colors.light.text,
    flex: 1,
  },
  promotionalQtyInput: {
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 6,
    width: 80,
    height: 40,
    textAlign: 'center',
    fontSize: 16,
    color: Colors.light.text,
  },
  // ── Costs ──
  costsSection: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  costsTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.text,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  costsNote: {
    fontSize: 10,
    fontWeight: '400' as const,
    color: Colors.light.textSecondary,
    fontStyle: 'italic' as const,
  },
  costsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  costsRowMobile: {
    flexWrap: 'wrap',
  },
  costField: {
    flex: 1,
  },
  costFieldMobile: {
    flexBasis: '47%',
    flexGrow: 1,
  },
  // DTF
  dtfCalcSection: {
    backgroundColor: Colors.light.highlightBg,
    borderRadius: 10,
    padding: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.light.tint,
  },
  dtfCalcTitle: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.light.tint,
    marginBottom: 6,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  dtfLocationLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.light.text,
    marginBottom: 4,
    marginTop: 2,
  },
  dtfLocationDivider: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginVertical: 10,
  },
  dtfCalcRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
    gap: 6,
  },
  dtfCalcRowMobile: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  dtfOperatorCenter: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
  },
  dtfRateLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
  },
  dtfInputGroup: {
    flex: 1,
  },
  dtfInputLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase' as const,
  },
  dtfInputWrapper: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 6,
    paddingHorizontal: 6,
    height: 32,
  },
  dtfInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.text,
    textAlign: 'center' as const,
    paddingVertical: 0,
  },
  dtfInputSuffix: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.light.textSecondary,
    marginLeft: 2,
  },
  dtfOperator: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
    paddingBottom: 14,
  },
  dtfDollar: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
  },
  dtfRateInputInline: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.text,
    textAlign: 'center' as const,
    paddingVertical: 0,
  },
  dtfResultRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  dtfResultRowInline: {
    marginTop: 6,
  },
  dtfResultInfo: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  dtfResultLabel: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  dtfResultValue: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.light.tint,
  },
  dtfApplyButton: {
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  dtfApplyButtonDisabled: {
    backgroundColor: Colors.light.border,
  },
  dtfApplyText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#fff',
  },
  // Subtotal
  subtotalSection: {
    marginTop: 16,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.light.tint,
  },
  subtotalHeader: {
    backgroundColor: Colors.light.tint,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  subtotalTitle: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#fff',
    letterSpacing: 0.5,
  },
  subtotalContent: {
    backgroundColor: Colors.light.highlightBg,
    padding: 12,
  },
  tableHeader: {
    flexDirection: 'row' as const,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    marginBottom: 4,
  },
  tableHeaderCell: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase' as const,
  },
  tableHeaderCellRight: {
    width: 70,
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
    textAlign: 'right' as const,
    textTransform: 'uppercase' as const,
  },
  tableRow: {
    flexDirection: 'row' as const,
    paddingVertical: 5,
  },
  tableCell: {
    flex: 1,
    fontSize: 13,
    color: Colors.light.text,
  },
  tableCellRight: {
    width: 70,
    fontSize: 13,
    color: Colors.light.text,
    textAlign: 'right' as const,
  },
  subtotalDivider: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginVertical: 8,
  },
  subtotalTableRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 4,
  },
  subtotalTotalLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  subtotalTableCellRight: {
    width: 70,
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.text,
    textAlign: 'right' as const,
  },
  subtotalTableCellRightBold: {
    width: 70,
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.light.tint,
    textAlign: 'right' as const,
  },
  // Embroidery
  embCalcSection: {
    backgroundColor: Colors.light.highlightBg,
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: Colors.light.tint,
  },
  embCalcTitle: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.light.tint,
    marginBottom: 2,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  embCalcSubtitle: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginBottom: 10,
  },
  embLocationLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.light.text,
    marginBottom: 6,
    marginTop: 4,
  },
  embLocationDivider: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginVertical: 10,
  },
  embInputRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
    gap: 12,
  },
  embInputGroup: {
    flex: 1,
  },
  embInputLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase' as const,
  },
  embInputWrapper: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 6,
    paddingHorizontal: 10,
    height: 42,
  },
  embInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.light.text,
    paddingVertical: 0,
  },
  embInputSuffix: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: Colors.light.textSecondary,
    marginLeft: 4,
  },
  embCostDisplay: {
    alignItems: 'center' as const,
    minWidth: 70,
  },
  embCostLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase' as const,
  },
  embCostValue: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.light.tint,
  },
  embMinNote: {
    fontSize: 10,
    color: Colors.light.tint,
    fontStyle: 'italic' as const,
    marginTop: 4,
  },
  embDigitizationRow: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  embCheckbox: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  embCheckboxBox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: Colors.light.tint,
    borderRadius: 4,
    marginRight: 8,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  embCheckboxChecked: {
    backgroundColor: Colors.light.tint,
  },
  embCheckmark: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700' as const,
  },
  embCheckboxLabel: {
    fontSize: 13,
    color: Colors.light.text,
  },
  embResultRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  embResultInfo: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    flexWrap: 'wrap' as const,
    flex: 1,
  },
  embResultLabel: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  embResultValue: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.light.tint,
  },
  embDigitizationNote: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  embApplyButton: {
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  embApplyButtonDisabled: {
    backgroundColor: Colors.light.border,
  },
  embApplyText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#fff',
  },

  // Variant Picker Modal
  vpOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  vpPanel: {
    position: 'absolute',
    top: '50%' as any,
    left: '50%' as any,
    transform: [{ translateX: '-50%' as any }, { translateY: '-50%' as any }],
    width: 320,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    gap: 2,
  },
  vpTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111',
    marginBottom: 12,
  },
  vpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginBottom: 8,
  },
  vpProduct: { fontSize: 13, fontWeight: '600', color: '#111' },
  vpColor: { fontSize: 11, color: Colors.light.textSecondary, marginTop: 2 },
  vpCancel: {
    marginTop: 4,
    paddingVertical: 10,
    alignItems: 'center',
  },
  vpCancelText: { fontSize: 13, color: Colors.light.textSecondary, fontWeight: '600' },

  // Sync Prompt Modal
  syncPanel: {
    position: 'absolute',
    top: '50%' as any,
    left: '50%' as any,
    transform: [{ translateX: '-50%' as any }, { translateY: '-50%' as any }],
    width: 320,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    gap: 10,
  },
  syncTitle: { fontSize: 15, fontWeight: '700', color: '#111' },
  syncBody: { fontSize: 13, color: Colors.light.textSecondary, lineHeight: 19 },
  syncBtnPrimary: {
    backgroundColor: Colors.light.tint,
    borderRadius: 8,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  syncBtnPrimaryText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  syncBtnSecondary: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncBtnSecondaryText: { fontSize: 13, fontWeight: '600', color: '#374151' },
});
