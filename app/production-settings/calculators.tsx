'use client';
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Sliders } from 'lucide-react-native';
import PageBackHeader from '@/components/PageBackHeader';
import Colors from '@/constants/colors';

const BRAND      = Colors.light.tint;
const TEXT       = Colors.light.text;
const TEXT_LIGHT = Colors.light.textSecondary;
const BORDER     = Colors.light.border;
const BG         = Colors.light.background;
const SURFACE    = Colors.light.surface;

const CALCULATOR_TYPES = [
  { label: 'DTF',           desc: 'Direct-to-Film print pricing defaults and location configurations.' },
  { label: 'Screen Printing', desc: 'Screen print setup fees, color count defaults, and location rules.' },
  { label: 'Embroidery',    desc: 'Stitch count tiers, digitizing fees, and machine rate defaults.' },
  { label: 'Promotional',   desc: 'Promotional product pricing defaults and vendor configurations.' },
  { label: 'Laser',         desc: 'Laser engraving and cutting pricing defaults.' },
  { label: 'UV Printing',   desc: 'UV flatbed print pricing defaults and material configurations.' },
];

export default function ServiceCalculatorsPage() {
  return (
    <View style={s.screen}>
      <PageBackHeader title="Service Calculators" />

      <View style={s.body}>
        <View style={s.pageHeader}>
          <Sliders size={22} color={BRAND} />
          <Text style={s.pageTitle}>Service Calculators</Text>
        </View>
        <Text style={s.pageHint}>
          Configure default settings and behaviors for each service type calculator. Future service calculator settings pages will appear here.
        </Text>

        <View style={s.comingSoonBadge}>
          <Text style={s.comingSoonText}>COMING SOON</Text>
        </View>

        {CALCULATOR_TYPES.map((ct) => (
          <View key={ct.label} style={s.calcCard}>
            <View style={s.calcDot} />
            <View style={s.calcBody}>
              <Text style={s.calcTitle}>{ct.label}</Text>
              <Text style={s.calcDesc}>{ct.desc}</Text>
            </View>
            <View style={s.calcPill}>
              <Text style={s.calcPillText}>Planned</Text>
            </View>
          </View>
        ))}

        <Text style={s.footerNote}>
          Each calculator will have its own dedicated Settings page for configuring defaults, vendor links, and pricing rules.
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.light.background },
  body: { flex: 1, paddingHorizontal: 20, paddingVertical: 16 },

  pageHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  pageTitle:  { fontSize: 22, fontWeight: '700' as const, color: TEXT },
  pageHint:   { fontSize: 13, color: TEXT_LIGHT, lineHeight: 19, marginBottom: 20 },

  comingSoonBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FDE68A',
    borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 16,
  },
  comingSoonText: { fontSize: 10, fontWeight: '700' as const, color: '#92400E', letterSpacing: 0.8 },

  calcCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: BORDER, borderRadius: 8,
    backgroundColor: SURFACE, padding: 14, marginBottom: 8,
  },
  calcDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: BORDER },
  calcBody: { flex: 1 },
  calcTitle: { fontSize: 14, fontWeight: '600' as const, color: TEXT, marginBottom: 2 },
  calcDesc:  { fontSize: 12, color: TEXT_LIGHT, lineHeight: 17 },

  calcPill: {
    backgroundColor: Colors.light.background,
    borderWidth: 1, borderColor: BORDER,
    borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3,
  },
  calcPillText: { fontSize: 10, fontWeight: '600' as const, color: TEXT_LIGHT },

  footerNote: { fontSize: 12, color: TEXT_LIGHT, lineHeight: 18, marginTop: 12 },
});
