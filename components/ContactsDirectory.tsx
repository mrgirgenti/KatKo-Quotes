import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Modal, Pressable, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { OrgAvatar } from '@/components/OrgAvatar';
import {
  Search, X, Users, ChevronDown, Check,
  Wifi, ShieldCheck, Mail, Ban, MinusCircle, Building2, ArrowUpDown, Trash2,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { DS } from '@/constants/designSystem';
import { metricValueStyle, metricLabelStyle } from '@/components/Metric';
import { useCrm } from '@/contexts/CrmContext';
import { Contact } from '@/types/crm';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { formatPhone } from '@/utils/phone';

type Person = Contact & { orgId: string; orgName: string; orgLogo?: string };
type HubStatus = NonNullable<Contact['hubStatus']>;
type Tab = 'All' | 'Portal Users' | 'Non-Portal' | 'Active' | 'Inactive';

const TABS: Tab[] = ['All', 'Portal Users', 'Non-Portal', 'Active', 'Inactive'];

const HUB_CFG: Record<HubStatus, { label: string; color: string; bg: string; border: string; Icon: any }> = {
  'Active':    { label: 'Active',    color: '#15803D', bg: '#DCFCE7', border: '#86EFAC', Icon: ShieldCheck },
  'Invited':   { label: 'Invited',   color: '#4338CA', bg: '#EEF2FF', border: '#C7D2FE', Icon: Mail },
  'Disabled':  { label: 'Disabled',  color: '#B91C1C', bg: '#FEE2E2', border: '#FCA5A5', Icon: Ban },
  'No Access': { label: 'No Access', color: '#6B7280', bg: '#F3F4F6', border: '#E5E7EB', Icon: MinusCircle },
};

type ColId = 'name' | 'org' | 'role' | 'email' | 'phone' | 'hub' | 'lastLogin' | 'status';
const CHECKBOX_W = 36;
const COL_WIDTHS: Record<ColId, number> = {
  name: 180, org: 170, role: 130, email: 200, phone: 130, hub: 120, lastLogin: 130, status: 100,
};
const COL_FLEX: Partial<Record<ColId, number>> = { name: 1.6, org: 1.4, email: 1.6 };

function HubBadge({ status }: { status: HubStatus }) {
  const cfg = HUB_CFG[status];
  const Icon = cfg.Icon;
  return (
    <View style={[styles.hubBadge, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
      <Icon size={11} color={cfg.color} />
      <Text style={[styles.hubBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

function fmtLastLogin(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const HUB_RANK: Record<HubStatus, number> = { 'Active': 0, 'Invited': 1, 'Disabled': 2, 'No Access': 3 };

type SortDir = 'asc' | 'desc';

// ── Desktop row ──
function PersonRow({ person, onPress, isSelected, onToggleSelect }: {
  person: Person; onPress: () => void; isSelected: boolean; onToggleSelect: () => void;
}) {
  const name = `${person.firstName} ${person.lastName}`.trim() || 'Unnamed';
  const last = fmtLastLogin(person.lastLoginAt);
  return (
    <TouchableOpacity style={[styles.tableRow, isSelected && styles.tableRowSelected]} onPress={onPress} activeOpacity={0.7}>
      <TouchableOpacity style={styles.colCheckbox} onPress={(e) => { e.stopPropagation?.(); onToggleSelect(); }} activeOpacity={0.7}>
        <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
          {isSelected && <Check size={11} color="#fff" />}
        </View>
      </TouchableOpacity>
      <View style={{ width: 44 }}>
        <OrgAvatar name={name} size={32} shape="circle" />
      </View>
      <View style={COL_FLEX.name != null ? { flex: COL_FLEX.name } : { width: COL_WIDTHS.name }}>
        <Text style={styles.cellName} numberOfLines={1}>{name}</Text>
      </View>
      <View style={COL_FLEX.org != null ? { flex: COL_FLEX.org } : { width: COL_WIDTHS.org }}>
        <Text style={styles.cell} numberOfLines={1}>{person.orgName}</Text>
      </View>
      <View style={{ width: COL_WIDTHS.role }}>
        {person.role ? <Text style={styles.cell} numberOfLines={1}>{person.role}</Text> : <Text style={styles.dim}>—</Text>}
      </View>
      <View style={COL_FLEX.email != null ? { flex: COL_FLEX.email } : { width: COL_WIDTHS.email }}>
        {person.email ? <Text style={styles.cell} numberOfLines={1}>{person.email}</Text> : <Text style={styles.dim}>—</Text>}
      </View>
      <View style={{ width: COL_WIDTHS.phone }}>
        {person.phone ? <Text style={styles.cell} numberOfLines={1}>{formatPhone(person.phone)}</Text> : <Text style={styles.dim}>—</Text>}
      </View>
      <View style={{ width: COL_WIDTHS.hub }}>
        <HubBadge status={person.hubStatus || 'No Access'} />
      </View>
      <View style={{ width: COL_WIDTHS.lastLogin }}>
        {last ? <Text style={styles.cell} numberOfLines={1}>{last}</Text> : <Text style={styles.dim}>—</Text>}
      </View>
      <View style={{ width: COL_WIDTHS.status }}>
        <View style={[styles.statusPill, person.status === 'inactive' ? styles.statusInactive : styles.statusActive]}>
          <Text style={[styles.statusPillText, person.status === 'inactive' ? { color: '#6B7280' } : { color: '#15803D' }]}>
            {person.status === 'inactive' ? 'Inactive' : 'Active'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function ContactsDirectory() {
  const router = useRouter();
  const { orgs, deleteContact } = useCrm();
  const { isDesktop } = useBreakpoint();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);
  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<Tab>('All');
  const [orgFilter, setOrgFilter] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [orgDropOpen, setOrgDropOpen] = useState(false);
  const [roleDropOpen, setRoleDropOpen] = useState(false);
  const [sortField, setSortField] = useState<ColId>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const people = useMemo<Person[]>(() =>
    orgs.flatMap((o) =>
      o.contacts.map((c) => ({ ...c, orgId: o.id, orgName: o.name, orgLogo: o.logoUrl }))
    ), [orgs]);

  const isPortal = (p: Person) => !!p.hubStatus && p.hubStatus !== 'No Access';

  const roles = useMemo(() => {
    const set = new Set<string>();
    people.forEach((p) => { if (p.role) set.add(p.role); });
    return Array.from(set).sort();
  }, [people]);

  const stats = useMemo(() => ({
    total: people.length,
    portal: people.filter(isPortal).length,
    invited: people.filter((p) => p.hubStatus === 'Invited').length,
    orgs: new Set(people.map((p) => p.orgId)).size,
  }), [people]);

  const counts = useMemo(() => ({
    'All': people.length,
    'Portal Users': people.filter(isPortal).length,
    'Non-Portal': people.filter((p) => !isPortal(p)).length,
    'Active': people.filter((p) => p.status !== 'inactive').length,
    'Inactive': people.filter((p) => p.status === 'inactive').length,
  }), [people]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const list = people.filter((p) => {
      if (tab === 'Portal Users' && !isPortal(p)) return false;
      if (tab === 'Non-Portal' && isPortal(p)) return false;
      if (tab === 'Active' && p.status === 'inactive') return false;
      if (tab === 'Inactive' && p.status !== 'inactive') return false;
      if (orgFilter && p.orgId !== orgFilter) return false;
      if (roleFilter && p.role !== roleFilter) return false;
      if (q) {
        const hit =
          `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
          p.orgName.toLowerCase().includes(q) ||
          (p.email || '').toLowerCase().includes(q) ||
          (p.phone || '').toLowerCase().includes(q) ||
          (p.role || '').toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
    const dir = sortDir === 'asc' ? 1 : -1;
    const nameKey = (p: Person) => `${p.lastName}${p.firstName}`.toLowerCase().trim();
    return list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name': cmp = nameKey(a).localeCompare(nameKey(b)); break;
        case 'org': cmp = a.orgName.toLowerCase().localeCompare(b.orgName.toLowerCase()); break;
        case 'role': cmp = (a.role || '').toLowerCase().localeCompare((b.role || '').toLowerCase()); break;
        case 'email': cmp = (a.email || '').toLowerCase().localeCompare((b.email || '').toLowerCase()); break;
        case 'phone': cmp = (a.phone || '').localeCompare(b.phone || ''); break;
        case 'hub': cmp = HUB_RANK[a.hubStatus || 'No Access'] - HUB_RANK[b.hubStatus || 'No Access']; break;
        case 'lastLogin': {
          const ta = a.lastLoginAt ? new Date(a.lastLoginAt).getTime() : 0;
          const tb = b.lastLoginAt ? new Date(b.lastLoginAt).getTime() : 0;
          cmp = ta - tb;
          break;
        }
        case 'status': {
          const sa = a.status === 'inactive' ? 1 : 0;
          const sb = b.status === 'inactive' ? 1 : 0;
          cmp = sa - sb;
          break;
        }
      }
      if (cmp === 0) cmp = nameKey(a).localeCompare(nameKey(b));
      return cmp * dir;
    });
  }, [people, tab, search, orgFilter, roleFilter, sortField, sortDir]);

  // Selection UI is driven by the intersection with the currently visible rows,
  // so filter/search/tab changes never leave a stale checked/indeterminate header.
  const visibleSelectedCount = useMemo(
    () => filtered.reduce((n, p) => (selectedIds.has(p.id) ? n + 1 : n), 0),
    [filtered, selectedIds],
  );
  const selectionMode = visibleSelectedCount > 0;
  const allSelected = filtered.length > 0 && visibleSelectedCount === filtered.length;

  const toggleSelectAll = useCallback(() => {
    if (allSelected) clearSelection();
    else setSelectedIds(new Set(filtered.map((p) => p.id)));
  }, [filtered, allSelected, clearSelection]);

  const goToPerson = useCallback((p: Person) => router.push(`/crm/${p.orgId}` as any), [router]);

  const orgName = orgFilter ? orgs.find((o) => o.id === orgFilter)?.name : null;

  const toggleSort = useCallback((field: ColId) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('asc'); }
  }, [sortField]);

  const SortBtn = ({ field, label }: { field: ColId; label: string }) => (
    <TouchableOpacity style={styles.sortBtn} onPress={() => toggleSort(field)} activeOpacity={0.7}>
      <Text style={[styles.headText, sortField === field && styles.headTextActive]} numberOfLines={1}>{label}</Text>
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
      <View style={{ width: 44 }} />
      <View style={COL_FLEX.name != null ? { flex: COL_FLEX.name } : { width: COL_WIDTHS.name }}><SortBtn field="name" label="Name" /></View>
      <View style={COL_FLEX.org != null ? { flex: COL_FLEX.org } : { width: COL_WIDTHS.org }}><SortBtn field="org" label="Organization" /></View>
      <View style={{ width: COL_WIDTHS.role }}><SortBtn field="role" label="Title / Role" /></View>
      <View style={COL_FLEX.email != null ? { flex: COL_FLEX.email } : { width: COL_WIDTHS.email }}><SortBtn field="email" label="Email" /></View>
      <View style={{ width: COL_WIDTHS.phone }}><SortBtn field="phone" label="Phone" /></View>
      <View style={{ width: COL_WIDTHS.hub }}><SortBtn field="hub" label="Hub Status" /></View>
      <View style={{ width: COL_WIDTHS.lastLogin }}><SortBtn field="lastLogin" label="Last Login" /></View>
      <View style={{ width: COL_WIDTHS.status }}><SortBtn field="status" label="Status" /></View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.pageHeader}>
        <View style={styles.headerTop}>
          <Text style={styles.pageTitle}>Contacts</Text>
        </View>

        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: Colors.light.tint }]}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total Contacts</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#16A34A' }]}>{stats.portal}</Text>
            <Text style={styles.statLabel}>Portal Users</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#4338CA' }]}>{stats.invited}</Text>
            <Text style={styles.statLabel}>Invited</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#2563EB' }]}>{stats.orgs}</Text>
            <Text style={styles.statLabel}>Organizations</Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillsScroll} contentContainerStyle={styles.pillsRow}>
          {TABS.map((t) => {
            const active = tab === t;
            return (
              <TouchableOpacity key={t} style={[styles.pill, active && styles.pillActive]} onPress={() => setTab(t)}>
                {t === 'All' && <Users size={12} color={active ? Colors.light.tint : Colors.light.textSecondary} />}
                {t === 'Portal Users' && <Wifi size={12} color={active ? Colors.light.tint : Colors.light.textSecondary} />}
                <Text style={[styles.pillText, active && styles.pillTextActive]}>{t}</Text>
                <View style={[styles.pillCount, active && styles.pillCountActive]}>
                  <Text style={[styles.pillCountText, active && styles.pillCountTextActive]}>{counts[t]}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Search size={15} color={Colors.light.textSecondary} />
            <TextInput style={styles.searchInput} placeholder="Search name, organization, email…" placeholderTextColor={Colors.light.textSecondary} value={search} onChangeText={setSearch} />
            {search ? <TouchableOpacity onPress={() => setSearch('')}><X size={15} color={Colors.light.textSecondary} /></TouchableOpacity> : null}
          </View>
          {isDesktop && (<>
            <TouchableOpacity style={[styles.toolBtn, !!orgFilter && styles.toolBtnActive]} onPress={() => { setOrgDropOpen((v) => !v); setRoleDropOpen(false); }}>
              <Building2 size={14} color={orgFilter ? Colors.light.tint : Colors.light.textSecondary} />
              <Text style={[styles.toolBtnText, !!orgFilter && styles.toolBtnTextActive]} numberOfLines={1}>{orgName || 'Organization'}</Text>
              <ChevronDown size={13} color={Colors.light.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.toolBtn, !!roleFilter && styles.toolBtnActive]} onPress={() => { setRoleDropOpen((v) => !v); setOrgDropOpen(false); }}>
              <Text style={[styles.toolBtnText, !!roleFilter && styles.toolBtnTextActive]} numberOfLines={1}>{roleFilter || 'Role'}</Text>
              <ChevronDown size={13} color={Colors.light.textSecondary} />
            </TouchableOpacity>
          </>)}
        </View>
      </View>

      {/* Org filter dropdown */}
      <Modal visible={orgDropOpen} transparent animationType="fade" onRequestClose={() => setOrgDropOpen(false)}>
        <Pressable style={styles.dropOverlay} onPress={() => setOrgDropOpen(false)}>
          <Pressable style={styles.dropCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter by Organization</Text>
              <TouchableOpacity onPress={() => setOrgDropOpen(false)}><X size={20} color={Colors.light.textSecondary} /></TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 360 }}>
              <TouchableOpacity style={styles.dropRow} onPress={() => { setOrgFilter(''); setOrgDropOpen(false); }}>
                <Text style={[styles.dropRowText, !orgFilter && styles.dropRowTextOn]}>All Organizations</Text>
                {!orgFilter && <Check size={15} color={Colors.light.tint} />}
              </TouchableOpacity>
              {orgs.slice().sort((a, b) => a.name.localeCompare(b.name)).map((o) => (
                <TouchableOpacity key={o.id} style={styles.dropRow} onPress={() => { setOrgFilter(o.id); setOrgDropOpen(false); }}>
                  <Text style={[styles.dropRowText, orgFilter === o.id && styles.dropRowTextOn]} numberOfLines={1}>{o.name}</Text>
                  {orgFilter === o.id && <Check size={15} color={Colors.light.tint} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Role filter dropdown */}
      <Modal visible={roleDropOpen} transparent animationType="fade" onRequestClose={() => setRoleDropOpen(false)}>
        <Pressable style={styles.dropOverlay} onPress={() => setRoleDropOpen(false)}>
          <Pressable style={styles.dropCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter by Role</Text>
              <TouchableOpacity onPress={() => setRoleDropOpen(false)}><X size={20} color={Colors.light.textSecondary} /></TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 360 }}>
              <TouchableOpacity style={styles.dropRow} onPress={() => { setRoleFilter(''); setRoleDropOpen(false); }}>
                <Text style={[styles.dropRowText, !roleFilter && styles.dropRowTextOn]}>All Roles</Text>
                {!roleFilter && <Check size={15} color={Colors.light.tint} />}
              </TouchableOpacity>
              {roles.length === 0 ? (
                <Text style={styles.dropEmpty}>No roles assigned yet.</Text>
              ) : roles.map((r) => (
                <TouchableOpacity key={r} style={styles.dropRow} onPress={() => { setRoleFilter(r); setRoleDropOpen(false); }}>
                  <Text style={[styles.dropRowText, roleFilter === r && styles.dropRowTextOn]} numberOfLines={1}>{r}</Text>
                  {roleFilter === r && <Check size={15} color={Colors.light.tint} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

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
              style={[styles.bulkAction, styles.bulkActionDanger]}
              onPress={() => {
                const toDelete = filtered.filter((p) => selectedIds.has(p.id));
                if (Platform.OS !== 'web' || window.confirm(`Delete ${toDelete.length} contact(s)? This cannot be undone.`)) {
                  toDelete.forEach((p) => deleteContact({ orgId: p.orgId, contactId: p.id }));
                  clearSelection();
                }
              }}
            >
              <Trash2 size={12} color="#ef4444" />
              <Text style={[styles.bulkActionText, { color: '#ef4444' }]}>Delete Selected</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Users size={40} color={Colors.light.border} />
          <Text style={styles.emptyTitle}>{search || orgFilter || roleFilter ? 'No matching contacts' : 'No contacts yet'}</Text>
          <Text style={styles.emptyText}>{search || orgFilter || roleFilter ? 'Try adjusting your filters or search.' : 'Add contacts from an organization to see them here.'}</Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ flexGrow: 1 }}>
            <View style={{ minWidth: 1156, flexGrow: 1 }}>
              {tableHeader}
              <View style={styles.tableBody}>
                {filtered.map((p, idx) => (
                  <View key={p.id}>
                    <PersonRow
                      person={p}
                      onPress={() => goToPerson(p)}
                      isSelected={selectedIds.has(p.id)}
                      onToggleSelect={() => toggleSelect(p.id)}
                    />
                    {idx < filtered.length - 1 && <View style={styles.divider} />}
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
  pageHeader: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: Colors.light.border },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: DS.spacing.xl, paddingTop: DS.spacing.xl, paddingBottom: DS.spacing.md },
  pageTitle: { fontSize: 24, fontWeight: '800' as const, color: Colors.light.text },

  statsBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: DS.spacing.lg, marginBottom: DS.spacing.md, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: '#FAFAFA', borderRadius: DS.radius.md, borderWidth: 1, borderColor: Colors.light.border },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { ...metricValueStyle },
  statLabel: { ...metricLabelStyle, marginTop: 2 },
  statDivider: { width: 1, height: 28, backgroundColor: Colors.light.border },

  pillsScroll: { maxHeight: 44 },
  pillsRow: { flexDirection: 'row', gap: DS.spacing.sm, paddingHorizontal: DS.spacing.xl, paddingBottom: DS.spacing.md },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: Colors.light.border, backgroundColor: '#fff' },
  pillActive: { backgroundColor: '#FFF4EE', borderColor: Colors.light.tint },
  pillText: { fontSize: 13, fontWeight: '600' as const, color: Colors.light.textSecondary },
  pillTextActive: { color: Colors.light.tint },
  pillCount: { minWidth: 20, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999, backgroundColor: '#F1F1F1', alignItems: 'center' },
  pillCountActive: { backgroundColor: Colors.light.tint },
  pillCountText: { fontSize: 11, fontWeight: '700' as const, color: Colors.light.textSecondary },
  pillCountTextActive: { color: '#fff' },

  searchRow: { flexDirection: 'row', alignItems: 'center', gap: DS.spacing.sm, paddingHorizontal: DS.spacing.xl, paddingBottom: DS.spacing.md },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, height: 40, backgroundColor: '#F5F5F5', borderRadius: DS.radius.md, borderWidth: 1, borderColor: Colors.light.border },
  searchInput: { flex: 1, fontSize: 14, color: Colors.light.text, outlineStyle: 'none' as any },
  toolBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 40, maxWidth: 200, borderRadius: DS.radius.md, borderWidth: 1, borderColor: Colors.light.border, backgroundColor: '#fff' },
  toolBtnActive: { borderColor: Colors.light.tint, backgroundColor: '#FFF4EE' },
  toolBtnText: { fontSize: 13, fontWeight: '600' as const, color: Colors.light.textSecondary, maxWidth: 130 },
  toolBtnTextActive: { color: Colors.light.tint },

  tableHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 20, backgroundColor: '#000000' },
  headText: { fontSize: 11, fontWeight: '700' as const, color: '#ffffff', textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  headTextActive: { color: Colors.light.tint },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tableBody: { backgroundColor: '#fff' },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 20 },
  tableRowSelected: { backgroundColor: '#FFF9F6' },
  divider: { height: 1, backgroundColor: Colors.light.border, marginHorizontal: 20 },

  colCheckbox: { width: CHECKBOX_W, justifyContent: 'center' as const, alignItems: 'center' as const },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: Colors.light.border, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: Colors.light.surface },
  checkboxChecked: { backgroundColor: Colors.light.tint, borderColor: Colors.light.tint },
  checkboxIndeterminate: { backgroundColor: Colors.light.tint, borderColor: Colors.light.tint },

  bulkBar: { flexDirection: 'row' as const, alignItems: 'center' as const, backgroundColor: '#1C1C1E', paddingVertical: 8, paddingHorizontal: 20, gap: 12, borderBottomWidth: 1, borderBottomColor: '#333' },
  bulkBarLeft: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, minWidth: 100 },
  bulkCount: { fontSize: 13, fontWeight: '700' as const, color: '#fff' },
  bulkClearBtn: { width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center' as const, justifyContent: 'center' as const },
  bulkActionsRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4 },
  bulkAction: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.1)' },
  bulkActionDanger: { backgroundColor: 'rgba(239,68,68,0.15)' },
  bulkActionText: { fontSize: 12, fontWeight: '600' as const, color: 'rgba(255,255,255,0.9)' },
  cell: { fontSize: 13, color: Colors.light.text },
  cellName: { fontSize: 13, fontWeight: '700' as const, color: Colors.light.text },
  dim: { fontSize: 13, color: Colors.light.textSecondary },

  hubBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
  hubBadgeText: { fontSize: 11, fontWeight: '700' as const },

  statusPill: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusActive: { backgroundColor: '#DCFCE7' },
  statusInactive: { backgroundColor: '#F3F4F6' },
  statusPillText: { fontSize: 11, fontWeight: '700' as const },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '700' as const, color: Colors.light.text },
  emptyText: { fontSize: 13, color: Colors.light.textSecondary, textAlign: 'center' as const },

  dropOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  dropCard: { width: '100%', maxWidth: 420, backgroundColor: '#fff', borderRadius: DS.radius.lg, padding: 16 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  modalTitle: { fontSize: 16, fontWeight: '700' as const, color: Colors.light.text },
  dropRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: '#F1F1F1' },
  dropRowText: { fontSize: 14, color: Colors.light.text, flex: 1 },
  dropRowTextOn: { fontWeight: '700' as const, color: Colors.light.tint },
  dropEmpty: { fontSize: 13, color: Colors.light.textSecondary, padding: 12, textAlign: 'center' as const },
});
