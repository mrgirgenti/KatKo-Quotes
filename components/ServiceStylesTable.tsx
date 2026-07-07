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
import LibraryManagementMenu, {
  type ImportMode,
  type LibraryImportPreview,
} from '@/components/LibraryManagementMenu';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ServiceStyleEntry {
  id: string;
  name: string;
  supplier?: string;
  defaultMargin?: string;
  quantityMode?: string;
  enabled: boolean;
  sortOrder: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const QUANTITY_MODE_OPTIONS = [
  { value: '', label: '—' },
  { value: 'per_piece', label: 'Per Piece' },
  { value: 'flat', label: 'Flat' },
  { value: 'tiered', label: 'Tiered' },
];

const CSV_HEADERS = ['name', 'supplier', 'defaultMargin', 'quantityMode', 'enabled'] as const;

// ── CSV helpers ───────────────────────────────────────────────────────────────

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else { inQ = !inQ; }
    } else if (ch === ',' && !inQ) { result.push(cur); cur = ''; }
    else { cur += ch; }
  }
  result.push(cur);
  return result;
}

function parseCsvText(text: string): Array<Record<string, string>> {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).filter(l => l.trim()).map(l => {
    const vals = splitCsvLine(l);
    return Object.fromEntries(headers.map((h, i) => [h, (vals[i] ?? '').trim().replace(/^"|"$/g, '')]));
  });
}

function csvCell(v: unknown): string {
  return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

function serializeToCsv(rows: Record<string, unknown>[], headers: readonly string[]): string {
  return [headers.map(csvCell).join(','), ...rows.map(r => headers.map(h => csvCell(r[h])).join(','))].join('\n');
}

function parseBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  const s = String(v ?? '').toLowerCase();
  return s === 'true' || s === '1' || s === 'yes';
}

function normalizeMargin(raw: string): string {
  const s = raw.trim();
  if (!s) return '';
  const stripped = s.replace(/%$/, '').trim();
  const n = parseFloat(stripped);
  if (!Number.isFinite(n)) return s;
  if (n > 1 && n <= 100) return `${n}%`;
  if (n >= 0 && n <= 1) return `${(n * 100).toFixed(1)}%`;
  return s;
}

function quantityModeLabel(val: string): string {
  return (QUANTITY_MODE_OPTIONS.find((o) => o.value === val)?.label ?? val) || '—';
}

