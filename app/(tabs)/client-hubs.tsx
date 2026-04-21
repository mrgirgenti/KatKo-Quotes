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
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Globe,
  Search,
  CheckCircle2,
  Plus,
  User,
  Copy,
  Settings,
  ExternalLink,
  Mail,
  AlertCircle,
  ChevronRight,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useCrm } from '@/contexts/CrmContext';
import { Organization, Contact } from '@/types/crm';
import { OrgAvatar } from '@/components/OrgAvatar';

function getPrimaryContact(org: Organization): Contact | undefined {
  return org.contacts.find((c) => c.isPrimary) ?? org.contacts[0];
}

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  'Active Client': { bg: '#DCFCE7', text: '#15803D', dot: '#16A34A' },
  'Working':       { bg: '#FEF3C7', text: '#B45309', dot: '#D97706' },
  'Cold':          { bg: '#F3F4F6', text: '#6B7280', dot: '#9CA3AF' },
  'Past Client':   { bg: '#F3F4F6', text: '#6B7280', dot: '#9CA3AF' },
};

function getStatusStyle(status: string) {
  return STATUS_COLORS[status] ?? { bg: '#F3F4F6', text: '#6B7280', dot: '#9CA3AF' };
}

function HubRow({ org, onPress, onCopyLink, copied }: {
  org: Organization;
  onPress: () => void;
  onCopyLink: () => void;
  copied: boolean;
}) {
  const primaryContact = getPrimaryContact(org);
  const contactName = primaryContact
    ? `${primaryContact.firstName} ${primaryContact.lastName}`.trim()
    : null;
  const contactEmail = primaryContact?.email || null;
  const statusStyle = getStatusStyle(org.status);
  const hasLogo = !!org.logoUrl;

  return (
    <TouchableOpacity style={styles.tableRow} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.colAvatar}>
        <OrgAvatar name={org.name} logoUrl={org.logoUrl} size={36} shape="circle" />
      </View>
      <View style={styles.colOrg}>
        <Text style={styles.tableOrgName} numberOfLines={1}>{org.name}</Text>
        {org.type ? <Text style={styles.tableOrgType} numberOfLines={1}>{org.type}</Text> : null}
        {!hasLogo && (
          <View style={styles.noLogoTag}>
            <AlertCircle size={9} color="#D97706" />
            <Text style={styles.noLogoTagText}>No logo</Text>
          </View>
        )}
      </View>
      <View style={styles.colContact}>
        {contactName ? (
          <View>
            <Text style={styles.tableContact} numberOfLines={1}>{contactName}</Text>
            {contactEmail ? <Text style={styles.tableContactSub} numberOfLines={1}>{contactEmail}</Text> : null}
          </View>
        ) : (
          <Text style={styles.tableDim}>No contact</Text>
        )}
      </View>
      <View style={styles.colStatus}>
        <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
          <View style={[styles.statusDot, { backgroundColor: statusStyle.dot }]} />
          <Text style={[styles.statusBadgeText, { color: statusStyle.text }]}>{org.status}</Text>
        </View>
        <View style={styles.portalBadge}>
          <Globe size={9} color="#7C3AED" />
          <Text style={styles.portalBadgeText}>Live</Text>
        </View>
      </View>
      <View style={styles.colActions}>
        <TouchableOpacity style={styles.actionPrimary} onPress={onPress} activeOpacity={0.8}>
          <ExternalLink size={12} color="#fff" />
          <Text style={styles.actionPrimaryText}>Open</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionGhost, copied && styles.actionGhostDone]}
          onPress={onCopyLink}
          activeOpacity={0.8}
        >
          {copied
            ? <CheckCircle2 size={13} color="#16A34A" />
            : <Copy size={13} color={Colors.light.textSecondary} />
          }
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionGhost} onPress={onPress} activeOpacity={0.8}>
          <Settings size={13} color={Colors.light.textSecondary} />
        </TouchableOpacity>
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
  const contactName = primaryContact
    ? `${primaryContact.firstName} ${primaryContact.lastName}`.trim()
    : null;

  return (
    <TouchableOpacity style={styles.tableRow} onPress={onEnable} activeOpacity={0.7}>
      <View style={styles.colAvatar}>
        <OrgAvatar name={org.name} logoUrl={org.logoUrl} size={36} shape="circle" />
      </View>
      <View style={styles.colOrg}>
        <Text style={styles.tableOrgName} numberOfLines={1}>{org.name}</Text>
        {org.type ? <Text style={styles.tableOrgType} numberOfLines={1}>{org.type}</Text> : null}
      </View>
      <View style={styles.colContact}>
        {contactName ? (
          <Text style={styles.tableContact} numberOfLines={1}>{contactName}</Text>
        ) : (
          <Text style={styles.tableDim}>No contact</Text>
        )}
      </View>
      <View style={styles.colStatus}>
        <Text style={styles.tableDim}>Hub off</Text>
      </View>
      <View style={styles.colActions}>
        {enabling ? (
          <ActivityIndicator size="small" color={Colors.light.tint} />
        ) : (
          <TouchableOpacity style={styles.enableBtn} onPress={onEnable} activeOpacity={0.75}>
            <Plus size={12} color="#fff" />
            <Text style={styles.enableBtnText}>Enable</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function ClientHubsScreen() {
  const router = useRouter();
  const { orgs, isLoading, updateOrgHubEnabled } = useCrm();
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [togglingOrgId, setTogglingOrgId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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

  const noLogoCount = useMemo(() => orgs.filter((o) => o.hubEnabled && !o.logoUrl).length, [orgs]);

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

  const handleCopyLink = useCallback((org: Organization) => {
    const link = Platform.OS === 'web'
      ? `${window.location.origin}/portal/${org.id}`
      : `/portal/${org.id}`;
    if (Platform.OS === 'web' && navigator.clipboard) {
      navigator.clipboard.writeText(link).catch(() => {});
    }
    setCopiedId(org.id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  return (
    <View style={styles.container}>
      {/* ── Page header ── */}
      <View style={styles.pageHeader}>
        <View style={styles.headerTop}>
          <Text style={styles.pageTitle}>Client Hubs</Text>
          <Text style={styles.pageSubtitle}>
            {orgs.filter(o => o.hubEnabled).length} active hub{orgs.filter(o => o.hubEnabled).length !== 1 ? 's' : ''}
          </Text>
        </View>

        {/* Stats bar */}
        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: Colors.light.text }]}>{orgs.filter(o => o.hubEnabled).length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#16A34A' }]}>{orgs.filter(o => o.hubEnabled && o.status === 'Active Client').length}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#D97706' }]}>{noLogoCount}</Text>
            <Text style={styles.statLabel}>No Logo</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: Colors.light.tint }]}>{orgs.filter(o => !o.hubEnabled).length}</Text>
            <Text style={styles.statLabel}>Available</Text>
          </View>
        </View>

        {/* Search row */}
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Search size={14} color={Colors.light.textSecondary} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search organizations…"
              placeholderTextColor={Colors.light.textSecondary}
              clearButtonMode="while-editing"
            />
          </View>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={Colors.light.tint} size="large" />
          <Text style={styles.loadingText}>Loading organizations…</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.light.tint} />
          }
        >
          {/* ── Hub-enabled table ── */}
          {hubEnabled.length > 0 && (
            <>
              <View style={styles.tableHeader}>
                <View style={styles.colAvatar} />
                <Text style={[styles.thText, styles.colOrg]}>ORGANIZATION</Text>
                <Text style={[styles.thText, styles.colContact]}>PRIMARY CONTACT</Text>
                <Text style={[styles.thText, styles.colStatus]}>STATUS</Text>
                <Text style={[styles.thText, styles.colActions]}>ACTIONS</Text>
              </View>
              <View style={styles.tableBody}>
                {hubEnabled.map((org, idx) => (
                  <View key={org.id}>
                    <HubRow
                      org={org}
                      onPress={() => router.push(`/hub/${org.id}` as any)}
                      onCopyLink={() => handleCopyLink(org)}
                      copied={copiedId === org.id}
                    />
                    {idx < hubEnabled.length - 1 && <View style={styles.tableDivider} />}
                  </View>
                ))}
              </View>
            </>
          )}

          {/* ── Search results — not yet enabled ── */}
          {notEnabled.length > 0 && (
            <>
              <View style={[styles.tableHeader, { marginTop: hubEnabled.length > 0 ? 20 : 0 }]}>
                <View style={styles.colAvatar} />
                <Text style={[styles.thText, styles.colOrg]}>ORGANIZATION</Text>
                <Text style={[styles.thText, styles.colContact]}>CONTACT</Text>
                <Text style={[styles.thText, styles.colStatus]}>HUB</Text>
                <Text style={[styles.thText, styles.colActions]}>ENABLE</Text>
              </View>
              <View style={styles.tableBody}>
                {notEnabled.map((org, idx) => (
                  <View key={org.id}>
                    <AddOrgRow
                      org={org}
                      onEnable={() => handleEnableHub(org)}
                      enabling={togglingOrgId === org.id}
                    />
                    {idx < notEnabled.length - 1 && <View style={styles.tableDivider} />}
                  </View>
                ))}
              </View>
            </>
          )}

          {/* ── Empty states ── */}
          {orgs.length === 0 && (
            <View style={styles.emptyState}>
              <Globe size={44} color={Colors.light.border} />
              <Text style={styles.emptyTitle}>No organizations yet</Text>
              <Text style={styles.emptyText}>
                Add organizations in Contacts to manage their Client Hubs here.
              </Text>
            </View>
          )}

          {orgs.length > 0 && hubEnabled.length === 0 && !q && (
            <View style={styles.emptyState}>
              <Globe size={44} color={Colors.light.border} />
              <Text style={styles.emptyTitle}>No hubs enabled yet</Text>
              <Text style={styles.emptyText}>
                Search for an organization above to enable their Client Hub.
              </Text>
            </View>
          )}

          {q && hubEnabled.length === 0 && notEnabled.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No results for "{search}"</Text>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },

  // Page header
  pageHeader: {
    backgroundColor: Colors.light.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    paddingTop: Platform.OS === 'web' ? 0 : 48,
  },
  headerTop: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
  },
  pageTitle: { fontSize: 24, fontWeight: '800' as const, color: Colors.light.text },
  pageSubtitle: { fontSize: 14, color: Colors.light.textSecondary },

  // Stats bar
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: Colors.light.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '800' as const, color: Colors.light.text },
  statLabel: { fontSize: 10, color: Colors.light.textSecondary, fontWeight: '500' as const, marginTop: 1 },
  statDivider: { width: 1, height: 32, backgroundColor: Colors.light.border },

  // Search
  searchRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 12,
    alignItems: 'center',
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.light.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.light.text,
    outlineStyle: 'none' as any,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 14,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },

  // Table
  list: { flex: 1 },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#000000',
  },
  thText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.4,
  },
  tableBody: { backgroundColor: Colors.light.surface },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.light.surface,
  },
  tableDivider: { height: 1, backgroundColor: Colors.light.border, marginLeft: 16 },

  // Columns
  colAvatar: { width: 44 },
  colOrg: { flex: 2.5 },
  colContact: { flex: 2.5 },
  colStatus: { flex: 1.8, gap: 4 },
  colActions: { flexDirection: 'row', alignItems: 'center', gap: 6, width: 120, justifyContent: 'flex-end' },

  // Row content
  tableOrgName: { fontSize: 14, fontWeight: '600' as const, color: Colors.light.text },
  tableOrgType: { fontSize: 11, color: Colors.light.textSecondary, marginTop: 1 },
  tableContact: { fontSize: 13, color: Colors.light.textSecondary },
  tableContactSub: { fontSize: 11, color: Colors.light.textSecondary, marginTop: 1 },
  tableDim: { fontSize: 13, color: Colors.light.border },

  // No logo tag
  noLogoTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 3,
  },
  noLogoTagText: {
    fontSize: 10,
    color: '#D97706',
    fontWeight: '500' as const,
  },

  // Badges
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusBadgeText: { fontSize: 11, fontWeight: '600' as const },
  portalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 20,
    paddingHorizontal: 7,
    paddingVertical: 2,
    backgroundColor: '#EDE9FE',
    alignSelf: 'flex-start',
  },
  portalBadgeText: { fontSize: 10, fontWeight: '600' as const, color: '#7C3AED' },

  // Actions
  actionPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.light.tint,
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  actionPrimaryText: { fontSize: 12, fontWeight: '700' as const, color: '#fff' },
  actionGhost: {
    padding: 6,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionGhostDone: {
    borderColor: '#BBF7D0',
    backgroundColor: '#F0FDF4',
  },
  enableBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.light.tint,
    borderRadius: 7,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  enableBtnText: { fontSize: 12, fontWeight: '700' as const, color: '#fff' },

  // Empty
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    padding: 40,
    paddingTop: 64,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700' as const, color: Colors.light.text, textAlign: 'center' },
  emptyText: { fontSize: 14, color: Colors.light.textSecondary, textAlign: 'center', lineHeight: 20 },
});
