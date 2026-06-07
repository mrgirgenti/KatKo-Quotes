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
  Copy,
  Settings,
  ExternalLink,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  ArrowUpDown,
  Check,
  X,
  Trash2,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useCrm } from '@/contexts/CrmContext';
import { Organization, Contact } from '@/types/crm';
import { OrgAvatar } from '@/components/OrgAvatar';
import { metricValueStyle, metricLabelStyle } from '@/components/Metric';
import { useBreakpoint } from '@/hooks/useBreakpoint';

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

type HubSortField = 'name' | 'type' | 'contact' | 'status';
const CHECKBOX_W = 36;

// ── Desktop/tablet table row ──
function HubRow({ org, onPress, onOpenHub, onCopyLink, copied, onToggle, enabling, hideContact, isSelected, onToggleSelect }: {
  org: Organization;
  onPress: () => void;
  onOpenHub: () => void;
  onCopyLink: () => void;
  copied: boolean;
  onToggle: () => void;
  enabling: boolean;
  hideContact?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}) {
  const primaryContact = getPrimaryContact(org);
  const contactName = primaryContact
    ? `${primaryContact.firstName} ${primaryContact.lastName}`.trim()
    : null;
  const contactEmail = primaryContact?.email || null;
  const statusStyle = getStatusStyle(org.status);
  const hasLogo = !!org.logoUrl;

  return (
    <TouchableOpacity style={[styles.tableRow, !org.hubEnabled && styles.tableRowOff, isSelected && styles.tableRowSelected]} onPress={onPress} activeOpacity={0.7}>
      <TouchableOpacity style={styles.colCheckbox} onPress={(e) => { e.stopPropagation?.(); onToggleSelect?.(); }} activeOpacity={0.7}>
        <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
          {isSelected && <Check size={11} color="#fff" />}
        </View>
      </TouchableOpacity>
      <View style={styles.colAvatar}>
        <OrgAvatar name={org.name} logoUrl={org.logoUrl} size={36} shape="circle" />
      </View>
      <View style={styles.colOrg}>
        <Text style={styles.tableOrgName} numberOfLines={1}>{org.name}</Text>
        {!hasLogo && (
          <View style={styles.noLogoTag}>
            <AlertCircle size={9} color="#D97706" />
            <Text style={styles.noLogoTagText}>No logo</Text>
          </View>
        )}
      </View>
      <View style={styles.colBizType}>
        {org.type
          ? <Text style={styles.tableOrgType} numberOfLines={1}>{org.type}</Text>
          : <Text style={styles.tableDim}>—</Text>}
      </View>
      {!hideContact && (
        <View style={styles.colContactName}>
          {contactName
            ? <Text style={styles.tableContact} numberOfLines={1}>{contactName}</Text>
            : <Text style={styles.tableDim}>No contact</Text>}
        </View>
      )}
      {!hideContact && (
        <View style={styles.colEmail}>
          {contactEmail
            ? <Text style={styles.tableContactSub} numberOfLines={1}>{contactEmail}</Text>
            : <Text style={styles.tableDim}>—</Text>}
        </View>
      )}
      <View style={styles.colStatus}>
        <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
          <View style={[styles.statusDot, { backgroundColor: statusStyle.dot }]} />
          <Text style={[styles.statusBadgeText, { color: statusStyle.text }]}>{org.status}</Text>
        </View>
        <TouchableOpacity onPress={(e) => { e.stopPropagation?.(); onToggle(); }} activeOpacity={0.7}>
          {enabling
            ? <ActivityIndicator size="small" color={Colors.light.tint} style={{ width: 22 }} />
            : org.hubEnabled
              ? <ToggleRight size={22} color="#FF5A00" />
              : <ToggleLeft size={22} color="#9CA3AF" />}
        </TouchableOpacity>
      </View>
      <View style={styles.colActions}>
        {org.hubEnabled ? (
          <>
            <TouchableOpacity style={styles.actionPrimary} onPress={onOpenHub} activeOpacity={0.8}>
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
          </>
        ) : (
          <Text style={styles.tableDim}>Hub Off</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ── Mobile card ──
function HubCard({ org, onPress, onOpenHub, onCopyLink, copied, onToggle, enabling }: {
  org: Organization;
  onPress: () => void;
  onOpenHub: () => void;
  onCopyLink: () => void;
  copied: boolean;
  onToggle: () => void;
  enabling: boolean;
}) {
  const primaryContact = getPrimaryContact(org);
  const contactName = primaryContact
    ? `${primaryContact.firstName} ${primaryContact.lastName}`.trim()
    : null;
  const contactEmail = primaryContact?.email || null;
  const statusStyle = getStatusStyle(org.status);
  const hasLogo = !!org.logoUrl;

  return (
    <TouchableOpacity style={[styles.card, !org.hubEnabled && styles.cardOff]} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardTop}>
        <OrgAvatar name={org.name} logoUrl={org.logoUrl} size={42} shape="circle" />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.cardOrgName} numberOfLines={1}>{org.name}</Text>
          {org.type ? <Text style={styles.tableOrgType} numberOfLines={1}>{org.type}</Text> : null}
          {!hasLogo && (
            <View style={styles.noLogoTag}>
              <AlertCircle size={9} color="#D97706" />
              <Text style={styles.noLogoTagText}>No logo</Text>
            </View>
          )}
        </View>
        <View style={{ gap: 6, alignItems: 'flex-end' }}>
          <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: statusStyle.dot }]} />
            <Text style={[styles.statusBadgeText, { color: statusStyle.text }]}>{org.status}</Text>
          </View>
          <TouchableOpacity onPress={(e) => { e.stopPropagation?.(); onToggle(); }} activeOpacity={0.7}>
            {enabling
              ? <ActivityIndicator size="small" color={Colors.light.tint} />
              : org.hubEnabled
                ? <ToggleRight size={24} color="#FF5A00" />
                : <ToggleLeft size={24} color="#9CA3AF" />}
          </TouchableOpacity>
        </View>
      </View>
      {contactName && (
        <Text style={styles.cardContactLine} numberOfLines={1}>
          {contactName}{contactEmail ? ` · ${contactEmail}` : ''}
        </Text>
      )}
      {org.hubEnabled && (
        <View style={styles.cardActions}>
          <TouchableOpacity style={[styles.actionPrimary, { flex: 1 }]} onPress={onOpenHub} activeOpacity={0.8}>
            <ExternalLink size={12} color="#fff" />
            <Text style={styles.actionPrimaryText}>Open Hub</Text>
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
      )}
    </TouchableOpacity>
  );
}

