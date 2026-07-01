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
import { Plus, Pencil, Trash2, ChevronDown, X, AlertTriangle } from 'lucide-react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Colors from '@/constants/colors';
import OverlayMenu from '@/components/OverlayMenu';
import LibraryManagementMenu, {
  type ImportMode,
  type LibraryImportPreview,
} from '@/components/LibraryManagementMenu';
import { ADJUSTMENT_CALC_TYPES, type AdjustmentCalcType } from '@/types/quote';

// ── Types ─────────────────────────────────────────────────────────────────────

export type CostCategory = 'production' | 'other';
export type CostScope = 'per_piece' | 'per_line' | 'per_order';

export const COST_SCOPES: { value: CostScope; label: string }[] = [
  { value: 'per_piece', label: 'Per Piece' },
  { value: 'per_line', label: 'Per Line Item' },
  { value: 'per_order', label: 'Per Order' },
];

export const COST_CATEGORIES: { value: CostCategory; label: string }[] = [
  { value: 'production', label: 'Production' },
  { value: 'other', label: 'Other' },
];

// ── CSV helpers ───────────────────────────────────────────────────────────────

const COST_LIBRARY_CSV_HEADERS = [
  'name', 'category', 'calculationType', 'rate', 'minimum',
  'increment', 'scope', 'taxable', 'enabled', 'description',
] as const;

const VALID_COST_CATEGORIES: CostCategory[] = ['production', 'other'];
const VALID_CALC_TYPES = ['flat', 'hourly', 'per_unit', 'per_design', 'percentage', 'custom'];
const VALID_COST_SCOPES: CostScope[] = ['per_piece', 'per_line', 'per_order'];

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

function parseBoolField(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  const s = String(v ?? '').toLowerCase();
  return s === 'true' || s === '1' || s === 'yes';
}

export interface CostLibraryEntry {
  id: string;
  name: string;
  category: CostCategory;
  calculationType: AdjustmentCalcType;
  rate: number;
  minimum: number;
  increment: number;
  scope: CostScope;
  taxable: boolean;
  enabled: boolean;
  description?: string;
  sortOrder?: number;
}

