import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Check, ChevronDown, User as UserIcon } from 'lucide-react-native';
import Colors from '@/constants/colors';
import OverlayMenu from '@/components/OverlayMenu';
import type { UserProfile } from '@/types/user';

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?';
}

export function AssigneeAvatar({ user, size = 24 }: { user: UserProfile | null; size?: number }) {
  if (!user) {
    return (
      <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: '#E5E7EB' }]}>
        <UserIcon size={size * 0.55} color={Colors.light.textSecondary} />
      </View>
    );
  }
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: user.avatarColor || Colors.light.tint }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.4 }]}>{initials(user.name)}</Text>
    </View>
  );
}

interface AssigneeControlProps {
  assignedToUserId?: string | null;
  users: UserProfile[];
  onChange: (userId: string | null) => void;
  align?: 'left' | 'right';
  showName?: boolean;
}

export function AssigneeControl({ assignedToUserId, users, onChange, align = 'left', showName }: AssigneeControlProps) {
  const current = users.find((u) => u.id === assignedToUserId) || null;
  return (
    <OverlayMenu
      menuWidth={220}
      align={align}
      trigger={({ open }) => (
        <TouchableOpacity onPress={open} activeOpacity={0.7} style={styles.triggerRow}>
          <AssigneeAvatar user={current} />
          {showName ? (
            <Text style={styles.triggerName} numberOfLines={1}>{current ? current.name : 'Unassigned'}</Text>
          ) : null}
          <ChevronDown size={14} color={Colors.light.textSecondary} />
        </TouchableOpacity>
      )}
    >
      {({ close }) => (
        <ScrollView style={{ maxHeight: 280 }}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => { close(); if (assignedToUserId) onChange(null); }}
          >
            <AssigneeAvatar user={null} size={22} />
            <Text style={styles.menuItemText}>Unassigned</Text>
            {!current ? <Check size={14} color={Colors.light.tint} /> : <View style={{ width: 14 }} />}
          </TouchableOpacity>
          {users.map((u) => {
            const active = u.id === assignedToUserId;
            return (
              <TouchableOpacity
                key={u.id}
                style={styles.menuItem}
                onPress={() => { close(); if (!active) onChange(u.id); }}
              >
                <AssigneeAvatar user={u} size={22} />
                <Text style={styles.menuItemText} numberOfLines={1}>{u.name}</Text>
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
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '700' },
  triggerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  triggerName: { fontSize: 13, color: Colors.light.text, maxWidth: 120 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 9 },
  menuItemText: { flex: 1, fontSize: 13, fontWeight: '600', color: Colors.light.text },
});
