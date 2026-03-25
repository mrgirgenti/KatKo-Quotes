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
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useCrm } from '@/contexts/CrmContext';
import { Organization, CrmStatus, CRM_STATUS_CONFIG, ORG_TYPES } from '@/types/crm';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { ContactImportModal } from '@/components/ContactImportModal';

const FILTER_TABS: (CrmStatus | 'All')[] = ['All', 'Cold', 'Working', 'Active Client', 'Past Client'];

const EMPTY_ORG_FORM = {
  name: '',
  type: '',
  address: '',
  city: '',
  state: '',
  website: '',
  notes: '',
  status: 'Cold' as CrmStatus,
  isNewLead: true,
};

type OrgForm = typeof EMPTY_ORG_FORM;

function StatusBadge({ status }: { status: CrmStatus }) {
  const cfg = CRM_STATUS_CONFIG[status];
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
      <View style={[styles.badgeDot, { backgroundColor: cfg.dot }]} />
      <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

function OrgAvatar({ org, size = 40 }: { org: Organization; size?: number }) {
  const initial = org.name.charAt(0).toUpperCase();
  const isActive = org.status === 'Active Client';
  return (
    <View style={[
      styles.avatar,
      { width: size, height: size, borderRadius: size / 2 },
      isActive && styles.avatarActive,
    ]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.38 }, isActive && styles.avatarTextActive]}>
        {initial}
      </Text>
    </View>
  );
}

interface OrgRowProps {
  org: Organization;
  onPress: () => void;
}

