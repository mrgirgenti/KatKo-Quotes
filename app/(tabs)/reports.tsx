'use client';
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  LayoutChangeEvent,
} from 'react-native';
import {
  ChevronDown,
  Download,
  ArrowUp,
  ArrowDown,
  TrendingUp,
  Users,
  ChevronRight,
} from 'lucide-react-native';
import Svg, { Path, Circle, Defs, LinearGradient as SvgGradient, Stop, Line as SvgLine, Text as SvgText, Rect } from 'react-native-svg';
import { useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import { DS } from '@/constants/designSystem';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useQuotes } from '@/contexts/QuotesContext';
import { formatCurrency } from '@/utils/quoteCalculations';
import {
  generateQuotesCSV,
  generateSalesCSV,
  generateLineItemsCSV,
  exportCSV,
} from '@/utils/csvExport';
import { Toast } from '@/components/Toast';
import type { Quote } from '@/types/quote';

// ── Types ──────────────────────────────────────────────────────────────────────
type ReportTab = 'overview' | 'financial' | 'customers' | 'services';
type DateRangeKey = 'all' | 'this_month' | 'this_quarter' | 'this_year' | 'last_30' | 'last_90' | 'custom';
type CompareKey = 'none' | 'prev_period' | 'prev_year';

const DATE_RANGE_LABELS: Record<DateRangeKey, string> = {
  all: 'All Time',
  this_month: 'This Month',
  this_quarter: 'This Quarter',
  this_year: 'This Year',
  last_30: 'Last 30 Days',
  last_90: 'Last 90 Days',
  custom: 'Custom Range',
};
const COMPARE_LABELS: Record<CompareKey, string> = {
  none: 'No Comparison',
  prev_period: 'Previous Period',
  prev_year: 'Same Period Last Year',
};

// ── Revenue / Profit helpers ───────────────────────────────────────────────────
function getRevenue(q: Quote): number {
  return (q.salesData?.amountCollected as number | undefined) ?? q.calculations.total;
}

function getProfit(q: Quote): number {
  if (!q.salesData) return (q.calculations as any).markupAmount ?? 0;
  const sfCost = q.salesData.actualServiceFeesCost ?? 0;
  const sfProfit = q.salesData.actualServiceFeesProfit ?? 0;
  const onlineFee = q.salesData.actualOnlineFee ?? 0;
  const salesTax = q.salesData.actualSalesTax ?? 0;
  const cardFee = q.salesData.actualCardFee ?? 0;
  const actualCOG =
    q.salesData.actualProductCost +
    q.salesData.actualServiceCost +
    sfCost +
    q.salesData.actualOtherCosts;
  const actualTotal = actualCOG + onlineFee + salesTax + cardFee;
  const quotedFees = (q.calculations as any).serviceFeeTotal ?? 0;
  return q.salesData.amountCollected - actualTotal + sfProfit + (quotedFees - sfCost);
}

function getPcs(q: Quote): number {
  return q.lineItems.reduce(
    (s: number, li: any) =>
      s +
      Object.values(li.sizes || {}).reduce(
        (ps: number, v: any) => ps + (Number(v) || 0),
        0,
      ),
    0,
  );
}

// ── Date range helpers ─────────────────────────────────────────────────────────
function getDateRange(
  key: DateRangeKey,
  customFrom: string,
  customTo: string,
): { from: Date | null; to: Date | null } {
  const now = new Date();
  switch (key) {
    case 'all':
      return { from: null, to: null };
    case 'this_month': {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      return { from, to };
    }
    case 'this_quarter': {
      const q = Math.floor(now.getMonth() / 3);
      const from = new Date(now.getFullYear(), q * 3, 1);
      const to = new Date(now.getFullYear(), q * 3 + 3, 0, 23, 59, 59);
      return { from, to };
    }
    case 'this_year': {
      const from = new Date(now.getFullYear(), 0, 1);
      const to = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
      return { from, to };
    }
    case 'last_30': {
      const from = new Date(now);
      from.setDate(from.getDate() - 30);
      return { from, to: now };
    }
    case 'last_90': {
      const from = new Date(now);
      from.setDate(from.getDate() - 90);
      return { from, to: now };
    }
    case 'custom': {
      const from = customFrom ? new Date(customFrom) : null;
      const to = customTo ? new Date(customTo + 'T23:59:59') : null;
      return { from, to };
    }
  }
}

function getComparisonRange(
  range: { from: Date | null; to: Date | null },
  key: CompareKey,
): { from: Date | null; to: Date | null } | null {
  if (key === 'none' || !range.from || !range.to) return null;
  const durationMs = range.to.getTime() - range.from.getTime();
  if (key === 'prev_period') {
    const to = new Date(range.from.getTime() - 1);
    const from = new Date(to.getTime() - durationMs);
    return { from, to };
  }
  if (key === 'prev_year') {
    const from = new Date(range.from);
    from.setFullYear(from.getFullYear() - 1);
    const to = new Date(range.to);
    to.setFullYear(to.getFullYear() - 1);
    return { from, to };
  }
  return null;
}

function filterByRange(
  quotes: Quote[],
  from: Date | null,
  to: Date | null,
): Quote[] {
  if (!from && !to) return quotes;
  return quotes.filter((q) => {
    if (!q.orderDate) return false;
    const d = new Date(q.orderDate);
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  });
}

// ── Metrics ────────────────────────────────────────────────────────────────────
interface Metrics {
  revenue: number;
  profit: number;
  orders: number;
  totalPcs: number;
  avgOrder: number;
  avgPcs: number;
}

function computeMetrics(quotes: Quote[]): Metrics {
  const revenue = quotes.reduce((s, q) => s + getRevenue(q), 0);
  const profit = quotes.reduce((s, q) => s + getProfit(q), 0);
  const orders = quotes.length;
  const totalPcs = quotes.reduce((s, q) => s + getPcs(q), 0);
  return {
    revenue,
    profit,
    orders,
    totalPcs,
    avgOrder: orders > 0 ? revenue / orders : 0,
    avgPcs: orders > 0 ? totalPcs / orders : 0,
  };
}

