import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { DollarSign, Save, Search, X, Check } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { apiFetch } from '@/lib/apiFetch';
import PageBackHeader from '@/components/PageBackHeader';

const BRAND      = Colors.light.tint;
const TEXT       = Colors.light.text;
const TEXT_LIGHT = Colors.light.textSecondary;
const BORDER     = Colors.light.border;
const SURFACE    = Colors.light.surface;
const BG         = Colors.light.background;

interface Product {
  id: string;
  styleNumber: string;
  brand: string;
  name: string;
  category: string;
  isActive: boolean;
  defaultBlankCost: number | string | null;
  lastCostUpdatedAt: string | null;
}

function formatUpdated(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function CostRow({ product, onSave }: {
  product: Product;
  onSave: (id: string, cost: string) => Promise<void>;
}) {
  const [editing, setEditing]   = useState(false);
  const [value, setValue]       = useState('');
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const inputRef                = useRef<TextInput>(null);

  const currentCost = product.defaultBlankCost != null
    ? parseFloat(String(product.defaultBlankCost)).toFixed(2)
    : null;

  const startEdit = () => {
    setValue(currentCost ?? '');
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleSave = async () => {
    if (!editing) return;
    setEditing(false);
    if (value.trim() === (currentCost ?? '') || (value.trim() === '' && currentCost === null)) return;
    setSaving(true);
    try {
      await onSave(product.id, value.trim());
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setEditing(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={s.row}>
      <Text style={[s.td, s.cStyle]} numberOfLines={1}>{product.styleNumber}</Text>
      <View style={s.cProduct}>
        <Text style={s.productName} numberOfLines={1}>{product.name}</Text>
        <Text style={s.productBrand} numberOfLines={1}>{product.brand} · {product.category}</Text>
      </View>
      <View style={s.cCost}>
        {editing ? (
          <View style={s.costEditRow}>
            <Text style={s.costPrefix}>$</Text>
            <TextInput
              ref={inputRef}
              style={s.costInput}
              value={value}
              onChangeText={setValue}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor="#9CA3AF"
              onBlur={handleSave}
              onSubmitEditing={handleSave}
              selectTextOnFocus
            />
          </View>
        ) : (
          <TouchableOpacity style={s.costDisplay} onPress={startEdit} activeOpacity={0.7}>
            {saving ? (
              <ActivityIndicator size="small" color={BRAND} />
            ) : saved ? (
              <View style={s.savedRow}>
                <Check size={14} color="#10B981" />
                <Text style={s.savedText}>${parseFloat(value || '0').toFixed(2)}</Text>
              </View>
            ) : currentCost != null ? (
              <Text style={s.costValue}>${currentCost}</Text>
            ) : (
              <Text style={s.costMissing}>— Add cost</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
      <View style={s.cUpdated}>
        <Text style={s.updatedText}>{formatUpdated(product.lastCostUpdatedAt)}</Text>
      </View>
    </View>
  );
}

export default function CatalogCostsScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [saving, setSaving]     = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  const [pendingCosts, setPendingCosts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/api/products?active=false');
      setProducts(data.products || []);
    } catch (e) {
      console.error('[CatalogCosts] load error', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = products.filter(p => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      p.styleNumber.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q)
    );
  });

  const handleSaveOne = async (id: string, costStr: string) => {
    const costVal = costStr.trim() === '' ? null : parseFloat(costStr);
    await apiFetch(`/api/products/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ defaultBlankCost: costVal }),
    });
    setProducts(prev => prev.map(p =>
      p.id === id
        ? { ...p, defaultBlankCost: costVal, lastCostUpdatedAt: new Date().toISOString() }
        : p,
    ));
  };

  const missingCount = products.filter(p => p.defaultBlankCost == null && p.isActive).length;

  return (
    <View style={s.screen}>
      <PageBackHeader
        title="Manage Costs"
        subtitle={loading ? undefined : `${products.filter(p => p.isActive).length} active products`}
      />

      {/* Info banner */}
      {!loading && missingCount > 0 && (
        <View style={s.banner}>
          <DollarSign size={14} color="#D97706" />
          <Text style={s.bannerText}>
            <Text style={{ fontWeight: '700' }}>{missingCount}</Text> active product{missingCount !== 1 ? 's' : ''} missing a cost. Click any cost cell to edit.
          </Text>
        </View>
      )}

      {/* Search toolbar */}
      <View style={s.toolbarRow}>
        <View style={s.searchBox}>
          <Search size={15} color={TEXT_LIGHT} />
          <TextInput
            style={s.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search style #, brand, or name…"
            placeholderTextColor="#9CA3AF"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={14} color={TEXT_LIGHT} />
            </TouchableOpacity>
          )}
        </View>
        <Text style={s.hintText}>Click any cost to edit inline</Text>
      </View>

      {/* Table header */}
      <View style={s.tableHeader}>
        <Text style={[s.th, s.cStyle]}>Style #</Text>
        <Text style={[s.th, s.cProduct]}>Product</Text>
        <Text style={[s.th, s.cCost]}>Default Cost</Text>
        <Text style={[s.th, s.cUpdated]}>Last Updated</Text>
      </View>

      {loading ? (
        <View style={s.centerBox}>
          <ActivityIndicator color={BRAND} size="large" />
        </View>
      ) : (
        <ScrollView style={s.list} showsVerticalScrollIndicator={false}>
          {filtered.map(product => (
            <CostRow key={product.id} product={product} onSave={handleSaveOne} />
          ))}
          {filtered.length === 0 && (
            <View style={s.emptyBox}>
              <Text style={s.emptyText}>No products match your search.</Text>
            </View>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF3C7',
    borderBottomWidth: 1, borderBottomColor: '#FDE68A',
    paddingHorizontal: 20, paddingVertical: 10,
  },
  bannerText: { fontSize: 13, color: '#92400E' },

  toolbarRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 10,
    backgroundColor: SURFACE, borderBottomWidth: 1, borderBottomColor: BORDER,
    gap: 12,
  },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: BG, borderWidth: 1, borderColor: BORDER,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7,
    maxWidth: 420,
  },
  searchInput: { flex: 1, fontSize: 14, color: TEXT, outlineStyle: 'none' as any },
  hintText: { fontSize: 12, color: TEXT_LIGHT },

  tableHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 10,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  th: { fontSize: 11, fontWeight: '600', color: TEXT_LIGHT, textTransform: 'uppercase', letterSpacing: 0.4 },

  list: { flex: 1 },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 11,
    backgroundColor: SURFACE, borderBottomWidth: 1, borderBottomColor: BORDER,
    minHeight: 56,
  },
  td: { fontSize: 14, color: TEXT },
  cStyle:   { width: 100, marginRight: 16 },
  cProduct: { flex: 1, marginRight: 16 },
  cCost:    { width: 130, marginRight: 16 },
  cUpdated: { width: 140 },

  productName:  { fontSize: 14, color: TEXT, fontWeight: '500' },
  productBrand: { fontSize: 12, color: TEXT_LIGHT, marginTop: 2 },

  costDisplay: { paddingVertical: 6, paddingHorizontal: 2 },
  costEditRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: BRAND, borderRadius: 6,
    paddingHorizontal: 8, backgroundColor: '#fff',
  },
  costPrefix: { fontSize: 14, color: TEXT, fontWeight: '500', marginRight: 2 },
  costInput: {
    flex: 1, fontSize: 14, color: TEXT,
    paddingVertical: 6, outlineStyle: 'none' as any,
  },
  costValue:   { fontSize: 14, fontWeight: '600', color: TEXT },
  costMissing: { fontSize: 14, color: '#D97706' },
  savedRow:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  savedText:   { fontSize: 14, fontWeight: '600', color: '#10B981' },

  updatedText: { fontSize: 13, color: TEXT_LIGHT },

  emptyBox: { flex: 1, alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 14, color: TEXT_LIGHT },
});