export interface CostLibraryTableProps {
  category: CostCategory;
  title: string;
  addLabel: string;
  namePlaceholder?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcTypeLabel(type: AdjustmentCalcType): string {
  return ADJUSTMENT_CALC_TYPES.find((t) => t.value === type)?.label ?? 'Flat Rate';
}

function scopeLabel(scope: CostScope): string {
  return COST_SCOPES.find((s) => s.value === scope)?.label ?? 'Per Piece';
}

function categoryLabel(cat: CostCategory): string {
  return cat === 'production' ? 'Production' : 'Other';
}

function formatRate(entry: CostLibraryEntry): string {
  switch (entry.calculationType) {
    case 'percentage':
      return `${entry.rate}%`;
    case 'hourly':
      return `$${entry.rate.toFixed(2)}/hr`;
    case 'per_unit':
      return `$${entry.rate.toFixed(2)}/unit`;
    default:
      return `$${entry.rate.toFixed(2)}`;
  }
}

function emptyEntry(category: CostCategory): Omit<CostLibraryEntry, 'id'> {
  return {
    name: '',
    category,
    calculationType: 'flat',
    rate: 0,
    minimum: 0,
    increment: 0,
    scope: 'per_order',
    taxable: true,
    enabled: true,
    description: '',
    sortOrder: 0,
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CategoryBadge({ category }: { category: CostCategory }) {
  const isProduction = category === 'production';
  return (
    <View style={[badge.pill, isProduction ? badge.production : badge.other]}>
      <Text style={[badge.text, isProduction ? badge.productionText : badge.otherText]}>
        {categoryLabel(category)}
      </Text>
    </View>
  );
}

const badge = StyleSheet.create({
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  production: { backgroundColor: '#EEF2FF' },
  other: { backgroundColor: '#F0FDF4' },
  text: { fontSize: 11, fontWeight: '600' as const },
  productionText: { color: '#4338CA' },
  otherText: { color: '#16A34A' },
});

function Toggle({
  on,
  onToggle,
  onLabel = 'On',
  offLabel = 'Off',
}: {
  on: boolean;
  onToggle: () => void;
  onLabel?: string;
  offLabel?: string;
}) {
  return (
    <TouchableOpacity
      style={[tog.base, on ? tog.on : tog.off]}
      onPress={onToggle}
      activeOpacity={0.8}
    >
      <Text style={[tog.text, on ? tog.textOn : tog.textOff]}>{on ? onLabel : offLabel}</Text>
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
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: Colors.light.border, borderRadius: 6, paddingHorizontal: 10, height: 38, backgroundColor: Colors.light.surface },
  text: { fontSize: 13, color: Colors.light.text, flex: 1 },
  item: { paddingHorizontal: 14, paddingVertical: 10 },
  itemText: { fontSize: 13, color: Colors.light.text },
  itemActive: { color: Colors.light.tint, fontWeight: '600' as const },
});

function DrawerNumInput({
  value,
  onChange,
  prefix,
  suffix,
  placeholder = '0',
}: {
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
  suffix?: string;
  placeholder?: string;
}) {
  return (
    <View style={dni.wrap}>
      {prefix ? <Text style={dni.affix}>{prefix}</Text> : null}
      <TextInput
        style={dni.input}
        value={value ? String(value) : ''}
        onChangeText={(t) => {
          const n = parseFloat(t.replace(/[^0-9.]/g, ''));
          onChange(Number.isFinite(n) ? n : 0);
        }}
        keyboardType="decimal-pad"
        placeholder={placeholder}
        placeholderTextColor={Colors.light.textSecondary}
      />
      {suffix ? <Text style={dni.affix}>{suffix}</Text> : null}
    </View>
  );
}

const dni = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: Colors.light.border, borderRadius: 6, paddingHorizontal: 10, height: 38, backgroundColor: Colors.light.surface },
  input: { flex: 1, fontSize: 13, color: Colors.light.text, paddingVertical: 0 },
  affix: { fontSize: 12, color: Colors.light.textSecondary, marginHorizontal: 2 },
});

// ── Category Confirmation Dialog ──────────────────────────────────────────────

interface CategoryConfirmProps {
  visible: boolean;
  fromCategory: CostCategory;
  toCategory: CostCategory;
  onCancel: () => void;
  onConfirm: () => void;
}