function pctChange(curr: number, prev: number): number | null {
  if (prev === 0) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

// ── Customer data ──────────────────────────────────────────────────────────────
interface CustomerRow {
  name: string;
  revenue: number;
  profit: number;
  orders: number;
  lastOrderDate: string | null;
}

function computeTopCustomers(quotes: Quote[]): CustomerRow[] {
  const map = new Map<string, CustomerRow>();
  for (const q of quotes) {
    const name = (q.personOrganization as string | undefined) || 'Unknown';
    const existing = map.get(name) ?? {
      name,
      revenue: 0,
      profit: 0,
      orders: 0,
      lastOrderDate: null,
    };
    existing.revenue += getRevenue(q);
    existing.profit += getProfit(q);
    existing.orders += 1;
    if (
      q.orderDate &&
      (!existing.lastOrderDate || q.orderDate > existing.lastOrderDate)
    ) {
      existing.lastOrderDate = q.orderDate as string;
    }
    map.set(name, existing);
  }
  return [...map.values()].sort((a, b) => b.revenue - a.revenue);
}

// ── Service Snapshot ───────────────────────────────────────────────────────────
interface ServiceRow {
  service: string;
  revenue: number;
  profit: number;
  orders: number;
  totalPcs: number;
}

function computeServiceSnapshot(quotes: Quote[]): ServiceRow[] {
  const map = new Map<string, ServiceRow & { quoteIds: Set<string> }>();
  for (const q of quotes) {
    const qRevenue = getRevenue(q);
    const qProfit = getProfit(q);
    const qPcs = getPcs(q);
    const services = [
      ...new Set(
        q.lineItems.map((li: any) => (li.serviceStyle as string) || 'Unknown'),
      ),
    ] as string[];
    for (const service of services) {
      const existing = map.get(service) ?? {
        service,
        revenue: 0,
        profit: 0,
        orders: 0,
        totalPcs: 0,
        quoteIds: new Set<string>(),
      };
      if (!existing.quoteIds.has(q.id)) {
        existing.quoteIds.add(q.id);
        const share = 1 / services.length;
        existing.revenue += qRevenue * share;
        existing.profit += qProfit * share;
        existing.orders += 1;
        existing.totalPcs += qPcs * share;
      }
      map.set(service, existing);
    }
  }
  return [...map.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .map(({ quoteIds: _qs, ...rest }) => rest);
}

// ── Reconciliation Queue ───────────────────────────────────────────────────────
const RECON_STATUSES = new Set([
  'invoice_sent',
  'paid',
  'active',
  'production_started',
  'completed',
]);

function computeReconciliationQueue(quotes: Quote[]) {
  const pending = quotes.filter(
    (q) => RECON_STATUSES.has(q.status as string) && !q.salesData,
  );
  return {
    count: pending.length,
    revenueWaiting: pending.reduce((s, q) => s + q.calculations.total, 0),
    profitWaiting: pending.reduce(
      (s, q) => s + ((q.calculations as any).markupAmount ?? 0),
      0,
    ),
  };
}

// ── Monthly data for chart ─────────────────────────────────────────────────────
interface MonthlyPoint {
  label: string;
  revenue: number;
  profit: number;
}

function computeMonthlyData(quotes: Quote[]): MonthlyPoint[] {
  const map = new Map<string, { revenue: number; profit: number }>();
  for (const q of quotes) {
    if (!q.orderDate) continue;
    const d = new Date(q.orderDate);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const existing = map.get(key) ?? { revenue: 0, profit: 0 };
    existing.revenue += getRevenue(q);
    existing.profit += getProfit(q);
    map.set(key, existing);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, { revenue, profit }]) => {
      const [yr, mo] = key.split('-');
      const d = new Date(parseInt(yr), parseInt(mo) - 1);
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      return { label, revenue, profit };
    });
}

// ── Customer concentration ─────────────────────────────────────────────────────
function computeConcentration(customers: CustomerRow[], totalRevenue: number) {
  if (totalRevenue === 0) return { top1: 0, top5: 0, top10: 0 };
  const pct = (n: number) =>
    Math.round((customers.slice(0, n).reduce((s, c) => s + c.revenue, 0) / totalRevenue) * 100);
  return { top1: pct(1), top5: pct(5), top10: pct(10) };
}

// ── Recent reconciliations ─────────────────────────────────────────────────────
function computeRecentReconciliations(quotes: Quote[]): Quote[] {
  return quotes
    .filter((q) => !!q.salesData)
    .sort((a, b) => ((b.orderDate ?? '') > (a.orderDate ?? '') ? 1 : -1))
    .slice(0, 10);
}

// ── Service color palette ──────────────────────────────────────────────────────
const SERVICE_COLORS: Record<string, string> = {
  'DTF Printing': '#FF5A00',
  'Direct to Film': '#FF5A00',
  'Screen Printing': '#2563EB',
  'Embroidery': '#7C3AED',
  'Promotional': '#0891B2',
  'DTF Transfers': '#EA580C',
  'Design Work': '#16A34A',
  'Laser Engraving': '#D97706',
  'Embroidery Patches': '#BE185D',
  'Unknown': '#6B7280',
};

function getServiceColor(service: string): string {
  if (SERVICE_COLORS[service]) return SERVICE_COLORS[service];
  const keys = Object.keys(SERVICE_COLORS);
  const idx = service.split('').reduce((s, c) => s + c.charCodeAt(0), 0) % (keys.length - 1);
  return SERVICE_COLORS[keys[idx]];
}

