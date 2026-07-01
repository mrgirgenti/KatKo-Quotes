import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import {
  SlidersHorizontal,
  Tag,
  Factory,
  Receipt,
  Shapes,
  Percent,
  Plus,
  Trash2,
  Save,
} from 'lucide-react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Colors from '@/constants/colors';
import { CostLibraryTable } from '@/components/CostLibraryTable';
import { ServiceStylesTable } from '@/components/ServiceStylesTable';
import { ONLINE_FEE_PCT, ONLINE_FEE_FLAT, CARD_FEE_PCT, SALES_TAX_PCT } from '@/constants/fees';

const BRAND = Colors.light.tint;
const TEXT = Colors.light.text;
const TEXT_LIGHT = Colors.light.textSecondary;
const BORDER = Colors.light.border;
const BG = Colors.light.background;
const SURFACE = Colors.light.surface;
const ERROR = Colors.light.error;

type CostTab =
  | 'product_pricing'
  | 'production_library'
  | 'other_charges_library'
  | 'service_styles'
  | 'taxes_fees';

const TABS: { id: CostTab; label: string; Icon: typeof Tag }[] = [
  { id: 'product_pricing', label: 'Product Pricing', Icon: Tag },
  { id: 'production_library', label: 'Production Library', Icon: Factory },
  { id: 'other_charges_library', label: 'Other Charges Library', Icon: Receipt },
  { id: 'service_styles', label: 'Service Styles', Icon: Shapes },
  { id: 'taxes_fees', label: 'Taxes & Fees', Icon: Percent },
];

// ── Shared sub-components ─────────────────────────────────────────────────────

function SectionCard({ children }: { children: React.ReactNode }) {
  return <View style={sh.card}>{children}</View>;
}

function FieldRow({
  label,
  hint,
  children,
  last,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <View style={[sh.fieldRow, last && sh.fieldRowLast]}>
      <View style={sh.fieldLabelWrap}>
        <Text style={sh.fieldLabel}>{label}</Text>
        {hint ? <Text style={sh.fieldHint}>{hint}</Text> : null}
      </View>
      <View style={sh.fieldControl}>{children}</View>
    </View>
  );
}

function NumInput({
  value,
  onChange,
  prefix,
  suffix,
  placeholder = '0',
  width = 130,
}: {
  value: number | undefined | null;
  onChange: (v: number) => void;
  prefix?: string;
  suffix?: string;
  placeholder?: string;
  width?: number;
}) {
  return (
    <View style={[sh.numWrap, { width }]}>
      {prefix ? <Text style={sh.numAffix}>{prefix}</Text> : null}
      <TextInput
        style={sh.numInput}
        value={value != null && value !== 0 ? String(value) : ''}
        onChangeText={(t) => {
          const n = parseFloat(t.replace(/[^0-9.]/g, ''));
          onChange(Number.isFinite(n) ? n : 0);
        }}
        keyboardType="decimal-pad"
        placeholder={placeholder}
        placeholderTextColor={TEXT_LIGHT}
      />
      {suffix ? <Text style={sh.numAffix}>{suffix}</Text> : null}
    </View>
  );
}

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
      style={[sh.toggle, on ? sh.toggleOn : sh.toggleOff]}
      onPress={onToggle}
      activeOpacity={0.8}
    >
      <Text style={[sh.toggleText, on ? sh.toggleTextOn : sh.toggleTextOff]}>
        {on ? onLabel : offLabel}
      </Text>
    </TouchableOpacity>
  );
}

