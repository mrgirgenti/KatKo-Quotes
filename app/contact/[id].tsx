'use client';
import React from 'react';
import {
  View, ActivityIndicator, Text, StyleSheet,
  TouchableOpacity, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react-native';
import { getClerkToken } from '@/lib/clerkToken';
import type { Organization } from '@/types/crm';
import ContactProfile from '@/components/ContactProfile';
import Colors from '@/constants/colors';

export default function ContactProfilePage() {
  const { id, orgId } = useLocalSearchParams<{ id: string; orgId: string }>();
  const router = useRouter();

  const { data: org, isLoading, error } = useQuery<Organization>({
    queryKey: ['contact_profile_org', orgId],
    queryFn: async () => {
      if (!orgId) throw new Error('Missing orgId');
      const token = await getClerkToken();
      const res = await fetch(`/api/orgs/${orgId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load org');
      return res.json();
    },
    enabled: !!orgId,
    staleTime: 30_000,
  });

  const contact = org?.contacts.find((c) => c.id === id);

  if (isLoading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
      </View>
    );
  }

  if (error || !contact || !org) {
    return (
      <View style={s.center}>
        <Text style={s.errText}>Contact not found.</Text>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={s.backLink}>← Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.root}>
      {/* Back header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <ChevronLeft size={20} color="#fff" />
          <Text style={s.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>
          {contact.firstName} {contact.lastName}
        </Text>
        <View style={s.headerRight} />
      </View>

      <ContactProfile
        contact={contact}
        org={org}
        onSaved={() => {/* refetch happens via react-query invalidation */}}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    backgroundColor: '#000',
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 52 : 16,
    paddingBottom: 14,
    paddingHorizontal: 16,
    gap: 8,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 64,
  },
  backText: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '500',
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  headerRight: {
    minWidth: 64,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F9FAFB',
  },
  errText: {
    fontSize: 16,
    color: '#6B7280',
  },
  backLink: {
    fontSize: 14,
    color: Colors.light.primary,
    fontWeight: '600',
  },
});
