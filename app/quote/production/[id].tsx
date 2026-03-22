import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import {
  CheckCircle,
  Circle,
  Package,
  Palette,
  MapPin,
  Layers,
  User,
  Hash,
  ArrowLeft,
  CheckSquare,
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useQuotes } from '@/contexts/QuotesContext';
import { formatDate } from '@/utils/textFormatting';
import { getTotalQuantity } from '@/utils/quoteCalculations';
import { LineItem, SIZE_LABELS, SizeQuantities } from '@/types/quote';

function SizeGrid({ sizes }: { sizes: SizeQuantities }) {
  const entries = SIZE_LABELS.filter(({ key }) => sizes[key] > 0);
  if (entries.length === 0 && !sizes.flat) return <Text style={styles.noData}>No size data</Text>;
  const all = [
    ...entries.map(({ key, label }) => ({ label, qty: sizes[key] })),
    ...(sizes.flat > 0 ? [{ label: 'Flat', qty: sizes.flat }] : []),
  ];
  return (
    <View style={styles.sizeGrid}>
      {all.map(({ label, qty }) => (
        <View key={label} style={styles.sizeCell}>
          <Text style={styles.sizeCellLabel}>{label}</Text>
          <Text style={styles.sizeCellQty}>{qty}</Text>
        </View>
      ))}
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || '—'}</Text>
    </View>
  );
}

interface LineItemCardProps {
  item: LineItem;
  index: number;
  total: number;
  onMarkDone: () => void;
  onUnmarkDone: () => void;
}

