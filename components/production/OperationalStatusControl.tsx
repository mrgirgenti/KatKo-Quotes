import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Check, ChevronDown } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { DS } from '@/constants/designSystem';
import OverlayMenu from '@/components/OverlayMenu';
import { OPERATIONAL_STATUSES, OPERATIONAL_STATUS_CONFIG } from '@/types/quote';
import type { OperationalProjectStatus } from '@/types/quote';

interface Props {
  status: OperationalProjectStatus;
  onChange: (status: OperationalProjectStatus) => void;
  align?: 'left' | 'right';
}

export function OperationalStatusControl({ status, onChange, align = 'left' }: Props) {
  const cfg = OPERATIONAL_STATUS_CONFIG[status];
  return (
    <OverlayMenu
      menuWidth={210}
      align={align}
      trigger={({ open }) => (
        <TouchableOpacity onPress={open} activeOpacity={0.7} style={styles.triggerRow}>
          <View style={[styles.badge, { backgroundColor: cfg.bg, borderColor: cfg.borderColor }]}>
            <Text style={[styles.badgeText, { color: cfg.color }]} numberOfLines={1}>{cfg.label}</Text>
          </View>
          <ChevronDown size={13} color={Colors.light.textSecondary} />
        </TouchableOpacity>
      )}
    >
      {({ close }) => (
        <ScrollView style={{ maxHeight: 320 }}>
          {OPERATIONAL_STATUSES.map((s) => {
            const c = OPERATIONAL_STATUS_CONFIG[s];
            const active = s === status;
            return (
              <TouchableOpacity
                key={s}
                style={styles.menuItem}
                onPress={() => { close(); if (!active) onChange(s); }}
              >
                <View style={[styles.dot, { backgroundColor: c.bg, borderColor: c.borderColor }]} />
                <Text style={styles.menuItemText}>{c.label}</Text>
                {active ? <Check size={14} color={Colors.light.tint} /> : <View style={{ width: 14 }} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </OverlayMenu>
  );
}

const styles = StyleSheet.create({
  triggerRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: DS.radius.pill, borderWidth: 1, maxWidth: 140 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 9 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1 },
  menuItemText: { flex: 1, fontSize: 13, fontWeight: '600', color: Colors.light.text },
});