function SaveBar({
  dirty,
  saving,
  onSave,
}: {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
}) {
  if (!dirty && !saving) return null;
  return (
    <View style={sh.saveBar}>
      <Text style={sh.saveBarText}>Unsaved changes</Text>
      <TouchableOpacity
        style={[sh.saveBtn, saving && sh.saveBtnDisabled]}
        onPress={onSave}
        disabled={saving}
        activeOpacity={0.85}
      >
        {saving ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <Save size={13} color="#fff" />
            <Text style={sh.saveBtnText}>Save Changes</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

const sh = StyleSheet.create({
  card: { borderWidth: 1, borderColor: BORDER, borderRadius: 8, backgroundColor: SURFACE, overflow: 'hidden', marginBottom: 20 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: BORDER, minHeight: 52 },
  fieldRowLast: { borderBottomWidth: 0 },
  fieldLabelWrap: { flex: 1, paddingRight: 12 },
  fieldLabel: { fontSize: 13, color: TEXT, fontWeight: '500' as const },
  fieldHint: { fontSize: 11, color: TEXT_LIGHT, marginTop: 2 },
  fieldControl: { alignItems: 'flex-end' },
  numWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: BORDER, borderRadius: 6, paddingHorizontal: 10, height: 36, backgroundColor: SURFACE },
  numAffix: { fontSize: 12, color: TEXT_LIGHT, marginHorizontal: 2 },
  numInput: { flex: 1, fontSize: 13, color: TEXT, paddingVertical: 0, minWidth: 60 },
  toggle: { minWidth: 48, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, borderWidth: 1 },
  toggleOn: { backgroundColor: BRAND, borderColor: BRAND },
  toggleOff: { backgroundColor: BG, borderColor: BORDER },
  toggleText: { fontSize: 11, fontWeight: '700' as const },
  toggleTextOn: { color: '#fff' },
  toggleTextOff: { color: TEXT_LIGHT },
  saveBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 8, padding: 12, marginBottom: 16, gap: 12 },
  saveBarText: { fontSize: 13, color: '#92400E', fontWeight: '500' as const, flex: 1 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: BRAND, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 7 },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 12, fontWeight: '700' as const, color: '#fff' },
});

// ── Product Pricing ───────────────────────────────────────────────────────────

const SIZE_UPCHARGE_SIZES = ['2XL', '3XL', '4XL', '5XL', '6XL'] as const;

interface ProductOverride {
  id: string;
  product: string;
  size: string;
  amount: number;
}

interface ProductPricingData {
  upcharges: Record<string, number>;
  overrides: ProductOverride[];
}

const PRICING_DEFAULTS: ProductPricingData = {
  upcharges: { '2XL': 2, '3XL': 4, '4XL': 6, '5XL': 8, '6XL': 10 },
  overrides: [],
};

