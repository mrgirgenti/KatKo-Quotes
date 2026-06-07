import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import PageBackHeader from '@/components/PageBackHeader';
import {
  CheckCircle,
  Circle,
  Package,
  MapPin,
  Layers,
  User,
  Truck,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  FileText,
  Calendar,
  LogOut,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useQuotes } from '@/contexts/QuotesContext';
import { formatDate } from '@/utils/textFormatting';
import { getTotalQuantity } from '@/utils/quoteCalculations';
import { LineItem, SIZE_LABELS, GarmentVariant, SizeQuantities, STATUS_CONFIG, Quote } from '@/types/quote';

/* ─── Size grid ─────────────────────────────────────────────── */
function SizeGridDisplay({ sizes, isPromotional }: { sizes: SizeQuantities; isPromotional: boolean }) {
  if (isPromotional) {
    return (
      <View style={styles.sizeGridRow}>
        <View style={styles.sizeCell}>
          <Text style={styles.sizeCellLabel}>QTY</Text>
          <Text style={styles.sizeCellQty}>{sizes.flat || 0}</Text>
        </View>
      </View>
    );
  }
  return (
    <>
      <View style={styles.sizeGridRow}>
        {(['xs','s','m','l'] as const).map(k => {
          const entry = SIZE_LABELS.find(sl => sl.key === k)!;
          return (
            <View key={k} style={[styles.sizeCell, !sizes[k] && styles.sizeCellEmpty]}>
              <Text style={styles.sizeCellLabel}>{entry.label}</Text>
              <Text style={[styles.sizeCellQty, !sizes[k] && styles.sizeCellQtyEmpty]}>{sizes[k] || 0}</Text>
            </View>
          );
        })}
      </View>
      <View style={[styles.sizeGridRow, { marginTop: 6 }]}>
        {(['xl','xxl','xxxl','xxxxl'] as const).map(k => {
          const entry = SIZE_LABELS.find(sl => sl.key === k)!;
          return (
            <View key={k} style={[styles.sizeCell, !sizes[k] && styles.sizeCellEmpty]}>
              <Text style={styles.sizeCellLabel}>{entry.label}</Text>
              <Text style={[styles.sizeCellQty, !sizes[k] && styles.sizeCellQtyEmpty]}>{sizes[k] || 0}</Text>
            </View>
          );
        })}
      </View>
    </>
  );
}

