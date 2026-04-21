import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Linking,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { ExternalLink, BookOpen, Tag, Plus, Pencil, Trash2, X, Globe, ChevronDown } from 'lucide-react-native';
import Colors from '@/constants/colors';

const BRAND = Colors.light.tint;
const TEXT = Colors.light.text;
const TEXT_LIGHT = Colors.light.textSecondary;
const BORDER = Colors.light.border;
const SURFACE = Colors.light.surface;

interface Vendor {
  id: string;
  name: string;
  description: string;
  catalogUrl: string;
  websiteUrl: string;
  color: string;
  initials: string;
}

interface ClientCatalog {
  id: string;
  name: string;
  description: string | null;
  vendorName: string | null;
  category: string;
  catalogUrl: string;
  websiteUrl: string | null;
  coverImageUrl: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

const CATEGORIES = ['Apparel', 'Promotional', 'Accessories', 'Signage', 'Other'];

const APPAREL_VENDORS: Vendor[] = [
  {
    id: 'sanmar',
    name: 'SanMar',
    description: 'Leading wholesale supplier of imprintable apparel, bags and caps. Extensive catalog including Port & Company, Sport-Tek, and more.',
    catalogUrl: 'https://www.sanmar.com/catalog',
    websiteUrl: 'https://www.sanmar.com',
    color: '#C41230',
    initials: 'SM',
  },
  {
    id: 'ssactivewear',
    name: 'S&S Activewear',
    description: 'National wholesale distributor of imprintable sportswear and activewear. Wide selection of top brands and the best prices in the industry.',
    catalogUrl: 'https://www.ssactivewear.com/category/Catalog',
    websiteUrl: 'https://www.ssactivewear.com',
    color: '#003087',
    initials: 'SS',
  },
  {
    id: 'mccreary',
    name: "McCreary's",
    description: 'Regional apparel and promotional products supplier. Reliable source for a wide variety of blank garments and promotional items.',
    catalogUrl: 'https://www.mccrearyspromoproducts.com',
    websiteUrl: 'https://www.mccrearyspromoproducts.com',
    color: '#1A6B3C',
    initials: 'MC',
  },
  {
    id: 'laapparel',
    name: 'LA Apparel',
    description: 'Premium basics made in the USA. Known for high quality, heavyweight garments with a fashion-forward fit. Great for retail and premium print projects.',
    catalogUrl: 'https://laapparel.com/pages/catalog',
    websiteUrl: 'https://laapparel.com',
    color: '#111111',
    initials: 'LA',
  },
  {
    id: 'independenttrading',
    name: 'Independent Trading Co.',
    description: 'Premium fleece and lifestyle apparel brand. Known for high-quality hoodies, crewnecks, and streetwear-inspired blanks at competitive wholesale prices.',
    catalogUrl: 'https://www.independenttrading.com/catalog',
    websiteUrl: 'https://www.independenttrading.com',
    color: '#1C3557',
    initials: 'ITC',
  },
  {
    id: 'shakawear',
    name: 'Shaka Wear',
    description: 'Heavyweight, high-quality basics built for decorating. Popular for oversized and streetwear aesthetics with exceptional value for high-volume orders.',
    catalogUrl: 'https://shakawear.com/pages/catalog',
    websiteUrl: 'https://shakawear.com',
    color: '#E05A00',
    initials: 'SW',
  },
  {
    id: 'augusta',
    name: 'Augusta Sportswear',
    description: 'Industry leader in performance and team sportswear. Extensive selection of sublimated and moisture-wicking apparel for teams and organizations.',
    catalogUrl: 'https://www.augustasportswear.com/catalog',
    websiteUrl: 'https://www.augustasportswear.com',
    color: '#004B8D',
    initials: 'AS',
  },
];

const PROMO_VENDORS: Vendor[] = [
  {
    id: 'katalystpromo',
    name: 'Katalyst Ko Promo',
    description: 'Our in-house promotional products line. Custom branded merchandise, giveaways, and corporate swag sourced and decorated by Katalyst Ko.',
    catalogUrl: 'https://katalystko.com',
    websiteUrl: 'https://katalystko.com',
    color: '#FF5A00',
    initials: 'KK',
  },
  {
    id: 'sinalite',
    name: 'Sinalite',
    description: 'Wholesale trade printer specializing in large-format printing, banners, signs, and display graphics. Fast turnaround for trade-only orders.',
    catalogUrl: 'https://www.sinalite.com/catalog',
    websiteUrl: 'https://www.sinalite.com',
    color: '#0066CC',
    initials: 'SL',
  },
  {
    id: 'bestofsigns',
    name: 'Best of Signs',
    description: 'Online print supplier for banners, signs, trade show displays, and vehicle graphics. Competitive pricing with a wide range of custom print products.',
    catalogUrl: 'https://www.bestofsigns.com',
    websiteUrl: 'https://www.bestofsigns.com',
    color: '#C8002D',
    initials: 'BS',
  },
  {
    id: 'signsdotcom',
    name: 'Signs.com',
    description: 'Custom sign printing made easy — banners, yard signs, window decals, and more. Instant online pricing with fast production and shipping.',
    catalogUrl: 'https://www.signs.com/signs',
    websiteUrl: 'https://www.signs.com',
    color: '#007A33',
    initials: 'SC',
  },
  {
    id: '4allpromos',
    name: '4 All Promos',
    description: 'Full-service promotional products distributor. Pens, drinkware, bags, tech accessories, and thousands of customizable items for any campaign.',
    catalogUrl: 'https://www.4allpromos.com',
    websiteUrl: 'https://www.4allpromos.com',
    color: '#6A1F8E',
    initials: '4A',
  },
  {
    id: 'jpplus',
    name: 'JP Plus',
    description: 'Promotional products and incentive merchandise. Specializing in custom-branded giveaways, awards, and recognition items for corporate clients.',
    catalogUrl: 'https://www.jpplus.com',
    websiteUrl: 'https://www.jpplus.com',
    color: '#8B4513',
    initials: 'JP',
  },
  {
    id: 'jdsindustries',
    name: 'JDS Industries',
    description: 'Wholesale supplier of awards, trophies, plaques, and recognition products. Extensive sublimation blanks and laser-engravable merchandise.',
    catalogUrl: 'https://www.jdsindustries.com/catalog',
    websiteUrl: 'https://www.jdsindustries.com',
    color: '#2D5016',
    initials: 'JDS',
  },
];

const CATEGORY_COLORS: Record<string, string> = {
  Apparel: '#4F46E5',
  Promotional: '#FF5A00',
  Accessories: '#0891B2',
  Signage: '#16A34A',
  Other: '#6B7280',
};

function getCategoryInitials(cat: ClientCatalog): string {
  return (cat.vendorName || cat.name).split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase();
}

function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] || '#6B7280';
}

