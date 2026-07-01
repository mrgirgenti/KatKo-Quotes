import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Plus, Pencil, Trash2, X, ChevronDown } from 'lucide-react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Colors from '@/constants/colors';
import OverlayMenu from '@/components/OverlayMenu';
import type { CostLibraryEntry } from '@/components/CostLibraryTable';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ServiceStyleEntry {
  id: string;
  name: string;
  supplier?: string;
  defaultMargin?: number;
  defaultProductionDays?: number;
  defaultProductionCosts: string[];
  defaultArtworkRequirements?: string;
  defaultTaxBehavior: string;
  description?: string;
  enabled: boolean;
  sortOrder: number;
}

const TAX_BEHAVIOR_OPTIONS = [
  { value: 'taxable', label: 'Taxable' },
  { value: 'non_taxable', label: 'Non-Taxable' },
  { value: 'exempt', label: 'Tax Exempt' },
];

function taxBehaviorLabel(v: string) {
  return TAX_BEHAVIOR_OPTIONS.find((o) => o.value === v)?.label ?? 'Taxable';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function emptyStyle(): Omit<ServiceStyleEntry, 'id'> {
  return {
    name: '',
    supplier: '',
    defaultMargin: undefined,
    defaultProductionDays: undefined,
    defaultProductionCosts: [],
    defaultArtworkRequirements: '',
    defaultTaxBehavior: 'taxable',
    description: '',
    enabled: true,
    sortOrder: 0,
  };
}

// ── Toggle ────────────────────────────────────────────────────────────────────

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <TouchableOpacity
      style={[tog.base, on ? tog.on : tog.off]}
      onPress={onToggle}
      activeOpacity={0.8}
    >
      <Text style={[tog.text, on ? tog.textOn : tog.textOff]}>{on ? 'On' : 'Off'}</Text>
    </TouchableOpacity>
  );
}

const tog = StyleSheet.create({
  base: { minWidth: 46, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, borderWidth: 1 },
  on: { backgroundColor: Colors.light.tint, borderColor: Colors.light.tint },
  off: { backgroundColor: Colors.light.background, borderColor: Colors.light.border },
  text: { fontSize: 11, fontWeight: '700' as const },
  textOn: { color: '#fff' },
  textOff: { color: Colors.light.textSecondary },
});

// ── DrawerDropdown ────────────────────────────────────────────────────────────

function DrawerDropdown<T extends string>({
  label,
  value,
  options,
  onSelect,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onSelect: (v: T) => void;
}) {
  return (
    <OverlayMenu
      menuWidth={200}
      align="left"
      trigger={({ open }) => (
        <TouchableOpacity style={ddn.btn} onPress={open} activeOpacity={0.7}>
          <Text style={ddn.text} numberOfLines={1}>{label}</Text>
          <ChevronDown size={12} color={Colors.light.textSecondary} />
        </TouchableOpacity>
      )}
    >
      {({ close }) => (
        <>
          {options.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={ddn.item}
              onPress={() => { close(); onSelect(opt.value); }}
            >
              <Text style={[ddn.itemText, value === opt.value && ddn.itemActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </>
      )}
    </OverlayMenu>
  );
}

const ddn = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: Colors.light.border, borderRadius: 6, paddingHorizontal: 10, height: 38, backgroundColor: Colors.light.surface, minWidth: 160 },
  text: { fontSize: 13, color: Colors.light.text, flex: 1 },
  item: { paddingHorizontal: 14, paddingVertical: 10 },
  itemText: { fontSize: 13, color: Colors.light.text },
  itemActive: { color: Colors.light.tint, fontWeight: '600' as const },
});

// ── Production Costs Multi-Select ─────────────────────────────────────────────

