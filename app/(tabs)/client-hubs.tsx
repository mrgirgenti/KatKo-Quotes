import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  Globe,
  ChevronRight,
  ShieldCheck,
  Users,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react-native';
import Colors from '@/constants/colors';

interface HubOrg {
  id: string;
  name: string;
  hubEnabled: boolean;
  crmStatus: string;
  totalMembers: number;
  clientUsers: number;
  orgAdminName: string | null;
  orgAdminColor: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  'Active Client': '#16A34A',
  'Working': '#D97706',
  'Cold': '#6B7280',
  'Past Client': '#9CA3AF',
};

export default function ClientHubsScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const { data: hubs = [], isLoading, refetch } = useQuery<HubOrg[]>({
    queryKey: ['client-hubs'],
    queryFn: async () => {
      const res = await fetch('/api/client-hubs');
      if (!res.ok) throw new Error('Failed to load');
      return res.json();
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  return (
    <View style={styles.container}>
      <View style={styles.pageHeader}>
        <Globe size={20} color={Colors.light.tint} />
        <Text style={styles.pageTitle}>Client Hubs</Text>
        <Text style={styles.pageSub}>{hubs.length} hub{hubs.length !== 1 ? 's' : ''} enabled</Text>
      </View>

      <View style={styles.divider} />

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={Colors.light.tint} />
          <Text style={styles.loadingText}>Loading hubs...</Text>
        </View>
      ) : hubs.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Globe size={40} color={Colors.light.border} />
          <Text style={styles.emptyTitle}>No Client Hubs enabled</Text>
          <Text style={styles.emptySub}>
            Open an organization in Contacts, go to the Hub tab, and enable Client Hub to get started.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.light.tint} />}
        >
          {hubs.map((hub) => (
            <TouchableOpacity
              key={hub.id}
              style={styles.card}
              onPress={() => router.push(`/crm/${hub.id}` as any)}
              activeOpacity={0.75}
            >
              <View style={styles.cardTop}>
                <View style={styles.cardLeft}>
                  <View style={styles.orgAvatarCircle}>
                    <Text style={styles.orgAvatarText}>{hub.name[0]?.toUpperCase() || '?'}</Text>
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.orgName}>{hub.name}</Text>
                    <View style={styles.statusRow}>
                      <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[hub.crmStatus] || '#9CA3AF' }]} />
                      <Text style={styles.statusText}>{hub.crmStatus || 'Unknown'}</Text>
                    </View>
                  </View>
                </View>
                <ChevronRight size={16} color={Colors.light.textSecondary} />
              </View>

              <View style={styles.cardDivider} />

              <View style={styles.cardStats}>
                <View style={styles.statItem}>
                  <ShieldCheck size={14} color={hub.orgAdminName ? Colors.light.tint : Colors.light.textSecondary} />
                  <Text style={[styles.statText, !hub.orgAdminName && styles.statTextDim]}>
                    {hub.orgAdminName ? hub.orgAdminName : 'No admin assigned'}
                  </Text>
                </View>

                <View style={styles.statDivider} />

                <View style={styles.statItem}>
                  <Users size={14} color={Colors.light.textSecondary} />
                  <Text style={styles.statText}>
                    {hub.clientUsers} client{hub.clientUsers !== 1 ? 's' : ''}
                    {hub.totalMembers > 0 && (
                      <Text style={styles.statTextDim}> · {hub.totalMembers} total</Text>
                    )}
                  </Text>
                </View>

                <View style={styles.statDivider} />

                <View style={styles.statItem}>
                  {hub.orgAdminName ? (
                    <CheckCircle2 size={14} color="#16A34A" />
                  ) : (
                    <AlertCircle size={14} color="#D97706" />
                  )}
                  <Text style={[styles.statText, hub.orgAdminName ? styles.statReady : styles.statPending]}>
                    {hub.orgAdminName ? 'Ready' : 'Needs setup'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
          <View style={{ height: 24 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    gap: 10,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.text,
    flex: 1,
  },
  pageSub: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.light.border,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    overflow: 'hidden',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  orgAvatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.tint,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orgAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  cardInfo: {
    flex: 1,
    gap: 3,
  },
  orgName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.text,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  cardDivider: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginHorizontal: 14,
  },
  cardStats: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 0,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
  },
  statText: {
    fontSize: 12,
    color: Colors.light.text,
    fontWeight: '500',
  },
  statTextDim: {
    color: Colors.light.textSecondary,
    fontWeight: '400',
  },
  statReady: {
    color: '#16A34A',
  },
  statPending: {
    color: '#D97706',
  },
  statDivider: {
    width: 1,
    height: 16,
    backgroundColor: Colors.light.border,
    marginHorizontal: 10,
  },
});