const EMPTY_FORM = { name: '', description: '', vendorName: '', category: 'Apparel', catalogUrl: '', websiteUrl: '' };

function CatalogFormModal({
  visible,
  initial,
  onClose,
  onSave,
}: {
  visible: boolean;
  initial: Partial<typeof EMPTY_FORM> | null;
  onClose: () => void;
  onSave: (data: typeof EMPTY_FORM) => Promise<void>;
}) {
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showCatDrop, setShowCatDrop] = useState(false);

  useEffect(() => {
    if (visible) {
      setForm(initial ? { ...EMPTY_FORM, ...initial } : { ...EMPTY_FORM });
      setError('');
      setSaving(false);
      setShowCatDrop(false);
    }
  }, [visible, initial]);

  const upd = (k: keyof typeof EMPTY_FORM, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Catalog name is required.'); return; }
    if (!form.catalogUrl.trim()) { setError('Catalog URL is required.'); return; }
    setError('');
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to save catalog.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={fm.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={fm.sheet} onPress={() => setShowCatDrop(false)}>
          <View style={fm.header}>
            <Text style={fm.title}>{initial ? 'Edit Catalog' : 'Add Client Catalog'}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={20} color={TEXT_LIGHT} />
            </TouchableOpacity>
          </View>

          <ScrollView style={fm.body} keyboardShouldPersistTaps="handled">
            {!!error && (
              <View style={fm.errorBox}>
                <Text style={fm.errorText}>{error}</Text>
              </View>
            )}

            <Text style={fm.label}>Catalog Name <Text style={{ color: BRAND }}>*</Text></Text>
            <TextInput
              style={fm.input}
              value={form.name}
              onChangeText={v => upd('name', v)}
              placeholder="e.g. Spring 2026 Apparel"
              placeholderTextColor="#9CA3AF"
            />

            <Text style={fm.label}>Vendor / Brand Name</Text>
            <TextInput
              style={fm.input}
              value={form.vendorName}
              onChangeText={v => upd('vendorName', v)}
              placeholder="e.g. Next Level, Bella+Canvas"
              placeholderTextColor="#9CA3AF"
            />

            <Text style={fm.label}>Category</Text>
            <TouchableOpacity style={fm.select} onPress={() => setShowCatDrop(d => !d)}>
              <Text style={fm.selectText}>{form.category}</Text>
              <ChevronDown size={16} color={TEXT_LIGHT} />
            </TouchableOpacity>
            {showCatDrop && (
              <View style={fm.dropdown}>
                {CATEGORIES.map(cat => (
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

            <Text style={fm.label}>Description</Text>
            <TextInput
              style={[fm.input, { minHeight: 72, textAlignVertical: 'top' }]}
              value={form.description}
              onChangeText={v => upd('description', v)}
              placeholder="Brief description of the catalog"
              placeholderTextColor="#9CA3AF"
              multiline
            />

            <Text style={fm.label}>Catalog URL <Text style={{ color: BRAND }}>*</Text></Text>
            <TextInput
              style={fm.input}
              value={form.catalogUrl}
              onChangeText={v => upd('catalogUrl', v)}
              placeholder="https://..."
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              keyboardType="url"
            />

            <Text style={fm.label}>Vendor Website</Text>
            <TextInput
              style={fm.input}
              value={form.websiteUrl}
              onChangeText={v => upd('websiteUrl', v)}
              placeholder="https://..."
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              keyboardType="url"
            />

            <View style={{ height: 20 }} />
          </ScrollView>

          <View style={fm.footer}>
            <TouchableOpacity style={fm.cancelBtn} onPress={onClose} disabled={saving}>
              <Text style={fm.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[fm.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={fm.saveBtnText}>Save Catalog</Text>}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

export default function CatalogsScreen() {
  const [activeTab, setActiveTab] = useState<'wholesale' | 'client'>('wholesale');
  const [clientCatalogs, setClientCatalogs] = useState<ClientCatalog[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<ClientCatalog | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchClientCatalogs = useCallback(async (includeInactive = true) => {
    setLoading(true);
    try {
      const res = await fetch('/api/client-catalogs');
      const data = await res.json();
      if (Array.isArray(data)) {
        setClientCatalogs(includeInactive ? data : data.filter((c: ClientCatalog) => c.isActive));
      }
    } catch (e) {
      console.error('Failed to load client catalogs', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'client') fetchClientCatalogs();
  }, [activeTab, fetchClientCatalogs]);

  const openLink = (url: string) => Linking.openURL(url);

  const handleSave = async (form: typeof EMPTY_FORM) => {
    if (editing) {
      const res = await fetch(`/api/client-catalogs/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to update');
    } else {
      const res = await fetch('/api/client-catalogs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to create');
    }
    await fetchClientCatalogs();
  };

  const handleDelete = (cat: ClientCatalog) => {
    if (Platform.OS === 'web') {
      if (!window.confirm(`Delete "${cat.name}"? This cannot be undone.`)) return;
      doDelete(cat.id);
    } else {
      Alert.alert('Delete Catalog', `Delete "${cat.name}"? This cannot be undone.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => doDelete(cat.id) },
      ]);
    }
  };

  const doDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await fetch(`/api/client-catalogs/${id}`, { method: 'DELETE' });
      setClientCatalogs(prev => prev.filter(c => c.id !== id));
    } catch (e) {
      console.error('Delete failed', e);
    } finally {
      setDeletingId(null);
    }
  };

  const renderVendorCard = (vendor: Vendor) => (
    <View key={vendor.id} style={styles.vendorCard}>
      <View style={styles.vendorCardTop}>
        <View style={[styles.vendorAvatar, { backgroundColor: vendor.color }]}>
          <Text style={styles.vendorInitials}>{vendor.initials}</Text>
        </View>
        <View style={styles.vendorMeta}>
          <Text style={styles.vendorName}>{vendor.name}</Text>
        </View>
      </View>
      <Text style={styles.vendorDescription}>{vendor.description}</Text>
      <View style={styles.vendorActions}>
        <TouchableOpacity style={styles.catalogBtn} onPress={() => openLink(vendor.catalogUrl)}>
          <BookOpen size={15} color="#fff" />
          <Text style={styles.catalogBtnText}>View Catalog</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.websiteBtn} onPress={() => openLink(vendor.websiteUrl)}>
          <ExternalLink size={15} color={BRAND} />
          <Text style={styles.websiteBtnText}>Website</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderClientCatalogCard = (cat: ClientCatalog) => {
    const color = getCategoryColor(cat.category);
    const initials = getCategoryInitials(cat);
    return (
      <View key={cat.id} style={styles.clientCard}>
        <View style={styles.clientCardTop}>
          <View style={[styles.vendorAvatar, { backgroundColor: color }]}>
            <Text style={styles.vendorInitials}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.vendorName}>{cat.name}</Text>
            {cat.vendorName ? <Text style={styles.clientCardVendor}>{cat.vendorName}</Text> : null}
          </View>
          <View style={[styles.categoryBadge, { backgroundColor: color + '18' }]}>
            <Text style={[styles.categoryBadgeText, { color }]}>{cat.category}</Text>
          </View>
        </View>
        {cat.description ? <Text style={styles.vendorDescription}>{cat.description}</Text> : null}
        <View style={styles.vendorActions}>
          <TouchableOpacity style={styles.catalogBtn} onPress={() => openLink(cat.catalogUrl)}>
            <BookOpen size={15} color="#fff" />
            <Text style={styles.catalogBtnText}>Open Catalog</Text>
          </TouchableOpacity>
          {cat.websiteUrl ? (
            <TouchableOpacity style={styles.websiteBtn} onPress={() => openLink(cat.websiteUrl!)}>
              <Globe size={15} color={BRAND} />
              <Text style={styles.websiteBtnText}>Website</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.editBtn} onPress={() => { setEditing(cat); setModalVisible(true); }}>
            <Pencil size={14} color={TEXT_LIGHT} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.deleteBtn, deletingId === cat.id && { opacity: 0.4 }]}
            onPress={() => handleDelete(cat)}
            disabled={deletingId === cat.id}
          >
            {deletingId === cat.id
              ? <ActivityIndicator size="small" color="#DC2626" />
              : <Trash2 size={14} color="#DC2626" />}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.pageHeader}>
          <View>
            <Text style={styles.pageTitle}>Catalogs</Text>
            <Text style={styles.pageSubtitle}>Manage wholesale vendor references and client-facing catalogs</Text>
          </View>
        </View>

        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'wholesale' && styles.tabActive]}
            onPress={() => setActiveTab('wholesale')}
          >
            <BookOpen size={15} color={activeTab === 'wholesale' ? BRAND : TEXT_LIGHT} />
            <Text style={[styles.tabText, activeTab === 'wholesale' && styles.tabTextActive]}>Wholesale Vendors</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'client' && styles.tabActive]}
            onPress={() => setActiveTab('client')}
          >
            <Tag size={15} color={activeTab === 'client' ? BRAND : TEXT_LIGHT} />
            <Text style={[styles.tabText, activeTab === 'client' && styles.tabTextActive]}>Client-Facing Catalogs</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'wholesale' && (
          <>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconBg, { backgroundColor: '#EEF2FF' }]}>
                <BookOpen size={16} color="#4F46E5" />
              </View>
              <View>
                <Text style={styles.sectionTitle}>Apparel Vendors</Text>
                <Text style={styles.sectionSubtitle}>{APPAREL_VENDORS.length} suppliers</Text>
              </View>
            </View>
            <View style={styles.vendorGrid}>{APPAREL_VENDORS.map(renderVendorCard)}</View>
            <View style={styles.sectionDivider} />
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconBg, { backgroundColor: '#FFF7ED' }]}>
                <Tag size={16} color={BRAND} />
              </View>
              <View>
                <Text style={styles.sectionTitle}>Promotional Vendors</Text>
                <Text style={styles.sectionSubtitle}>{PROMO_VENDORS.length} suppliers</Text>
              </View>
            </View>
            <View style={styles.vendorGrid}>{PROMO_VENDORS.map(renderVendorCard)}</View>
            <View style={styles.addVendorNote}>
              <BookOpen size={20} color={TEXT_LIGHT} />
              <Text style={styles.addVendorText}>
                These are your internal wholesale references. Client-facing catalogs are managed separately under the Client-Facing Catalogs tab.
              </Text>
            </View>
          </>
        )}

        {activeTab === 'client' && (
          <>
            <View style={styles.clientHeader}>
              <View>
                <Text style={styles.sectionTitle}>Client-Facing Catalogs</Text>
                <Text style={styles.pageSubtitle}>These catalogs appear in every client hub</Text>
              </View>
              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => { setEditing(null); setModalVisible(true); }}
              >
                <Plus size={16} color="#fff" />
                <Text style={styles.addBtnText}>Add Catalog</Text>
              </TouchableOpacity>
            </View>

            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color={BRAND} />
                <Text style={styles.loadingText}>Loading catalogs…</Text>
              </View>
            ) : clientCatalogs.length === 0 ? (
              <View style={styles.emptyBox}>
                <BookOpen size={40} color="#D1D5DB" />
                <Text style={styles.emptyTitle}>No client catalogs yet</Text>
                <Text style={styles.emptySub}>
                  Add your first retail catalog — it will appear in all client hubs automatically.
                </Text>
                <TouchableOpacity
                  style={[styles.addBtn, { marginTop: 16 }]}
                  onPress={() => { setEditing(null); setModalVisible(true); }}
                >
                  <Plus size={16} color="#fff" />
                  <Text style={styles.addBtnText}>Add First Catalog</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.vendorGrid}>{clientCatalogs.map(renderClientCatalogCard)}</View>
            )}
          </>
        )}
      </ScrollView>

      <CatalogFormModal
        visible={modalVisible}
        initial={editing ? {
          name: editing.name,
          description: editing.description || '',
          vendorName: editing.vendorName || '',
          category: editing.category,
          catalogUrl: editing.catalogUrl,
          websiteUrl: editing.websiteUrl || '',
        } : null}
        onClose={() => setModalVisible(false)}
        onSave={handleSave}
      />
    </>
  );
}

