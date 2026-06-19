import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  useWindowDimensions,
  Switch,
} from 'react-native';
import {
  BookOpen, Plus, Pencil, Trash2, X, Globe,
  ChevronDown, MoreVertical, Eye, EyeOff, Star,
  Download, Upload, FileText, CheckSquare, ChevronUp,
} from 'lucide-react-native';
import Colors from '@/constants/colors';

const BRAND = Colors.light.tint;
const TEXT = Colors.light.text;
const TEXT_LIGHT = Colors.light.textSecondary;
const BORDER = Colors.light.border;
const SURFACE = Colors.light.surface;
const BG = Colors.light.background;

const CATEGORIES = ['Apparel', 'Promotional', 'Accessories', 'Signage', 'Other'];

const CATEGORY_COLORS: Record<string, string> = {
  Apparel: '#4F46E5',
  Promotional: '#FF5A00',
  Accessories: '#0891B2',
  Signage: '#16A34A',
  Other: '#6B7280',
};

interface Vendor {
  id: string;
  name: string;
  description: string | null;
  vendorName: string | null;
  category: string;
  catalogUrl: string | null;
  websiteUrl: string | null;
  coverImageUrl: string | null;
  logoColor: string | null;
  logoInitials: string | null;
  isActive: boolean;
  showInClientHub: boolean;
  isFeatured: boolean;
  sortOrder: number;
  createdAt: string;
}

const EMPTY_FORM = {
  name: '',
  description: '',
  vendorName: '',
  category: 'Apparel',
  catalogUrl: '',
  websiteUrl: '',
  logoColor: '',
  logoInitials: '',
  showInClientHub: false,
  isFeatured: false,
};

function getCatColor(cat: string): string {
  return CATEGORY_COLORS[cat] || '#6B7280';
}

function getInitials(v: Vendor): string {
  if (v.logoInitials) return v.logoInitials;
  return (v.vendorName || v.name).split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase();
}

function getLogoColor(v: Vendor): string {
  if (v.logoColor) return v.logoColor;
  return getCatColor(v.category);
}

// ─── Form Modal ──────────────────────────────────────────────────────────────

