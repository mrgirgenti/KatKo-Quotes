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
import { Plus, Pencil, Trash2, ChevronDown, X } from 'lucide-react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Colors from '@/constants/colors';
import OverlayMenu from '@/components/OverlayMenu';
import LibraryManagementMenu, {
  type ImportMode,
  type LibraryImportPreview,
} from '@/components/LibraryManagementMenu';

// ── Types ─────────────────────────────────────────────────────────────────────

export type CostCategory = 'production' | 'other';

export interface CostLibraryEntry {
  id: string;
  name: string;
  category: CostCategory;
  calcType: string;
  defaultRate: string;
  appliesTo?: string;
  scope?: string;
  enabled: boolean;
  associatedService?: string;
  notes?: string;
  sortOrder?: number;
}

export interface CostLibraryTableProps {
  category: CostCategory;
  title: string;
  addLabel: string;
  namePlaceholder?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const CALC_TYPES = [
  { value: 'flat', label: 'Flat Rate' },
  { value: 'percentage', label: 'Percentage' },
  { value: 'per_design', label: 'Per Design' },
  { value: 'hourly', label: 'Hourly' },
  { value: 'per_unit', label: 'Per Unit' },
  { value: 'per_color', label: 'Per Color' },
  { value: 'custom', label: 'Custom / Range' },
] as const;

const APPLIES_TO_OPTIONS = [
  { value: '', label: '—' },
  { value: 'per_piece', label: 'Per Piece' },
  { value: 'per_design', label: 'Per Design' },
  { value: 'per_order', label: 'Per Order' },
  { value: 'per_color', label: 'Per Color' },
  { value: 'per_location', label: 'Per Location' },
];

const SCOPE_OPTIONS = [
  { value: '', label: '—' },
  { value: 'per_order', label: 'Per Order' },
  { value: 'per_piece', label: 'Per Piece' },
  { value: 'per_line', label: 'Per Line Item' },
];

const COST_CATEGORIES = [
  { value: 'production' as const, label: 'Production' },
  { value: 'other' as const, label: 'Other' },
];

const VALID_CALC_TYPES = CALC_TYPES.map((t) => t.value as string);
const VALID_CATEGORIES: CostCategory[] = ['production', 'other'];

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcTypeLabel(type: string): string {
  return CALC_TYPES.find((t) => t.value === type)?.label ?? type;
}

function appliesToLabel(val: string): string {
  return (APPLIES_TO_OPTIONS.find((o) => o.value === val)?.label ?? val) || '—';
}

function scopeLabel(val: string): string {
  return (SCOPE_OPTIONS.find((o) => o.value === val)?.label ?? val) || '—';
}

function emptyEntry(category: CostCategory): Omit<CostLibraryEntry, 'id'> {
  return {
    name: '',
    category,
    calcType: 'flat',
    defaultRate: '',
    appliesTo: '',
    scope: '',
    enabled: true,
    associatedService: '',
    notes: '',
    sortOrder: 0,
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CategoryBadge({ category }: { category: CostCategory }) {
  const isProd = category === 'production';
  return (
    <View style={[bdg.pill, isProd ? bdg.prod : bdg.other]}>
      <Text style={[bdg.text, isProd ? bdg.prodText : bdg.otherText]}>
        {isProd ? 'Production' : 'Other'}
      </Text>
    </View>
  );
}

const bdg = StyleSheet.create({
  pill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, alignSelf: 'flex-start' },
  prod: { backgroundColor: '#EEF2FF' },
  other: { backgroundColor: '#F0FDF4' },
  text: { fontSize: 10, fontWeight: '600' as const },
  prodText: { color: '#4338CA' },
  otherText: { color: '#16A34A' },
});

function Toggle({
  on,
  onToggle,
}: {
  on: boolean;
  onToggle: () => void;
}) {
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

// ── Edit Drawer ───────────────────────────────────────────────────────────────

interface DrawerProps {
  visible: boolean;
  entry: CostLibraryEntry | null;
  defaultCategory: CostCategory;
  isSaving: boolean;
  isDeleting: boolean;
  onSave: (data: Omit<CostLibraryEntry, 'id'> & { id?: string }) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

function CostEntryDrawer({
  visible,
  entry,
  defaultCategory,
  isSaving,
  isDeleting,
  onSave,
  onDelete,
  onClose,
}: DrawerProps) {
  const isNew = entry === null;

  const [form, setForm] = useState<Omit<CostLibraryEntry, 'id'>>(() =>
    entry ? { ...entry } : emptyEntry(defaultCategory),
  );

  useEffect(() => {
    setForm(entry ? { ...entry } : emptyEntry(defaultCategory));
  }, [entry, defaultCategory, visible]);

  const set = useCallback(<K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [k]: v }));
  }, []);