function ProductionCostsSelector({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const { data: costItems = [], isLoading } = useQuery<CostLibraryEntry[]>({
    queryKey: ['cost-library', 'production'],
    queryFn: async () => {
      const r = await fetch('/api/cost-library?category=production');
      if (!r.ok) throw new Error('Failed to load');
      return r.json();
    },
    networkMode: 'always',
    staleTime: 30_000,
  });

  const enabled = costItems.filter((c) => c.enabled);

  if (isLoading) {
    return (
      <View style={pcs.loading}>
        <ActivityIndicator size="small" color={Colors.light.tint} />
        <Text style={pcs.loadingText}>Loading cost library…</Text>
      </View>
    );
  }

  if (enabled.length === 0) {
    return (
      <View style={pcs.empty}>
        <Text style={pcs.emptyText}>No production costs configured yet.</Text>
      </View>
    );
  }

  return (
    <View>
      {enabled.map((item) => {
        const isSelected = selected.includes(item.id);
        return (
          <TouchableOpacity
            key={item.id}
            style={[pcs.row, isSelected && pcs.rowSelected]}
            onPress={() => onToggle(item.id)}
            activeOpacity={0.7}
          >
            <View style={[pcs.checkbox, isSelected && pcs.checkboxSelected]}>
              {isSelected && <Text style={pcs.checkMark}>✓</Text>}
            </View>
            <View style={pcs.rowInfo}>
              <Text style={pcs.rowName} numberOfLines={1}>{item.name}</Text>
              <Text style={pcs.rowMeta} numberOfLines={1}>
                {item.calculationType === 'flat' ? `$${item.rate.toFixed(2)}` :
                 item.calculationType === 'percentage' ? `${item.rate}%` :
                 item.calculationType === 'hourly' ? `$${item.rate.toFixed(2)}/hr` :
                 item.calculationType === 'per_unit' ? `$${item.rate.toFixed(2)}/unit` :
                 item.calculationType === 'per_design' ? `$${item.rate.toFixed(2)}/design` :
                 `$${item.rate.toFixed(2)}`}
                {' · '}{item.scope === 'per_piece' ? 'Per Piece' : item.scope === 'per_line' ? 'Per Line' : 'Per Order'}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const pcs = StyleSheet.create({
  loading: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  loadingText: { fontSize: 12, color: Colors.light.textSecondary },
  empty: { padding: 12 },
  emptyText: { fontSize: 12, color: Colors.light.textSecondary, fontStyle: 'italic' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.light.border },
  rowSelected: { backgroundColor: '#EFF6FF' },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: Colors.light.border, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  checkboxSelected: { backgroundColor: Colors.light.tint, borderColor: Colors.light.tint },
  checkMark: { fontSize: 11, color: '#fff', fontWeight: '700' as const, lineHeight: 14 },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 13, color: Colors.light.text, fontWeight: '500' as const },
  rowMeta: { fontSize: 11, color: Colors.light.textSecondary, marginTop: 1 },
});

// ── Drawer ────────────────────────────────────────────────────────────────────

interface DrawerProps {
  visible: boolean;
  entry: ServiceStyleEntry | null;
  isSaving: boolean;
  isDeleting: boolean;
  onSave: (data: Omit<ServiceStyleEntry, 'id'> & { id?: string }) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

function ServiceStyleDrawer({ visible, entry, isSaving, isDeleting, onSave, onDelete, onClose }: DrawerProps) {
  const isNew = entry === null;
  const [form, setForm] = useState<Omit<ServiceStyleEntry, 'id'>>(() => entry ? { ...entry } : emptyStyle());

  useEffect(() => {
    setForm(entry ? { ...entry } : emptyStyle());
  }, [entry, visible]);

  const set = useCallback(<K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [k]: v }));
  }, []);

  function toggleProductionCost(id: string) {
    setForm((prev) => {
      const current = prev.defaultProductionCosts ?? [];
      const next = current.includes(id)
        ? current.filter((x) => x !== id)
        : [...current, id];
      return { ...prev, defaultProductionCosts: next };
    });
  }

  function handleSave() {
    if (!form.name.trim()) return;
    onSave({ ...form, ...(entry ? { id: entry.id } : {}) });
  }

  return (
    <Modal visible={visible} transparent animationType="none">
      <View style={dr.modalRoot}>
        <TouchableOpacity style={dr.backdrop} onPress={onClose} activeOpacity={1} />
        <View style={dr.panel}>
          <View style={dr.panelHeader}>
            <Text style={dr.panelTitle}>{isNew ? 'New Service Style' : 'Edit Service Style'}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={18} color={Colors.light.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={dr.scroll} contentContainerStyle={dr.scrollContent}>
            {/* Basic Information */}
            <Text style={dr.sectionLabel}>Basic Information</Text>
            <View style={dr.sectionCard}>
              <View style={dr.fieldRow}>
                <Text style={dr.fieldLabel}>Name</Text>
                <TextInput
                  style={dr.textInput}
                  value={form.name}
                  onChangeText={(t) => set('name', t)}
                  placeholder="e.g. Screen Print, Embroidery"
                  placeholderTextColor={Colors.light.textSecondary}
                />
              </View>
              <View style={[dr.fieldRow, dr.noBorder]}>
                <Text style={dr.fieldLabel}>Default Supplier</Text>
                <TextInput
                  style={dr.textInput}
                  value={form.supplier ?? ''}
                  onChangeText={(t) => set('supplier', t)}
                  placeholder="e.g. SanMar, S&S"
                  placeholderTextColor={Colors.light.textSecondary}
                />
              </View>
            </View>

            {/* Defaults */}
            <Text style={dr.sectionLabel}>Defaults</Text>
            <View style={dr.sectionCard}>
              <View style={dr.fieldRow}>
                <Text style={dr.fieldLabel}>Default Markup %</Text>
                <View style={dr.numWrap}>
                  <TextInput
                    style={dr.numInput}
                    value={form.defaultMargin != null ? String(form.defaultMargin) : ''}
                    onChangeText={(t) => {
                      const n = parseFloat(t.replace(/[^0-9.]/g, ''));
                      set('defaultMargin', Number.isFinite(n) ? n : undefined);
                    }}
                    keyboardType="decimal-pad"
                    placeholder="e.g. 35"
                    placeholderTextColor={Colors.light.textSecondary}
                  />
                  <Text style={dr.numSuffix}>%</Text>
                </View>
              </View>
              <View style={[dr.fieldRow, dr.noBorder]}>
                <Text style={dr.fieldLabel}>Production Days</Text>
                <View style={dr.numWrap}>
                  <TextInput
                    style={dr.numInput}
                    value={form.defaultProductionDays != null ? String(form.defaultProductionDays) : ''}
                    onChangeText={(t) => {
                      const n = parseInt(t.replace(/[^0-9]/g, ''), 10);
                      set('defaultProductionDays', Number.isFinite(n) ? n : undefined);
                    }}
                    keyboardType="number-pad"
                    placeholder="e.g. 5"
                    placeholderTextColor={Colors.light.textSecondary}
                  />
                  <Text style={dr.numSuffix}>days</Text>
                </View>
              </View>
            </View>

            {/* Default Production Costs */}
            <Text style={dr.sectionLabel}>Default Production Costs</Text>
            <Text style={dr.sectionHint}>These costs auto-populate in the Quote Builder when this service style is selected.</Text>
            <View style={dr.sectionCard}>
              <ProductionCostsSelector
                selected={form.defaultProductionCosts ?? []}
                onToggle={toggleProductionCost}
              />
            </View>

            {/* Artwork & Tax */}
            <Text style={dr.sectionLabel}>Artwork & Tax</Text>
            <View style={dr.sectionCard}>
              <View style={dr.fieldRow}>
                <Text style={dr.fieldLabel}>Default Tax Behavior</Text>
                <DrawerDropdown
                  value={form.defaultTaxBehavior as any}
                  label={taxBehaviorLabel(form.defaultTaxBehavior)}
                  options={TAX_BEHAVIOR_OPTIONS as any}
                  onSelect={(v) => set('defaultTaxBehavior', v)}
                />
              </View>
              <View style={[dr.fieldRow, dr.noBorder]}>
                <Text style={dr.fieldLabel}>Artwork Requirements</Text>
              </View>
              <TextInput
                style={[dr.textInput, dr.textarea, { margin: 0, maxWidth: '100%', borderTopWidth: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0 }]}
                value={form.defaultArtworkRequirements ?? ''}
                onChangeText={(t) => set('defaultArtworkRequirements', t)}
                placeholder="e.g. 300 DPI PNG, vector preferred, separated layers"
                placeholderTextColor={Colors.light.textSecondary}
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Behavior */}
            <Text style={dr.sectionLabel}>Behavior</Text>
            <View style={dr.sectionCard}>
              <View style={dr.fieldRow}>
                <Text style={dr.fieldLabel}>Enabled</Text>
                <Toggle on={form.enabled} onToggle={() => set('enabled', !form.enabled)} />
              </View>
              <View style={[dr.fieldRow, dr.noBorder]}>
                <Text style={dr.fieldLabel}>Display Order</Text>
                <View style={dr.numWrap}>
                  <TextInput
                    style={dr.numInput}
                    value={String(form.sortOrder ?? 0)}
                    onChangeText={(t) => {
                      const n = parseInt(t.replace(/[^0-9]/g, ''), 10);
                      set('sortOrder', Number.isFinite(n) ? n : 0);
                    }}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor={Colors.light.textSecondary}
                  />
                </View>
              </View>
            </View>

            {/* Description */}
            <Text style={dr.sectionLabel}>Description / Notes</Text>
            <View style={dr.sectionCard}>
              <TextInput
                style={[dr.textInput, dr.textarea]}
                value={form.description ?? ''}
                onChangeText={(t) => set('description', t)}
                placeholder="Optional description or internal notes…"
                placeholderTextColor={Colors.light.textSecondary}
                multiline
                numberOfLines={3}
              />
            </View>
          </ScrollView>

          <View style={dr.footer}>
            {!isNew && (
              <TouchableOpacity style={dr.deleteBtn} onPress={() => entry && onDelete(entry.id)} disabled={isDeleting} activeOpacity={0.8}>
                <Trash2 size={14} color={Colors.light.error} />
                <Text style={dr.deleteBtnText}>Delete</Text>
              </TouchableOpacity>
            )}
            <View style={dr.footerRight}>
              <TouchableOpacity style={dr.cancelBtn} onPress={onClose} activeOpacity={0.8}>
                <Text style={dr.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[dr.saveBtn, (!form.name.trim() || isSaving) && dr.saveBtnDisabled]}
                onPress={handleSave}
                disabled={!form.name.trim() || isSaving}
                activeOpacity={0.85}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={dr.saveBtnText}>{isNew ? 'Create' : 'Save'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const dr = StyleSheet.create({
  modalRoot: { flex: 1, flexDirection: 'row' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  panel: { width: 440, backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: -2, height: 0 }, shadowOpacity: 0.12, shadowRadius: 16, flexDirection: 'column' },
  panelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.light.border },
  panelTitle: { fontSize: 15, fontWeight: '700' as const, color: Colors.light.text },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 8 },
  sectionLabel: { fontSize: 10, fontWeight: '700' as const, color: Colors.light.textSecondary, letterSpacing: 0.6, textTransform: 'uppercase' as const, marginBottom: 4, marginTop: 16 },
  sectionHint: { fontSize: 11, color: Colors.light.textSecondary, marginBottom: 6 },
  sectionCard: { borderWidth: 1, borderColor: Colors.light.border, borderRadius: 8, backgroundColor: Colors.light.surface, overflow: 'hidden' },
  fieldRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.light.border, minHeight: 52 },
  noBorder: { borderBottomWidth: 0 },
  fieldLabel: { fontSize: 13, color: Colors.light.text, fontWeight: '500' as const, flex: 1 },
  textInput: { flex: 1, borderWidth: 1, borderColor: Colors.light.border, borderRadius: 6, paddingHorizontal: 10, height: 38, fontSize: 13, color: Colors.light.text, backgroundColor: Colors.light.surface, maxWidth: 220 },
  textarea: { height: 80, textAlignVertical: 'top' as const, paddingTop: 8, maxWidth: '100%' },
  numWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: Colors.light.border, borderRadius: 6, paddingHorizontal: 10, height: 38, backgroundColor: Colors.light.surface, maxWidth: 120 },
  numInput: { flex: 1, fontSize: 13, color: Colors.light.text, paddingVertical: 0 },
  numSuffix: { fontSize: 12, color: Colors.light.textSecondary, marginLeft: 4 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: Colors.light.border, backgroundColor: Colors.light.background },
  footerRight: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7 },
  deleteBtnText: { fontSize: 12, color: Colors.light.error, fontWeight: '600' as const },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 7, borderWidth: 1, borderColor: Colors.light.border },
  cancelText: { fontSize: 13, color: Colors.light.text, fontWeight: '600' as const },
  saveBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 7, backgroundColor: Colors.light.tint, minWidth: 80, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { fontSize: 13, color: '#fff', fontWeight: '700' as const },
});

