import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
  Platform,
} from 'react-native';
import {
  ChevronDown,
  Plus,
  X,
  Check,
  Maximize2,
  Search,
  RotateCcw,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import OverlayMenu from '@/components/OverlayMenu';
import { useProductCatalog, type NormalizedColor, type CatalogProductLite } from '@/hooks/useProductCatalog';
import type { ConfiguredProduct, ConfiguredColorVariant } from '@/types/configuredProduct';
import {
  categoryToGarmentType,
  isDarkHex,
  PRIMARY_CATEGORY_TILES,
  resolvePreview,
} from '@/utils/garmentPreview';
import {
  SIZE_LABELS_ROW1,
  SIZE_LABELS_ROW2,
  EMPTY_SIZES,
  LOCATIONS,
  type SizeQuantities,
} from '@/types/quote';
import { GarmentSvgPreview } from './GarmentSvgPreview';

// ── Brand + palette ───────────────────────────────────────────────────────────
const ORANGE = '#FF5A00';
const DARK_HDR = '#1C1C1C';
const DIVIDER = '#E4E6EB';
const COL_BG = '#FFFFFF';
const INPUT_BG = '#F3F4F6';

const ALL_APPAREL_SIZES = [...SIZE_LABELS_ROW1, ...SIZE_LABELS_ROW2];

// ── Public API ────────────────────────────────────────────────────────────────

export interface ResolvedCatalogMeta {
  productId?: string;
  styleNumber?: string;
  brand?: string;
  name?: string;
  defaultBlankCost?: string | number | null;
  vendorName?: string;
}

export interface ConfiguredProductEditorProps {
  value: ConfiguredProduct;
  onChange: (cp: ConfiguredProduct) => void;

  layout?: 'fourColumn' | 'toolbar' | 'compact';
  surface?: 'internalQuote' | 'clientPortal' | 'mockupDesigner';

  /** Show per-variant size inputs + grand total bar (default true for fourColumn). */
  showSizes?: boolean;
  /** Show garment preview in the center column (default true for fourColumn). */
  showPreview?: boolean;
  readOnly?: boolean;
  /** Always true per Product Model Law; exists only for documentation purposes. */
  allowManualProduct?: boolean;

  /** 'internal' uses Clerk-gated /api/products; 'portal' uses hub endpoint. */
  mode?: 'internal' | 'portal';
  /** Required for portal mode. */
  orgId?: string;

  /** Controlled: which colorVariant is currently being edited. */
  activeColorIndex?: number;
  onActiveColorChange?: (idx: number) => void;

  /** Fired whenever a catalog product is selected so the parent can fill costs. */
  onResolvedCatalogMeta?: (meta: ResolvedCatalogMeta) => void;

  /** Show print location pickers (Location #1–4) below the size grid. Portal default: true. */
  showLocations?: boolean;

  /** Extra content to render in the toolbar's trailing slot (e.g. "Done Editing"). */
  toolbarTrailing?: React.ReactNode;
}

// ── Sub-components ────────────────────────────────────────────────────────────

/** Tiny garment silhouette icon for the category tiles. */
function CategoryIcon({ category }: { category: string }) {
  const gt = categoryToGarmentType(category);
  return <GarmentSvgPreview garmentType={gt} colorHex="#CCCCCC" view="front" width={22} height={26} />;
}

// ── Main component ────────────────────────────────────────────────────────────

export function ConfiguredProductEditor({
  value: cp,
  onChange,
  layout = 'fourColumn',
  surface = 'internalQuote',
  showSizes: showSizesProp,
  showPreview: showPreviewProp,
  readOnly = false,
  mode,
  orgId,
  activeColorIndex: activeColorIndexProp,
  onActiveColorChange,
  onResolvedCatalogMeta,
  toolbarTrailing,
  showLocations: showLocationsProp,
}: ConfiguredProductEditorProps) {
  const isPortal = mode === 'portal' || surface === 'clientPortal';
  const effectiveMode: 'internal' | 'portal' = isPortal ? 'portal' : 'internal';

  const showSizes = showSizesProp ?? (layout === 'fourColumn');
  const showPreview = showPreviewProp ?? (layout === 'fourColumn');

  // ── Active variant index (controlled or self-managed) ──────────────────────
  const [activeColorIdxLocal, setActiveColorIdxLocal] = useState(0);
  const activeColorIndex = activeColorIndexProp ?? activeColorIdxLocal;
  const setActiveColorIndex = useCallback(
    (idx: number) => {
      setActiveColorIdxLocal(idx);
      onActiveColorChange?.(idx);
    },
    [onActiveColorChange],
  );

  // ── Style search state ─────────────────────────────────────────────────────
  const [styleSearch, setStyleSearch] = useState(() => {
    if (cp.styleNumber && cp.styleName) return `${cp.styleNumber} — ${cp.styleName}`;
    return cp.productLabel ?? '';
  });
  const [colorSearch, setColorSearch] = useState('');

  // ── Active color variant ───────────────────────────────────────────────────
  const activeVariant: ConfiguredColorVariant = cp.colorVariants[activeColorIndex] ?? {
    color: '',
    colorHex: undefined,
    sizes: { ...EMPTY_SIZES },
  };

  // ── Catalog hook ───────────────────────────────────────────────────────────
  const catalog = useProductCatalog({
    mode: effectiveMode,
    orgId,
    searchTerm: styleSearch,
    category: cp.category,
    productId: cp.productId,
    enabled: !readOnly,
  });

  // ── Colors: ONLY the linked product's catalog colors (no hardcoded fallback) ──
  const displayColors: NormalizedColor[] = catalog.colors;
  const filteredColors = useMemo(() => {
    const q = colorSearch.trim().toLowerCase();
    if (!q) return displayColors;
    return displayColors.filter((c) => c.name.toLowerCase().includes(q));
  }, [displayColors, colorSearch]);

  // ── Garment preview ────────────────────────────────────────────────────────
  const previewResult = useMemo(
    () =>
      resolvePreview({
        category: cp.category,
        productImageUrl: cp.productImageUrl,
        colorHex: activeVariant.colorHex,
      }),
    [cp.category, cp.productImageUrl, activeVariant.colorHex],
  );

  // ── Grand total (all variants) ─────────────────────────────────────────────
  const grandTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const { key } of ALL_APPAREL_SIZES) {
      totals[key] = cp.colorVariants.reduce((s, v) => s + (v.sizes?.[key] ?? 0), 0);
    }
    return totals;
  }, [cp.colorVariants]);
  const grandTotal = useMemo(
    () => Object.values(grandTotals).reduce((a, b) => a + b, 0),
    [grandTotals],
  );
  const activeVariantTotal = useMemo(
    () => ALL_APPAREL_SIZES.reduce((s, { key }) => s + (activeVariant.sizes?.[key] ?? 0), 0),
    [activeVariant.sizes],
  );

  // ── Handlers ───────────────────────────────────────────────────────────────

  const updateVariant = useCallback(
    (idx: number, patch: Partial<ConfiguredColorVariant>) => {
      const next = cp.colorVariants.map((v, i) => (i === idx ? { ...v, ...patch } : v));
      onChange({ ...cp, colorVariants: next });
    },
    [cp, onChange],
  );

  const handleSelectCategory = useCallback(
    (cat: string) => {
      onChange({ ...cp, category: cat, productType: cat });
      setStyleSearch('');
    },
    [cp, onChange],
  );

  const handleSelectCatalogProduct = useCallback(
    (p: CatalogProductLite) => {
      const label = [p.styleNumber, p.name].filter(Boolean).join(' — ');
      setStyleSearch(p.styleNumber || p.name || '');
      const vendor = catalog.vendors.find((v) => v.isPreferred) ?? catalog.vendors[0];
      const rawCost = p.defaultBlankCost;
      const parsedCost = rawCost == null || rawCost === '' ? cp.productCostEach : Number(rawCost);
      const productCostEach = Number.isFinite(parsedCost) && parsedCost > 0 ? parsedCost : cp.productCostEach;
      onChange({
        ...cp,
        productId: p.id,
        styleNumber: p.styleNumber,
        styleName: p.name,
        brand: p.brand,
        productSource: 'catalog',
        productLabel: label,
        category: p.category ?? cp.category,
        productType: p.category ?? cp.productType,
        vendorName: vendor?.name ?? cp.vendorName,
        productCostEach,
      });
      onResolvedCatalogMeta?.({
        productId: p.id,
        styleNumber: p.styleNumber,
        brand: p.brand,
        name: p.name,
        defaultBlankCost: p.defaultBlankCost,
        vendorName: vendor?.name,
      });
    },
    [cp, onChange, catalog.vendors, onResolvedCatalogMeta],
  );

  const handleUseManualStyle = useCallback(
    (term: string) => {
      setStyleSearch(term);
      onChange({
        ...cp,
        productId: undefined,
        productSource: 'manual',
        productLabel: term,
        styleNumber: undefined,
        styleName: undefined,
        brand: undefined,
      });
    },
    [cp, onChange],
  );

  const handleSelectColor = useCallback(
    (color: NormalizedColor) => {
      updateVariant(activeColorIndex, { color: color.name, colorHex: color.hex, colorId: color.colorId });
    },
    [activeColorIndex, updateVariant],
  );

  const handleSizeChange = useCallback(
    (key: keyof SizeQuantities, raw: string) => {
      const num = Math.max(0, parseInt(raw, 10) || 0);
      const sizes = { ...(activeVariant.sizes ?? EMPTY_SIZES), [key]: num };
      updateVariant(activeColorIndex, { sizes });
    },
    [activeColorIndex, activeVariant.sizes, updateVariant],
  );

  const handleAddColorVariant = useCallback(() => {
    if (cp.colorVariants.length >= 10) return;
    const next = [...cp.colorVariants, { color: '', colorHex: undefined, sizes: { ...EMPTY_SIZES } }];
    onChange({ ...cp, colorVariants: next });
    setActiveColorIndex(next.length - 1);
  }, [cp, onChange, setActiveColorIndex]);

  const handleRemoveColorVariant = useCallback(
    (idx: number) => {
      if (cp.colorVariants.length <= 1) return;
      const next = cp.colorVariants.filter((_, i) => i !== idx);
      onChange({ ...cp, colorVariants: next });
      if (activeColorIndex >= next.length) setActiveColorIndex(next.length - 1);
    },
    [cp, onChange, activeColorIndex, setActiveColorIndex],
  );

  const handleLocationChange = useCallback(
    (idx: number, value: string) => {
      const locs = [...(cp.printLocations ?? [])];
      while (locs.length <= idx) locs.push('');
      locs[idx] = value;
      onChange({ ...cp, printLocations: locs });
    },
    [cp, onChange],
  );

  const handleAddLocation = useCallback(() => {
    onChange({ ...cp, printLocations: [...(cp.printLocations ?? []), ''] });
  }, [cp, onChange]);

  const showLocations = showLocationsProp ?? (surface === 'clientPortal');
  const printLocations = cp.printLocations ?? [];

  // ── Render: toolbar layout (for MockupDesigner) ────────────────────────────

  if (layout === 'toolbar') {
    return <ToolbarLayout
      cp={cp}
      activeVariant={activeVariant}
      displayColors={displayColors}
      filteredColors={filteredColors}
      colorSearch={colorSearch}
      setColorSearch={setColorSearch}
      styleSearch={styleSearch}
      setStyleSearch={setStyleSearch}
      catalog={catalog}
      readOnly={readOnly}
      handleSelectCategory={handleSelectCategory}
      handleSelectCatalogProduct={handleSelectCatalogProduct}
      handleUseManualStyle={handleUseManualStyle}
      handleSelectColor={handleSelectColor}
      toolbarTrailing={toolbarTrailing}
    />;
  }

  // ── Render: fourColumn layout ──────────────────────────────────────────────

  const hasMultiColor = cp.colorVariants.length > 1;
  const isCatalogLinked = cp.productSource === 'catalog' && !!cp.productId;
  const styleDisplay = cp.styleNumber
    ? [cp.styleNumber, cp.styleName].filter(Boolean).join(' — ')
    : cp.productLabel || '';

  return (
    <View style={styles.wrapper}>
      {/* ── Section header ──────────────────────────────────────────────── */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>PRODUCTS + SIZES</Text>
        {!readOnly && cp.colorVariants.length < 10 && (
          <TouchableOpacity style={styles.addColorBtn} onPress={handleAddColorVariant} activeOpacity={0.75}>
            <Plus size={13} color="#fff" />
            <Text style={styles.addColorBtnText}>Add Style/Color</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Step indicators ─────────────────────────────────────────────── */}
      <View style={styles.stepRow}>
        {(['Product Type', 'Style', 'Color'] as const).map((label, i) => (
          <View key={label} style={[styles.stepCell, { flex: i === 2 ? 2.5 : 1.5 }]}>
            <View style={styles.stepIndicator}>
              <View style={[styles.stepCircle, i < 3 && styles.stepCircleActive]}>
                <Text style={[styles.stepNum, i < 3 && styles.stepNumActive]}>{i + 1}</Text>
              </View>
              <Text style={styles.stepLabel}>{label}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* ── 4-column content ─────────────────────────────────────────────── */}
      <View style={styles.columnsRow}>


        {/* ── Col 1: Product Type ─────────────────────────────────────── */}
        <View style={[styles.col, styles.col1]}>
          <Text style={styles.popularTypesLabel}>Choose a type</Text>

          {PRIMARY_CATEGORY_TILES.map((cat) => {
            const active = cp.category === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[styles.categoryTile, active && styles.categoryTileActive]}
                onPress={() => !readOnly && handleSelectCategory(cat)}
                activeOpacity={0.7}
              >
                <CategoryIcon category={cat} />
                <Text style={[styles.categoryTileText, active && styles.categoryTileTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.colDivider} />

        {/* ── Col 2: Style ─────────────────────────────────────────────── */}
        <View style={[styles.col, styles.col2]}>
          <Text style={styles.colSubLabel}>Choose a style</Text>

          <View style={styles.searchInputWrap}>
            <Search size={14} color={Colors.light.textSecondary} style={{ marginRight: 6 }} />
            <TextInput
              style={styles.searchInput}
              value={styleSearch}
              onChangeText={setStyleSearch}
              placeholder="Search styles..."
              placeholderTextColor={Colors.light.textSecondary}
              editable={!readOnly}
              autoCorrect={false}
            />
            {styleSearch.length > 0 && !readOnly && (
              <TouchableOpacity onPress={() => setStyleSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={13} color={Colors.light.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView style={styles.styleList} showsVerticalScrollIndicator={false} nestedScrollEnabled>
            {catalog.isSearching && (
              <Text style={styles.styleListEmpty}>Loading…</Text>
            )}
            {!catalog.isSearching && catalog.results.length === 0 && (!!cp.category || styleSearch.length >= 2) && (
              <Text style={styles.styleListEmpty}>No catalog matches.</Text>
            )}
            {!catalog.isSearching && catalog.results.length === 0 && !cp.category && styleSearch.length < 2 && (
              <Text style={styles.styleListEmpty}>Select a product type or search by name.</Text>
            )}
            {catalog.results.map((p) => {
              const isSelected = cp.productId === p.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.styleItem, isSelected && styles.styleItemActive]}
                  onPress={() => !readOnly && handleSelectCatalogProduct(p)}
                  activeOpacity={0.7}
                >
                  {p.styleNumber ? (
                    <Text style={[styles.styleItemNum, isSelected && styles.styleItemNumActive]}>
                      {p.styleNumber}
                    </Text>
                  ) : null}
                  <Text style={[styles.styleItemName, isSelected && styles.styleItemNameActive]} numberOfLines={2}>
                    {p.name}
                  </Text>
                  {p.brand ? (
                    <Text style={styles.styleItemBrand} numberOfLines={1}>{p.brand}</Text>
                  ) : null}
                </TouchableOpacity>
              );
            })}
            {styleSearch.trim().length > 0 && !readOnly && (
              <TouchableOpacity
                style={styles.useCustomRow}
                onPress={() => handleUseManualStyle(styleSearch.trim())}
                activeOpacity={0.7}
              >
                <Text style={styles.useCustomText}>
                  Use "{styleSearch.trim()}" as custom style
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>

        <View style={styles.colDivider} />

        {/* ── Col 3: Preview + Color ───────────────────────────────────── */}
        <View style={[styles.col, styles.col3]}>
          {/* Garment preview */}
          {showPreview && (
            <View style={styles.previewWrap}>
              {previewResult.kind === 'image' && previewResult.uri ? (
                <Image
                  source={{ uri: previewResult.uri }}
                  style={styles.previewImage}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.previewSvgWrap}>
                  <GarmentSvgPreview
                    garmentType={previewResult.garmentType}
                    colorHex={previewResult.hex}
                    view="front"
                    width={200}
                    height={240}
                  />
                </View>
              )}
            </View>
          )}

          {/* Product name + description */}
          {styleDisplay ? (
            <Text style={styles.previewProductName} numberOfLines={1}>{styleDisplay}</Text>
          ) : null}

          {/* Color variant chips (multi-color) */}
          {hasMultiColor && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.colorChipsScroll}
              contentContainerStyle={styles.colorChipsPad}
            >
              {cp.colorVariants.map((cv, idx) => {
                const isActive = idx === activeColorIndex;
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.colorChip, isActive && styles.colorChipActive]}
                    onPress={() => setActiveColorIndex(idx)}
                    activeOpacity={0.75}
                  >
                    {cv.colorHex && (
                      <View
                        style={[
                          styles.colorChipDot,
                          { backgroundColor: cv.colorHex },
                          cv.colorHex === '#FFFFFF' && styles.colorChipDotWhite,
                        ]}
                      />
                    )}
                    <Text style={[styles.colorChipText, isActive && styles.colorChipTextActive]} numberOfLines={1}>
                      {cv.color || `Color ${idx + 1}`}
                    </Text>
                    {!readOnly && cp.colorVariants.length > 1 && (
                      <TouchableOpacity
                        onPress={() => handleRemoveColorVariant(idx)}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        style={{ marginLeft: 4 }}
                      >
                        <X size={10} color={isActive ? '#fff' : Colors.light.textSecondary} />
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {/* Color picker section */}
          <Text style={styles.colSubLabel}>Choose a color</Text>

          {/* Color search dropdown (OverlayMenu) */}
          <OverlayMenu
            menuWidth={240}
            align="left"
            trigger={({ open }) => (
              <TouchableOpacity style={styles.dropdownTrigger} onPress={open} activeOpacity={0.75} disabled={readOnly}>
                {activeVariant.colorHex && (
                  <View
                    style={[
                      styles.colorDotSm,
                      { backgroundColor: activeVariant.colorHex },
                      activeVariant.colorHex === '#FFFFFF' && styles.colorDotSmWhite,
                    ]}
                  />
                )}
                <Text style={styles.dropdownTriggerText} numberOfLines={1}>
                  {activeVariant.color || 'Color Search'}
                </Text>
                <ChevronDown size={14} color={Colors.light.textSecondary} />
              </TouchableOpacity>
            )}
          >
            {({ close }) => (
              <View style={{ maxHeight: 320 }}>
                <View style={styles.colorSearchInputWrap}>
                  <Search size={13} color={Colors.light.textSecondary} />
                  <TextInput
                    style={styles.colorSearchInput}
                    value={colorSearch}
                    onChangeText={setColorSearch}
                    placeholder="Search colors..."
                    placeholderTextColor={Colors.light.textSecondary}
                    autoFocus
                  />
                </View>
                <ScrollView showsVerticalScrollIndicator={false}>
                  {filteredColors.map((color) => {
                    const isSelected = activeVariant.color === color.name;
                    return (
                      <TouchableOpacity
                        key={color.name + color.hex}
                        style={[styles.colorRow, isSelected && styles.colorRowActive]}
                        onPress={() => { handleSelectColor(color); setColorSearch(''); close(); }}
                      >
                        <View
                          style={[
                            styles.colorRowSwatch,
                            { backgroundColor: color.hex },
                            color.hex === '#FFFFFF' && styles.colorRowSwatchWhite,
                          ]}
                        />
                        <Text style={[styles.colorRowLabel, isSelected && styles.colorRowLabelActive]} numberOfLines={1}>
                          {color.name}
                        </Text>
                        {isSelected && <Check size={14} color={ORANGE} />}
                      </TouchableOpacity>
                    );
                  })}
                  {/* Free-text color entry */}
                  {!readOnly && (
                    <TouchableOpacity
                      style={styles.useCustomRow}
                      onPress={() => {
                        const val = colorSearch.trim();
                        if (val) {
                          updateVariant(activeColorIndex, { color: val, colorHex: undefined });
                          setColorSearch('');
                          close();
                        }
                      }}
                    >
                      <Text style={styles.useCustomText}>
                        {colorSearch.trim() ? `Use "${colorSearch.trim()}" as custom color` : 'Type to enter custom color…'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </ScrollView>
              </View>
            )}
          </OverlayMenu>

          {/* Visual swatch grid (4 per row) */}
          <View style={styles.swatchGrid}>
            {filteredColors.slice(0, 24).map((color) => {
              const isSelected = activeVariant.color === color.name;
              const dark = isDarkHex(color.hex);
              return (
                <TouchableOpacity
                  key={color.name + color.hex}
                  style={[
                    styles.swatchCell,
                    { backgroundColor: color.hex },
                    color.hex === '#FFFFFF' && styles.swatchCellWhite,
                    isSelected && styles.swatchCellSelected,
                  ]}
                  onPress={() => !readOnly && handleSelectColor(color)}
                  activeOpacity={0.8}
                  {...(Platform.OS === 'web'
                    ? {
                        title: color.name,
                      }
                    : {})}
                >
                  {isSelected && (
                    <Check size={13} color={dark ? '#fff' : '#333'} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Swatch color name labels (2-column) */}
          <View style={styles.swatchLabels}>
            {filteredColors.slice(0, 8).map((color) => (
              <Text key={color.name} style={styles.swatchLabel} numberOfLines={1}>
                {color.name}
              </Text>
            ))}
          </View>
        </View>

      </View>

      {/* ── Sizes (below columns) ────────────────────────────────────────── */}
      {showSizes && (
        <View style={styles.sizesSection}>
          {/* Single horizontal row: label above input, XS→4XL, then TOTAL */}
          <View style={styles.sizeRow}>
            {ALL_APPAREL_SIZES.map(({ key, label }) => (
              <View key={key} style={styles.sizeCell}>
                <Text style={styles.sizeCellLabel}>{label}</Text>
                <TextInput
                  style={styles.sizeCellInput}
                  value={activeVariant.sizes?.[key] > 0 ? String(activeVariant.sizes[key]) : ''}
                  onChangeText={(v) => handleSizeChange(key as keyof SizeQuantities, v)}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={Colors.light.textSecondary}
                  editable={!readOnly}
                  maxLength={4}
                />
              </View>
            ))}
            {/* TOTAL */}
            <View style={styles.sizeTotalCell}>
              <Text style={styles.sizeCellLabel}>TOTAL</Text>
              <Text style={[styles.sizeTotalNum, activeVariantTotal === 0 && styles.variantTotalZero]}>
                {activeVariantTotal}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* ── Print Locations ──────────────────────────────────────────────── */}
      {showLocations && (
        <View style={styles.locSection}>
          <View style={styles.locRow}>
            <LocDropdown
              label="Location #1"
              value={printLocations[0] ?? ''}
              onChange={(v) => handleLocationChange(0, v)}
              readOnly={readOnly}
            />
            <LocDropdown
              label="Location #2"
              value={printLocations[1] ?? ''}
              onChange={(v) => handleLocationChange(1, v)}
              readOnly={readOnly}
            />
            {printLocations.length >= 3 && (
              <LocDropdown
                label="Location #3"
                value={printLocations[2] ?? ''}
                onChange={(v) => handleLocationChange(2, v)}
                readOnly={readOnly}
              />
            )}
            {printLocations.length >= 4 && (
              <LocDropdown
                label="Location #4"
                value={printLocations[3] ?? ''}
                onChange={(v) => handleLocationChange(3, v)}
                readOnly={readOnly}
              />
            )}
          </View>
          {!readOnly && printLocations.length < 4 && (
            <View style={styles.locAddRow}>
              {printLocations.length < 3 && (
                <TouchableOpacity style={styles.locAddBtn} onPress={handleAddLocation}>
                  <Plus size={12} color={ORANGE} />
                  <Text style={styles.locAddText}>Add Location #3</Text>
                </TouchableOpacity>
              )}
              {printLocations.length === 3 && (
                <TouchableOpacity style={styles.locAddBtn} onPress={handleAddLocation}>
                  <Plus size={12} color={ORANGE} />
                  <Text style={styles.locAddText}>Add Location #4</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      )}

      {/* ── Grand Total bar ──────────────────────────────────────────────── */}
      {showSizes && (
        <View style={styles.grandTotalBar}>
          <Text style={styles.gtLabel}>GRAND TOTAL</Text>
          <View style={styles.gtSizes}>
            {ALL_APPAREL_SIZES.map(({ key, label }) => (
              <View key={key} style={styles.gtCell}>
                <Text style={styles.gtSizeLabel}>{label}</Text>
                <Text style={styles.gtSizeNum}>
                  {grandTotals[key] > 0 ? grandTotals[key] : ''}
                </Text>
              </View>
            ))}
            <View style={[styles.gtCell, styles.gtTotalCell]}>
              <Text style={styles.gtSizeLabel}>TOTAL</Text>
              <Text style={[styles.gtSizeNum, styles.gtTotalNum]}>{grandTotal}</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

// ── LocDropdown: print location picker (reused for all 4 slots) ───────────────
function LocDropdown({
  label, value, onChange, readOnly,
}: { label: string; value: string; onChange: (v: string) => void; readOnly: boolean }) {
  return (
    <View style={styles.locItem}>
      <Text style={styles.locLabel}>{label}</Text>
      <OverlayMenu
        menuWidth={200}
        align="left"
        trigger={({ open }) => (
          <TouchableOpacity style={styles.locTrigger} onPress={open} disabled={readOnly} activeOpacity={0.75}>
            <Text style={[styles.locTriggerText, !value && styles.locTriggerPlaceholder]} numberOfLines={1}>
              {value || 'Select…'}
            </Text>
            <ChevronDown size={13} color={Colors.light.textSecondary} />
          </TouchableOpacity>
        )}
      >
        {({ close }) => (
          <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
            {LOCATIONS.map((loc) => (
              <TouchableOpacity
                key={loc}
                style={[styles.overlayItem, value === loc && styles.overlayItemActive]}
                onPress={() => { onChange(loc); close(); }}
              >
                <Text style={[styles.overlayItemText, value === loc && styles.overlayItemTextActive]}>
                  {loc}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </OverlayMenu>
    </View>
  );
}

// ── Toolbar layout (separate component for clarity) ───────────────────────────

interface ToolbarLayoutProps {
  cp: ConfiguredProduct;
  activeVariant: ConfiguredColorVariant;
  displayColors: NormalizedColor[];
  filteredColors: NormalizedColor[];
  colorSearch: string;
  setColorSearch: (s: string) => void;
  styleSearch: string;
  setStyleSearch: (s: string) => void;
  catalog: ReturnType<typeof useProductCatalog>;
  readOnly: boolean;
  handleSelectCategory: (cat: string) => void;
  handleSelectCatalogProduct: (p: CatalogProductLite) => void;
  handleUseManualStyle: (s: string) => void;
  handleSelectColor: (c: NormalizedColor) => void;
  toolbarTrailing?: React.ReactNode;
}

function ToolbarLayout({
  cp,
  activeVariant,
  displayColors,
  filteredColors,
  colorSearch,
  setColorSearch,
  styleSearch,
  setStyleSearch,
  catalog,
  readOnly,
  handleSelectCategory,
  handleSelectCatalogProduct,
  handleUseManualStyle,
  handleSelectColor,
  toolbarTrailing,
}: ToolbarLayoutProps) {
  const styleDisplay = cp.styleNumber
    ? [cp.styleNumber, cp.styleName].filter(Boolean).join(' — ')
    : cp.productLabel || 'Choose a style';

  return (
    <View style={tbStyles.bar}>
      {/* PRODUCT TYPE */}
      <View style={tbStyles.group}>
        <Text style={tbStyles.groupLabel}>PRODUCT TYPE</Text>
        <OverlayMenu
          menuWidth={200}
          align="left"
          trigger={({ open }) => (
            <TouchableOpacity style={tbStyles.trigger} onPress={open} disabled={readOnly} activeOpacity={0.8}>
              <Text style={tbStyles.triggerText} numberOfLines={1}>{cp.category || 'T-Shirts'}</Text>
              <ChevronDown size={13} color={Colors.light.textSecondary} />
            </TouchableOpacity>
          )}
        >
          {({ close }) => (
            <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
              {PRIMARY_CATEGORY_TILES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[tbStyles.menuItem, cp.category === cat && tbStyles.menuItemActive]}
                  onPress={() => { handleSelectCategory(cat); close(); }}
                >
                  <Text style={[tbStyles.menuItemText, cp.category === cat && tbStyles.menuItemTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
              {catalog.categories.filter((c) => !PRIMARY_CATEGORY_TILES.includes(c)).map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[tbStyles.menuItem, cp.category === cat && tbStyles.menuItemActive]}
                  onPress={() => { handleSelectCategory(cat); close(); }}
                >
                  <Text style={[tbStyles.menuItemText, cp.category === cat && tbStyles.menuItemTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </OverlayMenu>
      </View>

      <View style={tbStyles.groupDivider} />

      {/* STYLE */}
      <View style={[tbStyles.group, tbStyles.groupWide]}>
        <Text style={tbStyles.groupLabel}>STYLE</Text>
        <OverlayMenu
          menuWidth={300}
          align="left"
          trigger={({ open }) => (
            <TouchableOpacity style={tbStyles.trigger} onPress={open} disabled={readOnly} activeOpacity={0.8}>
              <Text style={tbStyles.triggerText} numberOfLines={1}>{styleDisplay}</Text>
              <ChevronDown size={13} color={Colors.light.textSecondary} />
            </TouchableOpacity>
          )}
        >
          {({ close }) => (
            <View style={{ maxHeight: 340 }}>
              <View style={tbStyles.searchWrap}>
                <Search size={13} color={Colors.light.textSecondary} />
                <TextInput
                  style={tbStyles.searchInput}
                  value={styleSearch}
                  onChangeText={setStyleSearch}
                  placeholder="Search styles..."
                  placeholderTextColor={Colors.light.textSecondary}
                  autoFocus
                  autoCorrect={false}
                />
              </View>
              <ScrollView showsVerticalScrollIndicator={false}>
                {catalog.results.map((p) => {
                  const isSel = cp.productId === p.id;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[tbStyles.menuItem, isSel && tbStyles.menuItemActive]}
                      onPress={() => { handleSelectCatalogProduct(p); close(); }}
                    >
                      {p.styleNumber ? (
                        <Text style={[tbStyles.menuItemNum, isSel && tbStyles.menuItemNumActive]}>{p.styleNumber}</Text>
                      ) : null}
                      <Text style={[tbStyles.menuItemText, isSel && tbStyles.menuItemTextActive]} numberOfLines={1}>{p.name}</Text>
                    </TouchableOpacity>
                  );
                })}
                {styleSearch.trim().length > 0 && (
                  <TouchableOpacity
                    style={tbStyles.customRow}
                    onPress={() => { handleUseManualStyle(styleSearch.trim()); close(); }}
                  >
                    <Text style={tbStyles.customText}>Use "{styleSearch.trim()}" as custom</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            </View>
          )}
        </OverlayMenu>
      </View>

      <View style={tbStyles.groupDivider} />

      {/* COLOR */}
      <View style={tbStyles.group}>
        <Text style={tbStyles.groupLabel}>COLOR</Text>
        <OverlayMenu
          menuWidth={240}
          align="left"
          trigger={({ open }) => (
            <TouchableOpacity style={tbStyles.trigger} onPress={open} disabled={readOnly} activeOpacity={0.8}>
              {activeVariant.colorHex && (
                <View
                  style={[
                    tbStyles.colorDot,
                    { backgroundColor: activeVariant.colorHex },
                    activeVariant.colorHex === '#FFFFFF' && tbStyles.colorDotWhite,
                  ]}
                />
              )}
              <Text style={tbStyles.triggerText} numberOfLines={1}>
                {activeVariant.color || 'Select color'}
              </Text>
              <ChevronDown size={13} color={Colors.light.textSecondary} />
            </TouchableOpacity>
          )}
        >
          {({ close }) => (
            <View style={{ maxHeight: 300 }}>
              <View style={tbStyles.searchWrap}>
                <Search size={13} color={Colors.light.textSecondary} />
                <TextInput
                  style={tbStyles.searchInput}
                  value={colorSearch}
                  onChangeText={setColorSearch}
                  placeholder="Search colors..."
                  placeholderTextColor={Colors.light.textSecondary}
                  autoFocus
                />
              </View>
              <ScrollView showsVerticalScrollIndicator={false}>
                {filteredColors.map((color) => {
                  const isSel = activeVariant.color === color.name;
                  return (
                    <TouchableOpacity
                      key={color.name + color.hex}
                      style={[tbStyles.menuItem, isSel && tbStyles.menuItemActive]}
                      onPress={() => { handleSelectColor(color); setColorSearch(''); close(); }}
                    >
                      <View style={[tbStyles.colorRowDot, { backgroundColor: color.hex }, color.hex === '#FFFFFF' && tbStyles.colorDotWhite]} />
                      <Text style={[tbStyles.menuItemText, isSel && tbStyles.menuItemTextActive]} numberOfLines={1}>{color.name}</Text>
                      {isSel && <Check size={13} color={ORANGE} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </OverlayMenu>
      </View>

      {toolbarTrailing && (
        <>
          <View style={tbStyles.groupDivider} />
          <View style={tbStyles.trailing}>{toolbarTrailing}</View>
        </>
      )}
    </View>
  );
}

// ── Styles: fourColumn ────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: COL_BG,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: DIVIDER,
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: DARK_HDR,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  addColorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: ORANGE,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addColorBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },

  // Step indicators row
  stepRow: {
    flexDirection: 'row',
    backgroundColor: '#F8F9FA',
    borderBottomWidth: 1,
    borderBottomColor: DIVIDER,
  },
  stepCell: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    flex: 1,
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleActive: {
    backgroundColor: ORANGE,
  },
  stepNum: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  stepNumActive: {
    color: '#fff',
  },
  stepLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.light.textSecondary,
    letterSpacing: 0.2,
  },

  // Print locations section
  locSection: {
    borderTopWidth: 1,
    borderTopColor: DIVIDER,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FAFAFA',
  },
  locRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  locItem: {
    flex: 1,
    minWidth: 130,
  },
  locLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  locTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: INPUT_BG,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: DIVIDER,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  locTriggerText: {
    flex: 1,
    fontSize: 13,
    color: Colors.light.text,
    fontWeight: '500',
  },
  locTriggerPlaceholder: {
    color: Colors.light.textSecondary,
  },
  locAddRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 2,
  },
  locAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 3,
  },
  locAddText: {
    fontSize: 12,
    color: ORANGE,
    fontWeight: '600',
  },

  // Column layout
  columnsRow: {
    flexDirection: 'row',
    minHeight: 320,
  },
  col: {
    padding: 12,
    flexShrink: 0,
  },
  col1: { flex: 1.2 },
  col2: { flex: 1.5 },
  col3: { flex: 2.5 },
  colDivider: {
    width: 1,
    backgroundColor: DIVIDER,
  },

  colSubLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.light.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  // Category dropdown
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: INPUT_BG,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: DIVIDER,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
    gap: 6,
  },
  dropdownTriggerText: {
    flex: 1,
    fontSize: 13,
    color: Colors.light.text,
    fontWeight: '500',
  },

  // OverlayMenu items
  overlayItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  overlayItemActive: {
    backgroundColor: '#FFF4EE',
  },
  overlayItemText: {
    fontSize: 13,
    color: Colors.light.text,
  },
  overlayItemTextActive: {
    color: ORANGE,
    fontWeight: '600',
  },

  // Popular types tiles
  popularTypesLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.light.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  categoryTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginBottom: 2,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  categoryTileActive: {
    backgroundColor: '#FFF4EE',
    borderLeftColor: ORANGE,
  },
  categoryTileText: {
    fontSize: 13,
    color: Colors.light.text,
    fontWeight: '500',
  },
  categoryTileTextActive: {
    color: ORANGE,
    fontWeight: '700',
  },

  // Style column
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: INPUT_BG,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: DIVIDER,
    paddingHorizontal: 9,
    paddingVertical: 7,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.light.text,
    outlineWidth: 0,
  } as any,
  styleList: {
    flex: 1,
    maxHeight: 280,
  },
  styleListEmpty: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    padding: 8,
    fontStyle: 'italic',
  },
  styleItem: {
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginBottom: 2,
  },
  styleItemActive: {
    backgroundColor: '#FFF4EE',
  },
  styleItemNum: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.light.textSecondary,
    marginBottom: 1,
  },
  styleItemNumActive: {
    color: ORANGE,
  },
  styleItemName: {
    fontSize: 12,
    color: Colors.light.text,
    fontWeight: '500',
  },
  styleItemNameActive: {
    color: ORANGE,
    fontWeight: '700',
  },
  styleItemBrand: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginTop: 1,
  },
  useCustomRow: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: DIVIDER,
    marginTop: 4,
  },
  useCustomText: {
    fontSize: 12,
    color: ORANGE,
    fontWeight: '500',
  },

  // Preview
  previewWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    minHeight: 200,
  },
  previewImage: {
    width: 200,
    height: 240,
  },
  previewSvgWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewProductName: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.light.text,
    textAlign: 'center',
    marginBottom: 4,
  },

  // Color chips (multi-variant)
  colorChipsScroll: {
    marginBottom: 8,
  },
  colorChipsPad: {
    gap: 6,
    paddingVertical: 2,
  },
  colorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: INPUT_BG,
    borderWidth: 1,
    borderColor: DIVIDER,
  },
  colorChipActive: {
    backgroundColor: ORANGE,
    borderColor: ORANGE,
  },
  colorChipDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  colorChipDotWhite: {
    borderWidth: 1,
    borderColor: '#CCC',
  },
  colorChipText: {
    fontSize: 12,
    color: Colors.light.text,
    fontWeight: '500',
  },
  colorChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },

  // Color swatch in dropdown trigger
  colorDotSm: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 2,
  },
  colorDotSmWhite: {
    borderWidth: 1,
    borderColor: '#CCC',
  },

  // Color row in OverlayMenu
  colorSearchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: DIVIDER,
  },
  colorSearchInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.light.text,
    outlineWidth: 0,
  } as any,
  colorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  colorRowActive: {
    backgroundColor: '#FFF4EE',
  },
  colorRowSwatch: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  colorRowSwatchWhite: {
    borderWidth: 1,
    borderColor: '#CCC',
  },
  colorRowLabel: {
    flex: 1,
    fontSize: 13,
    color: Colors.light.text,
  },
  colorRowLabelActive: {
    color: ORANGE,
    fontWeight: '600',
  },

  // Swatch grid
  swatchGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
    marginBottom: 4,
  },
  swatchCell: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchCellWhite: {
    borderWidth: 1,
    borderColor: '#DDD',
  },
  swatchCellSelected: {
    borderWidth: 2,
    borderColor: '#333',
  },
  swatchLabels: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  swatchLabel: {
    fontSize: 9,
    color: Colors.light.textSecondary,
    width: '23%',
    textAlign: 'center',
  },

  // Sizes below-columns section — single horizontal row
  sizesSection: {
    borderTopWidth: 1,
    borderTopColor: DIVIDER,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
  },
  sizesSectionHeader: {
    marginBottom: 8,
  },
  sizeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  sizeCell: {
    alignItems: 'center',
    flex: 1,
    minWidth: 44,
    maxWidth: 64,
  },
  sizeCellLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.light.textSecondary,
    letterSpacing: 0.3,
    marginBottom: 4,
    textAlign: 'center',
  },
  sizeCellInput: {
    width: '100%',
    height: 34,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: DIVIDER,
    backgroundColor: INPUT_BG,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    color: Colors.light.text,
    outlineWidth: 0,
  } as any,
  sizeTotalCell: {
    alignItems: 'center',
    paddingLeft: 8,
    borderLeftWidth: 1,
    borderLeftColor: DIVIDER,
    minWidth: 52,
  },
  sizeTotalNum: {
    fontSize: 18,
    fontWeight: '800',
    color: ORANGE,
    lineHeight: 34,
  },
  variantTotalZero: {
    color: Colors.light.textSecondary,
  },

  // Grand total bar
  grandTotalBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DARK_HDR,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  gtLabel: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginRight: 16,
    minWidth: 90,
  },
  gtSizes: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 6,
  },
  gtCell: {
    alignItems: 'center',
    minWidth: 36,
    flex: 1,
  },
  gtTotalCell: {
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.2)',
    paddingLeft: 8,
  },
  gtSizeLabel: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 0.3,
    fontWeight: '600',
    marginBottom: 2,
  },
  gtSizeNum: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  gtTotalNum: {
    color: ORANGE,
    fontSize: 14,
  },
});

// ── Styles: toolbar ───────────────────────────────────────────────────────────

const tbStyles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: '#F5F5F5',
    borderBottomWidth: 1,
    borderBottomColor: DIVIDER,
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 0,
  },
  group: {
    paddingHorizontal: 12,
    minWidth: 140,
  },
  groupWide: {
    minWidth: 220,
    flex: 1,
  },
  trailing: {
    paddingHorizontal: 12,
    justifyContent: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.light.textSecondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: DIVIDER,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 6,
  },
  triggerText: {
    fontSize: 13,
    color: Colors.light.text,
    fontWeight: '500',
    flex: 1,
  },
  groupDivider: {
    width: 1,
    backgroundColor: DIVIDER,
    marginVertical: 2,
  },

  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 8,
  },
  menuItemActive: {
    backgroundColor: '#FFF4EE',
  },
  menuItemNum: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.light.textSecondary,
    minWidth: 44,
  },
  menuItemNumActive: {
    color: ORANGE,
  },
  menuItemText: {
    fontSize: 13,
    color: Colors.light.text,
    flex: 1,
  },
  menuItemTextActive: {
    color: ORANGE,
    fontWeight: '600',
  },
  customRow: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: DIVIDER,
  },
  customText: {
    fontSize: 12,
    color: ORANGE,
    fontWeight: '500',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: DIVIDER,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.light.text,
    outlineWidth: 0,
  } as any,

  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  colorDotWhite: {
    borderWidth: 1,
    borderColor: '#CCC',
  },
  colorRowDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
});