const fm = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  sheet: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
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
  title: { fontSize: 16, fontWeight: '700', color: TEXT },
  body: { paddingHorizontal: 20, paddingTop: 16, maxHeight: 480 },
  label: { fontSize: 12, fontWeight: '600', color: TEXT_LIGHT, marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: TEXT,
    backgroundColor: '#FAFAFA',
  },
  select: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAFAFA',
  },
  selectText: { fontSize: 14, color: TEXT },
  dropdown: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    marginTop: 4,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  dropOption: { paddingHorizontal: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  dropOptionActive: { backgroundColor: '#FFF7ED' },
  dropOptionText: { fontSize: 14, color: TEXT },
  dropOptionTextActive: { color: BRAND, fontWeight: '600' },
  footer: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: TEXT_LIGHT },
  saveBtn: {
    flex: 1,
    backgroundColor: BRAND,
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center',
  },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 10,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: { fontSize: 13, color: '#B91C1C' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  content: { paddingHorizontal: 24, paddingVertical: 24, paddingBottom: 40 },
  pageHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'flex-start' as const,
    marginBottom: 20,
  },
  pageTitle: { fontSize: 26, fontWeight: '800' as const, color: TEXT },
  pageSubtitle: { fontSize: 14, color: TEXT_LIGHT, marginTop: 4 },

  tabRow: {
    flexDirection: 'row' as const,
    gap: 4,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    padding: 4,
    backgroundColor: SURFACE,
    alignSelf: 'flex-start' as const,
  },
  tab: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 7,
  },
  tabActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  tabText: { fontSize: 13, fontWeight: '600' as const, color: TEXT_LIGHT },
  tabTextActive: { color: BRAND },

  sectionHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    marginBottom: 16,
  },
  sectionIconBg: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center' as const, alignItems: 'center' as const },
  sectionTitle: { fontSize: 17, fontWeight: '700' as const, color: TEXT },
  sectionSubtitle: { fontSize: 12, color: TEXT_LIGHT, marginTop: 1 },
  sectionDivider: { height: 1, backgroundColor: BORDER, marginVertical: 28 },

  vendorGrid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 16 },
  vendorCard: {
    flex: 1,
    minWidth: 280,
    backgroundColor: SURFACE,
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 14,
  },
  vendorCardTop: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 14 },
  vendorAvatar: { width: 52, height: 52, borderRadius: 12, justifyContent: 'center' as const, alignItems: 'center' as const, flexShrink: 0 },
  vendorInitials: { fontSize: 15, fontWeight: '800' as const, color: '#fff', letterSpacing: 0.5 },
  vendorMeta: { flex: 1 },
  vendorName: { fontSize: 17, fontWeight: '700' as const, color: TEXT },
  vendorDescription: { fontSize: 13, color: TEXT_LIGHT, lineHeight: 19 },
  vendorActions: { flexDirection: 'row' as const, gap: 8, alignItems: 'center' as const },
  catalogBtn: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    backgroundColor: BRAND,
    paddingVertical: 10,
    borderRadius: 8,
  },
  catalogBtnText: { fontSize: 13, fontWeight: '600' as const, color: '#fff' },
  websiteBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BRAND,
  },
  websiteBtnText: { fontSize: 13, fontWeight: '600' as const, color: BRAND },
  addVendorNote: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 10,
    backgroundColor: SURFACE,
    borderRadius: 10,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: BORDER,
  },
  addVendorText: { flex: 1, fontSize: 13, color: TEXT_LIGHT, lineHeight: 18 },

  clientHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 20,
  },
  addBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    backgroundColor: BRAND,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addBtnText: { fontSize: 13, fontWeight: '700' as const, color: '#fff' },

  clientCard: {
    flex: 1,
    minWidth: 280,
    backgroundColor: SURFACE,
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 12,
  },
  clientCardTop: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12 },
  clientCardVendor: { fontSize: 12, color: TEXT_LIGHT, marginTop: 2 },
  categoryBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  categoryBadgeText: { fontSize: 11, fontWeight: '700' as const },
  editBtn: {
    width: 34,
    height: 34,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: '#fff',
  },
  deleteBtn: {
    width: 34,
    height: 34,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: '#FEF2F2',
  },

  loadingBox: { alignItems: 'center' as const, paddingVertical: 48, gap: 12 },
  loadingText: { fontSize: 14, color: TEXT_LIGHT },
  emptyBox: {
    alignItems: 'center' as const,
    paddingVertical: 60,
    gap: 8,
    backgroundColor: SURFACE,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    borderStyle: 'dashed' as const,
    paddingHorizontal: 32,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700' as const, color: TEXT, marginTop: 8 },
  emptySub: { fontSize: 14, color: TEXT_LIGHT, textAlign: 'center' as const, lineHeight: 20 },
});