function VendorFormModal({
  visible,
  initial,
  onClose,
  onSave,
}: {
  visible: boolean;
  initial: (Partial<typeof EMPTY_FORM> & { id?: string }) | null;
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

  const upd = <K extends keyof typeof EMPTY_FORM>(k: K, v: typeof EMPTY_FORM[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Vendor name is required.'); return; }
    setError('');
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to save vendor.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={fm.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={fm.sheet} onPress={() => setShowCatDrop(false)}>
          <View style={fm.header}>
            <Text style={fm.title}>{initial?.id ? 'Edit Vendor' : 'Add Vendor'}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={20} color={TEXT_LIGHT} />
            </TouchableOpacity>
          </View>

          <ScrollView style={fm.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {!!error && (
              <View style={fm.errorBox}>
                <Text style={fm.errorText}>{error}</Text>
              </View>
            )}

            <Text style={fm.label}>Vendor Name <Text style={{ color: BRAND }}>*</Text></Text>
            <TextInput
              style={fm.input}
              value={form.name}
              onChangeText={v => upd('name', v)}
              placeholder="e.g. SanMar"
              placeholderTextColor="#9CA3AF"
            />

            <Text style={fm.label}>Display Name / Brand</Text>
            <TextInput
              style={fm.input}
              value={form.vendorName}
              onChangeText={v => upd('vendorName', v)}
              placeholder="e.g. Next Level, Bella+Canvas"
              placeholderTextColor="#9CA3AF"
            />

            <Text style={fm.label}>Category</Text>
            <TouchableOpacity style={fm.select} onPress={() => setShowCatDrop(d => !d)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: getCatColor(form.category) }} />
                <Text style={fm.selectText}>{form.category}</Text>
              </View>
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
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: getCatColor(cat) }} />
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
              placeholder="Brief description of this vendor"
              placeholderTextColor="#9CA3AF"
              multiline
            />

            <Text style={fm.label}>Catalog URL</Text>
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

            <Text style={fm.label}>Logo Color (hex)</Text>
            <TextInput
              style={fm.input}
              value={form.logoColor}
              onChangeText={v => upd('logoColor', v)}
              placeholder="e.g. #C41230"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
            />

            <Text style={fm.label}>Logo Initials</Text>
            <TextInput
              style={fm.input}
              value={form.logoInitials}
              onChangeText={v => upd('logoInitials', v.toUpperCase().slice(0, 3))}
              placeholder="e.g. SM"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="characters"
              maxLength={3}
            />

            <View style={fm.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={fm.toggleLabel}>Show in Client Hub</Text>
                <Text style={fm.toggleSub}>Clients can view this vendor's catalog</Text>
              </View>
              <Switch
                value={form.showInClientHub}
                onValueChange={v => upd('showInClientHub', v)}
                trackColor={{ false: '#E5E7EB', true: BRAND + '55' }}
                thumbColor={form.showInClientHub ? BRAND : '#9CA3AF'}
              />
            </View>

            <View style={[fm.toggleRow, { borderBottomWidth: 0, marginBottom: 8 }]}>
              <View style={{ flex: 1 }}>
                <Text style={fm.toggleLabel}>Featured</Text>
                <Text style={fm.toggleSub}>Highlight this vendor at the top</Text>
              </View>
              <Switch
                value={form.isFeatured}
                onValueChange={v => upd('isFeatured', v)}
                trackColor={{ false: '#E5E7EB', true: '#F59E0B55' }}
                thumbColor={form.isFeatured ? '#F59E0B' : '#9CA3AF'}
              />
            </View>

            <View style={{ height: 12 }} />
          </ScrollView>

          <View style={fm.footer}>
            <TouchableOpacity style={fm.cancelBtn} onPress={onClose} disabled={saving}>
              <Text style={fm.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[fm.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
              {saving
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={fm.saveBtnText}>Save Vendor</Text>}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function CatalogsScreen() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { width: screenWidth } = useWindowDimensions();
  const isMobile = screenWidth < 768;
  const isTablet = screenWidth >= 768 && screenWidth < 1100;

  // Card width: 2-col on mobile, 3-col on desktop
  const HORIZ_PAD = 24;
  const CARD_GAP = 12;
  const cols = isMobile ? 2 : isTablet ? 2 : 3;
  const cardWidth = Math.floor((screenWidth - HORIZ_PAD * 2 - CARD_GAP * (cols - 1)) / cols);

  const fetchVendors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/client-catalogs');
      const data = await res.json();
      if (Array.isArray(data)) setVendors(data);
    } catch (e) {
      console.error('Failed to load vendors', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchVendors(); }, [fetchVendors]);

  // Close menus when tapping elsewhere
  const closeMenus = () => { setOpenMenuId(null); setActionsOpen(false); };

  const filtered = vendors.filter(v => {
    const q = search.toLowerCase();
    const matchesSearch = !q || v.name.toLowerCase().includes(q) || (v.vendorName || '').toLowerCase().includes(q) || v.category.toLowerCase().includes(q);
    const matchesCat = !activeCategory || v.category === activeCategory;
    return matchesSearch && matchesCat;
  });

  const hubVisible = vendors.filter(v => v.showInClientHub).length;
  const featured = vendors.filter(v => v.isFeatured).length;

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
    await fetchVendors();
  };

  const handleDelete = (v: Vendor) => {
    closeMenus();
    if (Platform.OS === 'web') {
      if (!window.confirm(`Delete "${v.name}"? This cannot be undone.`)) return;
      doDelete(v.id);
    } else {
      Alert.alert('Delete Vendor', `Delete "${v.name}"? This cannot be undone.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => doDelete(v.id) },
      ]);
    }
  };

  const doDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await fetch(`/api/client-catalogs/${id}`, { method: 'DELETE' });
      setVendors(prev => prev.filter(v => v.id !== id));
    } catch (e) {
      console.error('Delete failed', e);
    } finally {
      setDeletingId(null);
    }
  };

  const toggleField = async (vendor: Vendor, field: 'showInClientHub' | 'isFeatured') => {
    closeMenus();
    setTogglingId(vendor.id + field);
    try {
      const res = await fetch(`/api/client-catalogs/${vendor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: !vendor[field] }),
      });
      if (res.ok) {
        const updated = await res.json();
        setVendors(prev => prev.map(v => v.id === vendor.id ? { ...v, ...updated } : v));
      }
    } catch (e) {
      console.error('Toggle failed', e);
    } finally {
      setTogglingId(null);
    }
  };

  // ── CSV Export ──
  const handleExport = () => {
    closeMenus();
    const headers = ['name', 'vendorName', 'category', 'catalogUrl', 'websiteUrl', 'description', 'logoColor', 'logoInitials', 'showInClientHub', 'isFeatured'];
    const rows = vendors.map(v =>
      headers.map(h => {
        const val = (v as any)[h];
        if (val === null || val === undefined) return '';
        if (typeof val === 'boolean') return val ? 'true' : 'false';
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vendors.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── CSV Template Download ──
  const handleDownloadTemplate = () => {
    closeMenus();
    const headers = 'name,vendorName,category,catalogUrl,websiteUrl,description,logoColor,logoInitials,showInClientHub,isFeatured';
    const example = '"SanMar","SanMar","Apparel","https://www.sanmar.com/catalog","https://www.sanmar.com","Leading wholesale supplier","#C41230","SM","false","false"';
    const csv = [headers, example].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vendor-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── CSV Import ──
  const handleImportClick = () => {
    closeMenus();
    if (Platform.OS !== 'web') return;
    if (!fileInputRef.current) {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.csv';
      input.onchange = async (e: any) => {
        const file = e.target.files?.[0];
        if (!file) return;
        await processImportFile(file);
      };
      fileInputRef.current = input as any;
    }
    (fileInputRef.current as any).click();
  };

  const processImportFile = async (file: File) => {
    setImporting(true);
    try {
      const text = await file.text();
      const lines = text.trim().split('\n');
      if (lines.length < 2) { alert('CSV file is empty or has no data rows.'); return; }
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      let count = 0;
      for (let i = 1; i < lines.length; i++) {
        const vals = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
        const row: Record<string, any> = {};
        headers.forEach((h, idx) => { row[h] = vals[idx] || ''; });
        if (!row.name) continue;
        const payload = {
          name: row.name,
          vendorName: row.vendorName || row.name,
          category: CATEGORIES.includes(row.category) ? row.category : 'Apparel',
          catalogUrl: row.catalogUrl || null,
          websiteUrl: row.websiteUrl || null,
          description: row.description || null,
          logoColor: row.logoColor || null,
          logoInitials: row.logoInitials || null,
          showInClientHub: row.showInClientHub === 'true',
          isFeatured: row.isFeatured === 'true',
        };
        await fetch('/api/client-catalogs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        count++;
      }
      await fetchVendors();
      if (Platform.OS === 'web') alert(`Imported ${count} vendor(s) successfully.`);
    } catch (e) {
      console.error('Import failed', e);
      if (Platform.OS === 'web') alert('Import failed. Please check the file format.');
    } finally {
      setImporting(false);
      fileInputRef.current = null;
    }
  };

  const openEdit = (v: Vendor) => {
    closeMenus();
    setEditing(v);
    setModalVisible(true);
  };

  // ── Card ──
  const renderCard = (vendor: Vendor) => {
    const color = getLogoColor(vendor);
    const initials = getInitials(vendor);
    const isMenuOpen = openMenuId === vendor.id;
    const isDeleting = deletingId === vendor.id;

    return (
      <View key={vendor.id} style={[s.card, isMenuOpen && { zIndex: 10 }]}>
        {/* Header row */}
        <View style={s.cardTop}>
          <View style={[s.avatar, { backgroundColor: color }]}>
            <Text style={s.avatarText}>{initials}</Text>
          </View>
          <View style={s.cardMeta}>
            <Text style={s.vendorName} numberOfLines={1}>{vendor.name}</Text>
            <View style={s.metaBadgeRow}>
              <View style={[s.catBadge, { backgroundColor: getCatColor(vendor.category) + '18' }]}>
                <Text style={[s.catBadgeText, { color: getCatColor(vendor.category) }]}>{vendor.category}</Text>
              </View>
              {vendor.showInClientHub && (
                <View style={s.hubBadge}>
                  <Eye size={10} color="#fff" />
                  <Text style={s.hubBadgeText}>Client Hub</Text>
                </View>
              )}
            </View>
          </View>
          {/* ⋮ menu */}
          <View style={{ position: 'relative', zIndex: 1000 }}>
            <TouchableOpacity
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={() => setOpenMenuId(isMenuOpen ? null : vendor.id)}
              style={s.ellipsisBtn}
            >
              <MoreVertical size={17} color={TEXT_LIGHT} />
            </TouchableOpacity>
            {isMenuOpen && (
              <View style={s.cardMenu}>
                <TouchableOpacity style={s.menuItem} onPress={() => openEdit(vendor)}>
                  <Pencil size={13} color={TEXT} />
                  <Text style={s.menuItemText}>Edit Vendor</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.menuItem} onPress={() => toggleField(vendor, 'showInClientHub')}>
                  {vendor.showInClientHub
                    ? <EyeOff size={13} color={TEXT} />
                    : <Eye size={13} color={TEXT} />}
                  <Text style={s.menuItemText}>
                    {vendor.showInClientHub ? 'Hide from Client Hub' : 'Show in Client Hub'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.menuItem} onPress={() => toggleField(vendor, 'isFeatured')}>
                  <Star size={13} color={vendor.isFeatured ? '#F59E0B' : TEXT} fill={vendor.isFeatured ? '#F59E0B' : 'none'} />
                  <Text style={[s.menuItemText, vendor.isFeatured && { color: '#F59E0B' }]}>
                    {vendor.isFeatured ? 'Remove Featured' : 'Mark as Featured'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.menuItem, { borderBottomWidth: 0 }]}
                  onPress={() => handleDelete(vendor)}
                  disabled={isDeleting}
                >
                  {isDeleting
                    ? <ActivityIndicator size="small" color="#DC2626" />
                    : <Trash2 size={13} color="#DC2626" />}
                  <Text style={[s.menuItemText, { color: '#DC2626' }]}>Delete Vendor</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* Status badges */}
        {vendor.isFeatured && (
          <View style={s.statusRow}>
            <View style={s.featuredBadge}>
              <Star size={10} color="#fff" fill="#fff" />
              <Text style={s.featuredBadgeText}>Featured</Text>
            </View>
          </View>
        )}

        {/* Description */}
        {vendor.description ? (
          <Text style={s.description} numberOfLines={2}>{vendor.description}</Text>
        ) : (
          <Text style={s.noDesc}>No description</Text>
        )}

        {/* Action buttons */}
        <View style={s.cardActions}>
          {vendor.catalogUrl ? (
            <TouchableOpacity
              style={s.catalogBtn}
              onPress={() => Linking.openURL(vendor.catalogUrl!)}
            >
              <BookOpen size={13} color="#fff" />
              <Text style={s.catalogBtnText} numberOfLines={1}>
                {isMobile ? 'Catalog' : 'Open Catalog'}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={[s.catalogBtn, { opacity: 0.35 }]}>
              <BookOpen size={13} color="#fff" />
              <Text style={s.catalogBtnText}>No URL</Text>
            </View>
          )}
          {vendor.websiteUrl ? (
            <TouchableOpacity
              style={s.websiteBtn}
              onPress={() => Linking.openURL(vendor.websiteUrl!)}
            >
              <Globe size={13} color={BRAND} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <TouchableOpacity activeOpacity={1} style={{ flex: 1 }} onPress={closeMenus}>
      <ScrollView
        style={s.container}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={closeMenus}
      >
        {/* Page Header */}
        <View style={s.pageHeader}>
          <View style={{ flex: 1 }}>
            <Text style={s.pageTitle}>Vendor Management</Text>
          </View>
          <View style={s.headerActions}>
            {/* Actions dropdown */}
            <View style={{ position: 'relative' }}>
              <TouchableOpacity
                style={s.actionsBtn}
                onPress={() => { setOpenMenuId(null); setActionsOpen(v => !v); }}
              >
                <Text style={s.actionsBtnText}>Actions</Text>
                {actionsOpen
                  ? <ChevronUp size={15} color={TEXT_LIGHT} />
                  : <ChevronDown size={15} color={TEXT_LIGHT} />}
              </TouchableOpacity>
              {actionsOpen && (
                <View style={s.actionsMenu}>
                  <TouchableOpacity style={s.actionsMenuItem} onPress={handleImportClick} disabled={importing}>
                    {importing
                      ? <ActivityIndicator size="small" color={BRAND} />
                      : <Upload size={14} color={TEXT} />}
                    <Text style={s.actionsMenuItemText}>Import from CSV</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.actionsMenuItem} onPress={handleExport}>
                    <Download size={14} color={TEXT} />
                    <Text style={s.actionsMenuItemText}>Export to CSV</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.actionsMenuItem, { borderBottomWidth: 0 }]} onPress={handleDownloadTemplate}>
                    <FileText size={14} color={TEXT} />
                    <Text style={s.actionsMenuItemText}>Download Template</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Add Vendor */}
            <TouchableOpacity
              style={s.addBtn}
              onPress={() => { closeMenus(); setEditing(null); setModalVisible(true); }}
            >
              <Plus size={15} color="#fff" />
              <Text style={s.addBtnText}>{isMobile ? 'Add' : 'Add Vendor'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Bar */}
        <View style={s.statsBar}>
          <View style={s.statItem}>
            <Text style={s.statValue}>{vendors.length}</Text>
            <Text style={s.statLabel}>Total Vendors</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Text style={[s.statValue, { color: BRAND }]}>{hubVisible}</Text>
            <Text style={s.statLabel}>In Client Hub</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Text style={[s.statValue, { color: '#F59E0B' }]}>{featured}</Text>
            <Text style={s.statLabel}>Featured</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Text style={s.statValue}>{CATEGORIES.filter(c => vendors.some(v => v.category === c)).length}</Text>
            <Text style={s.statLabel}>Categories</Text>
          </View>
        </View>

        {/* Search + Category Filters */}
        <View style={s.filterRow}>
          <View style={s.searchBox}>
            <TextInput
              style={s.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search vendors…"
              placeholderTextColor="#9CA3AF"
            />
            {search ? (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={15} color={TEXT_LIGHT} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.catFilters}
          style={{ marginBottom: 20 }}
        >
          <TouchableOpacity
            style={[s.catChip, !activeCategory && s.catChipActive]}
            onPress={() => setActiveCategory(null)}
          >
            <Text style={[s.catChipText, !activeCategory && s.catChipTextActive]}>All</Text>
          </TouchableOpacity>
          {CATEGORIES.map(cat => {
            const count = vendors.filter(v => v.category === cat).length;
            if (count === 0) return null;
            return (
              <TouchableOpacity
                key={cat}
                style={[s.catChip, activeCategory === cat && s.catChipActive, activeCategory === cat && { borderColor: getCatColor(cat) }]}
                onPress={() => setActiveCategory(activeCategory === cat ? null : cat)}
              >
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: getCatColor(cat) }} />
                <Text style={[s.catChipText, activeCategory === cat && { color: getCatColor(cat), fontWeight: '700' }]}>
                  {cat}
                </Text>
                <View style={s.catCount}>
                  <Text style={s.catCountText}>{count}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Vendor Grid */}
        {loading ? (
          <View style={s.loadingBox}>
            <ActivityIndicator color={BRAND} />
            <Text style={s.loadingText}>Loading vendors…</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={s.emptyBox}>
            <BookOpen size={40} color="#D1D5DB" />
            <Text style={s.emptyTitle}>{vendors.length === 0 ? 'No vendors yet' : 'No results found'}</Text>
            <Text style={s.emptySub}>
              {vendors.length === 0
                ? 'Add your first vendor to get started.'
                : 'Try a different search or category filter.'}
            </Text>
            {vendors.length === 0 && (
              <TouchableOpacity
                style={[s.addBtn, { marginTop: 16 }]}
                onPress={() => { setEditing(null); setModalVisible(true); }}
              >
                <Plus size={15} color="#fff" />
                <Text style={s.addBtnText}>Add First Vendor</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={s.grid}>
            {Array.from({ length: Math.ceil(filtered.length / cols) }, (_, rowIdx) => {
              const rowItems = filtered.slice(rowIdx * cols, rowIdx * cols + cols);
              return (
                <View key={rowIdx} style={s.gridRow}>
                  {rowItems.map(v => renderCard(v))}
                  {rowItems.length < cols && Array.from({ length: cols - rowItems.length }).map((_, i) => (
                    <View key={`ph-${i}`} style={s.cardPlaceholder} />
                  ))}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <VendorFormModal
        visible={modalVisible}
        initial={editing ? {
          id: editing.id,
          name: editing.name,
          description: editing.description || '',
          vendorName: editing.vendorName || '',
          category: editing.category,
          catalogUrl: editing.catalogUrl || '',
          websiteUrl: editing.websiteUrl || '',
          logoColor: editing.logoColor || '',
          logoInitials: editing.logoInitials || '',
          showInClientHub: editing.showInClientHub,
          isFeatured: editing.isFeatured,
        } : null}
        onClose={() => setModalVisible(false)}
        onSave={handleSave}
      />
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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
  body: { paddingHorizontal: 20, paddingTop: 16, maxHeight: 500 },
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
  dropOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dropOptionActive: { backgroundColor: '#FFF7ED' },
  dropOptionText: { fontSize: 14, color: TEXT },
  dropOptionTextActive: { color: BRAND, fontWeight: '600' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    marginTop: 10,
    gap: 12,
  },
  toggleLabel: { fontSize: 14, fontWeight: '600', color: TEXT },
  toggleSub: { fontSize: 12, color: TEXT_LIGHT, marginTop: 2 },
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

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: SURFACE },
  content: { paddingHorizontal: 24, paddingVertical: 24, paddingBottom: 48 },

  pageHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 12,
  },
  pageTitle: { fontSize: 26, fontWeight: '800', color: TEXT },
  pageSubtitle: { fontSize: 14, color: TEXT_LIGHT, marginTop: 4 },

  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },

  actionsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
  },
  actionsBtnText: { fontSize: 13, fontWeight: '600', color: TEXT },
  actionsMenu: {
    position: 'absolute',
    top: 40,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 1000,
    minWidth: 185,
  },
  actionsMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  actionsMenuItemText: { fontSize: 13, color: TEXT, fontWeight: '500' },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: BRAND,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
  },
  addBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  statsBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    backgroundColor: '#EBEBEB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  statItem: { flex: 1, minWidth: 120, borderRadius: 10, paddingVertical: 14, paddingHorizontal: 12, backgroundColor: SURFACE, alignItems: 'center' },
  statValue: { fontSize: 17, fontWeight: '800', color: TEXT },
  statLabel: { fontSize: 10, color: TEXT_LIGHT, marginTop: 2 },
  statDivider: { display: 'none' as any },

  filterRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: SURFACE,
  },
  searchInput: { flex: 1, fontSize: 14, color: TEXT, minHeight: 0 },

  catFilters: { flexDirection: 'row', gap: 8, paddingBottom: 2 },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
  },
  catChipActive: { backgroundColor: '#FFF7ED', borderColor: BRAND },
  catChipText: { fontSize: 13, fontWeight: '500', color: TEXT_LIGHT },
  catChipTextActive: { color: BRAND, fontWeight: '700' },
  catCount: {
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  catCountText: { fontSize: 11, color: TEXT_LIGHT, fontWeight: '600' },

  grid: { gap: 12 },
  gridRow: { flexDirection: 'row', gap: 12 },
  cardPlaceholder: { flex: 1 },

  card: {
    flex: 1,
    backgroundColor: SURFACE,
    borderRadius: 12,
    padding: 11,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 8,
    overflow: 'visible',
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  avatar: { width: 36, height: 36, borderRadius: 9, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  avatarText: { fontSize: 12, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
  cardMeta: { flex: 1, minWidth: 0 },
  vendorName: { fontSize: 13, fontWeight: '700', color: TEXT },
  metaBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap', marginTop: 2 },
  catBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20, alignSelf: 'flex-start' },
  catBadgeText: { fontSize: 10, fontWeight: '700' },

  statusRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', minHeight: 0 },
  hubBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: BRAND,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 20,
  },
  hubBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  featuredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 20,
  },
  featuredBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },

  description: { fontSize: 12, color: TEXT_LIGHT, lineHeight: 17 },
  noDesc: { fontSize: 12, color: '#D1D5DB', fontStyle: 'italic' },

  cardActions: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  catalogBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: BRAND,
    paddingVertical: 7,
    borderRadius: 7,
    minHeight: 32,
  },
  catalogBtnText: { fontSize: 12, fontWeight: '600', color: '#fff' },
  websiteBtn: {
    width: 32,
    height: 32,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: BORDER,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },

  ellipsisBtn: { padding: 4, borderRadius: 6 },
  cardMenu: {
    position: 'absolute',
    top: 28,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 1000,
    minWidth: 185,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  menuItemText: { fontSize: 13, color: TEXT, fontWeight: '500' },

  loadingBox: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  loadingText: { fontSize: 14, color: TEXT_LIGHT },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 8,
    backgroundColor: SURFACE,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    borderStyle: 'dashed',
    paddingHorizontal: 32,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: TEXT, marginTop: 8 },
  emptySub: { fontSize: 14, color: TEXT_LIGHT, textAlign: 'center', lineHeight: 20 },
});
