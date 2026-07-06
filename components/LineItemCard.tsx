import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
import {
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Trash2,
  X,
  Brush,
  Plus,
  CheckCircle,
  Copy,
  MoreVertical,
  Search,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { MockupDesigner } from './MockupDesigner/MockupDesigner';
import {
  LineItem,
  SERVICE_STYLES,
  EMPTY_SIZES,
  APPAREL_PROVIDERS,
  LOCATIONS,
  APPLICATORS,
  PROJECT_PRIORITIES,
  type SizeQuantities,
} from '@/types/quote';
import type { ConfiguredProduct } from '@/types/configuredProduct';
import { CurrencyInput } from './CurrencyInput';
import { formatCents, parseCents } from '@/utils/posDecimalInput';
import OverlayMenu from '@/components/OverlayMenu';
import { QuoteAdjustmentsTable } from '@/components/QuoteAdjustmentsTable';
import type { QuoteAdjustment } from '@/types/quote';
import { getTotalQuantity, calculateLineItemSubtotal, formatCurrency } from '@/utils/quoteCalculations';
import { useProductPricing } from '@/lib/useProductPricing';
import {
  getLineItemProducts,
  getConfiguredProductQuantity,
  updateProductAt,
  addProduct,
  removeProductAt,
  duplicateProductAt,
  setUniformProductCost,
  updateDesignFields,
} from '@/utils/lineItemProducts';
import { useProductCatalog, type CatalogProductLite, type NormalizedColor } from '@/hooks/useProductCatalog';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useQuery } from '@tanstack/react-query';
import { useEnabledServiceStyles } from '@/lib/useServiceStyles';

// ── Constants ─────────────────────────────────────────────────────────────────

const QUOTE_PRODUCT_TYPES = [
  'T-Shirts', 'Polos', 'Crewnecks', 'Hoodies', 'Hats', 'Bags', 'Accessories', 'Other',
];

// 8 standard apparel sizes shown in the size grid (XS–4XL)
const QUOTE_SIZES = [
  { key: 'xs',    label: 'XS'  },
  { key: 's',     label: 'SM'  },
  { key: 'm',     label: 'MD'  },
  { key: 'l',     label: 'LG'  },
  { key: 'xl',    label: 'XL'  },
  { key: 'xxl',   label: '2XL' },
  { key: 'xxxl',  label: '3XL' },
  { key: 'xxxxl', label: '4XL' },
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function filterByProductType(products: CatalogProductLite[], type: string): CatalogProductLite[] {
  if (!type || type === 'Other' || type === 'Accessories') return products;
  return products.filter((p) => {
    const n = (p.name ?? '').toLowerCase();
    const c = (p.category ?? '').toLowerCase();
    switch (type) {
      case 'T-Shirts':  return n.includes('tee') || n.includes('t-shirt') || n.includes('jersey');
      case 'Polos':     return n.includes('polo');
      case 'Crewnecks': return n.includes('crewneck') || (n.includes('crew') && !n.includes('tee'));
      case 'Hoodies':   return n.includes('hoodie') || n.includes('sweatshirt') || n.includes('pullover');
      case 'Hats':      return c === 'headwear' || n.includes('hat') || n.includes('cap');
      case 'Bags':      return n.includes('bag') || n.includes('tote');
      default:          return c.includes(type.toLowerCase()) || n.includes(type.toLowerCase());
    }
  });
}

function resolveColorHex(name: string, catalogColors: NormalizedColor[]): string {
  if (!name) return '#cccccc';
  const match = catalogColors.find((c) => c.name.toLowerCase() === name.toLowerCase());
  if (match?.hex) return match.hex;
  const n = name.toLowerCase();
  if (n.includes('black'))   return '#111111';
  if (n.includes('white'))   return '#f5f5f5';
  if (n.includes('navy') || n.includes('night')) return '#1a3a6e';
  if (n.includes('red') || n.includes('cardinal')) return '#b81c1c';
  if (n.includes('royal'))   return '#3e4ab8';
  if (n.includes('blue') || n.includes('sky')) return '#1a5fa8';
  if (n.includes('green') || n.includes('forest')) return '#1a6e2a';
  if (n.includes('grey') || n.includes('gray')) return '#888888';
  if (n.includes('sand') || n.includes('natural') || n.includes('tan')) return '#c8b07a';
  return '#cccccc';
}

// ── QuoteProductRow ───────────────────────────────────────────────────────────
// Compact inline product editor for the Quote Builder workspace.
// Replaces ConfiguredProductEditor — no category browser, no wizard.
// Each product: Type | Style (searchable) | Color | Sizes grid

interface QuoteProductRowProps {
  cp: ConfiguredProduct;
  idx: number;
  onChange: (cp: ConfiguredProduct) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onUseForMockup: () => void;
  canRemove: boolean;
  allProducts: CatalogProductLite[];
}

function QuoteProductRow({
  cp,
  idx,
  onChange,
  onDuplicate,
  onRemove,
  onUseForMockup,
  canRemove,
  allProducts,
}: QuoteProductRowProps) {
  const [styleSearch, setStyleSearch] = useState('');

  // Fetch colors for the linked catalog product (cached by React Query)
  const { colors: catalogColors } = useProductCatalog({
    mode: 'internal',
    productId: cp.productId ?? undefined,
    enabled: !!cp.productId,
  });

  const sizes = cp.colorVariants?.[0]?.sizes ?? EMPTY_SIZES;
  const color = cp.colorVariants?.[0]?.color ?? '';
  const productType = cp.category ?? cp.productType ?? 'T-Shirts';

  const styleLabel = useMemo(() => {
    if (cp.productId) return [cp.styleNumber, cp.styleName].filter(Boolean).join(' ');
    return cp.productLabel || cp.styleNumber || cp.styleName || '';
  }, [cp.productId, cp.styleNumber, cp.styleName, cp.productLabel]);

  const filteredProducts = useMemo(() => {
    const byType = filterByProductType(allProducts, productType);
    if (!styleSearch.trim()) return byType.slice(0, 25);
    const q = styleSearch.toLowerCase();
    return byType
      .filter(
        (p) =>
          p.styleNumber?.toLowerCase().includes(q) ||
          p.name?.toLowerCase().includes(q) ||
          p.brand?.toLowerCase().includes(q),
      )
      .slice(0, 20);
  }, [allProducts, productType, styleSearch]);

  const productRowTotal = useMemo(
    () => QUOTE_SIZES.reduce((sum, { key }) => sum + (((sizes as any)[key]) || 0), 0),
    [sizes],
  );

  const handleSizeChange = useCallback(
    (key: string, val: string) => {
      const num = parseInt(val, 10);
      const safe = isNaN(num) || num < 0 ? 0 : num;
      onChange({
        ...cp,
        colorVariants: [
          { color, sizes: { ...(cp.colorVariants?.[0]?.sizes ?? EMPTY_SIZES), [key]: safe } },
          ...(cp.colorVariants?.slice(1) ?? []),
        ],
      });
    },
    [cp, color, onChange],
  );

  const handleColorChange = useCallback(
    (newColor: string) => {
      onChange({
        ...cp,
        colorVariants: [
          { color: newColor, sizes: cp.colorVariants?.[0]?.sizes ?? EMPTY_SIZES },
          ...(cp.colorVariants?.slice(1) ?? []),
        ],
      });
    },
    [cp, onChange],
  );

  const handleSelectCatalogProduct = useCallback(
    (p: CatalogProductLite, closeFn: () => void) => {
      closeFn();
      setStyleSearch('');
      onChange({
        ...cp,
        productId: p.id,
        styleNumber: p.styleNumber,
        styleName: p.name,
        brand: p.brand,
        category: p.category ?? productType,
        productType: p.category ?? productType,
        productLabel: `${p.styleNumber} ${p.name}`.trim(),
      });
    },
    [cp, onChange, productType],
  );

  const handleCustomStyle = useCallback(
    (text: string, closeFn: () => void) => {
      closeFn();
      setStyleSearch('');
      onChange({
        ...cp,
        productId: undefined,
        styleNumber: '',
        styleName: text,
        productLabel: text,
      });
    },
    [cp, onChange],
  );

  const colorHex = resolveColorHex(color, catalogColors);
  const isLightColor =
    colorHex.toLowerCase() === '#f5f5f5' || colorHex.toLowerCase() === '#ffffff';

  return (
    <View style={pStyles.row}>
      {/* Controls: Badge | Type | Style | Color | Kebab */}
      <View style={pStyles.controls}>
        <View style={pStyles.badge}>
          <Text style={pStyles.badgeText}>{idx + 1}</Text>
        </View>

        {/* Product Type */}
        <View style={pStyles.typeCol}>
          <Text style={pStyles.colLabel}>PRODUCT TYPE</Text>
          <OverlayMenu
            menuWidth={170}
            align="left"
            trigger={({ open }) => (
              <TouchableOpacity style={pStyles.dropBtn} onPress={open} activeOpacity={0.7}>
                <Text style={pStyles.dropBtnText} numberOfLines={1}>{productType}</Text>
                <ChevronDown size={11} color={Colors.light.textSecondary} />
              </TouchableOpacity>
            )}
          >
            {({ close }) => (
              <>
                {QUOTE_PRODUCT_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={pStyles.menuItem}
                    onPress={() => { close(); onChange({ ...cp, category: t, productType: t }); }}
                  >
                    <Text style={[pStyles.menuItemText, productType === t && pStyles.menuItemActive]}>
                      {t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </>
            )}
          </OverlayMenu>
        </View>

        {/* Product Style (searchable) */}
        <View style={pStyles.styleCol}>
          <Text style={pStyles.colLabel}>PRODUCT STYLE</Text>
          <OverlayMenu
            menuWidth={300}
            align="left"
            trigger={({ open }) => (
              <TouchableOpacity style={pStyles.dropBtn} onPress={open} activeOpacity={0.7}>
                <Text style={pStyles.dropBtnText} numberOfLines={1}>
                  {styleLabel || 'Select style...'}
                </Text>
                <ChevronDown size={11} color={Colors.light.textSecondary} />
              </TouchableOpacity>
            )}
          >
            {({ close }) => (
              <View>
                <View style={pStyles.searchRow}>
                  <Search size={13} color={Colors.light.textSecondary} />
                  <TextInput
                    style={pStyles.searchInput}
                    value={styleSearch}
                    onChangeText={setStyleSearch}
                    placeholder="Search styles..."
                    placeholderTextColor={Colors.light.textSecondary}
                    autoFocus
                  />
                </View>
                <ScrollView style={pStyles.searchResults} keyboardShouldPersistTaps="handled">
                  {filteredProducts.map((p) => (
                    <TouchableOpacity
                      key={p.id}
                      style={[pStyles.menuItem, cp.productId === p.id && pStyles.menuItemSelectedBg]}
                      onPress={() => handleSelectCatalogProduct(p, close)}
                    >
                      <Text style={pStyles.catalogNum}>{p.styleNumber}</Text>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={pStyles.catalogName} numberOfLines={1}>{p.name}</Text>
                        <Text style={pStyles.catalogBrand}>{p.brand}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                  {styleSearch.trim().length > 0 && filteredProducts.length === 0 && (
                    <TouchableOpacity
                      style={pStyles.customOption}
                      onPress={() => handleCustomStyle(styleSearch.trim(), close)}
                    >
                      <Text style={pStyles.customOptionText}>
                        Use "{styleSearch.trim()}" as custom style
                      </Text>
                    </TouchableOpacity>
                  )}
                  {styleSearch.trim().length > 0 && filteredProducts.length > 0 && (
                    <TouchableOpacity
                      style={pStyles.customOption}
                      onPress={() => handleCustomStyle(styleSearch.trim(), close)}
                    >
                      <Text style={pStyles.customOptionText}>
                        Use "{styleSearch.trim()}" as custom style
                      </Text>
                    </TouchableOpacity>
                  )}
                  {!styleSearch.trim() && allProducts.length === 0 && (
                    <Text style={pStyles.emptyHint}>Loading catalog...</Text>
                  )}
                  {!styleSearch.trim() && allProducts.length > 0 && filteredProducts.length === 0 && (
                    <Text style={pStyles.emptyHint}>No products in this category</Text>
                  )}
                </ScrollView>
              </View>
            )}
          </OverlayMenu>
        </View>

        {/* Color */}
        <View style={pStyles.colorCol}>
          <Text style={pStyles.colLabel}>COLOR</Text>
          <OverlayMenu
            menuWidth={200}
            align="right"
            trigger={({ open }) => (
              <TouchableOpacity style={pStyles.colorBtn} onPress={open} activeOpacity={0.7}>
                <View
                  style={[
                    pStyles.colorDot,
                    { backgroundColor: colorHex },
                    isLightColor && pStyles.colorDotBorder,
                  ]}
                />
                <Text style={pStyles.dropBtnText} numberOfLines={1}>{color || 'Color'}</Text>
                <ChevronDown size={11} color={Colors.light.textSecondary} />
              </TouchableOpacity>
            )}
          >
            {({ close }) => (
              <View>
                {catalogColors.length > 0 ? (
                  <ScrollView style={{ maxHeight: 200 }} keyboardShouldPersistTaps="handled">
                    {catalogColors.map((c) => (
                      <TouchableOpacity
                        key={c.name}
                        style={[pStyles.colorItem, color === c.name && pStyles.menuItemSelectedBg]}
                        onPress={() => { close(); handleColorChange(c.name); }}
                      >
                        <View style={[pStyles.colorDot, { backgroundColor: c.hex || '#888' }]} />
                        <Text style={pStyles.menuItemText}>{c.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                ) : (
                  <View style={pStyles.colorFreeEntry}>
                    <Text style={pStyles.colorFreeLabel}>Enter color name:</Text>
                    <TextInput
                      style={pStyles.colorFreeInput}
                      value={color}
                      onChangeText={handleColorChange}
                      placeholder="e.g. Black"
                      placeholderTextColor={Colors.light.textSecondary}
                      returnKeyType="done"
                      onSubmitEditing={close}
                    />
                  </View>
                )}
              </View>
            )}
          </OverlayMenu>
        </View>
        <OverlayMenu
          menuWidth={185}
          align="right"
          trigger={({ open }) => (
            <TouchableOpacity
              onPress={open}
              style={pStyles.kebabBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MoreVertical size={15} color={Colors.light.textSecondary} />
            </TouchableOpacity>
          )}
        >
          {({ close }) => (
            <>
              <TouchableOpacity
                style={pStyles.menuItem}
                onPress={() => { close(); onDuplicate(); }}
              >
                <Copy size={13} color={Colors.light.text} />
                <Text style={pStyles.menuItemText}>Duplicate Product</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={pStyles.menuItem}
                onPress={() => { close(); onUseForMockup(); }}
              >
                <Brush size={13} color={Colors.light.text} />
                <Text style={pStyles.menuItemText}>Use for Mockup</Text>
              </TouchableOpacity>
              {canRemove && (
                <TouchableOpacity
                  style={pStyles.menuItem}
                  onPress={() => { close(); onRemove(); }}
                >
                  <Trash2 size={13} color={Colors.light.error} />
                  <Text style={[pStyles.menuItemText, { color: Colors.light.error }]}>
                    Remove Product
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </OverlayMenu>
      </View>

      {/* Sizes grid: XS SM MD LG XL 2XL 3XL 4XL | TOTAL */}
      <View style={pStyles.sizesRow}>
        {QUOTE_SIZES.map(({ key, label }) => (
          <View key={key} style={pStyles.sizeCell}>
            <Text style={pStyles.sizeLabel}>{label}</Text>
            <TextInput
              style={pStyles.sizeInput}
              value={(sizes as any)[key] > 0 ? String((sizes as any)[key]) : ''}
              onChangeText={(v) => handleSizeChange(key, v)}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={Colors.light.border}
              maxLength={4}
              selectTextOnFocus
            />
          </View>
        ))}
        <View style={pStyles.totalCell}>
          <Text style={pStyles.sizeLabel}>TOTAL</Text>
          <Text style={pStyles.totalValue}>{productRowTotal}</Text>
        </View>
      </View>
    </View>
  );
}

const pStyles = StyleSheet.create({
  row: {
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    paddingTop: 14,
    paddingBottom: 10,
  },
  controls: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
    gap: 6,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  badge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.light.tint,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexShrink: 0,
    marginBottom: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700' as const,
  },
  colLabel: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  typeCol: { width: 110, flexShrink: 0 },
  styleCol: { flex: 1, minWidth: 0 },
  colorCol: { width: 110, flexShrink: 0 },
  dropBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 6,
    paddingHorizontal: 9,
    paddingVertical: 7,
    height: 34,
  },
  dropBtnText: {
    flex: 1,
    fontSize: 13,
    color: Colors.light.text,
  },
  colorBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 6,
    paddingHorizontal: 9,
    paddingVertical: 7,
    height: 34,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    flexShrink: 0,
  },
  colorDotBorder: {
    borderWidth: 1,
    borderColor: '#ccc',
  },
  kebabBtn: {
    width: 28,
    height: 30,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexShrink: 0,
  },
  productHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.light.border,
    backgroundColor: Colors.light.background,
  },
  productNameDisplay: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.light.text,
    flex: 1,
    minWidth: 0,
  },
  headerColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },
  headerColorName: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    fontWeight: '500' as const,
    maxWidth: 110,
    flexShrink: 1,
  },
  searchRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.light.text,
    paddingVertical: 0,
  },
  searchResults: { maxHeight: 220 },
  menuItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.light.border,
  },
  menuItemText: {
    fontSize: 13,
    color: Colors.light.text,
    flex: 1,
  },
  menuItemActive: {
    color: Colors.light.tint,
    fontWeight: '700' as const,
  },
  menuItemSelectedBg: {
    backgroundColor: Colors.light.highlightBg,
  },
  catalogNum: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.light.tint,
    width: 46,
    flexShrink: 0,
  },
  catalogName: {
    fontSize: 12,
    color: Colors.light.text,
  },
  catalogBrand: {
    fontSize: 10,
    color: Colors.light.textSecondary,
  },
  customOption: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    backgroundColor: '#FFF8F5',
  },
  customOptionText: {
    fontSize: 12,
    color: Colors.light.tint,
    fontStyle: 'italic' as const,
  },
  emptyHint: {
    padding: 12,
    fontSize: 12,
    color: Colors.light.textSecondary,
    fontStyle: 'italic' as const,
  },
  colorItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.light.border,
  },
  colorFreeEntry: { padding: 12 },
  colorFreeLabel: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginBottom: 6,
  },
  colorFreeInput: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 13,
    color: Colors.light.text,
    backgroundColor: Colors.light.surface,
  },
  sizesRow: {
    flexDirection: 'row' as const,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
    alignItems: 'flex-end' as const,
  },
  sizeCell: {
    flex: 1,
    alignItems: 'center' as const,
  },
  sizeLabel: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase' as const,
    marginBottom: 4,
    letterSpacing: 0.3,
    textAlign: 'center' as const,
  },
  sizeInput: {
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 5,
    alignSelf: 'stretch' as const,
    height: 36,
    textAlign: 'center' as const,
    fontSize: 14,
    color: Colors.light.text,
    fontWeight: '500' as const,
  },
  totalCell: {
    flex: 1,
    alignItems: 'center' as const,
  },
  totalValue: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.light.tint,
    textAlign: 'center' as const,
    height: 36,
    lineHeight: 36,
  },
});

