import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Check, ChevronDown, Flag } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { DS } from '@/constants/designSystem';
import OverlayMenu from '@/components/OverlayMenu';
import { PROJECT_PRIORITIES, PRIORITY_CONFIG, DEFAULT_PRIORITY } from '@/types/quote';
import type { ProjectPriority } from '@/types/quote';

export function PriorityBadge({ priority, small }: { priority?: ProjectPriority | null; small?: boolean }) {
  const p = (priority as ProjectPriority) || DEFAULT_PRIORITY;
  const cfg = PRIORITY_CONFIG[p];
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg, borderColor: cfg.borderColor }, small && styles.badgeSm]}>
      <Text style={[styles.badgeText, { color: cfg.color }, small && styles.badgeTextSm]}>{cfg.label}</Text>
    </View>
  );
}

interface PriorityControlProps {
  priority?: ProjectPriority | null;
  onChange: (priority: ProjectPriority) => void;
  small?: boolean;
  align?: 'left' | 'right';
}

/** Tappable priority badge that opens a picker menu. */
export function PriorityControl({ priority, onChange, small, align = 'left' }: PriorityControlProps) {
  const current = (priority as ProjectPriority) || DEFAULT_PRIORITY;
  return (
    <OverlayMenu
      menuWidth={180}
      align={align}
      trigger={({ open }) => (
        <TouchableOpacity onPress={open} activeOpacity={0.7}>
          <View style={styles.triggerRow}>
            <PriorityBadge priority={current} small={small} />
            <ChevronDown size={small ? 12 : 14} color={Colors.light.textSecondary} />
          </View>
        </TouchableOpacity>
      )}
    >
      {({ close }) => (
        <View>
          {PROJECT_PRIORITIES.map((p) => {
            const cfg = PRIORITY_CONFIG[p];
            const active = p === current;
            return (
              <TouchableOpacity
                key={p}
                style={styles.menuItem}
                onPress={() => { close(); if (p !== current) onChange(p); }}
              >
                <Flag size={14} color={cfg.borderColor} fill={cfg.bg} />
                <Text style={styles.menuItemText}>{cfg.label}</Text>
                {active ? <Check size={14} color={Colors.light.tint} /> : <View style={{ width: 14 }} />}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </OverlayMenu>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: DS.radius.pill,
    borderWidth: 1,
  },
  badgeSm: { paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  badgeTextSm: { fontSize: 10 },
  triggerRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  menuItemText: { flex: 1, fontSize: 13, fontWeight: '600', color: Colors.light.text },
});