// ── Section Header ─────────────────────────────────────────────────────────────
function SectionHeader({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={s.sectionHeader}>
      <Text style={s.sectionHeaderText}>{title}</Text>
      {action && onAction && (
        <TouchableOpacity onPress={onAction} style={s.sectionActionBtn}>
          <Text style={s.sectionAction}>{action}</Text>
          <ChevronRight size={13} color={Colors.light.tint} />
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── KPI Card (full-width row version) ──────────────────────────────────────────
function KpiCard({
  label,
  value,
  change,
  compareLabel,
}: {
  label: string;
  value: string;
  change: number | null;
  compareLabel: string;
}) {
  const hasChange = change !== null;
  const positive = (change ?? 0) >= 0;
  return (
    <View style={s.kpiCard}>
      <Text style={s.kpiLabel}>{label}</Text>
      <Text style={s.kpiValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      {hasChange && (
        <View style={s.kpiChangeRow}>
          {positive ? (
            <ArrowUp size={11} color={Colors.light.success} />
          ) : (
            <ArrowDown size={11} color={Colors.light.error} />
          )}
          <Text style={[s.kpiChangePct, { color: positive ? Colors.light.success : Colors.light.error }]}>
            {Math.abs(change!).toFixed(1)}%
          </Text>
        </View>
      )}
      {!!compareLabel && <Text style={s.kpiCompare} numberOfLines={1}>{compareLabel}</Text>}
    </View>
  );
}

// ── Table Header + Row helpers ─────────────────────────────────────────────────
function TableHead({ cols }: { cols: Array<{ label: string; flex?: number; right?: boolean }> }) {
  return (
    <View style={s.tableHead}>
      {cols.map((c) => (
        <Text
          key={c.label}
          style={[
            s.thCell,
            c.right && s.thRight,
            c.flex != null && { flex: c.flex },
          ]}
        >
          {c.label}
        </Text>
      ))}
    </View>
  );
}

// ── Date Range Dropdown ────────────────────────────────────────────────────────
function DateRangeMenu({
  selected,
  onChange,
  customFrom,
  customTo,
  onCustomFrom,
  onCustomTo,
}: {
  selected: DateRangeKey;
  onChange: (k: DateRangeKey) => void;
  customFrom: string;
  customTo: string;
  onCustomFrom: (v: string) => void;
  onCustomTo: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const options: DateRangeKey[] = [
    'all',
    'this_month',
    'this_quarter',
    'this_year',
    'last_30',
    'last_90',
    'custom',
  ];
  return (
    <View style={s.ddWrap}>
      <TouchableOpacity style={s.headerBtn} onPress={() => setOpen((o) => !o)}>
        <Text style={s.headerBtnText}>{DATE_RANGE_LABELS[selected]}</Text>
        <ChevronDown size={13} color={Colors.light.textSecondary} />
      </TouchableOpacity>
      {open && (
        <View style={s.dropdown}>
          {options.map((k) => (
            <TouchableOpacity
              key={k}
              style={s.ddItem}
              onPress={() => {
                onChange(k);
                if (k !== 'custom') setOpen(false);
              }}
            >
              <Text style={[s.ddItemText, selected === k && s.ddItemActive]}>
                {DATE_RANGE_LABELS[k]}
              </Text>
            </TouchableOpacity>
          ))}
          {selected === 'custom' && (
            <View style={s.customDateRow}>
              <TextInput
                style={s.customDateInput}
                value={customFrom}
                onChangeText={onCustomFrom}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.light.textSecondary}
              />
              <Text style={s.customDateSep}>→</Text>
              <TextInput
                style={s.customDateInput}
                value={customTo}
                onChangeText={onCustomTo}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.light.textSecondary}
              />
              <TouchableOpacity style={s.customDateApply} onPress={() => setOpen(false)}>
                <Text style={s.customDateApplyText}>Apply</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ── Compare Dropdown ───────────────────────────────────────────────────────────
function CompareMenu({
  selected,
  onChange,
}: {
  selected: CompareKey;
  onChange: (k: CompareKey) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={s.ddWrap}>
      <TouchableOpacity style={s.headerBtn} onPress={() => setOpen((o) => !o)}>
        <Text style={s.headerBtnText}>
          {selected === 'none' ? 'Compare' : COMPARE_LABELS[selected]}
        </Text>
        <ChevronDown size={13} color={Colors.light.textSecondary} />
      </TouchableOpacity>
      {open && (
        <View style={s.dropdown}>
          {(['none', 'prev_period', 'prev_year'] as CompareKey[]).map((k) => (
            <TouchableOpacity
              key={k}
              style={s.ddItem}
              onPress={() => {
                onChange(k);
                setOpen(false);
              }}
            >
              <Text style={[s.ddItemText, selected === k && s.ddItemActive]}>
                {COMPARE_LABELS[k]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ── Export Dropdown ────────────────────────────────────────────────────────────
function ExportMenu({ onExport }: { onExport: (type: 'quotes' | 'sales' | 'lineItems') => void }) {
  const [open, setOpen] = useState(false);
  const items: Array<{ key: 'quotes' | 'sales' | 'lineItems'; label: string }> = [
    { key: 'quotes', label: 'Sales Report' },
    { key: 'sales', label: 'Financial Summary' },
    { key: 'lineItems', label: 'Reconciliation Report' },
  ];
  return (
    <View style={[s.ddWrap, s.ddWrapRight]}>
      <TouchableOpacity style={[s.headerBtn, s.exportHeaderBtn]} onPress={() => setOpen((o) => !o)}>
        <Download size={13} color="#fff" />
        <Text style={[s.headerBtnText, { color: '#fff' }]}>Export</Text>
        <ChevronDown size={13} color="#fff" />
      </TouchableOpacity>
      {open && (
        <View style={[s.dropdown, s.dropdownRight]}>
          {items.map((item) => (
            <TouchableOpacity
              key={item.key}
              style={s.ddItem}
              onPress={() => { onExport(item.key); setOpen(false); }}
            >
              <Text style={s.ddItemText}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ── Revenue vs Profit Chart ────────────────────────────────────────────────────
function RevenueVsProfitChart({ data }: { data: MonthlyPoint[] }) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const chartH = 360;
  const padL = 68;
  const padR = 20;
  const padT = 24;
  const padB = 48;

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  }, []);

  if (!mounted || data.length < 2) {
    return (
      <View style={s.chartWrap}>
        <View style={[s.chartInner, { justifyContent: 'center', alignItems: 'center', height: chartH }]}>
          <TrendingUp size={32} color={Colors.light.border} />
          <Text style={s.chartEmpty}>
            {data.length < 2 ? 'Not enough data to display chart' : 'Loading chart…'}
          </Text>
        </View>
      </View>
    );
  }

  const W = Math.max(0, containerWidth - padL - padR);
  const H = chartH - padT - padB;

  const maxRev = Math.max(...data.map((d) => d.revenue), 1);
  const minProfit = Math.min(...data.map((d) => d.profit), 0);
  const rangeY = maxRev - minProfit;
  const n = data.length;

  const xPos = (i: number) => padL + (n === 1 ? W / 2 : (i / (n - 1)) * W);
  const yPos = (v: number) => padT + H - ((v - minProfit) / rangeY) * H;

  const revPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xPos(i).toFixed(1)},${yPos(d.revenue).toFixed(1)}`).join(' ');
  const profPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xPos(i).toFixed(1)},${yPos(d.profit).toFixed(1)}`).join(' ');

  // Revenue fill path (area under curve)
  const baselineY = yPos(Math.max(0, minProfit));
  const revFill = `${revPath} L ${xPos(n - 1).toFixed(1)},${baselineY.toFixed(1)} L ${xPos(0).toFixed(1)},${baselineY.toFixed(1)} Z`;

  // Y-axis gridlines
  const gridCount = 5;
  const gridLines = Array.from({ length: gridCount }, (_, i) => {
    const v = minProfit + (rangeY / (gridCount - 1)) * i;
    const y = yPos(v);
    const label = formatCurrency(v);
    return { y, label };
  });

  // Show every nth x-label to avoid crowding
  const maxLabels = 8;
  const step = Math.max(1, Math.ceil(n / maxLabels));

  return (
    <View style={s.chartWrap}>
      {/* Legend */}
      <View style={s.chartLegend}>
        <View style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: Colors.light.tint }]} />
          <Text style={s.legendLabel}>Revenue</Text>
        </View>
        <View style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: Colors.light.success }]} />
          <Text style={s.legendLabel}>Profit</Text>
        </View>
      </View>

      {/* Chart */}
      <View onLayout={handleLayout} style={{ width: '100%' }}>
        {containerWidth > 0 && (
          <Svg width={containerWidth} height={chartH}>
            <Defs>
              <SvgGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={Colors.light.tint} stopOpacity={0.12} />
                <Stop offset="100%" stopColor={Colors.light.tint} stopOpacity={0} />
              </SvgGradient>
            </Defs>

            {/* Grid lines */}
            {gridLines.map((gl, i) => (
              <React.Fragment key={i}>
                <SvgLine
                  x1={padL}
                  y1={gl.y}
                  x2={containerWidth - padR}
                  y2={gl.y}
                  stroke={Colors.light.border}
                  strokeWidth={1}
                  strokeDasharray={i === 0 ? '0' : '4,3'}
                />
                <SvgText
                  x={padL - 6}
                  y={gl.y + 4}
                  fontSize={9}
                  fill={Colors.light.textSecondary}
                  textAnchor="end"
                >
                  {gl.label}
                </SvgText>
              </React.Fragment>
            ))}

            {/* Revenue area fill */}
            <Path d={revFill} fill="url(#revFill)" />

            {/* Revenue line */}
            <Path d={revPath} stroke={Colors.light.tint} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />

            {/* Profit line */}
            <Path d={profPath} stroke={Colors.light.success} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />

            {/* Revenue data points */}
            {data.map((d, i) => (
              <Circle key={`rv${i}`} cx={xPos(i)} cy={yPos(d.revenue)} r={3.5} fill={Colors.light.tint} />
            ))}

            {/* Profit data points */}
            {data.map((d, i) => (
              <Circle key={`pf${i}`} cx={xPos(i)} cy={yPos(d.profit)} r={3.5} fill={Colors.light.success} />
            ))}

            {/* X-axis labels */}
            {data.map((d, i) =>
              i % step === 0 || i === n - 1 ? (
                <SvgText
                  key={`xl${i}`}
                  x={xPos(i)}
                  y={chartH - 10}
                  fontSize={9}
                  fill={Colors.light.textSecondary}
                  textAnchor="middle"
                >
                  {d.label}
                </SvgText>
              ) : null
            )}
          </Svg>
        )}
      </View>
    </View>
  );
}

// ── Service Snapshot Cards ─────────────────────────────────────────────────────
function ServiceSnapshotCards({ services }: { services: ServiceRow[] }) {
  const { isDesktop } = useBreakpoint();
  const cardBasis = isDesktop ? '31%' : '100%';

  if (services.length === 0) {
    return (
      <View style={s.emptySection}>
        <Text style={s.emptyMsg}>No service data for this period.</Text>
      </View>
    );
  }

  return (
    <View style={s.serviceGrid}>
      {services.map((sv) => {
        const color = getServiceColor(sv.service);
        const margin = sv.revenue > 0 ? (sv.profit / sv.revenue) * 100 : 0;
        return (
          <View key={sv.service} style={[s.serviceCard, { flexBasis: cardBasis as any }]}>
            <View style={s.serviceCardHeader}>
              <View style={[s.serviceColorDot, { backgroundColor: color }]} />
              <Text style={s.serviceCardName} numberOfLines={2}>{sv.service}</Text>
            </View>
            <View style={s.serviceCardStats}>
              <View style={s.serviceStatRow}>
                <Text style={s.serviceStatLabel}>Revenue</Text>
                <Text style={s.serviceStatValue}>{formatCurrency(sv.revenue)}</Text>
              </View>
              <View style={s.serviceStatRow}>
                <Text style={s.serviceStatLabel}>Profit</Text>
                <Text style={[s.serviceStatValue, { color: sv.profit >= 0 ? Colors.light.success : Colors.light.error }]}>
                  {formatCurrency(sv.profit)}
                </Text>
              </View>
              <View style={s.serviceStatRow}>
                <Text style={s.serviceStatLabel}>Orders</Text>
                <Text style={s.serviceStatValue}>{sv.orders}</Text>
              </View>
              <View style={s.serviceStatRow}>
                <Text style={s.serviceStatLabel}>Margin</Text>
                <Text style={[s.serviceStatValue, { color: margin >= 20 ? Colors.light.success : Colors.light.warning }]}>
                  {margin.toFixed(1)}%
                </Text>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ── Top Customer Cards ─────────────────────────────────────────────────────────
function TopCustomerCards({ customers }: { customers: CustomerRow[] }) {
  const { isDesktop } = useBreakpoint();
  const top10 = customers.slice(0, 10);
  const cardBasis = isDesktop ? '31%' : '100%';

  if (top10.length === 0) {
    return (
      <View style={s.emptySection}>
        <Text style={s.emptyMsg}>No customer data for this period.</Text>
      </View>
    );
  }

  const RANK_COLORS = ['#FF5A00', '#2563EB', '#7C3AED', '#0891B2', '#16A34A'];

  return (
    <View style={s.customerGrid}>
      {top10.map((c, idx) => {
        const rankColor = RANK_COLORS[Math.min(idx, RANK_COLORS.length - 1)] ?? '#6B7280';
        return (
          <View key={c.name} style={[s.customerCard, { flexBasis: cardBasis as any }]}>
            <View style={s.customerCardHeader}>
              <View style={[s.rankBadge, { backgroundColor: rankColor + '18', borderColor: rankColor + '40' }]}>
                <Text style={[s.rankText, { color: rankColor }]}>#{idx + 1}</Text>
              </View>
              <Text style={s.customerCardName} numberOfLines={2}>{c.name}</Text>
            </View>
            <View style={s.customerCardStats}>
              <View style={s.customerStatCol}>
                <Text style={s.customerStatValue}>{formatCurrency(c.revenue)}</Text>
                <Text style={s.customerStatLabel}>Revenue</Text>
              </View>
              <View style={s.customerStatDivider} />
              <View style={s.customerStatCol}>
                <Text style={[s.customerStatValue, { color: c.profit >= 0 ? Colors.light.success : Colors.light.error }]}>
                  {formatCurrency(c.profit)}
                </Text>
                <Text style={s.customerStatLabel}>Profit</Text>
              </View>
              <View style={s.customerStatDivider} />
              <View style={s.customerStatCol}>
                <Text style={s.customerStatValue}>{c.orders}</Text>
                <Text style={s.customerStatLabel}>Orders</Text>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ── Customer Concentration ────────────────────────────────────────────────────
function CustomerConcentrationSection({
  concentration,
}: {
  concentration: { top1: number; top5: number; top10: number };
}) {
  const items = [
    { label: 'Top Customer', value: `${concentration.top1}%`, hint: 'of total revenue' },
    { label: 'Top 5 Customers', value: `${concentration.top5}%`, hint: 'of total revenue' },
    { label: 'Top 10 Customers', value: `${concentration.top10}%`, hint: 'of total revenue' },
  ];
  return (
    <View style={s.concRow}>
      {items.map((item, i) => (
        <React.Fragment key={item.label}>
          {i > 0 && <View style={s.concDivider} />}
          <View style={s.concCard}>
            <Text style={s.concLabel}>{item.label}</Text>
            <Text style={[
              s.concValue,
              { color: item.value === '0%' ? Colors.light.textSecondary : Colors.light.text },
            ]}>{item.value}</Text>
            <Text style={s.concHint}>{item.hint}</Text>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}

// ── Recent Reconciliations Table ───────────────────────────────────────────────
function RecentReconciliationsTable({ quotes }: { quotes: Quote[] }) {
  if (quotes.length === 0) {
    return (
      <View style={s.emptySection}>
        <Text style={s.emptyMsg}>No reconciled projects yet.</Text>
      </View>
    );
  }

  const cols = [
    { label: 'Project', flex: 2 },
    { label: 'Customer', flex: 2 },
    { label: 'Revenue', right: true },
    { label: 'Profit', right: true },
    { label: 'Date', flex: 1.2, right: true },
  ];

  return (
    <View style={s.reconRecentCard}>
      <TableHead cols={cols} />
      {quotes.map((q, i) => {
        const rev = getRevenue(q);
        const prof = getProfit(q);
        return (
          <View key={q.id} style={[s.tableRow, i > 0 && s.tableRowBorder]}>
            <Text style={[s.tdCell, { flex: 2 }]} numberOfLines={1}>
              {(q.projectName as string | undefined) || q.invoiceNumber || '—'}
            </Text>
            <Text style={[s.tdCell, { flex: 2 }]} numberOfLines={1}>
              {(q.personOrganization as string | undefined) || '—'}
            </Text>
            <Text style={[s.tdCell, s.tdRight]}>{formatCurrency(rev)}</Text>
            <Text style={[s.tdCell, s.tdRight, { color: prof >= 0 ? Colors.light.success : Colors.light.error }]}>
              {formatCurrency(prof)}
            </Text>
            <Text style={[s.tdCell, s.tdSm, s.tdRight, { flex: 1.2 }]}>
              {q.orderDate
                ? new Date(q.orderDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
                : '—'}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ── Needs Reconciliation Section ───────────────────────────────────────────────
function NeedsReconciliationSection({
  recon,
  onViewQueue,
}: {
  recon: { count: number; revenueWaiting: number; profitWaiting: number };
  onViewQueue?: () => void;
}) {
  return (
    <View>
      <SectionHeader
        title="NEEDS RECONCILIATION"
        action={onViewQueue ? 'View Queue' : undefined}
        onAction={onViewQueue}
      />
      <View style={s.card}>
        {recon.count === 0 ? (
          <Text style={s.emptyMsg}>No projects currently awaiting reconciliation.</Text>
        ) : (
          <View style={s.reconRow}>
            <View style={s.reconItem}>
              <Text style={s.reconValue}>{recon.count}</Text>
              <Text style={s.reconLabel}>Pending Projects</Text>
            </View>
            <View style={s.reconDivider} />
            <View style={s.reconItem}>
              <Text style={s.reconValue}>{formatCurrency(recon.revenueWaiting)}</Text>
              <Text style={s.reconLabel}>Revenue Waiting</Text>
            </View>
            <View style={s.reconDivider} />
            <View style={s.reconItem}>
              <Text style={s.reconValue}>{formatCurrency(recon.profitWaiting)}</Text>
              <Text style={s.reconLabel}>Profit Waiting</Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

// ── Overview Tab ───────────────────────────────────────────────────────────────
function OverviewTab({
  curr,
  prev,
  compareLabel,
  recon,
  customers,
  services,
  monthlyData,
  recentReconciled,
  router,
}: {
  curr: Metrics;
  prev: Metrics | null;
  compareLabel: string;
  recon: ReturnType<typeof computeReconciliationQueue>;
  customers: CustomerRow[];
  services: ServiceRow[];
  monthlyData: MonthlyPoint[];
  recentReconciled: Quote[];
  router: ReturnType<typeof useRouter>;
}) {
  const concentration = useMemo(
    () => computeConcentration(customers, curr.revenue),
    [customers, curr.revenue],
  );

  const kpis: Array<{ label: string; value: string; raw: number; prevRaw: number | null }> = [
    { label: 'Revenue', value: formatCurrency(curr.revenue), raw: curr.revenue, prevRaw: prev?.revenue ?? null },
    { label: 'Profit', value: formatCurrency(curr.profit), raw: curr.profit, prevRaw: prev?.profit ?? null },
    { label: 'Orders', value: String(curr.orders), raw: curr.orders, prevRaw: prev?.orders ?? null },
    { label: 'Avg Order', value: formatCurrency(curr.avgOrder), raw: curr.avgOrder, prevRaw: prev?.avgOrder ?? null },
    { label: 'Avg PCS', value: curr.avgPcs > 0 ? curr.avgPcs.toFixed(1) : '—', raw: curr.avgPcs, prevRaw: prev?.avgPcs ?? null },
  ];

  return (
    <View>
      {/* ── KPI Cards ── */}
      <View style={s.kpiRow}>
        {kpis.map((k) => (
          <KpiCard
            key={k.label}
            label={k.label}
            value={k.value}
            change={k.prevRaw !== null ? pctChange(k.raw, k.prevRaw) : null}
            compareLabel={compareLabel}
          />
        ))}
      </View>

      {/* ── Needs Reconciliation ── */}
      <View style={s.sectionWrap}>
        <NeedsReconciliationSection
          recon={recon}
          onViewQueue={() => router.push('/(tabs)/projects')}
        />
      </View>

      {/* ── Revenue by Service Snapshot ── */}
      <View style={s.sectionWrap}>
        <SectionHeader title="REVENUE BY SERVICE" />
        <View style={s.sectionBody}>
          <ServiceSnapshotCards services={services} />
        </View>
      </View>

      {/* ── Revenue vs Profit Chart ── */}
      <View style={s.sectionWrap}>
        <SectionHeader title="REVENUE VS PROFIT" />
        <View style={s.sectionBody}>
          <RevenueVsProfitChart data={monthlyData} />
        </View>
      </View>

      {/* ── Top Customers ── */}
      <View style={s.sectionWrap}>
        <SectionHeader
          title="TOP CUSTOMERS"
          action="View All Customers"
          onAction={() => router.push('/(tabs)/clients')}
        />
        <View style={s.sectionBody}>
          <TopCustomerCards customers={customers} />
        </View>
      </View>

      {/* ── Customer Concentration ── */}
      <View style={s.sectionWrap}>
        <SectionHeader title="CUSTOMER CONCENTRATION" />
        <View style={s.card}>
          <CustomerConcentrationSection concentration={concentration} />
        </View>
      </View>

      {/* ── Recent Reconciliations ── */}
      <View style={s.sectionWrap}>
        <SectionHeader title="RECENT RECONCILIATIONS" />
        <View style={s.sectionBody}>
          <RecentReconciliationsTable quotes={recentReconciled} />
        </View>
      </View>

      <View style={{ height: 40 }} />
    </View>
  );
}

// ── Financial Tab ──────────────────────────────────────────────────────────────
function FinancialTab({
  curr,
  recon,
  onExport,
  router,
}: {
  curr: Metrics;
  recon: ReturnType<typeof computeReconciliationQueue>;
  onExport: (type: 'quotes' | 'sales' | 'lineItems') => void;
  router: ReturnType<typeof useRouter>;
}) {
  const summaryRows: Array<{ label: string; value: string; bold?: boolean; color?: string }> = [
    { label: 'Revenue', value: formatCurrency(curr.revenue) },
    { label: 'Profit', value: formatCurrency(curr.profit), bold: true, color: curr.profit >= 0 ? Colors.light.success : Colors.light.error },
    { label: 'Orders', value: String(curr.orders) },
    { label: 'Avg Order', value: formatCurrency(curr.avgOrder) },
    { label: 'Avg PCS', value: curr.avgPcs > 0 ? curr.avgPcs.toFixed(1) : '—' },
  ];

  const exports: Array<{ key: 'quotes' | 'sales' | 'lineItems'; label: string; desc: string }> = [
    { key: 'quotes', label: 'Sales Report', desc: 'All project summaries with pricing' },
    { key: 'sales', label: 'Financial Summary Report', desc: 'Actual costs, profits & tracking data' },
    { key: 'lineItems', label: 'Reconciliation Report', desc: 'Detailed breakdown of all line items' },
  ];

  return (
    <View>
      <View style={s.sectionWrap}>
        <SectionHeader title="FINANCIAL SUMMARY" />
        <View style={s.card}>
          {summaryRows.map((r, i) => (
            <View key={r.label} style={[s.summaryRow, i > 0 && s.summaryRowBorder]}>
              <Text style={[s.summaryLabel, r.bold && s.summaryLabelBold]}>{r.label}</Text>
              <Text style={[s.summaryValue, r.bold && s.summaryValueBold, r.color ? { color: r.color } : null]}>
                {r.value}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={s.sectionWrap}>
        <NeedsReconciliationSection recon={recon} onViewQueue={() => router.push('/(tabs)/projects')} />
      </View>

      <View style={s.sectionWrap}>
        <SectionHeader title="EXPORT OPTIONS" />
        <View style={s.card}>
          {exports.map((e, i) => (
            <TouchableOpacity key={e.key} style={[s.exportRow, i > 0 && s.exportRowBorder]} onPress={() => onExport(e.key)}>
              <View style={{ flex: 1 }}>
                <Text style={s.exportLabel}>{e.label}</Text>
                <Text style={s.exportDesc}>{e.desc}</Text>
              </View>
              <View style={s.exportBtn}>
                <Download size={13} color="#fff" />
                <Text style={s.exportBtnText}>CSV</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <View style={{ height: 40 }} />
    </View>
  );
}

// ── Customers Tab ──────────────────────────────────────────────────────────────
function CustomersTab({ customers, router }: { customers: CustomerRow[]; router: ReturnType<typeof useRouter> }) {
  const [inactiveFilter, setInactiveFilter] = useState<30 | 60 | 90 | null>(null);

  const inactive = useMemo(() => {
    if (!inactiveFilter) return [];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - inactiveFilter);
    return customers.filter((c) => !c.lastOrderDate || new Date(c.lastOrderDate) < cutoff);
  }, [customers, inactiveFilter]);

  const cols = [
    { label: 'Customer', flex: 2 },
    { label: 'Revenue', right: true },
    { label: 'Profit', right: true },
    { label: 'Orders', right: true },
    { label: 'Last Order', flex: 1.3, right: true },
  ];

  return (
    <View>
      <View style={s.sectionWrap}>
        <SectionHeader title="TOP CUSTOMERS" action="View All →" onAction={() => router.push('/(tabs)/clients')} />
        <View style={s.card}>
          <TableHead cols={cols} />
          {customers.map((c, i) => (
            <View key={c.name} style={[s.tableRow, i > 0 && s.tableRowBorder]}>
              <Text style={[s.tdCell, { flex: 2 }]} numberOfLines={1}>{c.name}</Text>
              <Text style={[s.tdCell, s.tdRight]}>{formatCurrency(c.revenue)}</Text>
              <Text style={[s.tdCell, s.tdRight, { color: c.profit >= 0 ? Colors.light.success : Colors.light.error }]}>
                {formatCurrency(c.profit)}
              </Text>
              <Text style={[s.tdCell, s.tdRight]}>{c.orders}</Text>
              <Text style={[s.tdCell, s.tdRight, s.tdSm, { flex: 1.3 }]}>
                {c.lastOrderDate ? new Date(c.lastOrderDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : '—'}
              </Text>
            </View>
          ))}
          {customers.length === 0 && <Text style={s.emptyMsg}>No customer data for this period.</Text>}
        </View>
      </View>

      <View style={s.sectionWrap}>
        <SectionHeader title="INACTIVE CUSTOMERS" />
        <View style={s.card}>
          <View style={s.inactiveFilterRow}>
            <Text style={s.inactiveFilterLabel}>Inactive for:</Text>
            {([30, 60, 90] as const).map((days) => (
              <TouchableOpacity
                key={days}
                style={[s.inactivePill, inactiveFilter === days && s.inactivePillActive]}
                onPress={() => setInactiveFilter((f) => (f === days ? null : days))}
              >
                <Text style={[s.inactivePillText, inactiveFilter === days && s.inactivePillTextActive]}>
                  {days}+ days
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {inactiveFilter ? (
            inactive.length > 0 ? (
              inactive.map((c, i) => (
                <View key={c.name} style={[s.tableRow, { borderTopWidth: 1, borderTopColor: Colors.light.border }]}>
                  <Text style={[s.tdCell, { flex: 2 }]} numberOfLines={1}>{c.name}</Text>
                  <Text style={[s.tdCell, s.tdRight]}>{c.orders} order{c.orders !== 1 ? 's' : ''}</Text>
                  <Text style={[s.tdCell, s.tdRight, s.tdSm, { flex: 1.5 }]}>
                    Last: {c.lastOrderDate ? new Date(c.lastOrderDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : 'Never'}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={s.emptyMsg}>No customers inactive for {inactiveFilter}+ days.</Text>
            )
          ) : (
            <Text style={s.emptyMsg}>Select a timeframe above to view inactive customers.</Text>
          )}
        </View>
      </View>
      <View style={{ height: 40 }} />
    </View>
  );
}

// ── Services Tab ───────────────────────────────────────────────────────────────
function ServicesTab({ services }: { services: ServiceRow[] }) {
  const cols = [
    { label: 'Service', flex: 2 },
    { label: 'Revenue', right: true },
    { label: 'Profit', right: true },
    { label: 'Orders', right: true },
    { label: 'Avg Order', right: true },
    { label: 'Avg PCS', right: true },
  ];

  return (
    <View>
      <View style={s.sectionWrap}>
        <SectionHeader title="SERVICE PERFORMANCE" />
        <View style={s.card}>
          <TableHead cols={cols} />
          {services.map((sv, i) => (
            <View key={sv.service} style={[s.tableRow, i > 0 && s.tableRowBorder]}>
              <Text style={[s.tdCell, { flex: 2 }]} numberOfLines={1}>{sv.service}</Text>
              <Text style={[s.tdCell, s.tdRight]}>{formatCurrency(sv.revenue)}</Text>
              <Text style={[s.tdCell, s.tdRight, { color: sv.profit >= 0 ? Colors.light.success : Colors.light.error }]}>
                {formatCurrency(sv.profit)}
              </Text>
              <Text style={[s.tdCell, s.tdRight]}>{sv.orders}</Text>
              <Text style={[s.tdCell, s.tdRight]}>{sv.orders > 0 ? formatCurrency(sv.revenue / sv.orders) : '—'}</Text>
              <Text style={[s.tdCell, s.tdRight]}>{sv.orders > 0 ? (sv.totalPcs / sv.orders).toFixed(0) : '—'}</Text>
            </View>
          ))}
          {services.length === 0 && <Text style={s.emptyMsg}>No service data for this period.</Text>}
        </View>
      </View>
      <View style={{ height: 40 }} />
    </View>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────────
export default function ReportsScreen() {
  const router = useRouter();
  const { quotes } = useQuotes();

  const [activeTab, setActiveTab] = useState<ReportTab>('overview');
  const [dateRangeKey, setDateRangeKey] = useState<DateRangeKey>('this_year');
  const [compareKey, setCompareKey] = useState<CompareKey>('none');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  const { from, to } = useMemo(() => getDateRange(dateRangeKey, customFrom, customTo), [dateRangeKey, customFrom, customTo]);
  const compRange = useMemo(() => getComparisonRange({ from, to }, compareKey), [from, to, compareKey]);

  const filteredQuotes = useMemo(() => filterByRange(quotes, from, to), [quotes, from, to]);
  const compQuotes = useMemo(() => compRange ? filterByRange(quotes, compRange.from, compRange.to) : null, [quotes, compRange]);

  const currMetrics = useMemo(() => computeMetrics(filteredQuotes), [filteredQuotes]);
  const prevMetrics = useMemo(() => (compQuotes ? computeMetrics(compQuotes) : null), [compQuotes]);

  const customers = useMemo(() => computeTopCustomers(filteredQuotes), [filteredQuotes]);
  const services = useMemo(() => computeServiceSnapshot(filteredQuotes), [filteredQuotes]);
  const recon = useMemo(() => computeReconciliationQueue(quotes), [quotes]);
  const monthlyData = useMemo(() => computeMonthlyData(filteredQuotes), [filteredQuotes]);
  const recentReconciled = useMemo(() => computeRecentReconciliations(filteredQuotes), [filteredQuotes]);

  const compareLabel = useMemo(() => {
    if (!compRange || compareKey === 'none') return '';
    const fmt = (d: Date | null) =>
      d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : '';
    return `vs ${fmt(compRange.from)} – ${fmt(compRange.to)}`;
  }, [compRange, compareKey]);

  const handleExport = useCallback(
    async (type: 'quotes' | 'sales' | 'lineItems') => {
      const ts = new Date().toISOString().split('T')[0];
      let csv = '';
      let filename = '';
      if (type === 'quotes') {
        csv = generateQuotesCSV(filteredQuotes);
        filename = `sales_report_${ts}.csv`;
      } else if (type === 'sales') {
        csv = generateSalesCSV(filteredQuotes);
        filename = `financial_summary_${ts}.csv`;
      } else {
        csv = generateLineItemsCSV(filteredQuotes);
        filename = `reconciliation_report_${ts}.csv`;
      }
      const ok = await exportCSV(csv, filename);
      setToastMessage(ok ? `${filename} downloaded successfully!` : 'Export failed. Please try again.');
      setToastType(ok ? 'success' : 'error');
      setToastVisible(true);
    },
    [filteredQuotes],
  );

  const TABS: Array<{ key: ReportTab; label: string }> = [
    { key: 'overview', label: 'Overview' },
    { key: 'financial', label: 'Financial' },
    { key: 'customers', label: 'Customers' },
    { key: 'services', label: 'Services' },
  ];

  return (
    <View style={s.root}>
      <Toast visible={toastVisible} message={toastMessage} type={toastType} onHide={() => setToastVisible(false)} />

      {/* ── Page Header ── */}
      <View style={s.pageHeader}>
        <View style={s.pageHeaderTop}>
          <Text style={s.pageTitle}>Reports</Text>
          <View style={s.headerControls}>
            <DateRangeMenu
              selected={dateRangeKey}
              onChange={setDateRangeKey}
              customFrom={customFrom}
              customTo={customTo}
              onCustomFrom={setCustomFrom}
              onCustomTo={setCustomTo}
            />
            <CompareMenu selected={compareKey} onChange={setCompareKey} />
            <ExportMenu onExport={handleExport} />
          </View>
        </View>

        {/* Sub-tab Nav */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabsScroll} contentContainerStyle={s.tabsRow}>
          {TABS.map((t) => (
            <TouchableOpacity key={t.key} style={[s.tab, activeTab === t.key && s.tabActive]} onPress={() => setActiveTab(t.key)}>
              <Text style={[s.tabText, activeTab === t.key && s.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── Tab Content ── */}
      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'overview' && (
          <OverviewTab
            curr={currMetrics}
            prev={prevMetrics}
            compareLabel={compareLabel}
            recon={recon}
            customers={customers}
            services={services}
            monthlyData={monthlyData}
            recentReconciled={recentReconciled}
            router={router}
          />
        )}
        {activeTab === 'financial' && (
          <FinancialTab curr={currMetrics} recon={recon} onExport={handleExport} router={router} />
        )}
        {activeTab === 'customers' && <CustomersTab customers={customers} router={router} />}
        {activeTab === 'services' && <ServicesTab services={services} />}
      </ScrollView>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.light.background },
  scroll: { flex: 1 },
  content: { paddingBottom: 60 },

  pageHeader: { backgroundColor: Colors.light.surface, borderBottomWidth: 1, borderBottomColor: Colors.light.border },
  pageHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: DS.spacing.xl,
    paddingTop: DS.spacing.xl,
    paddingBottom: DS.spacing.md,
    flexWrap: 'wrap',
    gap: DS.spacing.sm,
  },
  pageTitle: { fontSize: 24, fontWeight: '800', color: Colors.light.text },
  headerControls: { flexDirection: 'row', gap: DS.spacing.sm, alignItems: 'center', flexWrap: 'wrap' },

  ddWrap: { position: 'relative' },
  ddWrapRight: {},
  headerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: DS.radius.md,
    paddingHorizontal: 11,
    paddingVertical: 8,
    backgroundColor: Colors.light.surface,
  },
  exportHeaderBtn: {
    backgroundColor: Colors.light.tint,
    borderColor: Colors.light.tint,
  },
  headerBtnText: { fontSize: 13, fontWeight: '600', color: Colors.light.textSecondary },
  dropdown: {
    position: 'absolute',
    top: 42,
    left: 0,
    minWidth: 200,
    backgroundColor: Colors.light.surface,
    borderRadius: DS.radius.md,
    borderWidth: 1,
    borderColor: Colors.light.border,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  dropdownRight: { left: undefined, right: 0 } as any,
  ddItem: { paddingHorizontal: 14, paddingVertical: 11 },
  ddItemText: { fontSize: 14, color: Colors.light.text },
  ddItemActive: { color: Colors.light.tint, fontWeight: '700' },
  customDateRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingBottom: 12 },
  customDateInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: DS.radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 12,
    color: Colors.light.text,
    outlineStyle: 'none' as any,
  },
  customDateSep: { fontSize: 12, color: Colors.light.textSecondary },
  customDateApply: { backgroundColor: Colors.light.tint, borderRadius: DS.radius.sm, paddingHorizontal: 10, paddingVertical: 6 },
  customDateApplyText: { fontSize: 12, fontWeight: '700', color: '#fff' },

  tabsScroll: { borderTopWidth: 1, borderTopColor: Colors.light.border },
  tabsRow: { flexDirection: 'row', paddingHorizontal: DS.spacing.xl },
  tab: { paddingVertical: 12, paddingHorizontal: 2, marginRight: 24, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: Colors.light.tint },
  tabText: { fontSize: 14, fontWeight: '600', color: Colors.light.textSecondary },
  tabTextActive: { color: Colors.light.tint },

  // ── Section wrappers ──
  sectionWrap: { marginBottom: 0 },
  sectionBody: { marginHorizontal: DS.spacing.xl, marginTop: DS.spacing.md, marginBottom: DS.spacing.lg },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: DS.spacing.xl,
    paddingVertical: 14,
    backgroundColor: '#000000',
    minHeight: 48,
  },
  sectionHeaderText: { fontSize: 11, fontWeight: '700', color: '#ffffff', textTransform: 'uppercase', letterSpacing: 0.6 },
  sectionActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  sectionAction: { fontSize: 12, fontWeight: '700', color: Colors.light.tint },

  // ── KPI Row ──
  kpiRow: {
    flexDirection: 'row',
    paddingHorizontal: DS.spacing.xl,
    paddingVertical: DS.spacing.lg,
    gap: 12,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: Colors.light.surface,
    borderRadius: DS.radius.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: 18,
    paddingVertical: 20,
    minHeight: 120,
    justifyContent: 'flex-start',
  },
  kpiLabel: { fontSize: 10, fontWeight: '700', color: Colors.light.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  kpiValue: { fontSize: 24, fontWeight: '800', color: Colors.light.text, marginBottom: 6 },
  kpiChangeRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 2 },
  kpiChangePct: { fontSize: 12, fontWeight: '700' },
  kpiCompare: { fontSize: 10, color: Colors.light.textSecondary },

  // ── Card ──
  card: {
    marginHorizontal: DS.spacing.xl,
    marginTop: DS.spacing.md,
    marginBottom: DS.spacing.lg,
    backgroundColor: Colors.light.surface,
    borderRadius: DS.radius.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
    overflow: 'hidden',
  },

  // ── Recon row ──
  reconRow: { flexDirection: 'row', paddingVertical: 22, paddingHorizontal: 10 },
  reconItem: { flex: 1, alignItems: 'center' },
  reconDivider: { width: 1, backgroundColor: Colors.light.border },
  reconValue: { fontSize: 22, fontWeight: '800', color: Colors.light.text, marginBottom: 4 },
  reconLabel: { fontSize: 11, color: Colors.light.textSecondary, textAlign: 'center' },

  // ── Service Cards ──
  serviceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  serviceCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: DS.radius.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
    overflow: 'hidden',
    minHeight: 150,
    flexGrow: 1,
  },
  serviceCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    backgroundColor: '#FAFAFA',
  },
  serviceColorDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  serviceCardName: { fontSize: 13, fontWeight: '700', color: Colors.light.text, flex: 1 },
  serviceCardStats: { padding: 14, gap: 6 },
  serviceStatRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  serviceStatLabel: { fontSize: 12, color: Colors.light.textSecondary },
  serviceStatValue: { fontSize: 13, fontWeight: '600', color: Colors.light.text },

  // ── Customer Cards ──
  customerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  customerCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: DS.radius.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
    overflow: 'hidden',
    minHeight: 150,
    flexGrow: 1,
  },
  customerCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    backgroundColor: '#FAFAFA',
  },
  rankBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexShrink: 0,
  },
  rankText: { fontSize: 11, fontWeight: '800' },
  customerCardName: { fontSize: 14, fontWeight: '700', color: Colors.light.text, flex: 1 },
  customerCardStats: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  customerStatCol: { flex: 1, alignItems: 'center' },
  customerStatDivider: { width: 1, backgroundColor: Colors.light.border, marginVertical: 2 },
  customerStatValue: { fontSize: 14, fontWeight: '700', color: Colors.light.text, marginBottom: 3 },
  customerStatLabel: { fontSize: 10, color: Colors.light.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },

  // ── Concentration ──
  concRow: {
    flexDirection: 'row',
    paddingVertical: 20,
    paddingHorizontal: 10,
  },
  concCard: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  concDivider: { width: 1, backgroundColor: Colors.light.border },
  concLabel: { fontSize: 11, color: Colors.light.textSecondary, textAlign: 'center', marginBottom: 6, fontWeight: '600' },
  concValue: { fontSize: 28, fontWeight: '800', color: Colors.light.text, marginBottom: 4 },
  concHint: { fontSize: 10, color: Colors.light.textSecondary, textAlign: 'center' },

  // ── Recent reconciliations table ──
  reconRecentCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: DS.radius.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
    overflow: 'hidden',
  },

  // ── Chart ──
  chartWrap: {
    backgroundColor: Colors.light.surface,
    borderRadius: DS.radius.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
    overflow: 'hidden',
    paddingTop: 16,
  },
  chartInner: { paddingVertical: 40 },
  chartEmpty: { fontSize: 13, color: Colors.light.textSecondary, marginTop: 10 },
  chartLegend: { flexDirection: 'row', gap: 20, paddingHorizontal: 20, paddingBottom: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontSize: 12, fontWeight: '600', color: Colors.light.textSecondary },

  // ── Table ──
  tableHead: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  thCell: { flex: 1, fontSize: 10, fontWeight: '700', color: Colors.light.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  thRight: { textAlign: 'right' },
  tableRow: { flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 11, alignItems: 'center' },
  tableRowBorder: { borderTopWidth: 1, borderTopColor: Colors.light.border },
  tdCell: { flex: 1, fontSize: 13, color: Colors.light.text },
  tdRight: { textAlign: 'right' },
  tdSm: { fontSize: 11, color: Colors.light.textSecondary },
  emptyMsg: { fontSize: 13, color: Colors.light.textSecondary, textAlign: 'center', paddingVertical: 20, paddingHorizontal: 14 },
  emptySection: { backgroundColor: Colors.light.surface, borderRadius: DS.radius.lg, borderWidth: 1, borderColor: Colors.light.border },

  // ── Financial summary ──
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, alignItems: 'center' },
  summaryRowBorder: { borderTopWidth: 1, borderTopColor: Colors.light.border },
  summaryLabel: { fontSize: 14, color: Colors.light.textSecondary },
  summaryLabelBold: { fontWeight: '700', color: Colors.light.text },
  summaryValue: { fontSize: 14, fontWeight: '600', color: Colors.light.text },
  summaryValueBold: { fontSize: 16, fontWeight: '800' },

  // ── Export ──
  exportRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 13, gap: 12 },
  exportRowBorder: { borderTopWidth: 1, borderTopColor: Colors.light.border },
  exportLabel: { fontSize: 14, fontWeight: '600', color: Colors.light.text },
  exportDesc: { fontSize: 12, color: Colors.light.textSecondary, marginTop: 1 },
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.light.tint, borderRadius: DS.radius.sm, paddingHorizontal: 12, paddingVertical: 7 },
  exportBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },

  // ── Inactive customers filter ──
  inactiveFilterRow: { flexDirection: 'row', alignItems: 'center', gap: DS.spacing.sm, paddingHorizontal: 14, paddingVertical: 12, flexWrap: 'wrap', borderBottomWidth: 1, borderBottomColor: Colors.light.border },
  inactiveFilterLabel: { fontSize: 12, color: Colors.light.textSecondary },
  inactivePill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: DS.radius.pill, borderWidth: 1, borderColor: Colors.light.border },
  inactivePillActive: { backgroundColor: Colors.light.tint, borderColor: Colors.light.tint },
  inactivePillText: { fontSize: 12, fontWeight: '600', color: Colors.light.textSecondary },
  inactivePillTextActive: { color: '#fff' },
});