function emptyStyle(): Omit<ServiceStyleEntry, 'id'> {
  return {
    name: '',
    supplier: '',
    defaultMargin: '',
    quantityMode: '',
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
  base: { minWidth: 46, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, borderWidth: 1 },
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
              key={`opt-${opt.value}`}
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
                <Text style={dr.fieldLabel}>Service Style Name</Text>
                <TextInput
                  style={dr.textInput}
                  value={form.name}
                  onChangeText={(t) => set('name', t)}
                  placeholder="e.g. Screen Printing"
                  placeholderTextColor={Colors.light.textSecondary}
                />
              </View>
              <View style={[dr.fieldRow, dr.noBorder]}>
                <Text style={dr.fieldLabel}>Supplier</Text>
                <TextInput
                  style={dr.textInput}
                  value={form.supplier ?? ''}
                  onChangeText={(t) => set('supplier', t)}
                  placeholder="e.g. SanMar, S&S"
                  placeholderTextColor={Colors.light.textSecondary}
                />
              </View>
            </View>

            {/* Configuration */}
            <Text style={dr.sectionLabel}>Configuration</Text>
            <View style={dr.sectionCard}>
              <View style={dr.fieldRow}>
                <Text style={dr.fieldLabel}>Default Margin</Text>
                <TextInput
                  style={[dr.textInput, { maxWidth: 130 }]}
                  value={form.defaultMargin ?? ''}
                  onChangeText={(t) => set('defaultMargin', t)}
                  placeholder="e.g. 45%, 0.45"
                  placeholderTextColor={Colors.light.textSecondary}
                />
              </View>
              <View style={[dr.fieldRow, dr.noBorder]}>
                <Text style={dr.fieldLabel}>Quantity Mode</Text>
                <DrawerDropdown
                  value={(form.quantityMode ?? '') as any}
                  label={quantityModeLabel(form.quantityMode ?? '')}
                  options={QUANTITY_MODE_OPTIONS as any}
                  onSelect={(v) => set('quantityMode', v)}
                />
              </View>
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
                <TextInput
                  style={[dr.textInput, { maxWidth: 90 }]}
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
  panel: { width: 420, backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: -2, height: 0 }, shadowOpacity: 0.12, shadowRadius: 16, flexDirection: 'column' },
  panelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.light.border },
  panelTitle: { fontSize: 15, fontWeight: '700' as const, color: Colors.light.text },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 8 },
  sectionLabel: { fontSize: 10, fontWeight: '700' as const, color: Colors.light.textSecondary, letterSpacing: 0.6, textTransform: 'uppercase' as const, marginBottom: 4, marginTop: 16 },
  sectionCard: { borderWidth: 1, borderColor: Colors.light.border, borderRadius: 8, backgroundColor: Colors.light.surface, overflow: 'hidden' },
  fieldRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.light.border, minHeight: 52 },
  noBorder: { borderBottomWidth: 0 },
  fieldLabel: { fontSize: 13, color: Colors.light.text, fontWeight: '500' as const, flex: 1 },
  textInput: { flex: 1, borderWidth: 1, borderColor: Colors.light.border, borderRadius: 6, paddingHorizontal: 10, height: 38, fontSize: 13, color: Colors.light.text, backgroundColor: Colors.light.surface, maxWidth: 220 },
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

