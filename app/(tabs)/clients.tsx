import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { OrgAvatar } from '@/components/OrgAvatar';
import {
  Plus,
  Search,
  X,
  Users,
  Building2,
  User,
  ChevronRight,
  TrendingUp,
  Thermometer,
  Star,
  Archive,
  Upload,
  ChevronDown,
  Check,
  ArrowUpDown,
  Wifi,
  WifiOff,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useCrm } from '@/contexts/CrmContext';
import { Organization, CrmStatus, CRM_STATUS_CONFIG, ORG_TYPES } from '@/types/crm';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { ContactImportModal } from '@/components/ContactImportModal';

const FILTER_TABS: (CrmStatus | 'All')[] = ['All', 'Cold', 'Working', 'Active Client', 'Past Client'];

type SortField = 'name' | 'type' | 'contact' | 'campaign' | 'status' | 'hub';
type SortDir = 'asc' | 'desc';
type AddMode = 'org' | 'person';
type AddStep = 'choose' | 'details';

const EMPTY_ORG_FORM = {
  name: '',
  type: '',
  city: '',
  state: '',
  notes: '',
  status: 'Cold' as CrmStatus,
};

const EMPTY_CONTACT_FORM = {
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  role: '',
};

function StatusBadge({ status }: { status: CrmStatus }) {
  const cfg = CRM_STATUS_CONFIG[status];
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
      <View style={[styles.badgeDot, { backgroundColor: cfg.dot }]} />
      <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}


interface OrgRowProps {
  org: Organization;
  onPress: () => void;
}

function OrgRow({ org, onPress }: OrgRowProps) {
  const primaries = org.contacts.filter((c) => c.isPrimary);
  const primaryContact = primaries[0] || org.contacts[0];
  const lastActivity = org.activityLog[0];
  const activeCampaign = org.campaigns.find((c) => c.steps.some((s) => s.status === 'pending'));

  return (
    <TouchableOpacity style={styles.tableRow} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.colAvatar}>
        <OrgAvatar name={org.name} logoUrl={org.logoUrl} size={36} shape="circle" />
      </View>
      <View style={styles.colName}>
        <Text style={styles.tableOrgName} numberOfLines={1}>{org.name}</Text>
        {org.type ? <Text style={styles.tableOrgType} numberOfLines={1}>{org.type}</Text> : null}
      </View>
      <View style={styles.colContact}>
        {primaryContact ? (
          <View>
            <View style={styles.colContactNameRow}>
              <Text style={styles.tableSecondary} numberOfLines={1}>
                {primaryContact.firstName} {primaryContact.lastName}
              </Text>
              {primaries.length > 1 && (
                <View style={styles.extraPrimariesBadge}>
                  <Text style={styles.extraPrimariesText}>+{primaries.length - 1}</Text>
                </View>
              )}
            </View>
            {primaryContact.phone ? (
              <Text style={styles.tableContactSub} numberOfLines={1}>{primaryContact.phone}</Text>
            ) : null}
            {primaryContact.email ? (
              <Text style={styles.tableContactSub} numberOfLines={1}>{primaryContact.email}</Text>
            ) : null}
          </View>
        ) : (
          <Text style={styles.tableSecondaryDim}>No contacts</Text>
        )}
      </View>
      <View style={styles.colCampaign}>
        {activeCampaign ? (
          <Text style={styles.tableCampaignActive} numberOfLines={1}>{activeCampaign.templateName}</Text>
        ) : (
          <Text style={styles.tableSecondaryDim}>—</Text>
        )}
      </View>
      <View style={styles.colStatus}>
        <StatusBadge status={org.status} />
      </View>
      <View style={styles.colHub}>
        {org.hubEnabled ? (
          <View style={styles.hubBadgeActive}>
            <Wifi size={11} color={Colors.light.tint} />
            <Text style={styles.hubBadgeTextActive}>Active</Text>
          </View>
        ) : (
          <View style={styles.hubBadgeInactive}>
            <WifiOff size={11} color={Colors.light.placeholder} />
            <Text style={styles.hubBadgeTextInactive}>Inactive</Text>
          </View>
        )}
      </View>
      <View style={styles.colArrow}>
        <ChevronRight size={16} color={Colors.light.border} />
      </View>
    </TouchableOpacity>
  );
}

function OrgCard({ org, onPress }: OrgRowProps) {
  const primaries = org.contacts.filter((c) => c.isPrimary);
  const primaryContact = primaries[0] || org.contacts[0];
  const activeCampaign = org.campaigns.find((c) => c.steps.some((s) => s.status === 'pending'));
  const isLead = org.status === 'Cold' || org.status === 'Working';

  return (
    <TouchableOpacity
      style={[styles.orgCard, isLead && styles.orgCardLead]}
      onPress={onPress}
      activeOpacity={0.85}
    >
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
              <View style={styles.orgCardContactRow}>
                <Text style={styles.orgCardContact} numberOfLines={1}>
                  {primaryContact.firstName} {primaryContact.lastName}
                  {primaries.length > 1 ? ` +${primaries.length - 1}` : ''}
                </Text>
              </View>
              {primaryContact.phone ? (
                <Text style={styles.orgCardContactSub} numberOfLines={1}>{primaryContact.phone}</Text>
              ) : null}
              {primaryContact.email ? (
                <Text style={styles.orgCardContactSub} numberOfLines={1}>{primaryContact.email}</Text>
              ) : null}
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
      <View style={styles.orgCardMeta}>
        <Text style={styles.orgCardContactCount}>{org.contacts.length} contact{org.contacts.length !== 1 ? 's' : ''}</Text>
        <ChevronRight size={16} color={Colors.light.border} />
      </View>
    </TouchableOpacity>
  );
}

