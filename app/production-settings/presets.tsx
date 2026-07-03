'use client';
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, ChevronDown, ChevronRight, X, Pencil, Archive, Trash2, Search } from 'lucide-react-native';
import PageBackHeader from '@/components/PageBackHeader';
import OverlayMenu from '@/components/OverlayMenu';
import Colors from '@/constants/colors';

const BRAND      = Colors.light.tint;
const TEXT       = Colors.light.text;
const TEXT_LIGHT = Colors.light.textSecondary;
const BORDER     = Colors.light.border;
const BG         = Colors.light.background;
const SURFACE    = Colors.light.surface;
const ERROR      = Colors.light.error;

const SERVICE_TYPES = [
  'DTF',
  'Screen Printing',
  'Embroidery',
  'Promotional',
  'Engraving',
] as const;
type ServiceType = typeof SERVICE_TYPES[number];

type StatusFilter = 'All' | 'Active' | 'Archived';

interface Preset {
  id: string;
  name: string;
  serviceType: string;
  suggestedSellPrice: string | number | null;
  status: string;
  maxWidth: string | number | null;
  maxHeight: string | number | null;
  defaultLocation: string | null;
  defaultLocations: string | null;
  defaultColorCount: number | null;
  suggestedStitchRange: string | null;
  notes: string | null;
  sortOrder: number;
}

interface FormState {
  name: string;
  serviceType: string;
  suggestedSellPrice: string;
  status: string;
  maxWidth: string;
  maxHeight: string;
  defaultLocation: string;
  defaultLocations: string;
  defaultColorCount: string;
  suggestedStitchRange: string;
  notes: string;
}

function emptyForm(serviceType: string = 'DTF'): FormState {
  return {
    name: '',
    serviceType,
    suggestedSellPrice: '',
    status: 'Active',
    maxWidth: '',
    maxHeight: '',
    defaultLocation: '',
    defaultLocations: '',
    defaultColorCount: '',
    suggestedStitchRange: '',
    notes: '',
  };
}

function presetToForm(p: Preset): FormState {
  const price = p.suggestedSellPrice != null
    ? parseFloat(String(p.suggestedSellPrice)).toFixed(2)
    : '';
  return {
    name: p.name,
    serviceType: p.serviceType,
    suggestedSellPrice: price,
    status: p.status,
    maxWidth: p.maxWidth != null ? String(parseFloat(String(p.maxWidth))) : '',
    maxHeight: p.maxHeight != null ? String(parseFloat(String(p.maxHeight))) : '',
    defaultLocation: p.defaultLocation ?? '',
    defaultLocations: p.defaultLocations ?? '',
    defaultColorCount: p.defaultColorCount != null ? String(p.defaultColorCount) : '',
    suggestedStitchRange: p.suggestedStitchRange ?? '',
    notes: p.notes ?? '',
  };
}

function fmtPrice(val: string | number | null): string {
  if (val == null || val === '') return '—';
  const n = parseFloat(String(val));
  return isFinite(n) ? `$${n.toFixed(2)}` : '—';
}

function fmtDim(val: string | number | null): string {
  if (val == null || val === '') return '—';
  const n = parseFloat(String(val));
  return isFinite(n) ? `${n}"` : '—';
}

function StatusBadge({ status }: { status: string }) {
  const active = status === 'Active';
  return (
    <View style={[pv.badge, active ? pv.badgeActive : pv.badgeArchived]}>
      <Text style={[pv.badgeText, active ? pv.badgeTextActive : pv.badgeTextArchived]}>
        {status}
      </Text>
    </View>
  );
}

function ColHead({ label, width, right }: { label: string; width: number; right?: boolean }) {
  return (
    <Text style={[pv.thText, { width }, right && { textAlign: 'right' as const }]}>
      {label}
    </Text>
  );
}

function Cell({ value, width, muted }: { value: string; width: number; muted?: boolean }) {
  return (
    <Text
      style={[pv.tdText, { width }, muted && { color: TEXT_LIGHT }]}
      numberOfLines={1}
    >
      {value}
    </Text>
  );
}

interface PresetRowProps {
  preset: Preset;
  onEdit: (p: Preset) => void;
  onArchiveToggle: (p: Preset) => void;
  onDelete: (id: string) => void;
}