function OrgRow({ org, onPress }: OrgRowProps) {
  const primaryContact = org.contacts.find((c) => c.isPrimary) || org.contacts[0];
  const lastActivity = org.activityLog[0];
  const activeCampaign = org.campaigns.find((c) => c.steps.some((s) => s.status === 'pending'));

  return (
    <TouchableOpacity style={styles.tableRow} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.colAvatar}>
        <OrgAvatar org={org} size={36} />
      </View>
      <View style={styles.colName}>
        <Text style={styles.tableOrgName} numberOfLines={1}>{org.name}</Text>
        {org.type ? <Text style={styles.tableOrgType} numberOfLines={1}>{org.type}</Text> : null}
      </View>
      <View style={styles.colContact}>
        {primaryContact ? (
          <Text style={styles.tableSecondary} numberOfLines={1}>
            {primaryContact.firstName} {primaryContact.lastName}
          </Text>
        ) : (
          <Text style={styles.tableSecondaryDim}>No contacts</Text>
        )}
      </View>
      <View style={styles.colCount}>
        <Text style={styles.tableSecondary}>{org.contacts.length}</Text>
      </View>
      <View style={styles.colCampaign}>
        {activeCampaign ? (
          <Text style={styles.tableCampaignActive} numberOfLines={1}>{activeCampaign.templateName}</Text>
        ) : (
          <Text style={styles.tableSecondaryDim}>—</Text>
        )}
      </View>
      <View style={styles.colActivity}>
        {lastActivity ? (
          <Text style={styles.tableSecondary} numberOfLines={1}>
            {new Date(lastActivity.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </Text>
        ) : (
          <Text style={styles.tableSecondaryDim}>No activity</Text>
        )}
      </View>
      <View style={styles.colStatus}>
        <StatusBadge status={org.status} />
      </View>
      <View style={styles.colArrow}>
        <ChevronRight size={16} color={Colors.light.border} />
      </View>
    </TouchableOpacity>
  );
}

function OrgCard({ org, onPress }: OrgRowProps) {
  const primaryContact = org.contacts.find((c) => c.isPrimary) || org.contacts[0];
  const activeCampaign = org.campaigns.find((c) => c.steps.some((s) => s.status === 'pending'));
  const isLead = org.status === 'Cold' || org.status === 'Working';

  return (
    <TouchableOpacity
      style={[styles.orgCard, isLead && styles.orgCardLead]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.orgCardLeft}>
        <OrgAvatar org={org} size={46} />
        <View style={styles.orgCardInfo}>
          <View style={styles.orgCardNameRow}>
            <Text style={styles.orgCardName} numberOfLines={1}>{org.name}</Text>
            <StatusBadge status={org.status} />
          </View>
          {org.type ? <Text style={styles.orgCardType}>{org.type}</Text> : null}
          {primaryContact ? (
            <Text style={styles.orgCardContact}>
              {primaryContact.firstName} {primaryContact.lastName}
              {primaryContact.phone ? ` · ${primaryContact.phone}` : ''}
            </Text>
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
  const { orgs, addOrg } = useCrm();
  const { isDesktop } = useBreakpoint();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<CrmStatus | 'All'>('All');
  const [modalVisible, setModalVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [form, setForm] = useState<OrgForm>(EMPTY_ORG_FORM);
  const [step, setStep] = useState<'type-select' | 'details'>('type-select');
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);

  const filtered = useMemo(() => {
    return orgs.filter((o) => {
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
  }, [orgs, filter, search]);

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
  }), [orgs]);

  const openAddModal = useCallback(() => {
    setForm(EMPTY_ORG_FORM);
    setStep('type-select');
    setModalVisible(true);
  }, []);

  const handleSave = useCallback(() => {
    if (!form.name.trim()) return;
    addOrg({
      name: form.name.trim(),
      type: form.type || undefined,
      address: form.address || undefined,
      city: form.city || undefined,
      state: form.state || undefined,
      website: form.website || undefined,
      notes: form.notes || undefined,
      status: form.status,
    });
    setModalVisible(false);
  }, [form, addOrg]);

  const filterIcon = (tab: CrmStatus | 'All') => {
    if (tab === 'All') return <Users size={12} color={filter === tab ? Colors.light.tint : Colors.light.textSecondary} />;
    if (tab === 'Cold') return <Thermometer size={12} color={filter === tab ? CRM_STATUS_CONFIG['Cold'].color : Colors.light.textSecondary} />;
    if (tab === 'Working') return <TrendingUp size={12} color={filter === tab ? CRM_STATUS_CONFIG['Working'].color : Colors.light.textSecondary} />;
    if (tab === 'Active Client') return <Star size={12} color={filter === tab ? '#FF5A00' : Colors.light.textSecondary} />;
    if (tab === 'Past Client') return <Archive size={12} color={filter === tab ? CRM_STATUS_CONFIG['Past Client'].color : Colors.light.textSecondary} />;
    return null;
  };

  return (
    <View style={styles.container}>
      <View style={styles.pageHeader}>
        <View style={styles.headerTop}>
          <Text style={styles.pageTitle}>Contacts</Text>
          <Text style={styles.pageSubtitle}>{orgs.length} organization{orgs.length !== 1 ? 's' : ''}</Text>
        </View>

        {/* Stats bar */}
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

        {/* Filter pills */}
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

        {/* Search + Add */}
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

        {/* Desktop table header */}
        {isDesktop && (
          <View style={styles.tableHeader}>
            <View style={styles.colAvatar} />
            <View style={styles.colName}><Text style={styles.thText}>Organization</Text></View>
            <View style={styles.colContact}><Text style={styles.thText}>Primary Contact</Text></View>
            <View style={styles.colCount}><Text style={styles.thText}>#</Text></View>
            <View style={styles.colCampaign}><Text style={styles.thText}>Campaign</Text></View>
            <View style={styles.colActivity}><Text style={styles.thText}>Last Activity</Text></View>
            <View style={styles.colStatus}><Text style={styles.thText}>Status</Text></View>
            <View style={styles.colArrow} />
          </View>
        )}
      </View>

      {/* List */}
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
            <Pressable style={styles.modalCard} onPress={() => {}}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {step === 'type-select' ? 'New Contact' : 'Add Details'}
                </Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <X size={22} color={Colors.light.textSecondary} />
                </TouchableOpacity>
              </View>

              {step === 'type-select' ? (
                <View style={styles.typeSelectStep}>
                  <Text style={styles.typeSelectLabel}>What kind of contact is this?</Text>
                  <TouchableOpacity
                    style={[styles.typeSelectOption, !form.isNewLead && styles.typeSelectOptionActive]}
                    onPress={() => setForm((f) => ({ ...f, isNewLead: false, status: 'Active Client' }))}
                  >
                    <View style={styles.typeSelectIcon}>
                      <Star size={22} color={form.isNewLead ? Colors.light.textSecondary : '#FF5A00'} />
                    </View>
                    <View style={styles.typeSelectText}>
                      <Text style={styles.typeSelectOptionTitle}>Active Client</Text>
                      <Text style={styles.typeSelectOptionSub}>Someone I already do business with</Text>
                    </View>
                    <View style={[styles.typeSelectRadio, !form.isNewLead && styles.typeSelectRadioActive]} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.typeSelectOption, form.isNewLead && styles.typeSelectOptionActive]}
                    onPress={() => setForm((f) => ({ ...f, isNewLead: true, status: 'Cold' }))}
                  >
                    <View style={styles.typeSelectIcon}>
                      <Thermometer size={22} color={form.isNewLead ? Colors.light.tint : Colors.light.textSecondary} />
                    </View>
                    <View style={styles.typeSelectText}>
                      <Text style={styles.typeSelectOptionTitle}>New Lead</Text>
                      <Text style={styles.typeSelectOptionSub}>Someone I'm prospecting or working</Text>
                    </View>
                    <View style={[styles.typeSelectRadio, form.isNewLead && styles.typeSelectRadioActive]} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.typeSelectNextBtn}
                    onPress={() => setStep('details')}
                  >
                    <Text style={styles.typeSelectNextBtnText}>Continue</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false}>
                  {/* Status selector */}
                  <Text style={styles.fieldLabel}>Status</Text>
                  <View style={styles.statusRow}>
                    {(['Cold', 'Working', 'Active Client', 'Past Client'] as CrmStatus[]).map((s) => {
                      const cfg = CRM_STATUS_CONFIG[s];
                      const selected = form.status === s;
                      return (
                        <TouchableOpacity
                          key={s}
                          style={[styles.statusOption, selected && { backgroundColor: cfg.bg, borderColor: cfg.border }]}
                          onPress={() => setForm((f) => ({ ...f, status: s }))}
                        >
                          <Text style={[styles.statusOptionText, selected && { color: cfg.color, fontWeight: '700' as const }]}>{s}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <Text style={styles.fieldLabel}>Organization / Name *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={form.name}
                    onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
                    placeholder="Church name, school, company…"
                    placeholderTextColor={Colors.light.textSecondary}
                    autoFocus
                  />

                  <Text style={styles.fieldLabel}>Type</Text>
                  <TouchableOpacity
                    style={styles.typePickerBtn}
                    onPress={() => setShowTypeDropdown((v) => !v)}
                  >
                    <Text style={form.type ? styles.typePickerBtnText : styles.typePickerBtnPlaceholder}>
                      {form.type || 'Select type…'}
                    </Text>
                  </TouchableOpacity>
                  {showTypeDropdown && (
                    <View style={styles.typeDropdown}>
                      {ORG_TYPES.map((t) => (
                        <TouchableOpacity
                          key={t}
                          style={styles.typeDropdownItem}
                          onPress={() => { setForm((f) => ({ ...f, type: t })); setShowTypeDropdown(false); }}
                        >
                          <Text style={[styles.typeDropdownText, form.type === t && styles.typeDropdownTextActive]}>{t}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  <Text style={styles.fieldLabel}>City / State</Text>
                  <View style={styles.rowInputs}>
                    <TextInput
                      style={[styles.textInput, { flex: 2 }]}
                      value={form.city}
                      onChangeText={(v) => setForm((f) => ({ ...f, city: v }))}
                      placeholder="City"
                      placeholderTextColor={Colors.light.textSecondary}
                    />
                    <TextInput
                      style={[styles.textInput, { flex: 1 }]}
                      value={form.state}
                      onChangeText={(v) => setForm((f) => ({ ...f, state: v }))}
                      placeholder="State"
                      placeholderTextColor={Colors.light.textSecondary}
                    />
                  </View>

                  <Text style={styles.fieldLabel}>Notes</Text>
                  <TextInput
                    style={[styles.textInput, styles.notesInput]}
                    value={form.notes}
                    onChangeText={(v) => setForm((f) => ({ ...f, notes: v }))}
                    placeholder="Any initial notes…"
                    placeholderTextColor={Colors.light.textSecondary}
                    multiline
                    numberOfLines={3}
                  />
                </ScrollView>
              )}

              {step === 'details' && (
                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.backBtn} onPress={() => setStep('type-select')}>
                    <Text style={styles.backBtnText}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.saveBtn, !form.name.trim() && styles.saveBtnDisabled]}
                    onPress={handleSave}
                    disabled={!form.name.trim()}
                  >
                    <Text style={styles.saveBtnText}>Add Contact</Text>
                  </TouchableOpacity>
                </View>
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
    backgroundColor: Colors.light.background,
    borderTopWidth: 1, borderTopColor: Colors.light.border,
  },
  thText: { fontSize: 11, fontWeight: '700' as const, color: Colors.light.textSecondary, textTransform: 'uppercase' as const, letterSpacing: 0.4 },
  tableBody: { paddingBottom: 40 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: Colors.light.surface },
  tableDivider: { height: 1, backgroundColor: Colors.light.border, marginLeft: 16 },
  colAvatar: { width: 44 },
  colName: { flex: 2.5 },
  colContact: { flex: 2 },
  colCount: { width: 60, alignItems: 'center' },
  colCampaign: { flex: 2 },
  colActivity: { width: 90 },
  colStatus: { width: 110 },
  colArrow: { width: 28, alignItems: 'center' },

  tableOrgName: { fontSize: 14, fontWeight: '600' as const, color: Colors.light.text },
  tableOrgType: { fontSize: 11, color: Colors.light.textSecondary, marginTop: 1 },
  tableSecondary: { fontSize: 13, color: Colors.light.textSecondary },
  tableSecondaryDim: { fontSize: 13, color: Colors.light.border },
  tableCampaignActive: { fontSize: 12, color: Colors.light.tint, fontWeight: '500' as const },

  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 12, borderWidth: 1,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' as const },

  avatar: {
    backgroundColor: Colors.light.border,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarActive: { backgroundColor: Colors.light.tint },
  avatarText: { fontWeight: '800' as const, color: Colors.light.textSecondary },
  avatarTextActive: { color: '#fff' },

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
  orgCardContact: { fontSize: 12, color: Colors.light.textSecondary, marginTop: 3 },
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
  modalTitle: { fontSize: 18, fontWeight: '800' as const, color: Colors.light.text },

  typeSelectStep: { gap: 12, marginBottom: 8 },
  typeSelectLabel: { fontSize: 15, color: Colors.light.textSecondary, marginBottom: 4 },
  typeSelectOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 12, borderWidth: 2,
    borderColor: Colors.light.border, backgroundColor: Colors.light.background,
  },
  typeSelectOptionActive: { borderColor: Colors.light.tint, backgroundColor: '#FFF4EE' },
  typeSelectIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.light.surface, justifyContent: 'center', alignItems: 'center' },
  typeSelectText: { flex: 1 },
  typeSelectOptionTitle: { fontSize: 15, fontWeight: '700' as const, color: Colors.light.text },
  typeSelectOptionSub: { fontSize: 12, color: Colors.light.textSecondary, marginTop: 2 },
  typeSelectRadio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: Colors.light.border, backgroundColor: 'transparent',
  },
  typeSelectRadioActive: { borderColor: Colors.light.tint, backgroundColor: Colors.light.tint },
  typeSelectNextBtn: {
    backgroundColor: Colors.light.tint, borderRadius: 10,
    paddingVertical: 13, alignItems: 'center', marginTop: 4,
  },
  typeSelectNextBtnText: { color: '#fff', fontWeight: '700' as const, fontSize: 15 },

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
  notesInput: { minHeight: 80, textAlignVertical: 'top' as const },
  rowInputs: { flexDirection: 'row', gap: 10 },

  typePickerBtn: {
    backgroundColor: Colors.light.background, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.light.border,
    paddingHorizontal: 13, paddingVertical: 10,
  },
  typePickerBtnText: { fontSize: 15, color: Colors.light.text },
  typePickerBtnPlaceholder: { fontSize: 15, color: Colors.light.textSecondary },
  typeDropdown: {
    backgroundColor: Colors.light.surface,
    borderRadius: 10, borderWidth: 1, borderColor: Colors.light.border,
    marginTop: 4, overflow: 'hidden',
  },
  typeDropdownItem: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.light.border },
  typeDropdownText: { fontSize: 14, color: Colors.light.text },
  typeDropdownTextActive: { color: Colors.light.tint, fontWeight: '700' as const },

  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  statusOption: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 8, borderWidth: 1.5, borderColor: Colors.light.border,
    backgroundColor: Colors.light.background,
  },
  statusOptionText: { fontSize: 13, color: Colors.light.textSecondary, fontWeight: '500' as const },

  modalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  backBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 10,
    borderWidth: 1.5, borderColor: Colors.light.border,
    alignItems: 'center',
  },
  backBtnText: { fontSize: 15, fontWeight: '600' as const, color: Colors.light.textSecondary },
  saveBtn: {
    flex: 2, backgroundColor: Colors.light.tint,
    paddingVertical: 13, borderRadius: 10, alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { fontSize: 15, fontWeight: '700' as const, color: '#fff' },
});
