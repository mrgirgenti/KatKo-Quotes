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
  Image,
  useWindowDimensions,
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
  Shield,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useCrm } from '@/contexts/CrmContext';
import { Organization, Contact } from '@/types/crm';

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

function OrgAvatar({ org, size = 52 }: { org: Organization; size?: number }) {
  const [imgError, setImgError] = useState(false);
  const logoUrl = org.logoUrl || org.internalLogoUrl;

  if (logoUrl && !imgError) {
    return (
      <Image
        source={{ uri: logoUrl }}
        style={[styles.orgLogo, { width: size, height: size, borderRadius: 10 }]}
        resizeMode="contain"
        onError={() => setImgError(true)}
      />
    );
  }

  const initial = org.name[0]?.toUpperCase() || '?';
  const colors = ['#FF5A00', '#7C3AED', '#0284C7', '#16A34A', '#DB2777'];
  const colorIdx = org.name.charCodeAt(0) % colors.length;

  return (
    <View style={[styles.orgInitialAvatar, { width: size, height: size, borderRadius: 10, backgroundColor: colors[colorIdx] }]}>
      <Text style={[styles.orgInitialText, { fontSize: size * 0.38 }]}>{initial}</Text>
    </View>
  );
}

function HubCard({ org, onPress, onCopyLink }: { org: Organization; onPress: () => void; onCopyLink: () => void }) {
  const primaryContact = getPrimaryContact(org);
  const contactName = primaryContact
    ? `${primaryContact.firstName} ${primaryContact.lastName}`.trim()
    : null;
  const contactEmail = primaryContact?.email || null;
  const statusStyle = getStatusStyle(org.status);
  const hasLogo = !!(org.logoUrl || org.internalLogoUrl);

  return (
    <View style={styles.card}>
      {/* ── Top section: logo, name, badges ── */}
      <View style={styles.cardTop}>
        <OrgAvatar org={org} size={52} />
        <View style={styles.cardTopText}>
          <Text style={styles.orgName} numberOfLines={2}>{org.name}</Text>
          <View style={styles.badgeRow}>
            <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
              <View style={[styles.statusDot, { backgroundColor: statusStyle.dot }]} />
              <Text style={[styles.statusBadgeText, { color: statusStyle.text }]}>{org.status}</Text>
            </View>
            <View style={styles.hubBadge}>
              <Shield size={10} color="#7C3AED" />
              <Text style={styles.hubBadgeText}>Portal Live</Text>
            </View>
          </View>
        </View>
      </View>

      {/* ── Divider ── */}
      <View style={styles.cardDivider} />

      {/* ── Middle section: contact, type, portal readiness ── */}
      <View style={styles.cardMeta}>
        {contactName ? (
          <View style={styles.metaRow}>
            <User size={12} color={Colors.light.textSecondary} />
            <Text style={styles.metaText} numberOfLines={1}>{contactName}</Text>
          </View>
        ) : (
          <View style={styles.metaRow}>
            <User size={12} color={Colors.light.textSecondary} />
            <Text style={[styles.metaText, { color: Colors.light.textSecondary, fontStyle: 'italic' }]}>No primary contact</Text>
          </View>
        )}
        {contactEmail ? (
          <View style={styles.metaRow}>
            <Mail size={12} color={Colors.light.textSecondary} />
            <Text style={styles.metaText} numberOfLines={1}>{contactEmail}</Text>
          </View>
        ) : null}
        {org.type ? (
          <View style={styles.metaRow}>
            <Globe size={12} color={Colors.light.textSecondary} />
            <Text style={styles.metaText}>{org.type}</Text>
          </View>
        ) : null}
        <View style={styles.metaRow}>
          {hasLogo ? (
            <>
              <CheckCircle2 size={12} color="#16A34A" />
              <Text style={[styles.metaText, { color: '#16A34A' }]}>Logo configured</Text>
            </>
          ) : (
            <>
              <AlertCircle size={12} color="#D97706" />
              <Text style={[styles.metaText, { color: '#D97706' }]}>No logo set</Text>
            </>
          )}
        </View>
      </View>

      {/* ── Divider ── */}
      <View style={styles.cardDivider} />

      {/* ── Bottom section: actions ── */}
      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.actionPrimary} onPress={onPress} activeOpacity={0.8}>
          <ExternalLink size={13} color="#fff" />
          <Text style={styles.actionPrimaryText}>Open Hub</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionSecondary} onPress={onCopyLink} activeOpacity={0.8}>
          <Copy size={13} color={Colors.light.tint} />
          <Text style={styles.actionSecondaryText}>Copy Link</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionGhost} onPress={onPress} activeOpacity={0.8}>
          <Settings size={13} color={Colors.light.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
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
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { width } = useWindowDimensions();

  const twoCol = width >= 720;
  const cardWidth = twoCol
    ? (width - 240 - 16 * 3) / 2  // account for sidebar + gaps
    : undefined;

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
        <View style={styles.pageTitleRow}>
          <Globe size={22} color={Colors.light.tint} />
          <Text style={styles.pageTitle}>Client Hubs</Text>
          <View style={styles.countPill}>
            <Text style={styles.countPillText}>{hubEnabled.length} active</Text>
          </View>
        </View>
        <Text style={styles.pageSubtitle}>
          Manage client portals, branding, and team access for each organization.
        </Text>
      </View>

      {/* ── Search ── */}
      <View style={styles.searchRow}>
        <Search size={14} color={Colors.light.textSecondary} style={{ marginLeft: 12 }} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search organizations…"
          placeholderTextColor={Colors.light.textSecondary}
          clearButtonMode="while-editing"
        />
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={Colors.light.tint} size="large" />
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
          {/* ── Hub-enabled section ── */}
          {hubEnabled.length > 0 && (
            <View style={styles.listSection}>
              <View style={styles.sectionHeader}>
                <CheckCircle2 size={13} color="#16A34A" />
                <Text style={styles.sectionTitle}>Hub Enabled</Text>
                <View style={styles.sectionCountBadge}>
                  <Text style={styles.sectionCountText}>{hubEnabled.length}</Text>
                </View>
              </View>
              <View style={[styles.cardGrid, twoCol && styles.cardGridTwoCol]}>
                {hubEnabled.map((org) => (
                  <View key={org.id} style={twoCol ? { width: cardWidth } : undefined}>
                    <HubCard
                      org={org}
                      onPress={() => router.push(`/hub/${org.id}` as any)}
                      onCopyLink={() => handleCopyLink(org)}
                    />
                    {copiedId === org.id && (
                      <View style={styles.copiedToast}>
                        <CheckCircle2 size={12} color="#16A34A" />
                        <Text style={styles.copiedToastText}>Link copied!</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ── Search results — not yet enabled ── */}
          {notEnabled.length > 0 && (
            <View style={styles.listSection}>
              <View style={styles.sectionHeader}>
                <User size={13} color={Colors.light.textSecondary} />
                <Text style={[styles.sectionTitle, { color: Colors.light.textSecondary }]}>
                  Add to Hub
                </Text>
                <View style={[styles.sectionCountBadge, { backgroundColor: '#F3F4F6' }]}>
                  <Text style={[styles.sectionCountText, { color: Colors.light.textSecondary }]}>{notEnabled.length}</Text>
                </View>
              </View>
              <View style={styles.addList}>
                {notEnabled.map((org, idx) => (
                  <View key={org.id} style={idx < notEnabled.length - 1 ? styles.addRowDivider : undefined}>
                    <AddOrgRow
                      org={org}
                      onEnable={() => handleEnableHub(org)}
                      enabling={togglingOrgId === org.id}
                    />
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ── Empty states ── */}
          {orgs.length === 0 && (
            <View style={styles.emptyContainer}>
              <Globe size={44} color={Colors.light.border} />
              <Text style={styles.emptyTitle}>No organizations yet</Text>
              <Text style={styles.emptySub}>
                Add organizations in Contacts to manage their Client Hubs here.
              </Text>
            </View>
          )}

          {orgs.length > 0 && hubEnabled.length === 0 && !q && (
            <View style={styles.emptyContainer}>
              <Globe size={44} color={Colors.light.border} />
              <Text style={styles.emptyTitle}>No hubs enabled yet</Text>
              <Text style={styles.emptySub}>
                Search for an organization above to enable their Client Hub and generate a portal link.
              </Text>
            </View>
          )}

          {q && hubEnabled.length === 0 && notEnabled.length === 0 && (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No results for "{search}"</Text>
            </View>
          )}

          <View style={{ height: 32 }} />
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

  // Page header
  pageHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    gap: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    backgroundColor: Colors.light.surface,
  },
  pageTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.light.text,
  },
  countPill: {
    backgroundColor: '#FFF0E8',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  countPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.tint,
  },
  pageSubtitle: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    lineHeight: 18,
    marginTop: 2,
  },

  // Search
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    borderRadius: 10,
    backgroundColor: Colors.light.surface,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 9,
    paddingRight: 12,
    fontSize: 14,
    color: Colors.light.text,
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

  // List
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    gap: 24,
  },
  listSection: {
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 2,
    marginBottom: 2,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.light.text,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    flex: 1,
  },
  sectionCountBadge: {
    backgroundColor: '#DCFCE7',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  sectionCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },

  // Card grid
  cardGrid: {
    gap: 12,
  },
  cardGridTwoCol: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },

  // Card
  card: {
    backgroundColor: Colors.light.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.light.border,
    overflow: 'hidden',
    // shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },

  // Card top section
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    gap: 14,
  },
  orgLogo: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: Colors.light.border,
    flexShrink: 0,
  },
  orgInitialAvatar: {
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  orgInitialText: {
    fontWeight: '800',
    color: '#fff',
  },
  cardTopText: {
    flex: 1,
    gap: 8,
  },
  orgName: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.light.text,
    lineHeight: 22,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  hubBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#EDE9FE',
  },
  hubBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#7C3AED',
  },

  // Card divider
  cardDivider: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginHorizontal: 0,
  },

  // Card meta section
  cardMeta: {
    padding: 14,
    gap: 7,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  metaText: {
    fontSize: 12,
    color: Colors.light.text,
    flex: 1,
  },

  // Card actions
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: '#FAFAFA',
  },
  actionPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.light.tint,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flex: 1,
    justifyContent: 'center',
  },
  actionPrimaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  actionSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: Colors.light.tint,
    flex: 1,
    justifyContent: 'center',
  },
  actionSecondaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.light.tint,
  },
  actionGhost: {
    padding: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Copied toast
  copiedToast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
    alignSelf: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#DCFCE7',
    borderRadius: 20,
  },
  copiedToastText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#15803D',
  },

  // Add-to-hub rows
  addList: {
    backgroundColor: Colors.light.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    overflow: 'hidden',
  },
  addRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  addRowAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.light.border,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  addRowAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.light.textSecondary,
  },
  addRowInfo: {
    flex: 1,
    gap: 2,
  },
  addRowName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
  },
  addRowSub: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  enableBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.light.tint,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  enableBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },

  // Empty
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.text,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