// ── Desktop/tablet "add" row ──
function AddOrgRow({
  org,
  onEnable,
  enabling,
  hideContact,
}: {
  org: Organization;
  onEnable: () => void;
  enabling: boolean;
  hideContact?: boolean;
}) {
  const primaryContact = getPrimaryContact(org);
  const contactName = primaryContact
    ? `${primaryContact.firstName} ${primaryContact.lastName}`.trim()
    : null;

  const contactEmail = primaryContact?.email || null;

  return (
    <TouchableOpacity style={styles.tableRow} onPress={onEnable} activeOpacity={0.7}>
      <View style={styles.colCheckbox} />
      <View style={styles.colAvatar}>
        <OrgAvatar name={org.name} logoUrl={org.logoUrl} size={36} shape="circle" />
      </View>
      <View style={styles.colOrg}>
        <Text style={styles.tableOrgName} numberOfLines={1}>{org.name}</Text>
      </View>
      <View style={styles.colBizType}>
        {org.type
          ? <Text style={styles.tableOrgType} numberOfLines={1}>{org.type}</Text>
          : <Text style={styles.tableDim}>—</Text>}
      </View>
      {!hideContact && (
        <View style={styles.colContactName}>
          {contactName
            ? <Text style={styles.tableContact} numberOfLines={1}>{contactName}</Text>
            : <Text style={styles.tableDim}>No contact</Text>}
        </View>
      )}
      {!hideContact && (
        <View style={styles.colEmail}>
          {contactEmail
            ? <Text style={styles.tableContactSub} numberOfLines={1}>{contactEmail}</Text>
            : <Text style={styles.tableDim}>—</Text>}
        </View>
      )}
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

// ── Mobile "add" card ──
function AddOrgCard({
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
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <OrgAvatar name={org.name} logoUrl={org.logoUrl} size={42} shape="circle" />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.cardOrgName} numberOfLines={1}>{org.name}</Text>
          {org.type ? <Text style={styles.tableOrgType} numberOfLines={1}>{org.type}</Text> : null}
          {contactName && <Text style={styles.tableContact} numberOfLines={1}>{contactName}</Text>}
        </View>
        <Text style={styles.tableDim}>Hub off</Text>
      </View>
      <View style={styles.cardActions}>
        {enabling ? (
          <ActivityIndicator size="small" color={Colors.light.tint} />
        ) : (
          <TouchableOpacity style={[styles.enableBtn, { flex: 1 }]} onPress={onEnable} activeOpacity={0.75}>
            <Plus size={12} color="#fff" />
            <Text style={styles.enableBtnText}>Enable Hub</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export default function ClientHubsScreen() {
  const router = useRouter();
  const { orgs, isLoading, updateOrgHubEnabled } = useCrm();
  const { isMobile, isTablet } = useBreakpoint();
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [togglingOrgId, setTogglingOrgId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [sortField, setSortField] = useState<HubSortField>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectionMode = selectedIds.size > 0;

  const q = search.toLowerCase().trim();

  const allHubs = useMemo(() => {
    const list = orgs.filter((o) => (showAll || o.hubEnabled) && (!q || o.name.toLowerCase().includes(q)));
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortField === 'type') cmp = (a.type || '').localeCompare(b.type || '');
      else if (sortField === 'contact') {
        const ca = a.contacts.find(c => c.isPrimary) || a.contacts[0];
        const cb = b.contacts.find(c => c.isPrimary) || b.contacts[0];
        cmp = (`${ca?.lastName}${ca?.firstName}` || '').localeCompare(`${cb?.lastName}${cb?.firstName}` || '');
      } else if (sortField === 'status') {
        cmp = a.status.localeCompare(b.status);
      }
      const sorted = sortDir === 'asc' ? cmp : -cmp;
      if (sorted !== 0) return sorted;
      return a.hubEnabled !== b.hubEnabled ? (a.hubEnabled ? -1 : 1) : 0;
    });
  }, [orgs, q, showAll, sortField, sortDir]);

  const noLogoCount = useMemo(() => orgs.filter((o) => o.hubEnabled && !o.logoUrl).length, [orgs]);

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
        if (newEnabled) {
          router.push(`/crm/${org.id}` as any);
        }
      }, 500);
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

  const toggleSort = useCallback((field: HubSortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  }, [sortField]);
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);
  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);
  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === allHubs.length && allHubs.length > 0) clearSelection();
    else setSelectedIds(new Set(allHubs.map(o => o.id)));
  }, [allHubs, selectedIds, clearSelection]);

  const SortBtn = ({ field, label }: { field: HubSortField; label: string }) => (
    <TouchableOpacity style={styles.sortBtn} onPress={() => toggleSort(field)}>
      <Text style={[styles.sortBtnText, sortField === field && styles.sortBtnTextActive]}>{label}</Text>
      <ArrowUpDown size={11} color={sortField === field ? Colors.light.tint : 'rgba(255,255,255,0.35)'} />
    </TouchableOpacity>
  );

  const useCardLayout = isMobile;
  const hideContact = isTablet;

  return (
    <View style={styles.container}>
      {/* ── Page header ── */}
      <View style={styles.pageHeader}>
        <View style={styles.headerTop}>
          <Text style={styles.pageTitle}>Client Hubs</Text>
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
          <TouchableOpacity
            style={[styles.showAllBtn, showAll && styles.showAllBtnActive]}
            onPress={() => setShowAll((v) => !v)}
          >
            <Text style={[styles.showAllBtnText, showAll && styles.showAllBtnTextActive]}>
              {showAll ? 'Active Only' : 'Show All'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Bulk action bar ── */}
      {selectionMode && !useCardLayout && (
        <View style={styles.bulkBar}>
          <View style={styles.bulkBarLeft}>
            <TouchableOpacity style={styles.bulkClearBtn} onPress={clearSelection}>
              <X size={12} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.bulkCount}>{selectedIds.size} selected</Text>
          </View>
          <View style={styles.bulkActionsRow}>
            <TouchableOpacity
              style={styles.bulkAction}
              onPress={() => {
                const toToggle = allHubs.filter(o => selectedIds.has(o.id));
                const allEnabled = toToggle.every(o => o.hubEnabled);
                toToggle.forEach(o => updateOrgHubEnabled({ orgId: o.id, enabled: !allEnabled }));
                clearSelection();
              }}
            >
              <Text style={styles.bulkActionText}>{allHubs.filter(o => selectedIds.has(o.id)).every(o => o.hubEnabled) ? 'Disable Hubs' : 'Enable Hubs'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

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
          {/* ── Unified hub list ── */}
          {allHubs.length > 0 && (
            <>
              {useCardLayout ? (
                <View style={styles.cardList}>
                  {allHubs.map((org) => (
                    <HubCard
                      key={org.id}
                      org={org}
                      onPress={() => router.push(`/crm/${org.id}` as any)}
                      onOpenHub={() => { if (Platform.OS === 'web' && typeof window !== 'undefined') window.open(`/portal/${org.id}`, '_blank'); else router.push(`/portal/${org.id}` as any); }}
                      onCopyLink={() => handleCopyLink(org)}
                      copied={copiedId === org.id}
                      onToggle={() => handleToggleHub(org)}
                      enabling={togglingOrgId === org.id}
                    />
                  ))}
                </View>
              ) : (
                <>
                  <View style={styles.tableHeader}>
                    <TouchableOpacity
                      style={styles.colCheckbox}
                      onPress={toggleSelectAll}
                    >
                      <View style={[styles.checkbox,
                        selectedIds.size > 0 && selectedIds.size === allHubs.length && styles.checkboxChecked,
                        selectedIds.size > 0 && selectedIds.size < allHubs.length && styles.checkboxIndeterminate,
                      ]}>
                        {selectedIds.size > 0 && <Check size={11} color="#fff" />}
                      </View>
                    </TouchableOpacity>
                    <View style={styles.colAvatar} />
                    <View style={styles.colOrg}><SortBtn field="name" label="Organization" /></View>
                    <View style={styles.colBizType}><SortBtn field="type" label="Business Type" /></View>
                    {!hideContact && <View style={styles.colContactName}><SortBtn field="contact" label="Primary Contact" /></View>}
                    {!hideContact && <View style={styles.colEmail}><Text style={styles.sortBtnText}>Contact Email</Text></View>}
                    <View style={styles.colStatus}><SortBtn field="status" label="Status / Hub" /></View>
                    <Text style={[styles.thText, styles.colActionsHeader]}>ACTIONS</Text>
                  </View>
                  <View style={styles.tableBody}>
                    {allHubs.map((org, idx) => (
                      <View key={org.id}>
                        <HubRow
                          org={org}
                          onPress={() => router.push(`/crm/${org.id}` as any)}
                          onOpenHub={() => { if (Platform.OS === 'web' && typeof window !== 'undefined') window.open(`/portal/${org.id}`, '_blank'); else router.push(`/portal/${org.id}` as any); }}
                          onCopyLink={() => handleCopyLink(org)}
                          copied={copiedId === org.id}
                          onToggle={() => handleToggleHub(org)}
                          enabling={togglingOrgId === org.id}
                          hideContact={hideContact}
                          isSelected={selectedIds.has(org.id)}
                          onToggleSelect={() => toggleSelect(org.id)}
                        />
                        {idx < allHubs.length - 1 && <View style={styles.tableDivider} />}
                      </View>
                    ))}
                  </View>
                </>
              )}
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

          {q && allHubs.length === 0 && (
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
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
  },
  pageTitle: { fontSize: 24, fontWeight: '800' as const, color: Colors.light.text },

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
  statItem: { flex: 1, alignItems: 'center', gap: 3 },
  // Aliases of the shared metric typography (components/Metric.tsx).
  statValue: { ...metricValueStyle },
  statLabel: { ...metricLabelStyle },
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
  showAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.background,
  },
  showAllBtnActive: {
    borderColor: Colors.light.tint,
    backgroundColor: `${Colors.light.tint}10`,
  },
  showAllBtnText: {
    fontSize: 13,
    fontWeight: '500' as any,
    color: Colors.light.textSecondary,
  },
  showAllBtnTextActive: {
    color: Colors.light.tint,
    fontWeight: '600' as any,
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
    paddingVertical: 10,
    backgroundColor: '#000000',
  },
  thText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  sortBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4 },
  sortBtnText: { fontSize: 11, fontWeight: '700' as const, color: '#FFFFFF', textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  sortBtnTextActive: { color: Colors.light.tint },
  colCheckbox: { width: 36, justifyContent: 'center' as const, alignItems: 'center' as const },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)', alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: 'transparent' as const },
  checkboxChecked: { backgroundColor: Colors.light.tint, borderColor: Colors.light.tint },
  checkboxIndeterminate: { backgroundColor: Colors.light.tint, borderColor: Colors.light.tint },
  tableRowSelected: { backgroundColor: '#FFF9F6' },
  bulkBar: { flexDirection: 'row' as const, alignItems: 'center' as const, backgroundColor: '#1C1C1E', paddingVertical: 8, paddingHorizontal: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: '#333' },
  bulkBarLeft: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, minWidth: 100 },
  bulkCount: { fontSize: 13, fontWeight: '700' as const, color: '#fff' },
  bulkClearBtn: { width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center' as const, justifyContent: 'center' as const },
  bulkActionsRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4 },
  bulkAction: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.12)' },
  bulkActionText: { fontSize: 12, fontWeight: '600' as const, color: 'rgba(255,255,255,0.9)' },
  tableBody: { backgroundColor: Colors.light.surface },
  tableRowOff: {
    opacity: 0.55,
  },
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
  colOrg: { flex: 2 },
  colBizType: { flex: 1.5 },
  colContactName: { flex: 2 },
  colEmail: { flex: 2 },
  colStatus: { flex: 1.8, gap: 4 },
  colActions: { flexDirection: 'row', alignItems: 'center', gap: 6, width: 110, justifyContent: 'flex-end' },
  colActionsHeader: { width: 110, textAlign: 'right' as const },

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
    justifyContent: 'center',
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
    justifyContent: 'center',
    gap: 5,
    backgroundColor: Colors.light.tint,
    borderRadius: 7,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  enableBtnText: { fontSize: 12, fontWeight: '700' as const, color: '#fff' },

  // Mobile card layout
  cardList: {
    padding: 12,
    gap: 10,
  },
  cardOff: {
    opacity: 0.55,
  },
  card: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 14,
    gap: 10,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardOrgName: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  cardContactLine: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    paddingLeft: 54,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

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
