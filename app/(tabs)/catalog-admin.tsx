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

const BRAND = Colors.light.tint;
const TEXT = Colors.light.text;
const TEXT_LIGHT = Colors.light.textSecondary;
const BORDER = Colors.light.border;
const SURFACE = Colors.light.surface;
const BG = Colors.light.background;

const PRODUCT_CATEGORIES = ['Apparel', 'Headwear', 'Bags', 'Promotional', 'Accessories', 'Other'];

const EMPTY_FORM = {
  styleNumber: '',
  brand: '',
  vendor: '',
  name: '',
  category: 'Apparel',
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
  const [showCatDrop, setShowCatDrop] = useState(false);

  useEffect(() => {
    if (visible) {
      setForm(
        initial
          ? {
              styleNumber: initial.styleNumber,
              brand: initial.brand,
              vendor: initial.vendor,
              name: initial.name,
              category: initial.category || 'Apparel',
            }
          : { ...EMPTY_FORM },
      );
      setError('');
      setSaving(false);
      setShowCatDrop(false);
    }
  }, [visible, initial]);

  const upd = <K extends keyof typeof EMPTY_FORM>(k: K, v: (typeof EMPTY_FORM)[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.styleNumber.trim()) { setError('Style number is required.'); return; }
    if (!form.brand.trim()) { setError('Brand is required.'); return; }
    if (!form.vendor.trim()) { setError('Vendor is required.'); return; }
    if (!form.name.trim()) { setError('Product name is required.'); return; }
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
        <TouchableOpacity activeOpacity={1} style={fm.sheet} onPress={() => setShowCatDrop(false)}>
          <View style={fm.header}>
            <Text style={fm.title}>{initial ? 'Edit Product' : 'New Product'}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={20} color={TEXT_LIGHT} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={fm.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {!!error && (
              <View style={fm.errorBox}>
                <Text style={fm.errorText}>{error}</Text>
              </View>
            )}

            <Text style={fm.label}>
              Style Number <Text style={{ color: BRAND }}>*</Text>
            </Text>
            <TextInput
              style={fm.input}
              value={form.styleNumber}
              onChangeText={v => upd('styleNumber', v)}
              placeholder="e.g. NL6210"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="characters"
            />

            <Text style={fm.label}>
              Brand <Text style={{ color: BRAND }}>*</Text>
            </Text>
            <TextInput
              style={fm.input}
              value={form.brand}
              onChangeText={v => upd('brand', v)}
              placeholder="e.g. Next Level"
              placeholderTextColor="#9CA3AF"
            />

            <Text style={fm.label}>
              Vendor <Text style={{ color: BRAND }}>*</Text>
            </Text>
            <TextInput
              style={fm.input}
              value={form.vendor}
              onChangeText={v => upd('vendor', v)}
              placeholder="e.g. SanMar"
              placeholderTextColor="#9CA3AF"
            />

            <Text style={fm.label}>
              Product Name <Text style={{ color: BRAND }}>*</Text>
            </Text>
            <TextInput
              style={fm.input}
              value={form.name}
              onChangeText={v => upd('name', v)}
              placeholder="e.g. CVC Crew Tee"
              placeholderTextColor="#9CA3AF"
            />

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
                    onPress={() => {
                      upd('category', cat as any);
                      setShowCatDrop(false);
                    }}
                  >
                    <Text
                      style={[
                        fm.dropOptionText,
                        form.category === cat && fm.dropOptionTextActive,
                      ]}
                    >
                      {cat}
                    </Text>
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
            <TouchableOpacity
              style={[fm.btnSave, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={fm.btnSaveText}>Save Product</Text>
              )}
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
        <Text style={[s.th, s.cVendor]}>Vendor</Text>
        <Text style={[s.th, s.cName]}>Product Name</Text>
        <Text style={[s.th, s.cCat]}>Category</Text>
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
              <Text style={[s.td, s.cVendor]} numberOfLines={1}>
                {product.vendor}
              </Text>
              <Text style={[s.td, s.cName]} numberOfLines={1}>
                {product.name}
              </Text>
              <Text style={[s.td, s.cCat]} numberOfLines={1}>
                {product.category || '—'}
              </Text>
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
  cVendor:  { width: 120, marginRight: 16 },
  cName:    { flex: 1, minWidth: 140, marginRight: 16 },
  cCat:     { width: 100, marginRight: 16 },
  cStatus:  { width: 80, marginRight: 8 },
  cActions: { width: 44, alignItems: 'center', position: 'relative' as any },

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
