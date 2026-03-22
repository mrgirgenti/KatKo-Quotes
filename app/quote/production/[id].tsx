import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  Dimensions,
  FlatList,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Circle,
  Package,
  Palette,
  MapPin,
  Layers,
  User,
  Calendar,
  Hash,
  CheckSquare,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useQuotes } from '@/contexts/QuotesContext';
import { formatDate } from '@/utils/textFormatting';
import { getTotalQuantity } from '@/utils/quoteCalculations';
import { LineItem, SIZE_LABELS, SizeQuantities } from '@/types/quote';

const { width: SCREEN_W } = Dimensions.get('window');

function SizeRow({ sizes }: { sizes: SizeQuantities }) {
  const entries = SIZE_LABELS.filter(({ key }) => sizes[key] > 0);
  if (entries.length === 0) return null;
  return (
    <View style={styles.sizeGrid}>
      {entries.map(({ key, label }) => (
        <View key={key} style={styles.sizeCell}>
          <Text style={styles.sizeCellLabel}>{label}</Text>
          <Text style={styles.sizeCellQty}>{sizes[key]}</Text>
        </View>
      ))}
    </View>
  );
}

function LocationBadge({ label }: { label: string }) {
  if (!label || label.trim() === '') return null;
  return (
    <View style={styles.locationBadge}>
      <MapPin size={11} color={Colors.light.tint} />
      <Text style={styles.locationBadgeText}>{label}</Text>
    </View>
  );
}

interface LineItemCardProps {
  item: LineItem;
  index: number;
  total: number;
  completedCount: number;
  onMarkDone: () => void;
  onUnmarkDone: () => void;
}

