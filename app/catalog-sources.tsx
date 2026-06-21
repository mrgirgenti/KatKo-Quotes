import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  Truck, Check, Minus, ChevronRight, Star, X, Users,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { apiFetch } from '@/lib/apiFetch';
import PageBackHeader from '@/components/PageBackHeader';

const BRAND      = Colors.light.tint;
const TEXT       = Colors.light.text;
const TEXT_LIGHT = Colors.light.textSecondary;
const BORDER     = Colors.light.border;
const SURFACE    = Colors.light.surface;
const BG         = Colors.light.background;

interface Vendor {
  id: string;
  name: string;
  isActive: boolean;
}

interface Product {
  id: string;
  styleNumber: string;
  brand: string;
  name: string;
  category: string;
  isActive: boolean;
  vendorCount?: number;
  preferredVendorName?: string | null;
}

function Checkbox({ checked, indeterminate, onToggle }: {
  checked: boolean; indeterminate?: boolean; onToggle: () => void;
}) {
  const filled = checked || !!indeterminate;
  return (
    <TouchableOpacity onPress={onToggle} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <View style={{
        width: 17, height: 17, borderRadius: 4,
        borderWidth: 1.5, borderColor: filled ? BRAND : BORDER,
        backgroundColor: filled ? BRAND : '#fff',
        alignItems: 'center' as const, justifyContent: 'center' as const,
      }}>
        {checked && !indeterminate && <Check size={10} color="#fff" strokeWidth={3} />}
        {!!indeterminate && <Minus size={10} color="#fff" strokeWidth={3} />}
      </View>
    </TouchableOpacity>
  );
}

