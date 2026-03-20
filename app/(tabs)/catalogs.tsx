import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { ExternalLink, BookOpen, Tag } from 'lucide-react-native';
import Colors from '@/constants/colors';

interface Vendor {
  id: string;
  name: string;
  description: string;
  catalogUrl: string;
  websiteUrl: string;
  color: string;
  initials: string;
}

const APPAREL_VENDORS: Vendor[] = [
  {
    id: 'sanmar',
    name: 'SanMar',
    description: 'Leading wholesale supplier of imprintable apparel, bags and caps. Extensive catalog including Port & Company, Sport-Tek, and more.',
    catalogUrl: 'https://www.sanmar.com/catalog',
    websiteUrl: 'https://www.sanmar.com',
    color: '#C41230',
    initials: 'SM',
  },
  {
    id: 'ssactivewear',
    name: 'S&S Activewear',
    description: 'National wholesale distributor of imprintable sportswear and activewear. Wide selection of top brands and the best prices in the industry.',
    catalogUrl: 'https://www.ssactivewear.com/category/Catalog',
    websiteUrl: 'https://www.ssactivewear.com',
    color: '#003087',
    initials: 'SS',
  },
  {
    id: 'mccreary',
    name: "McCreary's",
    description: 'Regional apparel and promotional products supplier. Reliable source for a wide variety of blank garments and promotional items.',
    catalogUrl: 'https://www.mccrearyspromoproducts.com',
    websiteUrl: 'https://www.mccrearyspromoproducts.com',
    color: '#1A6B3C',
    initials: 'MC',
  },
  {
    id: 'laapparel',
    name: 'LA Apparel',
    description: 'Premium basics made in the USA. Known for high quality, heavyweight garments with a fashion-forward fit. Great for retail and premium print projects.',
    catalogUrl: 'https://laapparel.com/pages/catalog',
    websiteUrl: 'https://laapparel.com',
    color: '#111111',
    initials: 'LA',
  },
  {
    id: 'independenttrading',
    name: 'Independent Trading Co.',
    description: 'Premium fleece and lifestyle apparel brand. Known for high-quality hoodies, crewnecks, and streetwear-inspired blanks at competitive wholesale prices.',
    catalogUrl: 'https://www.independenttrading.com/catalog',
    websiteUrl: 'https://www.independenttrading.com',
    color: '#1C3557',
    initials: 'ITC',
  },
  {
    id: 'shakawear',
    name: 'Shaka Wear',
    description: 'Heavyweight, high-quality basics built for decorating. Popular for oversized and streetwear aesthetics with exceptional value for high-volume orders.',
    catalogUrl: 'https://shakawear.com/pages/catalog',
    websiteUrl: 'https://shakawear.com',
    color: '#E05A00',
    initials: 'SW',
  },
  {
    id: 'augusta',
    name: 'Augusta Sportswear',
    description: 'Industry leader in performance and team sportswear. Extensive selection of sublimated and moisture-wicking apparel for teams and organizations.',
    catalogUrl: 'https://www.augustasportswear.com/catalog',
    websiteUrl: 'https://www.augustasportswear.com',
    color: '#004B8D',
    initials: 'AS',
  },
];