function LineItemCard({ item, index, total, completedCount, onMarkDone, onUnmarkDone }: LineItemCardProps) {
  const qty = getTotalQuantity(item.sizes);
  const locations = [item.location1, item.location2, item.location3, item.location4].filter(Boolean) as string[];
  const isDone = !!item.completedAt;

  return (
    <ScrollView style={styles.itemCard} showsVerticalScrollIndicator={false}>
      {/* Counter pill */}
      <View style={styles.counterRow}>
        <View style={[styles.counterPill, isDone && styles.counterPillDone]}>
          <Text style={styles.counterText}>{index + 1} of {total}</Text>
        </View>
        <View style={styles.progressRow}>
          <Text style={styles.progressText}>{completedCount}/{total} complete</Text>
        </View>
      </View>

      {/* Mockup image */}
      {item.mockupUri ? (
        <View style={[styles.mockupContainer, isDone && styles.mockupContainerDone]}>
          <Image source={{ uri: item.mockupUri }} style={styles.mockupImage} resizeMode="contain" />
          {isDone && (
            <View style={styles.mockupDoneOverlay}>
              <CheckCircle size={40} color="#fff" />
              <Text style={styles.mockupDoneText}>Complete</Text>
            </View>
          )}
        </View>
      ) : (
        <View style={[styles.mockupPlaceholder, isDone && styles.mockupContainerDone]}>
          <Package size={40} color={isDone ? '#22C55E' : Colors.light.border} />
          <Text style={styles.mockupPlaceholderText}>{isDone ? 'Completed' : 'No mockup attached'}</Text>
        </View>
      )}

      {/* Design name + completion toggle */}
      <View style={styles.designRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.designName}>{item.designName || 'Untitled Design'}</Text>
          <Text style={styles.serviceStyle}>{item.serviceStyle}</Text>
        </View>
        <TouchableOpacity
          style={[styles.itemCompleteBtn, isDone && styles.itemCompleteBtnDone]}
          onPress={isDone ? onUnmarkDone : onMarkDone}
        >
          {isDone
            ? <CheckSquare size={18} color="#fff" />
            : <Circle size={18} color={Colors.light.textSecondary} />
          }
          <Text style={[styles.itemCompleteBtnText, isDone && styles.itemCompleteBtnTextDone]}>
            {isDone ? 'Done' : 'Mark Done'}
          </Text>
        </TouchableOpacity>
      </View>

      {isDone && item.completedAt && (
        <View style={styles.completedBanner}>
          <CheckCircle size={13} color="#16A34A" />
          <Text style={styles.completedBannerText}>Completed {formatDate(item.completedAt)}</Text>
        </View>
      )}

      {/* Garment info */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Package size={14} color={Colors.light.tint} />
          <Text style={styles.sectionTitle}>Garment</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Product</Text>
          <Text style={styles.infoValue}>{item.product || '—'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Color</Text>
          <View style={styles.colorRow}>
            <Palette size={12} color={Colors.light.textSecondary} />
            <Text style={styles.infoValue}>{item.productColor || '—'}</Text>
          </View>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Vendor</Text>
          <Text style={styles.infoValue}>{item.apparelProvider || '—'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Total Qty</Text>
          <Text style={[styles.infoValue, styles.infoValueBold]}>{qty}</Text>
        </View>
      </View>

      {/* Sizes */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Hash size={14} color={Colors.light.tint} />
          <Text style={styles.sectionTitle}>Sizes</Text>
        </View>
        <SizeRow sizes={item.sizes} />
        {item.garmentVariants && item.garmentVariants.length > 0 && (
          <>
            <Text style={styles.variantsLabel}>Variants</Text>
            {item.garmentVariants.map((v, i) => (
              <View key={i} style={styles.variantRow}>
                <Text style={styles.variantName}>{v.product} — {v.color}</Text>
                <SizeRow sizes={v.sizes} />
              </View>
            ))}
          </>
        )}
      </View>

      {/* Print locations */}
      {locations.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Layers size={14} color={Colors.light.tint} />
            <Text style={styles.sectionTitle}>Print Locations</Text>
          </View>
          <View style={styles.locationBadges}>
            {locations.map((loc, i) => <LocationBadge key={i} label={loc} />)}
          </View>
          {item.locationDetails ? (
            <Text style={styles.locationDetails}>{item.locationDetails}</Text>
          ) : null}
        </View>
      )}

      {/* Applicator */}
      {item.applicator ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <User size={14} color={Colors.light.tint} />
            <Text style={styles.sectionTitle}>Applicator</Text>
          </View>
          <Text style={styles.infoValue}>{item.applicator}</Text>
        </View>
      ) : null}

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

export default function ProductionViewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { projects, quotes, sales, markProjectComplete, markLineItemComplete, unmarkLineItemComplete, isCompletingProject } = useQuotes();

  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const quote = (projects || [...quotes, ...sales]).find(q => q.id === id);

  const items = quote?.lineItems ?? [];
  const total = items.length;
  const completedCount = items.filter(i => !!i.completedAt).length;
  const allDone = completedCount === total && total > 0;

  const goTo = useCallback((index: number) => {
    if (index < 0 || index >= total) return;
    setCurrentIndex(index);
    flatListRef.current?.scrollToIndex({ index, animated: true });
  }, [total]);

  const handleMarkItemDone = useCallback((itemId: string) => {
    if (!quote) return;
    markLineItemComplete({ quoteId: quote.id, lineItemId: itemId });
  }, [quote, markLineItemComplete]);

  const handleUnmarkItemDone = useCallback((itemId: string) => {
    if (!quote) return;
    unmarkLineItemComplete({ quoteId: quote.id, lineItemId: itemId });
  }, [quote, unmarkLineItemComplete]);

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

  const handleMarkAllComplete = () => {
    const message = allDone
      ? 'All items are already complete. Mark project as Completed?'
      : `${completedCount} of ${total} items done. Mark all remaining items and the project as Completed?`;

    Alert.alert(
      'Mark Project Complete',
      message,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete Project',
          style: 'default',
          onPress: () => {
            markProjectComplete(quote.id);
            router.replace(`/quote/${id}`);
          },
        },
      ]
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Production',
          headerStyle: { backgroundColor: Colors.light.background },
          headerTintColor: Colors.light.text,
          headerTitleStyle: { fontWeight: '700' },
        }}
      />
      <View style={styles.container}>
        {/* Quote header banner */}
        <View style={styles.quoteBanner}>
          <View style={styles.quoteBannerLeft}>
            <User size={14} color={Colors.light.tint} />
            <Text style={styles.quoteBannerClient} numberOfLines={1}>{quote.personOrganization}</Text>
            <Text style={styles.quoteBannerProject} numberOfLines={1}>· {quote.projectName}</Text>
          </View>
          <View style={styles.quoteBannerRight}>
            <View style={[styles.progressPill, allDone && styles.progressPillDone]}>
              <Text style={[styles.progressPillText, allDone && styles.progressPillTextDone]}>
                {completedCount}/{total} done
              </Text>
            </View>
          </View>
        </View>

        {/* Item carousel */}
        <FlatList
          ref={flatListRef}
          data={items}
          keyExtractor={item => item.id}
          horizontal
          pagingEnabled
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <View style={{ width: SCREEN_W }}>
              <LineItemCard
                item={item}
                index={index}
                total={total}
                completedCount={completedCount}
                onMarkDone={() => handleMarkItemDone(item.id)}
                onUnmarkDone={() => handleUnmarkItemDone(item.id)}
              />
            </View>
          )}
          style={styles.carousel}
        />

        {/* Navigation row */}
        <View style={styles.navRow}>
          <TouchableOpacity
            style={[styles.navBtn, currentIndex === 0 && styles.navBtnDisabled]}
            onPress={() => goTo(currentIndex - 1)}
            disabled={currentIndex === 0}
          >
            <ChevronLeft size={22} color={currentIndex === 0 ? Colors.light.border : Colors.light.tint} />
            <Text style={[styles.navBtnText, currentIndex === 0 && styles.navBtnTextDisabled]}>Prev</Text>
          </TouchableOpacity>

          <View style={styles.dots}>
            {items.map((item, i) => (
              <TouchableOpacity key={i} onPress={() => goTo(i)}>
                <View style={[
                  styles.dot,
                  i === currentIndex && styles.dotActive,
                  item.completedAt ? styles.dotDone : null,
                ]} />
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.navBtn, currentIndex === total - 1 && styles.navBtnDisabled]}
            onPress={() => goTo(currentIndex + 1)}
            disabled={currentIndex === total - 1}
          >
            <Text style={[styles.navBtnText, currentIndex === total - 1 && styles.navBtnTextDisabled]}>Next</Text>
            <ChevronRight size={22} color={currentIndex === total - 1 ? Colors.light.border : Colors.light.tint} />
          </TouchableOpacity>
        </View>

        {/* Complete Project */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.completeBtn, isCompletingProject && styles.completeBtnDisabled, allDone && styles.completeBtnAllDone]}
            onPress={handleMarkAllComplete}
            disabled={!!isCompletingProject}
          >
            <CheckCircle size={20} color="#fff" />
            <Text style={styles.completeBtnText}>
              {isCompletingProject
                ? 'Completing…'
                : allDone
                  ? 'Mark Project Complete ✓'
                  : `Complete Project (${completedCount}/${total} done)`}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  notFoundText: {
    fontSize: 16,
    color: Colors.light.textSecondary,
  },
  backLink: { padding: 8 },
  backLinkText: {
    color: Colors.light.tint,
    fontSize: 15,
    fontWeight: '600',
  },

  quoteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.light.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    gap: 8,
  },
  quoteBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  quoteBannerClient: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.light.text,
    flexShrink: 1,
  },
  quoteBannerProject: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    flexShrink: 1,
  },
  quoteBannerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  progressPill: {
    backgroundColor: Colors.light.border,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  progressPillDone: { backgroundColor: '#D1FAE5' },
  progressPillText: { fontSize: 12, fontWeight: '700', color: Colors.light.textSecondary },
  progressPillTextDone: { color: '#16A34A' },

  carousel: { flex: 1 },

  itemCard: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },

  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  counterPill: {
    backgroundColor: Colors.light.tint,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  counterPillDone: { backgroundColor: '#16A34A' },
  counterText: { fontSize: 13, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },
  progressRow: {},
  progressText: { fontSize: 12, color: Colors.light.textSecondary },

  mockupContainer: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Colors.light.surface,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  mockupContainerDone: {
    borderColor: '#86EFAC',
    borderWidth: 2,
  },
  mockupImage: { width: '100%', height: '100%' },
  mockupDoneOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(22,163,74,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  mockupDoneText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  mockupPlaceholder: {
    width: '100%',
    height: 120,
    borderRadius: 12,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    gap: 8,
  },
  mockupPlaceholderText: { fontSize: 13, color: Colors.light.textSecondary },

  designRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 6,
  },
  designName: {
    fontSize: 19,
    fontWeight: '800',
    color: Colors.light.text,
    marginBottom: 2,
  },
  serviceStyle: {
    fontSize: 12,
    color: Colors.light.tint,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  itemCompleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    marginTop: 2,
  },
  itemCompleteBtnDone: {
    borderColor: '#16A34A',
    backgroundColor: '#16A34A',
  },
  itemCompleteBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  itemCompleteBtnTextDone: { color: '#fff' },

  completedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  completedBannerText: { fontSize: 12, color: '#16A34A', fontWeight: '600' },

  section: {
    marginBottom: 12,
    backgroundColor: Colors.light.surface,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    gap: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.light.tint,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  infoLabel: { fontSize: 13, color: Colors.light.textSecondary, flex: 1 },
  infoValue: { fontSize: 13, color: Colors.light.text, fontWeight: '500', textAlign: 'right' },
  infoValueBold: { fontWeight: '700', fontSize: 14 },
  colorRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },

  sizeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  sizeCell: {
    minWidth: 44,
    backgroundColor: Colors.light.background,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
  },
  sizeCellLabel: { fontSize: 10, fontWeight: '600', color: Colors.light.textSecondary, textTransform: 'uppercase' },
  sizeCellQty: { fontSize: 16, fontWeight: '700', color: Colors.light.text },

  variantsLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.light.textSecondary,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  variantRow: { gap: 6, marginBottom: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: Colors.light.border },
  variantName: { fontSize: 12, fontWeight: '600', color: Colors.light.text },

  locationBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,90,0,0.08)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,90,0,0.2)',
  },
  locationBadgeText: { fontSize: 12, color: Colors.light.tint, fontWeight: '600' },
  locationDetails: { fontSize: 12, color: Colors.light.textSecondary, marginTop: 4, lineHeight: 17 },

  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    backgroundColor: Colors.light.surface,
  },
  navBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 8, borderRadius: 8 },
  navBtnDisabled: { opacity: 0.35 },
  navBtnText: { fontSize: 14, fontWeight: '600', color: Colors.light.tint },
  navBtnTextDisabled: { color: Colors.light.border },
  dots: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.light.border },
  dotActive: { backgroundColor: Colors.light.tint, width: 18 },
  dotDone: { backgroundColor: '#22C55E' },

  footer: {
    padding: 16,
    paddingBottom: 28,
    backgroundColor: Colors.light.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  completeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.tint,
    borderRadius: 12,
    paddingVertical: 15,
    gap: 8,
  },
  completeBtnAllDone: { backgroundColor: '#16A34A' },
  completeBtnDisabled: { opacity: 0.6 },
  completeBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
