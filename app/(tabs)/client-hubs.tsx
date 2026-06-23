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
  Copy,
  Settings,
  ExternalLink,
  ArrowUpDown,
  X,
  Users,
  ShieldCheck,
  Mail,
  UserX,
  Wrench,
  Ban,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useCrm } from '@/contexts/CrmContext';
import { Organization, Contact } from '@/types/crm';
import { OrgAvatar } from '@/components/OrgAvatar';
import { metricValueStyle, metricLabelStyle, metricValueStyleMobile, metricLabelStyleMobile } from '@/components/Metric';
import { useBreakpoint } from '@/hooks/useBreakpoint';

function getPrimaryContact(org: Organization): Contact | undefined {
  return org.contacts.find((c) => c.isPrimary) ?? org.contacts[0];
}

type HubStatusKey = 'Active' | 'Pending Setup' | 'Invite Pending' | 'No Users' | 'Disabled';

const HUB_STATUS_CFG: Record<HubStatusKey, { label: string; color: string; bg: string; border: string; dot: string; Icon: any }> = {
  'Active':         { label: 'Active',        color: '#15803D', bg: '#DCFCE7', border: '#86EFAC', dot: '#16A34A', Icon: ShieldCheck },
  'Invite Pending': { label: 'Invite Pending', color: '#B45309', bg: '#FEF3C7', border: '#FCD34D', dot: '#D97706', Icon: Mail },
  'Pending Setup':  { label: 'Pending Setup',  color: '#4338CA', bg: '#EEF2FF', border: '#C7D2FE', dot: '#6366F1', Icon: Wrench },
  'No Users':       { label: 'No Users',       color: '#6B7280', bg: '#F3F4F6', border: '#E5E7EB', dot: '#9CA3AF', Icon: UserX },
  'Disabled':       { label: 'Deactivated',    color: '#B91C1C', bg: '#FEE2E2', border: '#FCA5A5', dot: '#EF4444', Icon: Ban },
};

const HUB_STATUS_RANK: Record<HubStatusKey, number> = {
  'Active': 0, 'Invite Pending': 1, 'Pending Setup': 2, 'No Users': 3, 'Disabled': 4,
};

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

type HubStats = {
  org: Organization;
  userCount: number;
  activeCount: number;
  invitedCount: number;
  recentlyActive: number;
  lastLogin: number | null;
  status: HubStatusKey;
  primaryName: string | null;
  primaryEmail: string | null;
};

function computeHubStats(org: Organization, now: number): HubStats {
  const contacts = org.contacts || [];
  const users = contacts.filter((c) => c.hubStatus && c.hubStatus !== 'No Access');
  const activeCount = contacts.filter((c) => c.hubStatus === 'Active').length;
  const invitedCount = contacts.filter((c) => c.hubStatus === 'Invited').length;

  let lastLogin: number | null = null;
  let recentlyActive = 0;
  for (const c of users) {
    if (!c.lastLoginAt) continue;
    const t = new Date(c.lastLoginAt).getTime();
    if (isNaN(t)) continue;
    if (lastLogin === null || t > lastLogin) lastLogin = t;
    if (t <= now && now - t <= THIRTY_DAYS_MS) recentlyActive += 1;
  }

  let status: HubStatusKey;
  if (!org.hubEnabled) status = 'Disabled';
  else if (activeCount > 0) status = 'Active';
  else if (invitedCount > 0) status = 'Invite Pending';
  else if (users.length > 0) status = 'No Users';
  else status = 'Pending Setup';

  const primary = getPrimaryContact(org);
  const primaryName = primary ? `${primary.firstName} ${primary.lastName}`.trim() || null : null;

  return {
    org,
    userCount: users.length,
    activeCount,
    invitedCount,
    recentlyActive,
    lastLogin,
    status,
    primaryName,
    primaryEmail: primary?.email || null,
  };
}

