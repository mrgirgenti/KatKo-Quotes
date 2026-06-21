import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Pencil, Plus, X, ChevronDown, Upload, Palette, Layers } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { apiFetch, getAuthHeaders } from '@/lib/apiFetch';
import PageBackHeader from '@/components/PageBackHeader';
import PlacementEditor, { ZoneData } from '@/components/catalog/PlacementEditor';

const BRAND = Colors.light.tint;
const TEXT = Colors.light.text;
const TEXT_LIGHT = Colors.light.textSecondary;
const BORDER = Colors.light.border;
const SURFACE = Colors.light.surface;
const BG = Colors.light.background;

const PRODUCT_CATEGORIES = ['Apparel', 'Headwear', 'Bags', 'Promotional', 'Accessories', 'Other'];

const ASSET_TYPES: { key: string; label: string }[] = [
  { key: 'THUMBNAIL', label: 'Thumbnail' },
  { key: 'FRONT_FLAT', label: 'Front Flat' },
  { key: 'BACK_FLAT', label: 'Back Flat' },
  { key: 'FRONT_REALISTIC', label: 'Front Photo' },
  { key: 'BACK_REALISTIC', label: 'Back Photo' },
];

const TABS = [
  { key: 'colors' as const, label: 'Colors', Icon: Palette },
  { key: 'assets' as const, label: 'Assets', Icon: Upload },
  { key: 'placements' as const, label: 'Placements', Icon: Layers },
];
type TabKey = 'colors' | 'assets' | 'placements';

interface ProductData {
  id: string;
  styleNumber: string;
  brand: string;
  vendor: string;
  name: string;
  category: string;
  isActive: boolean;
}

interface AssetData {
  id: string;
  productColorId: string;
  assetType: string;
  storageKey: string;
  sortOrder: number;
}

interface ColorData {
  id: string;
  colorCode: string;
  colorName: string;
  hex: string | null;
  isActive: boolean;
  sortOrder: number;
  assets: AssetData[];
}

function validHexColor(h: string | null | undefined): string | null {
  if (!h) return null;
  return /^#[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?$/.test(h) ? h : null;
}