function LineItemCard({ item, index, total, onMarkDone, onUnmarkDone }: LineItemCardProps) {
  const [expanded, setExpanded] = useState(true);
  const qty = getTotalQuantity(item.sizes);
  const locations = [item.location1, item.location2, item.location3, item.location4].filter(Boolean) as string[];
  const isDone = !!item.completedAt;

  return (
    <View style={[styles.itemCard, isDone && styles.itemCardDone]}>
      {/* Card header - always visible */}
      <TouchableOpacity
        style={styles.itemCardHeader}
        onPress={() => setExpanded(e => !e)}
        activeOpacity={0.7}
      >
        <View style={styles.itemCardHeaderLeft}>
          <View style={[styles.itemNumBadge, isDone && styles.itemNumBadgeDone]}>
            <Text style={styles.itemNumText}>#{index + 1}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemDesignName} numberOfLines={1}>
              {item.designName || 'Untitled Design'}
            </Text>
            <Text style={styles.itemServiceStyle} numberOfLines={1}>
              {item.serviceStyle}{item.applicator ? ` · ${item.applicator}` : ''}
            </Text>
          </View>
        </View>
        <View style={styles.itemCardHeaderRight}>
          <View style={[styles.itemStatusPill, isDone && styles.itemStatusPillDone]}>
            {isDone
              ? <CheckCircle size={12} color="#fff" />
              : <Circle size={12} color={Colors.light.textSecondary} />}
            <Text style={[styles.itemStatusText, isDone && styles.itemStatusTextDone]}>
              {isDone ? 'Done' : 'Pending'}
            </Text>
          </View>
          {expanded
            ? <ChevronUp size={16} color={Colors.light.textSecondary} />
            : <ChevronDown size={16} color={Colors.light.textSecondary} />}
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.itemCardBody}>
          {isDone && item.completedAt && (
            <View style={styles.completedBanner}>
              <CheckCircle size={13} color="#16A34A" />
              <Text style={styles.completedBannerText}>Completed {formatDate(item.completedAt)}</Text>
            </View>
          )}

          {/* Garment */}
          <View style={styles.detailSection}>
            <View style={styles.detailSectionHeader}>
              <Package size={13} color={Colors.light.tint} />
              <Text style={styles.detailSectionTitle}>Garment</Text>
            </View>
            <InfoRow label="Product" value={item.product} />
            <InfoRow label="Color" value={item.productColor} />
            <InfoRow label="Vendor" value={item.apparelProvider} />
            <InfoRow label="Total Qty" value={`${qty} pcs`} />
          </View>

          {/* Sizes */}
          <View style={styles.detailSection}>
            <View style={styles.detailSectionHeader}>
              <Hash size={13} color={Colors.light.tint} />
              <Text style={styles.detailSectionTitle}>Sizes & Quantities</Text>
            </View>
            <SizeGrid sizes={item.sizes} />
            {item.garmentVariants && item.garmentVariants.length > 0 && (
              <>
                <Text style={styles.variantsLabel}>Variants</Text>
                {item.garmentVariants.map((v, vi) => (
                  <View key={vi} style={styles.variantRow}>
                    <Text style={styles.variantName}>{v.product} — {v.color}</Text>
                    <SizeGrid sizes={v.sizes} />
                  </View>
                ))}
              </>
            )}
          </View>

          {/* Print locations */}
          {locations.length > 0 && (
            <View style={styles.detailSection}>
              <View style={styles.detailSectionHeader}>
                <Layers size={13} color={Colors.light.tint} />
                <Text style={styles.detailSectionTitle}>Print Locations</Text>
              </View>
              <View style={styles.locationBadges}>
                {locations.map((loc, li) => (
                  <View key={li} style={styles.locationBadge}>
                    <MapPin size={11} color={Colors.light.tint} />
                    <Text style={styles.locationBadgeText}>{loc}</Text>
                  </View>
                ))}
              </View>
              {item.locationDetails ? (
                <Text style={styles.locationDetails}>{item.locationDetails}</Text>
              ) : null}
            </View>
          )}

          {/* Applicator */}
          {item.applicator ? (
            <View style={styles.detailSection}>
              <View style={styles.detailSectionHeader}>
                <User size={13} color={Colors.light.tint} />
                <Text style={styles.detailSectionTitle}>Applicator</Text>
              </View>
              <Text style={styles.infoValue}>{item.applicator}</Text>
            </View>
          ) : null}

          {/* Mark Done / Unmark */}
          <TouchableOpacity
            style={[styles.markDoneBtn, isDone && styles.markDoneBtnDone]}
            onPress={isDone ? onUnmarkDone : onMarkDone}
          >
            {isDone
              ? <CheckSquare size={17} color="#fff" />
              : <Circle size={17} color="#fff" />}
            <Text style={styles.markDoneBtnText}>
              {isDone ? 'Unmark as Done' : 'Mark as Done'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export default function ProductionViewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { projects, quotes, sales, markProjectComplete, markLineItemComplete, unmarkLineItemComplete, isCompletingProject } = useQuotes();

  const quote = (projects || [...quotes, ...sales]).find(q => q.id === id);

  const items = quote?.lineItems ?? [];
  const total = items.length;
  const completedCount = items.filter(i => !!i.completedAt).length;
  const allDone = completedCount === total && total > 0;

  const handleMarkItemDone = useCallback((itemId: string) => {
    if (!quote) return;
    markLineItemComplete({ quoteId: quote.id, lineItemId: itemId });
  }, [quote, markLineItemComplete]);

  const handleUnmarkItemDone = useCallback((itemId: string) => {
    if (!quote) return;
    unmarkLineItemComplete({ quoteId: quote.id, lineItemId: itemId });
  }, [quote, unmarkLineItemComplete]);

  const handleCompleteProject = useCallback(() => {
    if (!quote) return;
    if (!allDone) {
      const incompleteItems = items
        .filter(i => !i.completedAt)
        .map((i, idx) => `  • ${i.designName || `Item ${items.indexOf(i) + 1}`}`)
        .join('\n');
      Alert.alert(
        'Items Not Completed',
        `The following line items still need to be marked done before completing the project:\n\n${incompleteItems}`,
        [
          { text: 'Go Back', style: 'cancel' },
          {
            text: 'Complete Anyway',
            onPress: () => {
              markProjectComplete(quote.id);
              router.replace(`/quote/${id}`);
            },
          },
        ]
      );
      return;
    }
    markProjectComplete(quote.id);
    router.replace(`/quote/${id}`);
  }, [quote, allDone, items, markProjectComplete, id, router]);

  if (!quote) {
    return (
      <View style={styles.centered}>
        <Text style={styles.notFoundText}>Project not found.</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Production',
          headerStyle: { backgroundColor: '#111111' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '700' },
        }}
      />
      <View style={styles.container}>
        {/* Banner */}
        <View style={styles.banner}>
          <View style={styles.bannerLeft}>
            <Text style={styles.bannerClient} numberOfLines={1}>{quote.personOrganization}</Text>
            <Text style={styles.bannerProject} numberOfLines={1}>{quote.projectName}</Text>
          </View>
          <View style={[styles.progressPill, allDone && styles.progressPillDone]}>
            <Text style={[styles.progressPillText, allDone && styles.progressPillTextDone]}>
              {completedCount}/{total} done
            </Text>
          </View>
        </View>

        {/* All line items */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
        >
          {items.map((item, index) => (
            <LineItemCard
              key={item.id}
              item={item}
              index={index}
              total={total}
              onMarkDone={() => handleMarkItemDone(item.id)}
              onUnmarkDone={() => handleUnmarkItemDone(item.id)}
            />
          ))}
          <View style={{ height: 20 }} />
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={() => router.back()}
          >
            <ArrowLeft size={17} color={Colors.light.tint} />
            <Text style={styles.saveBtnText}>Back to Project</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.completeBtn, allDone && styles.completeBtnAllDone, !!isCompletingProject && styles.completeBtnDisabled]}
            onPress={handleCompleteProject}
            disabled={!!isCompletingProject}
          >
            <CheckCircle size={17} color="#fff" />
            <Text style={styles.completeBtnText}>
              {isCompletingProject ? 'Completing…' : 'Complete Project'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  notFoundText: { fontSize: 16, color: Colors.light.textSecondary },
  backLink: { padding: 8 },
  backLinkText: { color: Colors.light.tint, fontSize: 15, fontWeight: '600' },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#111111',
    gap: 12,
  },
  bannerLeft: { flex: 1 },
  bannerClient: { fontSize: 15, fontWeight: '700', color: '#fff' },
  bannerProject: { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 1 },
  progressPill: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  progressPillDone: { backgroundColor: '#16A34A' },
  progressPillText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  progressPillTextDone: { color: '#fff' },

  scrollView: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },

  itemCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    overflow: 'hidden',
  },
  itemCardDone: { borderColor: '#86EFAC' },

  itemCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#111111',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  itemCardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  itemCardHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  itemNumBadge: {
    backgroundColor: Colors.light.tint,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexShrink: 0,
  },
  itemNumBadgeDone: { backgroundColor: '#16A34A' },
  itemNumText: { fontSize: 12, fontWeight: '700', color: '#fff' },

  itemDesignName: { fontSize: 15, fontWeight: '700', color: '#fff' },
  itemServiceStyle: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 1 },

  itemStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  itemStatusPillDone: { backgroundColor: '#16A34A' },
  itemStatusText: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
  itemStatusTextDone: { color: '#fff' },

  itemCardBody: { padding: 14, gap: 10 },

  completedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  completedBannerText: { fontSize: 12, color: '#16A34A', fontWeight: '600' },

  detailSection: {
    backgroundColor: Colors.light.background,
    borderRadius: 8,
    padding: 12,
    gap: 6,
  },
  detailSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  detailSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.light.tint,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 2,
  },
  infoLabel: { fontSize: 13, color: Colors.light.textSecondary, flex: 1 },
  infoValue: { fontSize: 13, color: Colors.light.text, fontWeight: '500', textAlign: 'right', flex: 1 },
  noData: { fontSize: 12, color: Colors.light.textSecondary, fontStyle: 'italic' },

  sizeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  sizeCell: {
    minWidth: 48,
    backgroundColor: Colors.light.surface,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: 8,
    paddingVertical: 5,
    alignItems: 'center',
  },
  sizeCellLabel: { fontSize: 10, fontWeight: '700', color: Colors.light.textSecondary, textTransform: 'uppercase' },
  sizeCellQty: { fontSize: 18, fontWeight: '800', color: Colors.light.text, marginTop: 1 },

  variantsLabel: {
    fontSize: 11, fontWeight: '600', color: Colors.light.textSecondary,
    marginTop: 6, textTransform: 'uppercase', letterSpacing: 0.3,
  },
  variantRow: { gap: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.light.border },
  variantName: { fontSize: 12, fontWeight: '600', color: Colors.light.text },

  locationBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  locationBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,90,0,0.08)',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(255,90,0,0.2)',
  },
  locationBadgeText: { fontSize: 12, color: Colors.light.tint, fontWeight: '600' },
  locationDetails: { fontSize: 12, color: Colors.light.textSecondary, marginTop: 4, lineHeight: 17 },

  markDoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.light.textSecondary,
    borderRadius: 10,
    paddingVertical: 13,
    marginTop: 4,
  },
  markDoneBtnDone: { backgroundColor: '#16A34A' },
  markDoneBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    paddingBottom: 24,
    backgroundColor: Colors.light.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.light.tint,
  },
  saveBtnText: { fontSize: 14, fontWeight: '600', color: Colors.light.tint },

  completeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.light.tint,
    borderRadius: 10,
    paddingVertical: 14,
  },
  completeBtnAllDone: { backgroundColor: '#16A34A' },
  completeBtnDisabled: { opacity: 0.6 },
  completeBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
