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
  Package,
  Palette,
  MapPin,
  Layers,
  User,
  Calendar,
  Hash,
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

function LineItemCard({ item, index, total }: { item: LineItem; index: number; total: number }) {
  const qty = getTotalQuantity(item.sizes);
  const locations = [item.location1, item.location2, item.location3, item.location4].filter(Boolean) as string[];

  return (
    <ScrollView style={styles.itemCard} showsVerticalScrollIndicator={false}>
      {/* Counter pill */}
      <View style={styles.counterRow}>
        <View style={styles.counterPill}>
          <Text style={styles.counterText}>{index + 1} of {total}</Text>
        </View>
      </View>

      {/* Mockup image */}
      {item.mockupUri ? (
        <View style={styles.mockupContainer}>
          <Image source={{ uri: item.mockupUri }} style={styles.mockupImage} resizeMode="contain" />
        </View>
      ) : (
        <View style={styles.mockupPlaceholder}>
          <Package size={40} color={Colors.light.border} />
          <Text style={styles.mockupPlaceholderText}>No mockup attached</Text>
        </View>
      )}

      {/* Design name */}
      <Text style={styles.designName}>{item.designName || 'Untitled Design'}</Text>
      <Text style={styles.serviceStyle}>{item.serviceStyle}</Text>

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
  const { quotes, convertToSale, isConverting } = useQuotes();

  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const quote = quotes.find(q => q.id === id);

  if (!quote) {
    return (
      <View style={styles.centered}>
        <Text style={styles.notFoundText}>Quote not found.</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const items = quote.lineItems;
  const total = items.length;

  const goTo = useCallback((index: number) => {
    if (index < 0 || index >= total) return;
    setCurrentIndex(index);
    flatListRef.current?.scrollToIndex({ index, animated: true });
  }, [total]);

  const handleMarkComplete = () => {
    Alert.alert(
      'Mark Complete',
      'This will convert the quote to a Sale. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Complete',
          style: 'default',
          onPress: async () => {
            await convertToSale(quote.id);
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
          title: 'Production View',
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
          </View>
          <View style={styles.quoteBannerRight}>
            <Calendar size={13} color={Colors.light.textSecondary} />
            <Text style={styles.quoteBannerDate}>{formatDate(quote.inHandsDate)}</Text>
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
              <LineItemCard item={item} index={index} total={total} />
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

          {/* Dot indicators */}
          <View style={styles.dots}>
            {items.map((_, i) => (
              <TouchableOpacity key={i} onPress={() => goTo(i)}>
                <View style={[styles.dot, i === currentIndex && styles.dotActive]} />
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

        {/* Mark Complete */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.completeBtn, isConverting && styles.completeBtnDisabled]}
            onPress={handleMarkComplete}
            disabled={isConverting}
          >
            <CheckCircle size={20} color="#fff" />
            <Text style={styles.completeBtnText}>{isConverting ? 'Processing...' : 'Mark Complete → Convert to Sale'}</Text>
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
  backLink: {
    padding: 8,
  },
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
    flex: 1,
  },
  quoteBannerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  quoteBannerDate: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },

  carousel: {
    flex: 1,
  },

  itemCard: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },

  counterRow: {
    alignItems: 'center',
    marginBottom: 12,
  },
  counterPill: {
    backgroundColor: Colors.light.tint,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  counterText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },

  mockupContainer: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Colors.light.surface,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  mockupImage: {
    width: '100%',
    height: '100%',
  },
  mockupPlaceholder: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 8,
  },
  mockupPlaceholderText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },

  designName: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.light.text,
    marginBottom: 4,
  },
  serviceStyle: {
    fontSize: 13,
    color: Colors.light.tint,
    fontWeight: '600',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  section: {
    marginBottom: 16,
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
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 12,
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
  infoLabel: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    flex: 1,
  },
  infoValue: {
    fontSize: 13,
    color: Colors.light.text,
    fontWeight: '500',
    textAlign: 'right',
  },
  infoValueBold: {
    fontWeight: '700',
    fontSize: 14,
  },
  colorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  sizeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
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
  sizeCellLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
  },
  sizeCellQty: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.text,
  },

  variantsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.textSecondary,
    marginTop: 4,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  variantRow: {
    gap: 6,
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  variantName: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.text,
  },

  locationBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
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
  locationBadgeText: {
    fontSize: 12,
    color: Colors.light.tint,
    fontWeight: '600',
  },
  locationDetails: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 4,
    lineHeight: 17,
  },

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
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 8,
    borderRadius: 8,
  },
  navBtnDisabled: {
    opacity: 0.4,
  },
  navBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.tint,
  },
  navBtnTextDisabled: {
    color: Colors.light.border,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.light.border,
  },
  dotActive: {
    backgroundColor: Colors.light.tint,
    width: 18,
  },

  footer: {
    padding: 16,
    paddingBottom: 24,
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
  completeBtnDisabled: {
    opacity: 0.6,
  },
  completeBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