function DtfRow({ preset, onEdit, onArchiveToggle, onDelete }: PresetRowProps) {
  return (
    <View style={pv.tableRow}>
      <Cell value={preset.name} width={170} />
      <Cell value={fmtPrice(preset.suggestedSellPrice)} width={90} />
      <Cell value={fmtDim(preset.maxWidth)} width={72} muted={!preset.maxWidth} />
      <Cell value={fmtDim(preset.maxHeight)} width={72} muted={!preset.maxHeight} />
      <Cell value={preset.defaultLocation ?? '—'} width={130} muted={!preset.defaultLocation} />
      <StatusBadge status={preset.status} />
      <RowActions preset={preset} onEdit={onEdit} onArchiveToggle={onArchiveToggle} onDelete={onDelete} />
    </View>
  );
}

function SpRow({ preset, onEdit, onArchiveToggle, onDelete }: PresetRowProps) {
  return (
    <View style={pv.tableRow}>
      <Cell value={preset.name} width={170} />
      <Cell value={fmtPrice(preset.suggestedSellPrice)} width={90} />
      <Cell value={preset.defaultLocations ?? '—'} width={150} muted={!preset.defaultLocations} />
      <Cell value={preset.defaultColorCount != null ? `${preset.defaultColorCount} color${preset.defaultColorCount !== 1 ? 's' : ''}` : '—'} width={80} muted={preset.defaultColorCount == null} />
      <StatusBadge status={preset.status} />
      <RowActions preset={preset} onEdit={onEdit} onArchiveToggle={onArchiveToggle} onDelete={onDelete} />
    </View>
  );
}

function EmbRow({ preset, onEdit, onArchiveToggle, onDelete }: PresetRowProps) {
  return (
    <View style={pv.tableRow}>
      <Cell value={preset.name} width={170} />
      <Cell value={fmtPrice(preset.suggestedSellPrice)} width={90} />
      <Cell value={preset.suggestedStitchRange ?? '—'} width={120} muted={!preset.suggestedStitchRange} />
      <Cell value={preset.defaultLocation ?? '—'} width={130} muted={!preset.defaultLocation} />
      <StatusBadge status={preset.status} />
      <RowActions preset={preset} onEdit={onEdit} onArchiveToggle={onArchiveToggle} onDelete={onDelete} />
    </View>
  );
}

function GenericRow({ preset, onEdit, onArchiveToggle, onDelete }: PresetRowProps) {
  return (
    <View style={pv.tableRow}>
      <Cell value={preset.name} width={210} />
      <Cell value={fmtPrice(preset.suggestedSellPrice)} width={90} />
      <Cell value={preset.notes ?? '—'} width={200} muted={!preset.notes} />
      <StatusBadge status={preset.status} />
      <RowActions preset={preset} onEdit={onEdit} onArchiveToggle={onArchiveToggle} onDelete={onDelete} />
    </View>
  );
}