/* ─── Main screen ────────────────────────────────────────────── */
export default function ProductionViewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { projects, quotes, sales, markProjectComplete, markLineItemComplete, unmarkLineItemComplete, isCompletingProject } = useQuotes();

  const quote = (projects || [...quotes, ...sales]).find(q => q.id === id);
  const items = quote?.lineItems ?? [];
  const total = items.length;
  const completedCount = items.filter(i => !!i.completedAt).length;
  const allDone = completedCount === total && total > 0;

  const firstIncompleteIndex = items.findIndex(i => !i.completedAt);
  const [currentIndex, setCurrentIndex] = useState(() =>
    firstIncompleteIndex >= 0 ? firstIncompleteIndex : 0
  );

  const item = items[currentIndex];
  const isDone = item ? !!item.completedAt : false;
  const isPromotional = item?.serviceStyle === 'Promotional';

  const variants: GarmentVariant[] = item?.garmentVariants && item.garmentVariants.length > 0
    ? item.garmentVariants
    : item ? [{ product: item.product, color: item.productColor, sizes: item.sizes }] : [];
  const locations = item ? [item.location1, item.location2, item.location3, item.location4].filter(Boolean) as string[] : [];
  const totalQty = item ? getTotalQuantity(item.sizes, isPromotional) : 0;

  const goTo = useCallback((idx: number) => {
    if (idx >= 0 && idx < items.length) setCurrentIndex(idx);
  }, [items.length]);

  const handleMarkItemDone = useCallback(() => {
    if (!quote || !item) return;
    markLineItemComplete({ quoteId: quote.id, lineItemId: item.id });
  }, [quote, item, markLineItemComplete]);

  const handleUnmarkItemDone = useCallback(() => {
    if (!quote || !item) return;
    unmarkLineItemComplete({ quoteId: quote.id, lineItemId: item.id });
  }, [quote, item, unmarkLineItemComplete]);

  const handleCompleteProject = useCallback(() => {
    if (!quote) return;
    if (!allDone) {
      const incompleteItems = items
        .filter(i => !i.completedAt)
        .map(i => `  • ${i.designName || `Item ${items.indexOf(i) + 1}`}`)
        .join('\n');
      Alert.alert(
        'Items Not Completed',
        `The following items still need to be marked done:\n\n${incompleteItems}`,
        [
          { text: 'Go Back', style: 'cancel' },
          {
            text: 'Complete Anyway',
            onPress: () => {
              markProjectComplete(quote.id);
              router.replace('/(tabs)/projects');
            },
          },
        ]
      );
      return;
    }
    markProjectComplete(quote.id);
    router.replace('/(tabs)/projects');
  }, [quote, allDone, items, markProjectComplete, id, router]);

  const handleExit = useCallback(() => {
    router.replace(`/quote/${id}`);
  }, [router, id]);

  if (!quote || !item) {
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
      <Stack.Screen options={{ title: 'Production Mode', headerShown: false }} />
      <View style={styles.container}>
        <PageBackHeader title="Production Mode" />
        {/* Progress banner */}
        <View style={styles.banner}>
          <View style={styles.bannerLeft}>
            <Text style={styles.bannerClient} numberOfLines={1}>{quote.personOrganization}</Text>
            <Text style={styles.bannerProject} numberOfLines={1}>{quote.projectName}</Text>
          </View>
          <View style={styles.bannerRight}>
            <View style={[styles.itemStatusPill, isDone && styles.itemStatusPillDone]}>
              {isDone
                ? <CheckCircle size={12} color="#fff" />
                : <Circle size={12} color="rgba(255,255,255,0.7)" />}
              <Text style={styles.itemStatusText}>{isDone ? 'Done' : 'Pending'}</Text>
            </View>
            <View style={[styles.progressPill, allDone && styles.progressPillDone]}>
              <Text style={styles.progressPillText}>{completedCount}/{total} done</Text>
            </View>
          </View>
        </View>

        {/* Item detail content */}
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Mockup */}
          <View style={styles.mockupContainer}>
            {item.mockupUri ? (
              <Image source={{ uri: item.mockupUri }} style={styles.mockup} resizeMode="contain" />
            ) : (
              <View style={styles.mockupPlaceholder}>
                <Package size={48} color={Colors.light.border} />
                <Text style={styles.mockupPlaceholderText}>No mockup attached</Text>
              </View>
            )}
          </View>

          {/* Design name + service style badge */}
          <View style={styles.badgeRow}>
            <View style={styles.serviceStyleBadge}>
              <Layers size={12} color={Colors.light.tint} />
              <Text style={styles.serviceStyleBadgeText}>{item.serviceStyle}</Text>
            </View>
            <Text style={styles.designName} numberOfLines={2}>{item.designName || 'Untitled Design'}</Text>
            <Text style={styles.totalQty}>{totalQty} pcs total</Text>
          </View>

          {/* Details section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>DETAILS</Text>
            {item.applicator ? (
              <View style={styles.detailRow}>
                <User size={14} color={Colors.light.text} />
                <Text style={styles.detailLabel}>Applicator</Text>
                <Text style={styles.detailValue}>{item.applicator}</Text>
              </View>
            ) : null}
            <View style={styles.detailRow}>
              <Truck size={14} color={Colors.light.textSecondary} />
              <Text style={styles.detailLabel}>Source</Text>
              <Text style={styles.detailValue}>{item.apparelProvider || '—'}</Text>
            </View>

            {variants.length === 1 ? (
              <View style={styles.detailRow}>
                <Package size={14} color={Colors.light.textSecondary} />
                <Text style={styles.detailLabel}>Product</Text>
                <Text style={styles.detailValue}>
                  {variants[0].product || '—'}{variants[0].color ? ` — ${variants[0].color}` : ''}
                </Text>
              </View>
            ) : (
              variants.map((v, vi) => (
                <View key={vi} style={styles.detailRow}>
                  <Package size={14} color={Colors.light.textSecondary} />
                  <Text style={styles.detailLabel}>Product #{vi + 1}</Text>
                  <Text style={styles.detailValue}>
                    {v.product || '—'}{v.color ? ` — ${v.color}` : ''}
                  </Text>
                </View>
              ))
            )}

            {locations.length > 0 && (
              <View style={styles.detailRow}>
                <MapPin size={14} color={Colors.light.textSecondary} />
                <Text style={styles.detailLabel}>Locations</Text>
                <Text style={styles.detailValue}>{locations.join(', ')}</Text>
              </View>
            )}
            <View style={styles.detailRow}>
              <FileText size={14} color={Colors.light.textSecondary} />
              <Text style={styles.detailLabel}>Project Notes</Text>
              <Text style={[styles.detailValue, !item.locationDetails && styles.detailValueMuted]}>
                {item.locationDetails || 'N/A'}
              </Text>
            </View>
          </View>

          {/* Sizes — one per variant */}
          {variants.map((v, vi) => (
            <View key={vi} style={styles.section}>
              {variants.length > 1 && (
                <Text style={styles.variantHeading}>
                  {v.product}{v.color ? ` — ${v.color}` : ''}
                </Text>
              )}
              <Text style={styles.sectionTitle}>SIZE QUANTITIES</Text>
              <SizeGridDisplay sizes={v.sizes} isPromotional={isPromotional} />
              <Text style={styles.variantTotal}>
                Total: {getTotalQuantity(v.sizes, isPromotional)} pcs
              </Text>
            </View>
          ))}

          {/* Completed banner */}
          {isDone && item.completedAt && (
            <View style={styles.completedBanner}>
              <CheckCircle size={14} color="#16A34A" />
              <Text style={styles.completedBannerText}>Completed {formatDate(item.completedAt)}</Text>
            </View>
          )}

          <View style={{ height: 24 }} />
        </ScrollView>

        {/* Bottom actions */}
        <View style={styles.footer}>
          <View style={styles.footerBtns}>
            <TouchableOpacity style={styles.exitBtn} onPress={handleExit}>
              <LogOut size={17} color="#fff" />
              <Text style={styles.exitBtnText}>Exit Production</Text>
            </TouchableOpacity>

            {allDone ? (
              <TouchableOpacity
                style={[styles.completeBtn, !!isCompletingProject && styles.completeBtnDisabled]}
                onPress={handleCompleteProject}
                disabled={!!isCompletingProject}
              >
                <CheckCircle size={17} color="#fff" />
                <Text style={styles.completeBtnText}>
                  {isCompletingProject ? 'Completing…' : 'Complete Project'}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.markDoneBtn, isDone && styles.markDoneBtnDone]}
                onPress={() => isDone ? handleUnmarkItemDone() : handleMarkItemDone()}
              >
                {isDone ? <CheckSquare size={17} color="#fff" /> : <Circle size={17} color="#fff" />}
                <Text style={styles.markDoneBtnText}>{isDone ? 'Unmark Done' : 'Mark Done'}</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Prev / Next navigation */}
          {items.length > 1 && (
            <View style={styles.navRow}>
              <TouchableOpacity
                style={[styles.navBtn, currentIndex === 0 && styles.navBtnDisabled]}
                onPress={() => goTo(currentIndex - 1)}
                disabled={currentIndex === 0}
              >
                <ChevronLeft size={16} color={currentIndex === 0 ? Colors.light.border : Colors.light.tint} />
                <Text style={[styles.navBtnText, currentIndex === 0 && styles.navBtnTextDisabled]}>Prev</Text>
              </TouchableOpacity>
              <Text style={styles.navCounter}>{currentIndex + 1} of {items.length}</Text>
              <TouchableOpacity
                style={[styles.navBtn, currentIndex === items.length - 1 && styles.navBtnDisabled]}
                onPress={() => goTo(currentIndex + 1)}
                disabled={currentIndex === items.length - 1}
              >
                <Text style={[styles.navBtnText, currentIndex === items.length - 1 && styles.navBtnTextDisabled]}>Next</Text>
                <ChevronRight size={16} color={currentIndex === items.length - 1 ? Colors.light.border : Colors.light.tint} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </>
  );
}