const PROMO_VENDORS: Vendor[] = [
  {
    id: 'katalystpromo',
    name: 'Katalyst Ko Promo',
    description: 'Our in-house promotional products line. Custom branded merchandise, giveaways, and corporate swag sourced and decorated by Katalyst Ko.',
    catalogUrl: 'https://katalystko.com',
    websiteUrl: 'https://katalystko.com',
    color: '#FF5A00',
    initials: 'KK',
  },
  {
    id: 'sinalite',
    name: 'Sinalite',
    description: 'Wholesale trade printer specializing in large-format printing, banners, signs, and display graphics. Fast turnaround for trade-only orders.',
    catalogUrl: 'https://www.sinalite.com/catalog',
    websiteUrl: 'https://www.sinalite.com',
    color: '#0066CC',
    initials: 'SL',
  },
  {
    id: 'bestofsigns',
    name: 'Best of Signs',
    description: 'Online print supplier for banners, signs, trade show displays, and vehicle graphics. Competitive pricing with a wide range of custom print products.',
    catalogUrl: 'https://www.bestofsigns.com',
    websiteUrl: 'https://www.bestofsigns.com',
    color: '#C8002D',
    initials: 'BS',
  },
  {
    id: 'signsdotcom',
    name: 'Signs.com',
    description: 'Custom sign printing made easy — banners, yard signs, window decals, and more. Instant online pricing with fast production and shipping.',
    catalogUrl: 'https://www.signs.com/signs',
    websiteUrl: 'https://www.signs.com',
    color: '#007A33',
    initials: 'SC',
  },
  {
    id: '4allpromos',
    name: '4 All Promos',
    description: 'Full-service promotional products distributor. Pens, drinkware, bags, tech accessories, and thousands of customizable items for any campaign.',
    catalogUrl: 'https://www.4allpromos.com',
    websiteUrl: 'https://www.4allpromos.com',
    color: '#6A1F8E',
    initials: '4A',
  },
  {
    id: 'jpplus',
    name: 'JP Plus',
    description: 'Promotional products and incentive merchandise. Specializing in custom-branded giveaways, awards, and recognition items for corporate clients.',
    catalogUrl: 'https://www.jpplus.com',
    websiteUrl: 'https://www.jpplus.com',
    color: '#8B4513',
    initials: 'JP',
  },
  {
    id: 'jdsindustries',
    name: 'JDS Industries',
    description: 'Wholesale supplier of awards, trophies, plaques, and recognition products. Extensive sublimation blanks and laser-engravable merchandise.',
    catalogUrl: 'https://www.jdsindustries.com/catalog',
    websiteUrl: 'https://www.jdsindustries.com',
    color: '#2D5016',
    initials: 'JDS',
  },
];

export default function CatalogsScreen() {
  const openLink = (url: string) => {
    Linking.openURL(url);
  };

  const renderVendorCard = (vendor: Vendor) => (
    <View key={vendor.id} style={styles.vendorCard}>
      <View style={styles.vendorCardTop}>
        <View style={[styles.vendorAvatar, { backgroundColor: vendor.color }]}>
          <Text style={styles.vendorInitials}>{vendor.initials}</Text>
        </View>
        <View style={styles.vendorMeta}>
          <Text style={styles.vendorName}>{vendor.name}</Text>
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
  );

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

      {/* Apparel Vendors Section */}
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIconBg, { backgroundColor: '#EEF2FF' }]}>
          <BookOpen size={16} color="#4F46E5" />
        </View>
        <View>
          <Text style={styles.sectionTitle}>Apparel Vendors</Text>
          <Text style={styles.sectionSubtitle}>{APPAREL_VENDORS.length} suppliers</Text>
        </View>
      </View>

      <View style={styles.vendorGrid}>
        {APPAREL_VENDORS.map(renderVendorCard)}
      </View>

      {/* Divider */}
      <View style={styles.sectionDivider} />

      {/* Promotional Vendors Section */}
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIconBg, { backgroundColor: '#FFF7ED' }]}>
          <Tag size={16} color={Colors.light.tint} />
        </View>
        <View>
          <Text style={styles.sectionTitle}>Promotional Vendors</Text>
          <Text style={styles.sectionSubtitle}>{PROMO_VENDORS.length} suppliers</Text>
        </View>
      </View>

      <View style={styles.vendorGrid}>
        {PROMO_VENDORS.map(renderVendorCard)}
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
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'flex-start' as const,
    marginBottom: 24,
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
  sectionHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    marginBottom: 16,
  },
  sectionIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 1,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginVertical: 28,
  },
  vendorGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
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
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 14,
  },
  vendorAvatar: {
    width: 52,
    height: 52,
    borderRadius: 12,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    flexShrink: 0,
  },
  vendorInitials: {
    fontSize: 15,
    fontWeight: '800' as const,
    color: '#fff',
    letterSpacing: 0.5,
  },
  vendorMeta: {
    flex: 1,
  },
  vendorName: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  vendorDescription: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    lineHeight: 19,
  },
  vendorActions: {
    flexDirection: 'row' as const,
    gap: 10,
  },
  catalogBtn: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
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
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
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
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
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
