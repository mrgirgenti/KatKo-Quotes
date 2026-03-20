import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
} from 'react-native';
import { ExternalLink, BookOpen, Search } from 'lucide-react-native';
import Colors from '@/constants/colors';

interface Vendor {
  id: string;
  name: string;
  description: string;
  category: string;
  catalogUrl: string;
  websiteUrl: string;
  color: string;
  initials: string;
}

const VENDORS: Vendor[] = [
  {
    id: 'sanmar',
    name: 'SanMar',
    description: 'Leading wholesale supplier of imprintable apparel, bags and caps. Extensive catalog including popular brands like Port & Company, Sport-Tek, and more.',
    category: 'Apparel & Accessories',
    catalogUrl: 'https://www.sanmar.com/catalog',
    websiteUrl: 'https://www.sanmar.com',
    color: '#C41230',
    initials: 'SM',
  },
  {
    id: 'ssactivewear',
    name: 'S&S Activewear',
    description: 'National wholesale distributor of imprintable sportswear and activewear. Wide selection of brands including Gildan, Next Level, and Bella+Canvas.',
    category: 'Apparel & Accessories',
    catalogUrl: 'https://www.ssactivewear.com/category/Catalog',
    websiteUrl: 'https://www.ssactivewear.com',
    color: '#003087',
    initials: 'SS',
  },
  {
    id: 'mccreary',
    name: "McCreary's",
    description: 'Regional apparel and promotional products supplier. Reliable source for a wide variety of blank garments and promotional items.',
    category: 'Apparel & Promotional',
    catalogUrl: 'https://www.mccrearyspromoproducts.com',
    websiteUrl: 'https://www.mccrearyspromoproducts.com',
    color: '#1A6B3C',
    initials: 'MC',
  },
  {
    id: 'laapparel',
    name: 'LA Apparel',
    description: 'Premium basics made in the USA. Known for high quality, heavyweight garments with a fashion-forward fit. Great for retail and premium brands.',
    category: 'Premium Apparel',
    catalogUrl: 'https://laapparel.com/pages/catalog',
    websiteUrl: 'https://laapparel.com',
    color: '#000000',
    initials: 'LA',
  },
  {
    id: 'nextlevel',
    name: 'Next Level Apparel',
    description: 'Fashion-forward premium basics with a modern fit. Popular for DTG, DTF, and screen printing projects. Rings and yarns for superior softness.',
    category: 'Premium Apparel',
    catalogUrl: 'https://www.nextlevelapparel.com/collections/all',
    websiteUrl: 'https://www.nextlevelapparel.com',
    color: '#2C2C2C',
    initials: 'NL',
  },
  {
    id: 'bella',
    name: 'Bella+Canvas',
    description: 'Industry leader in sustainable, soft basics. Made ethically in the USA and Peru. Soft triblend and jersey fabrics perfect for fashion brands.',
    category: 'Premium Apparel',
    catalogUrl: 'https://www.bellacanvas.com/styles',
    websiteUrl: 'https://www.bellacanvas.com',
    color: '#8B1A1A',
    initials: 'BC',
  },
  {
    id: 'gildan',
    name: 'Gildan',
    description: 'One of the world\'s largest suppliers of basic activewear. Affordable, durable, and widely available. Ideal for high-volume and budget-conscious orders.',
    category: 'Value Apparel',
    catalogUrl: 'https://www.gildan.com/us/activewear',
    websiteUrl: 'https://www.gildan.com',
    color: '#002F6C',
    initials: 'GD',
  },
  {
    id: 'alphabroder',
    name: 'alphabroder',
    description: 'One of North America\'s largest wholesale distributors of imprintable sportswear and promotional products with an extensive product selection.',
    category: 'Apparel & Accessories',
    catalogUrl: 'https://www.alphabroder.com/catalog',
    websiteUrl: 'https://www.alphabroder.com',
    color: '#E4002B',
    initials: 'AB',
  },
];

