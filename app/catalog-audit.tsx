import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import {
  ClipboardList, CheckCircle2, AlertTriangle, XCircle, ChevronRight, RefreshCw,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import { apiFetch } from '@/lib/apiFetch';
import PageBackHeader from '@/components/PageBackHeader';

const BRAND      = Colors.light.tint;
const TEXT       = Colors.light.text;
const TEXT_LIGHT = Colors.light.textSecondary;
const BORDER     = Colors.light.border;
const SURFACE    = Colors.light.surface;
const BG         = Colors.light.background;

interface AuditProduct {
  id: string;
  styleNumber: string;
  brand: string;
  name: string;
  defaultBlankCost: number | null;
  lastCostUpdatedAt: string | null;
  colorCount: number;
  assetCount: number;
  placementCount: number;
  templateId: string | null;
  updatedAt: string;
}

interface AuditData {
  summary: { totalActive: number; quoteReady: number; mockupReady: number };
  missingCost:     AuditProduct[];
  missingColors:   AuditProduct[];
  missingAssets:   AuditProduct[];
  missingTemplate: AuditProduct[];
  staleCost:       AuditProduct[];
  neverUpdated:    AuditProduct[];
}

function SummaryCard({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <View style={s.summaryCard}>
      <Text style={[s.summaryValue, { color }]}>{value}</Text>
      <Text style={s.summaryLabel}>{label}</Text>
      <View style={s.summaryBar}>
        <View style={[s.summaryBarFill, { width: `${pct}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={s.summaryPct}>{pct}% of {total}</Text>
    </View>
  );
}

function IssueSection({
  title, description, products, color, icon, onPress,
}: {
  title: string;
  description: string;
  products: AuditProduct[];
  color: string;
  icon: React.ReactNode;
  onPress: (p: AuditProduct) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? products : products.slice(0, 5);

  if (products.length === 0) {
    return (
      <View style={s.issueSection}>
        <View style={s.issueSectionHeader}>
          <View style={[s.issueIconBox, { backgroundColor: '#F0FDF4' }]}>
            <CheckCircle2 size={18} color="#10B981" />
          </View>
          <View style={s.issueSectionMeta}>
            <Text style={s.issueSectionTitle}>{title}</Text>
            <Text style={[s.issueSectionDesc, { color: '#10B981' }]}>All clear</Text>
          </View>
          <View style={[s.issueCount, { backgroundColor: '#D1FAE5' }]}>
            <Text style={[s.issueCountText, { color: '#059669' }]}>0</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={s.issueSection}>
      <TouchableOpacity style={s.issueSectionHeader} onPress={() => setExpanded(e => !e)} activeOpacity={0.7}>
        <View style={[s.issueIconBox, { backgroundColor: `${color}18` }]}>
          {icon}
        </View>
        <View style={s.issueSectionMeta}>
          <Text style={s.issueSectionTitle}>{title}</Text>
          <Text style={s.issueSectionDesc}>{description}</Text>
        </View>
        <View style={[s.issueCount, { backgroundColor: `${color}18` }]}>
          <Text style={[s.issueCountText, { color }]}>{products.length}</Text>
        </View>
        <ChevronRight size={16} color={TEXT_LIGHT} style={{ transform: [{ rotate: expanded ? '90deg' : '0deg' }] as any }} />
      </TouchableOpacity>

      {expanded && (
        <View style={s.issueList}>
          {shown.map(p => (
            <TouchableOpacity key={p.id} style={s.issueRow} onPress={() => onPress(p)} activeOpacity={0.7}>
              <View style={s.issueRowLeft}>
                <Text style={s.issueRowStyle}>{p.styleNumber}</Text>
                <Text style={s.issueRowName} numberOfLines={1}>{p.brand} {p.name}</Text>
              </View>
              <ChevronRight size={14} color={TEXT_LIGHT} />
            </TouchableOpacity>
          ))}
          {products.length > 5 && (
            <TouchableOpacity style={s.showMoreBtn} onPress={() => setExpanded(true)}>
              <Text style={s.showMoreText}>
                {expanded ? 'Show less' : `Show ${products.length - 5} more…`}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

export default function CatalogAuditScreen() {
  const router = useRouter();
  const [data, setData] = useState<AuditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/api/products/audit');
      setData(res as AuditData);
    } catch (e: any) {
      setError(e.message || 'Failed to load audit data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const goToProduct = (p: AuditProduct) => {
    router.push(`/product/${p.id}` as any);
  };

  return (
    <View style={s.screen}>
      <PageBackHeader
        title="Product Audit"
        right={
          <TouchableOpacity onPress={load} disabled={loading} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <RefreshCw size={18} color="#fff" />
          </TouchableOpacity>
        }
      />

      {loading ? (
        <View style={s.centerBox}>
          <ActivityIndicator color={BRAND} size="large" />
          <Text style={s.loadingText}>Running audit…</Text>
        </View>
      ) : error ? (
        <View style={s.centerBox}>
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={load}>
            <Text style={s.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : data ? (
        <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Summary cards */}
          <View style={s.sectionHeader}>
            <ClipboardList size={17} color={BRAND} />
            <Text style={s.sectionTitle}>Readiness Summary</Text>
          </View>
          <View style={s.summaryRow}>
            <SummaryCard label="Total Active" value={data.summary.totalActive} total={data.summary.totalActive} color={BRAND} />
            <SummaryCard label="Quote Ready" value={data.summary.quoteReady} total={data.summary.totalActive} color="#10B981" />
            <SummaryCard label="Mockup Ready" value={data.summary.mockupReady} total={data.summary.totalActive} color="#8B5CF6" />
          </View>

          {/* Issue sections */}
          <View style={s.sectionHeader}>
            <AlertTriangle size={17} color="#D97706" />
            <Text style={s.sectionTitle}>Issues</Text>
          </View>

          <IssueSection
            title="Missing Cost"
            description="No default blank cost set — cannot pre-fill quotes"
            products={data.missingCost}
            color="#D97706"
            icon={<XCircle size={18} color="#D97706" />}
            onPress={goToProduct}
          />
          <IssueSection
            title="Missing Colors"
            description="No active color variants — cannot generate mockups"
            products={data.missingColors}
            color="#EF4444"
            icon={<XCircle size={18} color="#EF4444" />}
            onPress={goToProduct}
          />
          <IssueSection
            title="Missing Assets"
            description="Colors exist but no images uploaded"
            products={data.missingAssets}
            color="#F59E0B"
            icon={<AlertTriangle size={18} color="#F59E0B" />}
            onPress={goToProduct}
          />
          <IssueSection
            title="Missing Template / Placements"
            description="No placement template or zones defined"
            products={data.missingTemplate}
            color="#6B7280"
            icon={<AlertTriangle size={18} color="#6B7280" />}
            onPress={goToProduct}
          />
          <IssueSection
            title="Stale Cost (90+ days)"
            description="Cost not reviewed in over 90 days"
            products={data.staleCost}
            color="#6366F1"
            icon={<AlertTriangle size={18} color="#6366F1" />}
            onPress={goToProduct}
          />
          <IssueSection
            title="Never Updated (180+ days)"
            description="Product record not touched in 6+ months"
            products={data.neverUpdated}
            color="#9CA3AF"
            icon={<AlertTriangle size={18} color="#9CA3AF" />}
            onPress={goToProduct}
          />

          <View style={{ height: 40 }} />
        </ScrollView>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: TEXT_LIGHT },
  errorText: { fontSize: 14, color: '#DC2626', textAlign: 'center', marginHorizontal: 32 },
  retryBtn: {
    borderWidth: 1, borderColor: BORDER, borderRadius: 8,
    paddingVertical: 8, paddingHorizontal: 16,
  },
  retryBtnText: { fontSize: 14, color: TEXT_LIGHT },

  scrollContent: { paddingBottom: 32 },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingTop: 24, paddingBottom: 12,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: TEXT },

  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    padding: 14,
    gap: 4,
  },
  summaryValue: { fontSize: 28, fontWeight: '800' },
  summaryLabel: { fontSize: 12, color: TEXT_LIGHT, fontWeight: '500' },
  summaryBar: {
    height: 4, backgroundColor: BORDER, borderRadius: 2, marginTop: 8, overflow: 'hidden' as any,
  },
  summaryBarFill: { height: 4, borderRadius: 2 },
  summaryPct: { fontSize: 11, color: TEXT_LIGHT },

  issueSection: {
    marginHorizontal: 20,
    marginBottom: 8,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    overflow: 'hidden' as any,
  },
  issueSectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
  },
  issueIconBox: {
    width: 36, height: 36, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  issueSectionMeta: { flex: 1 },
  issueSectionTitle: { fontSize: 14, fontWeight: '600', color: TEXT },
  issueSectionDesc: { fontSize: 12, color: TEXT_LIGHT, marginTop: 1 },
  issueCount: {
    minWidth: 30, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8,
  },
  issueCountText: { fontSize: 13, fontWeight: '700' },

  issueList: { borderTopWidth: 1, borderTopColor: BORDER },
  issueRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  issueRowLeft: { flex: 1 },
  issueRowStyle: { fontSize: 11, fontWeight: '600', color: BRAND },
  issueRowName: { fontSize: 13, color: TEXT, marginTop: 1 },
  showMoreBtn: { paddingHorizontal: 14, paddingVertical: 10 },
  showMoreText: { fontSize: 13, color: BRAND },
});
