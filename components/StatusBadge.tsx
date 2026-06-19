import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CrmStatus, CRM_STATUS_CONFIG } from '@/types/crm';

export type HubStatus = 'Active' | 'Invited' | 'Disabled' | 'No Access';

const HUB_COLORS: Record<HubStatus, { bg: string; color: string }> = {
  'Active':    { bg: '#16A34A', color: '#FFFFFF' },
  'Invited':   { bg: '#2563EB', color: '#FFFFFF' },
  'Disabled':  { bg: '#4B5563', color: '#FFFFFF' },
  'No Access': { bg: '#9CA3AF', color: '#FFFFFF' },
};

export function OrgStatusBadge({ status }: { status: CrmStatus }) {
  const cfg = CRM_STATUS_CONFIG[status];
  return (
    <View style={[s.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[s.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

export function ContactStatusBadge({ status }: { status?: 'active' | 'inactive' | null }) {
  const isActive = status !== 'inactive';
  return (
    <View style={[s.badge, isActive ? s.contactActive : s.contactInactive]}>
      <Text style={s.badgeText}>{isActive ? 'Active' : 'Inactive'}</Text>
    </View>
  );
}

export function HubStatusBadge({ status }: { status: HubStatus }) {
  const cfg = HUB_COLORS[status];
  return (
    <View style={[s.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[s.badgeText, { color: cfg.color }]}>{status}</Text>
    </View>
  );
}

export function OrgHubBadge({ live }: { live: boolean }) {
  return (
    <View style={[s.badge, live ? s.orgHubLive : s.orgHubInactive]}>
      <Text style={s.badgeText}>{live ? 'Live' : 'Inactive'}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'center' as const,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  contactActive: { backgroundColor: '#FF5A00' },
  contactInactive: { backgroundColor: '#4B5563' },
  orgHubLive: { backgroundColor: '#16A34A' },
  orgHubInactive: { backgroundColor: '#4B5563' },
});