// ── Column widths ─────────────────────────────────────────────────────────────

const COL = { name: 180, supplier: 140, margin: 100, days: 100, taxBehavior: 120, enabled: 80, actions: 80 } as const;
const TABLE_MIN = Object.values(COL).reduce((a, b) => a + b, 0) + 24;

// ── Main Component ────────────────────────────────────────────────────────────

export function ServiceStylesTable() {
  const queryClient = useQueryClient();
  const queryKey = ['service-styles'];

  const { data: rows = [], isLoading } = useQuery<ServiceStyleEntry[]>({
    queryKey,
    queryFn: async () => {
      const r = await fetch('/api/service-styles');
      if (!r.ok) throw new Error('Failed to load service styles');
      return r.json();
    },
    networkMode: 'always',
    staleTime: 30_000,
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey });
  }, [queryClient]);

  const createMutation = useMutation({
    mutationFn: async (data: Omit<ServiceStyleEntry, 'id'>) => {
      const r = await fetch('/api/service-styles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      if (!r.ok) throw new Error('Failed to create');
      return r.json();
    },
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<ServiceStyleEntry> & { id: string }) => {
      const r = await fetch(`/api/service-styles/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
      if (!r.ok) throw new Error('Failed to update');
      return r.json();
    },
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/service-styles/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('Failed to delete');
    },
    onSuccess: invalidate,
  });

  const [drawerEntry, setDrawerEntry] = useState<ServiceStyleEntry | null | undefined>(undefined);
  const drawerVisible = drawerEntry !== undefined;

  async function handleSave(data: Omit<ServiceStyleEntry, 'id'> & { id?: string }) {
    if (data.id) {
      const { id, ...patch } = data;
      await updateMutation.mutateAsync({ id, ...patch });
    } else {
      await createMutation.mutateAsync(data as Omit<ServiceStyleEntry, 'id'>);
    }
    setDrawerEntry(undefined);
  }

  async function handleDelete(id: string) {
    await deleteMutation.mutateAsync(id);
    setDrawerEntry(undefined);
  }

  return (
    <>
      <View style={styles.section}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Service Styles</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => setDrawerEntry(null)} activeOpacity={0.85}>
            <Plus size={12} color="#fff" />
            <Text style={styles.addBtnText}>Add Service Style</Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={Colors.light.tint} />
            <Text style={styles.loadingText}>Loading…</Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator style={styles.hScroll}>
            <View style={{ minWidth: TABLE_MIN }}>
              <View style={styles.colHead}>
                <Text style={[styles.colHeadText, { width: COL.name }]}>Name</Text>
                <Text style={[styles.colHeadText, { width: COL.supplier }]}>Supplier</Text>
                <Text style={[styles.colHeadText, { width: COL.margin, textAlign: 'right' }]}>Markup</Text>
                <Text style={[styles.colHeadText, { width: COL.days, textAlign: 'right' }]}>Prod. Days</Text>
                <Text style={[styles.colHeadText, { width: COL.taxBehavior }]}>Tax</Text>
                <Text style={[styles.colHeadText, { width: COL.enabled, textAlign: 'center' }]}>Enabled</Text>
                <Text style={[styles.colHeadText, { width: COL.actions, textAlign: 'center' }]}>Actions</Text>
              </View>

              {rows.length === 0 ? (
                <View style={styles.emptyRow}>
                  <Text style={styles.emptyText}>No service styles yet — click "Add Service Style" to get started.</Text>
                </View>
              ) : (
                rows.map((row) => (
                  <View key={row.id} style={[styles.row, !row.enabled && styles.rowDisabled]}>
                    <View style={{ width: COL.name }}>
                      <Text style={styles.cellText} numberOfLines={1}>{row.name}</Text>
                      {(row.defaultProductionCosts?.length ?? 0) > 0 && (
                        <Text style={styles.cellBadge}>{row.defaultProductionCosts.length} cost{row.defaultProductionCosts.length !== 1 ? 's' : ''}</Text>
                      )}
                    </View>
                    <Text style={[styles.cellText, styles.cellSecondary, { width: COL.supplier }]} numberOfLines={1}>
                      {row.supplier || '—'}
                    </Text>
                    <Text style={[styles.cellText, styles.cellMono, { width: COL.margin, textAlign: 'right' }]}>
                      {row.defaultMargin != null ? `${row.defaultMargin}%` : '—'}
                    </Text>
                    <Text style={[styles.cellText, styles.cellMono, { width: COL.days, textAlign: 'right' }]}>
                      {row.defaultProductionDays != null ? `${row.defaultProductionDays}d` : '—'}
                    </Text>
                    <Text style={[styles.cellText, styles.cellSecondary, { width: COL.taxBehavior }]} numberOfLines={1}>
                      {taxBehaviorLabel(row.defaultTaxBehavior)}
                    </Text>
                    <View style={{ width: COL.enabled, alignItems: 'center' }}>
                      <Toggle on={row.enabled} onToggle={() => updateMutation.mutate({ id: row.id, enabled: !row.enabled })} />
                    </View>
                    <View style={{ width: COL.actions, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                      <TouchableOpacity onPress={() => setDrawerEntry(row)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Pencil size={15} color={Colors.light.tint} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => deleteMutation.mutate(row.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Trash2 size={15} color={Colors.light.error} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        )}
      </View>

      <ServiceStyleDrawer
        visible={drawerVisible}
        entry={drawerEntry ?? null}
        isSaving={createMutation.isPending || updateMutation.isPending}
        isDeleting={deleteMutation.isPending}
        onSave={handleSave}
        onDelete={handleDelete}
        onClose={() => setDrawerEntry(undefined)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  section: { borderWidth: 1, borderColor: Colors.light.border, borderRadius: 8, backgroundColor: Colors.light.surface, overflow: 'hidden', marginTop: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#000', paddingHorizontal: 16, height: 36 },
  headerTitle: { fontSize: 11, fontWeight: '700' as const, color: '#fff', letterSpacing: 0.6, textTransform: 'uppercase' as const },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.light.tint, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  addBtnText: { fontSize: 11, fontWeight: '700' as const, color: '#fff' },
  hScroll: { backgroundColor: Colors.light.surface },
  colHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, backgroundColor: Colors.light.background, borderBottomWidth: 1, borderBottomColor: Colors.light.border },
  colHeadText: { fontSize: 9, fontWeight: '700' as const, color: Colors.light.textSecondary, letterSpacing: 0.4, textTransform: 'uppercase' as const, paddingRight: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.light.border },
  rowDisabled: { opacity: 0.5 },
  cellText: { fontSize: 13, color: Colors.light.text, paddingRight: 8 },
  cellSecondary: { color: Colors.light.textSecondary },
  cellMono: { fontVariant: ['tabular-nums' as any] },
  cellBadge: { fontSize: 10, color: Colors.light.tint, fontWeight: '600' as const, marginTop: 1 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 20, justifyContent: 'center' },
  loadingText: { fontSize: 13, color: Colors.light.textSecondary },
  emptyRow: { padding: 24, alignItems: 'center' },
  emptyText: { fontSize: 13, color: Colors.light.textSecondary, textAlign: 'center' },
});
