import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import {
  Package,
  Plus,
  Pencil,
  MoreVertical,
  X,
  ChevronDown,
  Search,
  EyeOff,
  Eye,
  ChevronRight,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import { apiFetch } from '@/lib/apiFetch';
import { CATEGORY_TREE, GENDER_OPTIONS } from '@/lib/templateMapping';

const BRAND = Colors.light.tint;
const TEXT = Colors.light.text;
const TEXT_LIGHT = Colors.light.textSecondary;
const BORDER = Colors.light.border;
const SURFACE = Colors.light.surface;
const BG = Colors.light.background;

const EMPTY_FORM = {
  styleNumber: '',
  brand:       '',
  vendor:      '',
  name:        '',
  category:    'Apparel',
  subcategory: '',
  productType: '',
  gender:      '',
};

interface Product {
  id: string;
  styleNumber: string;
  brand: string;
  vendor: string;
  name: string;
  category: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  subcategory?: string | null;
  productType?: string | null;
  gender?: string | null;
  vendorCount?: number;
  preferredVendorName?: string | null;
  defaultBlankCost?: number | string | null;
  lastCostUpdatedAt?: string | null;
  colorCount?: number;
  assetCount?: number;
  placementCount?: number;
  templateId?: string | null;
}

function ProductFormModal({
  visible,
  initial,
  onSave,
  onClose,
}: {
  visible: boolean;
  initial: Product | null;
  onSave: (form: typeof EMPTY_FORM) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [openDrop, setOpenDrop] = useState<'cat' | 'sub' | 'type' | 'gen' | null>(null);

  const subcategories = Object.keys(CATEGORY_TREE[form.category] ?? {});
  const productTypes  = CATEGORY_TREE[form.category]?.[form.subcategory] ?? [];
  const TOP_CATS      = Object.keys(CATEGORY_TREE);

  useEffect(() => {
    if (visible) {
      setForm(
        initial
          ? {
              styleNumber: initial.styleNumber,
              brand:       initial.brand,
              vendor:      initial.vendor,
              name:        initial.name,
              category:    initial.category    || 'Apparel',
              subcategory: initial.subcategory || '',
              productType: initial.productType || '',
              gender:      initial.gender      || '',
            }
          : { ...EMPTY_FORM },
      );
      setError('');
      setSaving(false);
      setOpenDrop(null);
    }
  }, [visible, initial]);

  const upd = <K extends keyof typeof EMPTY_FORM>(k: K, v: (typeof EMPTY_FORM)[K]) =>
    setForm(f => ({ ...f, [k]: v }));
  const setCategory    = (v: string) => { setForm(f => ({ ...f, category: v, subcategory: '', productType: '' })); setOpenDrop(null); };
  const setSubcategory = (v: string) => { setForm(f => ({ ...f, subcategory: v, productType: '' })); setOpenDrop(null); };

  const handleSave = async () => {
    if (!form.styleNumber.trim()) { setError('Style number is required.'); return; }
    if (!form.brand.trim())       { setError('Brand is required.'); return; }
    if (!form.vendor.trim())      { setError('Manufacturer is required.'); return; }
    if (!form.name.trim())        { setError('Product name is required.'); return; }
    setError('');
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to save product.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={fm.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={fm.sheet} onPress={() => setOpenDrop(null)}>
          <View style={fm.header}>
            <Text style={fm.title}>{initial ? 'Edit Product' : 'New Product'}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={20} color={TEXT_LIGHT} />
            </TouchableOpacity>
          </View>

          <ScrollView style={fm.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {!!error && (
              <View style={fm.errorBox}><Text style={fm.errorText}>{error}</Text></View>
            )}

            <Text style={fm.label}>Style Number <Text style={{ color: BRAND }}>*</Text></Text>
            <TextInput style={fm.input} value={form.styleNumber} onChangeText={v => upd('styleNumber', v)}
              placeholder="e.g. NL6210" placeholderTextColor="#9CA3AF" autoCapitalize="characters" />

            <Text style={fm.label}>Brand <Text style={{ color: BRAND }}>*</Text></Text>
            <TextInput style={fm.input} value={form.brand} onChangeText={v => upd('brand', v)}
              placeholder="e.g. Next Level" placeholderTextColor="#9CA3AF" />

            <Text style={fm.label}>Manufacturer <Text style={{ color: BRAND }}>*</Text></Text>
            <TextInput style={fm.input} value={form.vendor} onChangeText={v => upd('vendor', v)}
              placeholder="e.g. Next Level" placeholderTextColor="#9CA3AF" />

            <Text style={fm.label}>Product Name <Text style={{ color: BRAND }}>*</Text></Text>
            <TextInput style={fm.input} value={form.name} onChangeText={v => upd('name', v)}
              placeholder="e.g. CVC Crew Tee" placeholderTextColor="#9CA3AF" />

            {/* Category */}
            <Text style={fm.label}>Category</Text>
            <TouchableOpacity style={fm.select} onPress={() => setOpenDrop(d => d === 'cat' ? null : 'cat')}>
              <Text style={fm.selectText}>{form.category || 'Select…'}</Text>
              <ChevronDown size={16} color={TEXT_LIGHT} />
            </TouchableOpacity>
            {openDrop === 'cat' && (
              <View style={fm.dropdown}>
                {TOP_CATS.map(cat => (
                  <TouchableOpacity key={cat} style={[fm.dropOption, form.category === cat && fm.dropOptionActive]}
                    onPress={() => setCategory(cat)}>
                    <Text style={[fm.dropOptionText, form.category === cat && fm.dropOptionTextActive]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Subcategory */}
            {subcategories.length > 0 && (
              <>
                <Text style={fm.label}>Subcategory</Text>
                <TouchableOpacity style={fm.select} onPress={() => setOpenDrop(d => d === 'sub' ? null : 'sub')}>
                  <Text style={[fm.selectText, !form.subcategory && { color: '#9CA3AF' }]}>
                    {form.subcategory || 'Select…'}
                  </Text>
                  <ChevronDown size={16} color={TEXT_LIGHT} />
                </TouchableOpacity>
                {openDrop === 'sub' && (
                  <View style={fm.dropdown}>
                    <TouchableOpacity style={fm.dropOption} onPress={() => setSubcategory('')}>
                      <Text style={[fm.dropOptionText, !form.subcategory && { color: BRAND, fontWeight: '600' }]}>— None —</Text>
                    </TouchableOpacity>
                    {subcategories.map(sub => (
                      <TouchableOpacity key={sub} style={[fm.dropOption, form.subcategory === sub && fm.dropOptionActive]}
                        onPress={() => setSubcategory(sub)}>
                        <Text style={[fm.dropOptionText, form.subcategory === sub && fm.dropOptionTextActive]}>{sub}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            )}

            {/* Product Type */}
            {productTypes.length > 0 && (
              <>
                <Text style={fm.label}>Product Type</Text>
                <TouchableOpacity style={fm.select} onPress={() => setOpenDrop(d => d === 'type' ? null : 'type')}>
                  <Text style={[fm.selectText, !form.productType && { color: '#9CA3AF' }]}>
                    {form.productType || 'Select…'}
                  </Text>
                  <ChevronDown size={16} color={TEXT_LIGHT} />
                </TouchableOpacity>
                {openDrop === 'type' && (
                  <View style={fm.dropdown}>
                    <TouchableOpacity style={fm.dropOption} onPress={() => { upd('productType', ''); setOpenDrop(null); }}>
                      <Text style={[fm.dropOptionText, !form.productType && { color: BRAND, fontWeight: '600' }]}>— None —</Text>
                    </TouchableOpacity>
                    {productTypes.map(pt => (
                      <TouchableOpacity key={pt} style={[fm.dropOption, form.productType === pt && fm.dropOptionActive]}
                        onPress={() => { upd('productType', pt); setOpenDrop(null); }}>
                        <Text style={[fm.dropOptionText, form.productType === pt && fm.dropOptionTextActive]}>{pt}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            )}

            {/* Gender */}
            <Text style={fm.label}>Gender</Text>
            <TouchableOpacity style={fm.select} onPress={() => setOpenDrop(d => d === 'gen' ? null : 'gen')}>
              <Text style={[fm.selectText, !form.gender && { color: '#9CA3AF' }]}>
                {form.gender || 'Select…'}
              </Text>
              <ChevronDown size={16} color={TEXT_LIGHT} />
            </TouchableOpacity>
            {openDrop === 'gen' && (
              <View style={fm.dropdown}>
                <TouchableOpacity style={fm.dropOption} onPress={() => { upd('gender', ''); setOpenDrop(null); }}>
                  <Text style={[fm.dropOptionText, !form.gender && { color: BRAND, fontWeight: '600' }]}>— None —</Text>
                </TouchableOpacity>
                {GENDER_OPTIONS.map(g => (
                  <TouchableOpacity key={g} style={[fm.dropOption, form.gender === g && fm.dropOptionActive]}
                    onPress={() => { upd('gender', g); setOpenDrop(null); }}>
                    <Text style={[fm.dropOptionText, form.gender === g && fm.dropOptionTextActive]}>{g}</Text>
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
              {saving
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={fm.btnSaveText}>Save Product</Text>}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

export default function CatalogAdminScreen() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [bulkResolving, setBulkResolving] = useState(false);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/api/products?active=false');
      setProducts(data.products || []);
    } catch (e) {
      console.error('[CatalogAdmin] load error', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const filtered = products.filter(p => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      p.styleNumber.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q) ||
      p.vendor.toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q)
    );
  });

  const handleSave = async (form: typeof EMPTY_FORM) => {
    if (editing) {
      await apiFetch(`/api/products/${editing.id}`, {
        method: 'PATCH',
        body: JSON.stringify(form),
      });
    } else {
      await apiFetch('/api/products', {
        method: 'POST',
        body: JSON.stringify(form),
      });
    }
    await loadProducts();
  };

  const handleBulkResolve = async () => {
    setBulkResolving(true);
    try {
      const data = await apiFetch('/api/products/bulk-resolve-templates', { method: 'POST' });
      const { resolved, unresolved, skipped } = data as { resolved: number; unresolved: number; skipped: number };
      Alert.alert(
        'Auto-Resolve Complete',
        `Templates assigned: ${resolved}\nNeeds manual assignment: ${unresolved}\nAlready had template: ${skipped}`,
      );
      if (resolved > 0) await loadProducts();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to auto-resolve templates');
    } finally {
      setBulkResolving(false);
    }
  };

  const handleToggleActive = async (product: Product) => {
    setMenuId(null);
    try {
      await apiFetch(`/api/products/${product.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !product.isActive }),
      });
      setProducts(prev =>
        prev.map(p => (p.id === product.id ? { ...p, isActive: !p.isActive } : p)),
      );
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update product');
    }
  };

  const activeCount = products.filter(p => p.isActive).length;

  return (
    <View style={s.screen} onStartShouldSetResponder={() => { setMenuId(null); return false; }}>
      {/* Page header */}
      <View style={s.pageHeader}>
        <View style={s.pageHeaderLeft}>
          <Package size={22} color={BRAND} />
          <Text style={s.pageTitle}>Products</Text>
          {!loading && (
            <View style={s.countBadge}>
              <Text style={s.countText}>{activeCount}</Text>
            </View>
          )}
        </View>
        <View style={s.headerActions}>
          <TouchableOpacity style={s.resolveBtn} onPress={handleBulkResolve} disabled={bulkResolving}>
            {bulkResolving
              ? <ActivityIndicator size="small" color={BRAND} />
              : <Text style={s.resolveBtnText}>Auto-resolve</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            style={s.addBtn}
            onPress={() => {
              setEditing(null);
              setModalVisible(true);
            }}
          >
            <Plus size={15} color="#fff" />
            <Text style={s.addBtnText}>New Product</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search */}
      <View style={s.searchRow}>
        <View style={s.searchBox}>
          <Search size={15} color={TEXT_LIGHT} />
          <TextInput
            style={s.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search style #, brand, vendor, name…"
            placeholderTextColor="#9CA3AF"
          />
          {search.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearch('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={14} color={TEXT_LIGHT} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Table header */}
      <View style={s.tableHeader}>
        <Text style={[s.th, s.cStyle]}>Style #</Text>
        <Text style={[s.th, s.cBrand]}>Brand</Text>
        <Text style={[s.th, s.cVendor]}>Sources</Text>
        <Text style={[s.th, s.cName]}>Product Name</Text>
        <Text style={[s.th, s.cCat]}>Category</Text>
        <Text style={[s.th, s.cCost]}>Cost</Text>
        <Text style={[s.th, s.cStatus]}>Status</Text>
        <View style={s.cActions} />
      </View>

      {/* Body */}
      {loading ? (
        <View style={s.loadingBox}>
          <ActivityIndicator color={BRAND} size="large" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={s.emptyBox}>
          <Package size={36} color={BORDER} />
          <Text style={s.emptyTitle}>
            {search ? 'No products match your search.' : 'No products yet.'}
          </Text>
          {!search && (
            <Text style={s.emptySubtitle}>Add your first product to get started.</Text>
          )}
        </View>
      ) : (
        <ScrollView style={s.list} showsVerticalScrollIndicator={false}>
          {filtered.map(product => (
            <TouchableOpacity
              key={product.id}
              style={s.row}
              onPress={() => {
                setMenuId(null);
                router.push(`/product/${product.id}` as any);
              }}
              activeOpacity={0.75}
            >
              <Text style={[s.td, s.cStyle, s.tdBold]} numberOfLines={1}>
                {product.styleNumber}
              </Text>
              <Text style={[s.td, s.cBrand]} numberOfLines={1}>
                {product.brand}
              </Text>
              <View style={s.cVendor}>
                <Text style={s.td} numberOfLines={1}>
                  {product.preferredVendorName ?? '—'}
                </Text>
                {(product.vendorCount ?? 0) > 0 && (
                  <Text style={s.tdSub} numberOfLines={1}>
                    {product.vendorCount} {product.vendorCount === 1 ? 'source' : 'sources'}
                  </Text>
                )}
              </View>
              <Text style={[s.td, s.cName]} numberOfLines={1}>
                {product.name}
              </Text>
              <View style={s.cCat}>
                <Text style={s.td} numberOfLines={1}>
                  {product.subcategory || product.category || '—'}
                </Text>
                {!!product.productType && (
                  <Text style={s.tdSub} numberOfLines={1}>{product.productType}</Text>
                )}
              </View>
              {/* Cost + health dots */}
              <View style={s.cCost}>
                {product.defaultBlankCost != null ? (
                  <Text style={s.costCell} numberOfLines={1}>
                    ${parseFloat(String(product.defaultBlankCost)).toFixed(2)}
                  </Text>
                ) : (
                  <Text style={s.costCellMissing} numberOfLines={1}>No cost</Text>
                )}
                <View style={s.healthDots}>
                  {/* $ cost */}
                  <View style={[s.dot, product.defaultBlankCost != null ? s.dotOk : s.dotWarn]} />
                  {/* colors */}
                  <View style={[s.dot, (product.colorCount ?? 0) > 0 ? s.dotOk : s.dotWarn]} />
                  {/* assets */}
                  <View style={[s.dot, (product.assetCount ?? 0) > 0 ? s.dotOk : s.dotMute]} />
                  {/* template/placements */}
                  <View style={[s.dot, (product.templateId || (product.placementCount ?? 0) > 0) ? s.dotOk : s.dotMute]} />
                </View>
              </View>

              <View style={s.cStatus}>
                <View
                  style={[
                    s.badge,
                    product.isActive ? s.badgeActive : s.badgeInactive,
                  ]}
                >
                  <Text
                    style={[
                      s.badgeText,
                      product.isActive ? s.badgeTextActive : s.badgeTextInactive,
                    ]}
                  >
                    {product.isActive ? 'Active' : 'Inactive'}
                  </Text>
                </View>
              </View>

              {/* Row menu */}
              <View style={s.cActions}>
                <TouchableOpacity
                  style={s.menuBtn}
                  onPress={e => {
                    e.stopPropagation?.();
                    setMenuId(prev => (prev === product.id ? null : product.id));
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MoreVertical size={16} color={TEXT_LIGHT} />
                </TouchableOpacity>

                {menuId === product.id && (
                  <View style={s.menu}>
                    <TouchableOpacity
                      style={s.menuItem}
                      onPress={() => {
                        setMenuId(null);
                        router.push(`/product/${product.id}` as any);
                      }}
                    >
                      <ChevronRight size={15} color={TEXT} />
                      <Text style={s.menuItemText}>View Details</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={s.menuItem}
                      onPress={() => {
                        setMenuId(null);
                        setEditing(product);
                        setModalVisible(true);
                      }}
                    >
                      <Pencil size={15} color={TEXT} />
                      <Text style={s.menuItemText}>Edit</Text>
                    </TouchableOpacity>
                    <View style={s.menuDivider} />
                    <TouchableOpacity
                      style={s.menuItem}
                      onPress={() => handleToggleActive(product)}
                    >
                      {product.isActive ? (
                        <EyeOff size={15} color="#DC2626" />
                      ) : (
                        <Eye size={15} color="#059669" />
                      )}
                      <Text
                        style={[
                          s.menuItemText,
                          { color: product.isActive ? '#DC2626' : '#059669' },
                        ]}
                      >
                        {product.isActive ? 'Disable' : 'Enable'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {menuId && (
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          onPress={() => setMenuId(null)}
          activeOpacity={0}
        />
      )}

      <ProductFormModal
        visible={modalVisible}
        initial={editing}
        onSave={handleSave}
        onClose={() => setModalVisible(false)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },

  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    backgroundColor: SURFACE,
  },
  pageHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pageTitle: { fontSize: 20, fontWeight: '700', color: TEXT },
  countBadge: {
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countText: { fontSize: 12, fontWeight: '600', color: BRAND },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: BRAND,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  searchRow: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: SURFACE,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 8,
    maxWidth: 480,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: TEXT,
    outlineStyle: 'none' as any,
  },

  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  th: {
    fontSize: 11,
    fontWeight: '600',
    color: TEXT_LIGHT,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  list: { flex: 1 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 13,
    backgroundColor: SURFACE,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  td: { fontSize: 14, color: TEXT },
  tdBold: { fontWeight: '600' },

  cStyle:   { width: 100, marginRight: 16 },
  cBrand:   { width: 130, marginRight: 16 },
  cVendor:  { width: 150, marginRight: 16, justifyContent: 'center' as any },
  cName:    { flex: 1, minWidth: 140, marginRight: 16 },
  cCat:     { width: 130, marginRight: 16, justifyContent: 'center' as any },
  cStatus:  { width: 80, marginRight: 8 },
  cCost: { width: 88, justifyContent: 'center' as any },
  costCell: { fontSize: 13, fontWeight: '600', color: TEXT },
  costCellMissing: { fontSize: 12, color: '#D97706', fontWeight: '500' },
  healthDots: { flexDirection: 'row', gap: 4, marginTop: 5 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  dotOk:   { backgroundColor: '#10B981' },
  dotWarn: { backgroundColor: '#F59E0B' },
  dotMute: { backgroundColor: '#D1D5DB' },

  cActions: { width: 44, alignItems: 'center', position: 'relative' as any },
  tdSub:    { fontSize: 11, color: TEXT_LIGHT, marginTop: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  resolveBtn: {
    borderWidth: 1, borderColor: BRAND, borderRadius: 8,
    paddingVertical: 7, paddingHorizontal: 12, minWidth: 36,
    alignItems: 'center' as any, justifyContent: 'center' as any,
  },
  resolveBtnText: { color: BRAND, fontWeight: '600' as const, fontSize: 13 },

  badge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  badgeActive: { backgroundColor: '#D1FAE5' },
  badgeInactive: { backgroundColor: '#F3F4F6' },
  badgeText: { fontSize: 11, fontWeight: '600' },
  badgeTextActive: { color: '#059669' },
  badgeTextInactive: { color: '#6B7280' },

  menuBtn: { padding: 4 },
  menu: {
    position: 'absolute' as any,
    top: 28,
    right: 0,
    backgroundColor: SURFACE,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    zIndex: 100,
    minWidth: 160,
    overflow: 'hidden' as any,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  menuItemText: { fontSize: 14, color: TEXT },
  menuDivider: { height: 1, backgroundColor: BORDER, marginHorizontal: 14 },

  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 60 },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: TEXT_LIGHT },
  emptySubtitle: { fontSize: 13, color: TEXT_LIGHT },
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
    width: 480,
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
  body: { paddingHorizontal: 20, paddingTop: 16 },
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
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
    zIndex: 10,
  },
  dropOption: { paddingHorizontal: 14, paddingVertical: 10 },
  dropOptionActive: { backgroundColor: '#EFF6FF' },
  dropOptionText: { fontSize: 14, color: TEXT },
  dropOptionTextActive: { color: BRAND, fontWeight: '600' },
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