/* ─── Styles ─────────────────────────────────────────────────── */
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
  bannerLeft: { flex: 1, minWidth: 0 },
  bannerClient: { fontSize: 15, fontWeight: '700', color: '#fff' },
  bannerProject: { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 1 },
  bannerRight: { alignItems: 'flex-end', gap: 6, flexShrink: 0 },
  itemStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  itemStatusPillDone: { backgroundColor: '#16A34A' },
  itemStatusText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  progressPill: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  progressPillDone: { backgroundColor: 'rgba(22,163,74,0.5)' },
  progressPillText: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.8)' },

  scrollView: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },

  /* ── Mockup ── */
  mockupContainer: {
    height: 260,
    backgroundColor: Colors.light.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.light.border,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mockup: { width: '100%', height: '100%' },
  mockupPlaceholder: { alignItems: 'center', gap: 10 },
  mockupPlaceholderText: { fontSize: 13, color: Colors.light.textSecondary },

  /* ── Badge row ── */
  badgeRow: {
    gap: 6,
  },
  serviceStyleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,90,0,0.1)',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  serviceStyleBadgeText: { fontSize: 12, fontWeight: '700', color: Colors.light.tint },
  designName: { fontSize: 20, fontWeight: '800', color: Colors.light.text, lineHeight: 26 },
  totalQty: { fontSize: 13, color: Colors.light.textSecondary },

  /* ── Section ── */
  section: {
    backgroundColor: Colors.light.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 14,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.light.textSecondary,
    letterSpacing: 0.6,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  detailLabel: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    width: 90,
    flexShrink: 0,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.light.text,
    flex: 1,
  },
  detailValueMuted: { color: Colors.light.textSecondary, fontWeight: '400' },
  variantHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 2,
  },
  variantTotal: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    fontWeight: '600',
    marginTop: 6,
  },

  /* ── Size grid ── */
  sizeGridRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  sizeCell: {
    flex: 1,
    minWidth: 48,
    alignItems: 'center',
    backgroundColor: Colors.light.background,
    borderRadius: 8,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  sizeCellEmpty: { opacity: 0.35 },
  sizeCellLabel: { fontSize: 10, fontWeight: '700', color: Colors.light.textSecondary, letterSpacing: 0.3 },
  sizeCellQty: { fontSize: 18, fontWeight: '800', color: Colors.light.text, lineHeight: 22 },
  sizeCellQtyEmpty: { color: Colors.light.textSecondary },

  /* ── Completed banner ── */
  completedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#86EFAC',
    padding: 12,
  },
  completedBannerText: { fontSize: 13, fontWeight: '600', color: '#16A34A' },

  /* ── Footer ── */
  footer: {
    padding: 16,
    paddingBottom: 24,
    backgroundColor: Colors.light.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    alignItems: 'center',
    gap: 10,
  },
  footerBtns: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    maxWidth: 480,
  },
  exitBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: Colors.light.tint,
  },
  exitBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  completeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#16A34A',
  },
  completeBtnDisabled: { opacity: 0.6 },
  completeBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  markDoneBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#7C3AED',
  },
  markDoneBtnDone: { backgroundColor: '#6B7280' },
  markDoneBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  /* ── Prev / Next nav ── */
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 480,
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.light.tint,
  },
  navBtnDisabled: { borderColor: Colors.light.border },
  navBtnText: { fontSize: 13, fontWeight: '700', color: Colors.light.tint },
  navBtnTextDisabled: { color: Colors.light.border },
  navCounter: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
});