const CATEGORIES = ['All', 'Apparel & Accessories', 'Premium Apparel', 'Value Apparel', 'Apparel & Promotional'];

export default function CatalogsScreen() {
  const [selectedCategory, setSelectedCategory] = useState('All');

  const filtered = selectedCategory === 'All'
    ? VENDORS
    : VENDORS.filter((v) => v.category === selectedCategory);

  const openLink = (url: string) => {
    Linking.openURL(url);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>Vendor Catalogs</Text>
          <Text style={styles.pageSubtitle}>Browse catalogs from our trusted suppliers</Text>
        </View>
      </View>

      {/* Category filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}
      >
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[styles.filterChip, selectedCategory === cat && styles.filterChipActive]}
            onPress={() => setSelectedCategory(cat)}
          >
            <Text style={[styles.filterChipText, selectedCategory === cat && styles.filterChipTextActive]}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Vendor grid */}
      <View style={styles.vendorGrid}>
        {filtered.map((vendor) => (
          <View key={vendor.id} style={styles.vendorCard}>
            <View style={styles.vendorCardTop}>
              <View style={[styles.vendorAvatar, { backgroundColor: vendor.color }]}>
                <Text style={styles.vendorInitials}>{vendor.initials}</Text>
              </View>
              <View style={styles.vendorMeta}>
                <Text style={styles.vendorName}>{vendor.name}</Text>
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryBadgeText}>{vendor.category}</Text>
                </View>
              </View>
            </View>

            <Text style={styles.vendorDescription}>{vendor.description}</Text>

            <View style={styles.vendorActions}>
              <TouchableOpacity
                style={styles.catalogBtn}
                onPress={() => openLink(vendor.catalogUrl)}
              >
                <BookOpen size={15} color="#fff" />
                <Text style={styles.catalogBtnText}>View Catalog</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.websiteBtn}
                onPress={() => openLink(vendor.websiteUrl)}
              >
                <ExternalLink size={15} color={Colors.light.tint} />
                <Text style={styles.websiteBtnText}>Website</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.addVendorNote}>
        <BookOpen size={20} color={Colors.light.textSecondary} />
        <Text style={styles.addVendorText}>
          More vendor integrations and searchable catalogs coming soon.
          Contact us to request a specific vendor.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  content: {
    paddingHorizontal: 24,
    paddingVertical: 24,
    paddingBottom: 40,
  },
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '800' as const,
    color: Colors.light.text,
  },
  pageSubtitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginTop: 4,
  },
  filterScroll: {
    marginBottom: 20,
    marginHorizontal: -24,
  },
  filterContent: {
    paddingHorizontal: 24,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  filterChipActive: {
    backgroundColor: Colors.light.tint,
    borderColor: Colors.light.tint,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.light.textSecondary,
  },
  filterChipTextActive: {
    color: '#fff',
    fontWeight: '600' as const,
  },
  vendorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  vendorCard: {
    flex: 1,
    minWidth: 280,
    backgroundColor: Colors.light.surface,
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.light.border,
    gap: 14,
  },
  vendorCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  vendorAvatar: {
    width: 52,
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  vendorInitials: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: '#fff',
    letterSpacing: 0.5,
  },
  vendorMeta: {
    flex: 1,
    gap: 4,
  },
  vendorName: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.light.highlightBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.light.highlight,
  },
  vendorDescription: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    lineHeight: 19,
  },
  vendorActions: {
    flexDirection: 'row',
    gap: 10,
  },
  catalogBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.light.tint,
    paddingVertical: 10,
    borderRadius: 8,
  },
  catalogBtnText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#fff',
  },
  websiteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.tint,
  },
  websiteBtnText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.tint,
  },
  addVendorNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: Colors.light.surface,
    borderRadius: 10,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  addVendorText: {
    flex: 1,
    fontSize: 13,
    color: Colors.light.textSecondary,
    lineHeight: 18,
  },
});
