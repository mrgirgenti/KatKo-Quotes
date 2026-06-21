import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  Switch,
  Linking,
  Platform,
  Alert,
} from 'react-native';
import {
  Truck, Plus, MoreVertical, Pencil, Trash2, Globe, BookOpen,
  X, CheckCircle2, Ban, Package,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import OverlayMenu from '@/components/OverlayMenu';
import { apiFetch } from '@/lib/apiFetch';

const BRAND = Colors.light.tint;
const TEXT = Colors.light.text;
const TEXT_LIGHT = Colors.light.textSecondary;
const BORDER = Colors.light.border;
const SURFACE = Colors.light.surface;
const BG = Colors.light.background;

const GREEN = '#16A34A';
const RED = '#DC2626';

interface Vendor {
  id: string;
  name: string;
  website: string | null;
  catalogUrl: string | null;
  isActive: boolean;
  sourceCount?: number;
}

type Filter = 'all' | 'active' | 'inactive';

interface FormState {
  name: string;
  website: string;
  catalogUrl: string;
  isActive: boolean;
}

const EMPTY_FORM: FormState = { name: '', website: '', catalogUrl: '', isActive: true };

function confirmDialog(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`)) onConfirm();
  } else {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onConfirm },
    ]);
  }
}

function notify(title: string, message: string) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

// ─── Form Modal ──────────────────────────────────────────────────────────────

function VendorFormModal({
  visible,
  initial,
  onClose,
  onSave,
}: {
  visible: boolean;
  initial: (Vendor | null);
  onClose: () => void;
  onSave: (data: FormState) => Promise<void>;
}) {
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      setForm(
        initial
          ? {
              name: initial.name,
              website: initial.website || '',
              catalogUrl: initial.catalogUrl || '',
              isActive: initial.isActive,
            }
          : { ...EMPTY_FORM },
      );
      setError('');
      setSaving(false);
    }
  }, [visible, initial]);

  const upd = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Vendor name is required.'); return; }
    setError('');
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Failed to save vendor.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={fm.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={fm.sheet} onPress={() => {}}>
          <View style={fm.header}>
            <Text style={fm.title}>{initial ? 'Edit Vendor' : 'Add Vendor'}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={20} color={TEXT_LIGHT} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
            <Text style={fm.label}>Vendor Name *</Text>
            <TextInput
              style={fm.input}
              value={form.name}
              onChangeText={t => upd('name', t)}
              placeholder="e.g. S&S Activewear"
              placeholderTextColor="#9CA3AF"
              autoFocus
            />

            <Text style={fm.label}>Website</Text>
            <TextInput
              style={fm.input}
              value={form.website}
              onChangeText={t => upd('website', t)}
              placeholder="https://www.example.com"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              keyboardType="url"
            />

            <Text style={fm.label}>Catalog Link</Text>
            <TextInput
              style={fm.input}
              value={form.catalogUrl}
              onChangeText={t => upd('catalogUrl', t)}
              placeholder="https://www.example.com/catalog"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              keyboardType="url"
            />

            <View style={fm.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={fm.switchLabel}>Active</Text>
                <Text style={fm.switchHint}>
                  Active vendors appear when assigning product sources.
                </Text>
              </View>
              <Switch
                value={form.isActive}
                onValueChange={v => upd('isActive', v)}
                trackColor={{ false: '#E5E7EB', true: '#BBF7D0' }}
                thumbColor={form.isActive ? GREEN : '#F3F4F6'}
              />
            </View>

            {error ? <Text style={fm.error}>{error}</Text> : null}
          </ScrollView>

          <View style={fm.footer}>
            <TouchableOpacity style={fm.cancelBtn} onPress={onClose} disabled={saving}>
              <Text style={fm.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[fm.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color="#fff" /> : (
                <Text style={fm.saveText}>{initial ? 'Save Changes' : 'Add Vendor'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function SourcingVendorManager() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/api/vendors?active=false');
      setVendors((data.vendors || []) as Vendor[]);
    } catch (e) {
      console.error('[SourcingVendorManager] load error', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const activeCount = vendors.filter(v => v.isActive).length;
  const inactiveCount = vendors.length - activeCount;

  const filtered = vendors.filter(v =>
    filter === 'all' ? true : filter === 'active' ? v.isActive : !v.isActive,
  );

  const handleSave = async (form: FormState) => {
    const payload = {
      name: form.name.trim(),
      website: form.website.trim() || null,
      catalogUrl: form.catalogUrl.trim() || null,
      isActive: form.isActive,
    };
    if (editing) {
      await apiFetch(`/api/vendors/${editing.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
    } else {
      await apiFetch('/api/vendors', { method: 'POST', body: JSON.stringify(payload) });
    }
    await load();
  };

  const toggleActive = async (v: Vendor) => {
    setBusyId(v.id);
    try {
      await apiFetch(`/api/vendors/${v.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !v.isActive }),
      });
      setVendors(prev => prev.map(x => x.id === v.id ? { ...x, isActive: !x.isActive } : x));
    } catch (e: any) {
      notify('Error', e?.message || 'Failed to update vendor.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = (v: Vendor) => {
    confirmDialog(
      `Delete "${v.name}"?`,
      'This permanently removes the vendor. This cannot be undone.',
      async () => {
        setBusyId(v.id);
        try {
          await apiFetch(`/api/vendors/${v.id}`, { method: 'DELETE' });
          setVendors(prev => prev.filter(x => x.id !== v.id));
        } catch (e: any) {
          notify('Cannot delete vendor', e?.message || 'Failed to delete vendor.');
        } finally {
          setBusyId(null);
        }
      },
    );
  };

  const openAdd = () => { setEditing(null); setModalVisible(true); };
  const openEdit = (v: Vendor) => { setEditing(v); setModalVisible(true); };

  return (
    <View style={s.screen}>
      {/* Header */}
      <View style={s.pageHeader}>
        <View style={{ flex: 1 }}>
          <Text style={s.pageSubtitle}>
            The approved vendors products can be sourced from. Inactive vendors stay linked to existing products but won't appear for new assignments.
          </Text>
        </View>
        <TouchableOpacity style={s.addBtn} onPress={openAdd}>
          <Plus size={15} color="#fff" />
          <Text style={s.addBtnText}>Add Vendor</Text>
        </TouchableOpacity>
      </View>

      {/* Filter tabs */}
      <View style={s.filterRow}>
        {([
          { key: 'all', label: `All (${vendors.length})` },
          { key: 'active', label: `Active (${activeCount})` },
          { key: 'inactive', label: `Inactive (${inactiveCount})` },
        ] as { key: Filter; label: string }[]).map(t => (
          <TouchableOpacity
            key={t.key}
            style={[s.filterTab, filter === t.key && s.filterTabActive]}
            onPress={() => setFilter(t.key)}
          >
            <Text style={[s.filterTabText, filter === t.key && s.filterTabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={s.centerBox}><ActivityIndicator color={BRAND} size="large" /></View>
      ) : filtered.length === 0 ? (
        <View style={s.centerBox}>
          <Truck size={36} color="#D1D5DB" />
          <Text style={s.emptyText}>No vendors to show.</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          {filtered.map(v => (
            <View key={v.id} style={[s.row, !v.isActive && s.rowInactive]}>
              <View style={s.rowMain}>
                <View style={s.nameLine}>
                  <Text style={[s.vendorName, !v.isActive && { color: TEXT_LIGHT }]} numberOfLines={1}>
                    {v.name}
                  </Text>
                  {v.isActive ? (
                    <View style={[s.badge, { backgroundColor: '#DCFCE7' }]}>
                      <Text style={[s.badgeText, { color: GREEN }]}>Active</Text>
                    </View>
                  ) : (
                    <View style={[s.badge, { backgroundColor: '#F3F4F6' }]}>
                      <Text style={[s.badgeText, { color: TEXT_LIGHT }]}>Inactive</Text>
                    </View>
                  )}
                </View>
                <View style={s.linkLine}>
                  {v.website ? (
                    <TouchableOpacity style={s.linkChip} onPress={() => Linking.openURL(v.website!)}>
                      <Globe size={12} color={BRAND} />
                      <Text style={s.linkChipText} numberOfLines={1}>Website</Text>
                    </TouchableOpacity>
                  ) : null}
                  {v.catalogUrl ? (
                    <TouchableOpacity style={s.linkChip} onPress={() => Linking.openURL(v.catalogUrl!)}>
                      <BookOpen size={12} color={BRAND} />
                      <Text style={s.linkChipText} numberOfLines={1}>Catalog</Text>
                    </TouchableOpacity>
                  ) : null}
                  {!v.website && !v.catalogUrl ? (
                    <Text style={s.noLinks}>No links</Text>
                  ) : null}
                  <View style={s.sourcePill}>
                    <Package size={12} color={TEXT_LIGHT} />
                    <Text style={s.sourcePillText}>
                      {(v.sourceCount ?? 0)} {(v.sourceCount ?? 0) === 1 ? 'product' : 'products'}
                    </Text>
                  </View>
                </View>
              </View>

              {busyId === v.id ? (
                <ActivityIndicator size="small" color={BRAND} style={{ width: 32 }} />
              ) : (
                <OverlayMenu
                  menuWidth={190}
                  align="right"
                  trigger={({ open }) => (
                    <TouchableOpacity style={s.menuBtn} onPress={open} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <MoreVertical size={18} color={TEXT_LIGHT} />
                    </TouchableOpacity>
                  )}
                >
                  {({ close }) => (
                    <>
                      <TouchableOpacity style={s.menuItem} onPress={() => { close(); openEdit(v); }}>
                        <Pencil size={14} color={TEXT} />
                        <Text style={s.menuItemText}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={s.menuItem} onPress={() => { close(); toggleActive(v); }}>
                        {v.isActive ? <Ban size={14} color="#B45309" /> : <CheckCircle2 size={14} color={GREEN} />}
                        <Text style={s.menuItemText}>{v.isActive ? 'Deactivate' : 'Activate'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[s.menuItem, { borderBottomWidth: 0 }]} onPress={() => { close(); handleDelete(v); }}>
                        <Trash2 size={14} color={RED} />
                        <Text style={[s.menuItemText, { color: RED }]}>Delete</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </OverlayMenu>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      <VendorFormModal
        visible={modalVisible}
        initial={editing}
        onClose={() => setModalVisible(false)}
        onSave={handleSave}
      />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 60 },
  emptyText: { fontSize: 14, color: TEXT_LIGHT },

  pageHeader: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    paddingHorizontal: 24, paddingTop: 20, paddingBottom: 12,
  },
  pageTitle: { fontSize: 20, fontWeight: '700', color: TEXT },
  pageSubtitle: { fontSize: 13, color: TEXT_LIGHT, marginTop: 4, maxWidth: 620, lineHeight: 18 },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: BRAND, borderRadius: 8,
    paddingVertical: 9, paddingHorizontal: 14, flexShrink: 0,
  },
  addBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  filterRow: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 24, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  filterTab: {
    paddingVertical: 6, paddingHorizontal: 14, borderRadius: 16,
    borderWidth: 1, borderColor: BORDER, backgroundColor: SURFACE,
  },
  filterTabActive: { backgroundColor: '#EFF6FF', borderColor: BRAND },
  filterTabText: { fontSize: 13, color: TEXT_LIGHT, fontWeight: '500' },
  filterTabTextActive: { color: BRAND, fontWeight: '700' },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 24, paddingVertical: 14,
    backgroundColor: SURFACE, borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  rowInactive: { backgroundColor: '#FAFAFA' },
  rowMain: { flex: 1, gap: 8 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  vendorName: { fontSize: 15, fontWeight: '600', color: TEXT, flexShrink: 1 },

  badge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  linkLine: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  linkChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#EFF6FF', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
  },
  linkChipText: { fontSize: 12, color: BRAND, fontWeight: '500' },
  noLinks: { fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' },

  sourcePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  sourcePillText: { fontSize: 12, color: TEXT_LIGHT, fontWeight: '500' },

  menuBtn: { padding: 4, width: 32, alignItems: 'flex-end' },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 11, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  menuItemText: { fontSize: 14, color: TEXT, fontWeight: '500' },
});

const fm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  sheet: { width: '100%', maxWidth: 460, backgroundColor: SURFACE, borderRadius: 14, padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  title: { fontSize: 17, fontWeight: '700', color: TEXT },

  label: { fontSize: 13, fontWeight: '600', color: TEXT, marginTop: 12, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: BORDER, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: TEXT,
    backgroundColor: '#fff',
  },

  switchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginTop: 18, paddingTop: 16, borderTopWidth: 1, borderTopColor: BORDER,
  },
  switchLabel: { fontSize: 14, fontWeight: '600', color: TEXT },
  switchHint: { fontSize: 12, color: TEXT_LIGHT, marginTop: 2 },

  error: { color: RED, fontSize: 13, marginTop: 12 },

  footer: { flexDirection: 'row', gap: 10, marginTop: 18 },
  cancelBtn: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 8, borderWidth: 1, borderColor: BORDER },
  cancelText: { fontSize: 14, color: TEXT, fontWeight: '500' },
  saveBtn: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 8, backgroundColor: BRAND },
  saveText: { fontSize: 14, color: '#fff', fontWeight: '600' },
});
