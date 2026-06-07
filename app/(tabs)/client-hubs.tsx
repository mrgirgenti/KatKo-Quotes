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
  Check,
  X,
  Users,
  ShieldCheck,
  Mail,
  UserX,
  Wrench,
  Ban,
  ToggleLeft,
  ToggleRight,
  Plus,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useCrm } from '@/contexts/CrmContext';
import { Organization, Contact } from '@/types/crm';
import { OrgAvatar } from '@/components/OrgAvatar';
import { metricValueStyle, metricLabelStyle } from '@/components/Metric';

function getPrimaryContact(org: Organization): Contact | undefined {
  return org.contacts.find((c) => c.isPrimary) ?? org.contacts[0];
}

// ── Hub status model ─────────────────────────────────────────────────────────────
type HubStatusKey = 'Active' | 'Pending Setup' | 'Invite Pending' | 'No Users' | 'Disabled';

const HUB_STATUS_CFG: Record<HubStatusKey, { label: string; color: string; bg: string; border: string; dot: string; Icon: any }> = {
  'Active':        { label: 'Active',        color: '#15803D', bg: '#DCFCE7', border: '#86EFAC', dot: '#16A34A', Icon: ShieldCheck },
  'Invite Pending':{ label: 'Invite Pending',color: '#B45309', bg: '#FEF3C7', border: '#FCD34D', dot: '#D97706', Icon: Mail },
  'Pending Setup': { label: 'Pending Setup', color: '#4338CA', bg: '#EEF2FF', border: '#C7D2FE', dot: '#6366F1', Icon: Wrench },
  'No Users':      { label: 'No Users',      color: '#6B7280', bg: '#F3F4F6', border: '#E5E7EB', dot: '#9CA3AF', Icon: UserX },
  'Disabled':      { label: 'Disabled',      color: '#B91C1C', bg: '#FEE2E2', border: '#FCA5A5', dot: '#EF4444', Icon: Ban },
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
  // "Hub users" = contacts granted portal access (anything other than No Access).
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

// ── Filter chips ─────────────────────────────────────────────────────────────────
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

// ── Columns ──────────────────────────────────────────────────────────────────────
type SortField = 'name' | 'users' | 'lastLogin' | 'invites' | 'status';
const CHECKBOX_W = 36;
const AVATAR_W = 44;
const COL = { users: 110, lastLogin: 150, invites: 130, status: 168, actions: 180 };
const TABLE_MIN_W = 1100;

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

// ── Table row ──
function HubRow({
  stats, onPress, onOpenHub, onCopyLink, copied, onToggle, enabling, isSelected, onToggleSelect,
}: {
  stats: HubStats;
  onPress: () => void;
  onOpenHub: () => void;
  onCopyLink: () => void;
  copied: boolean;
  onToggle: () => void;
  enabling: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
}) {
  const { org } = stats;
  const last = fmtDate(stats.lastLogin);

  return (
    <TouchableOpacity style={[styles.tableRow, !org.hubEnabled && styles.tableRowOff, isSelected && styles.tableRowSelected]} onPress={onPress} activeOpacity={0.7}>
      <TouchableOpacity style={styles.colCheckbox} onPress={(e) => { e.stopPropagation?.(); onToggleSelect(); }} activeOpacity={0.7}>
        <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
          {isSelected && <Check size={11} color="#fff" />}
        </View>
      </TouchableOpacity>
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
        {last ? <Text style={styles.tableCell} numberOfLines={1}>{last}</Text> : <Text style={styles.tableDim}>Never</Text>}
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
            <TouchableOpacity style={styles.actionPrimary} onPress={(e) => { e.stopPropagation?.(); onOpenHub(); }} activeOpacity={0.8}>
              <ExternalLink size={12} color="#fff" />
              <Text style={styles.actionPrimaryText}>Open</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionGhost, copied && styles.actionGhostDone]} onPress={(e) => { e.stopPropagation?.(); onCopyLink(); }} activeOpacity={0.8}>
              {copied ? <CheckCircle2 size={13} color="#16A34A" /> : <Copy size={13} color={Colors.light.textSecondary} />}
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionGhost} onPress={(e) => { e.stopPropagation?.(); onPress(); }} activeOpacity={0.8}>
              <Settings size={13} color={Colors.light.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={(e) => { e.stopPropagation?.(); onToggle(); }} activeOpacity={0.7}>
              {enabling ? <ActivityIndicator size="small" color={Colors.light.tint} style={{ width: 22 }} /> : <ToggleRight size={22} color="#FF5A00" />}
            </TouchableOpacity>
          </>
        ) : (
          enabling
            ? <ActivityIndicator size="small" color={Colors.light.tint} />
            : (
              <TouchableOpacity style={styles.enableBtn} onPress={(e) => { e.stopPropagation?.(); onToggle(); }} activeOpacity={0.75}>
                <Plus size={12} color="#fff" />
                <Text style={styles.enableBtnText}>Enable</Text>
              </TouchableOpacity>
            )
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
  const [chip, setChip] = useState<ChipId>('All');
  const [togglingOrgId, setTogglingOrgId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('status');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const now = Date.now();

  const decorated = useMemo(() => orgs.map((o) => computeHubStats(o, now)), [orgs, now]);

  // ── Metrics ──
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

  // ── Chip counts ──
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

  // Selection UI is driven by the intersection with the visible rows, so chip/search
  // changes never leave a stale checked/indeterminate header or count.
  const visibleSelectedCount = useMemo(
    () => filtered.reduce((n, s) => (selectedIds.has(s.org.id) ? n + 1 : n), 0),
    [filtered, selectedIds],
  );
  const selectionMode = visibleSelectedCount > 0;
  const allSelected = filtered.length > 0 && visibleSelectedCount === filtered.length;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  const handleToggleHub = useCallback(
    (org: Organization) => {
      const newEnabled = !org.hubEnabled;
      setTogglingOrgId(org.id);
      updateOrgHubEnabled({ orgId: org.id, enabled: newEnabled });
      setTimeout(() => {
        setTogglingOrgId(null);
        if (newEnabled) router.push(`/crm/${org.id}` as any);
      }, 500);
    },
    [updateOrgHubEnabled, router],
  );

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

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);
  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);
  const toggleSelectAll = useCallback(() => {
    if (allSelected) clearSelection();
    else setSelectedIds(new Set(filtered.map((s) => s.org.id)));
  }, [filtered, allSelected, clearSelection]);

  const SortBtn = ({ field, label }: { field: SortField; label: string }) => (
    <TouchableOpacity style={styles.sortBtn} onPress={() => toggleSort(field)} activeOpacity={0.7}>
      <Text style={[styles.sortBtnText, sortField === field && styles.sortBtnTextActive]} numberOfLines={1}>{label}</Text>
      <ArrowUpDown size={11} color={sortField === field ? Colors.light.tint : 'rgba(255,255,255,0.35)'} />
    </TouchableOpacity>
  );

  const tableHeader = (
    <View style={styles.tableHeader}>
      <TouchableOpacity style={styles.colCheckbox} onPress={toggleSelectAll} activeOpacity={0.7}>
        <View style={[styles.checkbox,
          allSelected && styles.checkboxChecked,
          !allSelected && visibleSelectedCount > 0 && styles.checkboxIndeterminate,
        ]}>
          {visibleSelectedCount > 0 && <Check size={11} color="#fff" />}
        </View>
      </TouchableOpacity>
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
      {/* ── Page header ── */}
      <View style={styles.pageHeader}>
        <View style={styles.headerTop}>
          <Text style={styles.pageTitle}>Client Hubs</Text>
        </View>

        {/* Metrics row */}
        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: Colors.light.tint }]}>{metrics.totalHubs}</Text>
            <Text style={styles.statLabel}>Total Hubs</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#16A34A' }]}>{metrics.loggedIn30}</Text>
            <Text style={styles.statLabel}>Logged In (30 Days)</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#D97706' }]}>{metrics.pendingInvites}</Text>
            <Text style={styles.statLabel}>Pending Invites</Text>
          </View>
        </View>

        {/* Filter chips */}
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

        {/* Search row */}
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

      {/* ── Bulk action bar ── */}
      {selectionMode && (
        <View style={styles.bulkBar}>
          <View style={styles.bulkBarLeft}>
            <TouchableOpacity style={styles.bulkClearBtn} onPress={clearSelection}>
              <X size={12} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.bulkCount}>{visibleSelectedCount} selected</Text>
          </View>
          <View style={styles.bulkActionsRow}>
            <TouchableOpacity
              style={styles.bulkAction}
              onPress={() => {
                const toToggle = filtered.filter((s) => selectedIds.has(s.org.id));
                const allEnabled = toToggle.every((s) => s.org.hubEnabled);
                toToggle.forEach((s) => updateOrgHubEnabled({ orgId: s.org.id, enabled: !allEnabled }));
                clearSelection();
              }}
            >
              {filtered.filter((s) => selectedIds.has(s.org.id)).every((s) => s.org.hubEnabled)
                ? <ToggleLeft size={13} color="rgba(255,255,255,0.9)" />
                : <ToggleRight size={13} color="rgba(255,255,255,0.9)" />}
              <Text style={styles.bulkActionText}>
                {filtered.filter((s) => selectedIds.has(s.org.id)).every((s) => s.org.hubEnabled) ? 'Disable Hubs' : 'Enable Hubs'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={Colors.light.tint} size="large" />
          <Text style={styles.loadingText}>Loading client hubs…</Text>
        </View>
      ) : orgs.length === 0 ? (
        <View style={styles.emptyState}>
          <Globe size={44} color={Colors.light.border} />
          <Text style={styles.emptyTitle}>No organizations yet</Text>
          <Text style={styles.emptyText}>Add organizations in Contacts to manage their Client Hubs here.</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Globe size={44} color={Colors.light.border} />
          <Text style={styles.emptyTitle}>{q ? `No results for "${search}"` : 'No hubs match this filter'}</Text>
          <Text style={styles.emptyText}>{q ? 'Try a different search term.' : 'Switch filters to see other client hubs.'}</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.light.tint} />}
        >
          <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ flexGrow: 1 }}>
            <View style={{ minWidth: TABLE_MIN_W, flexGrow: 1 }}>
              {tableHeader}
              <View style={styles.tableBody}>
                {filtered.map((s, idx) => (
                  <View key={s.org.id}>
                    <HubRow
                      stats={s}
                      onPress={() => router.push(`/crm/${s.org.id}` as any)}
                      onOpenHub={() => { if (Platform.OS === 'web' && typeof window !== 'undefined') window.open(`/portal/${s.org.id}`, '_blank'); else router.push(`/portal/${s.org.id}` as any); }}
                      onCopyLink={() => handleCopyLink(s.org)}
                      copied={copiedId === s.org.id}
                      onToggle={() => handleToggleHub(s.org)}
                      enabling={togglingOrgId === s.org.id}
                      isSelected={selectedIds.has(s.org.id)}
                      onToggleSelect={() => toggleSelect(s.org.id)}
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

  // Page header
  pageHeader: {
    backgroundColor: Colors.light.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    paddingTop: Platform.OS === 'web' ? 0 : 48,
  },
  headerTop: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14, flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  pageTitle: { fontSize: 24, fontWeight: '800' as const, color: Colors.light.text },

  // Metrics
  statsBar: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 12,
    backgroundColor: Colors.light.background, borderRadius: 10, borderWidth: 1, borderColor: Colors.light.border,
    paddingVertical: 12, paddingHorizontal: 6,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 3 },
  statValue: { ...metricValueStyle },
  statLabel: { ...metricLabelStyle, textAlign: 'center' as const },
  statDivider: { width: 1, height: 32, backgroundColor: Colors.light.border },

  // Chips
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

  // Search
  searchRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingBottom: 12, alignItems: 'center' },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.light.background, borderRadius: 10, borderWidth: 1, borderColor: Colors.light.border,
    paddingHorizontal: 12, height: 40,
  },
  searchInput: { flex: 1, fontSize: 14, color: Colors.light.text, outlineStyle: 'none' as any },

  // Loading / empty
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14 },
  loadingText: { fontSize: 14, color: Colors.light.textSecondary },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '700' as const, color: Colors.light.text },
  emptyText: { fontSize: 13, color: Colors.light.textSecondary, textAlign: 'center' as const },

  // Table
  list: { flex: 1 },
  tableHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#000000' },
  thText: { fontSize: 11, fontWeight: '700' as const, color: '#FFFFFF', textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  sortBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4 },
  sortBtnText: { fontSize: 11, fontWeight: '700' as const, color: '#FFFFFF', textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  sortBtnTextActive: { color: Colors.light.tint },

  colCheckbox: { width: CHECKBOX_W, justifyContent: 'center' as const, alignItems: 'center' as const },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)', alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: 'transparent' as const },
  checkboxChecked: { backgroundColor: Colors.light.tint, borderColor: Colors.light.tint },
  checkboxIndeterminate: { backgroundColor: Colors.light.tint, borderColor: Colors.light.tint },

  bulkBar: { flexDirection: 'row' as const, alignItems: 'center' as const, backgroundColor: '#1C1C1E', paddingVertical: 8, paddingHorizontal: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: '#333' },
  bulkBarLeft: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, minWidth: 100 },
  bulkCount: { fontSize: 13, fontWeight: '700' as const, color: '#fff' },
  bulkClearBtn: { width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center' as const, justifyContent: 'center' as const },
  bulkActionsRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4 },
  bulkAction: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.12)' },
  bulkActionText: { fontSize: 12, fontWeight: '600' as const, color: 'rgba(255,255,255,0.9)' },

  tableBody: { backgroundColor: Colors.light.surface },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Colors.light.surface },
  tableRowOff: { backgroundColor: '#FAFAFA' },
  tableRowSelected: { backgroundColor: '#FFF9F6' },
  tableDivider: { height: 1, backgroundColor: Colors.light.border, marginLeft: 16 },

  // Columns
  colAvatar: { width: AVATAR_W },
  colOrg: { flex: 2, minWidth: 220, paddingRight: 12 },
  colUsers: { width: COL.users },
  colLastLogin: { width: COL.lastLogin },
  colInvites: { width: COL.invites },
  colStatus: { width: COL.status },
  colActions: { flexDirection: 'row', alignItems: 'center', gap: 6, width: COL.actions, justifyContent: 'flex-end' },
  colActionsHeader: { width: COL.actions, textAlign: 'right' as const },

  // Row content
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

  // Actions
  actionPrimary: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, height: 28, borderRadius: 7, backgroundColor: Colors.light.tint },
  actionPrimaryText: { fontSize: 12, fontWeight: '700' as const, color: '#fff' },
  actionGhost: { width: 28, height: 28, borderRadius: 7, borderWidth: 1, borderColor: Colors.light.border, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.light.surface },
  actionGhostDone: { borderColor: '#86EFAC', backgroundColor: '#F0FDF4' },
  enableBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, height: 28, borderRadius: 7, backgroundColor: Colors.light.tint },
  enableBtnText: { fontSize: 12, fontWeight: '700' as const, color: '#fff' },
});