  function handleSave() {
    if (!form.name.trim()) return;
    onSave({ ...form, ...(entry ? { id: entry.id } : {}) });
  }

  const isProduction = form.category === 'production';
  const appFieldOptions = isProduction ? APPLIES_TO_OPTIONS : SCOPE_OPTIONS;
  const appFieldValue = isProduction ? (form.appliesTo ?? '') : (form.scope ?? '');
  const appFieldLabel = isProduction
    ? appliesToLabel(form.appliesTo ?? '')
    : scopeLabel(form.scope ?? '');

  function setAppField(v: string) {
    if (isProduction) set('appliesTo', v);
    else set('scope', v);
  }

  return (
    <Modal visible={visible} transparent animationType="none">
      <View style={dr.modalRoot}>
        <TouchableOpacity style={dr.backdrop} onPress={onClose} activeOpacity={1} />
        <View style={dr.panel}>
          <View style={dr.panelHeader}>
            <Text style={dr.panelTitle}>{isNew ? 'New Cost Entry' : 'Edit Cost Entry'}</Text>
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
                  placeholder="e.g. Screen Print Setup"
                  placeholderTextColor={Colors.light.textSecondary}
                />
              </View>

              <View style={dr.fieldRow}>
                <Text style={dr.fieldLabel}>Category</Text>
                <DrawerDropdown
                  value={form.category}
                  label={form.category === 'production' ? 'Production' : 'Other'}
                  options={COST_CATEGORIES}
                  onSelect={(v) => set('category', v)}
                />
              </View>

              <View style={[dr.fieldRow, dr.noBorder]}>
                <Text style={dr.fieldLabel}>Calc Type</Text>
                <DrawerDropdown
                  value={form.calcType as any}
                  label={calcTypeLabel(form.calcType)}
                  options={CALC_TYPES as any}
                  onSelect={(v) => set('calcType', v)}
                />
              </View>
            </View>

            {/* Rate & Application */}
            <Text style={dr.sectionLabel}>Rate & Application</Text>
            <View style={dr.sectionCard}>
              <View style={dr.fieldRow}>
                <Text style={dr.fieldLabel}>Default Rate</Text>
                <TextInput
                  style={dr.textInput}
                  value={form.defaultRate}
                  onChangeText={(t) => set('defaultRate', t)}
                  placeholder="e.g. $25, 15%, $20-200"
                  placeholderTextColor={Colors.light.textSecondary}
                />
              </View>
              <View style={[dr.fieldRow, dr.noBorder]}>
                <Text style={dr.fieldLabel}>{isProduction ? 'Applies To' : 'Scope'}</Text>
                <DrawerDropdown
                  value={appFieldValue as any}
                  label={appFieldLabel}
                  options={appFieldOptions as any}
                  onSelect={setAppField}
                />
              </View>
            </View>

            {/* Classification */}
            <Text style={dr.sectionLabel}>Classification</Text>
            <View style={dr.sectionCard}>
              <View style={dr.fieldRow}>
                <Text style={dr.fieldLabel}>Associated Service</Text>
                <TextInput
                  style={dr.textInput}
                  value={form.associatedService ?? ''}
                  onChangeText={(t) => set('associatedService', t)}
                  placeholder="e.g. Screen Print"
                  placeholderTextColor={Colors.light.textSecondary}
                />
              </View>
              <View style={[dr.fieldRow, dr.noBorder]}>
                <Text style={dr.fieldLabel}>Notes</Text>
              </View>
              <TextInput
                style={[dr.textInput, dr.textarea, { margin: 0, borderTopWidth: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0, maxWidth: '100%' }]}
                value={form.notes ?? ''}
                onChangeText={(t) => set('notes', t)}
                placeholder="Optional notes…"
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
              <TouchableOpacity
                style={dr.deleteBtn}
                onPress={() => entry && onDelete(entry.id)}
                disabled={isDeleting}
                activeOpacity={0.8}
              >
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
  textarea: { height: 80, textAlignVertical: 'top' as const, paddingTop: 8 },
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

// ── Table columns ─────────────────────────────────────────────────────────────

const COL = {
  name: 180,
  category: 100,
  calc: 120,
  rate: 120,
  appField: 130,
  enabled: 80,
  service: 150,
  notes: 150,
  actions: 70,
} as const;

const TABLE_MIN_WIDTH = Object.values(COL).reduce((a, b) => a + b, 0) + 24;

// ── Main Component ────────────────────────────────────────────────────────────

export function CostLibraryTable({
  category,
  title,
  addLabel,
}: CostLibraryTableProps) {
  const queryClient = useQueryClient();
  const queryKey = ['cost-library', category];

  const { data: rows = [], isLoading } = useQuery<CostLibraryEntry[]>({
    queryKey,
    queryFn: async () => {
      const r = await fetch(`/api/cost-library?category=${category}`);
      if (!r.ok) throw new Error('Failed to load cost library');
      return r.json();
    },
    networkMode: 'always',
    staleTime: 30_000,
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['cost-library'] });
  }, [queryClient]);

