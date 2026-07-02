'use client';
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Truck } from 'lucide-react-native';
import PageBackHeader from '@/components/PageBackHeader';
import Colors from '@/constants/colors';

const BRAND      = Colors.light.tint;
const TEXT       = Colors.light.text;
const TEXT_LIGHT = Colors.light.textSecondary;
const BORDER     = Colors.light.border;
const BG         = Colors.light.background;
const SURFACE    = Colors.light.surface;

export default function ProductionVendorsPage() {
  return (
    <View style={s.screen}>
      <PageBackHeader title="Production Vendors" />

      <View style={s.body}>
        <View style={s.pageHeader}>
          <Truck size={22} color={BRAND} />
          <Text style={s.pageTitle}>Production Vendors</Text>
        </View>
        <Text style={s.pageHint}>
          Manage screen printers, embroiderers, DTF shops, and other production service providers. Future service calculators will reference vendors defined here.
        </Text>

        <View style={s.emptyCard}>
          <Truck size={40} color={BORDER} />
          <Text style={s.emptyTitle}>Coming Soon</Text>
          <Text style={s.emptyBody}>
            Production vendor management is planned for a future release.{'\n'}
            Vendors will be available for selection inside each service calculator.
          </Text>
        </View>

        <View style={s.futureSection}>
          <Text style={s.futureSectionTitle}>Planned Capabilities</Text>
          {[
            'Add and manage vendors by service type',
            'Set primary contact, phone, email, website, and address',
            'Track lead times per vendor',
            'Active / Inactive status management',
            'Link vendors to service calculators',
            'Pricing Matrices (future)',
            'Rush Rules (future)',
            'Shipping Rules (future)',
          ].map((item, i) => (
            <View key={i} style={s.futureItem}>
              <View style={s.futureDot} />
              <Text style={s.futureItemText}>{item}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  body: { flex: 1, paddingHorizontal: 20, paddingVertical: 16 },

  pageHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  pageTitle:  { fontSize: 22, fontWeight: '700' as const, color: TEXT },
  pageHint:   { fontSize: 13, color: TEXT_LIGHT, lineHeight: 19, marginBottom: 24 },

  emptyCard: {
    borderWidth: 1, borderColor: BORDER, borderRadius: 10,
    backgroundColor: SURFACE, padding: 36,
    alignItems: 'center', marginBottom: 24,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700' as const, color: TEXT, marginTop: 14, marginBottom: 8 },
  emptyBody:  { fontSize: 13, color: TEXT_LIGHT, textAlign: 'center', lineHeight: 20 },

  futureSection: {
    borderWidth: 1, borderColor: BORDER, borderRadius: 10,
    backgroundColor: SURFACE, padding: 16,
  },
  futureSectionTitle: { fontSize: 11, fontWeight: '700' as const, color: TEXT_LIGHT, letterSpacing: 0.5, textTransform: 'uppercase' as const, marginBottom: 12 },
  futureItem: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  futureDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: BRAND },
  futureItemText: { fontSize: 13, color: TEXT },
});