function fmtDate(ms: number | null) {
  if (ms === null) return null;
  const d = new Date(ms);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

type ChipId = 'All' | 'Active' | 'Invite Pending' | 'No Users' | 'Inactive';
const CHIPS: ChipId[] = ['All', 'Active', 'Invite Pending', 'No Users', 'Inactive'];

function matchesChip(chip: ChipId, s: HubStats): boolean {
  switch (chip) {
    case 'All': return true;
    case 'Active': return s.status === 'Active';
    case 'Invite Pending': return s.status === 'Invite Pending';
    case 'No Users': return s.status === 'No Users' || s.status === 'Pending Setup';
    case 'Inactive': return s.status === 'Disabled';
  }
}

type SortField = 'name' | 'users' | 'lastLogin' | 'invites' | 'status';
const AVATAR_W = 44;
const COL = { users: 88, lastLogin: 118, invites: 88, status: 128, actions: 120 };
const TABLE_MIN_W = 780;

function HubStatusBadge({ status }: { status: HubStatusKey }) {
  const cfg = HUB_STATUS_CFG[status];
  const Icon = cfg.Icon;
  return (
    <View style={[styles.hubBadge, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
      <Icon size={11} color={cfg.color} />
      <Text style={[styles.hubBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

function HubRow({
  stats,
  onPress,
  onOpenHub,
  onCopyLink,
  copied,
}: {
  stats: HubStats;
  onPress: () => void;
  onOpenHub: () => void;
  onCopyLink: () => void;
  copied: boolean;
}) {
  const { org } = stats;
  const last = fmtDate(stats.lastLogin);

  return (
    <TouchableOpacity
      style={[styles.tableRow, !org.hubEnabled && styles.tableRowOff]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.colAvatar}>
        <OrgAvatar name={org.name} logoUrl={org.logoUrl} size={36} shape="circle" />
      </View>
      <View style={styles.colOrg}>
        <Text style={styles.tableOrgName} numberOfLines={1}>{org.name}</Text>
        {stats.primaryName
          ? <Text style={styles.tableSub} numberOfLines={1}>{stats.primaryName}{stats.primaryEmail ? ` · ${stats.primaryEmail}` : ''}</Text>
          : <Text style={styles.tableSubDim} numberOfLines={1}>No primary contact</Text>}
      </View>
      <View style={styles.colUsers}>
        {stats.userCount > 0 ? (
          <View style={styles.usersPill}>
            <Users size={12} color={Colors.light.textSecondary} />
            <Text style={styles.usersPillText}>{stats.userCount}</Text>
          </View>
        ) : <Text style={styles.tableDim}>—</Text>}
      </View>
      <View style={styles.colLastLogin}>
        {last
          ? <Text style={styles.tableCell} numberOfLines={1}>{last}</Text>
          : <Text style={styles.tableDim}>Never</Text>}
      </View>
      <View style={styles.colInvites}>
        {stats.invitedCount > 0 ? (
          <View style={styles.invitePill}>
            <Mail size={11} color="#B45309" />
            <Text style={styles.invitePillText}>{stats.invitedCount}</Text>
          </View>
        ) : <Text style={styles.tableDim}>—</Text>}
      </View>
      <View style={styles.colStatus}>
        <HubStatusBadge status={stats.status} />
      </View>
      <View style={styles.colActions}>
        {org.hubEnabled ? (
          <>
            <TouchableOpacity
              style={styles.actionPrimary}
              onPress={(e) => { e.stopPropagation?.(); onOpenHub(); }}
              activeOpacity={0.8}
            >
              <ExternalLink size={12} color="#fff" />
              <Text style={styles.actionPrimaryText}>Open</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionGhost, copied && styles.actionGhostDone]}
              onPress={(e) => { e.stopPropagation?.(); onCopyLink(); }}
              activeOpacity={0.8}
            >
              {copied
                ? <CheckCircle2 size={13} color="#16A34A" />
                : <Copy size={13} color={Colors.light.textSecondary} />}
            </TouchableOpacity>
          </>
        ) : null}
        <TouchableOpacity
          style={styles.actionGhost}
          onPress={(e) => { e.stopPropagation?.(); onPress(); }}
          activeOpacity={0.8}
        >
          <Settings size={13} color={Colors.light.textSecondary} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

export default function ClientHubsScreen() {
  const router = useRouter();
  const { orgs, isLoading } = useCrm();
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [chip, setChip] = useState<ChipId>('All');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('status');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const { isMobile } = useBreakpoint();

  const now = Date.now();

  const decorated = useMemo(
    () =>
      orgs
        .filter((o) => o.hubEnabled || o.hubEverEnabled)
        .map((o) => computeHubStats(o, now)),
    [orgs, now],
  );

  const metrics = useMemo(() => {
    let totalHubs = 0;
    let loggedIn30 = 0;
    let pendingInvites = 0;
    for (const s of decorated) {
      if (s.org.hubEnabled) {
        totalHubs += 1;
        loggedIn30 += s.recentlyActive;
        pendingInvites += s.invitedCount;
      }
    }
    return { totalHubs, loggedIn30, pendingInvites };
  }, [decorated]);

  const chipCounts = useMemo(() => {
    const c: Record<ChipId, number> = { 'All': decorated.length, 'Active': 0, 'Invite Pending': 0, 'No Users': 0, 'Inactive': 0 };
    for (const s of decorated) {
      if (matchesChip('Active', s)) c['Active'] += 1;
      if (matchesChip('Invite Pending', s)) c['Invite Pending'] += 1;
      if (matchesChip('No Users', s)) c['No Users'] += 1;
      if (matchesChip('Inactive', s)) c['Inactive'] += 1;
    }
    return c;
  }, [decorated]);

  const q = search.toLowerCase().trim();

  const filtered = useMemo(() => {
    const list = decorated.filter((s) => {
      if (!matchesChip(chip, s)) return false;
      if (q) {
        const org = s.org;
        const hit =
          org.name.toLowerCase().includes(q) ||
          (s.primaryName || '').toLowerCase().includes(q) ||
          (s.primaryEmail || '').toLowerCase().includes(q) ||
          org.contacts.some((c) =>
            `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
            (c.email || '').toLowerCase().includes(q));
        if (!hit) return false;
      }
      return true;
    });
    const dir = sortDir === 'asc' ? 1 : -1;
    const nameOf = (s: HubStats) => s.org.name.toLowerCase();
    return [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name': cmp = nameOf(a).localeCompare(nameOf(b)); break;
        case 'users': cmp = a.userCount - b.userCount; break;
        case 'lastLogin': cmp = (a.lastLogin ?? 0) - (b.lastLogin ?? 0); break;
        case 'invites': cmp = a.invitedCount - b.invitedCount; break;
        case 'status': cmp = HUB_STATUS_RANK[a.status] - HUB_STATUS_RANK[b.status]; break;
      }
      if (cmp === 0) cmp = nameOf(a).localeCompare(nameOf(b));
      return cmp * dir;
    });
  }, [decorated, chip, q, sortField, sortDir]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  const handleCopyLink = useCallback((org: Organization) => {
    const link = Platform.OS === 'web' ? `${window.location.origin}/portal/${org.id}` : `/portal/${org.id}`;
    if (Platform.OS === 'web' && navigator.clipboard) navigator.clipboard.writeText(link).catch(() => {});
    setCopiedId(org.id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const toggleSort = useCallback((field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('asc'); }
  }, [sortField]);

  const SortBtn = ({ field, label }: { field: SortField; label: string }) => (
    <TouchableOpacity style={styles.sortBtn} onPress={() => toggleSort(field)} activeOpacity={0.7}>
      <Text style={[styles.sortBtnText, sortField === field && styles.sortBtnTextActive]} numberOfLines={1}>{label}</Text>
      <ArrowUpDown size={11} color={sortField === field ? Colors.light.tint : 'rgba(255,255,255,0.35)'} />
    </TouchableOpacity>
  );

  const tableHeader = (
    <View style={styles.tableHeader}>
      <View style={styles.colAvatar} />
      <View style={styles.colOrg}><SortBtn field="name" label="Organization" /></View>
      <View style={styles.colUsers}><SortBtn field="users" label="Hub Users" /></View>
      <View style={styles.colLastLogin}><SortBtn field="lastLogin" label="Last Login" /></View>
      <View style={styles.colInvites}><SortBtn field="invites" label="Pending Invites" /></View>
      <View style={styles.colStatus}><SortBtn field="status" label="Hub Status" /></View>
      <Text style={[styles.thText, styles.colActionsHeader]}>ACTIONS</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.pageHeader}>
        <View style={styles.headerTop}>
          <Text style={[styles.pageTitle, isMobile && styles.pageTitleMobile]}>Client Hubs</Text>
          <Text style={styles.pageSubtitle}>Read-only monitoring — manage hubs from Organization Details</Text>
        </View>

        <View style={[styles.statsBar, isMobile && styles.statBarMobile]}>
          <View style={[styles.statItem, isMobile && styles.statItemMobile]}>
            <Text style={[styles.statValue, isMobile && styles.statValueMobile, { color: Colors.light.tint }]}>{metrics.totalHubs}</Text>
            <Text style={[styles.statLabel, isMobile && styles.statLabelMobile]}>Active Hubs</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={[styles.statItem, isMobile && styles.statItemMobile]}>
            <Text style={[styles.statValue, isMobile && styles.statValueMobile, { color: '#16A34A' }]}>{metrics.loggedIn30}</Text>
            <Text style={[styles.statLabel, isMobile && styles.statLabelMobile]}>Logged In (30 Days)</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={[styles.statItem, isMobile && styles.statItemMobile]}>
            <Text style={[styles.statValue, isMobile && styles.statValueMobile, { color: '#D97706' }]}>{metrics.pendingInvites}</Text>
            <Text style={[styles.statLabel, isMobile && styles.statLabelMobile]}>Pending Invites</Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={styles.chipsRow}>
          {CHIPS.map((c) => {
            const active = chip === c;
            return (
              <TouchableOpacity key={c} style={[styles.chip, active && styles.chipActive]} onPress={() => setChip(c)} activeOpacity={0.8}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{c}</Text>
                <View style={[styles.chipCount, active && styles.chipCountActive]}>
                  <Text style={[styles.chipCountText, active && styles.chipCountTextActive]}>{chipCounts[c]}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Search size={15} color={Colors.light.textSecondary} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search organization, contact, email…"
              placeholderTextColor={Colors.light.textSecondary}
            />
            {search ? <TouchableOpacity onPress={() => setSearch('')}><X size={15} color={Colors.light.textSecondary} /></TouchableOpacity> : null}
          </View>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={Colors.light.tint} size="large" />
          <Text style={styles.loadingText}>Loading client hubs…</Text>
        </View>
      ) : decorated.length === 0 ? (
        <View style={styles.emptyState}>
          <Globe size={44} color={Colors.light.border} />
          <Text style={styles.emptyTitle}>No Client Hubs yet</Text>
          <Text style={styles.emptyText}>Enable a Client Hub from a client's Organization Details page and it will appear here.</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Globe size={44} color={Colors.light.border} />
          <Text style={styles.emptyTitle}>{q ? `No results for "${search}"` : 'No hubs match this filter'}</Text>
          <Text style={styles.emptyText}>{q ? 'Try a different search term.' : 'Switch filters to see other client hubs.'}</Text>
        </View>
      ) : (
        <ScrollView
          style={[styles.list, { outlineStyle: 'none' } as any]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.light.tint} />}
        >
          <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ flexGrow: 1 }} style={{ outlineStyle: 'none' } as any}>
            <View style={{ minWidth: TABLE_MIN_W, flexGrow: 1 }}>
              {tableHeader}
              <View style={styles.tableBody}>
                {filtered.map((s, idx) => (
                  <View key={s.org.id}>
                    <HubRow
                      stats={s}
                      onPress={() => router.push(`/crm/${s.org.id}` as any)}
                      onOpenHub={() => {
                        if (Platform.OS === 'web' && typeof window !== 'undefined')
                          window.open(`/portal/${s.org.id}`, '_blank');
                        else router.push(`/portal/${s.org.id}` as any);
                      }}
                      onCopyLink={() => handleCopyLink(s.org)}
                      copied={copiedId === s.org.id}
                    />
                    {idx < filtered.length - 1 && <View style={styles.tableDivider} />}
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },

  pageHeader: {
    backgroundColor: Colors.light.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    paddingTop: Platform.OS === 'web' ? 0 : 48,
  },
  headerTop: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10, gap: 3 },
  pageTitle: { fontSize: 24, fontWeight: '800' as const, color: Colors.light.text },
  pageTitleMobile: { fontSize: 20 },
  pageSubtitle: { fontSize: 12, color: Colors.light.textSecondary },

  statsBar: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginHorizontal: 16, marginBottom: 12,
    backgroundColor: '#EBEBEB', borderRadius: 12, padding: 16,
  },
  statItem: { flex: 1, minWidth: 120, borderRadius: 10, paddingVertical: 14, paddingHorizontal: 12, backgroundColor: '#fff', alignItems: 'center' as const, gap: 3 },
  statValue: { ...metricValueStyle },
  statLabel: { ...metricLabelStyle, textAlign: 'center' as const },
  statDivider: { display: 'none' as any },
  statValueMobile: { ...metricValueStyleMobile },
  statLabelMobile: { ...metricLabelStyleMobile, textAlign: 'center' as const },
  statBarMobile: { padding: 13, gap: 10 },
  statItemMobile: { paddingVertical: 12, paddingHorizontal: 10 },

  chipsScroll: { flexGrow: 0, marginBottom: 12 },
  chipsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: Colors.light.border, backgroundColor: Colors.light.surface },
  chipActive: { backgroundColor: '#FFF4EE', borderColor: Colors.light.tint },
  chipText: { fontSize: 13, fontWeight: '600' as const, color: Colors.light.textSecondary },
  chipTextActive: { color: Colors.light.tint },
  chipCount: { minWidth: 20, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999, backgroundColor: '#F1F1F1', alignItems: 'center' },
  chipCountActive: { backgroundColor: Colors.light.tint },
  chipCountText: { fontSize: 11, fontWeight: '700' as const, color: Colors.light.textSecondary },
  chipCountTextActive: { color: '#fff' },

  searchRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingBottom: 12, alignItems: 'center' },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F5F5F5', borderRadius: 10, borderWidth: 1, borderColor: Colors.light.border,
    paddingHorizontal: 12, height: 40,
  },
  searchInput: { flex: 1, fontSize: 14, color: Colors.light.text, outlineStyle: 'none' as any },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14 },
  loadingText: { fontSize: 14, color: Colors.light.textSecondary },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '700' as const, color: Colors.light.text },
  emptyText: { fontSize: 13, color: Colors.light.textSecondary, textAlign: 'center' as const },

  list: { flex: 1 },
  tableHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#000000' },
  thText: { fontSize: 11, fontWeight: '700' as const, color: '#FFFFFF', textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  sortBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4 },
  sortBtnText: { fontSize: 11, fontWeight: '700' as const, color: '#FFFFFF', textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  sortBtnTextActive: { color: Colors.light.tint },

  tableBody: { backgroundColor: Colors.light.surface },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Colors.light.surface },
  tableRowOff: { backgroundColor: '#FAFAFA' },
  tableDivider: { height: 1, backgroundColor: Colors.light.border, marginLeft: 16 },

  colAvatar: { width: AVATAR_W },
  colOrg: { flex: 1, minWidth: 160, maxWidth: 300, paddingRight: 12 },
  colUsers: { width: COL.users },
  colLastLogin: { width: COL.lastLogin },
  colInvites: { width: COL.invites },
  colStatus: { width: COL.status },
  colActions: { flexDirection: 'row', alignItems: 'center', gap: 6, width: COL.actions, justifyContent: 'flex-end' },
  colActionsHeader: { width: COL.actions, textAlign: 'right' as const },

  tableOrgName: { fontSize: 14, fontWeight: '700' as const, color: Colors.light.text },
  tableSub: { fontSize: 12, color: Colors.light.textSecondary, marginTop: 1 },
  tableSubDim: { fontSize: 12, color: Colors.light.border, marginTop: 1 },
  tableCell: { fontSize: 13, color: Colors.light.text },
  tableDim: { fontSize: 13, color: Colors.light.border },

  usersPill: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  usersPillText: { fontSize: 13, fontWeight: '700' as const, color: Colors.light.text },
  invitePill: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FCD34D' },
  invitePillText: { fontSize: 12, fontWeight: '700' as const, color: '#B45309' },

  hubBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
  hubBadgeText: { fontSize: 11, fontWeight: '700' as const },

  actionPrimary: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, height: 28, borderRadius: 7, backgroundColor: Colors.light.tint },
  actionPrimaryText: { fontSize: 12, fontWeight: '700' as const, color: '#fff' },
  actionGhost: { width: 28, height: 28, borderRadius: 7, borderWidth: 1, borderColor: Colors.light.border, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.light.surface },
  actionGhostDone: { borderColor: '#86EFAC', backgroundColor: '#F0FDF4' },
});