function ProductPricingPage() {
  const queryClient = useQueryClient();

  const { data: saved, isLoading } = useQuery<ProductPricingData | null>({
    queryKey: ['app-settings', 'product_pricing'],
    queryFn: async () => {
      const r = await fetch('/api/app-settings/product_pricing');
      if (!r.ok) return null;
      return r.json();
    },
    networkMode: 'always',
    staleTime: 60_000,
  });

  const [upcharges, setUpcharges] = useState<Record<string, number>>(PRICING_DEFAULTS.upcharges);
  const [overrides, setOverrides] = useState<ProductOverride[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (saved) {
      setUpcharges(saved.upcharges ?? PRICING_DEFAULTS.upcharges);
      setOverrides(saved.overrides ?? []);
      setDirty(false);
    }
  }, [saved]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/app-settings/product_pricing', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ upcharges, overrides }),
      });
      if (!r.ok) throw new Error('Failed to save');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-settings', 'product_pricing'] });
      setDirty(false);
    },
  });

  function setUpcharge(size: string, val: number) {
    setUpcharges((prev) => ({ ...prev, [size]: val }));
    setDirty(true);
  }

  function addOverride() {
    setOverrides((prev) => [...prev, { id: `ov_${Date.now()}`, product: '', size: '', amount: 0 }]);
    setDirty(true);
  }

  function updateOverride(id: string, patch: Partial<ProductOverride>) {
    setOverrides((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
    setDirty(true);
  }

  function removeOverride(id: string) {
    setOverrides((prev) => prev.filter((o) => o.id !== id));
    setDirty(true);
  }

  if (isLoading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="small" color={BRAND} />
      </View>
    );
  }

  return (
    <View>
      <SaveBar dirty={dirty} saving={saveMutation.isPending} onSave={() => saveMutation.mutate()} />

      <Text style={s.pageSection}>Apparel Size Upcharges</Text>
      <Text style={s.pageSectionHint}>
        Extra charge applied on top of the base price for larger sizes.
      </Text>

      <SectionCard>
        {SIZE_UPCHARGE_SIZES.map((size, i) => (
          <FieldRow
            key={size}
            label={size}
            hint="Upcharge per piece"
            last={i === SIZE_UPCHARGE_SIZES.length - 1}
          >
            <NumInput
              value={upcharges[size] ?? 0}
              onChange={(v) => setUpcharge(size, v)}
              prefix="$"
              width={110}
            />
          </FieldRow>
        ))}
      </SectionCard>

      <View style={s.sectionHeader}>
        <View>
          <Text style={s.pageSection}>Product Overrides</Text>
          <Text style={s.pageSectionHint}>
            Override the price for a specific product and size combination.
          </Text>
        </View>
        <TouchableOpacity style={s.addRowBtn} onPress={addOverride} activeOpacity={0.85}>
          <Plus size={12} color="#fff" />
          <Text style={s.addRowBtnText}>Add Override</Text>
        </TouchableOpacity>
      </View>

      <View style={s.overrideTable}>
        <View style={s.overrideHead}>
          <Text style={[s.overrideHeadText, { flex: 2 }]}>Specific Product</Text>
          <Text style={[s.overrideHeadText, { flex: 1 }]}>Size</Text>
          <Text style={[s.overrideHeadText, { width: 110, textAlign: 'right' }]}>Override Amount</Text>
          <View style={{ width: 36 }} />
        </View>

        {overrides.length === 0 ? (
          <View style={s.emptyRow}>
            <Text style={s.emptyText}>No product overrides configured.</Text>
          </View>
        ) : (
          overrides.map((ov) => (
            <View key={ov.id} style={s.overrideRow}>
              <TextInput
                style={[s.overrideTxt, { flex: 2 }]}
                value={ov.product}
                onChangeText={(t) => updateOverride(ov.id, { product: t })}
                placeholder="e.g. Gildan G500"
                placeholderTextColor={TEXT_LIGHT}
              />
              <TextInput
                style={[s.overrideTxt, { flex: 1 }]}
                value={ov.size}
                onChangeText={(t) => updateOverride(ov.id, { size: t })}
                placeholder="e.g. 2XL"
                placeholderTextColor={TEXT_LIGHT}
              />
              <NumInput
                value={ov.amount}
                onChange={(v) => updateOverride(ov.id, { amount: v })}
                prefix="$"
                width={110}
              />
              <TouchableOpacity
                onPress={() => removeOverride(ov.id)}
                style={{ width: 36, alignItems: 'center' }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Trash2 size={15} color={ERROR} />
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

// ── Taxes & Fees ──────────────────────────────────────────────────────────────

interface TaxesFeesData {
  salesTaxPct: number;
  cardFeePct: number;
  onlineFeePct: number;
  onlineFeeFlat: number;
  minimumOrder: number;
  depositPct: number;
  roundPricing: boolean;
  lateFeeEnabled: boolean;
  lateFeeType: 'flat' | 'percentage';
  lateFeePct: number;
  lateFeeFlat: number;
  lateFeeDaysGrace: number;
}

const TAXES_DEFAULTS: TaxesFeesData = {
  salesTaxPct: +(SALES_TAX_PCT * 100).toFixed(2),
  cardFeePct: +(CARD_FEE_PCT * 100).toFixed(2),
  onlineFeePct: +(ONLINE_FEE_PCT * 100).toFixed(2),
  onlineFeeFlat: ONLINE_FEE_FLAT,
  minimumOrder: 0,
  depositPct: 50,
  roundPricing: false,
  lateFeeEnabled: false,
  lateFeeType: 'percentage',
  lateFeePct: 5,
  lateFeeFlat: 25,
  lateFeeDaysGrace: 7,
};

function TaxesFeesPage() {
  const queryClient = useQueryClient();

  const { data: saved, isLoading } = useQuery<TaxesFeesData | null>({
    queryKey: ['app-settings', 'taxes_fees'],
    queryFn: async () => {
      const r = await fetch('/api/app-settings/taxes_fees');
      if (!r.ok) return null;
      return r.json();
    },
    networkMode: 'always',
    staleTime: 60_000,
  });

  const [form, setForm] = useState<TaxesFeesData>(TAXES_DEFAULTS);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (saved) {
      setForm({ ...TAXES_DEFAULTS, ...saved });
      setDirty(false);
    }
  }, [saved]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/app-settings/taxes_fees', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error('Failed to save');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-settings', 'taxes_fees'] });
      setDirty(false);
    },
  });

  function set<K extends keyof TaxesFeesData>(k: K, v: TaxesFeesData[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
    setDirty(true);
  }

  if (isLoading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="small" color={BRAND} />
      </View>
    );
  }

  return (
    <View>
      <SaveBar dirty={dirty} saving={saveMutation.isPending} onSave={() => saveMutation.mutate()} />

      <Text style={s.pageSection}>Tax Rates</Text>
      <SectionCard>
        <FieldRow label="Sales Tax" hint="Applied when sales tax is toggled on a project" last>
          <NumInput
            value={form.salesTaxPct}
            onChange={(v) => set('salesTaxPct', v)}
            suffix="%"
            width={110}
          />
        </FieldRow>
      </SectionCard>

      <Text style={s.pageSection}>Processing Fees</Text>
      <SectionCard>
        <FieldRow
          label="Card Fee"
          hint="In-person / card-on-file processing rate"
        >
          <NumInput
            value={form.cardFeePct}
            onChange={(v) => set('cardFeePct', v)}
            suffix="%"
            width={110}
          />
        </FieldRow>
        <FieldRow
          label="Online Fee — Rate"
          hint="Online payment percentage component"
        >
          <NumInput
            value={form.onlineFeePct}
            onChange={(v) => set('onlineFeePct', v)}
            suffix="%"
            width={110}
          />
        </FieldRow>
        <FieldRow
          label="Online Fee — Flat"
          hint="Online payment per-transaction flat amount"
          last
        >
          <NumInput
            value={form.onlineFeeFlat}
            onChange={(v) => set('onlineFeeFlat', v)}
            prefix="$"
            width={110}
          />
        </FieldRow>
      </SectionCard>

      <Text style={s.pageSection}>Order Settings</Text>
      <SectionCard>
        <FieldRow label="Minimum Order" hint="Minimum order value before fees">
          <NumInput
            value={form.minimumOrder}
            onChange={(v) => set('minimumOrder', v)}
            prefix="$"
            width={110}
          />
        </FieldRow>
        <FieldRow label="Deposit" hint="Default deposit percentage">
          <NumInput
            value={form.depositPct}
            onChange={(v) => set('depositPct', v)}
            suffix="%"
            width={110}
          />
        </FieldRow>
        <FieldRow label="Round Pricing" hint="Round totals to the nearest dollar" last>
          <Toggle
            on={form.roundPricing}
            onToggle={() => set('roundPricing', !form.roundPricing)}
            onLabel="Yes"
            offLabel="No"
          />
        </FieldRow>
      </SectionCard>

      <Text style={s.pageSection}>Late Fee</Text>
      <SectionCard>
        <FieldRow label="Enable Late Fee" hint="Charge a late fee on overdue invoices">
          <Toggle
            on={form.lateFeeEnabled}
            onToggle={() => set('lateFeeEnabled', !form.lateFeeEnabled)}
            onLabel="Yes"
            offLabel="No"
          />
        </FieldRow>
        <FieldRow label="Fee Type" hint="How the late fee is calculated">
          <View style={s.segRow}>
            {(['percentage', 'flat'] as const).map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[s.segBtn, form.lateFeeType === opt && s.segBtnActive]}
                onPress={() => set('lateFeeType', opt)}
                activeOpacity={0.8}
              >
                <Text style={[s.segBtnText, form.lateFeeType === opt && s.segBtnTextActive]}>
                  {opt === 'percentage' ? '% Rate' : '$ Flat'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </FieldRow>
        {form.lateFeeType === 'percentage' ? (
          <FieldRow label="Late Fee %" hint="Percentage of invoice total charged as late fee">
            <NumInput
              value={form.lateFeePct}
              onChange={(v) => set('lateFeePct', v)}
              suffix="%"
              width={110}
            />
          </FieldRow>
        ) : (
          <FieldRow label="Late Fee Amount" hint="Flat dollar amount charged as late fee">
            <NumInput
              value={form.lateFeeFlat}
              onChange={(v) => set('lateFeeFlat', v)}
              prefix="$"
              width={110}
            />
          </FieldRow>
        )}
        <FieldRow label="Grace Period" hint="Days after due date before the fee is applied" last>
          <NumInput
            value={form.lateFeeDaysGrace}
            onChange={(v) => set('lateFeeDaysGrace', v)}
            suffix=" days"
            width={110}
          />
        </FieldRow>
      </SectionCard>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const [tab, setTab] = useState<CostTab>('product_pricing');

  return (
    <View style={s.screen}>
      {/* Page header */}
      <View style={s.pageHeader}>
        <SlidersHorizontal size={22} color={BRAND} />
        <Text style={s.pageTitle}>Cost Configuration</Text>
      </View>

      {/* Sub-page tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.pageTabsScroll}
        contentContainerStyle={s.pageTabs}
      >
        {TABS.map(({ id, label, Icon }) => {
          const active = tab === id;
          return (
            <TouchableOpacity
              key={id}
              style={[s.pageTabBtn, active && s.pageTabBtnActive]}
              onPress={() => setTab(id)}
              activeOpacity={0.7}
            >
              <Icon size={15} color={active ? BRAND : TEXT_LIGHT} />
              <Text style={[s.pageTabText, active && s.pageTabTextActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Tab content */}
      <ScrollView style={s.body} contentContainerStyle={s.bodyContent}>
        {tab === 'product_pricing' && <ProductPricingPage />}

        {tab === 'production_library' && (
          <CostLibraryTable
            category="production"
            title="Production Library"
            addLabel="Add Production Cost"
            namePlaceholder="e.g. Screen Print Setup, Digitizing"
          />
        )}

        {tab === 'other_charges_library' && (
          <CostLibraryTable
            category="other"
            title="Other Charges Library"
            addLabel="Add Other Charge"
            namePlaceholder="e.g. Rush Fee, Shipping, Restocking"
          />
        )}

        {tab === 'service_styles' && <ServiceStylesTable />}

        {tab === 'taxes_fees' && <TaxesFeesPage />}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },

  pageHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14 },
  pageTitle: { fontSize: 22, fontWeight: '700' as const, color: TEXT },

  pageTabsScroll: { flexGrow: 0, borderBottomWidth: 1, borderColor: BORDER, backgroundColor: '#fff' },
  pageTabs: { flexDirection: 'row', paddingHorizontal: 12 },
  pageTabBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  pageTabBtnActive: { borderBottomColor: BRAND },
  pageTabText: { fontSize: 13, color: TEXT_LIGHT, fontWeight: '500' as const },
  pageTabTextActive: { color: BRAND, fontWeight: '600' as const },

  body: { flex: 1 },
  bodyContent: { paddingHorizontal: 20, paddingVertical: 16, paddingBottom: 48 },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },

  pageSection: { fontSize: 13, fontWeight: '700' as const, color: TEXT, marginBottom: 6, marginTop: 4 },
  pageSectionHint: { fontSize: 12, color: TEXT_LIGHT, marginBottom: 10, lineHeight: 17 },

  sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 6, marginTop: 4 },
  addRowBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: BRAND, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 7 },
  addRowBtnText: { fontSize: 12, fontWeight: '700' as const, color: '#fff' },

  overrideTable: { borderWidth: 1, borderColor: BORDER, borderRadius: 8, backgroundColor: SURFACE, overflow: 'hidden', marginBottom: 20 },
  overrideHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, backgroundColor: BG, borderBottomWidth: 1, borderBottomColor: BORDER, gap: 8 },
  overrideHeadText: { fontSize: 9, fontWeight: '700' as const, color: TEXT_LIGHT, letterSpacing: 0.4, textTransform: 'uppercase' as const },
  overrideRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: BORDER, gap: 8 },
  overrideTxt: { borderWidth: 1, borderColor: BORDER, borderRadius: 6, paddingHorizontal: 10, height: 34, fontSize: 13, color: TEXT, backgroundColor: SURFACE },
  emptyRow: { padding: 20, alignItems: 'center' },
  emptyText: { fontSize: 13, color: TEXT_LIGHT },

  segRow: { flexDirection: 'row', gap: 4 },
  segBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: BORDER, backgroundColor: SURFACE },
  segBtnActive: { backgroundColor: BRAND, borderColor: BRAND },
  segBtnText: { fontSize: 12, fontWeight: '600' as const, color: TEXT_LIGHT },
  segBtnTextActive: { color: '#fff' },
});
