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
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Globe,
  ChevronRight,
  Search,
  CheckCircle2,
  Plus,
  User,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useCrm } from '@/contexts/CrmContext';
import { Organization, Contact } from '@/types/crm';

function getPrimaryContact(org: Organization): Contact | undefined {
  return org.contacts.find((c) => c.isPrimary) ?? org.contacts[0];
}

function getContactDisplay(contact: Contact | undefined): string {
  if (!contact) return '';
  return `${contact.firstName} ${contact.lastName}`.trim();
}

const STATUS_COLORS: Record<string, string> = {
  'Active Client': '#16A34A',
  'Working': '#D97706',
  'Cold': '#6B7280',
  'Past Client': '#9CA3AF',
};

function HubCard({ org, onPress }: { org: Organization; onPress: () => void }) {
  const primaryContact = getPrimaryContact(org);
  const contactName = getContactDisplay(primaryContact);
  const contactInitial = primaryContact?.firstName?.[0]?.toUpperCase() || org.name[0]?.toUpperCase() || '?';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.cardRow}>
        <View style={styles.contactAvatar}>
          <Text style={styles.contactAvatarText}>{contactInitial}</Text>
        </View>
        <View style={styles.cardTextBlock}>
          {contactName ? (
            <Text style={styles.contactName}>{contactName}</Text>
          ) : null}
          <Text style={styles.orgName}>{org.name}</Text>
        </View>
        <View style={styles.cardRight}>
          <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[org.status] || '#9CA3AF' }]} />
          <ChevronRight size={15} color={Colors.light.textSecondary} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

function AddOrgRow({
  org,
  onEnable,
  enabling,
}: {
  org: Organization;
  onEnable: () => void;
  enabling: boolean;
}) {
  const primaryContact = getPrimaryContact(org);
  const contactName = getContactDisplay(primaryContact);
  const initial = org.name[0]?.toUpperCase() || '?';

  return (
    <View style={styles.addRow}>
      <View style={styles.addRowAvatar}>
        <Text style={styles.addRowAvatarText}>{initial}</Text>
      </View>
      <View style={styles.addRowInfo}>
        <Text style={styles.addRowName}>{org.name}</Text>
        {contactName ? <Text style={styles.addRowSub}>{contactName}</Text> : null}
      </View>
      {enabling ? (
        <ActivityIndicator size="small" color={Colors.light.tint} />
      ) : (
        <TouchableOpacity style={styles.enableBtn} onPress={onEnable} activeOpacity={0.75}>
          <Plus size={12} color="#fff" />
          <Text style={styles.enableBtnText}>Enable</Text>
        </TouchableOpacity>
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

  const q = search.toLowerCase().trim();

  const hubEnabled = useMemo(
    () =>
      orgs
        .filter((o) => o.hubEnabled)
        .filter((o) => !q || o.name.toLowerCase().includes(q))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [orgs, q],
  );

  const notEnabled = useMemo(
    () =>
      q
        ? orgs
            .filter((o) => !o.hubEnabled)
            .filter((o) => o.name.toLowerCase().includes(q))
            .sort((a, b) => a.name.localeCompare(b.name))
        : [],
    [orgs, q],
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
          placeholder="Search to find or add organizations…"
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
              <View style={styles.sectionHeader}>
                <CheckCircle2 size={13} color="#16A34A" />
                <Text style={styles.sectionTitle}>Hub Enabled</Text>
                <Text style={styles.sectionCount}>{hubEnabled.length}</Text>
              </View>
              <View style={styles.cardList}>
                {hubEnabled.map((org) => (
                  <HubCard
                    key={org.id}
                    org={org}
                    onPress={() => router.push(`/hub/${org.id}` as any)}
                  />
                ))}
              </View>
            </View>
          )}

          {/* Search results — not yet enabled */}
          {notEnabled.length > 0 && (
            <View style={styles.listSection}>
              <View style={styles.sectionHeader}>
                <User size={13} color={Colors.light.textSecondary} />
                <Text style={[styles.sectionTitle, { color: Colors.light.textSecondary }]}>
                  Add to Hub
                </Text>
                <Text style={styles.sectionCount}>{notEnabled.length}</Text>
              </View>
              <View style={styles.addList}>
                {notEnabled.map((org) => (
                  <AddOrgRow
                    key={org.id}
                    org={org}
                    onEnable={() => handleEnableHub(org)}
                    enabling={togglingOrgId === org.id}
                  />
                ))}
              </View>
            </View>
          )}

          {/* Empty states */}
          {orgs.length === 0 && (
            <View style={styles.emptyContainer}>
              <Globe size={40} color={Colors.light.border} />
              <Text style={styles.emptyTitle}>No organizations yet</Text>
              <Text style={styles.emptySub}>
                Add organizations in Contacts to manage their Client Hubs here.
              </Text>
            </View>
          )}

          {orgs.length > 0 && hubEnabled.length === 0 && !q && (
            <View style={styles.emptyContainer}>
              <Globe size={36} color={Colors.light.border} />
              <Text style={styles.emptyTitle}>No hubs enabled yet</Text>
              <Text style={styles.emptySub}>
                Search for an organization above to enable their Client Hub.
              </Text>
            </View>
          )}

          {q && hubEnabled.length === 0 && notEnabled.length === 0 && (
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
    gap: 20,
  },
  listSection: {
    gap: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 2,
    marginBottom: 2,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.light.text,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    flex: 1,
  },
  sectionCount: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    fontWeight: '600',
  },

  // Hub-enabled cards
  cardList: {
    gap: 6,
  },
  card: {
    backgroundColor: Colors.light.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    overflow: 'hidden',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  contactAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.light.tint,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  contactAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  cardTextBlock: {
    flex: 1,
    gap: 1,
  },
  contactName: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.light.text,
  },
  orgName: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    fontWeight: '500',
  },
  cardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },

  // Add-to-hub rows
  addList: {
    backgroundColor: Colors.light.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    overflow: 'hidden',
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  addRowAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.light.border,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  addRowAvatarText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.light.textSecondary,
  },
  addRowInfo: {
    flex: 1,
    gap: 1,
  },
  addRowName: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.light.text,
  },
  addRowSub: {
    fontSize: 11,
    color: Colors.light.textSecondary,
  },
  enableBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.light.tint,
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  enableBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
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