function CategoryConfirmDialog({
  visible,
  fromCategory,
  toCategory,
  onCancel,
  onConfirm,
}: CategoryConfirmProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={cd.overlay}>
        <View style={cd.box}>
          <View style={cd.iconRow}>
            <AlertTriangle size={22} color="#B45309" />
            <Text style={cd.title}>Changing Cost Category</Text>
          </View>
          <Text style={cd.body}>
            This item is currently classified as:
          </Text>
          <Text style={cd.highlight}>{categoryLabel(fromCategory)}</Text>
          <Text style={cd.body}>Changing it to:</Text>
          <Text style={cd.highlight}>{categoryLabel(toCategory)}</Text>
          <Text style={cd.body}>may affect:</Text>
          <Text style={cd.bullets}>
            {'• Existing Quotes\n• Pricing Calculations\n• Reporting\n• Financial History\n• Future Quotes'}
          </Text>
          <Text style={cd.warning}>
            Only continue if this item was originally created incorrectly.
          </Text>
          <View style={cd.btnRow}>
            <TouchableOpacity style={cd.cancelBtn} onPress={onCancel} activeOpacity={0.8}>
              <Text style={cd.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={cd.confirmBtn} onPress={onConfirm} activeOpacity={0.8}>
              <Text style={cd.confirmText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const cd = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  box: { backgroundColor: '#fff', borderRadius: 12, padding: 24, width: '100%', maxWidth: 420, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12 },
  iconRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '700' as const, color: Colors.light.text },
  body: { fontSize: 13, color: Colors.light.textSecondary, marginTop: 6 },
  highlight: { fontSize: 14, fontWeight: '700' as const, color: Colors.light.text, marginTop: 2 },
  bullets: { fontSize: 13, color: Colors.light.textSecondary, marginTop: 6, lineHeight: 22 },
  warning: { fontSize: 12, color: '#B45309', backgroundColor: '#FFFBEB', borderRadius: 6, padding: 10, marginTop: 12, lineHeight: 18 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 20, justifyContent: 'flex-end' },
  cancelBtn: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 7, borderWidth: 1, borderColor: Colors.light.border },
  cancelText: { fontSize: 13, color: Colors.light.text, fontWeight: '600' as const },
  confirmBtn: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 7, backgroundColor: Colors.light.tint },
  confirmText: { fontSize: 13, color: '#fff', fontWeight: '700' as const },
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
  const [pendingCategory, setPendingCategory] = useState<CostCategory | null>(null);
  const [showCatConfirm, setShowCatConfirm] = useState(false);

  useEffect(() => {
    setForm(entry ? { ...entry } : emptyEntry(defaultCategory));
    setPendingCategory(null);
    setShowCatConfirm(false);
  }, [entry, defaultCategory, visible]);

  const set = useCallback(<K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [k]: v }));
  }, []);

  function handleCategoryRequest(newCat: CostCategory) {
    if (newCat === form.category) return;
    if (!isNew) {
      setPendingCategory(newCat);
      setShowCatConfirm(true);
    } else {
      set('category', newCat);
    }
  }

  function confirmCategoryChange() {
    if (pendingCategory) set('category', pendingCategory);
    setPendingCategory(null);
    setShowCatConfirm(false);
  }

  function cancelCategoryChange() {
    setPendingCategory(null);
    setShowCatConfirm(false);
  }

  function handleSave() {
    if (!form.name.trim()) return;
    onSave({ ...form, ...(entry ? { id: entry.id } : {}) });
  }

  function handleDelete() {
    if (entry) onDelete(entry.id);
  }

  const ratePrefix = form.calculationType === 'percentage' ? undefined : '$';
  const rateSuffix = form.calculationType === 'percentage' ? '%' : form.calculationType === 'hourly' ? '/hr' : undefined;

  return (
    <>
      <Modal visible={visible} transparent animationType="none">
        <View style={dr.modalRoot}>
          <TouchableOpacity style={dr.backdrop} onPress={onClose} activeOpacity={1} />
          <View style={dr.panel}>
            {/* Header */}
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
                    label={categoryLabel(form.category)}
                    options={COST_CATEGORIES}
                    onSelect={handleCategoryRequest}
                  />
                </View>

                <View style={[dr.fieldRow, dr.noBorder]}>
                  <Text style={dr.fieldLabel}>Calculation Type</Text>
                  <DrawerDropdown
                    value={form.calculationType}
                    label={calcTypeLabel(form.calculationType)}
                    options={ADJUSTMENT_CALC_TYPES}
                    onSelect={(v) => set('calculationType', v)}
                  />
                </View>
              </View>

              {/* Pricing */}
              <Text style={dr.sectionLabel}>Pricing</Text>
              <View style={dr.sectionCard}>
                <View style={dr.fieldRow}>
                  <Text style={dr.fieldLabel}>Default Rate</Text>
                  <View style={dr.numFieldWrap}>
                    <DrawerNumInput
                      value={form.rate}
                      onChange={(v) => set('rate', v)}
                      prefix={ratePrefix}
                      suffix={rateSuffix}
                    />
                  </View>
                </View>
                <View style={dr.fieldRow}>
                  <Text style={dr.fieldLabel}>Minimum</Text>
                  <View style={dr.numFieldWrap}>
                    <DrawerNumInput
                      value={form.minimum}
                      onChange={(v) => set('minimum', v)}
                      prefix="$"
                    />
                  </View>
                </View>
                <View style={[dr.fieldRow, dr.noBorder]}>
                  <Text style={dr.fieldLabel}>Increment</Text>
                  <View style={dr.numFieldWrap}>
                    <DrawerNumInput
                      value={form.increment}
                      onChange={(v) => set('increment', v)}
                    />
                  </View>
                </View>
              </View>

              {/* Behavior */}
              <Text style={dr.sectionLabel}>Behavior</Text>
              <View style={dr.sectionCard}>
                <View style={dr.fieldRow}>
                  <Text style={dr.fieldLabel}>Scope</Text>
                  <DrawerDropdown
                    value={form.scope}
                    label={scopeLabel(form.scope)}
                    options={COST_SCOPES}
                    onSelect={(v) => set('scope', v)}
                  />
                </View>
                <View style={dr.fieldRow}>
                  <Text style={dr.fieldLabel}>Taxable</Text>
                  <Toggle
                    on={form.taxable}
                    onToggle={() => set('taxable', !form.taxable)}
                    onLabel="Yes"
                    offLabel="No"
                  />
                </View>
                <View style={dr.fieldRow}>
                  <Text style={dr.fieldLabel}>Enabled</Text>
                  <Toggle
                    on={form.enabled}
                    onToggle={() => set('enabled', !form.enabled)}
                  />
                </View>
                <View style={[dr.fieldRow, dr.noBorder]}>
                  <Text style={dr.fieldLabel}>Display Order</Text>
                  <View style={dr.numFieldWrap}>
                    <DrawerNumInput
                      value={form.sortOrder ?? 0}
                      onChange={(v) => set('sortOrder', v)}
                      placeholder="0"
                    />
                  </View>
                </View>
              </View>

              {/* Description */}
              <Text style={dr.sectionLabel}>Description</Text>
              <View style={dr.sectionCard}>
                <TextInput
                  style={[dr.textInput, dr.textarea]}
                  value={form.description ?? ''}
                  onChangeText={(t) => set('description', t)}
                  placeholder="Optional description..."
                  placeholderTextColor={Colors.light.textSecondary}
                  multiline
                  numberOfLines={3}
                />
              </View>
            </ScrollView>

            {/* Footer */}
            <View style={dr.footer}>
              {!isNew && (
                <TouchableOpacity
                  style={dr.deleteBtn}
                  onPress={handleDelete}
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

      <CategoryConfirmDialog
        visible={showCatConfirm}
        fromCategory={entry?.category ?? defaultCategory}
        toCategory={pendingCategory ?? defaultCategory}
        onCancel={cancelCategoryChange}
        onConfirm={confirmCategoryChange}
      />
    </>
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
  sectionLabel: { fontSize: 10, fontWeight: '700' as const, color: Colors.light.textSecondary, letterSpacing: 0.6, textTransform: 'uppercase' as const, marginBottom: 6, marginTop: 16 },
  sectionCard: { borderWidth: 1, borderColor: Colors.light.border, borderRadius: 8, backgroundColor: Colors.light.surface, overflow: 'hidden' },
  fieldRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.light.border, minHeight: 52 },
  noBorder: { borderBottomWidth: 0 },
  fieldLabel: { fontSize: 13, color: Colors.light.text, fontWeight: '500' as const, flex: 1 },
  textInput: { flex: 1, borderWidth: 1, borderColor: Colors.light.border, borderRadius: 6, paddingHorizontal: 10, height: 38, fontSize: 13, color: Colors.light.text, backgroundColor: Colors.light.surface, maxWidth: 220 },
  textarea: { height: 80, textAlignVertical: 'top' as const, paddingTop: 8, maxWidth: '100%' },
  numFieldWrap: { maxWidth: 140 },
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

// ── Table Columns ─────────────────────────────────────────────────────────────

const COL = {
  name: 200,
  category: 110,
  calc: 130,
  rate: 110,
  scope: 130,
  enabled: 80,
  actions: 80,
} as const;

const TABLE_MIN_WIDTH = Object.values(COL).reduce((a, b) => a + b, 0) + 24;

// ── Main Component ────────────────────────────────────────────────────────────

export function CostLibraryTable({
  category,
  title,
  addLabel,
  namePlaceholder = 'Name',
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

  // Drawer state
  const [drawerEntry, setDrawerEntry] = useState<CostLibraryEntry | null | undefined>(undefined);
  const drawerVisible = drawerEntry !== undefined;

  function openNew() {
    setDrawerEntry(null);
  }

  function openEdit(row: CostLibraryEntry) {
    setDrawerEntry(row);
  }

  function closeDrawer() {
    setDrawerEntry(undefined);
  }

  async function handleSave(data: Omit<CostLibraryEntry, 'id'> & { id?: string }) {
    if (data.id) {
      const { id, ...patch } = data;
      await updateMutation.mutateAsync({ id, ...patch });
    } else {
      await createMutation.mutateAsync(data as Omit<CostLibraryEntry, 'id'>);
    }
    closeDrawer();
  }

  async function handleDelete(id: string) {
    await deleteMutation.mutateAsync(id);
    closeDrawer();
  }

  function quickToggleEnabled(row: CostLibraryEntry) {
    updateMutation.mutate({ id: row.id, enabled: !row.enabled });
  }

  // ── Library management: import / export / template ──────────────────────────

  function handleParseImport(content: string, format: 'csv' | 'json'): LibraryImportPreview {
    let rawRows: Record<string, unknown>[] = [];
    const errors: string[] = [];

    if (format === 'json') {
      try {
        const parsed = JSON.parse(content);
        rawRows = Array.isArray(parsed) ? parsed : [];
      } catch {
        return { validCount: 0, invalidCount: 0, duplicateCount: 0, errors: ['Invalid JSON file.'], rows: [] };
      }
    } else {
      rawRows = parseCsvText(content) as Record<string, unknown>[];
    }

    const validRows: Omit<CostLibraryEntry, 'id'>[] = [];
    let invalidCount = 0;

    rawRows.forEach((raw, idx) => {
      const rowNum = idx + 2;
      const rowErrors: string[] = [];

      const name = String(raw.name ?? '').trim();
      if (!name) rowErrors.push(`Row ${rowNum}: "name" is required`);

      const cat = String(raw.category ?? category).trim() as CostCategory;
      const resolvedCat: CostCategory = VALID_COST_CATEGORIES.includes(cat) ? cat : category;

      const calcType = String(raw.calculationType ?? 'flat').trim();
      if (!VALID_CALC_TYPES.includes(calcType)) {
        rowErrors.push(`Row ${rowNum}: unknown calculationType "${calcType}"`);
      }

      const scope = String(raw.scope ?? 'per_order').trim();
      if (!VALID_COST_SCOPES.includes(scope as CostScope)) {
        rowErrors.push(`Row ${rowNum}: unknown scope "${scope}"`);
      }

      if (rowErrors.length > 0) {
        if (errors.length < 10) errors.push(...rowErrors);
        invalidCount++;
        return;
      }

      validRows.push({
        name,
        category: resolvedCat,
        calculationType: calcType as AdjustmentCalcType,
        rate: parseFloat(String(raw.rate ?? 0)) || 0,
        minimum: parseFloat(String(raw.minimum ?? 0)) || 0,
        increment: parseFloat(String(raw.increment ?? 0)) || 0,
        scope: scope as CostScope,
        taxable: parseBoolField(raw.taxable ?? 'true'),
        enabled: parseBoolField(raw.enabled ?? 'true'),
        description: String(raw.description ?? '').trim(),
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
    return serializeToCsv(exportRows as Record<string, unknown>[], COST_LIBRARY_CSV_HEADERS);
  }

  function getTemplateData(): string {
    const example = {
      name: 'Screen Print Setup',
      category,
      calculationType: 'flat',
      rate: 25,
      minimum: 0,
      increment: 0,
      scope: 'per_order',
      taxable: true,
      enabled: true,
      description: 'Example production cost',
    };
    return serializeToCsv([example] as Record<string, unknown>[], COST_LIBRARY_CSV_HEADERS);
  }

  return (
    <>
      <View style={styles.section}>
        {/* Table header bar */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{title}</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.addHdrBtn} onPress={openNew} activeOpacity={0.85}>
              <Plus size={12} color="#fff" />
              <Text style={styles.addHdrBtnText}>{addLabel}</Text>
            </TouchableOpacity>
            <LibraryManagementMenu
              libraryName={title}
              onParseImport={handleParseImport}
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
              {/* Column headings */}
              <View style={styles.colHead}>
                <Text style={[styles.colHeadText, { width: COL.name }]}>Name</Text>
                <Text style={[styles.colHeadText, { width: COL.category }]}>Category</Text>
                <Text style={[styles.colHeadText, { width: COL.calc }]}>Calc Type</Text>
                <Text style={[styles.colHeadText, { width: COL.rate }]}>Rate</Text>
                <Text style={[styles.colHeadText, { width: COL.scope }]}>Scope</Text>
                <Text style={[styles.colHeadText, { width: COL.enabled, textAlign: 'center' }]}>Enabled</Text>
                <Text style={[styles.colHeadText, { width: COL.actions, textAlign: 'center' }]}>Actions</Text>
              </View>

              {rows.length === 0 ? (
                <View style={styles.emptyRow}>
                  <Text style={styles.emptyText}>No entries yet — click "{addLabel}" to add one.</Text>
                </View>
              ) : (
                rows.map((row) => (
                  <View key={row.id} style={[styles.row, !row.enabled && styles.rowDisabled]}>
                    <Text style={[styles.cellText, { width: COL.name }]} numberOfLines={1}>{row.name}</Text>
                    <View style={{ width: COL.category }}>
                      <CategoryBadge category={row.category} />
                    </View>
                    <Text style={[styles.cellText, { width: COL.calc }]} numberOfLines={1}>
                      {calcTypeLabel(row.calculationType)}
                    </Text>
                    <Text style={[styles.cellText, styles.cellMono, { width: COL.rate }]}>
                      {formatRate(row)}
                    </Text>
                    <Text style={[styles.cellText, { width: COL.scope }]} numberOfLines={1}>
                      {scopeLabel(row.scope)}
                    </Text>
                    <View style={{ width: COL.enabled, alignItems: 'center' }}>
                      <Toggle on={row.enabled} onToggle={() => quickToggleEnabled(row)} />
                    </View>
                    <View style={{ width: COL.actions, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                      <TouchableOpacity
                        onPress={() => openEdit(row)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Pencil size={15} color={Colors.light.tint} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => deleteMutation.mutate(row.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
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
        onClose={closeDrawer}
      />
    </>
  );
}

const styles = StyleSheet.create({
  section: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    backgroundColor: Colors.light.surface,
    overflow: 'hidden',
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#000000',
    paddingHorizontal: 16,
    height: 36,
  },
  headerTitle: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#fff',
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
  },
  headerActions: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  addHdrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  addHdrBtnText: { fontSize: 11, fontWeight: '700' as const, color: '#fff' },
  hScroll: { backgroundColor: Colors.light.surface },
  colHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: Colors.light.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  colHeadText: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: Colors.light.textSecondary,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
    paddingRight: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  rowDisabled: { opacity: 0.5 },
  cellText: {
    fontSize: 13,
    color: Colors.light.text,
    paddingRight: 8,
  },
  cellMono: {
    fontVariant: ['tabular-nums' as any],
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 20,
    justifyContent: 'center',
  },
  loadingText: { fontSize: 13, color: Colors.light.textSecondary },
  emptyRow: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  menuItem: { paddingHorizontal: 14, paddingVertical: 10 },
  menuItemText: { fontSize: 13, color: Colors.light.text },
  menuItemActive: { color: Colors.light.tint, fontWeight: '600' as const },
});
