import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Stack } from 'expo-router';
import { ChevronDown, ChevronRight, Check, X } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { apiFetch } from '@/lib/apiFetch';
import PageBackHeader from '@/components/PageBackHeader';

const BRAND   = Colors.light.tint;
const TEXT    = Colors.light.text;
const TLIGHT  = Colors.light.textSecondary;
const BORDER  = Colors.light.border;
const SURFACE = Colors.light.surface;
const BG      = Colors.light.background;

const SIDE_COLORS: Record<string, string> = {
  FRONT: '#2563EB', BACK: '#059669', LEFT: '#D97706', RIGHT: '#DC2626',
};
const PLACEMENT_LABELS: Record<string, string> = {
  LEFT_CHEST: 'Left Chest', FULL_FRONT: 'Full Front', FULL_BACK: 'Full Back',
  YOKE: 'Yoke', SLEEVE_LEFT: 'Sleeve L', SLEEVE_RIGHT: 'Sleeve R',
};

interface TemplatePlacement {
  id: string;
  templateId: string;
  placementType: string;
  side: string;
  label: string | null;
  x: number; y: number; width: number; height: number;
  defaultArtworkWidth: number | null;
  defaultArtworkHeight: number | null;
  maxArtworkWidth: number | null;
  maxArtworkHeight: number | null;
  isActive: boolean;
  sortOrder: number;
}

interface TemplateData {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isActive: boolean;
  placements: TemplatePlacement[];
}

type EditState = {
  label: string;
  x: string; y: string; width: string; height: string;
  defaultArtworkWidth: string; defaultArtworkHeight: string;
  maxArtworkWidth: string; maxArtworkHeight: string;
};

function numStr(v: number | null | undefined): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

