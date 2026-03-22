import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  Image,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
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
  X,
  FileText,
  Palette,
  Calendar,
  LogOut,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useQuotes } from '@/contexts/QuotesContext';
import { formatDate } from '@/utils/textFormatting';
import { getTotalQuantity } from '@/utils/quoteCalculations';
import { LineItem, SIZE_LABELS, GarmentVariant, SizeQuantities, getEffectiveStatus, STATUS_CONFIG, QuoteStatus, Quote } from '@/types/quote';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

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

/* ─── Project info card (matches screenshot style) ──────────── */
function ProjectInfoCard({ quote }: { quote: Quote }) {
  const status = getEffectiveStatus(quote);
  const cfg = STATUS_CONFIG[status];
  return (
    <View style={styles.projectCard}>
      <View style={styles.projectCardTop}>
        <View style={styles.projectCardBadges}>
          <View style={[styles.statusBadge, { backgroundColor: cfg.bg, borderColor: cfg.borderColor }]}>
            {status === 'completed' && <CheckCircle size={11} color={cfg.color} />}
            <Text style={[styles.statusBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
          {quote.orderType ? (
            <View style={styles.orderTypeBadge}>
              <Text style={styles.orderTypeBadgeText}>{quote.orderType}</Text>
            </View>
          ) : null}
        </View>
        {quote.invoiceNumber ? (
          <Text style={styles.invoiceNum}>#{quote.invoiceNumber}</Text>
        ) : null}
      </View>
      <Text style={styles.projectCardClient} numberOfLines={1}>{quote.personOrganization}</Text>
      <Text style={styles.projectCardProject} numberOfLines={1}>{quote.projectName}</Text>
      <View style={styles.projectCardDivider} />
      <View style={styles.projectCardDates}>
        <View style={styles.projectCardDateRow}>
          <Calendar size={13} color={Colors.light.textSecondary} />
          <Text style={styles.projectCardDateLabel}>Order Date</Text>
          <Text style={styles.projectCardDateValue}>{formatDate(quote.orderDate)}</Text>
        </View>
        {quote.inHandsDate ? (
          <View style={styles.projectCardDateRow}>
            <Calendar size={13} color={Colors.light.textSecondary} />
            <Text style={styles.projectCardDateLabel}>In-Hands</Text>
            <Text style={styles.projectCardDateValue}>{formatDate(quote.inHandsDate)}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/* ─── Detail modal ───────────────────────────────────────────── */
interface DetailModalProps {
  items: LineItem[];
  initialIndex: number;
  onClose: () => void;
  onMarkDone: (id: string) => void;
  onUnmarkDone: (id: string) => void;
}

function DetailModal({ items, initialIndex, onClose, onMarkDone, onUnmarkDone }: DetailModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const item = items[currentIndex];
  const isDone = !!item.completedAt;
  const isPromotional = item.serviceStyle === 'Promotional';

  const variants: GarmentVariant[] = item.garmentVariants && item.garmentVariants.length > 0
    ? item.garmentVariants
    : [{ product: item.product, color: item.productColor, sizes: item.sizes }];
  const locations = [item.location1, item.location2, item.location3, item.location4].filter(Boolean) as string[];
  const totalQty = getTotalQuantity(item.sizes, isPromotional);

  const goTo = (idx: number) => {
    if (idx >= 0 && idx < items.length) setCurrentIndex(idx);
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        {/* Modal header */}
        <View style={styles.modalHeader}>
          <TouchableOpacity style={styles.modalCloseBtn} onPress={onClose}>
            <X size={20} color="#fff" />
          </TouchableOpacity>
          <View style={styles.modalHeaderCenter}>
            <Text style={styles.modalItemCounter}>Item {currentIndex + 1} of {items.length}</Text>
            <Text style={styles.modalDesignName} numberOfLines={1}>
              {item.designName || 'Untitled Design'}
            </Text>
          </View>
          <View style={[styles.modalStatusPill, isDone && styles.modalStatusPillDone]}>
            {isDone ? <CheckCircle size={12} color="#fff" /> : <Circle size={12} color="rgba(255,255,255,0.7)" />}
            <Text style={styles.modalStatusText}>{isDone ? 'Done' : 'Pending'}</Text>
          </View>
        </View>

        <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
          {/* Mockup */}
          <View style={styles.modalMockupContainer}>
            {item.mockupUri ? (
              <Image source={{ uri: item.mockupUri }} style={styles.modalMockup} resizeMode="contain" />
            ) : (
              <View style={styles.modalMockupPlaceholder}>
                <Package size={48} color={Colors.light.border} />
                <Text style={styles.modalMockupPlaceholderText}>No mockup attached</Text>
              </View>
            )}
          </View>

          {/* Service style badge + total */}
          <View style={styles.modalBadgeRow}>
            <View style={styles.serviceStyleBadge}>
              <Layers size={12} color={Colors.light.tint} />
              <Text style={styles.serviceStyleBadgeText}>{item.serviceStyle}</Text>
            </View>
            <Text style={styles.modalTotalQty}>{totalQty} pcs total</Text>
          </View>

          {/* Details */}
          <View style={styles.modalSection}>
            <Text style={styles.modalSectionTitle}>DETAILS</Text>
            {item.applicator ? (
              <View style={styles.modalDetailRow}>
                <User size={14} color={Colors.light.text} />
                <Text style={styles.modalDetailLabel}>Applicator</Text>
                <Text style={styles.modalDetailValue}>{item.applicator}</Text>
              </View>
            ) : null}
            <View style={styles.modalDetailRow}>
              <Truck size={14} color={Colors.light.textSecondary} />
              <Text style={styles.modalDetailLabel}>Source</Text>
              <Text style={styles.modalDetailValue}>{item.apparelProvider || '—'}</Text>
            </View>

            {/* Product rows — combined "Product — Color" or numbered per variant */}
            {variants.length === 1 ? (
              <View style={styles.modalDetailRow}>
                <Package size={14} color={Colors.light.textSecondary} />
                <Text style={styles.modalDetailLabel}>Product</Text>
                <Text style={styles.modalDetailValue}>
                  {variants[0].product || '—'}{variants[0].color ? ` — ${variants[0].color}` : ''}
                </Text>
              </View>
            ) : (
              variants.map((v, vi) => (
                <View key={vi} style={styles.modalDetailRow}>
                  <Package size={14} color={Colors.light.textSecondary} />
                  <Text style={styles.modalDetailLabel}>Product #{vi + 1}</Text>
                  <Text style={styles.modalDetailValue}>
                    {v.product || '—'}{v.color ? ` — ${v.color}` : ''}
                  </Text>
                </View>
              ))
            )}

            {locations.length > 0 && (
              <View style={styles.modalDetailRow}>
                <MapPin size={14} color={Colors.light.textSecondary} />
                <Text style={styles.modalDetailLabel}>Locations</Text>
                <Text style={styles.modalDetailValue}>{locations.join(', ')}</Text>
              </View>
            )}
            <View style={styles.modalDetailRow}>
              <FileText size={14} color={Colors.light.textSecondary} />
              <Text style={styles.modalDetailLabel}>Project Notes</Text>
              <Text style={[styles.modalDetailValue, !item.locationDetails && styles.modalDetailValueMuted]}>
                {item.locationDetails || 'N/A'}
              </Text>
            </View>
          </View>

          {/* Sizes — one per variant */}
          {variants.map((v, vi) => (
            <View key={vi} style={styles.modalSection}>
              {variants.length > 1 && (
                <Text style={styles.modalVariantHeading}>
                  {v.product}{v.color ? ` — ${v.color}` : ''}
                </Text>
              )}
              <Text style={styles.modalSectionTitle}>SIZE QUANTITIES</Text>
              <SizeGridDisplay sizes={v.sizes} isPromotional={isPromotional} />
              <Text style={styles.modalVariantTotal}>
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

          <View style={{ height: 20 }} />
        </ScrollView>

        {/* Bottom action bar */}
        <View style={styles.modalNav}>
          {/* Action buttons — centered, medium size */}
          <View style={styles.modalActionRow}>
            <TouchableOpacity style={styles.modalExitBtn} onPress={onClose}>
              <LogOut size={17} color="#fff" />
              <Text style={styles.modalExitBtnText}>Exit Production</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalMarkDoneBtn, isDone && styles.modalMarkDoneBtnDone]}
              onPress={() => isDone ? onUnmarkDone(item.id) : onMarkDone(item.id)}
            >
              {isDone ? <CheckSquare size={17} color="#fff" /> : <Circle size={17} color="#fff" />}
              <Text style={styles.modalMarkDoneBtnText}>{isDone ? 'Unmark Done' : 'Mark Done'}</Text>
            </TouchableOpacity>
          </View>

          {/* Prev / Next navigation */}
          {items.length > 1 && (
            <View style={styles.modalNavRow}>
              <TouchableOpacity
                style={[styles.modalNavBtn, currentIndex === 0 && styles.modalNavBtnDisabled]}
                onPress={() => goTo(currentIndex - 1)}
                disabled={currentIndex === 0}
              >
                <ChevronLeft size={16} color={currentIndex === 0 ? Colors.light.border : Colors.light.tint} />
                <Text style={[styles.modalNavBtnText, currentIndex === 0 && styles.modalNavBtnTextDisabled]}>Prev</Text>
              </TouchableOpacity>
              <Text style={styles.modalNavCounter}>{currentIndex + 1} of {items.length}</Text>
              <TouchableOpacity
                style={[styles.modalNavBtn, currentIndex === items.length - 1 && styles.modalNavBtnDisabled]}
                onPress={() => goTo(currentIndex + 1)}
                disabled={currentIndex === items.length - 1}
              >
                <Text style={[styles.modalNavBtnText, currentIndex === items.length - 1 && styles.modalNavBtnTextDisabled]}>Next</Text>
                <ChevronRight size={16} color={currentIndex === items.length - 1 ? Colors.light.border : Colors.light.tint} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

/* ─── Compact card ───────────────────────────────────────────── */
interface CompactCardProps {
  item: LineItem;
  index: number;
  onPress: () => void;
}

function CompactCard({ item, index, onPress }: CompactCardProps) {
  const isDone = !!item.completedAt;
  const isPromotional = item.serviceStyle === 'Promotional';
  const qty = getTotalQuantity(item.sizes, isPromotional);
  const variants: GarmentVariant[] = item.garmentVariants && item.garmentVariants.length > 0
    ? item.garmentVariants
    : [{ product: item.product, color: item.productColor, sizes: item.sizes }];

  return (
    <TouchableOpacity style={[styles.compactCard, isDone && styles.compactCardDone]} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.compactCardLeft}>
        <View style={[styles.itemNumBadge, isDone && styles.itemNumBadgeDone]}>
          <Text style={styles.itemNumText}>#{index + 1}</Text>
        </View>
        <View style={styles.compactCardInfo}>
          <Text style={styles.compactDesignName} numberOfLines={1}>
            {item.designName || 'Untitled Design'}
          </Text>
          <View style={styles.compactMeta}>
            <View style={styles.compactServiceBadge}>
              <Text style={styles.compactServiceText}>{item.serviceStyle}</Text>
            </View>
            {item.applicator ? (
              <Text style={styles.compactApplicator} numberOfLines={1}>· {item.applicator}</Text>
            ) : null}
          </View>
          <Text style={styles.compactVariants} numberOfLines={1}>
            {variants.length === 1
              ? `${variants[0].product || ''}${variants[0].color ? ` — ${variants[0].color}` : ''}`
              : variants.map((v, vi) => `#${vi + 1}: ${v.product || ''}${v.color ? ` — ${v.color}` : ''}`).join(' · ')}
          </Text>
        </View>
      </View>
      <View style={styles.compactCardRight}>
        <Text style={styles.compactQty}>{qty}</Text>
        <Text style={styles.compactQtyLabel}>pcs</Text>
        <View style={[styles.compactStatus, isDone && styles.compactStatusDone]}>
          {isDone
            ? <CheckCircle size={14} color="#fff" />
            : <Circle size={14} color={Colors.light.textSecondary} />}
        </View>
      </View>
    </TouchableOpacity>
  );
}

/* ─── Main screen ────────────────────────────────────────────── */
export default function ProductionViewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { projects, quotes, sales, markProjectComplete, markLineItemComplete, unmarkLineItemComplete, isCompletingProject } = useQuotes();

  const [modalIndex, setModalIndex] = useState<number | null>(null);

  const quote = (projects || [...quotes, ...sales]).find(q => q.id === id);
  const items = quote?.lineItems ?? [];
  const total = items.length;
  const completedCount = items.filter(i => !!i.completedAt).length;
  const allDone = completedCount === total && total > 0;

  const handleMarkItemDone = useCallback((itemId: string) => {
    if (!quote) return;
    markLineItemComplete({ quoteId: quote.id, lineItemId: itemId });
    const remainingUndone = items.filter(i => !i.completedAt && i.id !== itemId).length;
    if (remainingUndone === 0) {
      setModalIndex(null);
    }
  }, [quote, items, markLineItemComplete]);

  const handleUnmarkItemDone = useCallback((itemId: string) => {
    if (!quote) return;
    unmarkLineItemComplete({ quoteId: quote.id, lineItemId: itemId });
  }, [quote, unmarkLineItemComplete]);

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
        {/* Progress banner */}
        <View style={styles.banner}>
          <View style={styles.bannerLeft}>
            <Text style={styles.bannerClient} numberOfLines={1}>{quote.personOrganization}</Text>
            <Text style={styles.bannerProject} numberOfLines={1}>{quote.projectName}</Text>
          </View>
          <View style={[styles.progressPill, allDone && styles.progressPillDone]}>
            <Text style={styles.progressPillText}>{completedCount}/{total} done</Text>
          </View>
        </View>

        {/* Content list */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator
        >
          {/* Project info card */}
          <ProjectInfoCard quote={quote} />

          <Text style={styles.tapHint}>Tap a line item to view details and sizes</Text>

          {items.map((item, index) => (
            <CompactCard
              key={item.id}
              item={item}
              index={index}
              onPress={() => setModalIndex(index)}
            />
          ))}
          <View style={{ height: 20 }} />
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerBtns}>
            <TouchableOpacity style={styles.exitBtn} onPress={() => router.replace(`/quote/${id}`)}>
              <LogOut size={17} color="#fff" />
              <Text style={styles.exitBtnText}>Exit Production</Text>
            </TouchableOpacity>
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
          </View>
        </View>
      </View>

      {/* Detail Modal */}
      {modalIndex !== null && (
        <DetailModal
          items={items}
          initialIndex={modalIndex}
          onClose={() => setModalIndex(null)}
          onMarkDone={handleMarkItemDone}
          onUnmarkDone={handleUnmarkItemDone}
        />
      )}
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

  scrollView: { flex: 1 },
  scrollContent: { padding: 16, gap: 10 },

  tapHint: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginBottom: 2,
  },

  /* ── Project info card ── */
  projectCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 16,
    gap: 6,
  },
  projectCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  projectCardBadges: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
  orderTypeBadge: {
    backgroundColor: 'rgba(255,90,0,0.1)',
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  orderTypeBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.light.tint },
  invoiceNum: { fontSize: 13, fontWeight: '600', color: Colors.light.textSecondary },
  projectCardClient: { fontSize: 17, fontWeight: '800', color: Colors.light.text },
  projectCardProject: { fontSize: 14, color: Colors.light.textSecondary },
  projectCardDivider: { height: 1, backgroundColor: Colors.light.border, marginVertical: 8 },
  projectCardDates: { gap: 6 },
  projectCardDateRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  projectCardDateLabel: { fontSize: 13, color: Colors.light.textSecondary, width: 80 },
  projectCardDateValue: { fontSize: 13, fontWeight: '700', color: Colors.light.text },

  /* ── Compact cards ── */
  compactCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  compactCardDone: { borderColor: '#86EFAC', backgroundColor: '#F0FDF4' },
  compactCardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 },
  compactCardInfo: { flex: 1, minWidth: 0, gap: 3 },
  compactDesignName: { fontSize: 15, fontWeight: '700', color: Colors.light.text },
  compactMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  compactServiceBadge: {
    backgroundColor: 'rgba(255,90,0,0.1)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  compactServiceText: { fontSize: 11, fontWeight: '700', color: Colors.light.tint },
  compactApplicator: { fontSize: 12, color: Colors.light.textSecondary, flexShrink: 1 },
  compactVariants: { fontSize: 12, color: Colors.light.textSecondary },
  compactCardRight: { alignItems: 'center', gap: 4, flexShrink: 0 },
  compactQty: { fontSize: 22, fontWeight: '800', color: Colors.light.text, lineHeight: 26 },
  compactQtyLabel: { fontSize: 11, color: Colors.light.textSecondary, marginTop: -4 },
  compactStatus: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.light.background,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  compactStatusDone: { backgroundColor: '#16A34A', borderColor: '#16A34A' },

  itemNumBadge: {
    backgroundColor: Colors.light.tint,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexShrink: 0,
    alignSelf: 'flex-start',
  },
  itemNumBadgeDone: { backgroundColor: '#16A34A' },
  itemNumText: { fontSize: 12, fontWeight: '700', color: '#fff' },

  /* ── Footer ── */
  footer: {
    padding: 16,
    paddingBottom: 24,
    backgroundColor: Colors.light.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    alignItems: 'center',
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
    backgroundColor: '#16A34A',
    borderRadius: 12,
    paddingVertical: 16,
  },
  completeBtnDisabled: { opacity: 0.6 },
  completeBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  /* ── Detail Modal ── */
  modalContainer: { flex: 1, backgroundColor: Colors.light.background },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#111111',
    paddingHorizontal: 14,
    paddingVertical: 12,
    paddingTop: 16,
    gap: 10,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  modalHeaderCenter: { flex: 1, alignItems: 'center' },
  modalItemCounter: { fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: '600', letterSpacing: 0.5 },
  modalDesignName: { fontSize: 16, fontWeight: '700', color: '#fff', textAlign: 'center', marginTop: 2 },
  modalStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexShrink: 0,
  },
  modalStatusPillDone: { backgroundColor: '#16A34A' },
  modalStatusText: { fontSize: 11, fontWeight: '700', color: '#fff' },

  modalScroll: { flex: 1 },
  modalContent: { padding: 16, gap: 12 },

  modalMockupContainer: {
    width: '100%',
    height: SCREEN_HEIGHT * 0.38,
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
    overflow: 'hidden',
  },
  modalMockup: { width: '100%', height: '100%' },
  modalMockupPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  modalMockupPlaceholderText: { fontSize: 13, color: Colors.light.textSecondary },

  modalBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  serviceStyleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,90,0,0.1)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  serviceStyleBadgeText: { fontSize: 12, fontWeight: '700', color: Colors.light.tint },
  modalTotalQty: { fontSize: 13, fontWeight: '600', color: Colors.light.textSecondary },

  modalSection: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  modalSectionTitle: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.light.textSecondary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  modalVariantHeading: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginBottom: 2,
  },
  modalVariantTotal: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
    textAlign: 'right',
    marginTop: 6,
  },

  modalDetailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  modalDetailLabel: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    width: 100,
    flexShrink: 0,
    marginTop: 1,
  },
  modalDetailValue: {
    fontSize: 14,
    color: Colors.light.text,
    fontWeight: '500' as const,
    flex: 1,
    lineHeight: 20,
  },
  modalDetailValueMuted: { color: Colors.light.textSecondary, fontWeight: '400' as const },

  sizeGridRow: { flexDirection: 'row', gap: 6 },
  sizeCell: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.light.background,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.light.tint,
    paddingVertical: 8,
    minWidth: 0,
  },
  sizeCellEmpty: { borderColor: Colors.light.border },
  sizeCellLabel: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  sizeCellQty: { fontSize: 20, fontWeight: '800' as const, color: Colors.light.text, lineHeight: 24 },
  sizeCellQtyEmpty: { color: Colors.light.border, fontWeight: '400' as const },

  completedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  completedBannerText: { fontSize: 13, color: '#16A34A', fontWeight: '600' },

  modalNav: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 28,
    backgroundColor: Colors.light.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    gap: 12,
    alignItems: 'center',
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    maxWidth: 480,
  },
  modalExitBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: Colors.light.tint,
    borderRadius: 12,
    paddingVertical: 16,
  },
  modalExitBtnText: { fontSize: 15, fontWeight: '700' as const, color: '#fff' },
  modalMarkDoneBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#374151',
    borderRadius: 12,
    paddingVertical: 16,
  },
  modalMarkDoneBtnDone: { backgroundColor: '#16A34A' },
  modalMarkDoneBtnText: { fontSize: 15, fontWeight: '700' as const, color: '#fff' },
  modalNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 480,
  },
  modalNavBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 8 },
  modalNavBtnDisabled: { opacity: 0.35 },
  modalNavBtnText: { fontSize: 14, fontWeight: '600' as const, color: Colors.light.tint },
  modalNavBtnTextDisabled: { color: Colors.light.border },
  modalNavCounter: { fontSize: 13, fontWeight: '600' as const, color: Colors.light.textSecondary },
});
