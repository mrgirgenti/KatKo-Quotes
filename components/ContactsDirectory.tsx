import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Modal, Pressable, Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { OrgAvatar } from '@/components/OrgAvatar';
import OverlayMenu from '@/components/OverlayMenu';
import {
  Search, X, Users, ChevronDown, Check,
  Wifi, ShieldCheck, Mail, Ban, MinusCircle, ArrowUpDown, Trash2,
  Plus, FileText, Upload, Edit3, Settings2, SlidersHorizontal,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { DS } from '@/constants/designSystem';
import { metricValueStyle, metricLabelStyle } from '@/components/Metric';
import { useCrm } from '@/contexts/CrmContext';
import { Contact, CrmStatus, CRM_STATUS_CONFIG, ORG_TYPES } from '@/types/crm';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { formatPhone, formatPhoneInput } from '@/utils/phone';

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
const COL_FLEX: Partial<Record<ColId, number>> = { name: 2, org: 1.8, email: 1.6 };

const CONTACT_TOGGLEABLE_COLS: { id: ColId; label: string }[] = [
  { id: 'name', label: 'Contact Name' },
  { id: 'org', label: 'Organization' },
  { id: 'role', label: 'Title / Role' },
  { id: 'email', label: 'Email Address' },
  { id: 'phone', label: 'Phone Number' },
  { id: 'status', label: 'Status' },
  { id: 'hub', label: 'Hub Status' },
  { id: 'lastLogin', label: 'Last Login' },
];
const DEFAULT_VISIBLE_COLS: ColId[] = ['name', 'org', 'role', 'email', 'phone', 'status', 'hub', 'lastLogin'];

type ContactFilterState = {
  name: string; phone: string; email: string;
  status: ('active' | 'inactive')[]; hub: HubStatus[];
};
const EMPTY_CONTACT_FILTERS: ContactFilterState = { name: '', phone: '', email: '', status: [], hub: [] };

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

function colStyle(id: ColId): any {
  return COL_FLEX[id] != null
    ? { flex: COL_FLEX[id], minWidth: COL_WIDTHS[id] }
    : { width: COL_WIDTHS[id] };
}

// ── Desktop row ──
function PersonRow({ person, onPress, isSelected, onToggleSelect, visibleCols }: {
  person: Person; onPress: () => void; isSelected: boolean; onToggleSelect: () => void; visibleCols: ColId[];
}) {
  const router = useRouter();
  const { deleteContact } = useCrm();
  const name = `${person.firstName} ${person.lastName}`.trim() || 'Unnamed';
  const last = fmtLastLogin(person.lastLoginAt);

  const col = (id: ColId, content: React.ReactNode) => {
    if (!visibleCols.includes(id)) return null;
    return <View style={colStyle(id)}>{content}</View>;
  };

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
      {col('name', <Text style={styles.cellName}>{name}</Text>)}
      {col('org', <Text style={styles.cell}>{person.orgName}</Text>)}
      {col('role', person.role ? <Text style={styles.cell}>{person.role}</Text> : <Text style={styles.dim}>—</Text>)}
      {col('email', person.email ? <Text style={styles.cell}>{person.email}</Text> : <Text style={styles.dim}>—</Text>)}
      {col('phone', person.phone ? <Text style={styles.cell}>{formatPhone(person.phone)}</Text> : <Text style={styles.dim}>—</Text>)}
      {col('status',
        <View style={[styles.statusPill, person.status === 'inactive' ? styles.statusInactive : styles.statusActive]}>
          <Text style={[styles.statusPillText, person.status === 'inactive' ? { color: '#6B7280' } : { color: '#15803D' }]}>
            {person.status === 'inactive' ? 'Inactive' : 'Active'}
          </Text>
        </View>
      )}
      {col('hub', <HubBadge status={person.hubStatus || 'No Access'} />)}
      {col('lastLogin', last ? <Text style={styles.cell}>{last}</Text> : <Text style={styles.dim}>—</Text>)}
      <View style={{ width: 120, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 4 }}>
        <TouchableOpacity
          style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: Colors.light.tint, height: 30, justifyContent: 'center', alignItems: 'center' }}
          onPress={onPress}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>View</Text>
        </TouchableOpacity>
        <OverlayMenu align="right" menuWidth={180}
          trigger={({ open }) => (
            <TouchableOpacity
              style={{ width: 30, height: 30, borderRadius: 6, borderWidth: 1, borderColor: Colors.light.border, backgroundColor: Colors.light.surface, alignItems: 'center', justifyContent: 'center' }}
              onPress={(e) => { e.stopPropagation?.(); open(); }}
              activeOpacity={0.7}
            >
              <ChevronDown size={14} color={Colors.light.textSecondary} />
            </TouchableOpacity>
          )}
        >
          {({ close }) => (
            <>
              <TouchableOpacity style={styles.actionsMenuItem} onPress={() => { close(); router.push(`/crm/${person.orgId}` as any); }}>
                <Edit3 size={14} color={Colors.light.text} />
                <Text style={styles.actionsMenuItemText}>Edit Contact</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionsMenuItem} onPress={() => { close(); router.push('/quote/edit' as any); }}>
                <FileText size={14} color={Colors.light.text} />
                <Text style={styles.actionsMenuItemText}>New Quote</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionsMenuItem} onPress={() => { close(); router.push(`/crm/${person.orgId}` as any); }}>
                <Users size={14} color={Colors.light.text} />
                <Text style={styles.actionsMenuItemText}>View Profile</Text>
              </TouchableOpacity>
              <View style={styles.rowMenuDivider} />
              <TouchableOpacity style={[styles.actionsMenuItem, { borderBottomWidth: 0 }]} onPress={() => {
                close();
                if (typeof window === 'undefined' || window.confirm(`Delete ${name}? This cannot be undone.`)) {
                  deleteContact({ orgId: person.orgId, contactId: person.id });
                }
              }}>
                <Trash2 size={14} color={Colors.light.error} />
                <Text style={[styles.actionsMenuItemText, { color: Colors.light.error }]}>Delete Contact</Text>
              </TouchableOpacity>
            </>
          )}
        </OverlayMenu>
      </View>
    </TouchableOpacity>
  );
}