export default function ClientsScreen() {
  const router = useRouter();
  const { orgs, addOrg, addOrgWithContact, addContact } = useCrm();
  const { isDesktop } = useBreakpoint();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<CrmStatus | 'All'>('All');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
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

  const filtered = useMemo(() => {
    const list = orgs.filter((o) => {
      const matchesFilter = filter === 'All' || o.status === filter;
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        o.name.toLowerCase().includes(q) ||
        (o.type || '').toLowerCase().includes(q) ||
        o.contacts.some(
          (c) =>
            `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
            (c.email || '').toLowerCase().includes(q) ||
            (c.phone || '').toLowerCase().includes(q) ||
            (c.role || '').toLowerCase().includes(q)
        );
      return matchesFilter && matchesSearch;
    });

    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') {
        cmp = a.name.localeCompare(b.name);
      } else if (sortField === 'type') {
        cmp = (a.type || '').localeCompare(b.type || '');
      } else if (sortField === 'contact') {
        const ca = (a.contacts.find((c) => c.isPrimary) || a.contacts[0]);
        const cb = (b.contacts.find((c) => c.isPrimary) || b.contacts[0]);
        const na = ca ? `${ca.lastName} ${ca.firstName}` : '';
        const nb = cb ? `${cb.lastName} ${cb.firstName}` : '';
        cmp = na.localeCompare(nb);
      } else if (sortField === 'campaign') {
        const ca = a.campaigns.find((c) => c.steps.some((s) => s.status === 'pending'));
        const cb = b.campaigns.find((c) => c.steps.some((s) => s.status === 'pending'));
        cmp = (ca?.templateName || '').localeCompare(cb?.templateName || '');
      } else if (sortField === 'status') {
        cmp = a.status.localeCompare(b.status);
      } else if (sortField === 'hub') {
        cmp = (a.hubEnabled ? 1 : 0) - (b.hubEnabled ? 1 : 0);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [orgs, filter, search, sortField, sortDir]);

  const counts = useMemo(() => ({
    All: orgs.length,
    Cold: orgs.filter((o) => o.status === 'Cold').length,
    Working: orgs.filter((o) => o.status === 'Working').length,
    'Active Client': orgs.filter((o) => o.status === 'Active Client').length,
    'Past Client': orgs.filter((o) => o.status === 'Past Client').length,
  }), [orgs]);

  const stats = useMemo(() => ({
    total: orgs.length,
    active: orgs.filter((o) => o.status === 'Active Client').length,
    working: orgs.filter((o) => o.status === 'Working').length,
    cold: orgs.filter((o) => o.status === 'Cold').length,
    totalPeople: orgs.reduce((sum, o) => sum + o.contacts.length, 0),
  }), [orgs]);

  const orgSearchResults = useMemo(() => {
    if (!orgSearch.trim()) return orgs.slice(0, 6);
    const q = orgSearch.toLowerCase();
    return orgs.filter((o) => o.name.toLowerCase().includes(q)).slice(0, 6);
  }, [orgs, orgSearch]);

  const openAddModal = useCallback(() => {
    setOrgForm(EMPTY_ORG_FORM);
    setContactForm(EMPTY_CONTACT_FORM);
    setAddStep('choose');
    setAddMode('org');
    setShowTypeDropdown(false);
    setOrgSearch('');
    setSelectedOrgId(null);
    setPersonOrgStatus('Active Client');
    setShowOrgDropdown(false);
    setModalVisible(true);
  }, []);

  const hasContactInfo = contactForm.firstName.trim() || contactForm.lastName.trim() || contactForm.phone.trim() || contactForm.email.trim();

  const handleSave = useCallback(() => {
    if (addMode === 'org') {
      if (!orgForm.name.trim()) return;
      const orgData = {
        name: orgForm.name.trim(),
        type: orgForm.type || undefined,
        city: orgForm.city || undefined,
        state: orgForm.state || undefined,
        notes: orgForm.notes || undefined,
        status: orgForm.status,
      };
      if (hasContactInfo) {
        addOrgWithContact({
          orgData,
          contactData: {
            firstName: contactForm.firstName.trim(),
            lastName: contactForm.lastName.trim(),
            phone: contactForm.phone.trim() || undefined,
            email: contactForm.email.trim() || undefined,
            role: contactForm.role.trim() || undefined,
            isPrimary: true,
          } as any,
        });
      } else {
        addOrg(orgData as any);
      }
    } else {
      if (!contactForm.firstName.trim() && !contactForm.lastName.trim()) return;
      const contactData = {
        firstName: contactForm.firstName.trim(),
        lastName: contactForm.lastName.trim(),
        phone: contactForm.phone.trim() || undefined,
        email: contactForm.email.trim() || undefined,
        role: contactForm.role.trim() || undefined,
        isPrimary: true,
      } as any;
      if (selectedOrgId) {
        addContact({ orgId: selectedOrgId, contact: contactData });
      } else {
        const orgName = orgSearch.trim() || `${contactForm.firstName} ${contactForm.lastName}`.trim();
        addOrgWithContact({
          orgData: { name: orgName, status: personOrgStatus } as any,
          contactData,
        });
      }
    }
    setModalVisible(false);
  }, [addMode, orgForm, contactForm, hasContactInfo, orgSearch, selectedOrgId, personOrgStatus, addOrg, addOrgWithContact, addContact]);

  const canSave = addMode === 'org'
    ? !!orgForm.name.trim()
    : !!(contactForm.firstName.trim() || contactForm.lastName.trim());

  const toggleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }, [sortField]);

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

  return (
    <View style={styles.container}>
      <View style={styles.pageHeader}>
        <View style={styles.headerTop}>
          <Text style={styles.pageTitle}>Contacts</Text>
          <Text style={styles.pageSubtitle}>{orgs.length} org{orgs.length !== 1 ? 's' : ''} · {stats.totalPeople} people</Text>
        </View>

        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#FF5A00' }]}>{stats.active}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#2563EB' }]}>{stats.working}</Text>
            <Text style={styles.statLabel}>Working</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#6B7280' }]}>{stats.cold}</Text>
            <Text style={styles.statLabel}>Cold</Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillsScroll} contentContainerStyle={styles.pillsRow}>
          {FILTER_TABS.map((tab) => {
            const active = filter === tab;
            const cfg = tab !== 'All' ? CRM_STATUS_CONFIG[tab as CrmStatus] : null;
            return (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.pill,
                  active && styles.pillActive,
                  active && cfg ? { backgroundColor: cfg.bg, borderColor: cfg.border } : null,
                  active && tab === 'All' ? { backgroundColor: '#FFF4EE', borderColor: Colors.light.tint } : null,
                ]}
                onPress={() => setFilter(tab)}
              >
                {filterIcon(tab)}
                <Text style={[
                  styles.pillText,
                  active && styles.pillTextActive,
                  active && cfg ? { color: cfg.color } : null,
                  active && tab === 'All' ? { color: Colors.light.tint } : null,
                ]}>
                  {tab}
                </Text>
                <View style={[styles.pillCount, active && cfg ? { backgroundColor: cfg.border } : null]}>
                  <Text style={[styles.pillCountText, active && cfg ? { color: cfg.color } : null]}>
                    {counts[tab]}
                  </Text>
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
              placeholder="Search org, contact, type…"
              placeholderTextColor={Colors.light.textSecondary}
              value={search}
              onChangeText={setSearch}
            />
            {search ? (
              <TouchableOpacity onPress={() => setSearch('')}>
                <X size={15} color={Colors.light.textSecondary} />
              </TouchableOpacity>
            ) : null}
          </View>
          <TouchableOpacity style={styles.importBtn} onPress={() => setImportModalVisible(true)}>
            <Upload size={14} color={Colors.light.tint} />
            <Text style={styles.importBtnText}>Import</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addBtn} onPress={openAddModal}>
            <Plus size={16} color="#fff" />
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        </View>

        {isDesktop && (
          <View style={styles.tableHeader}>
            <View style={styles.colAvatar} />
            <View style={styles.colName}>
              <SortBtn field="name" label="Organization" />
            </View>
            <View style={styles.colContact}>
              <SortBtn field="contact" label="Primary Contact" />
            </View>
            <View style={styles.colCampaign}>
              <SortBtn field="campaign" label="Campaign" />
            </View>
            <View style={styles.colStatus}>
              <SortBtn field="status" label="Status" />
            </View>
            <View style={styles.colHub}>
              <SortBtn field="hub" label="Client Hub" />
            </View>
            <View style={styles.colArrow} />
          </View>
        )}
        {!isDesktop && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mobileSortScroll} contentContainerStyle={styles.mobileSortRow}>
            <Text style={styles.mobileSortLabel}>Sort:</Text>
            {(['name', 'type', 'contact', 'campaign', 'status', 'hub'] as SortField[]).map((f) => (
              <TouchableOpacity key={f} style={[styles.mobileSortBtn, sortField === f && styles.mobileSortBtnActive]} onPress={() => toggleSort(f)}>
                <Text style={[styles.mobileSortBtnText, sortField === f && styles.mobileSortBtnTextActive]}>
                  {f === 'name' ? 'Name' : f === 'type' ? 'Type' : f === 'contact' ? 'Contact' : f === 'campaign' ? 'Campaign' : f === 'status' ? 'Status' : 'Hub'}
                  {sortField === f ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Building2 size={40} color={Colors.light.border} />
          <Text style={styles.emptyTitle}>
            {search ? 'No results found' : filter !== 'All' ? `No ${filter} contacts` : 'No contacts yet'}
          </Text>
          <Text style={styles.emptyText}>
            {search
              ? 'Try a different search term.'
              : filter !== 'All'
              ? `Add a new contact and set their status to ${filter}.`
              : 'Add your first organization or contact to get started.'}
          </Text>
          {!search && (
            <TouchableOpacity style={styles.emptyAddBtn} onPress={openAddModal}>
              <Plus size={15} color="#fff" />
              <Text style={styles.emptyAddBtnText}>Add Contact</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : isDesktop ? (
        <FlatList
          data={filtered}
          keyExtractor={(o) => o.id}
          contentContainerStyle={styles.tableBody}
          ItemSeparatorComponent={() => <View style={styles.tableDivider} />}
          renderItem={({ item: org }) => (
            <OrgRow org={org} onPress={() => router.push(`/crm/${org.id}` as any)} />
          )}
        />
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {filtered.map((org) => (
            <OrgCard key={org.id} org={org} onPress={() => router.push(`/crm/${org.id}` as any)} />
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* Add Modal */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalKAV}>
            <Pressable style={styles.modalCard} onPress={() => { setShowTypeDropdown(false); setShowOrgDropdown(false); }}>

              {/* Header */}
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderLeft}>
                  {addStep === 'details' && (
                    <TouchableOpacity onPress={() => setAddStep('choose')} style={styles.backIconBtn}>
                      <ChevronRight size={18} color={Colors.light.textSecondary} style={{ transform: [{ rotate: '180deg' }] }} />
                    </TouchableOpacity>
                  )}
                  <Text style={styles.modalTitle}>
                    {addStep === 'choose' ? 'Add Contact' : addMode === 'org' ? 'New Organization' : 'New Contact Person'}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <X size={22} color={Colors.light.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Step 1: Choose type */}
              {addStep === 'choose' && (
                <View style={styles.chooseStep}>
                  <Text style={styles.chooseLabel}>What are you adding?</Text>

                  <TouchableOpacity
                    style={[styles.chooseOption, addMode === 'org' && styles.chooseOptionActive]}
                    onPress={() => setAddMode('org')}
                  >
                    <View style={[styles.chooseIcon, addMode === 'org' && styles.chooseIconActive]}>
                      <Building2 size={22} color={addMode === 'org' ? '#fff' : Colors.light.textSecondary} />
                    </View>
                    <View style={styles.chooseText}>
                      <Text style={styles.chooseOptionTitle}>Organization</Text>
                      <Text style={styles.chooseOptionSub}>A company, school, church, or business</Text>
                    </View>
                    <View style={[styles.chooseRadio, addMode === 'org' && styles.chooseRadioActive]}>
                      {addMode === 'org' && <Check size={12} color="#fff" />}
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.chooseOption, addMode === 'person' && styles.chooseOptionActive]}
                    onPress={() => setAddMode('person')}
                  >
                    <View style={[styles.chooseIcon, addMode === 'person' && styles.chooseIconActivePerson]}>
                      <User size={22} color={addMode === 'person' ? '#fff' : Colors.light.textSecondary} />
                    </View>
                    <View style={styles.chooseText}>
                      <Text style={styles.chooseOptionTitle}>Contact Person</Text>
                      <Text style={styles.chooseOptionSub}>An individual linked to an organization</Text>
                    </View>
                    <View style={[styles.chooseRadio, addMode === 'person' && styles.chooseRadioActive]}>
                      {addMode === 'person' && <Check size={12} color="#fff" />}
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.continueBtn}
                    onPress={() => setAddStep('details')}
                  >
                    <Text style={styles.continueBtnText}>Continue</Text>
                    <ChevronRight size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}

              {/* Step 2a: Organization details */}
              {addStep === 'details' && addMode === 'org' && (
                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  {/* Status */}
                  <Text style={styles.fieldLabel}>Status</Text>
                  <View style={styles.statusRow}>
                    {(['Cold', 'Working', 'Active Client', 'Past Client'] as CrmStatus[]).map((s) => {
                      const cfg = CRM_STATUS_CONFIG[s];
                      const selected = orgForm.status === s;
                      return (
                        <TouchableOpacity
                          key={s}
                          style={[styles.statusOption, selected && { backgroundColor: cfg.bg, borderColor: cfg.border }]}
                          onPress={() => setOrgForm((f) => ({ ...f, status: s }))}
                        >
                          <Text style={[styles.statusOptionText, selected && { color: cfg.color, fontWeight: '700' as const }]}>{s}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <Text style={styles.fieldLabel}>Organization Name *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={orgForm.name}
                    onChangeText={(v) => setOrgForm((f) => ({ ...f, name: v }))}
                    placeholder="Church name, school, company…"
                    placeholderTextColor={Colors.light.textSecondary}
                    autoFocus
                  />

                  <Text style={styles.fieldLabel}>Type</Text>
                  <TouchableOpacity
                    style={styles.typePickerBtn}
                    onPress={() => setShowTypeDropdown((v) => !v)}
                  >
                    <Text style={orgForm.type ? styles.typePickerBtnText : styles.typePickerBtnPlaceholder}>
                      {orgForm.type || 'Select type…'}
                    </Text>
                    <ChevronDown size={15} color={Colors.light.textSecondary} />
                  </TouchableOpacity>
                  {showTypeDropdown && (
                    <View style={styles.typeDropdown}>
                      {ORG_TYPES.map((t) => (
                        <TouchableOpacity
                          key={t}
                          style={styles.typeDropdownItem}
                          onPress={() => { setOrgForm((f) => ({ ...f, type: t })); setShowTypeDropdown(false); }}
                        >
                          <Text style={[styles.typeDropdownText, orgForm.type === t && styles.typeDropdownTextActive]}>{t}</Text>
                          {orgForm.type === t && <Check size={13} color={Colors.light.tint} />}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  <Text style={styles.fieldLabel}>City / State</Text>
                  <View style={styles.rowInputs}>
                    <TextInput
                      style={[styles.textInput, { flex: 2 }]}
                      value={orgForm.city}
                      onChangeText={(v) => setOrgForm((f) => ({ ...f, city: v }))}
                      placeholder="City"
                      placeholderTextColor={Colors.light.textSecondary}
                    />
                    <TextInput
                      style={[styles.textInput, { flex: 1 }]}
                      value={orgForm.state}
                      onChangeText={(v) => setOrgForm((f) => ({ ...f, state: v }))}
                      placeholder="State"
                      placeholderTextColor={Colors.light.textSecondary}
                    />
                  </View>

                  <Text style={styles.fieldLabel}>Notes</Text>
                  <TextInput
                    style={[styles.textInput, styles.notesInput]}
                    value={orgForm.notes}
                    onChangeText={(v) => setOrgForm((f) => ({ ...f, notes: v }))}
                    placeholder="Initial notes…"
                    placeholderTextColor={Colors.light.textSecondary}
                    multiline
                    numberOfLines={2}
                  />

                  {/* Primary contact section */}
                  <View style={styles.sectionDivider}>
                    <View style={styles.sectionDividerLine} />
                    <Text style={styles.sectionDividerLabel}>Primary Contact (optional)</Text>
                    <View style={styles.sectionDividerLine} />
                  </View>

                  <View style={styles.rowInputs}>
                    <TextInput
                      style={[styles.textInput, { flex: 1 }]}
                      value={contactForm.firstName}
                      onChangeText={(v) => setContactForm((f) => ({ ...f, firstName: v }))}
                      placeholder="First name"
                      placeholderTextColor={Colors.light.textSecondary}
                    />
                    <TextInput
                      style={[styles.textInput, { flex: 1 }]}
                      value={contactForm.lastName}
                      onChangeText={(v) => setContactForm((f) => ({ ...f, lastName: v }))}
                      placeholder="Last name"
                      placeholderTextColor={Colors.light.textSecondary}
                    />
                  </View>
                  <View style={[styles.rowInputs, { marginTop: 8 }]}>
                    <TextInput
                      style={[styles.textInput, { flex: 1 }]}
                      value={contactForm.phone}
                      onChangeText={(v) => setContactForm((f) => ({ ...f, phone: v }))}
                      placeholder="Phone"
                      placeholderTextColor={Colors.light.textSecondary}
                      keyboardType="phone-pad"
                    />
                    <TextInput
                      style={[styles.textInput, { flex: 1 }]}
                      value={contactForm.email}
                      onChangeText={(v) => setContactForm((f) => ({ ...f, email: v }))}
                      placeholder="Email"
                      placeholderTextColor={Colors.light.textSecondary}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>

                  <View style={{ height: 16 }} />
                </ScrollView>
              )}

              {/* Step 2b: Person details */}
              {addStep === 'details' && addMode === 'person' && (
                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  <Text style={styles.fieldLabel}>Name *</Text>
                  <View style={styles.rowInputs}>
                    <TextInput
                      style={[styles.textInput, { flex: 1 }]}
                      value={contactForm.firstName}
                      onChangeText={(v) => setContactForm((f) => ({ ...f, firstName: v }))}
                      placeholder="First name"
                      placeholderTextColor={Colors.light.textSecondary}
                      autoFocus
                    />
                    <TextInput
                      style={[styles.textInput, { flex: 1 }]}
                      value={contactForm.lastName}
                      onChangeText={(v) => setContactForm((f) => ({ ...f, lastName: v }))}
                      placeholder="Last name"
                      placeholderTextColor={Colors.light.textSecondary}
                    />
                  </View>

                  <Text style={styles.fieldLabel}>Phone / Email</Text>
                  <View style={styles.rowInputs}>
                    <TextInput
                      style={[styles.textInput, { flex: 1 }]}
                      value={contactForm.phone}
                      onChangeText={(v) => setContactForm((f) => ({ ...f, phone: v }))}
                      placeholder="Phone"
                      placeholderTextColor={Colors.light.textSecondary}
                      keyboardType="phone-pad"
                    />
                    <TextInput
                      style={[styles.textInput, { flex: 1 }]}
                      value={contactForm.email}
                      onChangeText={(v) => setContactForm((f) => ({ ...f, email: v }))}
                      placeholder="Email"
                      placeholderTextColor={Colors.light.textSecondary}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>

                  <Text style={styles.fieldLabel}>Role / Title</Text>
                  <TextInput
                    style={styles.textInput}
                    value={contactForm.role}
                    onChangeText={(v) => setContactForm((f) => ({ ...f, role: v }))}
                    placeholder="e.g. Purchasing Manager, Coach…"
                    placeholderTextColor={Colors.light.textSecondary}
                  />

                  <View style={styles.sectionDivider}>
                    <View style={styles.sectionDividerLine} />
                    <Text style={styles.sectionDividerLabel}>Organization</Text>
                    <View style={styles.sectionDividerLine} />
                  </View>

                  {/* Org search / select */}
                  <TouchableOpacity
                    style={[styles.typePickerBtn, selectedOrg && { borderColor: Colors.light.tint }]}
                    onPress={() => { setShowOrgDropdown((v) => !v); }}
                  >
                    <Text style={selectedOrg ? styles.typePickerBtnText : styles.typePickerBtnPlaceholder} numberOfLines={1}>
                      {selectedOrg ? selectedOrg.name : orgSearch || 'Search or type org name…'}
                    </Text>
                    {selectedOrg ? (
                      <TouchableOpacity onPress={() => { setSelectedOrgId(null); setOrgSearch(''); }}>
                        <X size={15} color={Colors.light.textSecondary} />
                      </TouchableOpacity>
                    ) : (
                      <ChevronDown size={15} color={Colors.light.textSecondary} />
                    )}
                  </TouchableOpacity>

                  {showOrgDropdown && !selectedOrg && (
                    <View style={styles.typeDropdown}>
                      <View style={styles.orgSearchRow}>
                        <Search size={13} color={Colors.light.textSecondary} />
                        <TextInput
                          style={styles.orgSearchInput}
                          value={orgSearch}
                          onChangeText={setOrgSearch}
                          placeholder="Search existing orgs…"
                          placeholderTextColor={Colors.light.textSecondary}
                          autoFocus
                        />
                      </View>
                      {orgSearchResults.map((o) => (
                        <TouchableOpacity
                          key={o.id}
                          style={styles.typeDropdownItem}
                          onPress={() => { setSelectedOrgId(o.id); setOrgSearch(o.name); setShowOrgDropdown(false); }}
                        >
                          <Text style={styles.typeDropdownText}>{o.name}</Text>
                          {o.type ? <Text style={styles.orgDropdownType}>{o.type}</Text> : null}
                        </TouchableOpacity>
                      ))}
                      {orgSearch.trim() && !orgSearchResults.find((o) => o.name.toLowerCase() === orgSearch.toLowerCase()) && (
                        <TouchableOpacity
                          style={[styles.typeDropdownItem, styles.orgCreateNewItem]}
                          onPress={() => { setSelectedOrgId(null); setShowOrgDropdown(false); }}
                        >
                          <Plus size={13} color={Colors.light.tint} />
                          <Text style={styles.orgCreateNewText}>Create "{orgSearch.trim()}"</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}

                  {!selectedOrgId && (
                    <>
                      <Text style={styles.fieldLabel}>New Org Status</Text>
                      <View style={styles.statusRow}>
                        {(['Cold', 'Working', 'Active Client'] as CrmStatus[]).map((s) => {
                          const cfg = CRM_STATUS_CONFIG[s];
                          const selected = personOrgStatus === s;
                          return (
                            <TouchableOpacity
                              key={s}
                              style={[styles.statusOption, selected && { backgroundColor: cfg.bg, borderColor: cfg.border }]}
                              onPress={() => setPersonOrgStatus(s)}
                            >
                              <Text style={[styles.statusOptionText, selected && { color: cfg.color, fontWeight: '700' as const }]}>{s}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </>
                  )}

                  <View style={{ height: 16 }} />
                </ScrollView>
              )}

              {/* Save button */}
              {addStep === 'details' && (
                <TouchableOpacity
                  style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
                  onPress={handleSave}
                  disabled={!canSave}
                >
                  <Text style={styles.saveBtnText}>
                    {addMode === 'org' ? (hasContactInfo ? 'Save Org + Contact' : 'Save Organization') : (selectedOrgId ? 'Add to Organization' : 'Save Contact + Org')}
                  </Text>
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

  pageHeader: {
    backgroundColor: Colors.light.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    paddingTop: Platform.OS === 'web' ? 0 : 48,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  pageTitle: { fontSize: 24, fontWeight: '800' as const, color: Colors.light.text },
  pageSubtitle: { fontSize: 14, color: Colors.light.textSecondary },

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

  pillsScroll: { maxHeight: 46 },
  pillsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingBottom: 12 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1.5,
    borderColor: Colors.light.border, backgroundColor: Colors.light.background,
  },
  pillActive: { borderColor: Colors.light.tint, backgroundColor: '#FFF4EE' },
  pillText: { fontSize: 12, fontWeight: '500' as const, color: Colors.light.textSecondary },
  pillTextActive: { color: Colors.light.tint, fontWeight: '700' as const },
  pillCount: {
    backgroundColor: Colors.light.border, borderRadius: 10,
    minWidth: 17, height: 17, justifyContent: 'center',
    alignItems: 'center', paddingHorizontal: 3,
  },
  pillCountText: { fontSize: 10, fontWeight: '700' as const, color: Colors.light.textSecondary },

  searchRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingBottom: 12, alignItems: 'center' },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.light.background, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.light.border,
    paddingHorizontal: 12, paddingVertical: 9,
  },
  searchInput: { flex: 1, fontSize: 14, color: Colors.light.text, outlineStyle: 'none' as any },
  importBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderColor: Colors.light.tint,
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10,
  },
  importBtnText: { fontSize: 13, fontWeight: '600' as const, color: Colors.light.tint },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.light.tint, paddingHorizontal: 14,
    paddingVertical: 9, borderRadius: 10,
  },
  addBtnText: { fontSize: 14, fontWeight: '700' as const, color: '#fff' },

  tableHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: '#000000',
    borderTopWidth: 0,
  },
  thText: { fontSize: 11, fontWeight: '700' as const, color: '#FFFFFF', textTransform: 'uppercase' as const, letterSpacing: 0.4 },
  tableBody: { paddingBottom: 40 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: Colors.light.surface },
  tableDivider: { height: 1, backgroundColor: Colors.light.border, marginLeft: 16 },
  colAvatar: { width: 44 },
  colName: { flex: 2.5 },
  colContact: { flex: 2.5 },
  colCampaign: { flex: 1.2 },
  colStatus: { width: 120 },
  colArrow: { width: 28, alignItems: 'center' },

  tableOrgName: { fontSize: 14, fontWeight: '600' as const, color: Colors.light.text },
  tableOrgType: { fontSize: 11, color: Colors.light.textSecondary, marginTop: 1 },
  tableSecondary: { fontSize: 13, color: Colors.light.textSecondary },
  tableContactSub: { fontSize: 11, color: Colors.light.textSecondary, marginTop: 1 },
  colContactNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  extraPrimariesBadge: {
    backgroundColor: Colors.light.highlightBg, borderRadius: 8,
    paddingHorizontal: 5, paddingVertical: 1,
  },
  extraPrimariesText: { fontSize: 10, fontWeight: '700' as const, color: Colors.light.tint },
  tableSecondaryDim: { fontSize: 13, color: Colors.light.border },
  tableCampaignActive: { fontSize: 12, color: Colors.light.tint, fontWeight: '500' as const },

  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 12, borderWidth: 1,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' as const },

  list: { flex: 1 },
  listContent: { padding: 16, gap: 10 },

  orgCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 14, borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 14,
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
  },
  orgCardLead: {
    borderLeftWidth: 3,
    borderLeftColor: '#BFDBFE',
  },
  orgCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  orgCardInfo: { flex: 1 },
  orgCardNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  orgCardName: { fontSize: 15, fontWeight: '700' as const, color: Colors.light.text },
  orgCardType: { fontSize: 12, color: Colors.light.textSecondary, marginTop: 2 },
  orgCardContactRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  orgCardContact: { fontSize: 12, color: Colors.light.textSecondary },
  orgCardContactSub: { fontSize: 11, color: Colors.light.textSecondary, marginTop: 1 },
  orgCardCampaignRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  orgCardCampaignText: { fontSize: 11, color: Colors.light.tint, fontWeight: '500' as const },
  orgCardMeta: { alignItems: 'flex-end', gap: 6 },
  orgCardContactCount: { fontSize: 11, color: Colors.light.textSecondary },

  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10, padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700' as const, color: Colors.light.text },
  emptyText: { fontSize: 14, color: Colors.light.textSecondary, textAlign: 'center' },
  emptyAddBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 8, backgroundColor: Colors.light.tint,
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10,
  },
  emptyAddBtnText: { color: '#fff', fontWeight: '700' as const, fontSize: 14 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalKAV: { width: '100%', maxWidth: 520, paddingHorizontal: 16 },
  modalCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 18, padding: 20,
    maxHeight: '90%' as any,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 18,
  },
  modalHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backIconBtn: { padding: 2 },
  modalTitle: { fontSize: 18, fontWeight: '800' as const, color: Colors.light.text },

  chooseStep: { gap: 12, marginBottom: 8 },
  chooseLabel: { fontSize: 14, color: Colors.light.textSecondary, marginBottom: 4 },
  chooseOption: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 14, borderRadius: 14, borderWidth: 2,
    borderColor: Colors.light.border, backgroundColor: Colors.light.background,
  },
  chooseOptionActive: { borderColor: Colors.light.tint, backgroundColor: '#FFF4EE' },
  chooseIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.light.border,
    justifyContent: 'center', alignItems: 'center',
  },
  chooseIconActive: { backgroundColor: Colors.light.tint },
  chooseIconActivePerson: { backgroundColor: '#7C3AED' },
  chooseText: { flex: 1 },
  chooseOptionTitle: { fontSize: 15, fontWeight: '700' as const, color: Colors.light.text },
  chooseOptionSub: { fontSize: 12, color: Colors.light.textSecondary, marginTop: 2 },
  chooseRadio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: Colors.light.border,
    justifyContent: 'center', alignItems: 'center',
  },
  chooseRadioActive: { borderColor: Colors.light.tint, backgroundColor: Colors.light.tint },
  continueBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Colors.light.tint, borderRadius: 12,
    paddingVertical: 14, marginTop: 4,
  },
  continueBtnText: { color: '#fff', fontWeight: '700' as const, fontSize: 15 },

  fieldLabel: {
    fontSize: 12, fontWeight: '700' as const, color: Colors.light.textSecondary,
    textTransform: 'uppercase' as const, letterSpacing: 0.4,
    marginTop: 14, marginBottom: 6,
  },
  textInput: {
    backgroundColor: Colors.light.background, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.light.border,
    paddingHorizontal: 13, paddingVertical: 10,
    fontSize: 15, color: Colors.light.text,
  },
  notesInput: { minHeight: 60, textAlignVertical: 'top' as const },
  rowInputs: { flexDirection: 'row', gap: 10 },

  typePickerBtn: {
    backgroundColor: Colors.light.background, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.light.border,
    paddingHorizontal: 13, paddingVertical: 10,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  typePickerBtnText: { fontSize: 15, color: Colors.light.text, flex: 1 },
  typePickerBtnPlaceholder: { fontSize: 15, color: Colors.light.textSecondary, flex: 1 },
  typeDropdown: {
    backgroundColor: Colors.light.surface,
    borderRadius: 10, borderWidth: 1, borderColor: Colors.light.border,
    marginTop: 4, overflow: 'hidden', maxHeight: 240,
  },
  typeDropdownItem: {
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.light.border,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  typeDropdownText: { fontSize: 14, color: Colors.light.text },
  typeDropdownTextActive: { color: Colors.light.tint, fontWeight: '700' as const },

  orgSearchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.light.border,
  },
  orgSearchInput: { flex: 1, fontSize: 14, color: Colors.light.text, outlineStyle: 'none' as any },
  orgDropdownType: { fontSize: 11, color: Colors.light.textSecondary },
  orgCreateNewItem: { backgroundColor: '#FFF4EE', borderBottomWidth: 0 },
  orgCreateNewText: { fontSize: 14, color: Colors.light.tint, fontWeight: '600' as const },

  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  statusOption: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 8, borderWidth: 1.5, borderColor: Colors.light.border,
    backgroundColor: Colors.light.background,
  },
  statusOptionText: { fontSize: 13, color: Colors.light.textSecondary, fontWeight: '500' as const },

  sectionDivider: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginTop: 18, marginBottom: 4,
  },
  sectionDividerLine: { flex: 1, height: 1, backgroundColor: Colors.light.border },
  sectionDividerLabel: { fontSize: 11, fontWeight: '700' as const, color: Colors.light.textSecondary, textTransform: 'uppercase' as const, letterSpacing: 0.5 },

  colHub: { width: 115, justifyContent: 'center' as const },
  hubBadgeActive: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4,
    backgroundColor: '#FFF4EE', borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 3,
    alignSelf: 'flex-start' as const,
    borderWidth: 1, borderColor: '#FF5A0030',
  },
  hubBadgeInactive: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4,
    backgroundColor: Colors.light.background, borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 3,
    alignSelf: 'flex-start' as const,
    borderWidth: 1, borderColor: Colors.light.border,
  },
  hubBadgeTextActive: { fontSize: 11, color: Colors.light.tint, fontWeight: '600' as const },
  hubBadgeTextInactive: { fontSize: 11, color: Colors.light.textSecondary },

  sortBtn: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4,
  },
  sortBtnText: {
    fontSize: 11, fontWeight: '700' as const, color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase' as const, letterSpacing: 0.4,
  },
  sortBtnTextActive: { color: Colors.light.tint },

  mobileSortScroll: { flexShrink: 0 },
  mobileSortRow: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  mobileSortLabel: { fontSize: 12, color: Colors.light.textSecondary, fontWeight: '600' as const, marginRight: 2 },
  mobileSortBtn: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
    borderWidth: 1, borderColor: Colors.light.border,
    backgroundColor: Colors.light.surface,
  },
  mobileSortBtnActive: { borderColor: Colors.light.tint, backgroundColor: '#FFF4EE' },
  mobileSortBtnText: { fontSize: 12, color: Colors.light.textSecondary },
  mobileSortBtnTextActive: { color: Colors.light.tint, fontWeight: '700' as const },

  saveBtn: {
    backgroundColor: Colors.light.tint,
    paddingVertical: 14, borderRadius: 12,
    alignItems: 'center', marginTop: 16,
  },
  saveBtnDisabled: { opacity: 0.45 },
  saveBtnText: { fontSize: 15, fontWeight: '700' as const, color: '#fff' },
});