const COL = { name: 200, supplier: 150, margin: 130, qtyMode: 140, enabled: 80, actions: 70 } as const;
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
    const payload = {
      ...data,
      defaultMargin: data.defaultMargin ? normalizeMargin(data.defaultMargin) : '',
    };
    if (payload.id) {
      const { id, ...patch } = payload;
      await updateMutation.mutateAsync({ id, ...patch });
    } else {
      await createMutation.mutateAsync(payload as Omit<ServiceStyleEntry, 'id'>);
    }
    setDrawerEntry(undefined);
  }

  async function handleDelete(id: string) {
    await deleteMutation.mutateAsync(id);
    setDrawerEntry(undefined);
  }

  // ── Import / Export ──────────────────────────────────────────────────────────

  function handleParseImport(content: string): LibraryImportPreview {
    const rawRows = parseCsvText(content) as Record<string, unknown>[];
    const errors: string[] = [];
    const validRows: Omit<ServiceStyleEntry, 'id'>[] = [];
    let invalidCount = 0;

    rawRows.forEach((raw, idx) => {
      const rowNum = idx + 2;
      const name = (raw.name ?? raw['Service Style'] ?? '') as string;
      const trimmedName = String(name).trim();
      if (!trimmedName) {
        if (errors.length < 10) errors.push(`Row ${rowNum}: "name" is required`);
        invalidCount++;
        return;
      }

      validRows.push({
        name: trimmedName,
        supplier: String(raw.supplier ?? '').trim() || undefined,
        defaultMargin: String(raw.defaultMargin ?? '').trim() || undefined,
        quantityMode: String(raw.quantityMode ?? '').trim() || undefined,
        enabled: parseBool(raw.enabled ?? 'true'),
        sortOrder: parseInt(String(raw.sortOrder ?? 0)) || 0,
      });
    });

    const existingNames = new Set(rows.map(r => r.name.toLowerCase()));
    const duplicateCount = validRows.filter(r => existingNames.has(r.name.toLowerCase())).length;
    return { validCount: validRows.length, invalidCount, duplicateCount, errors, rows: validRows };
  }

  async function handleConfirmImport(importRows: unknown[], mode: ImportMode) {
    const typedRows = importRows as Omit<ServiceStyleEntry, 'id'>[];
    const existingByName = new Map(rows.map(r => [r.name.toLowerCase(), r.id]));

    for (const row of typedRows) {
      const existingId = existingByName.get(row.name.toLowerCase());
      const payload = { ...row, defaultMargin: row.defaultMargin ? normalizeMargin(row.defaultMargin) : '' };
      if (mode === 'skip' && existingId) continue;
      if (mode === 'replace' && existingId) {
        await fetch(`/api/service-styles/${existingId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      } else {
        await fetch('/api/service-styles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      }
    }
    queryClient.invalidateQueries({ queryKey: ['service-styles'] });
  }

  function getExportData(format: 'csv' | 'json'): string {
    const exportRows = rows.map(({ id: _id, sortOrder: _so, ...rest }) => rest);
    if (format === 'json') return JSON.stringify(exportRows, null, 2);
    return serializeToCsv(exportRows as Record<string, unknown>[], CSV_HEADERS);
  }

  function getTemplateData(): string {
    const example = { name: 'Screen Printing', supplier: 'SanMar', defaultMargin: '45%', quantityMode: 'per_piece', enabled: true };
    return serializeToCsv([example] as Record<string, unknown>[], CSV_HEADERS);
  }

  return (
    <>
      <View style={styles.section}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Service Styles</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.addBtn} onPress={() => setDrawerEntry(null)} activeOpacity={0.85}>
              <Plus size={12} color="#fff" />
              <Text style={styles.addBtnText}>Add Service Style</Text>
            </TouchableOpacity>
            <LibraryManagementMenu
              libraryName="Service Styles"
              xlsxSheetName="Service Styles"
              onParseImport={(content, _fmt) => handleParseImport(content)}
              onConfirmImport={handleConfirmImport}
              getExportData={getExportData}
              getTemplateData={getTemplateData}
            />
          </View>
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
                <Text style={[styles.colHeadText, { width: COL.name }]}>Service Style</Text>
                <Text style={[styles.colHeadText, { width: COL.supplier }]}>Supplier</Text>
                <Text style={[styles.colHeadText, { width: COL.margin }]}>Default Margin</Text>
                <Text style={[styles.colHeadText, { width: COL.qtyMode }]}>Quantity Mode</Text>
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
                    <Text style={[styles.cell, { width: COL.name }]} numberOfLines={1}>{row.name}</Text>
                    <Text style={[styles.cell, styles.cellSecondary, { width: COL.supplier }]} numberOfLines={1}>
                      {row.supplier || '—'}
                    </Text>
                    <Text style={[styles.cell, styles.cellMono, { width: COL.margin }]} numberOfLines={1}>
                      {row.defaultMargin || '—'}
                    </Text>
                    <Text style={[styles.cell, styles.cellSecondary, { width: COL.qtyMode }]} numberOfLines={1}>
                      {quantityModeLabel(row.quantityMode ?? '')}
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
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.light.tint, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  addBtnText: { fontSize: 11, fontWeight: '700' as const, color: '#fff' },
  hScroll: { backgroundColor: Colors.light.surface },
  colHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, backgroundColor: Colors.light.background, borderBottomWidth: 1, borderBottomColor: Colors.light.border },
  colHeadText: { fontSize: 9, fontWeight: '700' as const, color: Colors.light.textSecondary, letterSpacing: 0.4, textTransform: 'uppercase' as const, paddingRight: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.light.border },
  rowDisabled: { opacity: 0.5 },
  cell: { fontSize: 13, color: Colors.light.text, paddingRight: 8 },
  cellSecondary: { color: Colors.light.textSecondary },
  cellMono: { fontVariant: ['tabular-nums' as any] },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 20, justifyContent: 'center' },
  loadingText: { fontSize: 13, color: Colors.light.textSecondary },
  emptyRow: { padding: 24, alignItems: 'center' },
  emptyText: { fontSize: 13, color: Colors.light.textSecondary, textAlign: 'center' },
});