const EMPTY_CONTACT_FORM = { firstName: '', lastName: '', phone: '', email: '', role: '' };
const EMPTY_NEW_ORG_FORM = { name: '', type: '', status: 'Active Client' as CrmStatus };

export default function ContactsDirectory() {
  const router = useRouter();
  const { orgs, addOrg, addOrgWithContact, addContact, deleteContact } = useCrm();
  const { isDesktop } = useBreakpoint();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);
  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<Tab>('All');
  const [sortField, setSortField] = useState<ColId>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const [visibleCols, setVisibleCols] = useState<ColId[]>(DEFAULT_VISIBLE_COLS);
  const [showColPicker, setShowColPicker] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [colFilters, setColFilters] = useState<ContactFilterState>(EMPTY_CONTACT_FILTERS);

  const [contactModalVisible, setContactModalVisible] = useState(false);
  const [contactForm, setContactForm] = useState(EMPTY_CONTACT_FORM);
  const [orgSearch, setOrgSearch] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [showOrgDrop, setShowOrgDrop] = useState(false);
  const [createNewOrg, setCreateNewOrg] = useState(false);
  const [newOrgForm, setNewOrgForm] = useState(EMPTY_NEW_ORG_FORM);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);

  const openContactModal = useCallback(() => {
    setContactForm(EMPTY_CONTACT_FORM);
    setOrgSearch(''); setSelectedOrgId(null);
    setShowOrgDrop(false); setCreateNewOrg(false);
    setNewOrgForm(EMPTY_NEW_ORG_FORM); setShowTypeDropdown(false);
    setContactModalVisible(true);
  }, []);

  const orgSearchResults = useMemo(() => {
    if (!orgSearch.trim()) return orgs.slice(0, 6);
    return orgs.filter((o) => o.name.toLowerCase().includes(orgSearch.toLowerCase())).slice(0, 6);
  }, [orgs, orgSearch]);

  const selectedOrg = selectedOrgId ? orgs.find((o) => o.id === selectedOrgId) : null;

  const canSaveContact = !!(contactForm.firstName.trim() || contactForm.lastName.trim());

  const handleSaveContact = useCallback(() => {
    if (!canSaveContact) return;
    const contactData: any = {
      firstName: contactForm.firstName.trim(),
      lastName: contactForm.lastName.trim(),
      phone: contactForm.phone.trim() || undefined,
      email: contactForm.email.trim() || undefined,
      role: contactForm.role.trim() || undefined,
      isPrimary: true,
    };
    if (selectedOrgId) {
      addContact({ orgId: selectedOrgId, contact: contactData });
    } else if (createNewOrg && newOrgForm.name.trim()) {
      addOrgWithContact({
        orgData: { name: newOrgForm.name.trim(), type: newOrgForm.type || undefined, status: newOrgForm.status } as any,
        contactData,
      });
    } else {
      const fallbackOrgName = orgSearch.trim() || `${contactForm.firstName} ${contactForm.lastName}`.trim();
      addOrgWithContact({ orgData: { name: fallbackOrgName, status: 'Active Client' } as any, contactData });
    }
    setContactModalVisible(false);
  }, [canSaveContact, contactForm, selectedOrgId, createNewOrg, newOrgForm, orgSearch, addContact, addOrgWithContact]);

  const saveBtnLabel = selectedOrgId ? 'Save Contact' : createNewOrg ? 'Save Contact + Organization' : 'Save Contact';

  const people = useMemo<Person[]>(() =>
    orgs.flatMap((o) =>
      o.contacts.map((c) => ({ ...c, orgId: o.id, orgName: o.name, orgLogo: o.logoUrl }))
    ), [orgs]);

  const isPortal = (p: Person) => !!p.hubStatus && p.hubStatus !== 'No Access';

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

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (colFilters.name) n++;
    if (colFilters.phone) n++;
    if (colFilters.email) n++;
    if (colFilters.status.length) n++;
    if (colFilters.hub.length) n++;
    return n;
  }, [colFilters]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const list = people.filter((p) => {
      if (tab === 'Portal Users' && !isPortal(p)) return false;
      if (tab === 'Non-Portal' && isPortal(p)) return false;
      if (tab === 'Active' && p.status === 'inactive') return false;
      if (tab === 'Inactive' && p.status !== 'inactive') return false;
      if (q) {
        const hit =
          `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
          p.orgName.toLowerCase().includes(q) ||
          (p.email || '').toLowerCase().includes(q) ||
          (p.phone || '').toLowerCase().includes(q) ||
          (p.role || '').toLowerCase().includes(q);
        if (!hit) return false;
      }
      const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
      if (colFilters.name && !fullName.includes(colFilters.name.toLowerCase())) return false;
      if (colFilters.phone && !(p.phone || '').includes(colFilters.phone)) return false;
      if (colFilters.email && !(p.email || '').toLowerCase().includes(colFilters.email.toLowerCase())) return false;
      if (colFilters.status.length) {
        const s = p.status === 'inactive' ? 'inactive' : 'active';
        if (!colFilters.status.includes(s as any)) return false;
      }
      if (colFilters.hub.length) {
        const h = p.hubStatus || 'No Access';
        if (!colFilters.hub.includes(h)) return false;
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
  }, [people, tab, search, colFilters, sortField, sortDir]);

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

  const toggleSort = useCallback((field: ColId) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('asc'); }
  }, [sortField]);

  const toggleCol = useCallback((id: ColId) => {
    setVisibleCols((prev) => prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]);
  }, []);

  const clearFilters = useCallback(() => setColFilters(EMPTY_CONTACT_FILTERS), []);

  const toggleStatusFilter = (s: 'active' | 'inactive') =>
    setColFilters((f) => ({ ...f, status: f.status.includes(s) ? f.status.filter((x) => x !== s) : [...f.status, s] }));

  const toggleHubFilter = (h: HubStatus) =>
    setColFilters((f) => ({ ...f, hub: f.hub.includes(h) ? f.hub.filter((x) => x !== h) : [...f.hub, h] }));

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
      {CONTACT_TOGGLEABLE_COLS.filter((c) => visibleCols.includes(c.id)).map((c) => (
        <View key={c.id} style={colStyle(c.id)}>
          {c.id === 'name' && <SortBtn field="name" label="Name" />}
          {c.id === 'org' && <SortBtn field="org" label="Organization" />}
          {c.id === 'role' && <SortBtn field="role" label="Title / Role" />}
          {c.id === 'email' && <SortBtn field="email" label="Email" />}
          {c.id === 'phone' && <SortBtn field="phone" label="Phone" />}
          {c.id === 'status' && <SortBtn field="status" label="Status" />}
          {c.id === 'hub' && <SortBtn field="hub" label="Hub Status" />}
          {c.id === 'lastLogin' && <SortBtn field="lastLogin" label="Last Login" />}
        </View>
      ))}
      <View style={{ width: 120 }}><Text style={styles.headText}>Actions</Text></View>
    </View>
  );

  const hasActiveFilters = activeFilterCount > 0;

  return (
    <View style={styles.container}>
      <View style={styles.pageHeader}>
        <View style={styles.headerTop}>
          <Text style={styles.pageTitle}>Contacts</Text>
          <View style={styles.headerBtns}>
            <OverlayMenu
              align="right"
              menuWidth={185}
              trigger={({ open }) => (
                <TouchableOpacity style={styles.actionsBtn} onPress={open}>
                  <Text style={styles.actionsBtnText}>Actions</Text>
                  <ChevronDown size={14} color={Colors.light.textSecondary} />
                </TouchableOpacity>
              )}
            >
              {({ close }) => (
                <>
                  <TouchableOpacity style={styles.actionsMenuItem} onPress={close}>
                    <Upload size={14} color={Colors.light.text} />
                    <Text style={styles.actionsMenuItemText}>Import Contacts</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionsMenuItem, { borderBottomWidth: 0 }]} onPress={close}>
                    <FileText size={14} color={Colors.light.text} />
                    <Text style={styles.actionsMenuItemText}>Export CSV</Text>
                  </TouchableOpacity>
                </>
              )}
            </OverlayMenu>
            <TouchableOpacity style={styles.addBtn} onPress={openContactModal}>
              <Plus size={15} color="#fff" />
              <Text style={styles.addBtnText}>Add Contact</Text>
            </TouchableOpacity>
          </View>
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
            <TouchableOpacity style={[styles.toolBtn, showFilters && styles.toolBtnActive]} onPress={() => setShowFilters((v) => !v)}>
              <SlidersHorizontal size={14} color={showFilters ? Colors.light.tint : Colors.light.textSecondary} />
              <Text style={[styles.toolBtnText, showFilters && styles.toolBtnTextActive]}>Filters</Text>
              {activeFilterCount > 0 && <View style={styles.toolBadge}><Text style={styles.toolBadgeText}>{activeFilterCount}</Text></View>}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.toolBtn, showColPicker && styles.toolBtnActive]} onPress={() => setShowColPicker((v) => !v)}>
              <Settings2 size={14} color={showColPicker ? Colors.light.tint : Colors.light.textSecondary} />
              <Text style={[styles.toolBtnText, showColPicker && styles.toolBtnTextActive]}>Columns</Text>
            </TouchableOpacity>
          </>)}
        </View>
      </View>

      {/* ── Filter Panel ── */}
      {showFilters && isDesktop && (
        <View style={styles.filterPanel}>
          <View style={styles.filterRow}>
            {[
              { key: 'name', label: 'Contact Name', val: colFilters.name, set: (v: string) => setColFilters((f) => ({ ...f, name: v })) },
              { key: 'phone', label: 'Phone', val: colFilters.phone, set: (v: string) => setColFilters((f) => ({ ...f, phone: v })) },
              { key: 'email', label: 'Email', val: colFilters.email, set: (v: string) => setColFilters((f) => ({ ...f, email: v })) },
            ].map(({ key, label, val, set }) => (
              <View key={key} style={styles.filterGroup}>
                <Text style={styles.filterGroupLabel}>{label}</Text>
                <View style={styles.filterInputBox}>
                  <Search size={12} color={Colors.light.textSecondary} />
                  <TextInput style={styles.filterInput} value={val} onChangeText={set} placeholder="Search…" placeholderTextColor={Colors.light.textSecondary} />
                  {val ? <TouchableOpacity onPress={() => set('')}><X size={11} color={Colors.light.textSecondary} /></TouchableOpacity> : null}
                </View>
              </View>
            ))}
          </View>
          <View style={styles.filterRow}>
            <View style={styles.filterGroup}>
              <Text style={styles.filterGroupLabel}>Status</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {([['active', 'Active'], ['inactive', 'Inactive']] as const).map(([k, l]) => {
                  const on = colFilters.status.includes(k);
                  const activeStyle = k === 'active'
                    ? { backgroundColor: '#DCFCE7', borderColor: '#86EFAC' }
                    : { backgroundColor: '#F3F4F6', borderColor: '#D1D5DB' };
                  const activeTextStyle = k === 'active' ? { color: '#15803D' } : { color: '#374151' };
                  return (
                    <TouchableOpacity key={k} style={[styles.filterChip, on && activeStyle]} onPress={() => toggleStatusFilter(k)}>
                      <Text style={[styles.filterChipText, on && activeTextStyle]}>{l}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
            <View style={styles.filterGroup}>
              <Text style={styles.filterGroupLabel}>Hub Status</Text>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {(['Active', 'Invited', 'Disabled', 'No Access'] as HubStatus[]).map((h) => {
                  const on = colFilters.hub.includes(h);
                  const cfg = HUB_CFG[h];
                  return (
                    <TouchableOpacity key={h} style={[styles.filterChip, on && { backgroundColor: cfg.bg, borderColor: cfg.border }]} onPress={() => toggleHubFilter(h)}>
                      <Text style={[styles.filterChipText, on && { color: cfg.color }]}>{h}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
            {hasActiveFilters && (
              <TouchableOpacity style={styles.clearFiltersBtn} onPress={clearFilters}>
                <X size={12} color={Colors.light.error} /><Text style={styles.clearFiltersBtnText}>Clear all</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

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
          <Text style={styles.emptyTitle}>{search || hasActiveFilters ? 'No matching contacts' : 'No contacts yet'}</Text>
          <Text style={styles.emptyText}>{search || hasActiveFilters ? 'Try adjusting your filters or search.' : 'Add contacts using the button above.'}</Text>
          {!search && !hasActiveFilters && (
            <TouchableOpacity style={styles.addBtn} onPress={openContactModal}>
              <Plus size={15} color="#fff" /><Text style={styles.addBtnText}>Add Contact</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <ScrollView style={{ flex: 1, outlineStyle: 'none' } as any} showsVerticalScrollIndicator={false}>
          <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ flexGrow: 1 }} style={{ outlineStyle: 'none' } as any}>
            <View style={{ minWidth: 1360, flexGrow: 1 }}>
              {tableHeader}
              <View style={styles.tableBody}>
                {filtered.map((p, idx) => (
                  <View key={p.id}>
                    <PersonRow
                      person={p}
                      onPress={() => goToPerson(p)}
                      isSelected={selectedIds.has(p.id)}
                      onToggleSelect={() => toggleSelect(p.id)}
                      visibleCols={visibleCols}
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

      {/* ── Column Picker Modal ── */}
      <Modal visible={showColPicker} transparent animationType="fade" onRequestClose={() => setShowColPicker(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowColPicker(false)}>
          <Pressable style={styles.colPickerCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Customize Columns</Text>
              <TouchableOpacity onPress={() => setShowColPicker(false)}><X size={20} color={Colors.light.textSecondary} /></TouchableOpacity>
            </View>
            <Text style={styles.colPickerSub}>Toggle which columns appear. Actions is always shown.</Text>
            {CONTACT_TOGGLEABLE_COLS.map((c) => {
              const on = visibleCols.includes(c.id);
              return (
                <TouchableOpacity key={c.id} style={styles.colPickerRow} onPress={() => toggleCol(c.id)}>
                  <View style={[styles.colPickerCheck, on && styles.colPickerCheckOn]}>{on && <Check size={12} color="#fff" />}</View>
                  <Text style={[styles.colPickerLabel, on && styles.colPickerLabelOn]}>{c.label}</Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={styles.colPickerReset} onPress={() => setVisibleCols(DEFAULT_VISIBLE_COLS)}>
              <Text style={styles.colPickerResetText}>Reset to defaults</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Add Contact Modal ── */}
      <Modal visible={contactModalVisible} transparent animationType="fade" onRequestClose={() => setContactModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setContactModalVisible(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalKAV}>
            <Pressable style={styles.modalCard} onPress={() => { setShowOrgDrop(false); setShowTypeDropdown(false); }}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>New Contact Person</Text>
                <TouchableOpacity onPress={() => setContactModalVisible(false)}><X size={22} color={Colors.light.textSecondary} /></TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Text style={styles.fieldLabel}>Name *</Text>
                <View style={styles.rowInputs}>
                  <TextInput style={[styles.textInput, { flex: 1 }]} value={contactForm.firstName} onChangeText={(v) => setContactForm((f) => ({ ...f, firstName: v }))} placeholder="First name" placeholderTextColor={Colors.light.textSecondary} autoFocus />
                  <TextInput style={[styles.textInput, { flex: 1 }]} value={contactForm.lastName} onChangeText={(v) => setContactForm((f) => ({ ...f, lastName: v }))} placeholder="Last name" placeholderTextColor={Colors.light.textSecondary} />
                </View>

                <Text style={styles.fieldLabel}>Phone / Email</Text>
                <View style={styles.rowInputs}>
                  <TextInput style={[styles.textInput, { flex: 1 }]} value={contactForm.phone} onChangeText={(v) => setContactForm((f) => ({ ...f, phone: formatPhoneInput(v) }))} placeholder="(555) 000-0000" placeholderTextColor={Colors.light.textSecondary} keyboardType="phone-pad" />
                  <TextInput style={[styles.textInput, { flex: 1 }]} value={contactForm.email} onChangeText={(v) => setContactForm((f) => ({ ...f, email: v }))} placeholder="Email" placeholderTextColor={Colors.light.textSecondary} keyboardType="email-address" autoCapitalize="none" />
                </View>

                <Text style={styles.fieldLabel}>Role / Title</Text>
                <TextInput style={styles.textInput} value={contactForm.role} onChangeText={(v) => setContactForm((f) => ({ ...f, role: v }))} placeholder="e.g. Purchasing Manager, Coach…" placeholderTextColor={Colors.light.textSecondary} />

                <View style={styles.sectionDivider}>
                  <View style={styles.sectionDividerLine} /><Text style={styles.sectionDividerLabel}>Organization</Text><View style={styles.sectionDividerLine} />
                </View>

                {!createNewOrg && (
                  <>
                    <TouchableOpacity
                      style={[styles.typePickerBtn, selectedOrg && { borderColor: Colors.light.tint }]}
                      onPress={() => { setShowOrgDrop((v) => !v); setShowTypeDropdown(false); }}
                    >
                      <Text style={selectedOrg ? styles.typePickerBtnText : styles.typePickerBtnPlaceholder} numberOfLines={1}>
                        {selectedOrg ? selectedOrg.name : orgSearch || 'Search or type org name…'}
                      </Text>
                      {selectedOrg
                        ? <TouchableOpacity onPress={() => { setSelectedOrgId(null); setOrgSearch(''); }}><X size={15} color={Colors.light.textSecondary} /></TouchableOpacity>
                        : <ChevronDown size={15} color={Colors.light.textSecondary} />
                      }
                    </TouchableOpacity>

                    {showOrgDrop && !selectedOrg && (
                      <View style={styles.typeDropdown}>
                        <View style={styles.orgSearchRow}>
                          <Search size={13} color={Colors.light.textSecondary} />
                          <TextInput style={styles.orgSearchInput} value={orgSearch} onChangeText={setOrgSearch} placeholder="Search existing orgs…" placeholderTextColor={Colors.light.textSecondary} autoFocus />
                        </View>
                        {orgSearchResults.map((o) => (
                          <TouchableOpacity key={o.id} style={styles.typeDropdownItem} onPress={() => { setSelectedOrgId(o.id); setOrgSearch(o.name); setShowOrgDrop(false); }}>
                            <Text style={styles.typeDropdownText}>{o.name}</Text>
                            {o.type ? <Text style={{ fontSize: 11, color: Colors.light.textSecondary }}>{o.type}</Text> : null}
                          </TouchableOpacity>
                        ))}
                        <TouchableOpacity
                          style={[styles.typeDropdownItem, { backgroundColor: '#FFF4EE', borderBottomWidth: 0 }]}
                          onPress={() => { setCreateNewOrg(true); setShowOrgDrop(false); }}
                        >
                          <Plus size={13} color={Colors.light.tint} />
                          <Text style={{ fontSize: 14, color: Colors.light.tint, fontWeight: '600' as const }}>+ Create New Organization</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </>
                )}

                {createNewOrg && (
                  <View style={styles.inlineOrgBox}>
                    <View style={styles.inlineOrgHeader}>
                      <Text style={styles.inlineOrgTitle}>New Organization</Text>
                      <TouchableOpacity onPress={() => { setCreateNewOrg(false); setNewOrgForm(EMPTY_NEW_ORG_FORM); }}>
                        <X size={16} color={Colors.light.textSecondary} />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.fieldLabel}>Organization Name *</Text>
                    <TextInput style={styles.textInput} value={newOrgForm.name} onChangeText={(v) => setNewOrgForm((f) => ({ ...f, name: v }))} placeholder="Company, school, church…" placeholderTextColor={Colors.light.textSecondary} autoFocus />
                    <Text style={styles.fieldLabel}>Type</Text>
                    <TouchableOpacity style={styles.typePickerBtn} onPress={() => setShowTypeDropdown((v) => !v)}>
                      <Text style={newOrgForm.type ? styles.typePickerBtnText : styles.typePickerBtnPlaceholder}>{newOrgForm.type || 'Select type…'}</Text>
                      <ChevronDown size={15} color={Colors.light.textSecondary} />
                    </TouchableOpacity>
                    {showTypeDropdown && (
                      <View style={styles.typeDropdown}>
                        {(ORG_TYPES as readonly string[]).map((t) => (
                          <TouchableOpacity key={t} style={styles.typeDropdownItem} onPress={() => { setNewOrgForm((f) => ({ ...f, type: t })); setShowTypeDropdown(false); }}>
                            <Text style={[styles.typeDropdownText, newOrgForm.type === t && styles.typeDropdownTextActive]}>{t}</Text>
                            {newOrgForm.type === t && <Check size={13} color={Colors.light.tint} />}
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                    <Text style={styles.fieldLabel}>Status</Text>
                    <View style={styles.statusRow}>
                      {(['Cold', 'Working', 'Active Client'] as CrmStatus[]).map((s) => {
                        const cfg = CRM_STATUS_CONFIG[s]; const sel = newOrgForm.status === s;
                        return (
                          <TouchableOpacity key={s} style={[styles.statusOption, sel && { backgroundColor: cfg.bg, borderColor: cfg.border }]} onPress={() => setNewOrgForm((f) => ({ ...f, status: s }))}>
                            <Text style={[styles.statusOptionText, sel && { color: cfg.color, fontWeight: '700' as const }]}>{s}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

                {!createNewOrg && !selectedOrgId && (
                  <TouchableOpacity style={styles.createOrgLink} onPress={() => { setCreateNewOrg(true); setShowOrgDrop(false); }}>
                    <Plus size={13} color={Colors.light.tint} />
                    <Text style={styles.createOrgLinkText}>+ Create New Organization</Text>
                  </TouchableOpacity>
                )}

                <View style={{ height: 16 }} />
              </ScrollView>

              <TouchableOpacity style={[styles.saveBtn, !canSaveContact && styles.saveBtnDisabled]} onPress={handleSaveContact} disabled={!canSaveContact}>
                <Text style={styles.saveBtnText}>{saveBtnLabel}</Text>
              </TouchableOpacity>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
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
  toolBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, borderRadius: DS.radius.md, borderWidth: 1, borderColor: Colors.light.border, backgroundColor: Colors.light.surface, height: 40 },
  toolBtnActive: { borderColor: Colors.light.tint, backgroundColor: '#FFF4EE' },
  toolBtnText: { fontSize: 13, fontWeight: '600' as const, color: Colors.light.textSecondary },
  toolBtnTextActive: { color: Colors.light.tint },
  toolBadge: { backgroundColor: Colors.light.tint, borderRadius: 8, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 },
  toolBadgeText: { fontSize: 10, fontWeight: '700' as const, color: '#fff' },

  filterPanel: { backgroundColor: Colors.light.surface, borderBottomWidth: 1, borderBottomColor: Colors.light.border, paddingHorizontal: DS.spacing.xl, paddingVertical: DS.spacing.md, gap: 10 },
  filterRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' },
  filterGroup: { gap: 5 },
  filterGroupLabel: { fontSize: 11, fontWeight: '700' as const, color: Colors.light.textSecondary, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  filterInputBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.light.background, borderRadius: DS.radius.sm, borderWidth: 1, borderColor: Colors.light.border, paddingHorizontal: 10, paddingVertical: 8, minWidth: 150 },
  filterInput: { flex: 1, fontSize: 13, color: Colors.light.text, outlineStyle: 'none' as any },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: DS.radius.sm, borderWidth: 1.5, borderColor: Colors.light.border, backgroundColor: Colors.light.background },
  filterChipText: { fontSize: 12, fontWeight: '600' as const, color: Colors.light.textSecondary },
  clearFiltersBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: DS.radius.sm, borderWidth: 1, borderColor: Colors.light.error + '44', backgroundColor: '#FFF5F5' },
  clearFiltersBtnText: { fontSize: 12, fontWeight: '600' as const, color: Colors.light.error },

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

  headerBtns: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
  actionsBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, paddingHorizontal: 12, height: 40, borderRadius: DS.radius.md, borderWidth: 1, borderColor: Colors.light.border, backgroundColor: Colors.light.surface },
  actionsBtnText: { fontSize: 13, fontWeight: '600' as const, color: Colors.light.text },
  actionsMenuItem: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  actionsMenuItemText: { fontSize: 13, color: Colors.light.text, fontWeight: '500' as const },
  rowMenuDivider: { height: 1, backgroundColor: Colors.light.border, marginVertical: 2 },
  addBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, backgroundColor: Colors.light.tint, paddingHorizontal: 16, borderRadius: DS.radius.md, height: 40 },
  addBtnText: { fontSize: 14, fontWeight: '700' as const, color: '#fff' },

  colPickerCard: { backgroundColor: '#fff', borderRadius: DS.radius.lg, padding: 20, maxHeight: '80%' as any, width: '100%', maxWidth: 360, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 24, elevation: 12 },
  colPickerSub: { fontSize: 12, color: Colors.light.textSecondary, marginBottom: 12 },
  colPickerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.light.border },
  colPickerCheck: { width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: Colors.light.border, alignItems: 'center', justifyContent: 'center' },
  colPickerCheckOn: { backgroundColor: Colors.light.tint, borderColor: Colors.light.tint },
  colPickerLabel: { fontSize: 14, color: Colors.light.textSecondary },
  colPickerLabelOn: { color: Colors.light.text, fontWeight: '600' as const },
  colPickerReset: { marginTop: 12, alignItems: 'center' },
  colPickerResetText: { fontSize: 13, color: Colors.light.tint, fontWeight: '600' as const },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalKAV: { width: '100%', maxWidth: 520, alignSelf: 'center' as const },
  modalCard: { backgroundColor: '#fff', borderRadius: DS.radius.lg, padding: 24, maxHeight: '85%' as any, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 24, elevation: 12 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  modalTitle: { fontSize: 17, fontWeight: '700' as const, color: Colors.light.text },

  fieldLabel: { fontSize: 12, fontWeight: '600' as const, color: Colors.light.textSecondary, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginTop: 14, marginBottom: 6 },
  textInput: { height: 40, borderWidth: 1, borderColor: Colors.light.border, borderRadius: DS.radius.md, paddingHorizontal: 12, fontSize: 14, color: Colors.light.text, backgroundColor: '#FAFAFA', outlineStyle: 'none' as any },
  rowInputs: { flexDirection: 'row' as const, gap: 8 },

  sectionDivider: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, marginVertical: 16 },
  sectionDividerLine: { flex: 1, height: 1, backgroundColor: Colors.light.border },
  sectionDividerLabel: { fontSize: 11, fontWeight: '700' as const, color: Colors.light.textSecondary, textTransform: 'uppercase' as const, letterSpacing: 0.8 },

  typePickerBtn: { height: 40, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, borderWidth: 1, borderColor: Colors.light.border, borderRadius: DS.radius.md, paddingHorizontal: 12, backgroundColor: '#FAFAFA' },
  typePickerBtnText: { fontSize: 14, color: Colors.light.text, flex: 1 },
  typePickerBtnPlaceholder: { fontSize: 14, color: Colors.light.textSecondary, flex: 1 },
  typeDropdown: { borderWidth: 1, borderColor: Colors.light.border, borderRadius: DS.radius.md, backgroundColor: '#fff', marginTop: 4, overflow: 'hidden' as const, maxHeight: 220 },
  typeDropdownItem: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', gap: 6 },
  typeDropdownText: { fontSize: 14, color: Colors.light.text, flex: 1 },
  typeDropdownTextActive: { fontWeight: '700' as const, color: Colors.light.tint },
  orgSearchRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  orgSearchInput: { flex: 1, fontSize: 14, color: Colors.light.text, outlineStyle: 'none' as any },

  inlineOrgBox: { borderWidth: 1, borderColor: Colors.light.border, borderRadius: DS.radius.md, padding: 14, backgroundColor: '#FAFAFA', marginTop: 4 },
  inlineOrgHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, marginBottom: 4 },
  inlineOrgTitle: { fontSize: 13, fontWeight: '700' as const, color: Colors.light.text },

  statusRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 6, marginBottom: 4 },
  statusOption: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: DS.radius.md, borderWidth: 1, borderColor: Colors.light.border, backgroundColor: '#F5F5F5' },
  statusOptionText: { fontSize: 12, fontWeight: '600' as const, color: Colors.light.textSecondary },

  createOrgLink: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 5, marginTop: 8, paddingVertical: 4 },
  createOrgLinkText: { fontSize: 13, color: Colors.light.tint, fontWeight: '600' as const },

  saveBtn: { backgroundColor: Colors.light.tint, borderRadius: DS.radius.md, height: 44, alignItems: 'center' as const, justifyContent: 'center' as const, marginTop: 16 },
  saveBtnDisabled: { opacity: 0.45 },
  saveBtnText: { fontSize: 15, fontWeight: '700' as const, color: '#fff' },
});
