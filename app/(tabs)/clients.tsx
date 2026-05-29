import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  Modal, KeyboardAvoidingView, Platform, Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { OrgAvatar } from '@/components/OrgAvatar';
import {
  Plus, Search, X, Users, Building2, User, ChevronRight, TrendingUp,
  Thermometer, Star, Archive, Upload, ChevronDown, Check, ArrowUpDown,
  Wifi, WifiOff, Edit3, Trash2, UserPlus, FileText, Globe,
  Settings2, SlidersHorizontal,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { DS } from '@/constants/designSystem';
import { useCrm } from '@/contexts/CrmContext';
import { Organization, CrmStatus, CRM_STATUS_CONFIG, ORG_TYPES } from '@/types/crm';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { ContactImportModal } from '@/components/ContactImportModal';
import { formatPhone, formatPhoneInput } from '@/utils/phone';

// ── Column system ──────────────────────────────────────────────────────────────
type ColId = 'org' | 'bizType' | 'contact' | 'phone' | 'email' | 'status' | 'hub' | 'campaign' | 'actions';
type SortField = 'name' | 'type' | 'contact' | 'campaign' | 'status' | 'hub';
type SortDir = 'asc' | 'desc';
type AddMode = 'org' | 'person';
type AddStep = 'choose' | 'details';

type FilterState = {
  org: string; bizType: string[]; contact: string; phone: string;
  email: string; status: CrmStatus[]; hub: string[];
};

const EMPTY_FILTERS: FilterState = { org: '', bizType: [], contact: '', phone: '', email: '', status: [], hub: [] };
const FILTER_TABS: (CrmStatus | 'All')[] = ['All', 'Cold', 'Working', 'Active Client', 'Past Client'];

const AVATAR_W = 48;
const COL_WIDTHS: Record<ColId, number> = {
  org: 192, bizType: 120, contact: 150, phone: 130,
  email: 170, status: 132, hub: 110, campaign: 130, actions: 110,
};

const TOGGLEABLE_COLS: { id: ColId; label: string }[] = [
  { id: 'org', label: 'Organization' },
  { id: 'bizType', label: 'Business Type' },
  { id: 'contact', label: 'Contact Name' },
  { id: 'phone', label: 'Phone Number' },
  { id: 'email', label: 'Email Address' },
  { id: 'status', label: 'Status' },
  { id: 'hub', label: 'Client Hub' },
  { id: 'campaign', label: 'Campaign' },
];
const DEFAULT_VISIBLE: ColId[] = ['org', 'bizType', 'contact', 'phone', 'email', 'status', 'hub', 'actions'];

const EMPTY_ORG_FORM = { name: '', type: '', city: '', state: '', notes: '', status: 'Cold' as CrmStatus };
const EMPTY_CONTACT_FORM = { firstName: '', lastName: '', phone: '', email: '', role: '' };

// ── StatusBadge ────────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: CrmStatus }) {
  const cfg = CRM_STATUS_CONFIG[status];
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
      <View style={[styles.badgeDot, { backgroundColor: cfg.dot }]} />
      <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

// ── OrgRow ─────────────────────────────────────────────────────────────────────
interface OrgRowProps { org: Organization; onPress: () => void; onDelete: () => void; visibleCols: ColId[]; }

function OrgRow({ org, onPress, onDelete, visibleCols }: OrgRowProps) {
  const router = useRouter();
  const primaries = org.contacts.filter((c) => c.isPrimary);
  const primaryContact = primaries[0] || org.contacts[0];
  const activeCampaign = org.campaigns.find((c) => c.steps.some((s) => s.status === 'pending'));
  const menuBtnRef = useRef<View>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });

  const openMenu = () => {
    menuBtnRef.current?.measure((_fx, _fy, width, height, px, py) => {
      setMenuPos({ top: py + height + 4, right: Math.max(0, (typeof window !== 'undefined' ? window.innerWidth : 400) - px - width) });
      setMenuOpen(true);
    });
  };

  const handleAction = (action: string) => {
    setMenuOpen(false);
    if (action === 'edit') router.push(`/crm/${org.id}` as any);
    else if (action === 'addContact') router.push(`/crm/${org.id}` as any);
    else if (action === 'newQuote') router.push({ pathname: '/(tabs)' as any, params: { orgName: org.name, orgId: org.id } });
    else if (action === 'uploadMedia') router.push(`/crm/${org.id}` as any);
    else if (action === 'viewHub') { if (typeof window !== 'undefined') (window as any).open(`/portal/${org.id}`, '_blank'); }
    else if (action === 'delete') onDelete();
  };

  const col = (id: ColId, content: React.ReactNode) => {
    if (!visibleCols.includes(id)) return null;
    return <View style={{ width: COL_WIDTHS[id] }}>{content}</View>;
  };

  return (
    <>
      <TouchableOpacity style={styles.tableRow} onPress={onPress} activeOpacity={0.7}>
        <View style={{ width: AVATAR_W }}>
          <OrgAvatar name={org.name} logoUrl={org.logoUrl} size={36} shape="circle" />
        </View>
        {col('org', <Text style={styles.tableOrgName} numberOfLines={1}>{org.name}</Text>)}
        {col('bizType', org.type
          ? <Text style={styles.tableCell} numberOfLines={1}>{org.type}</Text>
          : <Text style={styles.tableDim}>—</Text>
        )}
        {col('contact', primaryContact
          ? <Text style={styles.tableCell} numberOfLines={1}>{primaryContact.firstName} {primaryContact.lastName}</Text>
          : <Text style={styles.tableDim}>No contact</Text>
        )}
        {col('phone', primaryContact?.phone
          ? <Text style={styles.tableCell} numberOfLines={1}>{formatPhone(primaryContact.phone)}</Text>
          : <Text style={styles.tableDim}>—</Text>
        )}
        {col('email', primaryContact?.email
          ? <Text style={styles.tableCell} numberOfLines={1}>{primaryContact.email}</Text>
          : <Text style={styles.tableDim}>—</Text>
        )}
        {col('campaign', activeCampaign
          ? <Text style={styles.tableCampaignActive} numberOfLines={1}>{activeCampaign.templateName}</Text>
          : <Text style={styles.tableDim}>—</Text>
        )}
        {col('status', <StatusBadge status={org.status} />)}
        {col('hub', org.hubEnabled
          ? <View style={styles.hubBadgeActive}><Wifi size={11} color="#16A34A" /><Text style={styles.hubBadgeTextActive}>Live</Text></View>
          : <View style={styles.hubBadgeInactive}><WifiOff size={11} color="#FFF" /><Text style={styles.hubBadgeTextInactive}>Inactive</Text></View>
        )}
        <View style={{ width: COL_WIDTHS.actions, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
          <TouchableOpacity style={styles.viewBtn} onPress={() => router.push(`/crm/${org.id}` as any)}>
            <Text style={styles.viewBtnText}>View</Text>
          </TouchableOpacity>
          <View ref={menuBtnRef} collapsable={false}>
            <TouchableOpacity style={styles.menuBtn} onPress={(e) => { e.stopPropagation?.(); openMenu(); }} activeOpacity={0.7}>
              <ChevronDown size={14} color={Colors.light.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>

      {menuOpen && (
        <Modal transparent animationType="none" onRequestClose={() => setMenuOpen(false)}>
          <Pressable style={styles.rowMenuBackdrop} onPress={() => setMenuOpen(false)}>
            <View style={[styles.rowMenuDropdown, { top: menuPos.top, right: menuPos.right }]}>
              <TouchableOpacity style={styles.rowMenuItem} onPress={() => handleAction('edit')}>
                <Edit3 size={14} color={Colors.light.text} /><Text style={styles.rowMenuItemText}>Edit Client</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.rowMenuItem} onPress={() => handleAction('addContact')}>
                <UserPlus size={14} color={Colors.light.text} /><Text style={styles.rowMenuItemText}>Add Contacts</Text>
              </TouchableOpacity>
              <View style={styles.rowMenuDivider} />
              <TouchableOpacity style={styles.rowMenuItem} onPress={() => handleAction('newQuote')}>
                <FileText size={14} color={Colors.light.text} /><Text style={styles.rowMenuItemText}>New Quote</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.rowMenuItem} onPress={() => handleAction('uploadMedia')}>
                <Upload size={14} color={Colors.light.text} /><Text style={styles.rowMenuItemText}>Upload Media</Text>
              </TouchableOpacity>
              {org.hubEnabled && (<>
                <View style={styles.rowMenuDivider} />
                <TouchableOpacity style={styles.rowMenuItem} onPress={() => handleAction('viewHub')}>
                  <Globe size={14} color={Colors.light.tint} /><Text style={[styles.rowMenuItemText, { color: Colors.light.tint }]}>View Client Hub</Text>
                </TouchableOpacity>
              </>)}
              <View style={styles.rowMenuDivider} />
              <TouchableOpacity style={styles.rowMenuItem} onPress={() => handleAction('delete')}>
                <Trash2 size={14} color={Colors.light.error} /><Text style={[styles.rowMenuItemText, { color: Colors.light.error }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>
      )}
    </>
  );
}

// ── OrgCard (mobile) ───────────────────────────────────────────────────────────
function OrgCard({ org, onPress }: { org: Organization; onPress: () => void }) {
  const primaries = org.contacts.filter((c) => c.isPrimary);
  const primaryContact = primaries[0] || org.contacts[0];
  const activeCampaign = org.campaigns.find((c) => c.steps.some((s) => s.status === 'pending'));
  const isLead = org.status === 'Cold' || org.status === 'Working';
  return (
    <TouchableOpacity style={[styles.orgCard, isLead && styles.orgCardLead]} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.orgCardLeft}>
        <OrgAvatar name={org.name} logoUrl={org.logoUrl} size={46} />
        <View style={styles.orgCardInfo}>
          <View style={styles.orgCardNameRow}>
            <Text style={styles.orgCardName} numberOfLines={1}>{org.name}</Text>
            <StatusBadge status={org.status} />
          </View>
          {org.type ? <Text style={styles.orgCardType}>{org.type}</Text> : null}
          {primaryContact ? (
            <View>
              <Text style={styles.orgCardContact} numberOfLines={1}>
                {primaryContact.firstName} {primaryContact.lastName}{primaries.length > 1 ? ` +${primaries.length - 1}` : ''}
              </Text>
              {primaryContact.phone ? <Text style={styles.orgCardContactSub}>{formatPhone(primaryContact.phone)}</Text> : null}
              {primaryContact.email ? <Text style={styles.orgCardContactSub} numberOfLines={1}>{primaryContact.email}</Text> : null}
            </View>
          ) : null}
          {activeCampaign ? (
            <View style={styles.orgCardCampaignRow}>
              <TrendingUp size={11} color={Colors.light.tint} />
              <Text style={styles.orgCardCampaignText} numberOfLines={1}>{activeCampaign.templateName}</Text>
            </View>
          ) : null}
        </View>
      </View>
      <ChevronRight size={16} color={Colors.light.border} />
    </TouchableOpacity>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────
export default function ClientsScreen() {
  const router = useRouter();
  const { orgs, addOrg, addOrgWithContact, addContact, deleteOrg } = useCrm();
  const { isDesktop } = useBreakpoint();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<CrmStatus | 'All'>('All');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const [visibleCols, setVisibleCols] = useState<ColId[]>(DEFAULT_VISIBLE);
  const [showColPicker, setShowColPicker] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [colFilters, setColFilters] = useState<FilterState>(EMPTY_FILTERS);

  const [modalVisible, setModalVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [addStep, setAddStep] = useState<AddStep>('choose');
  const [addMode, setAddMode] = useState<AddMode>('org');
  const [orgForm, setOrgForm] = useState(EMPTY_ORG_FORM);
  const [contactForm, setContactForm] = useState(EMPTY_CONTACT_FORM);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [orgSearch, setOrgSearch] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [personOrgStatus, setPersonOrgStatus] = useState<CrmStatus>('Active Client');
  const [showOrgDropdown, setShowOrgDropdown] = useState(false);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (colFilters.org) n++;
    if (colFilters.bizType.length) n++;
    if (colFilters.contact) n++;
    if (colFilters.phone) n++;
    if (colFilters.email) n++;
    if (colFilters.status.length) n++;
    if (colFilters.hub.length) n++;
    return n;
  }, [colFilters]);

  const filtered = useMemo(() => {
    const list = orgs.filter((o) => {
      if (filter !== 'All' && o.status !== filter) return false;
      const q = search.toLowerCase();
      if (q) {
        const hit = o.name.toLowerCase().includes(q) || (o.type || '').toLowerCase().includes(q) ||
          o.contacts.some((c) => `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q) || (c.phone || '').toLowerCase().includes(q));
        if (!hit) return false;
      }
      const pc = o.contacts.find((c) => c.isPrimary) || o.contacts[0];
      if (colFilters.org && !o.name.toLowerCase().includes(colFilters.org.toLowerCase())) return false;
      if (colFilters.bizType.length && !colFilters.bizType.includes(o.type || '')) return false;
      if (colFilters.contact) {
        if (!pc) return false;
        if (!`${pc.firstName} ${pc.lastName}`.toLowerCase().includes(colFilters.contact.toLowerCase())) return false;
      }
      if (colFilters.phone && !(pc?.phone || '').includes(colFilters.phone)) return false;
      if (colFilters.email && !(pc?.email || '').toLowerCase().includes(colFilters.email.toLowerCase())) return false;
      if (colFilters.status.length && !colFilters.status.includes(o.status)) return false;
      if (colFilters.hub.length) {
        const key = o.hubEnabled ? 'live' : 'inactive';
        if (!colFilters.hub.includes(key)) return false;
      }
      return true;
    });
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortField === 'type') cmp = (a.type || '').localeCompare(b.type || '');
      else if (sortField === 'contact') {
        const ca = a.contacts.find((c) => c.isPrimary) || a.contacts[0];
        const cb = b.contacts.find((c) => c.isPrimary) || b.contacts[0];
        cmp = (`${ca?.lastName}${ca?.firstName}` || '').localeCompare(`${cb?.lastName}${cb?.firstName}` || '');
      } else if (sortField === 'campaign') {
        const ca = a.campaigns.find((c) => c.steps.some((s) => s.status === 'pending'));
        const cb = b.campaigns.find((c) => c.steps.some((s) => s.status === 'pending'));
        cmp = (ca?.templateName || '').localeCompare(cb?.templateName || '');
      } else if (sortField === 'status') cmp = a.status.localeCompare(b.status);
      else if (sortField === 'hub') cmp = (a.hubEnabled ? 1 : 0) - (b.hubEnabled ? 1 : 0);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [orgs, filter, search, sortField, sortDir, colFilters]);

  const counts = useMemo(() => ({
    All: orgs.length, Cold: orgs.filter((o) => o.status === 'Cold').length,
    Working: orgs.filter((o) => o.status === 'Working').length,
    'Active Client': orgs.filter((o) => o.status === 'Active Client').length,
    'Past Client': orgs.filter((o) => o.status === 'Past Client').length,
  }), [orgs]);

  const stats = useMemo(() => ({
    total: orgs.length,
    totalPeople: orgs.reduce((sum, o) => sum + o.contacts.length, 0),
    liveHubs: orgs.filter((o) => o.hubEnabled).length,
  }), [orgs]);

  const orgSearchResults = useMemo(() => {
    if (!orgSearch.trim()) return orgs.slice(0, 6);
    return orgs.filter((o) => o.name.toLowerCase().includes(orgSearch.toLowerCase())).slice(0, 6);
  }, [orgs, orgSearch]);

  const openAddModal = useCallback(() => {
    setOrgForm(EMPTY_ORG_FORM); setContactForm(EMPTY_CONTACT_FORM);
    setAddStep('choose'); setAddMode('org'); setShowTypeDropdown(false);
    setOrgSearch(''); setSelectedOrgId(null); setPersonOrgStatus('Active Client');
    setShowOrgDropdown(false); setModalVisible(true);
  }, []);

  const hasContactInfo = contactForm.firstName.trim() || contactForm.lastName.trim() || contactForm.phone.trim() || contactForm.email.trim();

  const handleSave = useCallback(() => {
    if (addMode === 'org') {
      if (!orgForm.name.trim()) return;
      const orgData = { name: orgForm.name.trim(), type: orgForm.type || undefined, city: orgForm.city || undefined, state: orgForm.state || undefined, notes: orgForm.notes || undefined, status: orgForm.status };
      if (hasContactInfo) {
        addOrgWithContact({ orgData, contactData: { firstName: contactForm.firstName.trim(), lastName: contactForm.lastName.trim(), phone: contactForm.phone.trim() || undefined, email: contactForm.email.trim() || undefined, role: contactForm.role.trim() || undefined, isPrimary: true } as any });
      } else { addOrg(orgData as any); }
    } else {
      if (!contactForm.firstName.trim() && !contactForm.lastName.trim()) return;
      const contactData = { firstName: contactForm.firstName.trim(), lastName: contactForm.lastName.trim(), phone: contactForm.phone.trim() || undefined, email: contactForm.email.trim() || undefined, role: contactForm.role.trim() || undefined, isPrimary: true } as any;
      if (selectedOrgId) { addContact({ orgId: selectedOrgId, contact: contactData }); }
      else { addOrgWithContact({ orgData: { name: orgSearch.trim() || `${contactForm.firstName} ${contactForm.lastName}`.trim(), status: personOrgStatus } as any, contactData }); }
    }
    setModalVisible(false);
  }, [addMode, orgForm, contactForm, hasContactInfo, orgSearch, selectedOrgId, personOrgStatus, addOrg, addOrgWithContact, addContact]);

  const canSave = addMode === 'org' ? !!orgForm.name.trim() : !!(contactForm.firstName.trim() || contactForm.lastName.trim());

  const toggleSort = useCallback((field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('asc'); }
  }, [sortField]);

  const toggleCol = useCallback((id: ColId) => {
    if (id === 'actions') return;
    setVisibleCols((prev) => prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]);
  }, []);

  const clearFilters = useCallback(() => setColFilters(EMPTY_FILTERS), []);
  const toggleBizType = (t: string) => setColFilters((f) => ({ ...f, bizType: f.bizType.includes(t) ? f.bizType.filter((x) => x !== t) : [...f.bizType, t] }));
  const toggleStatusFilter = (s: CrmStatus) => setColFilters((f) => ({ ...f, status: f.status.includes(s) ? f.status.filter((x) => x !== s) : [...f.status, s] }));
  const toggleHubFilter = (h: string) => setColFilters((f) => ({ ...f, hub: f.hub.includes(h) ? f.hub.filter((x) => x !== h) : [...f.hub, h] }));

  const SortBtn = ({ field, label }: { field: SortField; label: string }) => (
    <TouchableOpacity style={styles.sortBtn} onPress={() => toggleSort(field)}>
      <Text style={[styles.sortBtnText, sortField === field && styles.sortBtnTextActive]}>{label}</Text>
      <ArrowUpDown size={11} color={sortField === field ? Colors.light.tint : 'rgba(255,255,255,0.35)'} />
    </TouchableOpacity>
  );

  const filterIcon = (tab: CrmStatus | 'All') => {
    if (tab === 'All') return <Users size={12} color={filter === tab ? Colors.light.tint : Colors.light.textSecondary} />;
    if (tab === 'Cold') return <Thermometer size={12} color={filter === tab ? CRM_STATUS_CONFIG['Cold'].color : Colors.light.textSecondary} />;
    if (tab === 'Working') return <TrendingUp size={12} color={filter === tab ? CRM_STATUS_CONFIG['Working'].color : Colors.light.textSecondary} />;
    if (tab === 'Active Client') return <Star size={12} color={filter === tab ? '#FF5A00' : Colors.light.textSecondary} />;
    if (tab === 'Past Client') return <Archive size={12} color={filter === tab ? CRM_STATUS_CONFIG['Past Client'].color : Colors.light.textSecondary} />;
    return null;
  };

  const selectedOrg = selectedOrgId ? orgs.find((o) => o.id === selectedOrgId) : null;

  const tableHeaderRow = (
    <View style={styles.tableHeader}>
      <View style={{ width: AVATAR_W }} />
      {TOGGLEABLE_COLS.filter((c) => visibleCols.includes(c.id)).map((col) => (
        <View key={col.id} style={{ width: COL_WIDTHS[col.id] }}>
          {col.id === 'org' && <SortBtn field="name" label="Organization" />}
          {col.id === 'bizType' && <SortBtn field="type" label="Business Type" />}
          {col.id === 'contact' && <SortBtn field="contact" label="Contact" />}
          {col.id === 'phone' && <Text style={styles.sortBtnText}>Phone</Text>}
          {col.id === 'email' && <Text style={styles.sortBtnText}>Email</Text>}
          {col.id === 'status' && <SortBtn field="status" label="Status" />}
          {col.id === 'hub' && <SortBtn field="hub" label="Client Hub" />}
          {col.id === 'campaign' && <SortBtn field="campaign" label="Campaign" />}
        </View>
      ))}
      <View style={{ width: COL_WIDTHS.actions, alignItems: 'flex-end' }}>
        <Text style={styles.sortBtnText}>ACTIONS</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* ── Page Header ── */}
      <View style={styles.pageHeader}>
        <View style={styles.headerTop}>
          <Text style={styles.pageTitle}>Contacts</Text>
        </View>

        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: Colors.light.tint }]}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total Orgs</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#2563EB' }]}>{stats.totalPeople}</Text>
            <Text style={styles.statLabel}>Total People</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#16A34A' }]}>{stats.liveHubs}</Text>
            <Text style={styles.statLabel}>Live Client Hubs</Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillsScroll} contentContainerStyle={styles.pillsRow}>
          {FILTER_TABS.map((tab) => {
            const active = filter === tab;
            const cfg = tab !== 'All' ? CRM_STATUS_CONFIG[tab as CrmStatus] : null;
            return (
              <TouchableOpacity key={tab}
                style={[styles.pill, active && styles.pillActive, active && cfg ? { backgroundColor: cfg.bg, borderColor: cfg.border } : null, active && tab === 'All' ? { backgroundColor: '#FFF4EE', borderColor: Colors.light.tint } : null]}
                onPress={() => setFilter(tab)}
              >
                {filterIcon(tab)}
                <Text style={[styles.pillText, active && styles.pillTextActive, active && cfg ? { color: cfg.color } : null, active && tab === 'All' ? { color: Colors.light.tint } : null]}>{tab}</Text>
                <View style={[styles.pillCount, active && cfg ? { backgroundColor: cfg.border } : null]}>
                  <Text style={[styles.pillCountText, active && cfg ? { color: cfg.color } : null]}>{counts[tab]}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.searchRow}>
          <TouchableOpacity style={styles.addBtn} onPress={openAddModal}>
            <Plus size={16} color="#fff" /><Text style={styles.addBtnText}>Add Contact</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.importBtn} onPress={() => setImportModalVisible(true)}>
            <Upload size={14} color={Colors.light.tint} /><Text style={styles.importBtnText}>Import</Text>
          </TouchableOpacity>
          <View style={styles.searchBox}>
            <Search size={15} color={Colors.light.textSecondary} />
            <TextInput style={styles.searchInput} placeholder="Search org, contact, type…" placeholderTextColor={Colors.light.textSecondary} value={search} onChangeText={setSearch} />
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

        {!isDesktop && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mobileSortScroll} contentContainerStyle={styles.mobileSortRow}>
            <Text style={styles.mobileSortLabel}>Sort:</Text>
            {(['name', 'type', 'contact', 'status', 'hub'] as SortField[]).map((f) => (
              <TouchableOpacity key={f} style={[styles.mobileSortBtn, sortField === f && styles.mobileSortBtnActive]} onPress={() => toggleSort(f)}>
                <Text style={[styles.mobileSortBtnText, sortField === f && styles.mobileSortBtnTextActive]}>
                  {f === 'name' ? 'Name' : f === 'type' ? 'Type' : f === 'contact' ? 'Contact' : f === 'status' ? 'Status' : 'Hub'}
                  {sortField === f ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {/* ── Filter Panel ── */}
      {showFilters && isDesktop && (
        <View style={styles.filterPanel}>
          <View style={styles.filterRow}>
            {[
              { key: 'org', label: 'Organization', val: colFilters.org, set: (v: string) => setColFilters((f) => ({ ...f, org: v })) },
              { key: 'contact', label: 'Contact Name', val: colFilters.contact, set: (v: string) => setColFilters((f) => ({ ...f, contact: v })) },
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
              <Text style={styles.filterGroupLabel}>Business Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}><View style={{ flexDirection: 'row', gap: 6 }}>
                {(ORG_TYPES as readonly string[]).map((t) => {
                  const on = colFilters.bizType.includes(t);
                  return <TouchableOpacity key={t} style={[styles.filterChip, on && styles.filterChipOn]} onPress={() => toggleBizType(t)}><Text style={[styles.filterChipText, on && styles.filterChipTextOn]}>{t}</Text></TouchableOpacity>;
                })}
              </View></ScrollView>
            </View>
            <View style={styles.filterGroup}>
              <Text style={styles.filterGroupLabel}>Status</Text>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {(['Cold', 'Working', 'Active Client', 'Past Client'] as CrmStatus[]).map((s) => {
                  const on = colFilters.status.includes(s); const cfg = CRM_STATUS_CONFIG[s];
                  return <TouchableOpacity key={s} style={[styles.filterChip, on && { backgroundColor: cfg.bg, borderColor: cfg.border }]} onPress={() => toggleStatusFilter(s)}><Text style={[styles.filterChipText, on && { color: cfg.color }]}>{s}</Text></TouchableOpacity>;
                })}
              </View>
            </View>
            <View style={styles.filterGroup}>
              <Text style={styles.filterGroupLabel}>Client Hub</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {[{ k: 'live', l: 'Live' }, { k: 'inactive', l: 'Inactive' }].map(({ k, l }) => {
                  const on = colFilters.hub.includes(k);
                  return <TouchableOpacity key={k} style={[styles.filterChip, on && (k === 'live' ? { backgroundColor: '#DCFCE7', borderColor: '#86EFAC' } : { backgroundColor: '#374151', borderColor: '#4B5563' })]} onPress={() => toggleHubFilter(k)}><Text style={[styles.filterChipText, on && (k === 'live' ? { color: '#15803D' } : { color: '#fff' })]}>{l}</Text></TouchableOpacity>;
                })}
              </View>
            </View>
            {activeFilterCount > 0 && (
              <TouchableOpacity style={styles.clearFiltersBtn} onPress={clearFilters}>
                <X size={12} color={Colors.light.error} /><Text style={styles.clearFiltersBtnText}>Clear all</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* ── Content ── */}
      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Building2 size={40} color={Colors.light.border} />
          <Text style={styles.emptyTitle}>{search ? 'No results found' : filter !== 'All' ? `No ${filter} contacts` : 'No contacts yet'}</Text>
          <Text style={styles.emptyText}>{search ? 'Try a different search term.' : filter !== 'All' ? `Add a new contact and set status to ${filter}.` : 'Add your first organization or contact to get started.'}</Text>
          {!search && <TouchableOpacity style={styles.emptyAddBtn} onPress={openAddModal}><Plus size={15} color="#fff" /><Text style={styles.emptyAddBtnText}>Add Contact</Text></TouchableOpacity>}
        </View>
      ) : isDesktop ? (
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          <ScrollView horizontal showsHorizontalScrollIndicator={true} contentContainerStyle={{ flexGrow: 1 }}>
            <View>
              {tableHeaderRow}
              <View style={styles.tableBody}>
                {filtered.map((org, idx) => (
                  <View key={org.id}>
                    <OrgRow
                      org={org}
                      onPress={() => router.push(`/crm/${org.id}` as any)}
                      onDelete={() => { if (typeof window === 'undefined' || window.confirm(`Delete ${org.name}? This cannot be undone.`)) deleteOrg(org.id); }}
                      visibleCols={visibleCols}
                    />
                    {idx < filtered.length - 1 && <View style={styles.tableDivider} />}
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>
          <View style={{ height: 40 }} />
        </ScrollView>
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {filtered.map((org) => <OrgCard key={org.id} org={org} onPress={() => router.push(`/crm/${org.id}` as any)} />)}
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
            {TOGGLEABLE_COLS.map((col) => {
              const on = visibleCols.includes(col.id);
              return (
                <TouchableOpacity key={col.id} style={styles.colPickerRow} onPress={() => toggleCol(col.id)}>
                  <View style={[styles.colPickerCheck, on && styles.colPickerCheckOn]}>{on && <Check size={12} color="#fff" />}</View>
                  <Text style={[styles.colPickerLabel, on && styles.colPickerLabelOn]}>{col.label}</Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={styles.colPickerReset} onPress={() => setVisibleCols(DEFAULT_VISIBLE)}>
              <Text style={styles.colPickerResetText}>Reset to defaults</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Add Contact Modal ── */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalKAV}>
            <Pressable style={styles.modalCard} onPress={() => { setShowTypeDropdown(false); setShowOrgDropdown(false); }}>
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {addStep === 'details' && (
                    <TouchableOpacity onPress={() => setAddStep('choose')} style={{ padding: 2 }}>
                      <ChevronRight size={18} color={Colors.light.textSecondary} style={{ transform: [{ rotate: '180deg' }] }} />
                    </TouchableOpacity>
                  )}
                  <Text style={styles.modalTitle}>{addStep === 'choose' ? 'Add Contact' : addMode === 'org' ? 'New Organization' : 'New Contact Person'}</Text>
                </View>
                <TouchableOpacity onPress={() => setModalVisible(false)}><X size={22} color={Colors.light.textSecondary} /></TouchableOpacity>
              </View>

              {addStep === 'choose' && (
                <View style={styles.chooseStep}>
                  <Text style={styles.chooseLabel}>What are you adding?</Text>
                  <TouchableOpacity style={[styles.chooseOption, addMode === 'org' && styles.chooseOptionActive]} onPress={() => setAddMode('org')}>
                    <View style={[styles.chooseIcon, addMode === 'org' && styles.chooseIconActive]}><Building2 size={22} color={addMode === 'org' ? '#fff' : Colors.light.textSecondary} /></View>
                    <View style={{ flex: 1 }}><Text style={styles.chooseOptionTitle}>Organization</Text><Text style={styles.chooseOptionSub}>A company, school, church, or business</Text></View>
                    <View style={[styles.chooseRadio, addMode === 'org' && styles.chooseRadioActive]}>{addMode === 'org' && <Check size={12} color="#fff" />}</View>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.chooseOption, addMode === 'person' && styles.chooseOptionActive]} onPress={() => setAddMode('person')}>
                    <View style={[styles.chooseIcon, addMode === 'person' && { backgroundColor: '#7C3AED' }]}><User size={22} color={addMode === 'person' ? '#fff' : Colors.light.textSecondary} /></View>
                    <View style={{ flex: 1 }}><Text style={styles.chooseOptionTitle}>Contact Person</Text><Text style={styles.chooseOptionSub}>An individual linked to an organization</Text></View>
                    <View style={[styles.chooseRadio, addMode === 'person' && styles.chooseRadioActive]}>{addMode === 'person' && <Check size={12} color="#fff" />}</View>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.continueBtn} onPress={() => setAddStep('details')}>
                    <Text style={styles.continueBtnText}>Continue</Text><ChevronRight size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}

              {addStep === 'details' && addMode === 'org' && (
                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  <Text style={styles.fieldLabel}>Status</Text>
                  <View style={styles.statusRow}>
                    {(['Cold', 'Working', 'Active Client', 'Past Client'] as CrmStatus[]).map((s) => {
                      const cfg = CRM_STATUS_CONFIG[s]; const sel = orgForm.status === s;
                      return <TouchableOpacity key={s} style={[styles.statusOption, sel && { backgroundColor: cfg.bg, borderColor: cfg.border }]} onPress={() => setOrgForm((f) => ({ ...f, status: s }))}><Text style={[styles.statusOptionText, sel && { color: cfg.color, fontWeight: '700' as const }]}>{s}</Text></TouchableOpacity>;
                    })}
                  </View>
                  <Text style={styles.fieldLabel}>Organization Name *</Text>
                  <TextInput style={styles.textInput} value={orgForm.name} onChangeText={(v) => setOrgForm((f) => ({ ...f, name: v }))} placeholder="Church name, school, company…" placeholderTextColor={Colors.light.textSecondary} autoFocus />
                  <Text style={styles.fieldLabel}>Type</Text>
                  <TouchableOpacity style={styles.typePickerBtn} onPress={() => setShowTypeDropdown((v) => !v)}>
                    <Text style={orgForm.type ? styles.typePickerBtnText : styles.typePickerBtnPlaceholder}>{orgForm.type || 'Select type…'}</Text>
                    <ChevronDown size={15} color={Colors.light.textSecondary} />
                  </TouchableOpacity>
                  {showTypeDropdown && (
                    <View style={styles.typeDropdown}>
                      {(ORG_TYPES as readonly string[]).map((t) => (
                        <TouchableOpacity key={t} style={styles.typeDropdownItem} onPress={() => { setOrgForm((f) => ({ ...f, type: t })); setShowTypeDropdown(false); }}>
                          <Text style={[styles.typeDropdownText, orgForm.type === t && styles.typeDropdownTextActive]}>{t}</Text>
                          {orgForm.type === t && <Check size={13} color={Colors.light.tint} />}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                  <Text style={styles.fieldLabel}>City / State</Text>
                  <View style={styles.rowInputs}>
                    <TextInput style={[styles.textInput, { flex: 2 }]} value={orgForm.city} onChangeText={(v) => setOrgForm((f) => ({ ...f, city: v }))} placeholder="City" placeholderTextColor={Colors.light.textSecondary} />
                    <TextInput style={[styles.textInput, { flex: 1 }]} value={orgForm.state} onChangeText={(v) => setOrgForm((f) => ({ ...f, state: v }))} placeholder="State" placeholderTextColor={Colors.light.textSecondary} />
                  </View>
                  <Text style={styles.fieldLabel}>Notes</Text>
                  <TextInput style={[styles.textInput, styles.notesInput]} value={orgForm.notes} onChangeText={(v) => setOrgForm((f) => ({ ...f, notes: v }))} placeholder="Initial notes…" placeholderTextColor={Colors.light.textSecondary} multiline numberOfLines={2} />
                  <View style={styles.sectionDivider}>
                    <View style={styles.sectionDividerLine} /><Text style={styles.sectionDividerLabel}>Primary Contact (optional)</Text><View style={styles.sectionDividerLine} />
                  </View>
                  <View style={styles.rowInputs}>
                    <TextInput style={[styles.textInput, { flex: 1 }]} value={contactForm.firstName} onChangeText={(v) => setContactForm((f) => ({ ...f, firstName: v }))} placeholder="First name" placeholderTextColor={Colors.light.textSecondary} />
                    <TextInput style={[styles.textInput, { flex: 1 }]} value={contactForm.lastName} onChangeText={(v) => setContactForm((f) => ({ ...f, lastName: v }))} placeholder="Last name" placeholderTextColor={Colors.light.textSecondary} />
                  </View>
                  <View style={[styles.rowInputs, { marginTop: 8 }]}>
                    <TextInput style={[styles.textInput, { flex: 1 }]} value={contactForm.phone} onChangeText={(v) => setContactForm((f) => ({ ...f, phone: formatPhoneInput(v) }))} placeholder="(555) 000-0000" placeholderTextColor={Colors.light.textSecondary} keyboardType="phone-pad" />
                    <TextInput style={[styles.textInput, { flex: 1 }]} value={contactForm.email} onChangeText={(v) => setContactForm((f) => ({ ...f, email: v }))} placeholder="Email" placeholderTextColor={Colors.light.textSecondary} keyboardType="email-address" autoCapitalize="none" />
                  </View>
                  <View style={{ height: 16 }} />
                </ScrollView>
              )}

              {addStep === 'details' && addMode === 'person' && (
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
                  <TouchableOpacity style={[styles.typePickerBtn, selectedOrg && { borderColor: Colors.light.tint }]} onPress={() => setShowOrgDropdown((v) => !v)}>
                    <Text style={selectedOrg ? styles.typePickerBtnText : styles.typePickerBtnPlaceholder} numberOfLines={1}>{selectedOrg ? selectedOrg.name : orgSearch || 'Search or type org name…'}</Text>
                    {selectedOrg ? <TouchableOpacity onPress={() => { setSelectedOrgId(null); setOrgSearch(''); }}><X size={15} color={Colors.light.textSecondary} /></TouchableOpacity> : <ChevronDown size={15} color={Colors.light.textSecondary} />}
                  </TouchableOpacity>
                  {showOrgDropdown && !selectedOrg && (
                    <View style={styles.typeDropdown}>
                      <View style={styles.orgSearchRow}>
                        <Search size={13} color={Colors.light.textSecondary} />
                        <TextInput style={styles.orgSearchInput} value={orgSearch} onChangeText={setOrgSearch} placeholder="Search existing orgs…" placeholderTextColor={Colors.light.textSecondary} autoFocus />
                      </View>
                      {orgSearchResults.map((o) => (
                        <TouchableOpacity key={o.id} style={styles.typeDropdownItem} onPress={() => { setSelectedOrgId(o.id); setOrgSearch(o.name); setShowOrgDropdown(false); }}>
                          <Text style={styles.typeDropdownText}>{o.name}</Text>
                          {o.type ? <Text style={{ fontSize: 11, color: Colors.light.textSecondary }}>{o.type}</Text> : null}
                        </TouchableOpacity>
                      ))}
                      {orgSearch.trim() && !orgSearchResults.find((o) => o.name.toLowerCase() === orgSearch.toLowerCase()) && (
                        <TouchableOpacity style={[styles.typeDropdownItem, { backgroundColor: '#FFF4EE', borderBottomWidth: 0 }]} onPress={() => { setSelectedOrgId(null); setShowOrgDropdown(false); }}>
                          <Plus size={13} color={Colors.light.tint} />
                          <Text style={{ fontSize: 14, color: Colors.light.tint, fontWeight: '600' as const }}>Create "{orgSearch.trim()}"</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                  {!selectedOrgId && (<>
                    <Text style={styles.fieldLabel}>New Org Status</Text>
                    <View style={styles.statusRow}>
                      {(['Cold', 'Working', 'Active Client'] as CrmStatus[]).map((s) => {
                        const cfg = CRM_STATUS_CONFIG[s]; const sel = personOrgStatus === s;
                        return <TouchableOpacity key={s} style={[styles.statusOption, sel && { backgroundColor: cfg.bg, borderColor: cfg.border }]} onPress={() => setPersonOrgStatus(s)}><Text style={[styles.statusOptionText, sel && { color: cfg.color, fontWeight: '700' as const }]}>{s}</Text></TouchableOpacity>;
                      })}
                    </View>
                  </>)}
                  <View style={{ height: 16 }} />
                </ScrollView>
              )}

              {addStep === 'details' && (
                <TouchableOpacity style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]} onPress={handleSave} disabled={!canSave}>
                  <Text style={styles.saveBtnText}>{addMode === 'org' ? (hasContactInfo ? 'Save Org + Contact' : 'Save Organization') : (selectedOrgId ? 'Add to Organization' : 'Save Contact + Org')}</Text>
                </TouchableOpacity>
              )}
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      <ContactImportModal visible={importModalVisible} onClose={() => setImportModalVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  pageHeader: { backgroundColor: Colors.light.surface, borderBottomWidth: 1, borderBottomColor: Colors.light.border, paddingTop: Platform.OS === 'web' ? 0 : 48 },
  headerTop: { flexDirection: 'row', alignItems: 'baseline', gap: 10, paddingHorizontal: DS.spacing.xl, paddingTop: DS.spacing.xl, paddingBottom: DS.spacing.md },
  pageTitle: { fontSize: 24, fontWeight: '800' as const, color: Colors.light.text },

  statsBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: DS.spacing.lg, marginBottom: DS.spacing.md, backgroundColor: Colors.light.background, borderRadius: DS.radius.md, borderWidth: 1, borderColor: Colors.light.border, paddingVertical: 10, paddingHorizontal: 6 },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '800' as const, color: Colors.light.text },
  statLabel: { fontSize: 10, color: Colors.light.textSecondary, fontWeight: '500' as const, marginTop: 1 },
  statDivider: { width: 1, height: 32, backgroundColor: Colors.light.border },

  pillsScroll: { maxHeight: 52 },
  pillsRow: { flexDirection: 'row', gap: DS.spacing.sm, paddingHorizontal: DS.spacing.xl, paddingBottom: DS.spacing.md },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: DS.spacing.md, paddingVertical: 7, borderRadius: DS.radius.pill, borderWidth: 1.5, borderColor: Colors.light.border, backgroundColor: Colors.light.background },
  pillActive: { borderColor: Colors.light.tint, backgroundColor: '#FFF4EE' },
  pillText: { fontSize: 13, fontWeight: '500' as const, color: Colors.light.textSecondary },
  pillTextActive: { color: Colors.light.tint, fontWeight: '700' as const },
  pillCount: { backgroundColor: Colors.light.border, borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  pillCountText: { fontSize: 10, fontWeight: '700' as const, color: Colors.light.textSecondary },

  searchRow: { flexDirection: 'row', gap: DS.spacing.sm, paddingHorizontal: DS.spacing.xl, paddingBottom: DS.spacing.md, alignItems: 'center' },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.light.background, borderRadius: DS.radius.md, borderWidth: 1, borderColor: Colors.light.border, paddingHorizontal: 12, height: 40 },
  searchInput: { flex: 1, fontSize: 14, color: Colors.light.text, outlineStyle: 'none' as any },
  importBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: Colors.light.tint, paddingHorizontal: 14, borderRadius: DS.radius.md, height: 40, backgroundColor: Colors.light.surface },
  importBtnText: { fontSize: 13, fontWeight: '600' as const, color: Colors.light.tint },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.light.tint, paddingHorizontal: 16, borderRadius: DS.radius.md, height: 40 },
  addBtnText: { fontSize: 14, fontWeight: '700' as const, color: '#fff' },
  toolBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, borderRadius: DS.radius.md, borderWidth: 1, borderColor: Colors.light.border, backgroundColor: Colors.light.surface, height: 40 },
  toolBtnActive: { borderColor: Colors.light.tint, backgroundColor: '#FFF4EE' },
  toolBtnText: { fontSize: 13, fontWeight: '600' as const, color: Colors.light.textSecondary },
  toolBtnTextActive: { color: Colors.light.tint },
  toolBadge: { backgroundColor: Colors.light.tint, borderRadius: 8, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 },
  toolBadgeText: { fontSize: 10, fontWeight: '700' as const, color: '#fff' },

  mobileSortScroll: { flexShrink: 0, backgroundColor: Colors.light.surface, borderBottomWidth: 1, borderBottomColor: Colors.light.border },
  mobileSortRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, paddingHorizontal: DS.spacing.lg, paddingVertical: 10 },
  mobileSortLabel: { fontSize: 12, color: Colors.light.textSecondary, fontWeight: '600' as const, marginRight: 2 },
  mobileSortBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: DS.radius.pill, borderWidth: 1, borderColor: Colors.light.border, backgroundColor: Colors.light.surface },
  mobileSortBtnActive: { borderColor: Colors.light.tint, backgroundColor: '#FFF4EE' },
  mobileSortBtnText: { fontSize: 13, color: Colors.light.textSecondary },
  mobileSortBtnTextActive: { color: Colors.light.tint, fontWeight: '700' as const },

  filterPanel: { backgroundColor: Colors.light.surface, borderBottomWidth: 1, borderBottomColor: Colors.light.border, paddingHorizontal: DS.spacing.xl, paddingVertical: DS.spacing.md, gap: 10 },
  filterRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' },
  filterGroup: { gap: 5 },
  filterGroupLabel: { fontSize: 11, fontWeight: '700' as const, color: Colors.light.textSecondary, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  filterInputBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.light.background, borderRadius: DS.radius.sm, borderWidth: 1, borderColor: Colors.light.border, paddingHorizontal: 10, paddingVertical: 8, minWidth: 150 },
  filterInput: { flex: 1, fontSize: 13, color: Colors.light.text, outlineStyle: 'none' as any },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: DS.radius.sm, borderWidth: 1.5, borderColor: Colors.light.border, backgroundColor: Colors.light.background },
  filterChipOn: { borderColor: Colors.light.tint, backgroundColor: '#FFF4EE' },
  filterChipText: { fontSize: 13, color: Colors.light.textSecondary, fontWeight: '500' as const },
  filterChipTextOn: { color: Colors.light.tint, fontWeight: '700' as const },
  clearFiltersBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: DS.radius.sm, borderWidth: 1.5, borderColor: Colors.light.error, backgroundColor: '#FEF2F2' },
  clearFiltersBtnText: { fontSize: 13, color: Colors.light.error, fontWeight: '600' as const },

  tableHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: DS.spacing.lg, paddingVertical: 10, backgroundColor: '#000000' },
  tableBody: { paddingBottom: 40 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: DS.spacing.lg, paddingVertical: 12, backgroundColor: Colors.light.surface },
  tableDivider: { height: 1, backgroundColor: Colors.light.border, marginLeft: DS.spacing.lg },
  tableOrgName: { fontSize: 14, fontWeight: '600' as const, color: Colors.light.text },
  tableCell: { fontSize: 13, color: Colors.light.textSecondary },
  tableDim: { fontSize: 13, color: Colors.light.border },
  tableCampaignActive: { fontSize: 12, color: Colors.light.tint, fontWeight: '500' as const },

  sortBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4 },
  sortBtnText: { fontSize: 11, fontWeight: '700' as const, color: '#FFFFFF', textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  sortBtnTextActive: { color: Colors.light.tint },

  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 3, borderRadius: DS.radius.pill, borderWidth: 1, alignSelf: 'flex-start' as const },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' as const },

  hubBadgeActive: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, backgroundColor: '#DCFCE7', borderRadius: DS.radius.sm, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start' as const, borderWidth: 1, borderColor: '#86EFAC' },
  hubBadgeInactive: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, backgroundColor: '#374151', borderRadius: DS.radius.sm, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start' as const, borderWidth: 1, borderColor: '#4B5563' },
  hubBadgeTextActive: { fontSize: 11, color: '#15803D', fontWeight: '600' as const },
  hubBadgeTextInactive: { fontSize: 11, color: '#FFFFFF', fontWeight: '600' as const },

  viewBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: DS.radius.sm, backgroundColor: Colors.light.tint, height: 30, justifyContent: 'center' as const, alignItems: 'center' as const },
  viewBtnText: { fontSize: 12, fontWeight: '700' as const, color: '#fff' },
  menuBtn: { width: 30, height: 30, borderRadius: DS.radius.sm, borderWidth: 1, borderColor: Colors.light.border, backgroundColor: Colors.light.surface, alignItems: 'center' as const, justifyContent: 'center' as const },
  rowMenuBackdrop: { position: 'absolute' as any, top: 0, left: 0, right: 0, bottom: 0 },
  rowMenuDropdown: { position: 'absolute' as any, backgroundColor: Colors.light.surface, borderRadius: DS.radius.lg, borderWidth: 1, borderColor: Colors.light.border, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 8, minWidth: 190, paddingVertical: 4, zIndex: 9999 },
  rowMenuItem: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, paddingHorizontal: 14, paddingVertical: 11 },
  rowMenuItemText: { fontSize: 14, color: Colors.light.text },
  rowMenuDivider: { height: 1, backgroundColor: Colors.light.border, marginVertical: 2 },

  list: { flex: 1 },
  listContent: { padding: DS.spacing.lg, gap: DS.spacing.sm },
  orgCard: { backgroundColor: Colors.light.surface, borderRadius: DS.radius.lg, borderWidth: 1, borderColor: Colors.light.border, padding: DS.spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  orgCardLead: { borderLeftWidth: 3, borderLeftColor: '#BFDBFE' },
  orgCardLeft: { flexDirection: 'row', alignItems: 'center', gap: DS.spacing.md, flex: 1 },
  orgCardInfo: { flex: 1 },
  orgCardNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  orgCardName: { fontSize: 15, fontWeight: '700' as const, color: Colors.light.text },
  orgCardType: { fontSize: 13, color: Colors.light.textSecondary, marginTop: 2 },
  orgCardContact: { fontSize: 13, color: Colors.light.textSecondary, marginTop: 3 },
  orgCardContactSub: { fontSize: 12, color: Colors.light.textSecondary, marginTop: 1 },
  orgCardCampaignRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  orgCardCampaignText: { fontSize: 12, color: Colors.light.tint, fontWeight: '500' as const },

  colPickerCard: { backgroundColor: Colors.light.surface, borderRadius: DS.radius.xl, padding: 20, width: 340, maxWidth: '90%' as any },
  colPickerSub: { fontSize: 13, color: Colors.light.textSecondary, marginBottom: 14 },
  colPickerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: Colors.light.border },
  colPickerCheck: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: Colors.light.border, justifyContent: 'center', alignItems: 'center' },
  colPickerCheckOn: { borderColor: Colors.light.tint, backgroundColor: Colors.light.tint },
  colPickerLabel: { fontSize: 14, color: Colors.light.textSecondary },
  colPickerLabelOn: { color: Colors.light.text, fontWeight: '600' as const },
  colPickerReset: { marginTop: 14, alignItems: 'center', paddingVertical: 8 },
  colPickerResetText: { fontSize: 13, color: Colors.light.textSecondary, textDecorationLine: 'underline' as const },

  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10, padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700' as const, color: Colors.light.text },
  emptyText: { fontSize: 14, color: Colors.light.textSecondary, textAlign: 'center' },
  emptyAddBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, backgroundColor: Colors.light.tint, paddingHorizontal: 18, paddingVertical: 11, borderRadius: DS.radius.md },
  emptyAddBtnText: { color: '#fff', fontWeight: '700' as const, fontSize: 14 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalKAV: { width: '100%', maxWidth: 520, paddingHorizontal: 16 },
  modalCard: { backgroundColor: Colors.light.surface, borderRadius: DS.radius.xxl, padding: 20, maxHeight: '90%' as any },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  modalTitle: { fontSize: 18, fontWeight: '800' as const, color: Colors.light.text },

  chooseStep: { gap: 12, marginBottom: 8 },
  chooseLabel: { fontSize: 14, color: Colors.light.textSecondary, marginBottom: 4 },
  chooseOption: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: DS.radius.xl, borderWidth: 2, borderColor: Colors.light.border, backgroundColor: Colors.light.background },
  chooseOptionActive: { borderColor: Colors.light.tint, backgroundColor: '#FFF4EE' },
  chooseIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.light.border, justifyContent: 'center', alignItems: 'center' },
  chooseIconActive: { backgroundColor: Colors.light.tint },
  chooseOptionTitle: { fontSize: 15, fontWeight: '700' as const, color: Colors.light.text },
  chooseOptionSub: { fontSize: 12, color: Colors.light.textSecondary, marginTop: 2 },
  chooseRadio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: Colors.light.border, justifyContent: 'center', alignItems: 'center' },
  chooseRadioActive: { borderColor: Colors.light.tint, backgroundColor: Colors.light.tint },
  continueBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.light.tint, borderRadius: DS.radius.lg, paddingVertical: 14, marginTop: 4 },
  continueBtnText: { color: '#fff', fontWeight: '700' as const, fontSize: 15 },

  fieldLabel: { fontSize: 11, fontWeight: '700' as const, color: Colors.light.textSecondary, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginTop: 14, marginBottom: 6 },
  textInput: { backgroundColor: Colors.light.background, borderRadius: DS.radius.md, borderWidth: 1, borderColor: Colors.light.border, paddingHorizontal: 13, paddingVertical: 11, fontSize: 15, color: Colors.light.text },
  notesInput: { minHeight: 60, textAlignVertical: 'top' as const },
  rowInputs: { flexDirection: 'row', gap: 10 },
  typePickerBtn: { backgroundColor: Colors.light.background, borderRadius: DS.radius.md, borderWidth: 1, borderColor: Colors.light.border, paddingHorizontal: 13, paddingVertical: 11, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  typePickerBtnText: { fontSize: 15, color: Colors.light.text, flex: 1 },
  typePickerBtnPlaceholder: { fontSize: 15, color: Colors.light.textSecondary, flex: 1 },
  typeDropdown: { backgroundColor: Colors.light.surface, borderRadius: DS.radius.md, borderWidth: 1, borderColor: Colors.light.border, marginTop: 4, overflow: 'hidden', maxHeight: 240 },
  typeDropdownItem: { paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: Colors.light.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  typeDropdownText: { fontSize: 14, color: Colors.light.text },
  typeDropdownTextActive: { color: Colors.light.tint, fontWeight: '700' as const },
  orgSearchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: Colors.light.border },
  orgSearchInput: { flex: 1, fontSize: 14, color: Colors.light.text, outlineStyle: 'none' as any },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  statusOption: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: DS.radius.sm, borderWidth: 1.5, borderColor: Colors.light.border, backgroundColor: Colors.light.background },
  statusOptionText: { fontSize: 13, color: Colors.light.textSecondary, fontWeight: '500' as const },
  sectionDivider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18, marginBottom: 4 },
  sectionDividerLine: { flex: 1, height: 1, backgroundColor: Colors.light.border },
  sectionDividerLabel: { fontSize: 11, fontWeight: '700' as const, color: Colors.light.textSecondary, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  saveBtn: { backgroundColor: Colors.light.tint, paddingVertical: 14, borderRadius: DS.radius.lg, alignItems: 'center', marginTop: 16 },
  saveBtnDisabled: { opacity: 0.45 },
  saveBtnText: { fontSize: 15, fontWeight: '700' as const, color: '#fff' },
});