// ── LineItemCard ──────────────────────────────────────────────────────────────

interface LineItemCardProps {
  item: LineItem;
  index: number;
  onChangeItem: (id: string, item: LineItem) => void;
  onDelete: (id: string) => void;
  /** Optional: duplicate this entire line item. */
  onDuplicate?: () => void;
}


function LineItemCardFn({
  item,
  index,
  onChangeItem,
  onDelete: onDeleteProp,
  onDuplicate,
}: LineItemCardProps) {
  const itemRef = useRef(item);
  itemRef.current = item;
  const onChange = useCallback(
    (updated: LineItem) => onChangeItem(item.id, updated),
    [item.id, onChangeItem],
  );
  const handleDelete = useCallback(() => onDeleteProp(item.id), [item.id, onDeleteProp]);

  const [expanded, setExpanded] = useState(true);
  const [showDesigner, setShowDesigner] = useState(false);
  const [variantPickerVisible, setVariantPickerVisible] = useState(false);
  const [selectedProductIndex, setSelectedProductIndex] = useState(0);
  const [locationRowCount, setLocationRowCount] = useState(1);

  const [dtfWidth1, setDtfWidth1] = useState('');
  const [dtfHeight1, setDtfHeight1] = useState('');
  const [dtfWidth2, setDtfWidth2] = useState('');
  const [dtfHeight2, setDtfHeight2] = useState('');
  const [dtfRate, setDtfRate] = useState('003');
  const [focusedDtfField, setFocusedDtfField] = useState<string | null>(null);
  const [dtfVendor, setDtfVendor] = useState('');
  const [dtfPreset, setDtfPreset] = useState('');
  const [dtfSuggestedPrice, setDtfSuggestedPrice] = useState('');
  const [focusedSuggestedPrice, setFocusedSuggestedPrice] = useState(false);

  // ── Screen Printing Calculator state ──────────────────────────────────────
  const [spPreset, setSpPreset] = useState('');
  const [spSuggestedPrice, setSpSuggestedPrice] = useState('');
  const [focusedSpSuggested, setFocusedSpSuggested] = useState(false);
  const [spLocations, setSpLocations] = useState([
    { colors: '', screens: '', vendorCost: '', sellPrice: '' },
    { colors: '', screens: '', vendorCost: '', sellPrice: '' },
    { colors: '', screens: '', vendorCost: '', sellPrice: '' },
    { colors: '', screens: '', vendorCost: '', sellPrice: '' },
  ]);
  const updateSpLocation = useCallback(
    (idx: number, field: 'colors' | 'screens' | 'vendorCost' | 'sellPrice', val: string) =>
      setSpLocations((prev) => prev.map((loc, i) => (i === idx ? { ...loc, [field]: val } : loc))),
    [],
  );

  // ── Embroidery Calculator state ───────────────────────────────────────────
  const [embVendor, setEmbVendor] = useState('');
  const [embPreset, setEmbPreset] = useState('');
  const [embSuggestedPrice, setEmbSuggestedPrice] = useState('');
  const [focusedEmbSuggested, setFocusedEmbSuggested] = useState(false);
  const [embLocations, setEmbLocations] = useState([
    { stitchCount: '', vendorCost: '', sellPrice: '' },
    { stitchCount: '', vendorCost: '', sellPrice: '' },
    { stitchCount: '', vendorCost: '', sellPrice: '' },
    { stitchCount: '', vendorCost: '', sellPrice: '' },
  ]);
  const updateEmbLocation = useCallback(
    (idx: number, field: 'stitchCount' | 'vendorCost' | 'sellPrice', val: string) =>
      setEmbLocations((prev) => prev.map((loc, i) => (i === idx ? { ...loc, [field]: val } : loc))),
    [],
  );

  // ── DTF Transfers (Wholesale) Calculator state ────────────────────────────
  const [dtfTGangWidth, setDtfTGangWidth] = useState<'22' | '24' | '30' | 'custom'>('30');
  const [dtfTCustomWidth, setDtfTCustomWidth] = useState('');
  const [dtfTWholesaleCost, setDtfTWholesaleCost] = useState('');
  const [dtfTMarkupPct, setDtfTMarkupPct] = useState('100');
  const [focusedDtfTField, setFocusedDtfTField] = useState<string | null>(null);

  // ── Promotional Products Calculator state ─────────────────────────────────
  const [promoProductCost, setPromoProductCost] = useState('');
  const [promoFreight, setPromoFreight] = useState('');
  const [promoHandling, setPromoHandling] = useState('');
  const [promoMarkupPct, setPromoMarkupPct] = useState('100');
  const [focusedPromoField, setFocusedPromoField] = useState<string | null>(null);

  const { isMobile, isDesktop } = useBreakpoint();
  const useSideBySide = Platform.OS === 'web' && isDesktop;
  const { upcharges } = useProductPricing();

  const dbServiceStyles = useEnabledServiceStyles();
  const { data: costLibrary = [] } = useQuery<any[]>({
    queryKey: ['cost-library', 'production'],
    queryFn: async () => {
      const r = await fetch('/api/cost-library?category=production');
      if (!r.ok) throw new Error('Failed to load');
      return r.json();
    },
    networkMode: 'always',
    staleTime: 60_000,
  });

  const { data: productionPresets = [] } = useQuery<any[]>({
    queryKey: ['production-presets', item.serviceStyle],
    queryFn: async () => {
      const r = await fetch(`/api/production-presets?serviceType=${encodeURIComponent(item.serviceStyle ?? '')}&status=Active`);
      if (!r.ok) return [];
      const data = await r.json();
      return data.presets ?? [];
    },
    networkMode: 'always',
    staleTime: 120_000,
    enabled: !!item.serviceStyle,
  });

  const serviceStyleList: string[] = dbServiceStyles.length > 0
    ? dbServiceStyles.map((s) => s.name)
    : (SERVICE_STYLES as readonly string[]).slice();

  const isPromotional = item.serviceStyle === 'Promotional';
  const isDTF = item.serviceStyle === 'Direct to Film';
  const isEmbroidery = item.serviceStyle === 'Embroidery';
  const isDTFTransfers = item.serviceStyle === 'DTF Transfers';
  const isScreenPrinting = item.serviceStyle === 'Screen Printing';
  const hasSecondLocation = !!(item.location2 && item.location2.length > 0);
  const hasCalculator = isDTF || isDTFTransfers || isEmbroidery || isScreenPrinting || isPromotional;

  const quantity = useMemo(
    () => getTotalQuantity(item.sizes, isPromotional),
    [item.sizes, isPromotional],
  );
  const lineItemCalcs = useMemo(() => calculateLineItemSubtotal(item, upcharges), [item, upcharges]);

  // ── Multi-product model ───────────────────────────────────────────────────
  const products = useMemo(() => getLineItemProducts(item), [item]);
  const productCount = products.length;
  const safeProductIndex = Math.min(selectedProductIndex, Math.max(0, productCount - 1));

  // ── Catalog for product rows (fetched once, passed down) ──────────────────
  const { results: catalogProducts } = useProductCatalog({ mode: 'internal' });

  // ── Location slots (fixed 4, dropdown-per-row) ────────────────────────────
  const locationSlots = useMemo(
    () =>
      [item.location1, item.location2, item.location3, item.location4].map(
        (l) => l ?? '',
      ),
    [item.location1, item.location2, item.location3, item.location4],
  );

  const dropZoneRef = useRef<any>(null);

  const productLabel = useCallback(
    (cp: ConfiguredProduct, idx: number): string => {
      if (cp.productLabel) return cp.productLabel;
      const composed = `${cp.styleNumber ?? ''} ${cp.styleName ?? ''}`.trim();
      return composed || `Product ${idx + 1}`;
    },
    [],
  );

  // ── Mockup product selection ──────────────────────────────────────────────
  const handleDesignMockup = () => {
    if (productCount <= 1) {
      setSelectedProductIndex(0);
      setShowDesigner(true);
    } else {
      setVariantPickerVisible(true);
    }
  };

  const handlePickProductForMockup = (idx: number) => {
    setSelectedProductIndex(idx);
    setVariantPickerVisible(false);
    setShowDesigner(true);
  };

  // ── Product CRUD ──────────────────────────────────────────────────────────
  const handleProductChange = useCallback(
    (idx: number, cp: ConfiguredProduct) =>
      onChange(updateProductAt(itemRef.current, idx, cp)),
    [onChange],
  );
  const handleAddProduct = useCallback(
    () => onChange(addProduct(itemRef.current)),
    [onChange],
  );
  const handleDuplicateProduct = useCallback(
    (idx: number) => onChange(duplicateProductAt(itemRef.current, idx)),
    [onChange],
  );
  const handleRemoveProduct = useCallback(
    (idx: number) => {
      onChange(removeProductAt(itemRef.current, idx));
      setSelectedProductIndex((cur) => (cur >= idx && cur > 0 ? cur - 1 : cur));
    },
    [onChange],
  );

  // ── Promotional flat quantity ─────────────────────────────────────────────
  const [flatQty, setFlatQty] = useState(item.sizes.flat > 0 ? item.sizes.flat.toString() : '');
  const handleFlatQtyChange = (val: string) => {
    const num = parseInt(val) || 0;
    setFlatQty(val);
    const base = itemRef.current;
    const prods = getLineItemProducts(base);
    const p0 = prods[0];
    const cv0 = p0.colorVariants?.[0] ?? { color: '', sizes: { ...EMPTY_SIZES } };
    onChange(
      updateProductAt(base, 0, {
        ...p0,
        colorVariants: [
          { ...cv0, sizes: { ...cv0.sizes, flat: num } },
          ...(p0.colorVariants?.slice(1) ?? []),
        ],
      }),
    );
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
  const dtfRateNum = parseCents(dtfRate);
  const dtfSquareInches1 = dtfWidth1Num * dtfHeight1Num;
  const dtfCalculatedCost1 = Math.round(dtfSquareInches1 * dtfRateNum * 100) / 100;
  const dtfSquareInches2 = dtfWidth2Num * dtfHeight2Num;
  const dtfCalculatedCost2 = Math.round(dtfSquareInches2 * dtfRateNum * 100) / 100;
  const dtfTotalCalculatedCost = dtfCalculatedCost1 + dtfCalculatedCost2;

  // RATE: POS / banking style entry — every digit fills from the hundredths
  // place and shifts left (e.g. "3" -> 0.03). parseInt collapses leading zeros
  // so backspace shifts right cleanly and select-all-then-type starts fresh.
  const applyPosEdit = (text: string): string => {
    const n = parseInt(text.replace(/\D/g, ''), 10);
    return Number.isNaN(n) || n === 0 ? '' : String(n);
  };
  const dtfFieldVal = (id: string, raw: string) =>
    focusedDtfField === id && raw === '' ? '' : formatCents(raw);

  // WIDTH / HEIGHT: whole-number-first decimal entry — typed digits are whole
  // inches ("12" -> 12.00, never 0.12). Quarter-inch values are typed with a
  // dot ("12.25"). Raw text is stored, shown as-is while focused, and formatted
  // to two decimals once blurred.
  const normalizeDim = (raw: string): string => {
    const n = parseFloat(raw);
    return Number.isNaN(n) || n === 0 ? '' : String(n);
  };
  const dimFieldVal = (id: string, raw: string): string => {
    if (focusedDtfField === id) return raw;
    if (raw === '') return '';
    const n = parseFloat(raw);
    return Number.isNaN(n) ? '' : n.toFixed(2);
  };

  // ── DTF Transfers computed values ─────────────────────────────────────────
  const dtfTWholesaleCostNum = parseFloat(dtfTWholesaleCost) || 0;
  const dtfTMarkupPctNum = parseFloat(dtfTMarkupPct) || 0;
  const dtfTSuggestedSell = dtfTWholesaleCostNum * (1 + dtfTMarkupPctNum / 100);

  // ── Screen Printing computed values ───────────────────────────────────────
  const spVendorCostTotal = locationSlots.reduce((sum, loc, idx) => {
    if (!loc) return sum;
    return sum + (parseFloat(spLocations[idx]?.vendorCost || '0') || 0);
  }, 0);
  const spSuggestedSellTotal = parseCents(spSuggestedPrice);

  // ── Embroidery computed values ────────────────────────────────────────────
  const embVendorCostTotal = locationSlots.reduce((sum, loc, idx) => {
    if (!loc) return sum;
    return sum + (parseFloat(embLocations[idx]?.vendorCost || '0') || 0);
  }, 0);
  const embSuggestedSellTotal = parseCents(embSuggestedPrice);

  // ── Promotional Products computed values ──────────────────────────────────
  const promoProductCostNum = parseFloat(promoProductCost) || 0;
  const promoFreightNum = parseFloat(promoFreight) || 0;
  const promoHandlingNum = parseFloat(promoHandling) || 0;
  const promoVendorCost = promoProductCostNum + promoFreightNum + promoHandlingNum;
  const promoMarkupPctNum = parseFloat(promoMarkupPct) || 0;
  const promoSuggestedSell = promoVendorCost * (1 + promoMarkupPctNum / 100);

  const handleServiceStyleChange = (style: typeof item.serviceStyle) => {
    const base = itemRef.current;
    const dbStyle = dbServiceStyles.find((s) => s.name === style);
    const updates: Parameters<typeof updateDesignFields>[1] = {
      serviceStyle: style,
      applicator:
        style === 'Direct to Film' && !base.applicator
          ? 'Katalyst Ko Printshop'
          : base.applicator,
    };
    if (dbStyle?.defaultMargin != null) {
      updates.markupEach = dbStyle.defaultMargin;
    }
    const updated = updateDesignFields(base, updates);
    if (dbStyle && dbStyle.defaultProductionCosts.length > 0) {
      const newCosts: QuoteAdjustment[] = dbStyle.defaultProductionCosts
        .map((costId) => {
          const entry = costLibrary.find((e: any) => e.id === costId && e.enabled);
          if (!entry) return null;
          return {
            id: `ss_${costId}_${Date.now()}`,
            name: entry.name,
            type: entry.calculationType as QuoteAdjustment['type'],
            rate: entry.rate,
            quantity: 1,
          } satisfies QuoteAdjustment;
        })
        .filter(Boolean) as QuoteAdjustment[];
      if (newCosts.length > 0) {
        onChange({ ...updated, productionCosts: newCosts });
        return;
      }
    }
    onChange(updated);
  };

  const applyDTFCost = () => {
    if (dtfTotalCalculatedCost > 0) {
      onChange(
        updateDesignFields(itemRef.current, { serviceCostEach: dtfTotalCalculatedCost }),
      );
    }
  };

  const applyTransfersCost = () => {
    if (dtfTWholesaleCostNum > 0) {
      onChange(updateDesignFields(itemRef.current, { serviceCostEach: dtfTWholesaleCostNum }));
    }
  };

  const applySpCost = () => {
    if (spVendorCostTotal > 0) {
      onChange(updateDesignFields(itemRef.current, { serviceCostEach: spVendorCostTotal }));
    }
  };

  const applyEmbCost = () => {
    if (embVendorCostTotal > 0) {
      onChange(updateDesignFields(itemRef.current, { serviceCostEach: embVendorCostTotal }));
    }
  };

  const applyPromoCost = () => {
    if (promoVendorCost > 0) {
      onChange(updateDesignFields(itemRef.current, { serviceCostEach: promoVendorCost }));
    }
  };


  const updateLocation = (idx: number, value: string): LineItem => {
    const base = itemRef.current;
    const locs = [base.location1, base.location2, base.location3, base.location4].map(
      (l) => l ?? '',
    );
    locs[idx] = value;
    while (locs.length > 0 && !locs[locs.length - 1]) locs.pop();
    return updateDesignFields(base, {
      location1: locs[0] ?? '',
      location2: locs[1] ?? '',
      location3: locs[2],
      location4: locs[3],
    });
  };

  const highestFilledLocation = locationSlots.reduce(
    (m, l, i) => (l ? i : m),
    -1,
  );
  const visibleLocationCount = Math.min(
    4,
    Math.max(1, highestFilledLocation + 1, locationRowCount),
  );
  const handleAddLocationRow = () =>
    setLocationRowCount(
      Math.min(4, Math.max(locationRowCount, highestFilledLocation + 1) + 1),
    );

  const updateLocationDetails = (value: string): LineItem =>
    updateDesignFields(itemRef.current, { locationDetails: value });

  // ── PRODUCTION COSTS / OTHER CHARGES itemized tables ──────────────────────
  const productionCosts = item.productionCosts ?? [];
  const otherCharges = item.otherCharges ?? [];
  const updateProductionCosts = useCallback(
    (rows: QuoteAdjustment[]) =>
      onChange(updateDesignFields(itemRef.current, { productionCosts: rows })),
    [onChange],
  );
  const updateOtherCharges = useCallback(
    (rows: QuoteAdjustment[]) =>
      onChange(updateDesignFields(itemRef.current, { otherCharges: rows })),
    [onChange],
  );


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
    if (Platform.OS !== 'web') return;
    const node = dropZoneRef.current;
    if (!node) return;
    const handleDragOver = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); };
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const file = (e as any).dataTransfer?.files?.[0];
      if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (ev: any) => {
          if (ev.target?.result)
            onChange(updateDesignFields(itemRef.current, { mockupUri: ev.target.result as string }));
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
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>

      {/* ── Header (always visible) ── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerLeftPress}
          onPress={() => setExpanded(!expanded)}
          activeOpacity={0.8}
        >
          <View style={styles.indexBadge}>
            <Text style={styles.indexText}>{index + 1}</Text>
          </View>
          {item.mockupUri && (
            <Image
              source={{ uri: item.mockupUri }}
              style={styles.headerThumbnail}
              resizeMode="cover"
            />
          )}
          <View style={styles.headerTextWrap}>
            <Text style={styles.title} numberOfLines={1}>
              {item.designName || 'Untitled Design'}
            </Text>
            <Text style={styles.subtitle}>
              {item.serviceStyle}
              {productCount > 1 ? ` • ${productCount} Products` : ''} • {quantity} pcs
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.chevronBtn}
            onPress={() => setExpanded(!expanded)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {expanded ? (
              <ChevronUp size={18} color="rgba(255,255,255,0.7)" />
            ) : (
              <ChevronDown size={18} color="rgba(255,255,255,0.7)" />
            )}
          </TouchableOpacity>
          <OverlayMenu
            menuWidth={195}
            align="right"
            trigger={({ open }) => (
              <TouchableOpacity
                onPress={open}
                style={styles.headerKebabBtn}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              >
                <MoreVertical size={18} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            )}
          >
            {({ close }) => (
              <>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => { close(); handleDesignMockup(); }}
                >
                  <Brush size={14} color={Colors.light.tint} />
                  <Text style={styles.menuItemText}>Design Mockup</Text>
                </TouchableOpacity>
                {onDuplicate && (
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => { close(); onDuplicate(); }}
                  >
                    <Copy size={14} color={Colors.light.textSecondary} />
                    <Text style={styles.menuItemText}>Duplicate Line Item</Text>
                  </TouchableOpacity>
                )}
                <View style={styles.menuDivider} />
                <TouchableOpacity
                  style={styles.menuItemDanger}
                  onPress={() => { close(); handleDelete(); }}
                >
                  <Trash2 size={14} color={Colors.light.error} />
                  <Text style={styles.menuItemDangerText}>Delete Line Item</Text>
                </TouchableOpacity>
              </>
            )}
          </OverlayMenu>
        </View>
      </View>

      {/* ── MockupDesigner modal ── */}
      <MockupDesigner
        visible={showDesigner}
        onClose={() => setShowDesigner(false)}
        onSave={(uri) => {
          onChange(updateDesignFields(itemRef.current, { mockupUri: uri }));
          setShowDesigner(false);
        }}
        initialMockupUri={item.mockupUri}
        suggestedLocations={[item.location1, item.location2].filter(Boolean)}
        initialVariant={{
          vendor: item.apparelProvider,
          product: productLabel(products[safeProductIndex] ?? products[0], safeProductIndex),
          color: (products[safeProductIndex] ?? products[0])?.colorVariants?.[0]?.color,
        }}
        configuredProduct={products[safeProductIndex] ?? products[0]}
        onConfiguredProductChange={(cp) => {
          handleProductChange(safeProductIndex, cp);
        }}
        onRequestChangeProduct={
          productCount > 1
            ? () => {
                setShowDesigner(false);
                setVariantPickerVisible(true);
              }
            : undefined
        }
        onColorChange={(colorName) => {
          const cp = products[safeProductIndex] ?? products[0];
          if (!cp) return;
          const updatedCp: ConfiguredProduct = {
            ...cp,
            colorVariants: cp.colorVariants.length
              ? cp.colorVariants.map((cv, i) =>
                  i === 0 ? { ...cv, color: colorName } : cv,
                )
              : [{ color: colorName, sizes: { ...EMPTY_SIZES } }],
          };
          handleProductChange(safeProductIndex, updatedCp);
        }}
      />

      {/* ── Product picker modal ── */}
      <Modal
        visible={variantPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setVariantPickerVisible(false)}
      >
        <Pressable
          style={styles.vpOverlay}
          onPress={() => setVariantPickerVisible(false)}
        />
        <View style={styles.vpPanel}>
          <Text style={styles.vpTitle}>Use this garment for the mockup?</Text>
          {products.map((cp, idx) => {
            const colorSummary = (cp.colorVariants ?? [])
              .map((cv) => cv.color)
              .filter(Boolean)
              .join(', ');
            return (
              <TouchableOpacity
                key={idx}
                style={styles.vpRow}
                onPress={() => handlePickProductForMockup(idx)}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.vpProduct} numberOfLines={1}>
                    Product #{idx + 1} — {productLabel(cp, idx)}
                  </Text>
                  <Text style={styles.vpColor} numberOfLines={1}>
                    {colorSummary || 'No color specified'}
                  </Text>
                </View>
                <CheckCircle
                  size={16}
                  color={idx === safeProductIndex ? Colors.light.tint : Colors.light.border}
                />
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            style={styles.vpCancel}
            onPress={() => setVariantPickerVisible(false)}
          >
            <Text style={styles.vpCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ── Expanded body ── */}
      {expanded && (
        <View style={styles.expandedBody}>

          {/* ── Row 1: Design Details | Products + Sizes ── */}
          <View style={[styles.twoColRow, useSideBySide && styles.twoColRowWeb]}>

            {/* LEFT: Design Details panel */}
            <View style={[styles.panel, useSideBySide && styles.designPanelWeb]}>
              <View style={styles.panelHeader}>
                <Text style={styles.panelTitle}>DESIGN DETAILS</Text>
              </View>

              <View style={[styles.designBody, useSideBySide && styles.designBodyRow]}>
                {/* Mockup thumbnails sub-column (web only) */}
                {useSideBySide && (
                  <View style={styles.mockupThumbs}>
                    <Text style={styles.mockupViewLabel}>FRONT</Text>
                    {item.mockupUri ? (
                      <Image
                        source={{ uri: item.mockupUri }}
                        style={styles.mockupThumb}
                        resizeMode="contain"
                      />
                    ) : (
                      <View style={styles.mockupThumbEmpty}>
                        <Brush size={18} color={Colors.light.border} />
                      </View>
                    )}
                    <Text style={[styles.mockupViewLabel, { marginTop: 8 }]}>BACK</Text>
                    <View style={styles.mockupThumbEmpty} />
                    <TouchableOpacity
                      style={styles.changeMockupBtn}
                      onPress={handleDesignMockup}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.changeMockupText}>Change Mockup</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Form fields column */}
                <View style={styles.fieldsCol}>
                  {/* Mobile: compact mockup trigger */}
                  {!useSideBySide && (
                    <TouchableOpacity
                      style={styles.mobileChangeMockup}
                      onPress={handleDesignMockup}
                      activeOpacity={0.7}
                    >
                      {item.mockupUri && (
                        <Image
                          source={{ uri: item.mockupUri }}
                          style={styles.mobileThumb}
                          resizeMode="contain"
                        />
                      )}
                      <Brush size={14} color={Colors.light.tint} />
                      <Text style={styles.mobileChangeMockupText}>
                        {item.mockupUri ? 'Change Mockup' : 'Design Mockup'}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* ── DESIGN ── */}
                  <Text style={[styles.fieldGroupLabel, { marginTop: 8 }]}>DESIGN</Text>

                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Design Name</Text>
                    <TextInput
                      style={styles.designNameInput}
                      value={item.designName}
                      onChangeText={(v) => onChange({ ...item, designName: v })}
                      placeholder="Untitled Design"
                      placeholderTextColor={Colors.light.textSecondary}
                    />
                  </View>

                  <View style={[styles.fieldRow, { alignItems: 'flex-start' }]}>
                    <Text style={[styles.fieldLabel, { marginTop: 6 }]}>Project Notes</Text>
                    <TextInput
                      style={styles.notesInput}
                      value={item.locationDetails}
                      onChangeText={(v) => onChange(updateLocationDetails(v))}
                      placeholder="Add notes here..."
                      placeholderTextColor={Colors.light.textSecondary}
                      multiline
                      numberOfLines={2}
                    />
                  </View>

                  {/* ── PRODUCTION ── */}
                  <Text style={styles.fieldGroupLabel}>PRODUCTION</Text>

                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Service Style</Text>
                    <OverlayMenu
                      menuWidth={210}
                      align="right"
                      trigger={({ open }) => (
                        <TouchableOpacity
                          style={styles.fieldDropBtn}
                          onPress={open}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.fieldDropValue} numberOfLines={1}>
                            {item.serviceStyle || 'Select'}
                          </Text>
                          <ChevronDown size={11} color={Colors.light.textSecondary} />
                        </TouchableOpacity>
                      )}
                    >
                      {({ close }) => (
                        <>
                          {serviceStyleList.map((s) => (
                            <TouchableOpacity
                              key={s}
                              style={styles.menuItem}
                              onPress={() => {
                                close();
                                handleServiceStyleChange(s as typeof item.serviceStyle);
                              }}
                            >
                              <Text
                                style={[
                                  styles.menuItemText,
                                  item.serviceStyle === s && styles.menuItemActive,
                                ]}
                              >
                                {s}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </>
                      )}
                    </OverlayMenu>
                  </View>

                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Product Source</Text>
                    <OverlayMenu
                      menuWidth={220}
                      align="right"
                      trigger={({ open }) => (
                        <TouchableOpacity
                          style={styles.fieldDropBtn}
                          onPress={open}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.fieldDropValue} numberOfLines={1}>
                            {item.apparelProvider || 'Select'}
                          </Text>
                          <ChevronDown size={11} color={Colors.light.textSecondary} />
                        </TouchableOpacity>
                      )}
                    >
                      {({ close }) => (
                        <>
                          {APPAREL_PROVIDERS.map((p) => (
                            <TouchableOpacity
                              key={p}
                              style={styles.menuItem}
                              onPress={() => {
                                close();
                                onChange(
                                  updateDesignFields(itemRef.current, { apparelProvider: p }),
                                );
                              }}
                            >
                              <Text
                                style={[
                                  styles.menuItemText,
                                  item.apparelProvider === p && styles.menuItemActive,
                                ]}
                              >
                                {p}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </>
                      )}
                    </OverlayMenu>
                  </View>

                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Priority</Text>
                    <OverlayMenu
                      menuWidth={160}
                      align="right"
                      trigger={({ open }) => (
                        <TouchableOpacity
                          style={styles.fieldDropBtn}
                          onPress={open}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.fieldDropValue,
                              item.priority &&
                                item.priority !== 'Normal' &&
                                styles.priorityHighlight,
                            ]}
                            numberOfLines={1}
                          >
                            {item.priority || 'Normal'}
                          </Text>
                          <ChevronDown size={11} color={Colors.light.textSecondary} />
                        </TouchableOpacity>
                      )}
                    >
                      {({ close }) => (
                        <>
                          {PROJECT_PRIORITIES.map((p) => (
                            <TouchableOpacity
                              key={p}
                              style={styles.menuItem}
                              onPress={() => {
                                close();
                                onChange(
                                  updateDesignFields(itemRef.current, { priority: p }),
                                );
                              }}
                            >
                              <Text
                                style={[
                                  styles.menuItemText,
                                  (item.priority || 'Normal') === p && styles.menuItemActive,
                                ]}
                              >
                                {p}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </>
                      )}
                    </OverlayMenu>
                  </View>

                  {/* ── LOCATIONS ── */}
                  {!isPromotional && !isDTFTransfers && (
                    <>
                      <Text style={styles.fieldGroupLabel}>LOCATIONS</Text>
                      {Array.from({ length: visibleLocationCount }).map((_, i) => {
                        const locVal = locationSlots[i] ?? '';
                        return (
                          <View style={styles.fieldRow} key={i}>
                            <Text style={styles.fieldLabel}>Location #{i + 1}</Text>
                            <OverlayMenu
                              menuWidth={210}
                              align="right"
                              trigger={({ open }) => (
                                <TouchableOpacity
                                  style={styles.fieldDropBtn}
                                  onPress={open}
                                  activeOpacity={0.7}
                                >
                                  <Text
                                    style={[
                                      styles.fieldDropValue,
                                      !locVal && styles.fieldDropPlaceholder,
                                    ]}
                                    numberOfLines={1}
                                  >
                                    {locVal || 'Select Location'}
                                  </Text>
                                  <ChevronDown size={11} color={Colors.light.textSecondary} />
                                </TouchableOpacity>
                              )}
                            >
                              {({ close }) => (
                                <>
                                  {LOCATIONS.map((loc) => (
                                    <TouchableOpacity
                                      key={loc}
                                      style={styles.menuItem}
                                      onPress={() => { close(); onChange(updateLocation(i, loc)); }}
                                    >
                                      <Text
                                        style={[
                                          styles.menuItemText,
                                          locVal === loc && styles.menuItemActive,
                                        ]}
                                      >
                                        {loc}
                                      </Text>
                                    </TouchableOpacity>
                                  ))}
                                </>
                              )}
                            </OverlayMenu>
                          </View>
                        );
                      })}
                      {visibleLocationCount < 4 && (
                        <TouchableOpacity
                          style={styles.addLocationBtn}
                          onPress={handleAddLocationRow}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.addLocationText}>+ Add Location</Text>
                        </TouchableOpacity>
                      )}
                    </>
                  )}

                </View>
              </View>
            </View>

            {/* RIGHT: Products + Sizes panel */}
            <View style={[styles.panel, useSideBySide && styles.productsPanelWeb]}>
              {!isDTFTransfers && (
                <>
                  <View style={styles.panelHeader}>
                    <Text style={styles.panelTitle}>
                      PRODUCTS + SIZES ({productCount})
                    </Text>
                    {!isPromotional && (
                      <TouchableOpacity
                        style={styles.addProductHdrBtn}
                        onPress={handleAddProduct}
                        activeOpacity={0.85}
                      >
                        <Plus size={12} color="#fff" />
                        <Text style={styles.addProductHdrBtnText}>Add Product</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {isPromotional ? (
                    <View style={styles.promotionalQtyWrap}>
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
                    <>
                      {products.map((cp, idx) => (
                        <QuoteProductRow
                          key={idx}
                          cp={cp}
                          idx={idx}
                          onChange={(next) => handleProductChange(idx, next)}
                          onDuplicate={() => handleDuplicateProduct(idx)}
                          onRemove={() => handleRemoveProduct(idx)}
                          onUseForMockup={() => handlePickProductForMockup(idx)}
                          canRemove={productCount > 1}
                          allProducts={catalogProducts}
                        />
                      ))}
                      <TouchableOpacity
                        style={styles.addProductFooterBtn}
                        onPress={handleAddProduct}
                        activeOpacity={0.8}
                      >
                        <Plus size={13} color={Colors.light.tint} />
                        <Text style={styles.addProductFooterText}>Add Product</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </>
              )}
              {/* ── Calculator: stacked below Products+Sizes in right column ── */}
              {hasCalculator && (
              <View style={styles.calcPanel}>
                <View style={styles.panelHeader}>
                  <Text style={styles.panelTitle}>
                    {isEmbroidery
                      ? 'EMBROIDERY COST CALCULATOR'
                      : isScreenPrinting
                        ? 'SCREEN PRINTING CALCULATOR'
                        : isDTF
                          ? 'DTF PRINTING CALCULATOR'
                          : isDTFTransfers
                            ? 'DTF TRANSFERS (WHOLESALE) CALCULATOR'
                            : 'PROMOTIONAL PRODUCTS CALCULATOR'}
                  </Text>
                </View>
                <View style={styles.calcBody}>

                  {/* ═══ 1. DTF Printing Calculator ═══ */}
                  {isDTF && (
                    <View>
                      <View style={styles.dtfControlsRow}>
                        <View style={[styles.dtfControlChip, { opacity: 0.55 }]}>
                          <Text style={styles.dtfControlChipLabel}>VENDOR</Text>
                          <Text style={[styles.dtfControlChipValue, { fontSize: 10 }]} numberOfLines={1}>
                            No Vendors Configured
                          </Text>
                        </View>

                        {productionPresets.length === 0 ? (
                          <View style={[styles.dtfControlChip, { opacity: 0.55 }]}>
                            <Text style={styles.dtfControlChipLabel}>PRICING PRESET</Text>
                            <Text style={[styles.dtfControlChipValue, { fontSize: 10 }]} numberOfLines={1}>
                              No Presets Configured
                            </Text>
                          </View>
                        ) : (
                          <OverlayMenu menuWidth={210} align="left"
                            trigger={({ open }) => (
                              <TouchableOpacity style={styles.dtfControlChip} onPress={open} activeOpacity={0.75}>
                                <Text style={styles.dtfControlChipLabel}>PRICING PRESET</Text>
                                <View style={styles.dtfControlChipValueRow}>
                                  <Text style={styles.dtfControlChipValue} numberOfLines={1}>
                                    {dtfPreset || 'Select…'}
                                  </Text>
                                  <ChevronDown size={9} color={Colors.light.textSecondary} />
                                </View>
                              </TouchableOpacity>
                            )}
                          >
                            {({ close }) => (
                              <>
                                {productionPresets.map((p: any) => (
                                  <TouchableOpacity key={p.id} style={styles.dtfMenuRow}
                                    onPress={() => {
                                      setDtfPreset(p.name);
                                      if (p.suggestedSellPrice != null) {
                                        setDtfSuggestedPrice(String(Math.round(p.suggestedSellPrice * 100)));
                                      }
                                      close();
                                    }}>
                                    <Text style={[styles.dtfMenuRowText, dtfPreset === p.name && styles.dtfMenuRowActive]}>
                                      {p.name}
                                    </Text>
                                  </TouchableOpacity>
                                ))}
                              </>
                            )}
                          </OverlayMenu>
                        )}

                        <View style={styles.dtfSuggestedGroup}>
                          <Text style={styles.dtfControlChipLabel}>SUGGESTED SELL</Text>
                          <View style={styles.dtfInputWrapper}>
                            <Text style={styles.dtfDollar}>$</Text>
                            <TextInput
                              style={styles.dtfRateInput}
                              value={focusedSuggestedPrice && dtfSuggestedPrice === '' ? '' : formatCents(dtfSuggestedPrice)}
                              onChangeText={(t) => setDtfSuggestedPrice(applyPosEdit(t))}
                              onFocus={() => setFocusedSuggestedPrice(true)}
                              onBlur={() => setFocusedSuggestedPrice(false)}
                              keyboardType="number-pad"
                              placeholder="0.00"
                              placeholderTextColor={Colors.light.textSecondary}
                              selectTextOnFocus
                            />
                          </View>
                        </View>
                      </View>

                      <Text style={styles.calcLocationLabel}>
                        Location #1{item.location1 ? ` (${item.location1})` : ''}
                      </Text>
                      <View style={styles.dtfCalcRow}>
                        <View style={styles.dtfInputGroupFixed}>
                          <Text style={styles.dtfInputLabel}>WIDTH</Text>
                          <View style={styles.dtfInputWrapper}>
                            <TextInput
                              style={styles.dtfInput}
                              value={dimFieldVal('w1', dtfWidth1)}
                              onChangeText={(t) => setDtfWidth1(formatDecimalInput(t))}
                              onFocus={() => setFocusedDtfField('w1')}
                              onBlur={() => { setDtfWidth1(normalizeDim(dtfWidth1)); setFocusedDtfField(null); }}
                              keyboardType="decimal-pad"
                              placeholder="0.00"
                              placeholderTextColor={Colors.light.textSecondary}
                              selectTextOnFocus
                            />
                            <Text style={styles.dtfInputSuffix}>in</Text>
                          </View>
                        </View>
                        <Text style={styles.dtfOperator}>×</Text>
                        <View style={styles.dtfInputGroupFixed}>
                          <Text style={styles.dtfInputLabel}>HEIGHT</Text>
                          <View style={styles.dtfInputWrapper}>
                            <TextInput
                              style={styles.dtfInput}
                              value={dimFieldVal('h1', dtfHeight1)}
                              onChangeText={(t) => setDtfHeight1(formatDecimalInput(t))}
                              onFocus={() => setFocusedDtfField('h1')}
                              onBlur={() => { setDtfHeight1(normalizeDim(dtfHeight1)); setFocusedDtfField(null); }}
                              keyboardType="decimal-pad"
                              placeholder="0.00"
                              placeholderTextColor={Colors.light.textSecondary}
                              selectTextOnFocus
                            />
                            <Text style={styles.dtfInputSuffix}>in</Text>
                          </View>
                        </View>
                        <Text style={styles.dtfOperator}>=</Text>
                        <View style={styles.dtfSqftCol}>
                          <Text style={styles.dtfInputLabel}>SQ IN</Text>
                          <View style={styles.dtfSqftBox}>
                            <Text style={styles.dtfSqftValue}>{dtfSquareInches1.toFixed(2)}</Text>
                          </View>
                        </View>
                        <Text style={styles.dtfOperator}>×</Text>
                        <View style={styles.dtfRateGroup}>
                          <Text style={styles.dtfInputLabel}>RATE</Text>
                          <View style={styles.dtfInputWrapper}>
                            <Text style={styles.dtfDollar}>$</Text>
                            <TextInput
                              style={styles.dtfRateInput}
                              value={dtfFieldVal('r1', dtfRate)}
                              onChangeText={(t) => setDtfRate(applyPosEdit(t))}
                              onFocus={() => setFocusedDtfField('r1')}
                              onBlur={() => setFocusedDtfField(null)}
                              keyboardType="number-pad"
                              placeholder="0.00"
                              placeholderTextColor={Colors.light.textSecondary}
                              selectTextOnFocus
                            />
                            <Text style={styles.dtfInputSuffix}>/sq in</Text>
                          </View>
                        </View>
                        <Text style={styles.dtfOperator}>=</Text>
                        <View style={styles.dtfTotalCol}>
                          <Text style={styles.dtfInputLabel}>COST</Text>
                          <View style={styles.dtfDisplayBox}>
                            <Text style={styles.dtfTotalColVal}>${dtfCalculatedCost1.toFixed(2)}</Text>
                          </View>
                        </View>
                      </View>

                      {hasSecondLocation && (
                        <>
                          <View style={styles.dtfLocationDivider} />
                          <Text style={styles.calcLocationLabel}>
                            Location #2 ({item.location2})
                          </Text>
                          <View style={styles.dtfCalcRow}>
                            <View style={styles.dtfInputGroupFixed}>
                              <Text style={styles.dtfInputLabel}>WIDTH</Text>
                              <View style={styles.dtfInputWrapper}>
                                <TextInput
                                  style={styles.dtfInput}
                                  value={dimFieldVal('w2', dtfWidth2)}
                                  onChangeText={(t) => setDtfWidth2(formatDecimalInput(t))}
                                  onFocus={() => setFocusedDtfField('w2')}
                                  onBlur={() => { setDtfWidth2(normalizeDim(dtfWidth2)); setFocusedDtfField(null); }}
                                  keyboardType="decimal-pad"
                                  placeholder="0.00"
                                  placeholderTextColor={Colors.light.textSecondary}
                                  selectTextOnFocus
                                />
                                <Text style={styles.dtfInputSuffix}>in</Text>
                              </View>
                            </View>
                            <Text style={styles.dtfOperator}>×</Text>
                            <View style={styles.dtfInputGroupFixed}>
                              <Text style={styles.dtfInputLabel}>HEIGHT</Text>
                              <View style={styles.dtfInputWrapper}>
                                <TextInput
                                  style={styles.dtfInput}
                                  value={dimFieldVal('h2', dtfHeight2)}
                                  onChangeText={(t) => setDtfHeight2(formatDecimalInput(t))}
                                  onFocus={() => setFocusedDtfField('h2')}
                                  onBlur={() => { setDtfHeight2(normalizeDim(dtfHeight2)); setFocusedDtfField(null); }}
                                  keyboardType="decimal-pad"
                                  placeholder="0.00"
                                  placeholderTextColor={Colors.light.textSecondary}
                                  selectTextOnFocus
                                />
                                <Text style={styles.dtfInputSuffix}>in</Text>
                              </View>
                            </View>
                            <Text style={styles.dtfOperator}>=</Text>
                            <View style={styles.dtfSqftCol}>
                              <Text style={styles.dtfInputLabel}>SQ IN</Text>
                              <View style={styles.dtfSqftBox}>
                                <Text style={styles.dtfSqftValue}>{dtfSquareInches2.toFixed(2)}</Text>
                              </View>
                            </View>
                            <Text style={styles.dtfOperator}>×</Text>
                            <View style={styles.dtfRateGroup}>
                              <Text style={styles.dtfInputLabel}>RATE</Text>
                              <View style={styles.dtfInputWrapper}>
                                <Text style={styles.dtfDollar}>$</Text>
                                <TextInput
                                  style={styles.dtfRateInput}
                                  value={formatCents(dtfRate)}
                                  editable={false}
                                  keyboardType="number-pad"
                                  placeholderTextColor={Colors.light.textSecondary}
                                />
                                <Text style={styles.dtfInputSuffix}>/sq in</Text>
                              </View>
                            </View>
                            <Text style={styles.dtfOperator}>=</Text>
                            <View style={styles.dtfTotalCol}>
                              <Text style={styles.dtfInputLabel}>COST</Text>
                              <View style={styles.dtfDisplayBox}>
                                <Text style={styles.dtfTotalColVal}>${dtfCalculatedCost2.toFixed(2)}</Text>
                              </View>
                            </View>
                          </View>
                        </>
                      )}

                      {(() => {
                        const vc = dtfTotalCalculatedCost;
                        const ss = parseCents(dtfSuggestedPrice);
                        const profit = ss - vc;
                        const margin = ss > 0 ? (profit / ss) * 100 : 0;
                        return (
                          <View style={styles.calcSummarySection}>
                            <View style={styles.calcSummaryRow}>
                              <Text style={styles.calcSummaryLabel}>VENDOR COST</Text>
                              <Text style={styles.calcSummaryValue}>{formatCurrency(vc)}</Text>
                            </View>
                            <View style={styles.calcSummaryRow}>
                              <Text style={styles.calcSummaryLabel}>SUGGESTED SELL</Text>
                              <Text style={styles.calcSummaryValue}>{formatCurrency(ss)}</Text>
                            </View>
                            <View style={styles.calcSummaryRow}>
                              <Text style={styles.calcSummaryLabel}>ESTIMATED PROFIT</Text>
                              <Text style={[styles.calcSummaryValue, { color: profit >= 0 ? '#16a34a' : Colors.light.error }]}>
                                {formatCurrency(profit)}
                              </Text>
                            </View>
                            <View style={styles.calcSummaryRow}>
                              <Text style={styles.calcSummaryLabel}>MARGIN %</Text>
                              <Text style={styles.calcSummaryValue}>
                                {isFinite(margin) && ss > 0 ? `${margin.toFixed(1)}%` : '—'}
                              </Text>
                            </View>
                            <TouchableOpacity
                              style={[styles.applyBtn, vc === 0 && styles.applyBtnDisabled]}
                              disabled={vc === 0}
                              onPress={applyDTFCost}
                            >
                              <Text style={styles.applyBtnText}>Apply to Line Item</Text>
                            </TouchableOpacity>
                          </View>
                        );
                      })()}
                    </View>
                  )}

                  {/* ═══ 2. DTF Transfers (Wholesale) Calculator ═══ */}
                  {isDTFTransfers && (
                    <View>
                      <View style={styles.dtfControlsRow}>
                        <View style={[styles.dtfControlChip, { opacity: 0.55 }]}>
                          <Text style={styles.dtfControlChipLabel}>VENDOR</Text>
                          <Text style={[styles.dtfControlChipValue, { fontSize: 10 }]} numberOfLines={1}>
                            No Vendors Configured
                          </Text>
                        </View>

                        {productionPresets.length === 0 ? (
                          <View style={[styles.dtfControlChip, { opacity: 0.55 }]}>
                            <Text style={styles.dtfControlChipLabel}>PRICING PRESET</Text>
                            <Text style={[styles.dtfControlChipValue, { fontSize: 10 }]} numberOfLines={1}>
                              No Presets Configured
                            </Text>
                          </View>
                        ) : (
                          <OverlayMenu menuWidth={210} align="left"
                            trigger={({ open }) => (
                              <TouchableOpacity style={styles.dtfControlChip} onPress={open} activeOpacity={0.75}>
                                <Text style={styles.dtfControlChipLabel}>PRICING PRESET</Text>
                                <View style={styles.dtfControlChipValueRow}>
                                  <Text style={styles.dtfControlChipValue} numberOfLines={1}>
                                    {dtfPreset || 'Select…'}
                                  </Text>
                                  <ChevronDown size={9} color={Colors.light.textSecondary} />
                                </View>
                              </TouchableOpacity>
                            )}
                          >
                            {({ close }) => (
                              <>
                                {productionPresets.map((p: any) => (
                                  <TouchableOpacity key={p.id} style={styles.dtfMenuRow}
                                    onPress={() => {
                                      setDtfPreset(p.name);
                                      if (p.suggestedSellPrice != null) {
                                        setDtfTWholesaleCost(String(p.suggestedSellPrice));
                                      }
                                      close();
                                    }}>
                                    <Text style={[styles.dtfMenuRowText, dtfPreset === p.name && styles.dtfMenuRowActive]}>
                                      {p.name}
                                    </Text>
                                  </TouchableOpacity>
                                ))}
                              </>
                            )}
                          </OverlayMenu>
                        )}
                      </View>

                      <View style={styles.calcRowSection}>
                        <Text style={styles.dtfInputLabel}>GANG SHEET WIDTH</Text>
                        <View style={styles.calcGangWidthRow}>
                          {(['22', '24', '30'] as const).map((w) => (
                            <TouchableOpacity
                              key={w}
                              style={[styles.calcGangWidthChip, dtfTGangWidth === w && styles.calcGangWidthChipActive]}
                              onPress={() => setDtfTGangWidth(w)}
                              activeOpacity={0.75}
                            >
                              <Text style={[styles.calcGangWidthChipText, dtfTGangWidth === w && styles.calcGangWidthChipTextActive]}>
                                {w}"
                              </Text>
                            </TouchableOpacity>
                          ))}
                          <TouchableOpacity
                            style={[styles.calcGangWidthChip, dtfTGangWidth === 'custom' && styles.calcGangWidthChipActive]}
                            onPress={() => setDtfTGangWidth('custom')}
                            activeOpacity={0.75}
                          >
                            <Text style={[styles.calcGangWidthChipText, dtfTGangWidth === 'custom' && styles.calcGangWidthChipTextActive]}>
                              Custom
                            </Text>
                          </TouchableOpacity>
                        </View>
                        {dtfTGangWidth === 'custom' && (
                          <View style={[styles.dtfInputWrapper, { marginTop: 8, alignSelf: 'flex-start' }]}>
                            <TextInput
                              style={[styles.dtfInput, { width: 70 }]}
                              value={dtfTCustomWidth}
                              onChangeText={(t) => setDtfTCustomWidth(t.replace(/[^0-9.]/g, ''))}
                              keyboardType="decimal-pad"
                              placeholder="0"
                              placeholderTextColor={Colors.light.textSecondary}
                            />
                            <Text style={styles.dtfInputSuffix}>in</Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.calcFieldsRow}>
                        <View style={styles.calcFieldItem}>
                          <Text style={styles.dtfInputLabel}>WHOLESALE COST</Text>
                          <View style={styles.dtfInputWrapper}>
                            <Text style={styles.dtfDollar}>$</Text>
                            <TextInput
                              style={[styles.dtfRateInput, { flex: 1 }]}
                              value={focusedDtfTField === 'wc' ? dtfTWholesaleCost : (dtfTWholesaleCostNum > 0 ? dtfTWholesaleCostNum.toFixed(2) : '')}
                              onChangeText={(t) => setDtfTWholesaleCost(t.replace(/[^0-9.]/g, ''))}
                              onFocus={() => setFocusedDtfTField('wc')}
                              onBlur={() => setFocusedDtfTField(null)}
                              keyboardType="decimal-pad"
                              placeholder="0.00"
                              placeholderTextColor={Colors.light.textSecondary}
                              selectTextOnFocus
                            />
                          </View>
                        </View>
                        <View style={styles.calcFieldItem}>
                          <Text style={styles.dtfInputLabel}>MARKUP %</Text>
                          <View style={styles.dtfInputWrapper}>
                            <TextInput
                              style={[styles.dtfRateInput, { flex: 1 }]}
                              value={dtfTMarkupPct}
                              onChangeText={(t) => setDtfTMarkupPct(t.replace(/[^0-9.]/g, ''))}
                              keyboardType="decimal-pad"
                              placeholder="100"
                              placeholderTextColor={Colors.light.textSecondary}
                              selectTextOnFocus
                            />
                            <Text style={styles.dtfInputSuffix}>%</Text>
                          </View>
                        </View>
                        <View style={styles.calcFieldItem}>
                          <Text style={styles.dtfInputLabel}>SELL PRICE / SHEET</Text>
                          <View style={[styles.dtfDisplayBox, { paddingHorizontal: 10, minWidth: 80 }]}>
                            <Text style={styles.dtfTotalColVal}>{formatCurrency(dtfTSuggestedSell)}</Text>
                          </View>
                        </View>
                      </View>

                      {(() => {
                        const vc = dtfTWholesaleCostNum;
                        const ss = dtfTSuggestedSell;
                        const profit = ss - vc;
                        const margin = ss > 0 ? (profit / ss) * 100 : 0;
                        return (
                          <View style={styles.calcSummarySection}>
                            <View style={styles.calcSummaryRow}>
                              <Text style={styles.calcSummaryLabel}>VENDOR COST</Text>
                              <Text style={styles.calcSummaryValue}>{formatCurrency(vc)}</Text>
                            </View>
                            <View style={styles.calcSummaryRow}>
                              <Text style={styles.calcSummaryLabel}>SUGGESTED SELL</Text>
                              <Text style={styles.calcSummaryValue}>{formatCurrency(ss)}</Text>
                            </View>
                            <View style={styles.calcSummaryRow}>
                              <Text style={styles.calcSummaryLabel}>ESTIMATED PROFIT</Text>
                              <Text style={[styles.calcSummaryValue, { color: profit >= 0 ? '#16a34a' : Colors.light.error }]}>
                                {formatCurrency(profit)}
                              </Text>
                            </View>
                            <View style={styles.calcSummaryRow}>
                              <Text style={styles.calcSummaryLabel}>MARGIN %</Text>
                              <Text style={styles.calcSummaryValue}>
                                {isFinite(margin) && ss > 0 ? `${margin.toFixed(1)}%` : '—'}
                              </Text>
                            </View>
                            <TouchableOpacity
                              style={[styles.applyBtn, vc === 0 && styles.applyBtnDisabled]}
                              disabled={vc === 0}
                              onPress={applyTransfersCost}
                            >
                              <Text style={styles.applyBtnText}>Apply to Line Item</Text>
                            </TouchableOpacity>
                          </View>
                        );
                      })()}
                    </View>
                  )}

                  {/* ═══ 3. Embroidery Calculator ═══ */}
                  {isEmbroidery && (
                    <View>
                      <View style={styles.dtfControlsRow}>
                        <View style={[styles.dtfControlChip, { opacity: 0.55 }]}>
                          <Text style={styles.dtfControlChipLabel}>VENDOR</Text>
                          <Text style={[styles.dtfControlChipValue, { fontSize: 10 }]} numberOfLines={1}>
                            No Vendors Configured
                          </Text>
                        </View>

                        {productionPresets.length === 0 ? (
                          <View style={[styles.dtfControlChip, { opacity: 0.55 }]}>
                            <Text style={styles.dtfControlChipLabel}>PRICING PRESET</Text>
                            <Text style={[styles.dtfControlChipValue, { fontSize: 10 }]} numberOfLines={1}>
                              No Presets Configured
                            </Text>
                          </View>
                        ) : (
                          <OverlayMenu menuWidth={210} align="left"
                            trigger={({ open }) => (
                              <TouchableOpacity style={styles.dtfControlChip} onPress={open} activeOpacity={0.75}>
                                <Text style={styles.dtfControlChipLabel}>PRICING PRESET</Text>
                                <View style={styles.dtfControlChipValueRow}>
                                  <Text style={styles.dtfControlChipValue} numberOfLines={1}>
                                    {embPreset || 'Select…'}
                                  </Text>
                                  <ChevronDown size={9} color={Colors.light.textSecondary} />
                                </View>
                              </TouchableOpacity>
                            )}
                          >
                            {({ close }) => (
                              <>
                                {productionPresets.map((p: any) => (
                                  <TouchableOpacity key={p.id} style={styles.dtfMenuRow}
                                    onPress={() => {
                                      setEmbPreset(p.name);
                                      if (p.suggestedSellPrice != null) {
                                        setEmbSuggestedPrice(String(Math.round(p.suggestedSellPrice * 100)));
                                      }
                                      close();
                                    }}>
                                    <Text style={[styles.dtfMenuRowText, embPreset === p.name && styles.dtfMenuRowActive]}>
                                      {p.name}
                                    </Text>
                                  </TouchableOpacity>
                                ))}
                              </>
                            )}
                          </OverlayMenu>
                        )}

                        <View style={styles.dtfSuggestedGroup}>
                          <Text style={styles.dtfControlChipLabel}>SUGGESTED SELL</Text>
                          <View style={styles.dtfInputWrapper}>
                            <Text style={styles.dtfDollar}>$</Text>
                            <TextInput
                              style={styles.dtfRateInput}
                              value={focusedEmbSuggested && embSuggestedPrice === '' ? '' : formatCents(embSuggestedPrice)}
                              onChangeText={(t) => setEmbSuggestedPrice(applyPosEdit(t))}
                              onFocus={() => setFocusedEmbSuggested(true)}
                              onBlur={() => setFocusedEmbSuggested(false)}
                              keyboardType="number-pad"
                              placeholder="0.00"
                              placeholderTextColor={Colors.light.textSecondary}
                              selectTextOnFocus
                            />
                          </View>
                        </View>
                      </View>

                      {locationSlots.every((l) => !l) ? (
                        <View style={styles.calcNoLocationsNote}>
                          <Text style={styles.calcNoLocationsText}>
                            Add decoration locations in Design Details to use this calculator.
                          </Text>
                        </View>
                      ) : (
                        locationSlots.map((loc, idx) => {
                          if (!loc) return null;
                          return (
                            <View key={idx} style={styles.calcLocationCard}>
                              <View style={styles.calcLocationCardHeader}>
                                <Text style={styles.calcLocationCardTitle}>
                                  Location {idx + 1}: {loc}
                                </Text>
                              </View>
                              <View style={styles.calcLocationCardBody}>
                                <View style={styles.calcFieldItem}>
                                  <Text style={styles.dtfInputLabel}>STITCH COUNT</Text>
                                  <View style={styles.dtfInputWrapper}>
                                    <TextInput
                                      style={[styles.dtfRateInput, { flex: 1 }]}
                                      value={embLocations[idx]?.stitchCount ?? ''}
                                      onChangeText={(t) => updateEmbLocation(idx, 'stitchCount', t.replace(/\D/g, ''))}
                                      keyboardType="number-pad"
                                      placeholder="e.g. 5000"
                                      placeholderTextColor={Colors.light.textSecondary}
                                      selectTextOnFocus
                                    />
                                  </View>
                                </View>
                                <View style={styles.calcFieldItem}>
                                  <Text style={styles.dtfInputLabel}>VENDOR COST</Text>
                                  <View style={styles.dtfInputWrapper}>
                                    <Text style={styles.dtfDollar}>$</Text>
                                    <TextInput
                                      style={[styles.dtfRateInput, { flex: 1 }]}
                                      value={embLocations[idx]?.vendorCost ?? ''}
                                      onChangeText={(t) => updateEmbLocation(idx, 'vendorCost', t.replace(/[^0-9.]/g, ''))}
                                      keyboardType="decimal-pad"
                                      placeholder="0.00"
                                      placeholderTextColor={Colors.light.textSecondary}
                                      selectTextOnFocus
                                    />
                                  </View>
                                </View>
                                <View style={styles.calcFieldItem}>
                                  <Text style={styles.dtfInputLabel}>SELL PRICE</Text>
                                  <View style={styles.dtfInputWrapper}>
                                    <Text style={styles.dtfDollar}>$</Text>
                                    <TextInput
                                      style={[styles.dtfRateInput, { flex: 1 }]}
                                      value={embLocations[idx]?.sellPrice ?? ''}
                                      onChangeText={(t) => updateEmbLocation(idx, 'sellPrice', t.replace(/[^0-9.]/g, ''))}
                                      keyboardType="decimal-pad"
                                      placeholder="0.00"
                                      placeholderTextColor={Colors.light.textSecondary}
                                      selectTextOnFocus
                                    />
                                  </View>
                                </View>
                              </View>
                            </View>
                          );
                        })
                      )}

                      {(() => {
                        const vc = embVendorCostTotal;
                        const ss = embSuggestedSellTotal;
                        const profit = ss - vc;
                        const margin = ss > 0 ? (profit / ss) * 100 : 0;
                        return (
                          <View style={styles.calcSummarySection}>
                            <View style={styles.calcSummaryRow}>
                              <Text style={styles.calcSummaryLabel}>VENDOR COST</Text>
                              <Text style={styles.calcSummaryValue}>{formatCurrency(vc)}</Text>
                            </View>
                            <View style={styles.calcSummaryRow}>
                              <Text style={styles.calcSummaryLabel}>SUGGESTED SELL</Text>
                              <Text style={styles.calcSummaryValue}>{formatCurrency(ss)}</Text>
                            </View>
                            <View style={styles.calcSummaryRow}>
                              <Text style={styles.calcSummaryLabel}>ESTIMATED PROFIT</Text>
                              <Text style={[styles.calcSummaryValue, { color: profit >= 0 ? '#16a34a' : Colors.light.error }]}>
                                {formatCurrency(profit)}
                              </Text>
                            </View>
                            <View style={styles.calcSummaryRow}>
                              <Text style={styles.calcSummaryLabel}>MARGIN %</Text>
                              <Text style={styles.calcSummaryValue}>
                                {isFinite(margin) && ss > 0 ? `${margin.toFixed(1)}%` : '—'}
                              </Text>
                            </View>
                            <TouchableOpacity
                              style={[styles.applyBtn, vc === 0 && styles.applyBtnDisabled]}
                              disabled={vc === 0}
                              onPress={applyEmbCost}
                            >
                              <Text style={styles.applyBtnText}>Apply to Line Item</Text>
                            </TouchableOpacity>
                          </View>
                        );
                      })()}
                    </View>
                  )}

                  {/* ═══ 4. Screen Printing Calculator ═══ */}
                  {isScreenPrinting && (
                    <View>
                      <View style={styles.dtfControlsRow}>
                        <View style={[styles.dtfControlChip, { opacity: 0.55 }]}>
                          <Text style={styles.dtfControlChipLabel}>VENDOR</Text>
                          <Text style={[styles.dtfControlChipValue, { fontSize: 10 }]} numberOfLines={1}>
                            No Vendors Configured
                          </Text>
                        </View>

                        {productionPresets.length === 0 ? (
                          <View style={[styles.dtfControlChip, { opacity: 0.55 }]}>
                            <Text style={styles.dtfControlChipLabel}>PRICING PRESET</Text>
                            <Text style={[styles.dtfControlChipValue, { fontSize: 10 }]} numberOfLines={1}>
                              No Presets Configured
                            </Text>
                          </View>
                        ) : (
                          <OverlayMenu menuWidth={210} align="left"
                            trigger={({ open }) => (
                              <TouchableOpacity style={styles.dtfControlChip} onPress={open} activeOpacity={0.75}>
                                <Text style={styles.dtfControlChipLabel}>PRICING PRESET</Text>
                                <View style={styles.dtfControlChipValueRow}>
                                  <Text style={styles.dtfControlChipValue} numberOfLines={1}>
                                    {spPreset || 'Select…'}
                                  </Text>
                                  <ChevronDown size={9} color={Colors.light.textSecondary} />
                                </View>
                              </TouchableOpacity>
                            )}
                          >
                            {({ close }) => (
                              <>
                                {productionPresets.map((p: any) => (
                                  <TouchableOpacity key={p.id} style={styles.dtfMenuRow}
                                    onPress={() => {
                                      setSpPreset(p.name);
                                      if (p.suggestedSellPrice != null) {
                                        setSpSuggestedPrice(String(Math.round(p.suggestedSellPrice * 100)));
                                      }
                                      close();
                                    }}>
                                    <Text style={[styles.dtfMenuRowText, spPreset === p.name && styles.dtfMenuRowActive]}>
                                      {p.name}
                                    </Text>
                                  </TouchableOpacity>
                                ))}
                              </>
                            )}
                          </OverlayMenu>
                        )}

                        <View style={styles.dtfSuggestedGroup}>
                          <Text style={styles.dtfControlChipLabel}>SUGGESTED SELL</Text>
                          <View style={styles.dtfInputWrapper}>
                            <Text style={styles.dtfDollar}>$</Text>
                            <TextInput
                              style={styles.dtfRateInput}
                              value={focusedSpSuggested && spSuggestedPrice === '' ? '' : formatCents(spSuggestedPrice)}
                              onChangeText={(t) => setSpSuggestedPrice(applyPosEdit(t))}
                              onFocus={() => setFocusedSpSuggested(true)}
                              onBlur={() => setFocusedSpSuggested(false)}
                              keyboardType="number-pad"
                              placeholder="0.00"
                              placeholderTextColor={Colors.light.textSecondary}
                              selectTextOnFocus
                            />
                          </View>
                        </View>
                      </View>

                      {locationSlots.every((l) => !l) ? (
                        <View style={styles.calcNoLocationsNote}>
                          <Text style={styles.calcNoLocationsText}>
                            Add decoration locations in Design Details to use this calculator.
                          </Text>
                        </View>
                      ) : (
                        locationSlots.map((loc, idx) => {
                          if (!loc) return null;
                          return (
                            <View key={idx} style={styles.calcLocationCard}>
                              <View style={styles.calcLocationCardHeader}>
                                <Text style={styles.calcLocationCardTitle}>
                                  Location {idx + 1}: {loc}
                                </Text>
                              </View>
                              <View style={styles.calcLocationCardBody}>
                                <View style={styles.calcFieldItem}>
                                  <Text style={styles.dtfInputLabel}># OF COLORS</Text>
                                  <View style={styles.dtfInputWrapper}>
                                    <TextInput
                                      style={[styles.dtfRateInput, { flex: 1 }]}
                                      value={spLocations[idx]?.colors ?? ''}
                                      onChangeText={(t) => updateSpLocation(idx, 'colors', t.replace(/\D/g, ''))}
                                      keyboardType="number-pad"
                                      placeholder="0"
                                      placeholderTextColor={Colors.light.textSecondary}
                                      selectTextOnFocus
                                    />
                                  </View>
                                </View>
                                <View style={styles.calcFieldItem}>
                                  <Text style={styles.dtfInputLabel}># OF SCREENS</Text>
                                  <View style={styles.dtfInputWrapper}>
                                    <TextInput
                                      style={[styles.dtfRateInput, { flex: 1 }]}
                                      value={spLocations[idx]?.screens ?? ''}
                                      onChangeText={(t) => updateSpLocation(idx, 'screens', t.replace(/\D/g, ''))}
                                      keyboardType="number-pad"
                                      placeholder="0"
                                      placeholderTextColor={Colors.light.textSecondary}
                                      selectTextOnFocus
                                    />
                                  </View>
                                </View>
                                <View style={styles.calcFieldItem}>
                                  <Text style={styles.dtfInputLabel}>VENDOR COST</Text>
                                  <View style={styles.dtfInputWrapper}>
                                    <Text style={styles.dtfDollar}>$</Text>
                                    <TextInput
                                      style={[styles.dtfRateInput, { flex: 1 }]}
                                      value={spLocations[idx]?.vendorCost ?? ''}
                                      onChangeText={(t) => updateSpLocation(idx, 'vendorCost', t.replace(/[^0-9.]/g, ''))}
                                      keyboardType="decimal-pad"
                                      placeholder="0.00"
                                      placeholderTextColor={Colors.light.textSecondary}
                                      selectTextOnFocus
                                    />
                                  </View>
                                </View>
                                <View style={styles.calcFieldItem}>
                                  <Text style={styles.dtfInputLabel}>SELL PRICE</Text>
                                  <View style={styles.dtfInputWrapper}>
                                    <Text style={styles.dtfDollar}>$</Text>
                                    <TextInput
                                      style={[styles.dtfRateInput, { flex: 1 }]}
                                      value={spLocations[idx]?.sellPrice ?? ''}
                                      onChangeText={(t) => updateSpLocation(idx, 'sellPrice', t.replace(/[^0-9.]/g, ''))}
                                      keyboardType="decimal-pad"
                                      placeholder="0.00"
                                      placeholderTextColor={Colors.light.textSecondary}
                                      selectTextOnFocus
                                    />
                                  </View>
                                </View>
                              </View>
                            </View>
                          );
                        })
                      )}

                      {(() => {
                        const vc = spVendorCostTotal;
                        const ss = spSuggestedSellTotal;
                        const profit = ss - vc;
                        const margin = ss > 0 ? (profit / ss) * 100 : 0;
                        return (
                          <View style={styles.calcSummarySection}>
                            <View style={styles.calcSummaryRow}>
                              <Text style={styles.calcSummaryLabel}>VENDOR COST</Text>
                              <Text style={styles.calcSummaryValue}>{formatCurrency(vc)}</Text>
                            </View>
                            <View style={styles.calcSummaryRow}>
                              <Text style={styles.calcSummaryLabel}>SUGGESTED SELL</Text>
                              <Text style={styles.calcSummaryValue}>{formatCurrency(ss)}</Text>
                            </View>
                            <View style={styles.calcSummaryRow}>
                              <Text style={styles.calcSummaryLabel}>ESTIMATED PROFIT</Text>
                              <Text style={[styles.calcSummaryValue, { color: profit >= 0 ? '#16a34a' : Colors.light.error }]}>
                                {formatCurrency(profit)}
                              </Text>
                            </View>
                            <View style={styles.calcSummaryRow}>
                              <Text style={styles.calcSummaryLabel}>MARGIN %</Text>
                              <Text style={styles.calcSummaryValue}>
                                {isFinite(margin) && ss > 0 ? `${margin.toFixed(1)}%` : '—'}
                              </Text>
                            </View>
                            <TouchableOpacity
                              style={[styles.applyBtn, vc === 0 && styles.applyBtnDisabled]}
                              disabled={vc === 0}
                              onPress={applySpCost}
                            >
                              <Text style={styles.applyBtnText}>Apply to Line Item</Text>
                            </TouchableOpacity>
                          </View>
                        );
                      })()}
                    </View>
                  )}

                  {/* ═══ 5. Promotional Products Calculator ═══ */}
                  {isPromotional && (
                    <View>
                      <View style={[styles.dtfControlsRow, { marginBottom: 14 }]}>
                        <View style={[styles.dtfControlChip, { opacity: 0.55 }]}>
                          <Text style={styles.dtfControlChipLabel}>VENDOR</Text>
                          <Text style={[styles.dtfControlChipValue, { fontSize: 10 }]} numberOfLines={1}>
                            No Vendors Configured
                          </Text>
                        </View>
                        {productionPresets.length === 0 ? (
                          <View style={[styles.dtfControlChip, { opacity: 0.55 }]}>
                            <Text style={styles.dtfControlChipLabel}>PRICING PRESET</Text>
                            <Text style={[styles.dtfControlChipValue, { fontSize: 10 }]} numberOfLines={1}>
                              No Presets Configured
                            </Text>
                          </View>
                        ) : (
                          <OverlayMenu menuWidth={210} align="left"
                            trigger={({ open }) => (
                              <TouchableOpacity style={styles.dtfControlChip} onPress={open} activeOpacity={0.75}>
                                <Text style={styles.dtfControlChipLabel}>PRICING PRESET</Text>
                                <View style={styles.dtfControlChipValueRow}>
                                  <Text style={styles.dtfControlChipValue} numberOfLines={1}>Select…</Text>
                                  <ChevronDown size={9} color={Colors.light.textSecondary} />
                                </View>
                              </TouchableOpacity>
                            )}
                          >
                            {({ close }) => (
                              <>
                                {productionPresets.map((p: any) => (
                                  <TouchableOpacity key={p.id} style={styles.dtfMenuRow}
                                    onPress={() => {
                                      if (p.suggestedSellPrice != null) setPromoProductCost(String(p.suggestedSellPrice));
                                      close();
                                    }}>
                                    <Text style={styles.dtfMenuRowText}>{p.name}</Text>
                                  </TouchableOpacity>
                                ))}
                              </>
                            )}
                          </OverlayMenu>
                        )}
                      </View>

                      <View style={styles.calcFieldsRow}>
                        <View style={styles.calcFieldItem}>
                          <Text style={styles.dtfInputLabel}>PRODUCT COST</Text>
                          <View style={styles.dtfInputWrapper}>
                            <Text style={styles.dtfDollar}>$</Text>
                            <TextInput
                              style={[styles.dtfRateInput, { flex: 1 }]}
                              value={focusedPromoField === 'pc' ? promoProductCost : (promoProductCostNum > 0 ? promoProductCostNum.toFixed(2) : '')}
                              onChangeText={(t) => setPromoProductCost(t.replace(/[^0-9.]/g, ''))}
                              onFocus={() => setFocusedPromoField('pc')}
                              onBlur={() => setFocusedPromoField(null)}
                              keyboardType="decimal-pad"
                              placeholder="0.00"
                              placeholderTextColor={Colors.light.textSecondary}
                              selectTextOnFocus
                            />
                          </View>
                        </View>
                        <View style={styles.calcFieldItem}>
                          <Text style={styles.dtfInputLabel}>FREIGHT</Text>
                          <View style={styles.dtfInputWrapper}>
                            <Text style={styles.dtfDollar}>$</Text>
                            <TextInput
                              style={[styles.dtfRateInput, { flex: 1 }]}
                              value={focusedPromoField === 'fr' ? promoFreight : (promoFreightNum > 0 ? promoFreightNum.toFixed(2) : '')}
                              onChangeText={(t) => setPromoFreight(t.replace(/[^0-9.]/g, ''))}
                              onFocus={() => setFocusedPromoField('fr')}
                              onBlur={() => setFocusedPromoField(null)}
                              keyboardType="decimal-pad"
                              placeholder="0.00"
                              placeholderTextColor={Colors.light.textSecondary}
                              selectTextOnFocus
                            />
                          </View>
                        </View>
                        <View style={styles.calcFieldItem}>
                          <Text style={styles.dtfInputLabel}>HANDLING</Text>
                          <View style={styles.dtfInputWrapper}>
                            <Text style={styles.dtfDollar}>$</Text>
                            <TextInput
                              style={[styles.dtfRateInput, { flex: 1 }]}
                              value={focusedPromoField === 'hd' ? promoHandling : (promoHandlingNum > 0 ? promoHandlingNum.toFixed(2) : '')}
                              onChangeText={(t) => setPromoHandling(t.replace(/[^0-9.]/g, ''))}
                              onFocus={() => setFocusedPromoField('hd')}
                              onBlur={() => setFocusedPromoField(null)}
                              keyboardType="decimal-pad"
                              placeholder="0.00"
                              placeholderTextColor={Colors.light.textSecondary}
                              selectTextOnFocus
                            />
                          </View>
                        </View>
                      </View>

                      <View style={styles.calcFieldsRow}>
                        <View style={styles.calcFieldItem}>
                          <Text style={styles.dtfInputLabel}>MARKUP %</Text>
                          <View style={styles.dtfInputWrapper}>
                            <TextInput
                              style={[styles.dtfRateInput, { flex: 1 }]}
                              value={promoMarkupPct}
                              onChangeText={(t) => setPromoMarkupPct(t.replace(/[^0-9.]/g, ''))}
                              keyboardType="decimal-pad"
                              placeholder="100"
                              placeholderTextColor={Colors.light.textSecondary}
                              selectTextOnFocus
                            />
                            <Text style={styles.dtfInputSuffix}>%</Text>
                          </View>
                        </View>
                        <View style={styles.calcFieldItem}>
                          <Text style={styles.dtfInputLabel}>SUGGESTED SELL PRICE</Text>
                          <View style={[styles.dtfDisplayBox, { paddingHorizontal: 10, minWidth: 100 }]}>
                            <Text style={styles.dtfTotalColVal}>{formatCurrency(promoSuggestedSell)}</Text>
                          </View>
                        </View>
                      </View>

                      {(() => {
                        const vc = promoVendorCost;
                        const ss = promoSuggestedSell;
                        const profit = ss - vc;
                        const margin = ss > 0 ? (profit / ss) * 100 : 0;
                        return (
                          <View style={styles.calcSummarySection}>
                            <View style={styles.calcSummaryRow}>
                              <Text style={styles.calcSummaryLabel}>VENDOR COST</Text>
                              <Text style={styles.calcSummaryValue}>{formatCurrency(vc)}</Text>
                            </View>
                            <View style={styles.calcSummaryRow}>
                              <Text style={styles.calcSummaryLabel}>SUGGESTED SELL</Text>
                              <Text style={styles.calcSummaryValue}>{formatCurrency(ss)}</Text>
                            </View>
                            <View style={styles.calcSummaryRow}>
                              <Text style={styles.calcSummaryLabel}>ESTIMATED PROFIT</Text>
                              <Text style={[styles.calcSummaryValue, { color: profit >= 0 ? '#16a34a' : Colors.light.error }]}>
                                {formatCurrency(profit)}
                              </Text>
                            </View>
                            <View style={styles.calcSummaryRow}>
                              <Text style={styles.calcSummaryLabel}>MARGIN %</Text>
                              <Text style={styles.calcSummaryValue}>
                                {isFinite(margin) && ss > 0 ? `${margin.toFixed(1)}%` : '—'}
                              </Text>
                            </View>
                            <TouchableOpacity
                              style={[styles.applyBtn, vc === 0 && styles.applyBtnDisabled]}
                              disabled={vc === 0}
                              onPress={applyPromoCost}
                            >
                              <Text style={styles.applyBtnText}>Apply to Line Item</Text>
                            </TouchableOpacity>
                          </View>
                        );
                      })()}
                    </View>
                  )}

                </View>
              </View>
              )}
            </View>
          </View>

          {/* ── Bottom row: Pricing Adjustments (left) + Line Item Costs (right) ── */}
          <View style={[styles.bottomTwoCol, useSideBySide && styles.bottomTwoColWeb]}>

            {/* LEFT: Pricing Adjustments */}
            {!isPromotional && (
              <View style={[styles.adjustmentsCol, useSideBySide && styles.adjustmentsColWeb]}>
                <View style={styles.panelHeader}>
                  <Text style={styles.panelTitle}>PRICING ADJUSTMENTS</Text>
                </View>
                <QuoteAdjustmentsTable
                  title="PRODUCTION COSTS"
                  addLabel="Add Production Cost"
                  libraryKind="production"
                  rows={productionCosts}
                  baseAmount={lineItemCalcs.adjustmentBase}
                  onChange={updateProductionCosts}
                />
                <QuoteAdjustmentsTable
                  title="OTHER CHARGES"
                  addLabel="Add Other Charge"
                  libraryKind="other"
                  rows={otherCharges}
                  baseAmount={lineItemCalcs.adjustmentBase}
                  onChange={updateOtherCharges}
                />
                <TouchableOpacity style={styles.adjLibraryRow} activeOpacity={0.7}>
                  <ChevronRight size={12} color={Colors.light.textSecondary} />
                  <Text style={styles.adjLibraryLabel}>ADJUSTMENT LIBRARY</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* RIGHT: Line Item Costs + Subtotal */}
            <View
              style={[
                styles.costsPanel,
                useSideBySide && !isPromotional && styles.costsPanelRight,
              ]}
            >
              <View style={styles.panelHeader}>
                <Text style={styles.panelTitle}>LINE ITEM COSTS</Text>
              </View>
              <View style={styles.costsFieldsRow}>
                <View style={styles.costFieldWrap}>
                  {products.length > 1 ? (
                    <View>
                      <Text style={styles.costLabel}>PRODUCT</Text>
                      <View style={styles.blendedCostBox}>
                        <Text style={styles.blendedCostValue}>
                          {formatCurrency(item.productCostEach || 0)}
                        </Text>
                      </View>
                      <Text style={styles.blendedHint}>Auto Calculated</Text>
                    </View>
                  ) : (
                    <CurrencyInput
                      label="PRODUCT"
                      value={item.productCostEach}
                      onChange={(v) => onChange(setUniformProductCost(itemRef.current, v))}
                    />
                  )}
                </View>
                <View style={styles.costFieldWrap}>
                  <CurrencyInput
                    label="SERVICE"
                    value={item.serviceCostEach}
                    onChange={(v) =>
                      onChange(updateDesignFields(itemRef.current, { serviceCostEach: v }))
                    }
                  />
                </View>
                <View style={styles.costFieldWrap}>
                  <CurrencyInput
                    label="PRODUCTION"
                    value={item.serviceFeeEach}
                    onChange={(v) =>
                      onChange(updateDesignFields(itemRef.current, { serviceFeeEach: v }))
                    }
                  />
                </View>
                <View style={styles.costFieldWrap}>
                  <CurrencyInput
                    label="OTHER"
                    value={item.otherCostEach ?? 0}
                    onChange={(v) =>
                      onChange(updateDesignFields(itemRef.current, { otherCostEach: v }))
                    }
                  />
                </View>
                <View style={styles.costFieldWrap}>
                  <CurrencyInput
                    label="MARKUP"
                    value={item.markupEach || 0}
                    onChange={(v) =>
                      onChange(updateDesignFields(itemRef.current, { markupEach: v }))
                    }
                  />
                </View>
              </View>
              {/* ── Inline subtotal (merged into costs panel) ── */}
              <View style={[styles.panelHeader, { paddingRight: 16 }]}>
                <Text style={[styles.panelTitle, { flex: 1 }]}>LINE ITEM SUBTOTAL</Text>
                <Text style={[styles.panelTitle, { width: 72, textAlign: 'right', fontSize: 10 }]}>EACH</Text>
                <Text style={[styles.panelTitle, { width: 72, textAlign: 'right', fontSize: 10 }]}>TOTAL</Text>
              </View>
              <View style={styles.costsSubtotalContent}>
                <View style={styles.subtotalRow}>
                  <Text style={styles.subtotalCellMain}>Production Cost</Text>
                  <Text style={styles.subtotalCellRight}>
                    {formatCurrency(
                      lineItemCalcs.quantity > 0
                        ? lineItemCalcs.cogTotal / lineItemCalcs.quantity
                        : 0,
                    )}
                  </Text>
                  <Text style={styles.subtotalCellRight}>
                    {formatCurrency(lineItemCalcs.cogTotal)}
                  </Text>
                </View>
                <View style={styles.subtotalRow}>
                  <Text style={styles.subtotalCellMain}>Other Charges</Text>
                  <Text style={styles.subtotalCellRight}>
                    {formatCurrency(
                      lineItemCalcs.quantity > 0
                        ? lineItemCalcs.otherCostTotal / lineItemCalcs.quantity
                        : 0,
                    )}
                  </Text>
                  <Text style={styles.subtotalCellRight}>
                    {formatCurrency(lineItemCalcs.otherCostTotal)}
                  </Text>
                </View>
                <View style={styles.subtotalRow}>
                  <Text style={styles.subtotalCellMain}>Markup</Text>
                  <Text style={styles.subtotalCellRight}>
                    {formatCurrency(item.markupEach || 0)}
                  </Text>
                  <Text style={styles.subtotalCellRight}>
                    {formatCurrency(lineItemCalcs.markupTotal)}
                  </Text>
                </View>
                <View style={styles.subtotalDivider} />
                <View style={styles.subtotalTotalRow}>
                  <Text style={styles.subtotalTotalLabel}>
                    Subtotal ({lineItemCalcs.quantity} pcs)
                  </Text>
                  <Text style={styles.subtotalTotalEach}>
                    {formatCurrency(lineItemCalcs.perPiece)}
                  </Text>
                  <Text style={styles.subtotalTotalValue}>
                    {formatCurrency(lineItemCalcs.subtotal)}
                  </Text>
                </View>
              </View>
            </View>
          </View>

        </View>
      )}
    </View>
  );
}

export const LineItemCard = React.memo(LineItemCardFn);

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginBottom: 12,
    overflow: 'hidden',
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#000000',
  },
  headerLeftPress: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
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
    marginRight: 10,
    flexShrink: 0,
  },
  indexText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#fff',
  },
  headerThumbnail: {
    width: 38,
    height: 38,
    borderRadius: 6,
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    flexShrink: 0,
  },
  title: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#fff',
  },
  subtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 10,
    flexShrink: 0,
  },
  designMockupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 7,
  },
  designMockupBtnText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#fff',
  },
  duplicateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 7,
  },
  duplicateBtnText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.85)',
  },
  chevronBtn: {
    padding: 2,
  },
  headerKebabBtn: {
    padding: 2,
  },
  deleteBtn: {
    padding: 4,
  },
  menuItemDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  menuItemDangerText: {
    fontSize: 13,
    color: Colors.light.error,
    fontWeight: '600' as const,
  },

  // ── Expanded body ──
  expandedBody: {
    backgroundColor: Colors.light.background,
    paddingTop: 16,
  },

  // ── Two-column row ──
  twoColRow: {
    flexDirection: 'column',
  },
  twoColRowWeb: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },

  // ── Shared panel ──
  panel: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    backgroundColor: Colors.light.surface,
  },
  designPanelWeb: {
    flex: 4,
    borderRightWidth: 1,
    borderRightColor: Colors.light.border,
    borderBottomWidth: 0,
  },
  productsPanelWeb: {
    flex: 5,
    borderBottomWidth: 0,
  },

  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#000000',
    paddingHorizontal: 16,
    height: 32,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  panelTitle: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#fff',
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
  },
  panelSubtitle: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    fontStyle: 'italic' as const,
  },

  // ── Design Details ──
  designBody: {
    padding: 16,
  },
  designBodyRow: {
    flexDirection: 'row',
    gap: 16,
  },

  // Mockup thumbnail sub-column (desktop)
  mockupThumbs: {
    width: 176,
    flexShrink: 0,
    alignItems: 'center',
  },
  mockupViewLabel: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  mockupThumb: {
    width: 160,
    height: 160,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.background,
  },
  mockupThumbEmpty: {
    width: 160,
    height: 160,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderStyle: 'dashed' as const,
    backgroundColor: Colors.light.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  changeMockupBtn: {
    marginTop: 10,
    paddingVertical: 5,
  },
  changeMockupText: {
    fontSize: 12,
    color: Colors.light.tint,
    fontWeight: '600' as const,
    textAlign: 'center',
  },

  // Mobile mockup trigger
  mobileChangeMockup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  mobileThumb: {
    width: 40,
    height: 40,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  mobileChangeMockupText: {
    fontSize: 13,
    color: Colors.light.tint,
    fontWeight: '600' as const,
    flex: 1,
  },

  // ── Form fields column ──
  fieldsCol: {
    flex: 1,
    minWidth: 0,
  },
  fieldGroupLabel: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    marginTop: 16,
    marginBottom: 8,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
    width: 96,
    flexShrink: 0,
  },
  designNameInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.light.text,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 6,
    paddingHorizontal: 9,
    paddingVertical: 5,
    height: 32,
  },
  fieldDropBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 6,
    paddingHorizontal: 9,
    paddingVertical: 5,
    height: 32,
  },
  fieldDropValue: {
    flex: 1,
    fontSize: 13,
    color: Colors.light.text,
  },
  fieldDropPlaceholder: {
    color: Colors.light.textSecondary,
  },
  addLocationBtn: {
    marginLeft: 104,
    paddingVertical: 2,
    marginBottom: 4,
    alignSelf: 'flex-start',
  },
  addLocationText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.light.tint,
  },
  priorityHighlight: {
    color: '#E67E00',
    fontWeight: '600' as const,
  },
  notesInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.light.text,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 6,
    paddingHorizontal: 9,
    paddingVertical: 5,
    minHeight: 52,
    textAlignVertical: 'top',
  },

  // Shared menu items (used by all OverlayMenus in main component)
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.light.border,
  },
  menuItemText: {
    fontSize: 13,
    color: Colors.light.text,
    flex: 1,
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.light.border,
    marginHorizontal: 12,
    marginVertical: 4,
  },
  menuItemActive: {
    color: Colors.light.tint,
    fontWeight: '700' as const,
  },

  // ── Pill chips ──
  pillsWrap: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    alignItems: 'center',
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  servicePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E67E00',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#fff',
  },
  addPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    borderColor: Colors.light.tint,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  addPillText: {
    fontSize: 11,
    color: Colors.light.tint,
    fontWeight: '600' as const,
  },

  // ── Products panel ──
  addProductHdrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  addProductHdrBtnText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#fff',
  },
  addProductFooterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  addProductFooterText: {
    fontSize: 13,
    color: Colors.light.tint,
    fontWeight: '600' as const,
  },

  // Promotional flat qty
  promotionalQtyWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
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

  // ── Calculator ──
  calcPanel: {
    backgroundColor: Colors.light.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },

  // ── Bottom two-column row: Pricing Adjustments | Line Item Costs ──
  bottomTwoCol: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  bottomTwoColWeb: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  adjustmentsCol: {
    backgroundColor: Colors.light.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  adjustmentsColWeb: {
    flex: 6,
    borderRightWidth: 1,
    borderRightColor: Colors.light.border,
    borderBottomWidth: 0,
  },
  adjLibraryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.light.border,
  },
  adjLibraryLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  costsPanelRight: {
    flex: 4,
  },
  calcBody: {
    padding: 16,
  },
  calcLocationLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.light.tint,
    marginBottom: 6,
    marginTop: 4,
  },
  calcSubtitle: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginBottom: 8,
  },
  costsPanel: {
    flex: 1,
    backgroundColor: Colors.light.surface,
  },
  costsPanelSplit: {
    flex: 4,
  },
  costsFieldsRow: {
    flexDirection: 'row',
    padding: 16,
    paddingBottom: 12,
    gap: 12,
  },
  costsDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.light.border,
    marginHorizontal: 16,
  },
  costsSubtotalContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
  },
  costFieldWrap: {
    flex: 1,
  },
  costLabel: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  blendedCostBox: {
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.highlightBg,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  blendedCostValue: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
  },
  blendedHint: {
    fontSize: 10,
    color: Colors.light.textSecondary,
    marginTop: 3,
    fontStyle: 'italic' as const,
  },

  // DTF Calculator
  dtfCalcRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    marginBottom: 4,
  },
  dtfInputGroup: {
    flex: 1,
  },
  dtfInputGroupFixed: {
    width: 72,
  },
  dtfRateGroup: {
    width: 98,
  },
  dtfSqftCol: {
    flex: 1,
    minWidth: 62,
  },
  dtfSqftValue: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.light.tint,
    textAlign: 'center' as const,
  },
  dtfTotalCol: {
    flex: 1,
    minWidth: 68,
  },
  dtfDisplayBox: {
    height: 30,
    justifyContent: 'center' as const,
  },
  dtfSqftBox: {
    height: 30,
    justifyContent: 'center' as const,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 6,
    paddingHorizontal: 6,
  },
  dtfTotalColLabel: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.4,
    marginBottom: 3,
  },
  dtfTotalColVal: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.light.tint,
    textAlign: 'center' as const,
  },
  dtfInputLabel: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.4,
    marginBottom: 3,
  },
  dtfInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 6,
    paddingHorizontal: 6,
    height: 30,
  },
  dtfInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.text,
    textAlign: 'center',
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  dtfRateInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.text,
    textAlign: 'center',
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  dtfInputSuffix: {
    fontSize: 10,
    color: Colors.light.textSecondary,
    marginLeft: 2,
  },
  dtfDollar: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  dtfOperator: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
    paddingBottom: 6,
  },
  dtfResultInline: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 2,
    flexShrink: 0,
  },
  dtfResultEq: {
    fontSize: 11,
    color: Colors.light.textSecondary,
  },
  dtfResultVal: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.light.tint,
  },
  dtfResultSqIn: {
    fontSize: 9,
    color: Colors.light.textSecondary,
  },
  dtfLocationDivider: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginVertical: 8,
  },
  dtfTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  dtfTotalLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  dtfTotalValue: {
    color: Colors.light.tint,
    fontSize: 15,
    fontWeight: '700' as const,
  },
  applyBtn: {
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 6,
  },
  applyBtnDisabled: {
    backgroundColor: Colors.light.border,
  },
  applyBtnText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#fff',
  },

  // DTF Controls row
  dtfControlsRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
    gap: 8,
    marginBottom: 12,
    flexWrap: 'wrap' as const,
  },
  dtfControlChip: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    minWidth: 110,
    backgroundColor: Colors.light.surface,
  },
  dtfControlChipLabel: {
    fontSize: 8,
    fontWeight: '700' as const,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  dtfControlChipValueRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  dtfControlChipValue: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  dtfSuggestedGroup: {
    minWidth: 110,
  },
  dtfLocationsGroup: {
    alignItems: 'center' as const,
    justifyContent: 'flex-end' as const,
  },
  dtfLocationsValue: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: Colors.light.text,
    lineHeight: 30,
  },

  // DTF menu rows (inside OverlayMenu)
  dtfMenuRow: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.light.border,
  },
  dtfMenuRowText: {
    fontSize: 13,
    color: Colors.light.text,
  },
  dtfMenuRowActive: {
    color: Colors.light.tint,
    fontWeight: '700' as const,
  },

  // DTF Service Cost footer
  dtfServiceCostRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  dtfServiceCostBlock: {
    gap: 2,
  },
  dtfServiceCostLabel: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.6,
  },
  dtfServiceCostValue: {
    fontSize: 30,
    fontWeight: '800' as const,
    color: Colors.light.tint,
    lineHeight: 36,
  },

  // Embroidery Calculator
  embInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    marginBottom: 4,
  },
  embInputGroup: {
    flex: 1,
  },
  embInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 6,
    paddingHorizontal: 10,
    height: 38,
  },
  embInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.light.text,
    paddingVertical: 0,
  },
  embCostDisplay: {
    alignItems: 'center',
    minWidth: 60,
  },
  embCostValue: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.light.tint,
  },
  embMinNote: {
    fontSize: 10,
    color: Colors.light.tint,
    fontStyle: 'italic' as const,
    marginBottom: 4,
  },
  embDigitizationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  embCheckbox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  embCheckboxBox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: Colors.light.tint,
    borderRadius: 4,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
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
  // ── EMBROIDERY CALCULATOR (new) ───────────────────────────────────────────
  embInputsRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  embQtyGroup: {
    width: 90,
  },
  embStitchGroup: {
    flex: 1,
  },
  embStitchWrapper: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    borderWidth: 1.5,
    borderColor: Colors.light.tint,
    borderRadius: 6,
    paddingHorizontal: 10,
    height: 40,
    backgroundColor: Colors.light.background,
  },
  embStitchInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  embStitchSuffix: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginLeft: 4,
  },
  // ── SCREEN PRINTING CALCULATOR ────────────────────────────────────────────
  spLocationCountRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    gap: 12,
  },
  spLocationCountLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
    letterSpacing: 0.5,
    flex: 1,
  },
  spLocationCountPicker: {
    flexDirection: 'row' as const,
    gap: 6,
  },
  spCountChip: {
    width: 30,
    height: 26,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.surface,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  spCountChipActive: {
    backgroundColor: Colors.light.tint,
    borderColor: Colors.light.tint,
  },
  spCountChipText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
  },
  spCountChipTextActive: {
    color: '#fff',
  },
  spLocationCard: {
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.background,
    overflow: 'hidden' as const,
  },
  spLocationCardTitle: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.light.text,
    letterSpacing: 0.3,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    backgroundColor: Colors.light.surface,
  },
  spLocationInputsRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
    gap: 8,
    padding: 10,
    paddingBottom: 6,
  },
  spLocNameChip: {
    flex: 1,
    minWidth: 110,
    backgroundColor: Colors.light.background,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  spInputGroup: {
    alignItems: 'center' as const,
    minWidth: 52,
  },
  spNumInputWrapper: {
    width: 52,
    height: 28,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 5,
    backgroundColor: Colors.light.background,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 4,
  },
  spNumInputField: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.text,
    textAlign: 'center' as const,
    width: '100%',
    height: '100%',
  },
  spNotesInput: {
    fontSize: 12,
    color: Colors.light.text,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    backgroundColor: Colors.light.background,
  },
  spAdditionalOptions: {
    marginHorizontal: 12,
    marginTop: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderStyle: 'dashed' as const,
    padding: 12,
    backgroundColor: Colors.light.surface,
  },
  spAdditionalOptionsLabel: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.light.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  spAdditionalOptionsHint: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    fontStyle: 'italic' as const,
    lineHeight: 15,
  },
  // ── LINE ITEM SUBTOTAL ──
  subtotalSection: {
    borderRadius: 0,
    overflow: 'hidden',
    borderTopWidth: 1,
    borderTopColor: Colors.light.tint,
  },
  subtotalHeader: {
    backgroundColor: Colors.light.tint,
    paddingVertical: 11,
    paddingHorizontal: 18,
  },
  subtotalTitle: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#fff',
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
  subtotalContent: {
    backgroundColor: Colors.light.highlightBg,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  subtotalTableHeader: {
    flexDirection: 'row',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    marginBottom: 2,
  },
  subtotalRow: {
    flexDirection: 'row',
    paddingVertical: 4,
  },
  subtotalCellMain: {
    flex: 1,
    fontSize: 13,
    color: Colors.light.text,
    fontWeight: '500' as const,
  },
  subtotalCellRight: {
    width: 72,
    fontSize: 13,
    color: Colors.light.textSecondary,
    textAlign: 'right',
    fontWeight: '500' as const,
  },
  subtotalDivider: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginVertical: 6,
  },
  subtotalTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subtotalTotalLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  subtotalTotalEach: {
    width: 72,
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.text,
    textAlign: 'right',
  },
  subtotalTotalValue: {
    width: 72,
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.light.tint,
    textAlign: 'right',
  },

  // ── Variant picker modal ──
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
  vpCancelText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    fontWeight: '600',
  },
  calcSummarySection: {
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    marginTop: 16,
    paddingTop: 14,
    gap: 7,
  },
  calcSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  calcSummaryLabel: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  calcSummaryValue: {
    fontSize: 13,
    color: Colors.light.text,
    fontWeight: '700',
  },
  calcGangWidthRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  calcGangWidthChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.surface,
  },
  calcGangWidthChipActive: {
    backgroundColor: Colors.light.tint,
    borderColor: Colors.light.tint,
  },
  calcGangWidthChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  calcGangWidthChipTextActive: {
    color: '#fff',
  },
  calcFieldsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
    alignItems: 'flex-end',
  },
  calcFieldItem: {
    gap: 5,
    minWidth: 110,
  },
  calcLocationCard: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    marginTop: 10,
    overflow: 'hidden',
  },
  calcLocationCardHeader: {
    backgroundColor: Colors.light.highlightBg,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  calcLocationCardTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  calcLocationCardBody: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    padding: 12,
    alignItems: 'flex-end',
  },
  calcNoLocationsNote: {
    backgroundColor: Colors.light.highlightBg,
    borderRadius: 8,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  calcNoLocationsText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  calcRowSection: {
    marginTop: 12,
  },
});
