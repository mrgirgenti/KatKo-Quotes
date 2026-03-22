import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Platform,
  Image,
  ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ChevronDown, ChevronUp, Trash2, Upload, RefreshCw, X, Brush, Plus, CheckCircle } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { MockupDesigner } from './MockupDesigner/MockupDesigner';
import { VENDOR_CATALOG, ProductColor } from './MockupDesigner/vendorCatalog';
import { GARMENTS, GarmentType } from './MockupDesigner/garmentData';
import {
  LineItem,
  GarmentVariant,
  SERVICE_STYLES,
  EMPTY_SIZES,
  PRODUCTS,
  PRODUCT_COLORS,
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

interface LineItemCardProps {
  item: LineItem;
  index: number;
  onChange: (item: LineItem) => void;
  onDelete: () => void;
}

const APPAREL_SIZES = SIZE_LABELS.filter((s) => s.key !== 'flat');

function normalizeVendorName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getVendorForProvider(apparelProvider: string) {
  if (!apparelProvider) return undefined;
  const norm = normalizeVendorName(apparelProvider);
  return VENDOR_CATALOG.find((v) => normalizeVendorName(v.name) === norm);
}

function getStyleOptionsForProvider(apparelProvider: string): string[] {
  const vendor = getVendorForProvider(apparelProvider);
  if (vendor) {
    return vendor.styles.map((s) => `${s.styleNumber} — ${s.name}`);
  }
  const seen = new Set<string>();
  const all: string[] = [];
  for (const v of VENDOR_CATALOG) {
    for (const s of v.styles) {
      const label = `${s.styleNumber} — ${s.name}`;
      if (!seen.has(label)) { seen.add(label); all.push(label); }
    }
  }
  return all;
}

function getColorOptionsForStyle(apparelProvider: string, productValue: string): string[] {
  const vendor = getVendorForProvider(apparelProvider);
  if (!vendor) return [...(PRODUCT_COLORS as unknown as string[])];
  const styleNumber = productValue.split(' — ')[0].trim();
  const style = vendor.styles.find((s) => s.styleNumber === styleNumber);
  if (!style) return vendor.styles[0]?.colors.map((c) => c.name) ?? [...(PRODUCT_COLORS as unknown as string[])];
  return style.colors.map((c) => c.name);
}

const ALL_GARMENT_TYPES: GarmentType[] = ['tshirt', 'hoodie', 'crewneck', 'longsleeve', 'hat'];
const ALL_CATALOG_STYLES = Array.from(
  new Map(VENDOR_CATALOG.flatMap((v) => v.styles).map((s) => [s.styleNumber, s])).values()
);

function getStyleObjectForProduct(apparelProvider: string, productValue: string) {
  if (!productValue) return null;
  const styleNumber = productValue.split(' — ')[0].trim();
  const vendor = getVendorForProvider(apparelProvider);
  const styles = vendor ? vendor.styles : ALL_CATALOG_STYLES;
  return styles.find((s) => s.styleNumber === styleNumber) ?? null;
}

function getGarmentTypesForProvider(apparelProvider: string): GarmentType[] {
  const vendor = getVendorForProvider(apparelProvider);
  const styles = vendor ? vendor.styles : ALL_CATALOG_STYLES;
  const available = new Set(styles.map((s) => s.garmentType));
  return ALL_GARMENT_TYPES.filter((t) => available.has(t));
}

function getStylesForTypeAndProvider(apparelProvider: string, garmentType: GarmentType) {
  const vendor = getVendorForProvider(apparelProvider);
  const styles = vendor ? vendor.styles : ALL_CATALOG_STYLES;
  return styles.filter((s) => s.garmentType === garmentType);
}

function getColorObjectsForStyle(apparelProvider: string, productValue: string): ProductColor[] {
  const style = getStyleObjectForProduct(apparelProvider, productValue);
  if (!style) return [];
  return style.colors;
}

function getStyleObjectForProductFallback(productValue: string) {
  if (!productValue) return null;
  const styleNumber = productValue.split(' — ')[0].trim();
  return ALL_CATALOG_STYLES.find((s) => s.styleNumber === styleNumber) ?? null;
}

function getGarmentTypeFromProduct(apparelProvider: string, productValue: string): GarmentType | null {
  const style = getStyleObjectForProduct(apparelProvider, productValue);
  return style ? style.garmentType : null;
}

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

export function LineItemCard({ item, index, onChange, onDelete }: LineItemCardProps) {
  const [expanded, setExpanded] = useState(true);
  const [showDesigner, setShowDesigner] = useState(false);
  const [showLocation34, setShowLocation34] = useState(!!(item.location3 || item.location4));

  const [dtfWidth1, setDtfWidth1] = useState('');
  const [dtfHeight1, setDtfHeight1] = useState('');
  const [dtfWidth2, setDtfWidth2] = useState('');
  const [dtfHeight2, setDtfHeight2] = useState('');
  const [dtfRate, setDtfRate] = useState('0.04');
  const [embStitchCount1, setEmbStitchCount1] = useState('');
  const [embStitchCount2, setEmbStitchCount2] = useState('');
  const [includeDigitization, setIncludeDigitization] = useState(false);

  const { isMobile } = useBreakpoint();
  const useSideBySide = Platform.OS === 'web' && !isMobile;

  const isPromotional = item.serviceStyle === 'Promotional';
  const isDTF = item.serviceStyle === 'Direct to Film';
  const isEmbroidery = item.serviceStyle === 'Embroidery';
  const hasSecondLocation = !!(item.location2 && item.location2.length > 0);
  const quantity = getTotalQuantity(item.sizes, isPromotional);
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
    const vts = getInitialVariants();
    return vts.map((v) => getGarmentTypeFromProduct(item.apparelProvider, v.product) ?? 'tshirt');
  };
  const [variantGarmentTypes, setVariantGarmentTypes] = useState<GarmentType[]>(getInitialGarmentTypes);

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
    updateVariant(vIdx, { product: '', color: '' });
  };

  const addVariant = () => {
    if (variants.length >= 10) return;
    handleVariantsChange([...variants, { product: '', color: '', sizes: { ...EMPTY_SIZES } }]);
    setVariantGarmentTypes((prev) => [...prev, 'tshirt']);
  };

  const removeVariant = (idx: number) => {
    if (variants.length <= 1) return;
    handleVariantsChange(variants.filter((_, i) => i !== idx));
    setVariantGarmentTypes((prev) => prev.filter((_, i) => i !== idx));
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
      const updates: Partial<LineItem> = { serviceCostEach: embTotalCost };
      if (includeDigitization) updates.serviceFeeEach = DIGITIZATION_FEE;
      onChange({ ...item, ...updates });
    }
  };

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
                  <TouchableOpacity style={styles.mockupDesignBtn} onPress={() => setShowDesigner(true)}>
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
              <View style={styles.mockupPlaceholderContainer}>
                <TouchableOpacity style={styles.mockupDesignBtnLarge} onPress={() => setShowDesigner(true)}>
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
                  <Text style={styles.mockupUploadBtnText}>Upload Image</Text>
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
              setShowDesigner(false);
            }}
            initialMockupUri={item.mockupUri}
            suggestedLocations={[item.location1, item.location2].filter(Boolean)}
          />

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
            <SegmentedControl
              label="Service Style"
              options={SERVICE_STYLES}
              value={item.serviceStyle}
              onChange={handleServiceStyleChange}
              centered
            />

            {/* 3. Service Applicator + Product Source */}
            <View style={styles.row}>
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
              <View style={styles.row}>
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
                  <View style={styles.row}>
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
                      const activeGarmentType = variantGarmentTypes[vIdx] ?? 'tshirt';
                      const availableTypes = getGarmentTypesForProvider(item.apparelProvider);
                      const stylesForType = getStylesForTypeAndProvider(item.apparelProvider, activeGarmentType);
                      const colorObjects = getColorObjectsForStyle(item.apparelProvider, variant.product);
                      return (
                        <View key={vIdx} style={[styles.variantRow, vIdx % 2 === 1 && styles.variantRowAlt]}>
                          {/* Row A: Garment type tabs + delete */}
                          <View style={styles.variantGarmentTypesRow}>
                            <View style={styles.variantGarmentTypesBtns}>
                              {availableTypes.map((type) => (
                                <TouchableOpacity
                                  key={type}
                                  style={[styles.variantTypeBtn, activeGarmentType === type && styles.variantTypeBtnActive]}
                                  onPress={() => setVariantGarmentType(vIdx, type)}
                                >
                                  <Text style={[styles.variantTypeBtnText, activeGarmentType === type && styles.variantTypeBtnTextActive]}>
                                    {GARMENTS[type].label}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                            <TouchableOpacity
                              style={[styles.variantDeleteBtn, variants.length <= 1 && { opacity: 0.2 }]}
                              onPress={() => removeVariant(vIdx)}
                              disabled={variants.length <= 1}
                            >
                              <X size={14} color={Colors.light.error} />
                            </TouchableOpacity>
                          </View>

                          {/* Row B: Product style list */}
                          <View style={styles.variantPickerSection}>
                            <Text style={styles.variantSectionLabel}>
                              PRODUCT STYLE{stylesForType.length > 0 ? ` (${stylesForType.length})` : ''}
                            </Text>
                            {stylesForType.length === 0 ? (
                              <Text style={styles.variantStyleName}>No styles found for this vendor / garment type.</Text>
                            ) : (
                              <View style={styles.variantStyleList}>
                                {stylesForType.map((style) => {
                                  const styleValue = `${style.styleNumber} — ${style.name}`;
                                  const isSelected = variant.product === styleValue;
                                  return (
                                    <TouchableOpacity
                                      key={style.styleNumber}
                                      style={[styles.variantStyleBtn, isSelected && styles.variantStyleBtnActive]}
                                      onPress={() => updateVariant(vIdx, { product: styleValue, color: '' })}
                                    >
                                      <Text style={[styles.variantStyleNumber, isSelected && styles.variantStyleNumberActive]}>
                                        {style.styleNumber}{style.isYouth ? ' (Youth)' : ''}
                                      </Text>
                                      <Text style={[styles.variantStyleName, isSelected && styles.variantStyleNameActive]} numberOfLines={2}>
                                        {style.name}
                                      </Text>
                                    </TouchableOpacity>
                                  );
                                })}
                              </View>
                            )}

                            {/* Color swatches */}
                            {(() => {
                              const selectedStyleObj = getStyleObjectForProduct(item.apparelProvider, variant.product);
                              const label = selectedStyleObj
                                ? `COLOR — ${selectedStyleObj.styleNumber} (${colorObjects.length})`
                                : 'COLOR';
                              return (
                                <>
                                  <Text style={styles.variantSectionLabel}>{label}</Text>
                                  {colorObjects.length > 0 ? (
                                    <>
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
                                            onPress={() => updateVariant(vIdx, { color: color.name })}
                                          >
                                            {variant.color === color.name && (
                                              <CheckCircle size={14} color={color.dark ? '#fff' : '#333'} />
                                            )}
                                          </TouchableOpacity>
                                        ))}
                                      </View>
                                      <Text style={styles.variantColorLabel}>
                                        {variant.color || ''}
                                      </Text>
                                    </>
                                  ) : (
                                    <Text style={styles.variantStyleName}>Select a product style above to see color options.</Text>
                                  )}
                                </>
                              );
                            })()}
                          </View>

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
                          <TextInput style={styles.dtfRateInputInline} value={dtfRate} onChangeText={t => setDtfRate(formatDecimalInput(t))} keyboardType="decimal-pad" placeholder="0.04" placeholderTextColor={Colors.light.textSecondary} />
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
                          <TextInput style={styles.dtfRateInputInline} value={dtfRate} onChangeText={t => setDtfRate(formatDecimalInput(t))} keyboardType="decimal-pad" placeholder="0.04" placeholderTextColor={Colors.light.textSecondary} />
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
                              <TextInput style={styles.dtfRateInputInline} value={dtfRate} editable={false} keyboardType="decimal-pad" placeholder="0.04" placeholderTextColor={Colors.light.textSecondary} />
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
                              <TextInput style={styles.dtfRateInputInline} value={dtfRate} editable={false} keyboardType="decimal-pad" placeholder="0.04" placeholderTextColor={Colors.light.textSecondary} />
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

              <View style={styles.costsRow}>
                <View style={styles.costField}>
                  <CurrencyInput label="Product" value={item.productCostEach} onChange={(v) => onChange({ ...item, productCostEach: v })} />
                </View>
                <View style={styles.costField}>
                  <CurrencyInput label="Service" value={item.serviceCostEach} onChange={(v) => onChange({ ...item, serviceCostEach: v })} />
                </View>
                <View style={styles.costField}>
                  <CurrencyInput label="Fees*" value={item.serviceFeeEach} onChange={(v) => onChange({ ...item, serviceFeeEach: v })} />
                </View>
                <View style={styles.costField}>
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
    width: 220,
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
  halfField: {
    flex: 1,
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
  variantGarmentTypesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 6,
    gap: 6,
  },
  variantGarmentTypesBtns: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  variantTypeBtn: {
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: '#fff',
  },
  variantTypeBtnActive: {
    backgroundColor: Colors.light.tint,
    borderColor: Colors.light.tint,
  },
  variantTypeBtnText: {
    fontSize: 11,
    color: Colors.light.text,
    fontWeight: '500' as const,
  },
  variantTypeBtnTextActive: {
    color: '#fff',
    fontWeight: '700' as const,
  },
  variantPickerSection: {
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  variantSectionLabel: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.light.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 6,
    marginTop: 12,
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
    gap: 6,
    marginBottom: 4,
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
  costField: {
    flex: 1,
  },
  // DTF
  dtfCalcSection: {
    backgroundColor: Colors.light.highlightBg,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.light.tint,
  },
  dtfCalcTitle: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.light.tint,
    marginBottom: 10,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  dtfLocationLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.light.text,
    marginBottom: 6,
    marginTop: 4,
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
    height: 38,
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
    marginTop: 10,
    paddingTop: 10,
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
});