function RowActions({ preset, onEdit, onArchiveToggle, onDelete }: PresetRowProps) {
  return (
    <OverlayMenu
      menuWidth={168}
      align="right"
      trigger={({ open }) => (
        <TouchableOpacity onPress={open} style={pv.moreBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={pv.moreDots}>•••</Text>
        </TouchableOpacity>
      )}
    >
      {({ close }) => (
        <>
          <TouchableOpacity
            style={pv.menuItem}
            onPress={() => { close(); onEdit(preset); }}
          >
            <Pencil size={14} color={TEXT} />
            <Text style={pv.menuItemText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={pv.menuItem}
            onPress={() => { close(); onArchiveToggle(preset); }}
          >
            <Archive size={14} color={TEXT} />
            <Text style={pv.menuItemText}>
              {preset.status === 'Active' ? 'Archive' : 'Restore'}
            </Text>
          </TouchableOpacity>
          <View style={pv.menuDivider} />
          <TouchableOpacity
            style={pv.menuItem}
            onPress={() => { close(); onDelete(preset.id); }}
          >
            <Trash2 size={14} color={ERROR} />
            <Text style={[pv.menuItemText, { color: ERROR }]}>Delete</Text>
          </TouchableOpacity>
        </>
      )}
    </OverlayMenu>
  );
}

function DtfHeaders() {
  return (
    <View style={pv.tableHead}>
      <ColHead label="PRESET NAME"      width={170} />
      <ColHead label="SELL PRICE"       width={90} />
      <ColHead label="MAX W"            width={72} />
      <ColHead label="MAX H"            width={72} />
      <ColHead label="DEF. LOCATION"    width={130} />
      <ColHead label="STATUS"           width={80} />
      <View style={{ width: 36 }} />
    </View>
  );
}

function SpHeaders() {
  return (
    <View style={pv.tableHead}>
      <ColHead label="PRESET NAME"      width={170} />
      <ColHead label="SELL PRICE"       width={90} />
      <ColHead label="DEF. LOCATIONS"   width={150} />
      <ColHead label="COLORS"           width={80} />
      <ColHead label="STATUS"           width={80} />
      <View style={{ width: 36 }} />
    </View>
  );
}

function EmbHeaders() {
  return (
    <View style={pv.tableHead}>
      <ColHead label="PRESET NAME"      width={170} />
      <ColHead label="SELL PRICE"       width={90} />
      <ColHead label="STITCH RANGE"     width={120} />
      <ColHead label="DEF. LOCATION"    width={130} />
      <ColHead label="STATUS"           width={80} />
      <View style={{ width: 36 }} />
    </View>
  );
}

function GenericHeaders() {
  return (
    <View style={pv.tableHead}>
      <ColHead label="PRESET NAME"      width={210} />
      <ColHead label="SELL PRICE"       width={90} />
      <ColHead label="NOTES"            width={200} />
      <ColHead label="STATUS"           width={80} />
      <View style={{ width: 36 }} />
    </View>
  );
}

function renderHeaders(type: string) {
  if (type === 'DTF')             return <DtfHeaders />;
  if (type === 'Screen Printing') return <SpHeaders />;
  if (type === 'Embroidery')      return <EmbHeaders />;
  return <GenericHeaders />;
}

function renderRow(preset: Preset, handlers: Omit<PresetRowProps, 'preset'>) {
  const props = { preset, ...handlers };
  if (preset.serviceType === 'DTF')             return <DtfRow     key={preset.id} {...props} />;
  if (preset.serviceType === 'Screen Printing') return <SpRow      key={preset.id} {...props} />;
  if (preset.serviceType === 'Embroidery')      return <EmbRow     key={preset.id} {...props} />;
  return <GenericRow key={preset.id} {...props} />;
}

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  editingPreset: Preset | null;
  defaultServiceType: string;
  onSaved: () => void;
}

function PresetModal({ visible, onClose, editingPreset, defaultServiceType, onSaved }: ModalProps) {
  const queryClient = useQueryClient();
  const isEdit = editingPreset != null;

  const [form, setForm] = useState<FormState>(() =>
    isEdit ? presetToForm(editingPreset!) : emptyForm(defaultServiceType),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (visible) {
      setForm(isEdit ? presetToForm(editingPreset!) : emptyForm(defaultServiceType));
      setError('');
      setSaving(false);
    }
  }, [visible, isEdit, editingPreset, defaultServiceType]);

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Preset name is required.'); return; }
    setSaving(true);
    setError('');
    const body = {
      name: form.name.trim(),
      serviceType: form.serviceType,
      suggestedSellPrice: form.suggestedSellPrice !== '' ? parseFloat(form.suggestedSellPrice) : null,
      status: form.status,
      maxWidth:          form.maxWidth          !== '' ? parseFloat(form.maxWidth)          : null,
      maxHeight:         form.maxHeight         !== '' ? parseFloat(form.maxHeight)         : null,
      defaultLocation:   form.defaultLocation   || null,
      defaultLocations:  form.defaultLocations  || null,
      defaultColorCount: form.defaultColorCount !== '' ? parseInt(form.defaultColorCount, 10) : null,
      suggestedStitchRange: form.suggestedStitchRange || null,
      notes: form.notes || null,
    };
    try {
      const url  = isEdit ? `/api/production-presets/${editingPreset!.id}` : '/api/production-presets';
      const method = isEdit ? 'PATCH' : 'POST';
      const res  = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) {
        const j = await res.json().catch(() => ({})) as Record<string, string>;
        throw new Error(j.error || 'Save failed');
      }
      queryClient.invalidateQueries({ queryKey: ['production-presets'] });
      onSaved();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const showDtf = form.serviceType === 'DTF';
  const showSp  = form.serviceType === 'Screen Printing';
  const showEmb = form.serviceType === 'Embroidery';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={m.overlay}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={m.avoidWrap}>
          <View style={m.sheet}>
            <View style={m.header}>
              <Text style={m.headerTitle}>
                {isEdit ? `Edit "${editingPreset!.name}"` : `Add ${form.serviceType} Preset`}
              </Text>
              <TouchableOpacity onPress={onClose} style={m.closeBtn}>
                <X size={18} color={TEXT_LIGHT} />
              </TouchableOpacity>
            </View>

            <ScrollView style={m.body} contentContainerStyle={m.bodyContent} keyboardShouldPersistTaps="handled">
              {!isEdit && (
                <View style={m.fieldGroup}>
                  <Text style={m.fieldLabel}>Service Type</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={m.chipRow}>
                    {SERVICE_TYPES.map((t) => (
                      <TouchableOpacity
                        key={t}
                        style={[m.chip, form.serviceType === t && m.chipActive]}
                        onPress={() => set('serviceType', t)}
                        activeOpacity={0.8}
                      >
                        <Text style={[m.chipText, form.serviceType === t && m.chipTextActive]}>{t}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              <View style={m.fieldGroup}>
                <Text style={m.fieldLabel}>Preset Name <Text style={m.required}>*</Text></Text>
                <TextInput
                  style={m.textInput}
                  value={form.name}
                  onChangeText={(v) => set('name', v)}
                  placeholder="e.g. Left Chest Standard"
                  placeholderTextColor={TEXT_LIGHT}
                />
              </View>

              <View style={m.fieldGroup}>
                <Text style={m.fieldLabel}>Suggested Sell Price</Text>
                <View style={m.prefixWrap}>
                  <Text style={m.prefix}>$</Text>
                  <TextInput
                    style={[m.textInput, m.textInputFlex]}
                    value={form.suggestedSellPrice}
                    onChangeText={(v) => set('suggestedSellPrice', v.replace(/[^0-9.]/g, ''))}
                    placeholder="0.00"
                    placeholderTextColor={TEXT_LIGHT}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              {showDtf && (
                <>
                  <View style={m.row2}>
                    <View style={[m.fieldGroup, { flex: 1 }]}>
                      <Text style={m.fieldLabel}>Max Width</Text>
                      <View style={m.suffixWrap}>
                        <TextInput
                          style={[m.textInput, m.textInputFlex]}
                          value={form.maxWidth}
                          onChangeText={(v) => set('maxWidth', v.replace(/[^0-9.]/g, ''))}
                          placeholder="0"
                          placeholderTextColor={TEXT_LIGHT}
                          keyboardType="decimal-pad"
                        />
                        <Text style={m.suffix}>"</Text>
                      </View>
                    </View>
                    <View style={[m.fieldGroup, { flex: 1 }]}>
                      <Text style={m.fieldLabel}>Max Height</Text>
                      <View style={m.suffixWrap}>
                        <TextInput
                          style={[m.textInput, m.textInputFlex]}
                          value={form.maxHeight}
                          onChangeText={(v) => set('maxHeight', v.replace(/[^0-9.]/g, ''))}
                          placeholder="0"
                          placeholderTextColor={TEXT_LIGHT}
                          keyboardType="decimal-pad"
                        />
                        <Text style={m.suffix}>"</Text>
                      </View>
                    </View>
                  </View>
                  <View style={m.fieldGroup}>
                    <Text style={m.fieldLabel}>Default Location</Text>
                    <TextInput
                      style={m.textInput}
                      value={form.defaultLocation}
                      onChangeText={(v) => set('defaultLocation', v)}
                      placeholder="e.g. Left Chest, Center Chest"
                      placeholderTextColor={TEXT_LIGHT}
                    />
                  </View>
                </>
              )}

              {showSp && (
                <>
                  <View style={m.fieldGroup}>
                    <Text style={m.fieldLabel}>Default Locations</Text>
                    <TextInput
                      style={m.textInput}
                      value={form.defaultLocations}
                      onChangeText={(v) => set('defaultLocations', v)}
                      placeholder="e.g. Front, Front + Back"
                      placeholderTextColor={TEXT_LIGHT}
                    />
                  </View>
                  <View style={m.fieldGroup}>
                    <Text style={m.fieldLabel}>Default Color Count</Text>
                    <TextInput
                      style={m.textInput}
                      value={form.defaultColorCount}
                      onChangeText={(v) => set('defaultColorCount', v.replace(/[^0-9]/g, ''))}
                      placeholder="1"
                      placeholderTextColor={TEXT_LIGHT}
                      keyboardType="number-pad"
                    />
                  </View>
                </>
              )}

              {showEmb && (
                <>
                  <View style={m.fieldGroup}>
                    <Text style={m.fieldLabel}>Suggested Stitch Range</Text>
                    <TextInput
                      style={m.textInput}
                      value={form.suggestedStitchRange}
                      onChangeText={(v) => set('suggestedStitchRange', v)}
                      placeholder="e.g. 4000–6000"
                      placeholderTextColor={TEXT_LIGHT}
                    />
                  </View>
                  <View style={m.fieldGroup}>
                    <Text style={m.fieldLabel}>Default Location</Text>
                    <TextInput
                      style={m.textInput}
                      value={form.defaultLocation}
                      onChangeText={(v) => set('defaultLocation', v)}
                      placeholder="e.g. Left Chest"
                      placeholderTextColor={TEXT_LIGHT}
                    />
                  </View>
                </>
              )}

              <View style={m.fieldGroup}>
                <Text style={m.fieldLabel}>Notes</Text>
                <TextInput
                  style={[m.textInput, m.textArea]}
                  value={form.notes}
                  onChangeText={(v) => set('notes', v)}
                  placeholder="Optional notes…"
                  placeholderTextColor={TEXT_LIGHT}
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={m.fieldGroup}>
                <Text style={m.fieldLabel}>Status</Text>
                <View style={m.segRow}>
                  {(['Active', 'Archived'] as const).map((opt) => (
                    <TouchableOpacity
                      key={opt}
                      style={[m.seg, form.status === opt && m.segActive]}
                      onPress={() => set('status', opt)}
                      activeOpacity={0.8}
                    >
                      <Text style={[m.segText, form.status === opt && m.segTextActive]}>{opt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {error ? <Text style={m.errorText}>{error}</Text> : null}
            </ScrollView>

            <View style={m.footer}>
              <TouchableOpacity style={m.cancelBtn} onPress={onClose} activeOpacity={0.8}>
                <Text style={m.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[m.saveBtn, saving && m.saveBtnDisabled]}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={m.saveText}>{isEdit ? 'Save Changes' : 'Add Preset'}</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

export default function PricingPresetsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{ presets: Preset[] }>({
    queryKey: ['production-presets'],
    queryFn: async () => {
      const r = await fetch('/api/production-presets');
      if (!r.ok) throw new Error('Failed to load');
      return r.json() as Promise<{ presets: Preset[] }>;
    },
    networkMode: 'always',
    staleTime: 30_000,
  });

  const allPresets = data?.presets ?? [];

  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [collapsed,    setCollapsed]    = useState<Partial<Record<string, boolean>>>({});
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPreset,    setEditingPreset]    = useState<Preset | null>(null);
  const [modalServiceType, setModalServiceType] = useState<string>('DTF');

  const filtered = allPresets.filter((p) => {
    if (statusFilter !== 'All' && p.status !== statusFilter) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const toggleCollapse = useCallback((type: string) => {
    setCollapsed((prev) => ({ ...prev, [type]: !prev[type] }));
  }, []);

  const openAdd = useCallback((type: string) => {
    setEditingPreset(null);
    setModalServiceType(type);
    setModalVisible(true);
  }, []);

  const openEdit = useCallback((p: Preset) => {
    setEditingPreset(p);
    setModalServiceType(p.serviceType);
    setModalVisible(true);
  }, []);

  const archiveToggle = useCallback(async (p: Preset) => {
    const newStatus = p.status === 'Active' ? 'Archived' : 'Active';
    try {
      await fetch(`/api/production-presets/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      queryClient.invalidateQueries({ queryKey: ['production-presets'] });
    } catch (e) {
      console.error('Archive toggle failed', e);
    }
  }, [queryClient]);

  const deletePreset = useCallback(async (id: string) => {
    try {
      await fetch(`/api/production-presets/${id}`, { method: 'DELETE' });
      queryClient.invalidateQueries({ queryKey: ['production-presets'] });
    } catch (e) {
      console.error('Delete failed', e);
    }
  }, [queryClient]);

  const rowHandlers = { onEdit: openEdit, onArchiveToggle: archiveToggle, onDelete: deletePreset };

  return (
    <View style={pv.screen}>
      <PageBackHeader title="Production Pricing Presets" />

      <View style={pv.topBar}>
        <View style={pv.searchWrap}>
          <Search size={14} color={TEXT_LIGHT} />
          <TextInput
            style={pv.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search presets…"
            placeholderTextColor={TEXT_LIGHT}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <X size={14} color={TEXT_LIGHT} />
            </TouchableOpacity>
          )}
        </View>

        <View style={pv.filterRow}>
          {(['All', 'Active', 'Archived'] as StatusFilter[]).map((f) => (
            <TouchableOpacity
              key={f}
              style={[pv.filterChip, statusFilter === f && pv.filterChipActive]}
              onPress={() => setStatusFilter(f)}
              activeOpacity={0.8}
            >
              <Text style={[pv.filterChipText, statusFilter === f && pv.filterChipTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {isLoading ? (
        <View style={pv.loadingWrap}>
          <ActivityIndicator size="small" color={BRAND} />
        </View>
      ) : (
        <ScrollView style={pv.body} contentContainerStyle={pv.bodyContent}>
          {SERVICE_TYPES.map((type) => {
            const groupPresets = filtered.filter((p) => p.serviceType === type);
            const isCollapsed  = collapsed[type] ?? false;
            const totalInGroup = allPresets.filter((p) => p.serviceType === type).length;

            return (
              <View key={type} style={pv.group}>
                <View style={pv.groupHeader}>
                  <TouchableOpacity
                    onPress={() => toggleCollapse(type)}
                    style={pv.groupToggle}
                    activeOpacity={0.8}
                  >
                    {isCollapsed
                      ? <ChevronRight size={16} color={TEXT_LIGHT} />
                      : <ChevronDown  size={16} color={TEXT_LIGHT} />
                    }
                    <Text style={pv.groupTitle}>{type}</Text>
                    <View style={pv.countBadge}>
                      <Text style={pv.countBadgeText}>{totalInGroup}</Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={pv.addBtn}
                    onPress={() => openAdd(type)}
                    activeOpacity={0.85}
                  >
                    <Plus size={12} color="#fff" />
                    <Text style={pv.addBtnText}>Add</Text>
                  </TouchableOpacity>
                </View>

                {!isCollapsed && (
                  <View style={pv.groupContent}>
                    {groupPresets.length === 0 ? (
                      <View style={pv.emptyRow}>
                        <Text style={pv.emptyText}>
                          {search || statusFilter !== 'All'
                            ? 'No presets match the current filter.'
                            : `No ${type} presets yet. Click Add to create one.`}
                        </Text>
                      </View>
                    ) : (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View>
                          {renderHeaders(type)}
                          {groupPresets.map((p) => renderRow(p, rowHandlers))}
                        </View>
                      </ScrollView>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      <PresetModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        editingPreset={editingPreset}
        defaultServiceType={modalServiceType}
        onSaved={() => {}}
      />
    </View>
  );
}

const pv = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: BG },
  body:    { flex: 1 },
  bodyContent: { paddingHorizontal: 20, paddingVertical: 16, paddingBottom: 48 },

  topBar: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10, gap: 10 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: BORDER, borderRadius: 8,
    backgroundColor: SURFACE, paddingHorizontal: 10, height: 38,
  },
  searchInput: { flex: 1, fontSize: 13, color: TEXT, paddingVertical: 0 },
  filterRow:  { flexDirection: 'row', gap: 6 },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14,
    borderWidth: 1, borderColor: BORDER, backgroundColor: SURFACE,
  },
  filterChipActive: { backgroundColor: BRAND, borderColor: BRAND },
  filterChipText:   { fontSize: 12, fontWeight: '600' as const, color: TEXT_LIGHT },
  filterChipTextActive: { color: '#fff' },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  group: { marginBottom: 12 },
  groupHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER,
    borderRadius: 8, paddingLeft: 10, paddingRight: 10, height: 44,
  },
  groupToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  groupTitle:  { fontSize: 13, fontWeight: '700' as const, color: TEXT },
  countBadge: {
    backgroundColor: BG, borderWidth: 1, borderColor: BORDER,
    borderRadius: 10, paddingHorizontal: 7, paddingVertical: 1,
  },
  countBadgeText: { fontSize: 11, fontWeight: '600' as const, color: TEXT_LIGHT },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: BRAND, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6,
  },
  addBtnText: { fontSize: 11, fontWeight: '700' as const, color: '#fff' },

  groupContent: {
    borderWidth: 1, borderTopWidth: 0, borderColor: BORDER,
    borderBottomLeftRadius: 8, borderBottomRightRadius: 8,
    backgroundColor: SURFACE, overflow: 'hidden',
  },

  tableHead: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 7,
    backgroundColor: BG, borderBottomWidth: 1, borderBottomColor: BORDER,
    gap: 8,
  },
  thText: { fontSize: 9, fontWeight: '700' as const, color: TEXT_LIGHT, letterSpacing: 0.4, textTransform: 'uppercase' as const },

  tableRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: BORDER,
    gap: 8,
  },
  tdText: { fontSize: 13, color: TEXT },

  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeActive:       { backgroundColor: '#D1FAE5' },
  badgeArchived:     { backgroundColor: BG, borderWidth: 1, borderColor: BORDER },
  badgeText:         { fontSize: 11, fontWeight: '600' as const },
  badgeTextActive:   { color: '#065F46' },
  badgeTextArchived: { color: TEXT_LIGHT },

  moreBtn:  { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  moreDots: { fontSize: 12, color: TEXT_LIGHT, letterSpacing: 1 },

  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  menuItemText: { fontSize: 13, color: TEXT },
  menuDivider: { height: 1, backgroundColor: BORDER, marginVertical: 2 },

  emptyRow:  { padding: 20, alignItems: 'center' },
  emptyText: { fontSize: 13, color: TEXT_LIGHT },
});

const m = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
    padding: 20,
  },
  avoidWrap: { width: '100%', maxWidth: 520 },
  sheet: {
    backgroundColor: '#fff', borderRadius: 12,
    maxHeight: '90%', overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18, shadowRadius: 24, elevation: 16,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  headerTitle: { fontSize: 16, fontWeight: '700' as const, color: TEXT },
  closeBtn: { padding: 4 },

  body: { maxHeight: 480 },
  bodyContent: { padding: 20, gap: 14 },

  fieldGroup: { gap: 6 },
  fieldLabel: { fontSize: 12, fontWeight: '600' as const, color: TEXT_LIGHT },
  required:   { color: ERROR },

  textInput: {
    borderWidth: 1, borderColor: BORDER, borderRadius: 8,
    paddingHorizontal: 12, height: 40, fontSize: 13, color: TEXT,
    backgroundColor: SURFACE,
  },
  textInputFlex: { flex: 1 },
  textArea: { height: 80, textAlignVertical: 'top' as const, paddingTop: 10 },

  prefixWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  suffixWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  prefix: { fontSize: 14, fontWeight: '600' as const, color: TEXT_LIGHT },
  suffix: { fontSize: 14, fontWeight: '600' as const, color: TEXT_LIGHT },

  row2: { flexDirection: 'row', gap: 12 },

  chipRow: { flexDirection: 'row', gap: 6, paddingBottom: 2 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14,
    borderWidth: 1, borderColor: BORDER, backgroundColor: SURFACE,
  },
  chipActive:     { backgroundColor: BRAND, borderColor: BRAND },
  chipText:       { fontSize: 12, fontWeight: '600' as const, color: TEXT_LIGHT },
  chipTextActive: { color: '#fff' },

  segRow: { flexDirection: 'row', gap: 6 },
  seg: {
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: 8,
    borderWidth: 1, borderColor: BORDER, backgroundColor: SURFACE,
  },
  segActive:     { backgroundColor: BRAND, borderColor: BRAND },
  segText:       { fontSize: 13, fontWeight: '600' as const, color: TEXT_LIGHT },
  segTextActive: { color: '#fff' },

  errorText: { fontSize: 13, color: ERROR },

  footer: {
    flexDirection: 'row', gap: 10, justifyContent: 'flex-end',
    padding: 16, borderTopWidth: 1, borderTopColor: BORDER,
  },
  cancelBtn: {
    paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8,
    borderWidth: 1, borderColor: BORDER, backgroundColor: SURFACE,
  },
  cancelText: { fontSize: 13, fontWeight: '600' as const, color: TEXT },
  saveBtn: {
    paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8,
    backgroundColor: BRAND, minWidth: 100, alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveText: { fontSize: 13, fontWeight: '700' as const, color: '#fff' },
});