  const createMutation = useMutation({
    mutationFn: async (data: Omit<CostLibraryEntry, 'id'>) => {
      const r = await fetch('/api/cost-library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error('Failed to create');
      return r.json();
    },
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<CostLibraryEntry> & { id: string }) => {
      const r = await fetch(`/api/cost-library/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!r.ok) throw new Error('Failed to update');
      return r.json();
    },
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/cost-library/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('Failed to delete');
    },
    onSuccess: invalidate,
  });

  const [drawerEntry, setDrawerEntry] = useState<CostLibraryEntry | null | undefined>(undefined);
  const drawerVisible = drawerEntry !== undefined;

  async function handleSave(data: Omit<CostLibraryEntry, 'id'> & { id?: string }) {
    if (data.id) {
      const { id, ...patch } = data;
      await updateMutation.mutateAsync({ id, ...patch });
    } else {
      await createMutation.mutateAsync(data as Omit<CostLibraryEntry, 'id'>);
    }
    setDrawerEntry(undefined);
  }

  async function handleDelete(id: string) {
    await deleteMutation.mutateAsync(id);
    setDrawerEntry(undefined);
  }

  // ── Import / Export / Template ──────────────────────────────────────────────

  const isProduction = category === 'production';
  const APP_FIELD_HEADER = isProduction ? 'appliesTo' : 'scope';
  const CSV_HEADERS = ['name', 'category', 'calcType', 'defaultRate', APP_FIELD_HEADER, 'enabled', 'associatedService', 'notes'] as const;

  function handleParseImport(content: string): LibraryImportPreview {
    const rawRows = parseCsvText(content) as Record<string, unknown>[];
    const errors: string[] = [];
    const validRows: Omit<CostLibraryEntry, 'id'>[] = [];
    let invalidCount = 0;

    rawRows.forEach((raw, idx) => {
      const rowNum = idx + 2;
      const rowErrors: string[] = [];
      const name = String(raw.name ?? '').trim();
      if (!name) rowErrors.push(`Row ${rowNum}: "name" is required`);

      const cat = String(raw.category ?? category).trim() as CostCategory;
      const resolvedCat: CostCategory = VALID_CATEGORIES.includes(cat) ? cat : category;

      const calcType = String(raw.calcType ?? 'flat').trim();
      if (calcType && !VALID_CALC_TYPES.includes(calcType)) {
        rowErrors.push(`Row ${rowNum}: unknown calcType "${calcType}"`);
      }

      if (rowErrors.length > 0) {
        if (errors.length < 10) errors.push(...rowErrors);
        invalidCount++;
        return;
      }

      validRows.push({
        name,
        category: resolvedCat,
        calcType: VALID_CALC_TYPES.includes(calcType) ? calcType : 'flat',
        defaultRate: String(raw.defaultRate ?? '').trim(),
        appliesTo: String(raw.appliesTo ?? '').trim() || undefined,
        scope: String(raw.scope ?? '').trim() || undefined,
        enabled: parseBool(raw.enabled ?? 'true'),
        associatedService: String(raw.associatedService ?? '').trim() || undefined,
        notes: String(raw.notes ?? '').trim() || undefined,
        sortOrder: parseInt(String(raw.sortOrder ?? 0)) || 0,
      });
    });

    const existingNames = new Set(rows.map(r => r.name.toLowerCase()));
    const duplicateCount = validRows.filter(r => existingNames.has(r.name.toLowerCase())).length;
    return { validCount: validRows.length, invalidCount, duplicateCount, errors, rows: validRows };
  }

  async function handleConfirmImport(importRows: unknown[], mode: ImportMode) {
    const typedRows = importRows as Omit<CostLibraryEntry, 'id'>[];
    const existingByName = new Map(rows.map(r => [r.name.toLowerCase(), r.id]));

    for (const row of typedRows) {
      const existingId = existingByName.get(row.name.toLowerCase());
      if (mode === 'skip' && existingId) continue;
      if (mode === 'replace' && existingId) {
        await fetch(`/api/cost-library/${existingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(row),
        });
      } else {
        await fetch('/api/cost-library', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(row),
        });
      }
    }
    invalidate();
  }

  function getExportData(format: 'csv' | 'json'): string {
    const exportRows = rows.map(({ id: _id, sortOrder: _so, ...rest }) => rest);
    if (format === 'json') return JSON.stringify(exportRows, null, 2);
    return serializeToCsv(exportRows as Record<string, unknown>[], CSV_HEADERS);
  }

  function getTemplateData(): string {
    const example: Record<string, unknown> = {
      name: 'Screen Print Setup',
      category,
      calcType: 'flat',
      defaultRate: '$25',
      [APP_FIELD_HEADER]: isProduction ? 'per_order' : 'per_order',
      enabled: true,
      associatedService: 'Screen Printing',
      notes: 'Example entry',
    };
    return serializeToCsv([example], CSV_HEADERS);
  }

  const appFieldHeader = isProduction ? 'Applies To' : 'Scope';

  return (
    <>
      <View style={styles.section}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{title}</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.addBtn} onPress={() => setDrawerEntry(null)} activeOpacity={0.85}>
              <Plus size={12} color="#fff" />
              <Text style={styles.addBtnText}>{addLabel}</Text>
            </TouchableOpacity>
            <LibraryManagementMenu
              libraryName={title}
              xlsxSheetName={title}
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
            <View style={{ minWidth: TABLE_MIN_WIDTH }}>
              <View style={styles.colHead}>
                <Text style={[styles.colHeadText, { width: COL.name }]}>Name</Text>
                <Text style={[styles.colHeadText, { width: COL.category }]}>Category</Text>
                <Text style={[styles.colHeadText, { width: COL.calc }]}>Calc Type</Text>
                <Text style={[styles.colHeadText, { width: COL.rate }]}>Default Rate</Text>
                <Text style={[styles.colHeadText, { width: COL.appField }]}>{appFieldHeader}</Text>
                <Text style={[styles.colHeadText, { width: COL.enabled, textAlign: 'center' }]}>Enabled</Text>
                <Text style={[styles.colHeadText, { width: COL.service }]}>Assoc. Service</Text>
                <Text style={[styles.colHeadText, { width: COL.notes }]}>Notes</Text>
                <Text style={[styles.colHeadText, { width: COL.actions, textAlign: 'center' }]}>Actions</Text>
              </View>

              {rows.length === 0 ? (
                <View style={styles.emptyRow}>
                  <Text style={styles.emptyText}>No entries yet — click "{addLabel}" to add one.</Text>
                </View>
              ) : (
                rows.map((row) => (
                  <View key={row.id} style={[styles.row, !row.enabled && styles.rowDisabled]}>
                    <Text style={[styles.cell, { width: COL.name }]} numberOfLines={1}>{row.name}</Text>
                    <View style={{ width: COL.category }}>
                      <CategoryBadge category={row.category} />
                    </View>
                    <Text style={[styles.cell, { width: COL.calc }]} numberOfLines={1}>
                      {calcTypeLabel(row.calcType)}
                    </Text>
                    <Text style={[styles.cell, styles.cellMono, { width: COL.rate }]} numberOfLines={1}>
                      {row.defaultRate || '—'}
                    </Text>
                    <Text style={[styles.cell, { width: COL.appField }]} numberOfLines={1}>
                      {isProduction ? appliesToLabel(row.appliesTo ?? '') : scopeLabel(row.scope ?? '')}
                    </Text>
                    <View style={{ width: COL.enabled, alignItems: 'center' }}>
                      <Toggle on={row.enabled} onToggle={() => updateMutation.mutate({ id: row.id, enabled: !row.enabled })} />
                    </View>
                    <Text style={[styles.cell, styles.cellSecondary, { width: COL.service }]} numberOfLines={1}>
                      {row.associatedService || '—'}
                    </Text>
                    <Text style={[styles.cell, styles.cellSecondary, { width: COL.notes }]} numberOfLines={1}>
                      {row.notes || '—'}
                    </Text>
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

      <CostEntryDrawer
        visible={drawerVisible}
        entry={drawerEntry ?? null}
        defaultCategory={category}
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
