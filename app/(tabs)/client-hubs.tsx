import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Globe,
  ChevronRight,
  ShieldCheck,
  Users,
  AlertCircle,
  CheckCircle2,
  Search,
  ToggleRight,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useCrm } from '@/contexts/CrmContext';
import { Organization } from '@/types/crm';

const STATUS_COLORS: Record<string, string> = {
  'Active Client': '#16A34A',
  'Working': '#D97706',
  'Cold': '#6B7280',
  'Past Client': '#9CA3AF',
};

function HubCard({ org, onPress }: { org: Organization; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.cardTop}>
        <View style={styles.cardLeft}>
          <View style={styles.orgAvatarCircle}>
            <Text style={styles.orgAvatarText}>{org.name[0]?.toUpperCase() || '?'}</Text>
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.orgName}>{org.name}</Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[org.status] || '#9CA3AF' }]} />
              <Text style={styles.statusText}>{org.status || 'Unknown'}</Text>
            </View>
          </View>
        </View>
        <ChevronRight size={16} color={Colors.light.textSecondary} />
      </View>
    </TouchableOpacity>
  );
}

function OrgEnableRow({
  org,
  onToggle,
  toggling,
}: {
  org: Organization;
  onToggle: (val: boolean) => void;
  toggling: boolean;
}) {
  return (
    <View style={styles.enableRow}>
      <View style={styles.enableRowAvatar}>
        <Text style={styles.enableRowAvatarText}>{org.name[0]?.toUpperCase() || '?'}</Text>
      </View>
      <View style={styles.enableRowInfo}>
        <Text style={styles.enableRowName}>{org.name}</Text>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[org.status] || '#9CA3AF' }]} />
          <Text style={styles.statusText}>{org.status || 'Unknown'}</Text>
        </View>
      </View>
      {toggling ? (
        <ActivityIndicator size="small" color={Colors.light.tint} />
      ) : (
        <Switch
          value={false}
          onValueChange={onToggle}
          trackColor={{ false: Colors.light.border, true: Colors.light.tint }}
          thumbColor="#fff"
        />
      )}
    </View>
  );
}

export default function ClientHubsScreen() {
  const router = useRouter();
  const { orgs, isLoading, updateOrgHubEnabled } = useCrm();
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [togglingOrgId, setTogglingOrgId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return orgs;
    const q = search.toLowerCase();
    return orgs.filter((o) => o.name.toLowerCase().includes(q));
  }, [orgs, search]);

  const hubEnabled = useMemo(
    () => filtered.filter((o) => o.hubEnabled).sort((a, b) => a.name.localeCompare(b.name)),
    [filtered],
  );

  const notEnabled = useMemo(
    () => filtered.filter((o) => !o.hubEnabled).sort((a, b) => a.name.localeCompare(b.name)),
    [filtered],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  const handleEnableHub = useCallback(
    (org: Organization) => {
      setTogglingOrgId(org.id);
      updateOrgHubEnabled({ orgId: org.id, enabled: true });
      setTimeout(() => {
        setTogglingOrgId(null);
        router.push(`/hub/${org.id}` as any);
      }, 600);
    },
    [updateOrgHubEnabled, router],
  );

  return (
    <View style={styles.container}>
      <View style={styles.pageHeader}>
        <Globe size={20} color={Colors.light.tint} />
        <Text style={styles.pageTitle}>Client Hubs</Text>
        <Text style={styles.pageSub}>
          {hubEnabled.length} enabled
        </Text>
      </View>

      <View style={styles.searchRow}>
        <Search size={14} color={Colors.light.textSecondary} style={{ marginLeft: 10 }} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search organizations…"
          placeholderTextColor={Colors.light.textSecondary}
          clearButtonMode="while-editing"
        />
      </View>

      <View style={styles.divider} />

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={Colors.light.tint} />
          <Text style={styles.loadingText}>Loading organizations…</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.light.tint} />
          }
        >
          {/* Hub-enabled section */}
          {hubEnabled.length > 0 && (
            <View style={styles.listSection}>
              <View style={styles.listSectionHeader}>
                <CheckCircle2 size={13} color="#16A34A" />
                <Text style={styles.listSectionTitle}>Hub Enabled</Text>
                <Text style={styles.listSectionCount}>{hubEnabled.length}</Text>
              </View>
              {hubEnabled.map((org) => (
                <HubCard
                  key={org.id}
                  org={org}
                  onPress={() => router.push(`/hub/${org.id}` as any)}
                />
              ))}
            </View>
          )}

          {/* Not yet enabled */}
          {notEnabled.length > 0 && (
            <View style={styles.listSection}>
              <View style={styles.listSectionHeader}>
                <ToggleRight size={13} color={Colors.light.textSecondary} />
                <Text style={[styles.listSectionTitle, { color: Colors.light.textSecondary }]}>
                  Not Enabled
                </Text>
                <Text style={styles.listSectionCount}>{notEnabled.length}</Text>
              </View>
              <View style={styles.enableList}>
                {notEnabled.map((org) => (
                  <OrgEnableRow
                    key={org.id}
                    org={org}
                    onToggle={() => handleEnableHub(org)}
                    toggling={togglingOrgId === org.id}
                  />
                ))}
              </View>
            </View>
          )}

          {orgs.length === 0 && (
            <View style={styles.emptyContainer}>
              <Globe size={40} color={Colors.light.border} />
              <Text style={styles.emptyTitle}>No organizations yet</Text>
              <Text style={styles.emptySub}>
                Add organizations in Contacts to manage their Client Hubs here.
              </Text>
            </View>
          )}

          {orgs.length > 0 && filtered.length === 0 && (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No results for "{search}"</Text>
            </View>
          )}

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
    paddingBottom: 10,
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    borderRadius: 10,
    backgroundColor: Colors.light.surface,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    paddingRight: 10,
    fontSize: 14,
    color: Colors.light.text,
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
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    gap: 16,
  },
  listSection: {
    gap: 8,
  },
  listSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 2,
    marginBottom: 2,
  },
  listSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.light.text,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    flex: 1,
  },
  listSectionCount: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    fontWeight: '600',
  },

  // Hub-enabled cards
  card: {
    backgroundColor: Colors.light.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    overflow: 'hidden',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  orgAvatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.light.tint,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orgAvatarText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  cardInfo: {
    flex: 1,
    gap: 3,
  },
  orgName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },

  // Not-enabled rows
  enableList: {
    backgroundColor: Colors.light.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    overflow: 'hidden',
  },
  enableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  enableRowAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.light.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  enableRowAvatarText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.light.textSecondary,
  },
  enableRowInfo: {
    flex: 1,
    gap: 2,
  },
  enableRowName: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.light.text,
  },

  // Empty
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 40,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.text,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
  },
});