export default function CatalogSourcesScreen() {
  const [vendors, setVendors]   = useState<Vendor[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading]   = useState(true);
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [vendorData, productData] = await Promise.all([
        apiFetch('/api/vendors'),
        apiFetch('/api/products?active=false'),
      ]);
      setVendors((vendorData.vendors || []).filter((v: Vendor) => v.isActive));
      setProducts(productData.products || []);
    } catch (e) {
      console.error('[CatalogSources] load error', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredProducts = products.filter(p => {
    if (!selectedVendorId) return true;
    return true;
  });

  const someSelected     = filteredProducts.some(p => selectedIds.has(p.id));
  const allSelected      = filteredProducts.length > 0 && filteredProducts.every(p => selectedIds.has(p.id));

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleAssignSource = async () => {
    if (!selectedVendorId) {
      Alert.alert('Select a source', 'Pick a vendor from the left panel first, then select products to assign.');
      return;
    }
    if (selectedIds.size === 0) {
      Alert.alert('Select products', 'Check the products you want to assign this source to.');
      return;
    }
    const vendor = vendors.find(v => v.id === selectedVendorId);
    const n = selectedIds.size;
    Alert.alert(
      'Assign Source',
      `Add "${vendor?.name}" as a source for ${n} product${n !== 1 ? 's' : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Assign',
          onPress: async () => {
            setApplying(true);
            try {
              const data = await apiFetch('/api/products/bulk', {
                method: 'POST',
                body: JSON.stringify({ action: 'assign-source', ids: [...selectedIds], vendorId: selectedVendorId }),
              });
              Alert.alert('Done', `Added source to ${data.added} product${data.added !== 1 ? 's' : ''}.${data.skipped > 0 ? ` ${data.skipped} already had this source.` : ''}`);
              setSelectedIds(new Set());
              await load();
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to assign source');
            } finally {
              setApplying(false);
            }
          },
        },
      ],
    );
  };

  const handleRemoveSource = async () => {
    if (!selectedVendorId) {
      Alert.alert('Select a source', 'Pick the vendor to remove from the left panel.');
      return;
    }
    if (selectedIds.size === 0) {
      Alert.alert('Select products', 'Check the products you want to remove this source from.');
      return;
    }
    const vendor = vendors.find(v => v.id === selectedVendorId);
    const n = selectedIds.size;
    Alert.alert(
      'Remove Source',
      `Remove "${vendor?.name}" from ${n} product${n !== 1 ? 's' : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: async () => {
            setApplying(true);
            try {
              await apiFetch('/api/products/bulk', {
                method: 'POST',
                body: JSON.stringify({ action: 'remove-source', ids: [...selectedIds], vendorId: selectedVendorId }),
              });
              setSelectedIds(new Set());
              await load();
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to remove source');
            } finally {
              setApplying(false);
            }
          },
        },
      ],
    );
  };

  const handleSetPreferred = async () => {
    if (!selectedVendorId || selectedIds.size === 0) return;
    const vendor = vendors.find(v => v.id === selectedVendorId);
    const n = selectedIds.size;
    Alert.alert(
      'Set Preferred Source',
      `Set "${vendor?.name}" as the preferred source for ${n} product${n !== 1 ? 's' : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Set Preferred',
          onPress: async () => {
            setApplying(true);
            try {
              await apiFetch('/api/products/bulk', {
                method: 'POST',
                body: JSON.stringify({ action: 'set-preferred-source', ids: [...selectedIds], vendorId: selectedVendorId }),
              });
              setSelectedIds(new Set());
              await load();
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to set preferred source');
            } finally {
              setApplying(false);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={s.screen}>
      <PageBackHeader title="Manage Sources" />

      {loading ? (
        <View style={s.centerBox}>
          <ActivityIndicator color={BRAND} size="large" />
        </View>
      ) : (
        <View style={s.body}>
          {/* Left: vendor list */}
          <View style={s.sidebar}>
            <View style={s.sidebarHeader}>
              <Truck size={15} color={BRAND} />
              <Text style={s.sidebarTitle}>Vendors</Text>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <TouchableOpacity
                style={[s.vendorRow, !selectedVendorId && s.vendorRowActive]}
                onPress={() => { setSelectedVendorId(null); setSelectedIds(new Set()); }}
              >
                <Users size={15} color={!selectedVendorId ? BRAND : TEXT_LIGHT} />
                <Text style={[s.vendorName, !selectedVendorId && { color: BRAND, fontWeight: '700' }]}>
                  All Products
                </Text>
                <Text style={s.vendorCount}>{products.length}</Text>
              </TouchableOpacity>
              {vendors.map(v => (
                <TouchableOpacity
                  key={v.id}
                  style={[s.vendorRow, selectedVendorId === v.id && s.vendorRowActive]}
                  onPress={() => { setSelectedVendorId(v.id); setSelectedIds(new Set()); }}
                >
                  <Truck size={15} color={selectedVendorId === v.id ? BRAND : TEXT_LIGHT} />
                  <Text style={[s.vendorName, selectedVendorId === v.id && { color: BRAND, fontWeight: '700' }]} numberOfLines={1}>
                    {v.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Right: product list */}
          <View style={s.main}>
            {/* Selection action bar */}
            {(selectedIds.size > 0 || selectedVendorId) && (
              <View style={s.actionBar}>
                {selectedIds.size > 0 ? (
                  <>
                    <Text style={s.selText}>{selectedIds.size} selected</Text>
                    {selectedVendorId && (
                      <>
                        <TouchableOpacity
                          style={s.actionBtn}
                          onPress={handleAssignSource}
                          disabled={applying}
                        >
                          {applying ? <ActivityIndicator size="small" color={BRAND} /> : (
                            <Text style={s.actionBtnText}>Assign Source</Text>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity style={s.actionBtn} onPress={handleSetPreferred} disabled={applying}>
                          <Star size={14} color={BRAND} />
                          <Text style={s.actionBtnText}>Set Preferred</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[s.actionBtn, { borderColor: '#FECACA' }]} onPress={handleRemoveSource} disabled={applying}>
                          <X size={14} color="#DC2626" />
                          <Text style={[s.actionBtnText, { color: '#DC2626' }]}>Remove Source</Text>
                        </TouchableOpacity>
                      </>
                    )}
                    <TouchableOpacity onPress={() => setSelectedIds(new Set())} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <X size={15} color={TEXT_LIGHT} />
                    </TouchableOpacity>
                  </>
                ) : (
                  <Text style={s.actionHint}>
                    {selectedVendorId
                      ? `Showing all products. Check products to assign/remove "${vendors.find(v => v.id === selectedVendorId)?.name}".`
                      : 'Select a vendor to filter and take bulk actions.'}
                  </Text>
                )}
              </View>
            )}

            {/* Table header */}
            <View style={s.tableHeader}>
              <View style={s.cCheck}>
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected && !allSelected}
                  onToggle={() => {
                    const ids = filteredProducts.map(p => p.id);
                    if (allSelected) {
                      setSelectedIds(prev => { const n = new Set(prev); ids.forEach(id => n.delete(id)); return n; });
                    } else {
                      setSelectedIds(prev => { const n = new Set(prev); ids.forEach(id => n.add(id)); return n; });
                    }
                  }}
                />
              </View>
              <Text style={[s.th, s.cStyle]}>Style #</Text>
              <Text style={[s.th, s.cName]}>Product</Text>
              <Text style={[s.th, s.cSources]}>Current Sources</Text>
              <Text style={[s.th, s.cPreferred]}>Preferred</Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {filteredProducts.map(product => (
                <View key={product.id} style={[s.row, selectedIds.has(product.id) && s.rowSelected]}>
                  <View style={s.cCheck}>
                    <Checkbox checked={selectedIds.has(product.id)} onToggle={() => toggleSelect(product.id)} />
                  </View>
                  <Text style={[s.td, s.cStyle]} numberOfLines={1}>{product.styleNumber}</Text>
                  <View style={s.cName}>
                    <Text style={s.productName} numberOfLines={1}>{product.name}</Text>
                    <Text style={s.productBrand} numberOfLines={1}>{product.brand}</Text>
                  </View>
                  <View style={s.cSources}>
                    {(product.vendorCount ?? 0) > 0 ? (
                      <Text style={s.sourcesText}>
                        {product.vendorCount} {product.vendorCount === 1 ? 'source' : 'sources'}
                      </Text>
                    ) : (
                      <Text style={[s.sourcesText, { color: '#D97706' }]}>None</Text>
                    )}
                  </View>
                  <View style={s.cPreferred}>
                    {product.preferredVendorName ? (
                      <View style={s.preferredPill}>
                        <Star size={11} color="#D97706" />
                        <Text style={s.preferredText} numberOfLines={1}>{product.preferredVendorName}</Text>
                      </View>
                    ) : (
                      <Text style={s.noPreferred}>—</Text>
                    )}
                  </View>
                </View>
              ))}
              {filteredProducts.length === 0 && (
                <View style={s.emptyBox}>
                  <Text style={s.emptyText}>No products found.</Text>
                </View>
              )}
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen:    { flex: 1, backgroundColor: BG },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  body: { flex: 1, flexDirection: 'row' },

  sidebar: {
    width: 220,
    borderRightWidth: 1,
    borderRightColor: BORDER,
    backgroundColor: SURFACE,
  },
  sidebarHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  sidebarTitle: { fontSize: 13, fontWeight: '700', color: TEXT },
  vendorRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  vendorRowActive: { backgroundColor: '#EFF6FF' },
  vendorName:  { flex: 1, fontSize: 13, color: TEXT },
  vendorCount: { fontSize: 12, color: TEXT_LIGHT, fontWeight: '600' },

  main: { flex: 1 },

  actionBar: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8,
    paddingHorizontal: 20, paddingVertical: 10,
    backgroundColor: '#EFF6FF',
    borderBottomWidth: 1, borderBottomColor: '#BFDBFE',
  },
  selText:    { fontSize: 13, fontWeight: '600', color: BRAND },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderColor: BRAND, borderRadius: 6,
    paddingVertical: 5, paddingHorizontal: 10, backgroundColor: SURFACE,
  },
  actionBtnText: { fontSize: 13, color: BRAND, fontWeight: '500' },
  actionHint: { fontSize: 13, color: TEXT_LIGHT },

  tableHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 10,
    backgroundColor: '#F8FAFC', borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  th: { fontSize: 11, fontWeight: '600', color: TEXT_LIGHT, textTransform: 'uppercase', letterSpacing: 0.4 },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 11,
    backgroundColor: SURFACE, borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  rowSelected: { backgroundColor: '#F0F9FF' },
  td: { fontSize: 14, color: TEXT },

  cCheck:     { width: 30, marginRight: 8 },
  cStyle:     { width: 96, marginRight: 16 },
  cName:      { flex: 1, marginRight: 16 },
  cSources:   { width: 120, marginRight: 16 },
  cPreferred: { width: 140 },

  productName:  { fontSize: 14, color: TEXT, fontWeight: '500' },
  productBrand: { fontSize: 12, color: TEXT_LIGHT, marginTop: 2 },
  sourcesText:  { fontSize: 13, color: TEXT_LIGHT },

  preferredPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FEF3C7', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  preferredText: { fontSize: 12, color: '#92400E', fontWeight: '500', maxWidth: 110 },
  noPreferred: { fontSize: 13, color: '#D1D5DB' },

  emptyBox:  { flex: 1, alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 14, color: TEXT_LIGHT },
});