function toNum(s: string): number | null {
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function PlacementRow({
  placement,
  templateKey,
  onSaved,
}: {
  placement: TemplatePlacement;
  templateKey: string;
  onSaved: (updated: TemplatePlacement) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [form, setForm] = useState<EditState>({
    label: placement.label ?? '',
    x: numStr(placement.x), y: numStr(placement.y),
    width: numStr(placement.width), height: numStr(placement.height),
    defaultArtworkWidth: numStr(placement.defaultArtworkWidth),
    defaultArtworkHeight: numStr(placement.defaultArtworkHeight),
    maxArtworkWidth: numStr(placement.maxArtworkWidth),
    maxArtworkHeight: numStr(placement.maxArtworkHeight),
  });

  const upd = (k: keyof EditState, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    const x = toNum(form.x); const y = toNum(form.y);
    const width = toNum(form.width); const height = toNum(form.height);
    if (x === null || y === null || width === null || height === null) {
      setErr('x, y, width, height must be valid numbers.');
      return;
    }
    if (x < 0 || x > 1 || y < 0 || y > 1 || width <= 0 || width > 1 || height <= 0 || height > 1) {
      setErr('Zone coordinates must be in range 0–1.');
      return;
    }
    setErr(''); setSaving(true);
    try {
      const data = await apiFetch(
        `/api/products/placement-templates/${templateKey}/placements/${placement.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            label: form.label.trim() || null,
            x, y, width, height,
            defaultArtworkWidth: toNum(form.defaultArtworkWidth),
            defaultArtworkHeight: toNum(form.defaultArtworkHeight),
            maxArtworkWidth: toNum(form.maxArtworkWidth),
            maxArtworkHeight: toNum(form.maxArtworkHeight),
          }),
        },
      );
      onSaved(data.placement as TemplatePlacement);
      setEditing(false);
    } catch (e: any) {
      setErr(e.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const sideColor = SIDE_COLORS[placement.side] ?? '#6B7280';

  if (!editing) {
    return (
      <View style={r.row}>
        <View style={r.rowLeft}>
          <Text style={r.ptLabel}>{PLACEMENT_LABELS[placement.placementType] ?? placement.placementType}</Text>
          <View style={[r.sideBadge, { backgroundColor: sideColor + '22', borderColor: sideColor }]}>
            <Text style={[r.sideBadgeText, { color: sideColor }]}>{placement.side}</Text>
          </View>
        </View>
        <View style={r.rowMid}>
          <Text style={r.coordText}>
            {placement.label ? `"${placement.label}"  ` : ''}
            x {placement.x.toFixed(3)}  y {placement.y.toFixed(3)}  {placement.width.toFixed(3)}×{placement.height.toFixed(3)}
          </Text>
          {(placement.defaultArtworkWidth != null) && (
            <Text style={r.dimText}>
              def {placement.defaultArtworkWidth}"×{placement.defaultArtworkHeight}"
              {placement.maxArtworkWidth != null ? `  max ${placement.maxArtworkWidth}"×${placement.maxArtworkHeight}"` : ''}
            </Text>
          )}
        </View>
        <TouchableOpacity style={r.editBtn} onPress={() => setEditing(true)}>
          <Text style={r.editBtnText}>Edit</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={r.editBox}>
      {!!err && <Text style={r.errText}>{err}</Text>}

      <View style={r.editRowHeader}>
        <Text style={r.ptLabel}>{PLACEMENT_LABELS[placement.placementType] ?? placement.placementType}</Text>
        <View style={[r.sideBadge, { backgroundColor: sideColor + '22', borderColor: sideColor }]}>
          <Text style={[r.sideBadgeText, { color: sideColor }]}>{placement.side}</Text>
        </View>
      </View>

      <Text style={r.fieldLabel}>Label</Text>
      <TextInput style={r.input} value={form.label} onChangeText={v => upd('label', v)}
        placeholder="e.g. Left Chest" placeholderTextColor="#9CA3AF" />

      <Text style={r.fieldLabel}>Zone coordinates (0–1 fractions)</Text>
      <View style={r.fourCol}>
        {(['x', 'y', 'width', 'height'] as const).map(k => (
          <View key={k} style={r.numField}>
            <Text style={r.numLabel}>{k}</Text>
            <TextInput
              style={r.numInput}
              value={form[k]}
              onChangeText={v => upd(k, v)}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor="#9CA3AF"
            />
          </View>
        ))}
      </View>

      <Text style={r.fieldLabel}>Default artwork size (inches)</Text>
      <View style={r.twoCol}>
        <View style={r.numField}>
          <Text style={r.numLabel}>W"</Text>
          <TextInput style={r.numInput} value={form.defaultArtworkWidth}
            onChangeText={v => upd('defaultArtworkWidth', v)}
            keyboardType="decimal-pad" placeholder="—" placeholderTextColor="#9CA3AF" />
        </View>
        <View style={r.numField}>
          <Text style={r.numLabel}>H"</Text>
          <TextInput style={r.numInput} value={form.defaultArtworkHeight}
            onChangeText={v => upd('defaultArtworkHeight', v)}
            keyboardType="decimal-pad" placeholder="—" placeholderTextColor="#9CA3AF" />
        </View>
      </View>

      <Text style={r.fieldLabel}>Max artwork size (inches)</Text>
      <View style={r.twoCol}>
        <View style={r.numField}>
          <Text style={r.numLabel}>W"</Text>
          <TextInput style={r.numInput} value={form.maxArtworkWidth}
            onChangeText={v => upd('maxArtworkWidth', v)}
            keyboardType="decimal-pad" placeholder="—" placeholderTextColor="#9CA3AF" />
        </View>
        <View style={r.numField}>
          <Text style={r.numLabel}>H"</Text>
          <TextInput style={r.numInput} value={form.maxArtworkHeight}
            onChangeText={v => upd('maxArtworkHeight', v)}
            keyboardType="decimal-pad" placeholder="—" placeholderTextColor="#9CA3AF" />
        </View>
      </View>

      <View style={r.editActions}>
        <TouchableOpacity style={r.cancelBtn} onPress={() => { setEditing(false); setErr(''); }}>
          <X size={14} color={TLIGHT} />
          <Text style={r.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[r.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" size="small" /> : (
            <>
              <Check size={14} color="#fff" />
              <Text style={r.saveBtnText}>Save</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function TemplateCard({ template, onPlacementSaved }: {
  template: TemplateData;
  onPlacementSaved: (templateId: string, updated: TemplatePlacement) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={c.card}>
      <TouchableOpacity style={c.cardHeader} onPress={() => setExpanded(e => !e)} activeOpacity={0.7}>
        <View style={c.cardHeaderLeft}>
          <View style={c.keyBadge}>
            <Text style={c.keyBadgeText}>{template.key}</Text>
          </View>
          <View>
            <Text style={c.cardName}>{template.name}</Text>
            {!!template.description && (
              <Text style={c.cardDesc} numberOfLines={1}>{template.description}</Text>
            )}
          </View>
        </View>
        <View style={c.cardHeaderRight}>
          <Text style={c.placementCount}>{template.placements.length} placements</Text>
          {expanded ? <ChevronDown size={16} color={TLIGHT} /> : <ChevronRight size={16} color={TLIGHT} />}
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={c.placements}>
          {template.placements.length === 0 ? (
            <Text style={c.emptyText}>No placements defined.</Text>
          ) : (
            template.placements.map(p => (
              <PlacementRow
                key={p.id}
                placement={p}
                templateKey={template.key}
                onSaved={updated => onPlacementSaved(template.id, updated)}
              />
            ))
          )}
        </View>
      )}
    </View>
  );
}

export default function PlacementTemplatesScreen() {
  const [templates, setTemplates] = useState<TemplateData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await apiFetch('/api/products/placement-templates');
      setTemplates((data.templates ?? []) as TemplateData[]);
    } catch (e: any) {
      setLoadError(e.message || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handlePlacementSaved = (templateId: string, updated: TemplatePlacement) => {
    setTemplates(prev => prev.map(t => {
      if (t.id !== templateId) return t;
      return { ...t, placements: t.placements.map(p => p.id === updated.id ? updated : p) };
    }));
  };

  return (
    <View style={s.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <PageBackHeader title="Placement Templates" />

      {loading ? (
        <View style={s.centerBox}>
          <ActivityIndicator color={BRAND} size="large" />
        </View>
      ) : !!loadError ? (
        <View style={s.centerBox}>
          <Text style={s.errorText}>{loadError}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={load}>
            <Text style={s.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={s.hint}>
            Templates define default placement zones and artwork dimensions for garment types.
            Products inherit these placements when a template is assigned.
            Product-level overrides always take priority over template values.
          </Text>
          {templates.map(t => (
            <TemplateCard
              key={t.key}
              template={t}
              onPlacementSaved={handlePlacementSaved}
            />
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: BG },
  centerBox:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText:    { fontSize: 14, color: '#DC2626', textAlign: 'center', marginBottom: 12 },
  retryBtn:     { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6, backgroundColor: BRAND },
  retryText:    { fontSize: 13, color: '#fff', fontWeight: '600' },
  scroll:       { flex: 1 },
  scrollContent:{ padding: 16, gap: 12 },
  hint: {
    fontSize: 13, color: TLIGHT, lineHeight: 18,
    backgroundColor: SURFACE, borderRadius: 8,
    borderWidth: 1, borderColor: BORDER,
    padding: 12, marginBottom: 4,
  },
});

const c = StyleSheet.create({
  card: {
    backgroundColor: SURFACE, borderRadius: 10,
    borderWidth: 1, borderColor: BORDER,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14, gap: 10,
  },
  cardHeaderLeft:  { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  cardHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  keyBadge: {
    backgroundColor: BRAND + '18', borderColor: BRAND,
    borderWidth: 1, borderRadius: 5,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  keyBadgeText: { fontSize: 10, fontWeight: '700', color: BRAND, letterSpacing: 0.4 },
  cardName:  { fontSize: 14, fontWeight: '600', color: TEXT },
  cardDesc:  { fontSize: 12, color: TLIGHT, marginTop: 1 },
  placementCount: { fontSize: 12, color: TLIGHT },
  placements: {
    borderTopWidth: 1, borderTopColor: BORDER,
  },
  emptyText: { fontSize: 13, color: TLIGHT, padding: 16, textAlign: 'center' },
});

const r = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: BORDER,
    gap: 10,
  },
  rowLeft:  { flexDirection: 'row', alignItems: 'center', gap: 6, width: 130 },
  rowMid:   { flex: 1 },
  ptLabel:  { fontSize: 12, fontWeight: '600', color: TEXT },
  sideBadge: {
    borderWidth: 1, borderRadius: 4,
    paddingHorizontal: 5, paddingVertical: 1,
  },
  sideBadgeText: { fontSize: 10, fontWeight: '600' },
  coordText: { fontSize: 11, color: TEXT, fontFamily: 'monospace' },
  dimText:   { fontSize: 11, color: TLIGHT, marginTop: 2 },
  editBtn: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 5, borderWidth: 1, borderColor: BRAND,
  },
  editBtnText: { fontSize: 12, color: BRAND, fontWeight: '500' },

  editBox: {
    padding: 14, borderBottomWidth: 1, borderBottomColor: BORDER,
    backgroundColor: '#F9FAFB',
  },
  editRowHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  errText: { fontSize: 12, color: '#DC2626', marginBottom: 8 },
  fieldLabel: { fontSize: 11, fontWeight: '600', color: TLIGHT, marginBottom: 4, marginTop: 10 },
  input: {
    height: 34, borderWidth: 1, borderColor: BORDER, borderRadius: 6,
    paddingHorizontal: 10, fontSize: 13, color: TEXT, backgroundColor: '#fff',
  },
  fourCol: { flexDirection: 'row', gap: 8 },
  twoCol:  { flexDirection: 'row', gap: 8 },
  numField: { flex: 1 },
  numLabel: { fontSize: 10, color: TLIGHT, marginBottom: 2 },
  numInput: {
    height: 32, borderWidth: 1, borderColor: BORDER, borderRadius: 5,
    paddingHorizontal: 8, fontSize: 12, color: TEXT, backgroundColor: '#fff',
    textAlign: 'center',
  },
  editActions: { flexDirection: 'row', gap: 8, marginTop: 12, justifyContent: 'flex-end' },
  cancelBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 6, borderWidth: 1, borderColor: BORDER,
  },
  cancelBtnText: { fontSize: 12, color: TLIGHT },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 6, backgroundColor: BRAND,
    minWidth: 72, justifyContent: 'center',
  },
  saveBtnText: { fontSize: 12, color: '#fff', fontWeight: '600' },
});