// ── Edit Product Modal ────────────────────────────────────────────────────────
function EditProductModal({
  visible,
  product,
  onSave,
  onClose,
}: {
  visible: boolean;
  product: ProductData | null;
  onSave: (form: Record<string, string>) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    styleNumber: '', brand: '', vendor: '', name: '', category: 'Apparel',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showCatDrop, setShowCatDrop] = useState(false);

  useEffect(() => {
    if (visible && product) {
      setForm({
        styleNumber: product.styleNumber,
        brand: product.brand,
        vendor: product.vendor,
        name: product.name,
        category: product.category || 'Apparel',
      });
      setError('');
      setSaving(false);
      setShowCatDrop(false);
    }
  }, [visible, product]);

  const upd = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.styleNumber.trim() || !form.brand.trim() || !form.vendor.trim() || !form.name.trim()) {
      setError('Style number, brand, vendor, and name are required.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={fm.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={fm.sheet} onPress={() => setShowCatDrop(false)}>
          <View style={fm.header}>
            <Text style={fm.title}>Edit Product</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={20} color={TEXT_LIGHT} />
            </TouchableOpacity>
          </View>
          <ScrollView style={fm.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {!!error && <View style={fm.errorBox}><Text style={fm.errorText}>{error}</Text></View>}

            <Text style={fm.label}>Style Number <Text style={{ color: BRAND }}>*</Text></Text>
            <TextInput style={fm.input} value={form.styleNumber} onChangeText={v => upd('styleNumber', v)}
              placeholder="e.g. NL6210" placeholderTextColor="#9CA3AF" autoCapitalize="characters" />

            <Text style={fm.label}>Brand <Text style={{ color: BRAND }}>*</Text></Text>
            <TextInput style={fm.input} value={form.brand} onChangeText={v => upd('brand', v)}
              placeholder="e.g. Next Level" placeholderTextColor="#9CA3AF" />

            <Text style={fm.label}>Vendor <Text style={{ color: BRAND }}>*</Text></Text>
            <TextInput style={fm.input} value={form.vendor} onChangeText={v => upd('vendor', v)}
              placeholder="e.g. SanMar" placeholderTextColor="#9CA3AF" />

            <Text style={fm.label}>Product Name <Text style={{ color: BRAND }}>*</Text></Text>
            <TextInput style={fm.input} value={form.name} onChangeText={v => upd('name', v)}
              placeholder="e.g. CVC Crew Tee" placeholderTextColor="#9CA3AF" />

            <Text style={fm.label}>Category</Text>
            <TouchableOpacity style={fm.select} onPress={() => setShowCatDrop(d => !d)}>
              <Text style={fm.selectText}>{form.category}</Text>
              <ChevronDown size={16} color={TEXT_LIGHT} />
            </TouchableOpacity>
            {showCatDrop && (
              <View style={fm.dropdown}>
                {PRODUCT_CATEGORIES.map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={[fm.dropOption, form.category === cat && fm.dropOptionActive]}
                    onPress={() => { upd('category', cat); setShowCatDrop(false); }}
                  >
                    <Text style={[fm.dropOptionText, form.category === cat && fm.dropOptionTextActive]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <View style={{ height: 24 }} />
          </ScrollView>
          <View style={fm.footer}>
            <TouchableOpacity style={fm.btnCancel} onPress={onClose}>
              <Text style={fm.btnCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[fm.btnSave, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={fm.btnSaveText}>Save Changes</Text>}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ── Color Form Modal ──────────────────────────────────────────────────────────
function ColorFormModal({
  visible,
  initial,
  onSave,
  onClose,
}: {
  visible: boolean;
  initial: ColorData | null;
  onSave: (form: { colorCode: string; colorName: string; hex: string }) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState({ colorCode: '', colorName: '', hex: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      setForm(
        initial
          ? { colorCode: initial.colorCode, colorName: initial.colorName, hex: initial.hex || '' }
          : { colorCode: '', colorName: '', hex: '' },
      );
      setError('');
      setSaving(false);
    }
  }, [visible, initial]);

  const handleSave = async () => {
    if (!form.colorCode.trim()) { setError('Color code is required.'); return; }
    if (!form.colorName.trim()) { setError('Color name is required.'); return; }
    setError('');
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to save color.');
    } finally {
      setSaving(false);
    }
  };

  const swatchBg = validHexColor(form.hex) || '#E5E7EB';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={fm.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={fm.sheet}>
          <View style={fm.header}>
            <Text style={fm.title}>{initial ? 'Edit Color' : 'Add Color'}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={20} color={TEXT_LIGHT} />
            </TouchableOpacity>
          </View>
          <View style={fm.body}>
            {!!error && <View style={fm.errorBox}><Text style={fm.errorText}>{error}</Text></View>}

            <Text style={fm.label}>Color Code <Text style={{ color: BRAND }}>*</Text></Text>
            <TextInput
              style={fm.input}
              value={form.colorCode}
              onChangeText={v => setForm(f => ({ ...f, colorCode: v }))}
              placeholder="e.g. BLK"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="characters"
            />

            <Text style={fm.label}>Color Name <Text style={{ color: BRAND }}>*</Text></Text>
            <TextInput
              style={fm.input}
              value={form.colorName}
              onChangeText={v => setForm(f => ({ ...f, colorName: v }))}
              placeholder="e.g. Black"
              placeholderTextColor="#9CA3AF"
            />

            <Text style={fm.label}>Hex Color</Text>
            <View style={fm.hexRow}>
              <View style={[fm.hexSwatch, { backgroundColor: swatchBg }]} />
              <TextInput
                style={[fm.input, { flex: 1 }]}
                value={form.hex}
                onChangeText={v => setForm(f => ({ ...f, hex: v }))}
                placeholder="#000000"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
              />
            </View>
            <View style={{ height: 16 }} />
          </View>
          <View style={fm.footer}>
            <TouchableOpacity style={fm.btnCancel} onPress={onClose}>
              <Text style={fm.btnCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[fm.btnSave, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
              {saving
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={fm.btnSaveText}>{initial ? 'Save Color' : 'Add Color'}</Text>
              }
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ── Colors Tab ────────────────────────────────────────────────────────────────
function ColorsTab({
  colors,
  onAdd,
  onEdit,
  onToggleActive,
}: {
  colors: ColorData[];
  onAdd: () => void;
  onEdit: (c: ColorData) => void;
  onToggleActive: (c: ColorData) => void;
}) {
  return (
    <ScrollView style={s.tabContent} showsVerticalScrollIndicator={false}>
      <View style={s.tabContentInner}>
        <View style={s.tabActionRow}>
          <TouchableOpacity style={s.addBtn} onPress={onAdd}>
            <Plus size={14} color="#fff" />
            <Text style={s.addBtnText}>Add Color</Text>
          </TouchableOpacity>
          <Text style={s.tabSubtitle}>{colors.length} color{colors.length !== 1 ? 's' : ''}</Text>
        </View>

        {colors.length === 0 ? (
          <View style={s.tabEmpty}>
            <Text style={s.tabEmptyText}>No colors yet. Add a color variant to get started.</Text>
          </View>
        ) : (
          <View style={s.colorTable}>
            <View style={s.colorTableHeader}>
              <View style={[s.ch, s.chSwatch]} />
              <Text style={[s.chText, s.chCode]}>Code</Text>
              <Text style={[s.chText, s.chName]}>Name</Text>
              <Text style={[s.chText, s.chHex]}>Hex</Text>
              <Text style={[s.chText, s.chStatus]}>Status</Text>
              <View style={[s.ch, s.chActions]} />
            </View>
            {colors.map(color => {
              const swatch = validHexColor(color.hex);
              return (
                <View key={color.id} style={s.colorRow}>
                  <View style={[s.ch, s.chSwatch]}>
                    <View style={[s.swatch, { backgroundColor: swatch || '#E5E7EB' }]} />
                  </View>
                  <Text style={[s.cd, s.chCode, s.cdBold]} numberOfLines={1}>{color.colorCode}</Text>
                  <Text style={[s.cd, s.chName]} numberOfLines={1}>{color.colorName}</Text>
                  <Text style={[s.cd, s.chHex, s.cdMono]} numberOfLines={1}>{color.hex || '—'}</Text>
                  <View style={[s.ch, s.chStatus]}>
                    <View style={[s.badge, color.isActive ? s.badgeOn : s.badgeOff]}>
                      <Text style={[s.badgeText, color.isActive ? s.badgeTextOn : s.badgeTextOff]}>
                        {color.isActive ? 'Active' : 'Off'}
                      </Text>
                    </View>
                  </View>
                  <View style={[s.ch, s.chActions, { flexDirection: 'row', gap: 4 }]}>
                    <TouchableOpacity
                      style={s.iconBtn}
                      onPress={() => onEdit(color)}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Pencil size={13} color={TEXT_LIGHT} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.toggleBtn, color.isActive ? s.toggleBtnOff : s.toggleBtnOn]}
                      onPress={() => onToggleActive(color)}
                    >
                      <Text style={[s.toggleBtnText, color.isActive ? s.toggleBtnTextOff : s.toggleBtnTextOn]}>
                        {color.isActive ? 'Disable' : 'Enable'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

// ── Assets Tab ────────────────────────────────────────────────────────────────
function AssetsTab({
  colors,
  uploadingKey,
  onUpload,
  onDelete,
}: {
  colors: ColorData[];
  uploadingKey: string | null;
  onUpload: (colorId: string, assetType: string) => void;
  onDelete: (colorId: string, assetId: string) => void;
}) {
  const activeColors = colors.filter(c => c.isActive);

  if (activeColors.length === 0) {
    return (
      <View style={[s.tabContent, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={s.tabEmptyText}>No active colors. Enable a color in the Colors tab first.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={s.tabContent} showsVerticalScrollIndicator={false}>
      <View style={s.tabContentInner}>
        {activeColors.map(color => {
          const assetMap: Record<string, AssetData> = {};
          for (const a of color.assets || []) {
            assetMap[a.assetType] = a;
          }
          const swatch = validHexColor(color.hex);

          return (
            <View key={color.id} style={s.assetSection}>
              <View style={s.assetSectionHeader}>
                <View style={[s.swatchMd, { backgroundColor: swatch || '#E5E7EB' }]} />
                <Text style={s.assetSectionTitle}>{color.colorName}</Text>
                <Text style={s.assetSectionCode}>({color.colorCode})</Text>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.assetSlots}
              >
                {ASSET_TYPES.map(({ key, label }) => {
                  const existing = assetMap[key];
                  const isUploading = uploadingKey === `${color.id}:${key}`;

                  return (
                    <View key={key} style={s.assetSlot}>
                      <View style={s.assetPreviewBox}>
                        {isUploading ? (
                          <View style={s.assetPlaceholder}>
                            <ActivityIndicator color={BRAND} size="small" />
                            <Text style={s.assetPlaceholderText}>Uploading…</Text>
                          </View>
                        ) : existing ? (
                          <>
                            <Image
                              source={{ uri: `/api/products/assets/${existing.id}` }}
                              style={s.assetImg}
                              resizeMode="contain"
                            />
                            <TouchableOpacity
                              style={s.assetRemoveBtn}
                              onPress={() =>
                                Alert.alert(
                                  'Remove Image',
                                  `Remove the ${label} image for ${color.colorName}?`,
                                  [
                                    { text: 'Cancel', style: 'cancel' },
                                    { text: 'Remove', style: 'destructive', onPress: () => onDelete(color.id, existing.id) },
                                  ],
                                )
                              }
                            >
                              <X size={11} color="#fff" />
                            </TouchableOpacity>
                          </>
                        ) : (
                          <TouchableOpacity style={s.assetUploadArea} onPress={() => onUpload(color.id, key)}>
                            <Upload size={22} color="#D1D5DB" />
                            <Text style={s.assetUploadAreaText}>Upload</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      <Text style={s.assetSlotLabel} numberOfLines={1}>{label}</Text>
                      {existing && !isUploading && (
                        <TouchableOpacity style={s.assetReplaceBtn} onPress={() => onUpload(color.id, key)}>
                          <Text style={s.assetReplaceBtnText}>Replace</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const productId = Array.isArray(id) ? id[0] : (id ?? '');

  const [product, setProduct] = useState<ProductData | null>(null);
  const [colors, setColors] = useState<ColorData[]>([]);
  const [placements, setPlacements] = useState<ZoneData[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('colors');

  const [editProductModal, setEditProductModal] = useState(false);
  const [colorModal, setColorModal] = useState(false);
  const [editingColor, setEditingColor] = useState<ColorData | null>(null);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    if (!productId) return;
    setLoading(true);
    setPageError('');
    try {
      const data = await apiFetch(
        `/api/products/${productId}?include=colors,assets,placements`,
      );
      const p = data.product;
      setProduct(p as ProductData);
      setColors((p.colors || []) as ColorData[]);
      setPlacements(((p.placements || []) as ZoneData[]).map(pl => ({ ...pl })));
    } catch (e: any) {
      setPageError(e.message || 'Failed to load product');
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const frontFlatAssetId = useMemo(() => {
    for (const c of colors) {
      const a = (c.assets || []).find(a => a.assetType === 'FRONT_FLAT');
      if (a) return a.id;
    }
    return null;
  }, [colors]);

  const backFlatAssetId = useMemo(() => {
    for (const c of colors) {
      const a = (c.assets || []).find(a => a.assetType === 'BACK_FLAT');
      if (a) return a.id;
    }
    return null;
  }, [colors]);

  const handleSaveProduct = async (form: Record<string, string>) => {
    await apiFetch(`/api/products/${productId}`, {
      method: 'PATCH',
      body: JSON.stringify(form),
    });
    await loadAll();
  };

  const handleSaveColor = async (form: {
    colorCode: string;
    colorName: string;
    hex: string;
  }) => {
    if (editingColor) {
      await apiFetch(`/api/products/${productId}/colors/${editingColor.id}`, {
        method: 'PATCH',
        body: JSON.stringify(form),
      });
    } else {
      await apiFetch(`/api/products/${productId}/colors`, {
        method: 'POST',
        body: JSON.stringify(form),
      });
    }
    await loadAll();
  };

  const handleToggleColorActive = async (color: ColorData) => {
    try {
      await apiFetch(`/api/products/${productId}/colors/${color.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !color.isActive }),
      });
      await loadAll();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update color');
    }
  };

  const handleDeleteAsset = async (colorId: string, assetId: string) => {
    try {
      await apiFetch(`/api/products/${productId}/colors/${colorId}/assets/${assetId}`, {
        method: 'DELETE',
      });
      await loadAll();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to remove asset');
    }
  };

  const pickAndUpload = useCallback(
    (colorId: string, assetType: string) => {
      if (typeof document === 'undefined') {
        Alert.alert('Not supported', 'File upload requires a web browser.');
        return;
      }
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/png,image/jpeg,image/webp';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        const key = `${colorId}:${assetType}`;
        setUploadingKey(key);
        try {
          const headers = await getAuthHeaders();
          const fd = new FormData();
          fd.append('file', file);
          fd.append('assetType', assetType);
          const res = await fetch(
            `/api/products/${productId}/colors/${colorId}/assets`,
            { method: 'POST', headers, body: fd },
          );
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error((err as any).error || 'Upload failed');
          }
          await loadAll();
        } catch (e: any) {
          Alert.alert('Upload failed', e.message);
        } finally {
          setUploadingKey(null);
        }
      };
      input.click();
    },
    [productId, loadAll],
  );

  const handleSavePlacement = async (
    placementId: string,
    coords: { x: number; y: number; width: number; height: number },
  ) => {
    await apiFetch(`/api/products/${productId}/placements/${placementId}`, {
      method: 'PATCH',
      body: JSON.stringify(coords),
    });
  };

  // ── Loading / error states ────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={s.screen}>
        <Stack.Screen options={{ headerShown: false }} />
        <PageBackHeader title="Product" />
        <View style={s.centerBox}>
          <ActivityIndicator color={BRAND} size="large" />
        </View>
      </View>
    );
  }

  if (pageError || !product) {
    return (
      <View style={s.screen}>
        <Stack.Screen options={{ headerShown: false }} />
        <PageBackHeader title="Product" />
        <View style={s.centerBox}>
          <Text style={s.errorText}>{pageError || 'Product not found.'}</Text>
        </View>
      </View>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <View style={s.screen}>
      <Stack.Screen options={{ headerShown: false }} />

      <PageBackHeader
        title={`${product.styleNumber} · ${product.name}`}
        right={
          <TouchableOpacity
            style={s.editHeaderBtn}
            onPress={() => setEditProductModal(true)}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Pencil size={14} color="#fff" />
            <Text style={s.editHeaderBtnText}>Edit</Text>
          </TouchableOpacity>
        }
      />

      {/* Product info bar */}
      <View style={s.infoBar}>
        <View style={s.infoChips}>
          <View style={s.infoChip}>
            <Text style={s.infoChipLabel}>Style #</Text>
            <Text style={s.infoChipValue}>{product.styleNumber}</Text>
          </View>
          <View style={s.infoSep} />
          <View style={s.infoChip}>
            <Text style={s.infoChipLabel}>Brand</Text>
            <Text style={s.infoChipValue}>{product.brand}</Text>
          </View>
          <View style={s.infoSep} />
          <View style={s.infoChip}>
            <Text style={s.infoChipLabel}>Vendor</Text>
            <Text style={s.infoChipValue}>{product.vendor}</Text>
          </View>
          {!!product.category && (
            <>
              <View style={s.infoSep} />
              <View style={s.infoChip}>
                <Text style={s.infoChipLabel}>Category</Text>
                <Text style={s.infoChipValue}>{product.category}</Text>
              </View>
            </>
          )}
          <View style={s.infoSep} />
          <View
            style={[
              s.statusBadge,
              product.isActive ? s.statusActive : s.statusInactive,
            ]}
          >
            <Text
              style={[
                s.statusText,
                product.isActive ? s.statusTextActive : s.statusTextInactive,
              ]}
            >
              {product.isActive ? 'Active' : 'Inactive'}
            </Text>
          </View>
        </View>
        <Text style={s.productName}>{product.name}</Text>
      </View>

      {/* Tab bar */}
      <View style={s.tabBar}>
        {TABS.map(({ key, label, Icon }) => {
          const active = activeTab === key;
          return (
            <TouchableOpacity
              key={key}
              style={[s.tabItem, active && s.tabItemActive]}
              onPress={() => setActiveTab(key)}
            >
              <Icon size={15} color={active ? BRAND : TEXT_LIGHT} />
              <Text style={[s.tabLabel, active && s.tabLabelActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Tab content */}
      {activeTab === 'colors' && (
        <ColorsTab
          colors={colors}
          onAdd={() => { setEditingColor(null); setColorModal(true); }}
          onEdit={color => { setEditingColor(color); setColorModal(true); }}
          onToggleActive={handleToggleColorActive}
        />
      )}

      {activeTab === 'assets' && (
        <AssetsTab
          colors={colors}
          uploadingKey={uploadingKey}
          onUpload={pickAndUpload}
          onDelete={handleDeleteAsset}
        />
      )}

      {activeTab === 'placements' && (
        <ScrollView style={s.tabContent} showsVerticalScrollIndicator={false}>
          <PlacementEditor
            placements={placements}
            frontFlatAssetId={frontFlatAssetId}
            backFlatAssetId={backFlatAssetId}
            onSavePlacement={handleSavePlacement}
          />
        </ScrollView>
      )}

      <EditProductModal
        visible={editProductModal}
        product={product}
        onSave={handleSaveProduct}
        onClose={() => setEditProductModal(false)}
      />
      <ColorFormModal
        visible={colorModal}
        initial={editingColor}
        onSave={handleSaveColor}
        onClose={() => { setColorModal(false); setEditingColor(null); }}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: 14, color: '#DC2626', textAlign: 'center' },

  editHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  editHeaderBtnText: { fontSize: 13, color: '#fff', fontWeight: '500' },

  infoBar: {
    backgroundColor: SURFACE,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 4,
  },
  infoChips: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  infoChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  infoChipLabel: { fontSize: 11, color: TEXT_LIGHT, fontWeight: '500' },
  infoChipValue: { fontSize: 13, color: TEXT, fontWeight: '600' },
  infoSep: { width: 1, height: 14, backgroundColor: BORDER },
  productName: { fontSize: 15, fontWeight: '700', color: TEXT, marginTop: 2 },

  statusBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  statusActive: { backgroundColor: '#D1FAE5' },
  statusInactive: { backgroundColor: '#F3F4F6' },
  statusText: { fontSize: 11, fontWeight: '600' },
  statusTextActive: { color: '#059669' },
  statusTextInactive: { color: '#6B7280' },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: SURFACE,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingHorizontal: 4,
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: { borderBottomColor: BRAND },
  tabLabel: { fontSize: 14, fontWeight: '500', color: TEXT_LIGHT },
  tabLabelActive: { color: BRAND, fontWeight: '600' },

  tabContent: { flex: 1 },
  tabContentInner: { padding: 20, gap: 16 },
  tabActionRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tabSubtitle: { fontSize: 13, color: TEXT_LIGHT },
  tabEmpty: { alignItems: 'center', paddingVertical: 40 },
  tabEmptyText: { fontSize: 14, color: TEXT_LIGHT, textAlign: 'center' },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: BRAND,
    borderRadius: 7,
    paddingVertical: 8,
    paddingHorizontal: 13,
  },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },

  colorTable: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden' as any,
  },
  colorTableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  ch: { alignItems: 'center', justifyContent: 'center' },
  chText: { fontSize: 11, fontWeight: '600', color: TEXT_LIGHT, textTransform: 'uppercase', letterSpacing: 0.3 },
  colorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: SURFACE,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  cd: { fontSize: 14, color: TEXT },
  cdBold: { fontWeight: '600' },
  cdMono: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },

  chSwatch: { width: 32, marginRight: 10 },
  chCode: { width: 80, marginRight: 12 },
  chName: { flex: 1, minWidth: 80, marginRight: 12 },
  chHex: { width: 80, marginRight: 12 },
  chStatus: { width: 64, marginRight: 8 },
  chActions: { width: 120 },

  swatch: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: '#E5E7EB' },
  swatchMd: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: '#E5E7EB' },

  badge: { borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, alignSelf: 'flex-start' },
  badgeOn: { backgroundColor: '#D1FAE5' },
  badgeOff: { backgroundColor: '#F3F4F6' },
  badgeText: { fontSize: 11, fontWeight: '600' },
  badgeTextOn: { color: '#059669' },
  badgeTextOff: { color: '#6B7280' },

  iconBtn: { padding: 6 },
  toggleBtn: {
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
  },
  toggleBtnOff: { borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' },
  toggleBtnOn: { borderColor: '#6EE7B7', backgroundColor: '#ECFDF5' },
  toggleBtnText: { fontSize: 11, fontWeight: '600' },
  toggleBtnTextOff: { color: '#DC2626' },
  toggleBtnTextOn: { color: '#059669' },

  assetSection: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
    overflow: 'hidden' as any,
  },
  assetSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    backgroundColor: '#F8FAFC',
  },
  assetSectionTitle: { fontSize: 14, fontWeight: '700', color: TEXT },
  assetSectionCode: { fontSize: 12, color: TEXT_LIGHT },

  assetSlots: { padding: 14, gap: 10 },
  assetSlot: { width: 120, gap: 5 },
  assetPreviewBox: {
    width: 120,
    height: 120,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: BG,
    overflow: 'hidden' as any,
    position: 'relative' as any,
  },
  assetImg: { width: 120, height: 120 },
  assetPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  assetPlaceholderText: { fontSize: 11, color: TEXT_LIGHT },
  assetUploadArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  assetUploadAreaText: { fontSize: 11, color: '#9CA3AF' },
  assetRemoveBtn: {
    position: 'absolute' as any,
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assetSlotLabel: { fontSize: 11, fontWeight: '600', color: TEXT_LIGHT, textAlign: 'center' },
  assetReplaceBtn: { alignItems: 'center' },
  assetReplaceBtnText: { fontSize: 11, color: BRAND, fontWeight: '500' },
});

const fm = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheet: {
    backgroundColor: SURFACE,
    borderRadius: 12,
    width: 460,
    maxWidth: '90%' as any,
    maxHeight: '85%' as any,
    overflow: 'hidden' as any,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  title: { fontSize: 17, fontWeight: '700', color: TEXT },
  body: { paddingHorizontal: 20, paddingTop: 14 },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 6,
    padding: 10,
    marginBottom: 12,
  },
  errorText: { fontSize: 13, color: '#DC2626' },
  label: { fontSize: 13, fontWeight: '600', color: TEXT_LIGHT, marginBottom: 6, marginTop: 14 },
  input: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: TEXT,
    backgroundColor: BG,
    outlineStyle: 'none' as any,
  },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: BG,
  },
  selectText: { fontSize: 14, color: TEXT },
  dropdown: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    backgroundColor: SURFACE,
    marginTop: 4,
    overflow: 'hidden' as any,
    zIndex: 10,
  },
  dropOption: { paddingHorizontal: 14, paddingVertical: 10 },
  dropOptionActive: { backgroundColor: '#EFF6FF' },
  dropOptionText: { fontSize: 14, color: TEXT },
  dropOptionTextActive: { color: BRAND, fontWeight: '600' },
  hexRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hexSwatch: {
    width: 34,
    height: 34,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: BORDER,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  btnCancel: {
    flex: 1,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  btnCancelText: { fontSize: 14, fontWeight: '600', color: TEXT_LIGHT },
  btnSave: {
    flex: 2,
    backgroundColor: BRAND,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  btnSaveText: { fontSize: 14, fontWeight: '600', color: '#fff' },
});
