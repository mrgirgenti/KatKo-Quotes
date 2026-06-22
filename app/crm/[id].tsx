import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import PageBackHeader from '@/components/PageBackHeader';
import OverlayMenu from '@/components/OverlayMenu';
import ContactsPeopleTable from '@/components/ContactsPeopleTable';
import {
  Edit3,
  Mail,
  Phone,
  Building2,
  FileText,
  X,
  XCircle,
  Trash2,
  Plus,
  Clock,
  DollarSign,
  ShoppingBag,
  User,
  MessageSquare,
  TrendingUp,
  CheckCircle,
  Circle,
  MoreHorizontal,
  MapPin,
  Globe,
  ChevronDown,
  ChevronUp,
  PhoneCall,
  Users,
  Shield,
  Send,
  Inbox,
  Package,
  Upload,
  ExternalLink,
  Copy,
  CheckCircle2,
  Film,
  Music,
  Image as LucideImage,
  Wifi,
  WifiOff,
  Award,
  RotateCcw,
  UserX,
  UserCheck,
  Search,
  SlidersHorizontal,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { OrgLogoUploader } from '@/components/OrgLogoUploader';
import { ProjectCard } from '@/components/ProjectCard';
import { metricValueStyle, metricLabelStyle } from '@/components/Metric';
import { Sidebar } from '@/components/Sidebar';
import { useCrm } from '@/contexts/CrmContext';
import { useQuotes } from '@/contexts/QuotesContext';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import {
  Organization,
  Contact,
  Department,
  ActivityEntry,
  ActivityType,
  CrmStatus,
  ContactRole,
  CRM_STATUS_CONFIG,
  ACTIVITY_TYPE_CONFIG,
  CONTACT_ROLES,
  ORG_TYPES,
  CampaignAssignment,
  CampaignStep,
  CampaignStepStatus,
  OrgMembership,
  MembershipRole,
} from '@/types/crm';

import { formatCurrency } from '@/utils/quoteCalculations';
import { apiFetch, getAuthHeaders } from '@/lib/apiFetch';
import MediaCard from '@/components/MediaCard';
import { FLAG_ORG_LAYOUT_V2 } from '@/constants/featureFlags';
import { STATUS_CONFIG, getEffectiveStatus, QuoteStatus } from '@/types/quote';
import {
  LEGACY_SERVICE_COLORS,
  LEGACY_FALLBACK_COLORS,
  LEGACY_SERVICE_ORDER,
  SERVICE_HAS_PCS,
} from '@/constants/services';

const LEGACY_SERVICES: { key: string; color: string }[] = LEGACY_SERVICE_ORDER.map((key) => ({
  key,
  color: LEGACY_SERVICE_COLORS[key] ?? '#6B7280',
}));

function legacyServiceColor(key: string, index: number): string {
  return LEGACY_SERVICE_COLORS[key] ?? LEGACY_FALLBACK_COLORS[index % LEGACY_FALLBACK_COLORS.length];
}

// Map a raw service value onto a canonical baseline name when recognised;
// otherwise keep the raw value so brand-new service types surface automatically.
// DTF Transfers check must come BEFORE the generic 'dtf'/'film' check.
function normalizeLegacyService(raw: string): string | null {
  const s = (raw || '').toLowerCase().trim();
  if (!s) return null;
  if (s.includes('dtf transfer') || s === 'dtf transfers') return 'DTF Transfers';
  if (s.includes('film') || s.includes('dtf')) return 'Direct to Film';
  if (s.includes('screen')) return 'Screen Print';
  if (s.includes('embroid')) return 'Embroidery';
  if (s.includes('promo')) return 'Promotional';
  if (s.includes('design')) return 'Design Work';
  return raw.trim();
}

const MEMBERSHIP_ROLE_LABELS: Record<string, string> = {
  ORG_ADMIN: 'Org Admin',
  MEMBER: 'Member',
  BILLING_CONTACT: 'Billing Contact',
  APPROVER: 'Approver',
};
const MEMBERSHIP_ROLES: MembershipRole[] = ['ORG_ADMIN', 'MEMBER', 'BILLING_CONTACT', 'APPROVER'];

function formatDate(iso?: string, withTime = false): string {
  if (!iso) return 'N/A';
  const d = new Date(iso);
  if (withTime) {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
      ' at ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatBytes(bytes?: number | null): string {
  if (bytes == null || isNaN(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AuthedImage({ fileId, style }: { fileId: string; style: any }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    (async () => {
      try {
        const { getAuthHeaders } = await import('@/lib/apiFetch');
        const headers = await getAuthHeaders();
        const res = await fetch(`/api/files/${fileId}?inline=true`, { headers });
        if (!res.ok || cancelled) return;
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      } catch { /* silent */ }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileId]);
  if (!src) return <View style={[style, { backgroundColor: '#E5E7EB' }]} />;
  return <Image source={{ uri: src }} style={style} resizeMode="cover" />;
}

function StatusBadge({ status }: { status: CrmStatus }) {
  const cfg = CRM_STATUS_CONFIG[status];
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
      <View style={[styles.badgeDot, { backgroundColor: cfg.dot }]} />
      <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

const STEP_STATUS_CONFIG: Record<CampaignStepStatus, { label: string; color: string; bg: string }> = {
  pending:   { label: 'Pending',   color: '#6B7280', bg: '#F3F4F6' },
  sent:      { label: 'Sent',      color: '#2563EB', bg: '#EFF6FF' },
  received:  { label: 'Received',  color: '#7C3AED', bg: '#F5F3FF' },
  responded: { label: 'Responded', color: '#16A34A', bg: '#F0FDF4' },
  skipped:   { label: 'Skipped',   color: '#9CA3AF', bg: '#F9FAFB' },
};

const STEP_STATUSES: CampaignStepStatus[] = ['pending', 'sent', 'received', 'responded', 'skipped'];


export default function OrgProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const {
    orgs, templates,
    isLoading: orgsLoading,
    updateOrg, deleteOrg,
    addContact, updateContact, deleteContact, contactActionAsync,
    addActivity, deleteActivity,
    assignCampaign, updateCampaignStep, deleteCampaign,
    updateOrgStatus,
    addDepartment, updateDepartment, deleteDepartment,
    updateOrgHubEnabled,
  } = useCrm();
  const { quotes } = useQuotes();
  const { isDesktop, isTablet } = useBreakpoint();

  const { data: directOrg, isLoading: directOrgLoading } = useQuery<Organization>({
    queryKey: ['org_detail', id],
    queryFn: async () => {
      return apiFetch(`/api/orgs/${id}`);
    },
    enabled: !!id,
    staleTime: 1000 * 30,
    networkMode: 'always',
  });

  const contextOrg = useMemo(() => orgs.find((o) => o.id === id), [orgs, id]);
  const org: Organization | undefined = contextOrg || directOrg;

  // Local optimistic state for hub toggle so it responds instantly on web
  const [localHubEnabled, setLocalHubEnabled] = useState(org?.hubEnabled ?? false);
  const [legacyCollapsed, setLegacyCollapsed] = useState(!isDesktop && !isTablet);
  useEffect(() => {
    setLocalHubEnabled(org?.hubEnabled ?? false);
  }, [org?.hubEnabled]);

  const handleHubToggle = useCallback(() => {
    if (!org) return;
    const newVal = !localHubEnabled;
    setLocalHubEnabled(newVal);
    updateOrgHubEnabled({ orgId: org.id, enabled: newVal });
  }, [org, localHubEnabled, updateOrgHubEnabled]);

  const [hubLinkCopied, setHubLinkCopied] = useState(false);
  const handleCopyHubLink = useCallback(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && org) {
      const link = `${window.location.origin}/portal/${org.id}`;
      navigator.clipboard.writeText(link);
      setHubLinkCopied(true);
      setTimeout(() => setHubLinkCopied(false), 2000);
    }
  }, [org]);

  const [editOrgModal, setEditOrgModal] = useState(false);
  const [orgForm, setOrgForm] = useState({ name: '', type: '', address: '', city: '', state: '', website: '', notes: '', status: 'Cold' as CrmStatus });
  const [showOrgTypeDropdown, setShowOrgTypeDropdown] = useState(false);

  const [contactModal, setContactModal] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [contactForm, setContactForm] = useState({ firstName: '', lastName: '', role: 'Primary Contact' as ContactRole, email: '', phone: '', notes: '', isPrimary: false, departmentId: '', hubAccess: false });

  const [activityModal, setActivityModal] = useState(false);
  const [activityForm, setActivityForm] = useState({ type: 'call' as ActivityType, date: new Date().toISOString().slice(0, 10), subject: '', body: '', contactId: '' });

  const [campaignModal, setCampaignModal] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>(undefined);

  const [statusDropdown, setStatusDropdown] = useState(false);

  const [deptModal, setDeptModal] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deptForm, setDeptForm] = useState({ name: '', description: '' });

  const [activeSearch, setActiveSearch] = useState('');
  const [activeServiceFilter, setActiveServiceFilter] = useState('');
  const [activeStatusFilter, setActiveStatusFilter] = useState('');
  const [projectsSubTab, setProjectsSubTab] = useState<'active' | 'quotes' | 'completed'>('active');
  const [projectsSearch, setProjectsSearch] = useState('');

  type OrgTab = 'overview' | 'contacts' | 'hub' | 'media' | 'activity' | 'notes' | 'comms' | 'projects';
  const [activeTab, setActiveTab] = useState<OrgTab>('overview');
  const [orgNotesText, setOrgNotesText] = useState('');
  const [editingOrgNotes, setEditingOrgNotes] = useState(false);



  const { data: orgFiles = [], refetch: refetchOrgFiles } = useQuery<any[]>({
    queryKey: ['org_files', org?.id],
    queryFn: async () => {
      if (!org?.id) return [];
      try {
        const data = await apiFetch(`/api/files?orgId=${org.id}&scope=org`);
        return data.files || [];
      } catch { return []; }
    },
    enabled: !!org?.id,
  });

  const [orgFilesUploading, setOrgFilesUploading] = useState(false);
  const [orgFilesDragOver, setOrgFilesDragOver] = useState(false);
  const [hoveredLegacyKey, setHoveredLegacyKey] = useState<string | null>(null);
  const [renamingFileId, setRenamingFileId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');

  const [activeProjectSearch, setActiveProjectSearch] = useState('');
  const [activeProjectStatusFilter, setActiveProjectStatusFilter] = useState<'all' | QuoteStatus>('all');
  const [activeProjectServiceFilter, setActiveProjectServiceFilter] = useState<string>('all');
  const [quotesSearch, setQuotesSearch] = useState('');
  const [quotesStatusFilter, setQuotesStatusFilter] = useState<'all' | QuoteStatus>('all');
  const [quotesServiceFilter, setQuotesServiceFilter] = useState<string>('all');

  const handleOrgFileUpload = useCallback(async (fileOrFiles: File | File[]) => {
    if (!org) return;
    const files = Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles];
    if (files.length === 0) return;
    setOrgFilesUploading(true);
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('orgId', org.id);
        fd.append('fileType', 'ARTWORK');
        fd.append('visibility', 'CLIENT_VISIBLE');
        const res = await fetch('/api/files', { method: 'POST', body: fd, headers: await getAuthHeaders() });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          Alert.alert('Upload failed', err?.error || 'Could not upload file.');
        }
      }
      refetchOrgFiles();
    } catch {
      Alert.alert('Upload failed', 'Something went wrong.');
    } finally {
      setOrgFilesUploading(false);
    }
  }, [org, refetchOrgFiles]);

  const handleOrgFileDelete = useCallback(async (fileId: string) => {
    try {
      await fetch(`/api/files/${fileId}`, { method: 'DELETE', headers: await getAuthHeaders() });
      refetchOrgFiles();
    } catch {}
  }, [refetchOrgFiles]);

  const handleOrgFileDownload = useCallback(async (file: { id: string; originalName: string }) => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    try {
      const res = await fetch(`/api/files/${file.id}`, { headers: await getAuthHeaders() });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.originalName;
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
  }, []);

  const handleRenameFile = useCallback(async (fileId: string, newName: string) => {
    if (!newName.trim()) { setRenamingFileId(null); return; }
    setRenamingFileId(null);
    try {
      await fetch(`/api/files/${fileId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...await getAuthHeaders() },
        body: JSON.stringify({ originalName: newName.trim() }),
      });
      refetchOrgFiles();
    } catch {}
  }, [refetchOrgFiles]);

  const renderOrgMediaCard = (f: any, cols: number) => {
    const isImage = f.mimeType?.startsWith('image/');
    const ext = (f.originalName || '').split('.').pop()?.toUpperCase() || 'FILE';
    return (
      <View key={f.id} style={{ width: `${100 / cols}%`, paddingHorizontal: 5, marginBottom: 10 }}>
        <MediaCard
          file={f}
          thumbnail={isImage
            ? <AuthedImage fileId={f.id} style={{ width: '100%', height: '100%' }} />
            : <Text style={styles.orgMediaCardExt}>{ext}</Text>}
          typeLabel={ext}
          dateLabel={formatDate(f.createdAt)}
          sizeLabel={formatBytes(f.fileSize)}
          onDownload={() => handleOrgFileDownload(f)}
          onDelete={() => handleOrgFileDelete(f.id)}
          renamable
          isRenaming={renamingFileId === f.id}
          renameValue={renameText}
          onRenameChange={setRenameText}
          onRenameStart={() => { setRenamingFileId(f.id); setRenameText(f.originalName); }}
          onRenameSubmit={() => handleRenameFile(f.id, renameText)}
          onRenameCancel={() => setRenamingFileId(null)}
        />
      </View>
    );
  };


  const relatedQuotes = useMemo(() => {
    if (!org) return [];
    return quotes.filter((q) => {
      if (q.orgId === org.id) return true;
      const qName = q.personOrganization.toLowerCase();
      return (
        qName === org.name.toLowerCase() ||
        org.contacts.some((c) => `${c.firstName} ${c.lastName}`.toLowerCase() === qName)
      );
    }).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [quotes, org]);

  const activeQuotes = useMemo(() => {
    return relatedQuotes
      .filter((q) => q.status === 'active' || q.status === 'production_started')
      .sort((a, b) => {
        const da = a.orderDate ? new Date(a.orderDate).getTime() : new Date(a.createdAt).getTime();
        const db = b.orderDate ? new Date(b.orderDate).getTime() : new Date(b.createdAt).getTime();
        return da - db;
      });
  }, [relatedQuotes]);

  const totalSpent = useMemo(() => {
    return relatedQuotes
      .filter((q) => q.status === 'completed')
      .reduce((sum, q) => sum + (q.salesData?.amountCollected || q.calculations?.total || 0), 0);
  }, [relatedQuotes]);

  const isLead = org && (org.status === 'Cold' || org.status === 'Working');

  const completedQuotes = useMemo(() =>
    relatedQuotes.filter((q) => getEffectiveStatus(q) === 'completed'),
    [relatedQuotes]
  );

  const getPcs = (q: any) =>
    (q.lineItems || []).reduce((s: number, li: any) =>
      s + Object.values(li.sizes || {}).reduce((ps: number, v: any) => ps + (Number(v) || 0), 0), 0);

  const activeMetrics = useMemo(() => {
    const revenue = activeQuotes.reduce((s, q) => s + (q.calculations?.total ?? 0), 0);
    const markup = activeQuotes.reduce((s, q) => s + (q.calculations?.markupAmount ?? 0), 0);
    const pcs = activeQuotes.reduce((s, q) => s + getPcs(q), 0);
    return { revenue, markup, pcs };
  }, [activeQuotes]);

  const quoteMetrics = useMemo(() => {
    const revenue = relatedQuotes.reduce((s, q) => s + (q.calculations?.total ?? 0), 0);
    const markup = relatedQuotes.reduce((s, q) => s + (q.calculations?.markupAmount ?? 0), 0);
    const pcs = relatedQuotes.reduce((s, q) => s + getPcs(q), 0);
    return { revenue, markup, pcs };
  }, [relatedQuotes]);

  const activeProjectServices = useMemo(() => {
    const svcs = new Set<string>();
    activeQuotes.forEach((q) => (q.lineItems || []).forEach((li: any) => { if (li.serviceStyle) svcs.add(li.serviceStyle); }));
    return Array.from(svcs);
  }, [activeQuotes]);

  const filteredActiveQuotes = useMemo(() => {
    let list = activeQuotes;
    if (activeProjectStatusFilter !== 'all') {
      list = list.filter((q) => getEffectiveStatus(q) === activeProjectStatusFilter);
    }
    if (activeProjectServiceFilter !== 'all') {
      list = list.filter((q) => (q.lineItems || []).some((li: any) => li.serviceStyle === activeProjectServiceFilter));
    }
    if (activeProjectSearch.trim()) {
      const s = activeProjectSearch.toLowerCase();
      list = list.filter((q) =>
        (q.projectNumber || '').toLowerCase().includes(s) ||
        (q.projectName || '').toLowerCase().includes(s) ||
        (q.lineItems || []).some((li: any) => (li.serviceStyle || '').toLowerCase().includes(s))
      );
    }
    return list;
  }, [activeQuotes, activeProjectStatusFilter, activeProjectServiceFilter, activeProjectSearch]);

  const relatedQuoteServices = useMemo(() => {
    const svcs = new Set<string>();
    relatedQuotes.forEach((q) => (q.lineItems || []).forEach((li: any) => { if (li.serviceStyle) svcs.add(li.serviceStyle); }));
    return Array.from(svcs);
  }, [relatedQuotes]);

  const filteredRelatedQuotes = useMemo(() => {
    let list = relatedQuotes;
    if (quotesStatusFilter !== 'all') {
      list = list.filter((q) => getEffectiveStatus(q) === quotesStatusFilter);
    }
    if (quotesServiceFilter !== 'all') {
      list = list.filter((q) => (q.lineItems || []).some((li: any) => li.serviceStyle === quotesServiceFilter));
    }
    if (quotesSearch.trim()) {
      const s = quotesSearch.toLowerCase();
      list = list.filter((q) =>
        (q.projectNumber || '').toLowerCase().includes(s) ||
        (q.projectName || '').toLowerCase().includes(s) ||
        (q.lineItems || []).some((li: any) => (li.serviceStyle || '').toLowerCase().includes(s))
      );
    }
    return list;
  }, [relatedQuotes, quotesStatusFilter, quotesServiceFilter, quotesSearch]);

  const legacyMetrics = useMemo(() => {
    const totalRevenue = completedQuotes.reduce((s, q) => s + (q.calculations?.total ?? 0), 0);
    const totalMarkup = completedQuotes.reduce((s, q) => s + (q.calculations?.markupAmount ?? 0), 0);

    const svcMap: Record<string, { revenue: number; pcs: number; projectIds: Set<string> }> = {};
    // Seed the baseline services so they always render (even at 0%).
    LEGACY_SERVICES.forEach(({ key }) => {
      svcMap[key] = { revenue: 0, pcs: 0, projectIds: new Set() };
    });

    completedQuotes.forEach((q) => {
      (q.lineItems || []).forEach((li: any) => {
        const key = normalizeLegacyService(li.serviceStyle || li.service || '');
        if (!key) return;
        // Service types not in the baseline set surface automatically.
        if (!svcMap[key]) svcMap[key] = { revenue: 0, pcs: 0, projectIds: new Set() };
        const pcs = Object.values(li.sizes || {}).reduce((ps: number, v: any) => ps + (Number(v) || 0), 0);
        const liRevenue = ((li.productCostEach || 0) + (li.serviceCostEach || 0) + (li.serviceFeeEach || 0) + (li.markupEach || 0)) * Math.max(pcs, 0);
        svcMap[key].revenue += liRevenue;
        svcMap[key].pcs += pcs;
        svcMap[key].projectIds.add(q.id!);
      });
    });

    const totalSvcRevenue = Object.values(svcMap).reduce((s, v) => s + v.revenue, 0);

    const allKeys = Object.keys(svcMap);
    // Sort by master order; unknown service types go to end alphabetically.
    allKeys.sort((a, b) => {
      const ai = LEGACY_SERVICE_ORDER.indexOf(a as any);
      const bi = LEGACY_SERVICE_ORDER.indexOf(b as any);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.localeCompare(b);
    });

    const services = allKeys.map((key, idx) => {
      const d = svcMap[key];
      const pct = totalSvcRevenue > 0 ? Math.round((d.revenue / totalSvcRevenue) * 100) : 0;
      return { name: key, color: legacyServiceColor(key, idx), revenue: d.revenue, pcs: d.pcs, pct, projectCount: d.projectIds.size };
    });

    return { totalProjects: completedQuotes.length, revenue: totalRevenue, markup: totalMarkup, services };
  }, [completedQuotes]);

  const openEditOrg = useCallback(() => {
    if (!org) return;
    setOrgForm({
      name: org.name,
      type: org.type || '',
      address: org.address || '',
      city: org.city || '',
      state: org.state || '',
      website: org.website || '',
      notes: org.notes || '',
      status: org.status,
    });
    setEditOrgModal(true);
  }, [org]);

  const handleSaveOrg = useCallback(() => {
    if (!org || !orgForm.name.trim()) return;
    updateOrg({
      ...org,
      name: orgForm.name.trim(),
      type: orgForm.type || undefined,
      address: orgForm.address || undefined,
      city: orgForm.city || undefined,
      state: orgForm.state || undefined,
      website: orgForm.website || undefined,
      notes: orgForm.notes || undefined,
      status: orgForm.status,
    });
    setEditOrgModal(false);
  }, [org, orgForm, updateOrg]);

  const handleDeleteOrg = useCallback(() => {
    if (!org) return;
    Alert.alert(
      'Delete Contact',
      `Remove ${org.name} and all associated data? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => { deleteOrg(org.id); router.back(); } },
      ]
    );
  }, [org, deleteOrg, router]);

  // CRM CONSOLIDATION — hub access is a derived field on the enriched Contact
  // (Contact → linkedUserId → User → OrganizationMembership), computed server-side
  // in lib/contacts.ts. The UI never reads the memberships list directly.
  const contactHasHubAccess = useCallback(
    (c: Contact) => !!c.hubAccess && c.hubAccess !== 'none',
    [],
  );

  // Tracks the in-flight per-row contact action as `${contactId}:${action}`.
  const [contactActionBusy, setContactActionBusy] = useState<string | null>(null);

  const openAddContact = useCallback(() => {
    setEditingContact(null);
    setContactForm({ firstName: '', lastName: '', role: 'Primary Contact', email: '', phone: '', notes: '', isPrimary: org?.contacts.length === 0, departmentId: '', hubAccess: false });
    setContactModal(true);
  }, [org]);

  const openEditContact = useCallback((c: Contact) => {
    setEditingContact(c);
    const alreadyHasHub = contactHasHubAccess(c);
    setContactForm({ firstName: c.firstName, lastName: c.lastName, role: c.role || 'Primary Contact', email: c.email || '', phone: c.phone || '', notes: c.notes || '', isPrimary: !!c.isPrimary, departmentId: c.departmentId || '', hubAccess: alreadyHasHub });
    setContactModal(true);
  }, [contactHasHubAccess]);

  const handleSaveContact = useCallback(async () => {
    if (!org || !contactForm.firstName.trim()) return;
    const { hubAccess: _hubAccess, isPrimary: _ip, ...rest } = contactForm;
    const derivedIsPrimary = contactForm.role === 'Primary Contact';
    // CRM CONSOLIDATION — saving a contact only persists CRM fields. Hub access is
    // never provisioned inline here; it is granted explicitly via the per-row
    // "Enable Hub Access" action (the single people write path). Any existing
    // linkedUserId is preserved so the auth substrate stays linked.
    const payload = {
      ...rest,
      firstName: contactForm.firstName.trim(),
      lastName: contactForm.lastName.trim(),
      email: contactForm.email.trim() || undefined,
      departmentId: contactForm.departmentId || undefined,
      isPrimary: derivedIsPrimary,
      linkedUserId: editingContact?.linkedUserId ?? undefined,
    };
    if (editingContact) {
      updateContact({ orgId: org.id, contact: { ...editingContact, ...payload } });
    } else {
      addContact({ orgId: org.id, contact: payload });
    }
    setContactModal(false);
  }, [org, contactForm, editingContact, addContact, updateContact]);

  const handleDeleteContact = useCallback((c: Contact) => {
    if (!org) return;
    Alert.alert('Remove Contact', `Remove ${c.firstName} ${c.lastName}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => deleteContact({ orgId: org.id, contactId: c.id }) },
    ]);
  }, [org, deleteContact]);

  // Single people write path: every per-row hub / admin action routes through the
  // consolidated contacts API, which manages the invisible auth substrate.
  const runContactAction = useCallback(async (c: Contact, action: string) => {
    if (!org) return;
    setContactActionBusy(`${c.id}:${action}`);
    try {
      await contactActionAsync({ orgId: org.id, contactId: c.id, action });
    } catch (e: any) {
      Alert.alert('Action failed', e?.message || 'Could not complete that action. Please try again.');
    } finally {
      setContactActionBusy(null);
    }
  }, [org, contactActionAsync]);

  const handleEnableHubFromCard = useCallback(
    (c: Contact) => { if (c.email) runContactAction(c, 'enableHubAccess'); },
    [runContactAction],
  );

  const openAddDept = useCallback(() => {
    setEditingDept(null);
    setDeptForm({ name: '', description: '' });
    setDeptModal(true);
  }, []);

  const openEditDept = useCallback((dept: Department) => {
    setEditingDept(dept);
    setDeptForm({ name: dept.name, description: dept.description || '' });
    setDeptModal(true);
  }, []);

  const handleSaveDept = useCallback(() => {
    if (!org || !deptForm.name.trim()) return;
    if (editingDept) {
      updateDepartment({ orgId: org.id, dept: { ...editingDept, name: deptForm.name.trim(), description: deptForm.description || undefined } });
    } else {
      addDepartment({ orgId: org.id, name: deptForm.name.trim(), description: deptForm.description || undefined });
    }
    setDeptModal(false);
  }, [org, deptForm, editingDept, addDepartment, updateDepartment]);

  const handleSaveActivity = useCallback(() => {
    if (!org || !activityForm.body.trim()) return;
    const contact = org.contacts.find((c) => c.id === activityForm.contactId);
    addActivity({
      orgId: org.id,
      entry: {
        type: activityForm.type,
        date: new Date(activityForm.date + 'T12:00:00').toISOString(),
        subject: activityForm.subject || undefined,
        body: activityForm.body.trim(),
        contactId: activityForm.contactId || undefined,
        contactName: contact ? `${contact.firstName} ${contact.lastName}` : undefined,
      },
    });
    setActivityModal(false);
    setActivityForm({ type: 'call', date: new Date().toISOString().slice(0, 10), subject: '', body: '', contactId: '' });
  }, [org, activityForm, addActivity]);

  const handleUpdateStepStatus = useCallback((campaign: CampaignAssignment, step: CampaignStep, newStatus: CampaignStepStatus) => {
    if (!org) return;
    updateCampaignStep({
      orgId: org.id,
      campaignId: campaign.id,
      step: {
        ...step,
        status: newStatus,
        completedDate: newStatus !== 'pending' ? new Date().toISOString() : undefined,
      },
    });
  }, [org, updateCampaignStep]);

  if (directOrgLoading && !org) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Loading…' }} />
        <View style={styles.notFound}>
          <Clock size={48} color={Colors.light.border} />
          <Text style={styles.notFoundText}>Loading…</Text>
        </View>
      </View>
    );
  }

  if (!org) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Contact' }} />
        <View style={styles.notFound}>
          <Building2 size={48} color={Colors.light.border} />
          <Text style={styles.notFoundText}>Contact not found</Text>
          <TouchableOpacity style={styles.notFoundBtn} onPress={() => router.back()}>
            <Text style={styles.notFoundBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const activeCampaigns = org.campaigns.filter((c) => c.steps.some((s) => s.status === 'pending'));

  const primaryContact = org.contacts.find((c) => c.isPrimary) || org.contacts[0] || null;

  // ── CRM CONSOLIDATION — Client Hub people counts derived from the single
  // Contacts source of truth (never from a separate memberships list). These
  // numbers always match the Contacts table because they read the same rows. ──
  const contactsList = org.contacts ?? [];
  const hubUserCount = contactsList.filter((c) => c.hubAccess && c.hubAccess !== 'none').length;
  const hubActiveCount = contactsList.filter((c) => c.hubAccess === 'enabled').length;
  const hubPendingCount = contactsList.filter((c) => c.hubAccess === 'invited').length;
  const hubAdminCount = contactsList.filter((c) => c.isOrgAdmin).length;
  const hubHasLogo = !!org.logoUrl;
  const hubReady = localHubEnabled && hubHasLogo && hubActiveCount > 0 && hubAdminCount > 0;

  const clientHubInner = (
    <>
      {/* Header: Client Hub + status badge + on/off toggle */}
      <View style={styles.infoCardHeader}>
        <View style={styles.infoCardHeaderLeft}>
          <Shield size={15} color="#fff" />
          <Text style={styles.infoCardTitle}>Client Hub</Text>
          {localHubEnabled
            ? <View style={styles.hubStatusBadge}><Text style={styles.hubStatusBadgeText}>Active</Text></View>
            : <View style={[styles.hubStatusBadge, styles.hubStatusBadgeOff]}><Text style={[styles.hubStatusBadgeText, styles.hubStatusBadgeTextOff]}>Inactive</Text></View>}
        </View>
        <TouchableOpacity style={styles.hubSettingsBtn} onPress={handleHubToggle} activeOpacity={0.8}>
          <Text style={styles.hubSettingsBtnText}>{localHubEnabled ? 'Turn Off' : 'Turn On'}</Text>
        </TouchableOpacity>
      </View>

      {localHubEnabled ? (
        <>
          {/* Compact URL row */}
          <View style={styles.hubUrlRow}>
            <Globe size={10} color={Colors.light.textSecondary} />
            <Text style={styles.hubUrlText} numberOfLines={1}>
              {Platform.OS === 'web' && typeof window !== 'undefined'
                ? `${window.location.origin}/portal/${org.id}`
                : `/portal/${org.id}`}
            </Text>
            <View style={styles.hubUrlActions}>
              <TouchableOpacity style={styles.hubUrlActionBtn} onPress={() => { if (Platform.OS === 'web') (window as any).open(`/portal/${org.id}`, '_blank'); }}>
                <ExternalLink size={10} color={Colors.light.textSecondary} />
                <Text style={styles.hubUrlActionBtnText}>Open</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.hubUrlActionBtn} onPress={handleCopyHubLink}>
                {hubLinkCopied ? <CheckCircle2 size={10} color="#16A34A" /> : <Copy size={10} color={Colors.light.textSecondary} />}
                <Text style={[styles.hubUrlActionBtnText, hubLinkCopied && { color: '#16A34A' }]}>{hubLinkCopied ? 'Copied' : 'Copy'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Metrics strip — derived from the single Contacts source of truth */}
          <View style={styles.hubMetricsRow}>
            <View style={styles.hubMetricItem}>
              <Text style={styles.hubMetricVal}>{hubUserCount}</Text>
              <Text style={styles.hubMetricLbl}>Users</Text>
            </View>
            <View style={styles.hubMetricDiv} />
            <View style={styles.hubMetricItem}>
              <Text style={styles.hubMetricVal}>{hubActiveCount}</Text>
              <Text style={styles.hubMetricLbl}>Active</Text>
            </View>
            <View style={styles.hubMetricDiv} />
            <View style={styles.hubMetricItem}>
              <Text style={[styles.hubMetricVal, hubPendingCount > 0 && { color: '#F59E0B' }]}>{hubPendingCount}</Text>
              <Text style={styles.hubMetricLbl}>Pending</Text>
            </View>
            <View style={styles.hubMetricDiv} />
            <View style={styles.hubMetricItem}>
              <Text style={styles.hubMetricVal}>{hubAdminCount}</Text>
              <Text style={styles.hubMetricLbl}>Admins</Text>
            </View>
          </View>

          {/* Readiness checklist — all derived from Contacts + org branding */}
          <View style={styles.hubReadyBox}>
            <View style={styles.hubReadyHeader}>
              <Text style={styles.hubReadyTitle}>Hub Readiness</Text>
              <View style={[styles.hubReadyPill, hubReady ? styles.hubReadyPillOk : styles.hubReadyPillWarn]}>
                <Text style={[styles.hubReadyPillText, { color: hubReady ? '#166534' : '#92400E' }]}>{hubReady ? 'Ready' : 'Needs setup'}</Text>
              </View>
            </View>
            {[
              { ok: localHubEnabled, label: 'Hub enabled' },
              { ok: hubHasLogo, label: 'Branding / logo set' },
              { ok: hubActiveCount > 0, label: 'At least one active user' },
              { ok: hubAdminCount > 0, label: 'At least one org admin' },
            ].map((item) => (
              <View key={item.label} style={styles.hubReadyRow}>
                {item.ok
                  ? <CheckCircle2 size={13} color="#16A34A" />
                  : <Circle size={13} color={Colors.light.textSecondary} />}
                <Text style={[styles.hubReadyRowText, item.ok && { color: Colors.light.text }]}>{item.label}</Text>
              </View>
            ))}
          </View>

          {/* Manage people → Contacts (the single people-management surface) */}
          <TouchableOpacity style={styles.hubManageBtn} onPress={() => setActiveTab('contacts')} activeOpacity={0.85}>
            <Users size={13} color="#FF5A00" />
            <Text style={styles.hubManageBtnText}>Manage People in Contacts</Text>
          </TouchableOpacity>
        </>
      ) : (
        <View style={styles.hubDisabledBanner}>
          <Text style={styles.hubDisabledText}>Hub is off — toggle on to give this client a branded portal.</Text>
        </View>
      )}
    </>
  );


  const renderActivityEntry = (entry: ActivityEntry) => {
    const typeCfg = ACTIVITY_TYPE_CONFIG[entry.type] ?? ACTIVITY_TYPE_CONFIG['note'];
    const isSystemEvent = !!ACTIVITY_TYPE_CONFIG[entry.type]?.isSystem;
    const iconColor = typeCfg.color;
    const iconEl =
      entry.type === 'call'             ? <PhoneCall size={14} color={iconColor} /> :
      entry.type === 'email'            ? <Mail size={14} color={iconColor} /> :
      entry.type === 'meeting'          ? <Users size={14} color={iconColor} /> :
      entry.type === 'text'             ? <MessageSquare size={14} color={iconColor} /> :
      entry.type === 'client_intake'    ? <Inbox size={14} color={iconColor} /> :
      entry.type === 'client_cancel'    ? <XCircle size={14} color={iconColor} /> :
      entry.type === 'quote_sent'       ? <Send size={14} color={iconColor} /> :
      entry.type === 'quote_approved'   ? <CheckCircle size={14} color={iconColor} /> :
      entry.type === 'invoice_sent'     ? <FileText size={14} color={iconColor} /> :
      entry.type === 'payment_received' ? <DollarSign size={14} color={iconColor} /> :
      entry.type === 'in_production'    ? <Package size={14} color={iconColor} /> :
      entry.type === 'completed'        ? <CheckCircle size={14} color={iconColor} /> :
      entry.type === 'hub_enabled'      ? <Shield size={14} color={iconColor} /> :
      entry.type === 'hub_invite_sent'  ? <Mail size={14} color={iconColor} /> :
      entry.type === 'hub_user_disabled' ? <UserX size={14} color={iconColor} /> :
      entry.type === 'hub_user_enabled'  ? <UserCheck size={14} color={iconColor} /> :
      entry.type === 'member_added' || entry.type === 'member_removed' ? <User size={14} color={iconColor} /> :
      entry.type === 'contact_added' || entry.type === 'contact_updated' ? <User size={14} color={iconColor} /> :
      <FileText size={14} color={iconColor} />;
    return (
      <View key={entry.id} style={[styles.activityEntry, isSystemEvent && styles.activityEntrySystem]}>
        <View style={[styles.activityIcon, { backgroundColor: typeCfg.color + '20' }]}>{iconEl}</View>
        <View style={styles.activityBody}>
          <View style={styles.activityHeaderRow}>
            <Text style={styles.activityType}>{typeCfg.label}</Text>
            {entry.contactName ? <Text style={styles.activityContact}>· {entry.contactName}</Text> : null}
            <Text style={styles.activityDate}>{formatDate(entry.date)}</Text>
          </View>
          {entry.subject ? <Text style={styles.activitySubject}>{entry.subject}</Text> : null}
          <Text style={styles.activityNote}>{entry.body}</Text>
        </View>
        <TouchableOpacity style={styles.activityDelete} onPress={() => deleteActivity({ orgId: org.id, entryId: entry.id })}>
          <X size={13} color={Colors.light.textSecondary} />
        </TouchableOpacity>
      </View>
    );
  };

  // Desktop right-panel tabs — Contacts lives in the left panel, so omit it here
  const DESKTOP_TAB_CONFIG: { id: OrgTab; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'projects', label: 'Projects', count: relatedQuotes.length || undefined },
    { id: 'activity', label: 'Activity', count: org.activityLog.length || undefined },
    { id: 'notes', label: 'Notes', count: org.activityLog.filter((e) => e.type === 'note').length || undefined },
    { id: 'comms', label: 'Communications', count: org.activityLog.filter((e) => e.type === 'email' || e.type === 'call' || e.type === 'text').length || undefined },
  ];
  // Mobile/tablet tabs — left panel is hidden, so include Contacts + Hub + Media here
  const TAB_CONFIG: { id: OrgTab; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'projects', label: 'Projects', count: relatedQuotes.length || undefined },
    { id: 'contacts', label: 'Contacts', count: org.contacts.length || undefined },
    { id: 'hub', label: 'Hub' },
    { id: 'media', label: 'Media', count: orgFiles.length || undefined },
    { id: 'activity', label: 'Activity', count: org.activityLog.length || undefined },
    { id: 'notes', label: 'Notes', count: org.activityLog.filter((e) => e.type === 'note').length || undefined },
    { id: 'comms', label: 'Communications', count: org.activityLog.filter((e) => e.type === 'email' || e.type === 'call' || e.type === 'text').length || undefined },
  ];

  const callEntries = org.activityLog.filter((e) => e.type === 'call' || e.type === 'text');
  const noteEntries = org.activityLog.filter((e) => e.type === 'note');
  const emailEntries = org.activityLog.filter((e) => e.type === 'email');

  // Shared Client Legacy card — KPI cards (no donuts/hover). Responsive grid:
  // 6 per row on desktop (single row), 3 on tablet (3×2), 2 on mobile (2×3).
  // Service types render dynamically from project history; sorted by master order.
  const renderClientLegacy = () => {
    const cols = isDesktop ? 6 : isTablet ? 3 : 2;
    const cardBasis = cols === 6 ? '15.5%' : cols === 3 ? '31.5%' : '47%';
    return (
      <View style={styles.infoCard}>
        <TouchableOpacity style={styles.infoCardHeader} onPress={() => setLegacyCollapsed(v => !v)} activeOpacity={0.8}>
          <View style={styles.infoCardHeaderLeft}>
            <Award size={14} color="#fff" />
            <Text style={styles.infoCardTitle}>Client Legacy</Text>
            {legacyMetrics.totalProjects > 0 && (
              <View style={styles.infoCardBadge}><Text style={styles.infoCardBadgeText}>{legacyMetrics.totalProjects}</Text></View>
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.light.tint }}>View Legacy</Text>
            {legacyCollapsed
              ? <ChevronDown size={16} color={Colors.light.tint} />
              : <ChevronUp size={16} color={Colors.light.tint} />}
          </View>
        </TouchableOpacity>
        <View style={styles.v2SecondaryStats}>
          <View style={styles.revenueStatBox}>
            <Text style={styles.v2SecondaryStatValue}>{legacyMetrics.totalProjects}</Text>
            <Text style={styles.revenueStatLabel}>Done</Text>
          </View>
          <View style={styles.revenueStatDivider} />
          <View style={styles.revenueStatBox}>
            <Text style={[styles.v2SecondaryStatValue, { color: Colors.light.success }]}>{formatCurrency(legacyMetrics.revenue)}</Text>
            <Text style={styles.revenueStatLabel}>Revenue</Text>
          </View>
          <View style={styles.revenueStatDivider} />
          <View style={styles.revenueStatBox}>
            <Text style={[styles.v2SecondaryStatValue, { color: '#FF5A00' }]}>{formatCurrency(legacyMetrics.markup)}</Text>
            <Text style={styles.revenueStatLabel}>Profit</Text>
          </View>
        </View>
        {!legacyCollapsed && (
          <View style={styles.legacyKpiGrid}>
            {legacyMetrics.services.map((svc) => (
              <View key={svc.name} style={[styles.legacyKpiCard, { flexBasis: cardBasis as any }]}>
                <View style={styles.legacyKpiHead}>
                  <View style={[styles.legacyKpiDot, { backgroundColor: svc.color }]} />
                  <Text style={styles.legacyKpiName} numberOfLines={1}>{svc.name}</Text>
                </View>
                <Text style={styles.legacyKpiPct}>{svc.pct}%</Text>
                <View style={styles.legacyKpiStats}>
                  <View style={styles.legacyKpiStatRow}>
                    <Text style={styles.legacyKpiStatLabel}>Projects</Text>
                    <Text style={styles.legacyKpiStatVal}>{svc.projectCount}</Text>
                  </View>
                  <View style={styles.legacyKpiStatRow}>
                    <Text style={styles.legacyKpiStatLabel}>Revenue</Text>
                    <Text style={styles.legacyKpiStatVal}>{formatCurrency(svc.revenue)}</Text>
                  </View>
                  {SERVICE_HAS_PCS[svc.name] !== false && (
                    <View style={styles.legacyKpiStatRow}>
                      <Text style={styles.legacyKpiStatLabel}>PCS</Text>
                      <Text style={styles.legacyKpiStatVal}>{svc.pcs.toLocaleString()}</Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  const overviewCards = (
    <>
      {renderClientLegacy()}

      {/* Active Projects card */}
      <View style={styles.infoCard}>
        <View style={styles.infoCardHeader}>
          <View style={styles.infoCardHeaderLeft}>
            <ShoppingBag size={15} color="#fff" />
            <Text style={styles.infoCardTitle}>Active Projects</Text>
            {activeQuotes.length > 0 && (
              <View style={styles.infoCardBadge}><Text style={styles.infoCardBadgeText}>{activeQuotes.length}</Text></View>
            )}
          </View>
          <TouchableOpacity onPress={() => { setActiveTab('projects'); setProjectsSubTab('active'); }}>
            <Text style={styles.infoCardViewAll}>View All Active Projects →</Text>
          </TouchableOpacity>
        </View>
        {activeQuotes.length > 0 && (
          <View style={styles.revenueStatsRow}>
            <View style={styles.revenueStatBox}>
              <Text style={styles.revenueStatValue}>{activeQuotes.length}</Text>
              <Text style={styles.revenueStatLabel}>Active</Text>
            </View>
            <View style={styles.revenueStatDivider} />
            <View style={styles.revenueStatBox}>
              <Text style={[styles.revenueStatValue, { color: Colors.light.success }]}>{formatCurrency(activeMetrics.revenue)}</Text>
              <Text style={styles.revenueStatLabel}>Revenue</Text>
            </View>
            <View style={styles.revenueStatDivider} />
            <View style={styles.revenueStatBox}>
              <Text style={[styles.revenueStatValue, { color: '#FF5A00' }]}>{formatCurrency(activeMetrics.markup)}</Text>
              <Text style={styles.revenueStatLabel}>Profit</Text>
            </View>
            <View style={styles.revenueStatDivider} />
            <View style={styles.revenueStatBox}>
              <Text style={styles.revenueStatValue}>{activeMetrics.pcs.toLocaleString()}</Text>
              <Text style={styles.revenueStatLabel}>PCS</Text>
            </View>
          </View>
        )}
        {activeQuotes.length > 0 && (
          <View style={styles.embSFRow}>
            <View style={styles.embSearchBox}>
              <Search size={13} color={Colors.light.textSecondary} />
              <TextInput
                style={styles.embSearchInput}
                placeholder="Search project #, name, service…"
                placeholderTextColor={Colors.light.textSecondary}
                value={activeProjectSearch}
                onChangeText={setActiveProjectSearch}
              />
              {activeProjectSearch ? (
                <TouchableOpacity onPress={() => setActiveProjectSearch('')}>
                  <X size={12} color={Colors.light.textSecondary} />
                </TouchableOpacity>
              ) : null}
            </View>
            <OverlayMenu
              align="right"
              menuWidth={200}
              trigger={({ open }) => {
                const fc = (activeProjectStatusFilter !== 'all' ? 1 : 0) + (activeProjectServiceFilter !== 'all' ? 1 : 0);
                return (
                  <TouchableOpacity style={[styles.embFilterBtn, fc > 0 && styles.embFilterBtnActive]} onPress={open}>
                    <SlidersHorizontal size={12} color={fc > 0 ? '#fff' : Colors.light.textSecondary} />
                    <Text style={[styles.embFilterBtnText, fc > 0 && styles.embFilterBtnTextActive]}>
                      Filters{fc > 0 ? ` (${fc})` : ''}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            >
              {({ close }) => {
                const statuses = [...new Set(activeQuotes.map(q => getEffectiveStatus(q)))];
                return (
                  <>
                    <Text style={styles.embFilterSectionLabel}>Status</Text>
                    {(['all', ...statuses] as Array<'all' | typeof statuses[number]>).map((s) => (
                      <TouchableOpacity
                        key={String(s)}
                        style={[styles.embFilterOption, activeProjectStatusFilter === s && styles.embFilterOptionSelected]}
                        onPress={() => { setActiveProjectStatusFilter(s as any); close(); }}
                      >
                        <Text style={[styles.embFilterOptionText, activeProjectStatusFilter === s && styles.embFilterOptionTextSelected]}>
                          {s === 'all' ? 'All Statuses' : STATUS_CONFIG[s as keyof typeof STATUS_CONFIG]?.label ?? String(s)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    {activeProjectServices.length > 0 && (
                      <>
                        <View style={{ height: 1, backgroundColor: Colors.light.border, marginVertical: 4 }} />
                        <Text style={styles.embFilterSectionLabel}>Service</Text>
                        {(['all', ...activeProjectServices]).map((s) => (
                          <TouchableOpacity
                            key={s}
                            style={[styles.embFilterOption, activeProjectServiceFilter === s && styles.embFilterOptionSelected]}
                            onPress={() => { setActiveProjectServiceFilter(s); close(); }}
                          >
                            <Text style={[styles.embFilterOptionText, activeProjectServiceFilter === s && styles.embFilterOptionTextSelected]}>
                              {s === 'all' ? 'All Services' : s}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </>
                    )}
                    {(activeProjectStatusFilter !== 'all' || activeProjectServiceFilter !== 'all') && (
                      <>
                        <View style={{ height: 1, backgroundColor: Colors.light.border, marginVertical: 4 }} />
                        <TouchableOpacity
                          style={styles.embFilterOption}
                          onPress={() => { setActiveProjectStatusFilter('all'); setActiveProjectServiceFilter('all'); close(); }}
                        >
                          <Text style={[styles.embFilterOptionText, { color: Colors.light.error }]}>Clear Filters</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </>
                );
              }}
            </OverlayMenu>
          </View>
        )}
        {activeQuotes.length === 0 ? (
          <View style={styles.emptyCard}>
            <ShoppingBag size={26} color={Colors.light.border} />
            <Text style={styles.emptyCardText}>No active projects yet</Text>
            <Text style={styles.emptyCardSub}>Tap New Quote to start a project for this client.</Text>
          </View>
        ) : filteredActiveQuotes.length === 0 ? (
          <View style={styles.emptyCard}><Text style={styles.emptyCardText}>No matches</Text></View>
        ) : (
          filteredActiveQuotes.map((q, _idx) => (
            <ProjectCard
              key={q.id}
              queue={_idx + 1}
              quote={q}
              compact
              onPress={() => router.push(`/quote/${q.id}` as any)}
            />
          ))
        )}
      </View>

      {/* Submitted Quotes card */}
      <View style={styles.infoCard}>
        <View style={styles.infoCardHeader}>
          <View style={styles.infoCardHeaderLeft}>
            <FileText size={15} color="#fff" />
            <Text style={styles.infoCardTitle}>Submitted Quotes</Text>
            {relatedQuotes.length > 0 && (
              <View style={styles.infoCardBadge}><Text style={styles.infoCardBadgeText}>{relatedQuotes.length}</Text></View>
            )}
          </View>
          <TouchableOpacity onPress={() => { setActiveTab('projects'); setProjectsSubTab('quotes'); }}>
            <Text style={styles.infoCardViewAll}>View All Quotes →</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.revenueStatsRow}>
          <View style={styles.revenueStatBox}>
            <Text style={styles.revenueStatValue}>{relatedQuotes.length}</Text>
            <Text style={styles.revenueStatLabel}>Total Quotes</Text>
          </View>
          <View style={styles.revenueStatDivider} />
          <View style={styles.revenueStatBox}>
            <Text style={[styles.revenueStatValue, { color: Colors.light.success }]}>{formatCurrency(quoteMetrics.revenue)}</Text>
            <Text style={styles.revenueStatLabel}>Revenue</Text>
          </View>
          <View style={styles.revenueStatDivider} />
          <View style={styles.revenueStatBox}>
            <Text style={[styles.revenueStatValue, { color: '#FF5A00' }]}>{formatCurrency(quoteMetrics.markup)}</Text>
            <Text style={styles.revenueStatLabel}>Profit</Text>
          </View>
          <View style={styles.revenueStatDivider} />
          <View style={styles.revenueStatBox}>
            <Text style={styles.revenueStatValue}>{quoteMetrics.pcs.toLocaleString()}</Text>
            <Text style={styles.revenueStatLabel}>PCS</Text>
          </View>
        </View>
        {relatedQuotes.length > 0 && (
          <View style={styles.embSFRow}>
            <View style={styles.embSearchBox}>
              <Search size={13} color={Colors.light.textSecondary} />
              <TextInput
                style={styles.embSearchInput}
                placeholder="Search project #, name, service…"
                placeholderTextColor={Colors.light.textSecondary}
                value={quotesSearch}
                onChangeText={setQuotesSearch}
              />
              {quotesSearch ? (
                <TouchableOpacity onPress={() => setQuotesSearch('')}>
                  <X size={12} color={Colors.light.textSecondary} />
                </TouchableOpacity>
              ) : null}
            </View>
            <OverlayMenu
              align="right"
              menuWidth={200}
              trigger={({ open }) => {
                const fc = (quotesStatusFilter !== 'all' ? 1 : 0) + (quotesServiceFilter !== 'all' ? 1 : 0);
                return (
                  <TouchableOpacity style={[styles.embFilterBtn, fc > 0 && styles.embFilterBtnActive]} onPress={open}>
                    <SlidersHorizontal size={12} color={fc > 0 ? '#fff' : Colors.light.textSecondary} />
                    <Text style={[styles.embFilterBtnText, fc > 0 && styles.embFilterBtnTextActive]}>
                      Filters{fc > 0 ? ` (${fc})` : ''}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            >
              {({ close }) => {
                const statuses = [...new Set(relatedQuotes.map(q => getEffectiveStatus(q)))];
                return (
                  <>
                    <Text style={styles.embFilterSectionLabel}>Status</Text>
                    {(['all', ...statuses] as Array<'all' | typeof statuses[number]>).map((s) => (
                      <TouchableOpacity
                        key={String(s)}
                        style={[styles.embFilterOption, quotesStatusFilter === s && styles.embFilterOptionSelected]}
                        onPress={() => { setQuotesStatusFilter(s as any); close(); }}
                      >
                        <Text style={[styles.embFilterOptionText, quotesStatusFilter === s && styles.embFilterOptionTextSelected]}>
                          {s === 'all' ? 'All Statuses' : STATUS_CONFIG[s as keyof typeof STATUS_CONFIG]?.label ?? String(s)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    {relatedQuoteServices.length > 0 && (
                      <>
                        <View style={{ height: 1, backgroundColor: Colors.light.border, marginVertical: 4 }} />
                        <Text style={styles.embFilterSectionLabel}>Service</Text>
                        {(['all', ...relatedQuoteServices]).map((s) => (
                          <TouchableOpacity
                            key={s}
                            style={[styles.embFilterOption, quotesServiceFilter === s && styles.embFilterOptionSelected]}
                            onPress={() => { setQuotesServiceFilter(s); close(); }}
                          >
                            <Text style={[styles.embFilterOptionText, quotesServiceFilter === s && styles.embFilterOptionTextSelected]}>
                              {s === 'all' ? 'All Services' : s}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </>
                    )}
                    {(quotesStatusFilter !== 'all' || quotesServiceFilter !== 'all') && (
                      <>
                        <View style={{ height: 1, backgroundColor: Colors.light.border, marginVertical: 4 }} />
                        <TouchableOpacity
                          style={styles.embFilterOption}
                          onPress={() => { setQuotesStatusFilter('all'); setQuotesServiceFilter('all'); close(); }}
                        >
                          <Text style={[styles.embFilterOptionText, { color: Colors.light.error }]}>Clear Filters</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </>
                );
              }}
            </OverlayMenu>
          </View>
        )}
        {relatedQuotes.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyCardText}>No quotes yet.</Text>
            <Text style={styles.emptyCardSub}>Create a quote to link it to this organization.</Text>
          </View>
        ) : filteredRelatedQuotes.length === 0 ? (
          <View style={styles.emptyCard}><Text style={styles.emptyCardText}>No matches</Text></View>
        ) : (
          filteredRelatedQuotes.map((q, _idx) => (
            <ProjectCard
              key={q.id}
              queue={_idx + 1}
              quote={q}
              compact
              onPress={() => router.push(`/quote/${q.id}` as any)}
            />
          ))
        )}
      </View>

      {/* Media Bin card */}
      <View style={styles.infoCard}>
        <View style={styles.infoCardHeader}>
          <View style={styles.infoCardHeaderLeft}>
            <Film size={15} color="#fff" />
            <Text style={styles.infoCardTitle}>Media Bin</Text>
            {orgFiles.length > 0 && (
              <View style={styles.infoCardBadge}><Text style={styles.infoCardBadgeText}>{orgFiles.length}</Text></View>
            )}
          </View>
          {Platform.OS === 'web' && (
            <TouchableOpacity
              style={[styles.infoCardAction, orgFilesUploading && { opacity: 0.6 }]}
              disabled={orgFilesUploading}
              onPress={() => {
                if (typeof document === 'undefined') return;
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.ai,.svg,.ps,.png,.jpg,.jpeg,.pdf,.emb,.dst,.pes';
                input.multiple = true;
                input.onchange = (e: any) => {
                  const files = Array.from(e.target?.files || []) as File[];
                  if (files.length > 0) handleOrgFileUpload(files);
                };
                input.click();
              }}
            >
              <Upload size={13} color="#fff" />
              <Text style={styles.infoCardActionText}>{orgFilesUploading ? 'Uploading…' : 'Upload'}</Text>
            </TouchableOpacity>
          )}
        </View>
        {orgFiles.length === 0 ? (
          <View
            style={[styles.orgMediaEmptyBin, orgFilesDragOver && styles.orgMediaDropZoneActive]}
            onDragOver={(e: any) => { e.preventDefault(); setOrgFilesDragOver(true); }}
            onDragLeave={() => setOrgFilesDragOver(false)}
            onDrop={(e: any) => {
              e.preventDefault();
              setOrgFilesDragOver(false);
              const files = Array.from(e.dataTransfer?.files || []) as File[];
              if (files.length > 0) handleOrgFileUpload(files);
            }}
          >
            <View style={[styles.mediaDot, { top: 18, left: 28, width: 5, height: 5 }]} />
            <View style={[styles.mediaDot, { top: 12, right: 60, width: 4, height: 4 }]} />
            <View style={[styles.mediaDot, { top: 30, right: 32, width: 6, height: 6, opacity: 0.4 }]} />
            <View style={[styles.mediaDot, { bottom: 44, left: 18, width: 4, height: 4, opacity: 0.35 }]} />
            <View style={[styles.mediaDot, { bottom: 30, right: 20, width: 5, height: 5, opacity: 0.5 }]} />
            <View style={styles.mediaBinIconRow}>
              <View style={[styles.mediaBinCard, { transform: [{ rotate: '-10deg' }], marginRight: -12, zIndex: 1 }]}>
                <LucideImage size={26} color="#888888" />
              </View>
              <View style={[styles.mediaBinCard, styles.mediaBinCardCenter, { zIndex: 3 }]}>
                <Film size={26} color="#AAAAAA" />
              </View>
              <View style={[styles.mediaBinCard, { transform: [{ rotate: '10deg' }], marginLeft: -12, zIndex: 1 }]}>
                <Music size={26} color="#888888" />
              </View>
            </View>
            <Text style={styles.mediaBinEmptyText}>Drag and drop your media here</Text>
            <Text style={styles.mediaBinEmptySub}>AI · SVG · PS · PNG · JPG · PDF · EMB · DST · PES</Text>
          </View>
        ) : (
          <View
            style={[styles.orgMediaGrid, orgFilesDragOver && { opacity: 0.7 }]}
            onDragOver={(e: any) => { e.preventDefault(); setOrgFilesDragOver(true); }}
            onDragLeave={() => setOrgFilesDragOver(false)}
            onDrop={(e: any) => {
              e.preventDefault();
              setOrgFilesDragOver(false);
              const files = Array.from(e.dataTransfer?.files || []) as File[];
              if (files.length > 0) handleOrgFileUpload(files);
            }}
          >
            {orgFiles.map((f: any) => renderOrgMediaCard(f, isTablet ? 4 : 2))}
          </View>
        )}
      </View>
    </>
  );

  // ─── V2 LAYOUT ───────────────────────────────────────────────────────────────
  if (FLAG_ORG_LAYOUT_V2) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: org.name, headerShown: false }} />
        <PageBackHeader title="Organization Details" />

        {isDesktop ? (
          /* ── DESKTOP: 2-column CRM layout ── */
          <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.v2Layout, { alignItems: 'flex-start' }]}>

            {/* ── LEFT PANEL: Identity + Contacts ── */}
            <View style={[styles.v2LeftPanel, styles.v2LeftPanelContent]}>

              {/* Header: Logo (left) + [Actions / Name / Info] (right) */}
              <View style={styles.v2LPHeader}>
                <View style={styles.v2LPHeaderOuterRow}>
                  {/* Logo column */}
                  <OrgLogoUploader
                    orgId={org.id}
                    orgName={org.name}
                    currentLogoUrl={org.logoUrl}
                    onLogoChange={(url) => updateOrg({ ...org, logoUrl: url ?? undefined })}
                    size={128}
                    hideActions
                  />

                  {/* Right content: actions → name → info */}
                  <View style={styles.v2LPHeaderRightContent}>
                    {/* Actions row — pinned to top-right */}
                    <View style={styles.v2LPHeaderActions}>
                      <OverlayMenu
                        align="right"
                        menuWidth={220}
                        trigger={({ open }) => (
                          <TouchableOpacity style={styles.v2LPActionsBtn} onPress={open}>
                            <Text style={styles.v2LPActionsBtnText}>Actions</Text>
                            <ChevronDown size={12} color={Colors.light.text} />
                          </TouchableOpacity>
                        )}
                      >
                        {({ close }) => (
                          <>
                            <TouchableOpacity style={styles.orgMenuItem} onPress={() => { close(); openEditOrg(); }}>
                              <Edit3 size={14} color={Colors.light.text} />
                              <Text style={styles.orgMenuItemText}>Edit Profile</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.orgMenuItem} onPress={() => { close(); setActivityModal(true); }}>
                              <Plus size={14} color={Colors.light.text} />
                              <Text style={styles.orgMenuItemText}>Log Activity</Text>
                            </TouchableOpacity>
                            <View style={{ height: 1, backgroundColor: Colors.light.border, marginVertical: 2 }} />
                            <TouchableOpacity style={[styles.orgMenuItem, styles.orgMenuItemDanger]} onPress={() => { close(); handleDeleteOrg(); }}>
                              <Trash2 size={14} color={Colors.light.error} />
                              <Text style={[styles.orgMenuItemText, { color: Colors.light.error }]}>Delete Organization</Text>
                            </TouchableOpacity>
                          </>
                        )}
                      </OverlayMenu>
                      <TouchableOpacity
                        style={styles.v2LPNewQuoteBtn}
                        onPress={() => router.push({ pathname: '/(tabs)' as any, params: { orgName: org.name, orgId: org.id } })}
                      >
                        <Plus size={13} color="#fff" />
                        <Text style={styles.v2LPNewQuoteBtnText}>New Quote</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Org name */}
                    <Text style={styles.v2LPName} numberOfLines={2}>{org.name}</Text>

                    {/* Business info | Primary contact */}
                    <View style={styles.v2LPHeaderInfoGrid}>
                      <View style={styles.v2LPHeaderInfoCol}>
                        {org.type ? (
                          <View style={styles.v2LPHeaderDetailRow}>
                            <Building2 size={13} color={Colors.light.textSecondary} />
                            <Text style={styles.v2LPHeaderDetailText} numberOfLines={1}>{org.type}</Text>
                          </View>
                        ) : null}
                        {(org.city || org.state) ? (
                          <View style={styles.v2LPHeaderDetailRow}>
                            <MapPin size={13} color={Colors.light.textSecondary} />
                            <Text style={styles.v2LPHeaderDetailText} numberOfLines={1}>{[org.city, org.state].filter(Boolean).join(', ')}</Text>
                          </View>
                        ) : null}
                      </View>
                      {primaryContact ? (
                        <View style={styles.v2LPHeaderInfoCol}>
                          <View style={styles.v2LPHeaderDetailRow}>
                            <User size={13} color={Colors.light.textSecondary} />
                            <Text style={styles.v2LPPrimaryContactLabel}>Primary Contact</Text>
                          </View>
                          <Text style={styles.v2LPPrimaryContactName} numberOfLines={1}>
                            {primaryContact.firstName} {primaryContact.lastName}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </View>
              </View>


              {/* Contacts — single people-management surface (CRM consolidation) */}
              <View style={styles.v2LPSection}>
                <ContactsPeopleTable
                  contacts={org.contacts}
                  onAdd={openAddContact}
                  onAddDept={openAddDept}
                  onEdit={openEditContact}
                  onDelete={handleDeleteContact}
                  onAction={runContactAction}
                  busyKey={contactActionBusy}
                />
              </View>

              {/* Client Hub section — lives here in left panel */}
              <View style={styles.v2LPDivider} />
              <View style={styles.v2LPSection}>
                {clientHubInner}
              </View>

              {/* Media Bin section */}
              <View style={styles.v2LPDivider} />
              <View style={styles.v2LPSection}>
                <View style={styles.infoCardHeader}>
                  <View style={styles.infoCardHeaderLeft}>
                    <Film size={13} color="#fff" />
                    <Text style={styles.infoCardTitle}>Media Bin</Text>
                    {orgFiles.length > 0 && (
                      <View style={styles.infoCardBadge}><Text style={styles.infoCardBadgeText}>{orgFiles.length}</Text></View>
                    )}
                  </View>
                  {Platform.OS === 'web' && (
                    <TouchableOpacity
                      style={[styles.infoCardAction, orgFilesUploading && { opacity: 0.5 }]}
                      disabled={orgFilesUploading}
                      onPress={() => {
                        if (typeof document === 'undefined') return;
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = '.ai,.svg,.ps,.png,.jpg,.jpeg,.pdf,.emb,.dst,.pes';
                        input.multiple = true;
                        input.onchange = (e: any) => {
                          const files = Array.from(e.target?.files || []) as File[];
                          if (files.length > 0) handleOrgFileUpload(files);
                        };
                        input.click();
                      }}
                    >
                      <Upload size={12} color="#fff" />
                      <Text style={styles.infoCardActionText}>{orgFilesUploading ? 'Uploading…' : 'Upload'}</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {orgFiles.length === 0 ? (
                  <View
                    style={[styles.orgMediaEmptyBin, orgFilesDragOver && styles.orgMediaDropZoneActive]}
                    onDragOver={(e: any) => { e.preventDefault(); setOrgFilesDragOver(true); }}
                    onDragLeave={() => setOrgFilesDragOver(false)}
                    onDrop={(e: any) => {
                      e.preventDefault();
                      setOrgFilesDragOver(false);
                      const files = Array.from(e.dataTransfer?.files || []) as File[];
                      if (files.length > 0) handleOrgFileUpload(files);
                    }}
                  >
                    <View style={styles.mediaBinIconRow}>
                      <View style={[styles.mediaBinCard, { transform: [{ rotate: '-10deg' }], marginRight: -12, zIndex: 1 }]}>
                        <LucideImage size={26} color="#888888" />
                      </View>
                      <View style={[styles.mediaBinCard, styles.mediaBinCardCenter, { zIndex: 3 }]}>
                        <Film size={26} color="#AAAAAA" />
                      </View>
                      <View style={[styles.mediaBinCard, { transform: [{ rotate: '10deg' }], marginLeft: -12, zIndex: 1 }]}>
                        <Music size={26} color="#888888" />
                      </View>
                    </View>
                    <Text style={styles.mediaBinEmptyText}>Drag and drop your media here</Text>
                    <Text style={styles.mediaBinEmptySub}>AI · SVG · PS · PNG · JPG · PDF · EMB · DST · PES</Text>
                  </View>
                ) : (
                  <View style={styles.orgMediaGrid}>
                    {orgFiles.slice(0, 9).map((f: any) => renderOrgMediaCard(f, 3))}
                  </View>
                )}
                {orgFiles.length > 9 && (
                  <Text style={styles.v2ViewAll}>+{orgFiles.length - 9} more files</Text>
                )}
              </View>

              <View style={{ height: 32 }} />
            </View>

            {/* ── RIGHT PANEL: Tabs + Content ── */}
            <View style={styles.v2RightPanel}>

              {/* Tab bar — desktop only shows Overview/Activity/Notes/Comms; Contacts lives in left panel.
                  Horizontal ScrollView (flexGrow:0 so it doesn't eat vertical space in the column panel)
                  prevents the tab row from clipping when the right panel is narrow. */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={[styles.v2TabBar, { flexGrow: 0, flexShrink: 0 }]}
                contentContainerStyle={{ flexDirection: 'row' }}
              >
                {DESKTOP_TAB_CONFIG.map(({ id, label, count }) => (
                  <TouchableOpacity
                    key={id}
                    style={[styles.v2Tab, activeTab === id && styles.v2TabActive]}
                    onPress={() => setActiveTab(id as OrgTab)}
                  >
                    <Text style={[styles.v2TabText, activeTab === id && styles.v2TabTextActive]}>{label}</Text>
                    {count !== undefined && (
                      <View style={[styles.v2TabBadge, activeTab === id && styles.v2TabBadgeActive]}>
                        <Text style={[styles.v2TabBadgeText, activeTab === id && styles.v2TabBadgeTextActive]}>{count}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Overview tab */}
              {activeTab === 'overview' && (
                <View style={[styles.v2OverviewScroll, styles.v2OverviewContent]}>

            {renderClientLegacy()}

            {/* ── PRIMARY: Active Projects ── */}
            <View style={styles.v2PrimaryCard}>
              <View style={[styles.infoCardHeader, styles.v2PrimaryHeader]}>
                <View style={styles.infoCardHeaderLeft}>
                  <ShoppingBag size={16} color="#fff" />
                  <Text style={[styles.infoCardTitle, styles.v2PrimaryTitle]}>Active Projects</Text>
                  {activeQuotes.length > 0 && (
                    <View style={styles.infoCardBadge}><Text style={styles.infoCardBadgeText}>{activeQuotes.length}</Text></View>
                  )}
                </View>
                <TouchableOpacity onPress={() => { setActiveTab('projects'); setProjectsSubTab('active'); }}>
                  <Text style={styles.infoCardViewAll}>View All Active Projects →</Text>
                </TouchableOpacity>
              </View>
              {activeQuotes.length > 0 && (
                <View style={styles.revenueStatsRow}>
                  <View style={styles.revenueStatBox}>
                    <Text style={styles.revenueStatValue}>{activeQuotes.length}</Text>
                    <Text style={styles.revenueStatLabel}>Active</Text>
                  </View>
                  <View style={styles.revenueStatDivider} />
                  <View style={styles.revenueStatBox}>
                    <Text style={[styles.revenueStatValue, { color: Colors.light.success }]}>{formatCurrency(activeMetrics.revenue)}</Text>
                    <Text style={styles.revenueStatLabel}>Revenue</Text>
                  </View>
                  <View style={styles.revenueStatDivider} />
                  <View style={styles.revenueStatBox}>
                    <Text style={[styles.revenueStatValue, { color: '#FF5A00' }]}>{formatCurrency(activeMetrics.markup)}</Text>
                    <Text style={styles.revenueStatLabel}>Profit</Text>
                  </View>
                  <View style={styles.revenueStatDivider} />
                  <View style={styles.revenueStatBox}>
                    <Text style={styles.revenueStatValue}>{activeMetrics.pcs.toLocaleString()}</Text>
                    <Text style={styles.revenueStatLabel}>PCS</Text>
                  </View>
                </View>
              )}
              {activeQuotes.length > 0 && (
                <View style={styles.embSFRow}>
                  <View style={styles.embSearchBox}>
                    <Search size={13} color={Colors.light.textSecondary} />
                    <TextInput
                      style={styles.embSearchInput}
                      placeholder="Search project #, name, service…"
                      placeholderTextColor={Colors.light.textSecondary}
                      value={activeProjectSearch}
                      onChangeText={setActiveProjectSearch}
                    />
                    {activeProjectSearch ? (
                      <TouchableOpacity onPress={() => setActiveProjectSearch('')}>
                        <X size={12} color={Colors.light.textSecondary} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  <OverlayMenu
                    align="right"
                    menuWidth={200}
                    trigger={({ open }) => {
                      const fc = (activeProjectStatusFilter !== 'all' ? 1 : 0) + (activeProjectServiceFilter !== 'all' ? 1 : 0);
                      return (
                        <TouchableOpacity style={[styles.embFilterBtn, fc > 0 && styles.embFilterBtnActive]} onPress={open}>
                          <SlidersHorizontal size={12} color={fc > 0 ? '#fff' : Colors.light.textSecondary} />
                          <Text style={[styles.embFilterBtnText, fc > 0 && styles.embFilterBtnTextActive]}>
                            Filters{fc > 0 ? ` (${fc})` : ''}
                          </Text>
                        </TouchableOpacity>
                      );
                    }}
                  >
                    {({ close }) => {
                      const statuses = [...new Set(activeQuotes.map(q => getEffectiveStatus(q)))];
                      return (
                        <>
                          <Text style={styles.embFilterSectionLabel}>Status</Text>
                          {(['all', ...statuses] as Array<'all' | typeof statuses[number]>).map((s) => (
                            <TouchableOpacity
                              key={String(s)}
                              style={[styles.embFilterOption, activeProjectStatusFilter === s && styles.embFilterOptionSelected]}
                              onPress={() => { setActiveProjectStatusFilter(s as any); close(); }}
                            >
                              <Text style={[styles.embFilterOptionText, activeProjectStatusFilter === s && styles.embFilterOptionTextSelected]}>
                                {s === 'all' ? 'All Statuses' : STATUS_CONFIG[s as keyof typeof STATUS_CONFIG]?.label ?? String(s)}
                              </Text>
                            </TouchableOpacity>
                          ))}
                          {activeProjectServices.length > 0 && (
                            <>
                              <View style={{ height: 1, backgroundColor: Colors.light.border, marginVertical: 4 }} />
                              <Text style={styles.embFilterSectionLabel}>Service</Text>
                              {(['all', ...activeProjectServices]).map((s) => (
                                <TouchableOpacity
                                  key={s}
                                  style={[styles.embFilterOption, activeProjectServiceFilter === s && styles.embFilterOptionSelected]}
                                  onPress={() => { setActiveProjectServiceFilter(s); close(); }}
                                >
                                  <Text style={[styles.embFilterOptionText, activeProjectServiceFilter === s && styles.embFilterOptionTextSelected]}>
                                    {s === 'all' ? 'All Services' : s}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </>
                          )}
                          {(activeProjectStatusFilter !== 'all' || activeProjectServiceFilter !== 'all') && (
                            <>
                              <View style={{ height: 1, backgroundColor: Colors.light.border, marginVertical: 4 }} />
                              <TouchableOpacity
                                style={styles.embFilterOption}
                                onPress={() => { setActiveProjectStatusFilter('all'); setActiveProjectServiceFilter('all'); close(); }}
                              >
                                <Text style={[styles.embFilterOptionText, { color: Colors.light.error }]}>Clear Filters</Text>
                              </TouchableOpacity>
                            </>
                          )}
                        </>
                      );
                    }}
                  </OverlayMenu>
                </View>
              )}
              {activeQuotes.length === 0 ? (
                <View style={styles.emptyCard}>
                  <ShoppingBag size={26} color={Colors.light.border} />
                  <Text style={styles.emptyCardText}>No active projects yet</Text>
                  <Text style={styles.emptyCardSub}>Tap New Quote to start a project for this client.</Text>
                </View>
              ) : filteredActiveQuotes.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyCardText}>No projects match your filters.</Text>
                </View>
              ) : (
                filteredActiveQuotes.map((q, _idx) => (
                  <ProjectCard
                    key={q.id}
                    queue={_idx + 1}
                    quote={q}
                    compact
                    onPress={() => router.push(`/quote/${q.id}` as any)}
                  />
                ))
              )}
            </View>

            {/* ── Submitted Quotes ── */}
            <View style={styles.infoCard}>
              <View style={styles.infoCardHeader}>
                <View style={styles.infoCardHeaderLeft}>
                  <FileText size={14} color="#fff" />
                  <Text style={styles.infoCardTitle}>Submitted Quotes</Text>
                  {relatedQuotes.length > 0 && (
                    <View style={styles.infoCardBadge}><Text style={styles.infoCardBadgeText}>{relatedQuotes.length}</Text></View>
                  )}
                </View>
                <TouchableOpacity onPress={() => { setActiveTab('projects'); setProjectsSubTab('quotes'); }}>
                  <Text style={styles.infoCardViewAll}>View All Quotes →</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.v2SecondaryStats}>
                <View style={styles.revenueStatBox}>
                  <Text style={styles.v2SecondaryStatValue}>{relatedQuotes.length}</Text>
                  <Text style={styles.revenueStatLabel}>Total</Text>
                </View>
                <View style={styles.revenueStatDivider} />
                <View style={styles.revenueStatBox}>
                  <Text style={[styles.v2SecondaryStatValue, { color: Colors.light.success }]}>{formatCurrency(quoteMetrics.revenue)}</Text>
                  <Text style={styles.revenueStatLabel}>Revenue</Text>
                </View>
                <View style={styles.revenueStatDivider} />
                <View style={styles.revenueStatBox}>
                  <Text style={[styles.v2SecondaryStatValue, { color: '#FF5A00' }]}>{formatCurrency(quoteMetrics.markup)}</Text>
                  <Text style={styles.revenueStatLabel}>Profit</Text>
                </View>
              </View>
              {relatedQuotes.length > 0 && (
                <View style={styles.embSFRow}>
                  <View style={styles.embSearchBox}>
                    <Search size={13} color={Colors.light.textSecondary} />
                    <TextInput
                      style={styles.embSearchInput}
                      placeholder="Search project #, name, service…"
                      placeholderTextColor={Colors.light.textSecondary}
                      value={quotesSearch}
                      onChangeText={setQuotesSearch}
                    />
                    {quotesSearch ? (
                      <TouchableOpacity onPress={() => setQuotesSearch('')}>
                        <X size={12} color={Colors.light.textSecondary} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  <OverlayMenu
                    align="right"
                    menuWidth={200}
                    trigger={({ open }) => {
                      const fc = (quotesStatusFilter !== 'all' ? 1 : 0) + (quotesServiceFilter !== 'all' ? 1 : 0);
                      return (
                        <TouchableOpacity style={[styles.embFilterBtn, fc > 0 && styles.embFilterBtnActive]} onPress={open}>
                          <SlidersHorizontal size={12} color={fc > 0 ? '#fff' : Colors.light.textSecondary} />
                          <Text style={[styles.embFilterBtnText, fc > 0 && styles.embFilterBtnTextActive]}>
                            Filters{fc > 0 ? ` (${fc})` : ''}
                          </Text>
                        </TouchableOpacity>
                      );
                    }}
                  >
                    {({ close }) => {
                      const statuses = [...new Set(relatedQuotes.map(q => getEffectiveStatus(q)))];
                      return (
                        <>
                          <Text style={styles.embFilterSectionLabel}>Status</Text>
                          {(['all', ...statuses] as Array<'all' | typeof statuses[number]>).map((s) => (
                            <TouchableOpacity
                              key={String(s)}
                              style={[styles.embFilterOption, quotesStatusFilter === s && styles.embFilterOptionSelected]}
                              onPress={() => { setQuotesStatusFilter(s as any); close(); }}
                            >
                              <Text style={[styles.embFilterOptionText, quotesStatusFilter === s && styles.embFilterOptionTextSelected]}>
                                {s === 'all' ? 'All Statuses' : STATUS_CONFIG[s as keyof typeof STATUS_CONFIG]?.label ?? String(s)}
                              </Text>
                            </TouchableOpacity>
                          ))}
                          {relatedQuoteServices.length > 0 && (
                            <>
                              <View style={{ height: 1, backgroundColor: Colors.light.border, marginVertical: 4 }} />
                              <Text style={styles.embFilterSectionLabel}>Service</Text>
                              {(['all', ...relatedQuoteServices]).map((s) => (
                                <TouchableOpacity
                                  key={s}
                                  style={[styles.embFilterOption, quotesServiceFilter === s && styles.embFilterOptionSelected]}
                                  onPress={() => { setQuotesServiceFilter(s); close(); }}
                                >
                                  <Text style={[styles.embFilterOptionText, quotesServiceFilter === s && styles.embFilterOptionTextSelected]}>
                                    {s === 'all' ? 'All Services' : s}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </>
                          )}
                          {(quotesStatusFilter !== 'all' || quotesServiceFilter !== 'all') && (
                            <>
                              <View style={{ height: 1, backgroundColor: Colors.light.border, marginVertical: 4 }} />
                              <TouchableOpacity
                                style={styles.embFilterOption}
                                onPress={() => { setQuotesStatusFilter('all'); setQuotesServiceFilter('all'); close(); }}
                              >
                                <Text style={[styles.embFilterOptionText, { color: Colors.light.error }]}>Clear Filters</Text>
                              </TouchableOpacity>
                            </>
                          )}
                        </>
                      );
                    }}
                  </OverlayMenu>
                </View>
              )}
              {relatedQuotes.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyCardText}>No quotes yet.</Text>
                </View>
              ) : filteredRelatedQuotes.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyCardText}>No quotes match your filters.</Text>
                </View>
              ) : (
                filteredRelatedQuotes.map((q, _idx) => (
                  <ProjectCard
                    key={q.id}
                    queue={_idx + 1}
                    quote={q}
                    compact
                    onPress={() => router.push(`/quote/${q.id}` as any)}
                  />
                ))
              )}
            </View>

                  <View style={{ height: 32 }} />
                </View>
              )}

              {/* Activity tab */}
              {activeTab === 'activity' && (
                <View style={[styles.tabContentScroll, styles.tabContentPad]}>
                  <View style={styles.tabContentHeader}>
                    <Text style={styles.tabContentTitle}>Activity Log</Text>
                    <TouchableOpacity style={styles.addItemBtn} onPress={() => setActivityModal(true)}>
                      <Plus size={13} color="#fff" /><Text style={styles.addItemBtnText}>Log Activity</Text>
                    </TouchableOpacity>
                  </View>
                  {org.activityLog.length === 0 ? (
                    <View style={styles.emptyTab}>
                      <Clock size={36} color={Colors.light.border} />
                      <Text style={styles.emptyTabText}>No activity logged yet</Text>
                      <Text style={styles.emptyTabSub}>Log a call, email, or note to start tracking interactions.</Text>
                    </View>
                  ) : (
                    org.activityLog.map((entry) => renderActivityEntry(entry))
                  )}
                  {(isLead || org.campaigns.length > 0) && (
                    <View style={[styles.infoCard, { marginTop: 16 }]}>
                      <View style={styles.infoCardHeader}>
                        <View style={styles.infoCardHeaderLeft}>
                          <TrendingUp size={15} color="#fff" />
                          <Text style={styles.infoCardTitle}>Campaigns</Text>
                          {org.campaigns.length > 0 && (
                            <View style={styles.infoCardBadge}><Text style={styles.infoCardBadgeText}>{org.campaigns.length}</Text></View>
                          )}
                        </View>
                        <TouchableOpacity style={styles.infoCardAction} onPress={() => setCampaignModal(true)}>
                          <Plus size={13} color="#fff" /><Text style={styles.infoCardActionText}>Start Campaign</Text>
                        </TouchableOpacity>
                      </View>
                      {org.campaigns.length === 0 ? (
                        <View style={styles.emptyCard}>
                          <Text style={styles.emptyCardText}>No campaigns yet.</Text>
                          <Text style={styles.emptyCardSub}>Start a campaign to track your outreach steps.</Text>
                        </View>
                      ) : (
                        org.campaigns.map((campaign) => {
                          const completedCount = campaign.steps.filter((s) => s.status !== 'pending').length;
                          const totalCount = campaign.steps.length;
                          const progress = totalCount > 0 ? completedCount / totalCount : 0;
                          return (
                            <View key={campaign.id} style={styles.campaignCard}>
                              <View style={styles.campaignHeader}>
                                <View style={styles.campaignHeaderLeft}>
                                  <Text style={styles.campaignName}>{campaign.templateName}</Text>
                                  <Text style={styles.campaignDate}>Started {formatDate(campaign.startedDate)}</Text>
                                </View>
                                <View style={styles.campaignProgress}>
                                  <Text style={styles.campaignProgressText}>{completedCount}/{totalCount}</Text>
                                  <View style={styles.campaignProgressBar}>
                                    <View style={[styles.campaignProgressFill, { width: `${progress * 100}%` as any }]} />
                                  </View>
                                </View>
                                <TouchableOpacity style={styles.campaignDelete} onPress={() => Alert.alert('Remove Campaign', 'Remove this campaign?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => deleteCampaign({ orgId: org.id, campaignId: campaign.id }) }])}>
                                  <Trash2 size={13} color={Colors.light.textSecondary} />
                                </TouchableOpacity>
                              </View>
                              {campaign.steps.map((step) => (
                                <View key={step.id} style={styles.campaignStep}>
                                  <View style={styles.campaignStepNum}><Text style={styles.campaignStepNumText}>{step.stepNumber}</Text></View>
                                  <View style={styles.campaignStepInfo}>
                                    <Text style={styles.campaignStepLabel}>{step.label}</Text>
                                    <View style={styles.campaignStepMeta}>
                                      <View style={[styles.campaignStepTypeBadge, { backgroundColor: (ACTIVITY_TYPE_CONFIG[step.type as ActivityType]?.color || '#6B7280') + '20' }]}>
                                        <Text style={[styles.campaignStepTypeText, { color: ACTIVITY_TYPE_CONFIG[step.type as ActivityType]?.color || '#6B7280' }]}>{step.type.charAt(0).toUpperCase() + step.type.slice(1)}</Text>
                                      </View>
                                      {step.scheduledDate && <Text style={styles.campaignStepDate}>Due {formatDate(step.scheduledDate)}</Text>}
                                    </View>
                                  </View>
                                  <View style={styles.campaignStepStatus}>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                      <View style={styles.stepStatusRow}>
                                        {STEP_STATUSES.map((ss) => (
                                          <TouchableOpacity key={ss} style={[styles.stepStatusBtn, step.status === ss && { backgroundColor: STEP_STATUS_CONFIG[ss].bg, borderColor: STEP_STATUS_CONFIG[ss].color }]} onPress={() => handleUpdateStepStatus(campaign, step, ss)}>
                                            <Text style={[styles.stepStatusBtnText, step.status === ss && { color: STEP_STATUS_CONFIG[ss].color, fontWeight: '700' as const }]}>{STEP_STATUS_CONFIG[ss].label}</Text>
                                          </TouchableOpacity>
                                        ))}
                                      </View>
                                    </ScrollView>
                                  </View>
                                </View>
                              ))}
                            </View>
                          );
                        })
                      )}
                    </View>
                  )}
                  <View style={{ height: 24 }} />
                </View>
              )}

              {/* Notes tab */}
              {activeTab === 'notes' && (
                <View style={[styles.tabContentScroll, styles.tabContentPad]}>
                  <View style={styles.tabContentHeader}>
                    <Text style={styles.tabContentTitle}>Notes</Text>
                    <TouchableOpacity style={styles.addItemBtn} onPress={() => { setActivityForm((f) => ({ ...f, type: 'note' })); setActivityModal(true); }}>
                      <Plus size={13} color="#fff" /><Text style={styles.addItemBtnText}>Add Note</Text>
                    </TouchableOpacity>
                  </View>
                  {(org as any).notes ? (
                    <View style={styles.orgNotesCard}>
                      <Text style={styles.orgNotesLabel}>Organization Notes</Text>
                      <Text style={styles.orgNotesText}>{(org as any).notes}</Text>
                    </View>
                  ) : null}
                  {noteEntries.length === 0 ? (
                    <View style={styles.emptyTab}>
                      <FileText size={36} color={Colors.light.border} />
                      <Text style={styles.emptyTabText}>No notes yet</Text>
                      <Text style={styles.emptyTabSub}>Add a note to capture important information about this client.</Text>
                    </View>
                  ) : (
                    noteEntries.map((entry) => renderActivityEntry(entry))
                  )}
                  <View style={{ height: 24 }} />
                </View>
              )}

              {/* Communications tab (Emails + Calls) */}
              {activeTab === 'comms' && (
                <View style={[styles.tabContentScroll, styles.tabContentPad]}>
                  {/* Emails section */}
                  <View style={styles.tabContentHeader}>
                    <Text style={styles.tabContentTitle}>Emails</Text>
                    <TouchableOpacity style={styles.addItemBtn} onPress={() => { setActivityForm((f) => ({ ...f, type: 'email' })); setActivityModal(true); }}>
                      <Plus size={13} color="#fff" /><Text style={styles.addItemBtnText}>Log Email</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.gmailBanner}>
                    <Mail size={28} color="#4285F4" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.gmailBannerTitle}>Gmail Integration — Coming Soon</Text>
                      <Text style={styles.gmailBannerSub}>Connect your Gmail account to send emails and sync your inbox directly from here.</Text>
                    </View>
                  </View>
                  {emailEntries.length === 0 ? (
                    <View style={[styles.emptyTab, { paddingVertical: 24 }]}>
                      <Text style={styles.emptyTabText}>No emails logged yet</Text>
                      <Text style={styles.emptyTabSub}>Use "Log Email" to manually record email interactions.</Text>
                    </View>
                  ) : (
                    emailEntries.map((entry) => renderActivityEntry(entry))
                  )}

                  {/* Divider */}
                  <View style={{ height: 1, backgroundColor: Colors.light.border, marginVertical: 16 }} />

                  {/* Calls section */}
                  <View style={styles.tabContentHeader}>
                    <Text style={styles.tabContentTitle}>Calls & Texts</Text>
                    <TouchableOpacity style={styles.addItemBtn} onPress={() => { setActivityForm((f) => ({ ...f, type: 'call' })); setActivityModal(true); }}>
                      <Phone size={13} color="#fff" /><Text style={styles.addItemBtnText}>Log Call</Text>
                    </TouchableOpacity>
                  </View>
                  {callEntries.length === 0 ? (
                    <View style={[styles.emptyTab, { paddingVertical: 24 }]}>
                      <PhoneCall size={36} color={Colors.light.border} />
                      <Text style={styles.emptyTabText}>No calls logged yet</Text>
                      <Text style={styles.emptyTabSub}>Log a call or text message to track your conversations.</Text>
                    </View>
                  ) : (
                    callEntries.map((entry) => renderActivityEntry(entry))
                  )}
                  <View style={{ height: 24 }} />
                </View>
              )}

              {/* Projects tab */}
              {activeTab === 'projects' && (
                <View style={[styles.tabContentScroll, styles.tabContentPad]}>
                  <View style={styles.tabContentHeader}>
                    <Text style={styles.tabContentTitle}>All Projects</Text>
                    <TouchableOpacity
                      style={styles.addItemBtn}
                      onPress={() => router.push({ pathname: '/(tabs)' as any, params: { orgName: org.name, orgId: org.id } })}
                    >
                      <Plus size={13} color="#fff" /><Text style={styles.addItemBtnText}>New Quote</Text>
                    </TouchableOpacity>
                  </View>
                  {/* Sub-tab bar */}
                  <View style={{ flexDirection: 'row' as const, gap: 6, marginBottom: 12 }}>
                    {(['active', 'quotes', 'completed'] as const).map((sub) => {
                      const counts = { active: activeQuotes.length, quotes: relatedQuotes.length, completed: relatedQuotes.filter(q => q.status === 'completed').length };
                      return (
                        <TouchableOpacity key={sub} onPress={() => setProjectsSubTab(sub)}
                          style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: projectsSubTab === sub ? Colors.light.primary : Colors.light.backgroundSecondary, borderWidth: 1, borderColor: projectsSubTab === sub ? Colors.light.primary : Colors.light.border }}>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: projectsSubTab === sub ? '#fff' : Colors.light.textSecondary }}>
                            {sub === 'active' ? 'Active' : sub === 'quotes' ? 'All Quotes' : 'Completed'} ({counts[sub]})
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  {/* Search */}
                  <View style={styles.p16SearchRow}>
                    <View style={styles.p16SearchBox}>
                      <Search size={13} color={Colors.light.textSecondary} />
                      <TextInput
                        style={styles.p16SearchInput}
                        placeholder="Search projects…"
                        placeholderTextColor={Colors.light.textSecondary}
                        value={projectsSearch}
                        onChangeText={setProjectsSearch}
                      />
                    </View>
                  </View>
                  {/* Cards */}
                  {(() => {
                    const pool = projectsSubTab === 'active' ? activeQuotes : projectsSubTab === 'completed' ? relatedQuotes.filter(q => q.status === 'completed') : relatedQuotes;
                    const sorted = [...pool].sort((a, b) => {
                      const da = a.orderDate ? new Date(a.orderDate.replace(/-/g, '/')).getTime() : 0;
                      const db = b.orderDate ? new Date(b.orderDate.replace(/-/g, '/')).getTime() : 0;
                      return da - db;
                    });
                    const filtered = sorted.filter(q => {
                      const pNum = ((q as any).projectNumber || q.invoiceNumber || '').toLowerCase();
                      const name = (q.projectName || q.personOrganization || '').toLowerCase();
                      const svcs = [...new Set((q.lineItems || []).map((li: any) => li.serviceStyle).filter(Boolean))].join(' ').toLowerCase();
                      const s = projectsSearch.toLowerCase();
                      return !s || pNum.includes(s) || name.includes(s) || svcs.includes(s);
                    });
                    if (filtered.length === 0) return (
                      <View style={styles.emptyCard}>
                        <ShoppingBag size={26} color={Colors.light.border} />
                        <Text style={styles.emptyCardText}>{projectsSearch ? 'No matches' : 'No projects yet'}</Text>
                      </View>
                    );
                    return filtered.map((q, idx) => (
                      <ProjectCard
                        key={q.id}
                        queue={idx + 1}
                        quote={q}
                        onPress={() => router.push(`/quote/${q.id}` as any)}
                      />
                    ));
                  })()}
                  <View style={{ height: 24 }} />
                </View>
              )}

            </View>
          </ScrollView>

        ) : (
          /* ── MOBILE: stacked layout ── */
          <ScrollView style={{ flex: 1, outlineStyle: 'none' } as any} showsVerticalScrollIndicator={false}>
            {/* Mobile header */}
            <View style={styles.v2MobileHeader}>
              <View style={styles.v2MobileHeaderTop}>
                <OrgLogoUploader orgId={org.id} orgName={org.name} currentLogoUrl={org.logoUrl} onLogoChange={(url) => updateOrg({ ...org, logoUrl: url ?? undefined })} size={52} hideActions />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.v2MobileOrgName} numberOfLines={1}>{org.name}</Text>
                  {primaryContact ? (
                    <Text style={styles.v2MobileOrgMeta} numberOfLines={1}>{primaryContact.firstName} {primaryContact.lastName}</Text>
                  ) : org.type ? (
                    <Text style={styles.v2MobileOrgMeta} numberOfLines={1}>{org.type}</Text>
                  ) : null}
                </View>
                <TouchableOpacity style={styles.v2LPNewQuoteBtn} onPress={() => router.push({ pathname: '/(tabs)' as any, params: { orgName: org.name, orgId: org.id } })}>
                  <Plus size={13} color="#fff" /><Text style={styles.v2LPNewQuoteBtnText}>New Quote</Text>
                </TouchableOpacity>
              </View>
            </View>
            {/* Mobile tab bar */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.v2TabBar, { backgroundColor: Colors.light.surface }]} contentContainerStyle={{ flexDirection: 'row' }}>
              {TAB_CONFIG.map(({ id, label, count }) => (
                <TouchableOpacity key={id} style={[styles.v2Tab, activeTab === id && styles.v2TabActive]} onPress={() => setActiveTab(id as OrgTab)}>
                  <Text style={[styles.v2TabText, activeTab === id && styles.v2TabTextActive]}>{label}</Text>
                  {count !== undefined && (
                    <View style={[styles.v2TabBadge, activeTab === id && styles.v2TabBadgeActive]}>
                      <Text style={[styles.v2TabBadgeText, activeTab === id && styles.v2TabBadgeTextActive]}>{count}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            {/* Mobile overview */}
            {activeTab === 'overview' && (
              <View style={styles.v2OverviewContent}>
                {overviewCards}
              </View>
            )}
            {activeTab === 'projects' && (
              <View style={styles.tabContentPad}>
                {/* Sub-tab bar */}
                <View style={{ flexDirection: 'row' as const, gap: 6, marginBottom: 12, marginTop: 8 }}>
                  {(['active', 'quotes', 'completed'] as const).map((sub) => {
                    const counts = { active: activeQuotes.length, quotes: relatedQuotes.length, completed: relatedQuotes.filter(q => q.status === 'completed').length };
                    return (
                      <TouchableOpacity key={sub} onPress={() => setProjectsSubTab(sub)}
                        style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: projectsSubTab === sub ? Colors.light.primary : Colors.light.backgroundSecondary, borderWidth: 1, borderColor: projectsSubTab === sub ? Colors.light.primary : Colors.light.border }}>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: projectsSubTab === sub ? '#fff' : Colors.light.textSecondary }}>
                          {sub === 'active' ? 'Active' : sub === 'quotes' ? 'All Quotes' : 'Completed'} ({counts[sub]})
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {/* Search */}
                <View style={styles.p16SearchRow}>
                  <View style={styles.p16SearchBox}>
                    <Search size={13} color={Colors.light.textSecondary} />
                    <TextInput
                      style={styles.p16SearchInput}
                      placeholder="Search projects…"
                      placeholderTextColor={Colors.light.textSecondary}
                      value={projectsSearch}
                      onChangeText={setProjectsSearch}
                    />
                  </View>
                </View>
                {(() => {
                  const pool = projectsSubTab === 'active' ? activeQuotes : projectsSubTab === 'completed' ? relatedQuotes.filter(q => q.status === 'completed') : relatedQuotes;
                  const sorted = [...pool].sort((a, b) => {
                    const da = a.orderDate ? new Date(a.orderDate.replace(/-/g, '/')).getTime() : 0;
                    const db = b.orderDate ? new Date(b.orderDate.replace(/-/g, '/')).getTime() : 0;
                    return da - db;
                  });
                  const filtered = sorted.filter(q => {
                    const pNum = ((q as any).projectNumber || q.invoiceNumber || '').toLowerCase();
                    const name = (q.projectName || q.personOrganization || '').toLowerCase();
                    const svcs = [...new Set((q.lineItems || []).map((li: any) => li.serviceStyle).filter(Boolean))].join(' ').toLowerCase();
                    const s = projectsSearch.toLowerCase();
                    return !s || pNum.includes(s) || name.includes(s) || svcs.includes(s);
                  });
                  if (filtered.length === 0) return (
                    <View style={styles.emptyCard}>
                      <ShoppingBag size={26} color={Colors.light.border} />
                      <Text style={styles.emptyCardText}>{projectsSearch ? 'No matches' : 'No projects yet'}</Text>
                    </View>
                  );
                  return filtered.map((q, idx) => (
                    <ProjectCard
                      key={q.id}
                      queue={idx + 1}
                      quote={q}
                      onPress={() => router.push(`/quote/${q.id}` as any)}
                    />
                  ));
                })()}
              </View>
            )}
            {activeTab === 'contacts' && (
              <View style={styles.tabContentPad}>
                <ContactsPeopleTable
                  contacts={org.contacts}
                  onAdd={openAddContact}
                  onAddDept={openAddDept}
                  onEdit={openEditContact}
                  onDelete={handleDeleteContact}
                  onAction={runContactAction}
                  busyKey={contactActionBusy}
                />
              </View>
            )}
            {activeTab === 'hub' && (
              <View style={styles.tabContentPad}>
                <View style={styles.infoCard}>
                  {clientHubInner}
                </View>
              </View>
            )}
            {activeTab === 'media' && (
              <View style={styles.tabContentPad}>
                <View style={styles.infoCard}>
                  <View style={styles.infoCardHeader}>
                    <View style={styles.infoCardHeaderLeft}>
                      <Film size={15} color="#fff" />
                      <Text style={styles.infoCardTitle}>Media Bin</Text>
                      {orgFiles.length > 0 && (
                        <View style={styles.infoCardBadge}><Text style={styles.infoCardBadgeText}>{orgFiles.length}</Text></View>
                      )}
                    </View>
                    {Platform.OS === 'web' && (
                      <TouchableOpacity
                        style={[styles.infoCardAction, orgFilesUploading && { opacity: 0.6 }]}
                        disabled={orgFilesUploading}
                        onPress={() => {
                          if (typeof document === 'undefined') return;
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = '.ai,.svg,.ps,.png,.jpg,.jpeg,.pdf,.emb,.dst,.pes';
                          input.multiple = true;
                          input.onchange = (e: any) => {
                            const files = Array.from(e.target?.files || []) as File[];
                            if (files.length > 0) handleOrgFileUpload(files);
                          };
                          input.click();
                        }}
                      >
                        <Upload size={13} color="#fff" />
                        <Text style={styles.infoCardActionText}>{orgFilesUploading ? 'Uploading…' : 'Upload'}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {orgFiles.length === 0 ? (
                    <View
                      style={[styles.orgMediaEmptyBin, orgFilesDragOver && styles.orgMediaDropZoneActive]}
                      onDragOver={(e: any) => { e.preventDefault(); setOrgFilesDragOver(true); }}
                      onDragLeave={() => setOrgFilesDragOver(false)}
                      onDrop={(e: any) => {
                        e.preventDefault();
                        setOrgFilesDragOver(false);
                        const files = Array.from(e.dataTransfer?.files || []) as File[];
                        if (files.length > 0) handleOrgFileUpload(files);
                      }}
                    >
                      <View style={styles.mediaBinIconRow}>
                        <View style={[styles.mediaBinCard, { transform: [{ rotate: '-10deg' }], marginRight: -12, zIndex: 1 }]}>
                          <LucideImage size={26} color="#888888" />
                        </View>
                        <View style={[styles.mediaBinCard, styles.mediaBinCardCenter, { zIndex: 3 }]}>
                          <Film size={26} color="#AAAAAA" />
                        </View>
                        <View style={[styles.mediaBinCard, { transform: [{ rotate: '10deg' }], marginLeft: -12, zIndex: 1 }]}>
                          <Music size={26} color="#888888" />
                        </View>
                      </View>
                      <Text style={styles.mediaBinEmptyText}>Drag and drop your media here</Text>
                      <Text style={styles.mediaBinEmptySub}>AI · SVG · PS · PNG · JPG · PDF · EMB · DST · PES</Text>
                    </View>
                  ) : (
                    <View style={styles.orgMediaGrid}>
                      {orgFiles.map((f: any) => {
                        const isImage = f.mimeType?.startsWith('image/');
                        const ext = (f.originalName || '').split('.').pop()?.toUpperCase() || 'FILE';
                        const cols = isDesktop ? 6 : isTablet ? 4 : 2;
                        return (
                          <View key={f.id} style={{ width: `${100 / cols}%`, paddingHorizontal: 5, marginBottom: 10 }}>
                            <MediaCard
                              file={f}
                              thumbnail={isImage
                                ? <AuthedImage fileId={f.id} style={{ width: '100%', height: '100%' }} />
                                : <Text style={styles.orgMediaCardExt}>{ext}</Text>}
                              typeLabel={ext}
                              dateLabel={formatDate(f.createdAt)}
                              sizeLabel={formatBytes(f.fileSize)}
                              onDownload={() => handleOrgFileDownload(f)}
                              onDelete={() => handleOrgFileDelete(f.id)}
                              renamable
                              isRenaming={renamingFileId === f.id}
                              renameValue={renameText}
                              onRenameChange={setRenameText}
                              onRenameStart={() => { setRenamingFileId(f.id); setRenameText(f.originalName); }}
                              onRenameSubmit={() => handleRenameFile(f.id, renameText)}
                              onRenameCancel={() => setRenamingFileId(null)}
                            />
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              </View>
            )}
            {activeTab === 'activity' && (
              <View style={styles.tabContentPad}>
                {org.activityLog.length === 0 ? <View style={styles.emptyTab}><Clock size={36} color={Colors.light.border} /><Text style={styles.emptyTabText}>No activity yet</Text></View> : org.activityLog.map((entry) => renderActivityEntry(entry))}
              </View>
            )}
            {activeTab === 'notes' && (
              <View style={styles.tabContentPad}>
                {noteEntries.length === 0 ? <View style={styles.emptyTab}><FileText size={36} color={Colors.light.border} /><Text style={styles.emptyTabText}>No notes yet</Text></View> : noteEntries.map((entry) => renderActivityEntry(entry))}
              </View>
            )}
            {activeTab === 'comms' && (
              <View style={styles.tabContentPad}>
                <View style={styles.tabContentHeader}>
                  <Text style={styles.tabContentTitle}>Emails</Text>
                  <TouchableOpacity style={styles.addItemBtn} onPress={() => { setActivityForm((f) => ({ ...f, type: 'email' })); setActivityModal(true); }}>
                    <Plus size={13} color="#fff" /><Text style={styles.addItemBtnText}>Log Email</Text>
                  </TouchableOpacity>
                </View>
                {emailEntries.length === 0 ? <View style={[styles.emptyTab, { paddingVertical: 20 }]}><Text style={styles.emptyTabText}>No emails yet</Text></View> : emailEntries.map((entry) => renderActivityEntry(entry))}
                <View style={{ height: 1, backgroundColor: Colors.light.border, marginVertical: 14 }} />
                <View style={styles.tabContentHeader}>
                  <Text style={styles.tabContentTitle}>Calls & Texts</Text>
                  <TouchableOpacity style={styles.addItemBtn} onPress={() => { setActivityForm((f) => ({ ...f, type: 'call' })); setActivityModal(true); }}>
                    <Phone size={13} color="#fff" /><Text style={styles.addItemBtnText}>Log Call</Text>
                  </TouchableOpacity>
                </View>
                {callEntries.length === 0 ? <View style={[styles.emptyTab, { paddingVertical: 20 }]}><PhoneCall size={36} color={Colors.light.border} /><Text style={styles.emptyTabText}>No calls yet</Text></View> : callEntries.map((entry) => renderActivityEntry(entry))}
              </View>
            )}
            <View style={{ height: 40 }} />
          </ScrollView>
        )}

        {/* ── V2: Modals (shared state) ── */}
        <Modal visible={editOrgModal} transparent animationType="fade" onRequestClose={() => setEditOrgModal(false)}>
          <Pressable style={styles.modalOverlay} onPress={() => setEditOrgModal(false)}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalKAV}>
              <Pressable style={styles.modalCard} onPress={() => {}}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Edit Profile</Text>
                  <TouchableOpacity onPress={() => setEditOrgModal(false)}><X size={22} color={Colors.light.textSecondary} /></TouchableOpacity>
                </View>
                <ScrollView showsVerticalScrollIndicator={false}>
                  <Text style={styles.fieldLabel}>Status</Text>
                  <View style={styles.statusRow}>
                    {(['Cold', 'Working', 'Active Client', 'Past Client'] as CrmStatus[]).map((s) => {
                      const cfg = CRM_STATUS_CONFIG[s];
                      const sel = orgForm.status === s;
                      return (
                        <TouchableOpacity key={s} style={[styles.statusChip, sel && { backgroundColor: cfg.bg, borderColor: cfg.border }]} onPress={() => setOrgForm((f) => ({ ...f, status: s }))}>
                          <Text style={[styles.statusChipText, sel && { color: cfg.color, fontWeight: '700' as const }]}>{s}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <Text style={styles.fieldLabel}>Name *</Text>
                  <TextInput style={styles.textInput} value={orgForm.name} onChangeText={(v) => setOrgForm((f) => ({ ...f, name: v }))} placeholder="Organization name" placeholderTextColor={Colors.light.textSecondary} />
                  <Text style={styles.fieldLabel}>Type</Text>
                  <TouchableOpacity style={styles.typePickerBtn} onPress={() => setShowOrgTypeDropdown((v) => !v)}>
                    <Text style={orgForm.type ? styles.typePickerBtnText : styles.typePickerBtnPlaceholder}>{orgForm.type || 'Select type…'}</Text>
                  </TouchableOpacity>
                  {showOrgTypeDropdown && (
                    <View style={styles.typeDropdown}>
                      {ORG_TYPES.map((t) => (
                        <TouchableOpacity key={t} style={styles.typeDropdownItem} onPress={() => { setOrgForm((f) => ({ ...f, type: t })); setShowOrgTypeDropdown(false); }}>
                          <Text style={[styles.typeDropdownText, orgForm.type === t && styles.typeDropdownTextActive]}>{t}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                  <Text style={styles.fieldLabel}>City / State</Text>
                  <View style={styles.rowInputs}>
                    <TextInput style={[styles.textInput, { flex: 2 }]} value={orgForm.city} onChangeText={(v) => setOrgForm((f) => ({ ...f, city: v }))} placeholder="City" placeholderTextColor={Colors.light.textSecondary} />
                    <TextInput style={[styles.textInput, { flex: 1 }]} value={orgForm.state} onChangeText={(v) => setOrgForm((f) => ({ ...f, state: v }))} placeholder="State" placeholderTextColor={Colors.light.textSecondary} />
                  </View>
                  <Text style={styles.fieldLabel}>Website</Text>
                  <TextInput style={styles.textInput} value={orgForm.website} onChangeText={(v) => setOrgForm((f) => ({ ...f, website: v }))} placeholder="https://..." placeholderTextColor={Colors.light.textSecondary} autoCapitalize="none" />
                  <Text style={styles.fieldLabel}>Notes</Text>
                  <TextInput style={[styles.textInput, styles.notesInput]} value={orgForm.notes} onChangeText={(v) => setOrgForm((f) => ({ ...f, notes: v }))} placeholder="Notes…" placeholderTextColor={Colors.light.textSecondary} multiline numberOfLines={3} />
                </ScrollView>
                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditOrgModal(false)}><Text style={styles.cancelBtnText}>Cancel</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.saveBtn} onPress={handleSaveOrg}><Text style={styles.saveBtnText}>Save Changes</Text></TouchableOpacity>
                </View>
              </Pressable>
            </KeyboardAvoidingView>
          </Pressable>
        </Modal>

        <Modal visible={contactModal} transparent animationType="fade" onRequestClose={() => setContactModal(false)}>
          <Pressable style={styles.modalOverlay} onPress={() => setContactModal(false)}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalKAV}>
              <Pressable style={styles.modalCard} onPress={() => {}}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{editingContact ? 'Edit Contact' : 'Add Contact'}</Text>
                  <TouchableOpacity onPress={() => setContactModal(false)}><X size={22} color={Colors.light.textSecondary} /></TouchableOpacity>
                </View>
                <ScrollView showsVerticalScrollIndicator={false}>
                  <View style={styles.rowInputs}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fieldLabel}>First Name *</Text>
                      <TextInput style={styles.textInput} value={contactForm.firstName} onChangeText={(v) => setContactForm((f) => ({ ...f, firstName: v }))} placeholder="First" placeholderTextColor={Colors.light.textSecondary} autoFocus />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fieldLabel}>Last Name</Text>
                      <TextInput style={styles.textInput} value={contactForm.lastName} onChangeText={(v) => setContactForm((f) => ({ ...f, lastName: v }))} placeholder="Last" placeholderTextColor={Colors.light.textSecondary} />
                    </View>
                  </View>
                  <Text style={styles.fieldLabel}>Role</Text>
                  <View style={styles.statusRow}>
                    {CONTACT_ROLES.map((r) => (
                      <TouchableOpacity key={r} style={[styles.statusChip, contactForm.role === r && styles.statusChipActive]} onPress={() => setContactForm((f) => ({ ...f, role: r }))}>
                        <Text style={[styles.statusChipText, contactForm.role === r && styles.statusChipTextActive]}>{r}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={styles.fieldLabel}>Email</Text>
                  <TextInput style={styles.textInput} value={contactForm.email} onChangeText={(v) => setContactForm((f) => ({ ...f, email: v }))} placeholder="email@example.com" placeholderTextColor={Colors.light.textSecondary} keyboardType="email-address" autoCapitalize="none" />
                  <Text style={styles.fieldLabel}>Phone</Text>
                  <TextInput style={styles.textInput} value={contactForm.phone} onChangeText={(v) => setContactForm((f) => ({ ...f, phone: v }))} placeholder="(555) 000-0000" placeholderTextColor={Colors.light.textSecondary} keyboardType="phone-pad" />
                  <Text style={styles.fieldLabel}>Notes</Text>
                  <TextInput style={[styles.textInput, styles.notesInput]} value={contactForm.notes} onChangeText={(v) => setContactForm((f) => ({ ...f, notes: v }))} placeholder="Notes about this contact…" placeholderTextColor={Colors.light.textSecondary} multiline numberOfLines={3} />
                  {(org.departments || []).length > 0 && (
                    <>
                      <Text style={styles.fieldLabel}>Department</Text>
                      <View style={styles.statusRow}>
                        <TouchableOpacity style={[styles.statusChip, !contactForm.departmentId && styles.statusChipActive]} onPress={() => setContactForm((f) => ({ ...f, departmentId: '' }))}>
                          <Text style={[styles.statusChipText, !contactForm.departmentId && styles.statusChipTextActive]}>None</Text>
                        </TouchableOpacity>
                        {(org.departments || []).map((d) => (
                          <TouchableOpacity key={d.id} style={[styles.statusChip, contactForm.departmentId === d.id && styles.statusChipActive]} onPress={() => setContactForm((f) => ({ ...f, departmentId: d.id }))}>
                            <Text style={[styles.statusChipText, contactForm.departmentId === d.id && styles.statusChipTextActive]}>{d.name}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </>
                  )}
                </ScrollView>
                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setContactModal(false)}><Text style={styles.cancelBtnText}>Cancel</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.saveBtn, !contactForm.firstName.trim() && styles.saveBtnDisabled]} onPress={handleSaveContact} disabled={!contactForm.firstName.trim()}>
                    <Text style={styles.saveBtnText}>{editingContact ? 'Save Changes' : 'Add Contact'}</Text>
                  </TouchableOpacity>
                </View>
              </Pressable>
            </KeyboardAvoidingView>
          </Pressable>
        </Modal>

        <Modal visible={activityModal} transparent animationType="fade" onRequestClose={() => setActivityModal(false)}>
          <Pressable style={styles.modalOverlay} onPress={() => setActivityModal(false)}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalKAV}>
              <Pressable style={styles.modalCard} onPress={() => {}}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Log Activity</Text>
                  <TouchableOpacity onPress={() => setActivityModal(false)}><X size={22} color={Colors.light.textSecondary} /></TouchableOpacity>
                </View>
                <ScrollView showsVerticalScrollIndicator={false}>
                  <Text style={styles.fieldLabel}>Type</Text>
                  <View style={styles.statusRow}>
                    {(['call', 'email', 'note', 'meeting', 'text'] as ActivityType[]).map((t) => {
                      const cfg = ACTIVITY_TYPE_CONFIG[t];
                      const sel = activityForm.type === t;
                      return (
                        <TouchableOpacity key={t} style={[styles.statusChip, sel && { backgroundColor: cfg.color + '20', borderColor: cfg.color }]} onPress={() => setActivityForm((f) => ({ ...f, type: t }))}>
                          <Text style={[styles.statusChipText, sel && { color: cfg.color, fontWeight: '700' as const }]}>{cfg.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <Text style={styles.fieldLabel}>Date</Text>
                  <TextInput style={styles.textInput} value={activityForm.date} onChangeText={(v) => setActivityForm((f) => ({ ...f, date: v }))} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.light.textSecondary} />
                  {org.contacts.length > 0 && (
                    <>
                      <Text style={styles.fieldLabel}>Contact (optional)</Text>
                      <View style={styles.statusRow}>
                        <TouchableOpacity style={[styles.statusChip, !activityForm.contactId && styles.statusChipActive]} onPress={() => setActivityForm((f) => ({ ...f, contactId: '' }))}>
                          <Text style={[styles.statusChipText, !activityForm.contactId && styles.statusChipTextActive]}>Any</Text>
                        </TouchableOpacity>
                        {org.contacts.map((c) => (
                          <TouchableOpacity key={c.id} style={[styles.statusChip, activityForm.contactId === c.id && styles.statusChipActive]} onPress={() => setActivityForm((f) => ({ ...f, contactId: c.id }))}>
                            <Text style={[styles.statusChipText, activityForm.contactId === c.id && styles.statusChipTextActive]}>{c.firstName} {c.lastName}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </>
                  )}
                  <Text style={styles.fieldLabel}>Subject (optional)</Text>
                  <TextInput style={styles.textInput} value={activityForm.subject} onChangeText={(v) => setActivityForm((f) => ({ ...f, subject: v }))} placeholder="Brief subject…" placeholderTextColor={Colors.light.textSecondary} />
                  <Text style={styles.fieldLabel}>Notes *</Text>
                  <TextInput style={[styles.textInput, styles.notesInput]} value={activityForm.body} onChangeText={(v) => setActivityForm((f) => ({ ...f, body: v }))} placeholder="What happened? What was discussed?" placeholderTextColor={Colors.light.textSecondary} multiline numberOfLines={4} autoFocus />
                </ScrollView>
                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setActivityModal(false)}><Text style={styles.cancelBtnText}>Cancel</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.saveBtn, !activityForm.body.trim() && styles.saveBtnDisabled]} onPress={handleSaveActivity} disabled={!activityForm.body.trim()}>
                    <Text style={styles.saveBtnText}>Log Activity</Text>
                  </TouchableOpacity>
                </View>
              </Pressable>
            </KeyboardAvoidingView>
          </Pressable>
        </Modal>

        <Modal visible={deptModal} transparent animationType="fade" onRequestClose={() => setDeptModal(false)}>
          <Pressable style={styles.modalOverlay} onPress={() => setDeptModal(false)}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalKAV}>
              <Pressable style={styles.modalCard} onPress={() => {}}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{editingDept ? 'Edit Department' : 'Add Department'}</Text>
                  <TouchableOpacity onPress={() => setDeptModal(false)}><X size={22} color={Colors.light.textSecondary} /></TouchableOpacity>
                </View>
                <Text style={styles.fieldLabel}>Department Name *</Text>
                <TextInput style={styles.textInput} value={deptForm.name} onChangeText={(v) => setDeptForm((f) => ({ ...f, name: v }))} placeholder="e.g., Youth, Communications, Admin…" placeholderTextColor={Colors.light.textSecondary} autoFocus />
                <Text style={styles.fieldLabel}>Description (optional)</Text>
                <TextInput style={[styles.textInput, styles.notesInput]} value={deptForm.description} onChangeText={(v) => setDeptForm((f) => ({ ...f, description: v }))} placeholder="Brief description of this department…" placeholderTextColor={Colors.light.textSecondary} multiline numberOfLines={2} />
                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setDeptModal(false)}><Text style={styles.cancelBtnText}>Cancel</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.saveBtn, !deptForm.name.trim() && styles.saveBtnDisabled]} onPress={handleSaveDept} disabled={!deptForm.name.trim()}>
                    <Text style={styles.saveBtnText}>{editingDept ? 'Save' : 'Add Department'}</Text>
                  </TouchableOpacity>
                </View>
              </Pressable>
            </KeyboardAvoidingView>
          </Pressable>
        </Modal>

        <Modal visible={campaignModal} transparent animationType="fade" onRequestClose={() => setCampaignModal(false)}>
          <Pressable style={styles.modalOverlay} onPress={() => setCampaignModal(false)}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalKAV}>
              <Pressable style={styles.modalCard} onPress={() => {}}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Start Campaign</Text>
                  <TouchableOpacity onPress={() => setCampaignModal(false)}><X size={22} color={Colors.light.textSecondary} /></TouchableOpacity>
                </View>
                <ScrollView showsVerticalScrollIndicator={false}>
                  <Text style={styles.fieldLabel}>Select a Campaign Template</Text>
                  {templates.map((tpl) => (
                    <TouchableOpacity key={tpl.id} style={[styles.templateOption, selectedTemplateId === tpl.id && styles.templateOptionActive]} onPress={() => setSelectedTemplateId(tpl.id)}>
                      <View style={styles.templateOptionHeader}>
                        <Text style={styles.templateOptionName}>{tpl.name}</Text>
                        <View style={[styles.templateRadio, selectedTemplateId === tpl.id && styles.templateRadioActive]} />
                      </View>
                      {tpl.description && <Text style={styles.templateOptionDesc}>{tpl.description}</Text>}
                      <Text style={styles.templateOptionSteps}>{tpl.steps.length} steps</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setCampaignModal(false)}><Text style={styles.cancelBtnText}>Cancel</Text></TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.saveBtn, !selectedTemplateId && styles.saveBtnDisabled]}
                    disabled={!selectedTemplateId}
                    onPress={() => { assignCampaign({ orgId: org.id, templateId: selectedTemplateId }); setCampaignModal(false); setSelectedTemplateId(undefined); }}
                  >
                    <Text style={styles.saveBtnText}>Start Campaign</Text>
                  </TouchableOpacity>
                </View>
              </Pressable>
            </KeyboardAvoidingView>
          </Pressable>
        </Modal>

      </View>
    );
  }
  // ─── END V2 ──────────────────────────────────────────────────────────────────

  return null;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  notFound: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  notFoundText: { fontSize: 16, color: Colors.light.textSecondary },
  notFoundBtn: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: Colors.light.tint, borderRadius: 8 },
  notFoundBtnText: { color: '#fff', fontWeight: '600' as const },

  desktopLayout: { flex: 1, flexDirection: 'row' },
  desktopLeft: { width: 300, borderRightWidth: 1, borderRightColor: Colors.light.border, backgroundColor: Colors.light.surface },
  desktopLeftContent: { padding: 16 },
  desktopRight: { flex: 1, display: 'flex' as any, flexDirection: 'column' },
  mobileScroll: { flex: 1 },

  leftPanel: { gap: 14 },

  leadBanner: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    padding: 14,
  },
  leadBannerHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  leadBannerTitle: { fontSize: 14, fontWeight: '700' as const, color: '#1D4ED8' },
  leadBannerSub: { fontSize: 12, color: '#374151', lineHeight: 17, marginBottom: 10 },
  leadCampaignRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  leadCampaignText: { fontSize: 12, color: Colors.light.tint, fontWeight: '500' as const },

  statusChangeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  statusChip: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 8, borderWidth: 1.5,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.background,
  },
  statusChipActive: { borderColor: Colors.light.tint, backgroundColor: '#FFF4EE' },
  statusChipText: { fontSize: 12, color: Colors.light.textSecondary, fontWeight: '500' as const },
  statusChipTextActive: { color: Colors.light.tint, fontWeight: '700' as const },

  orgInfoCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 18,
    alignItems: 'center',
  },
  orgAvatarLarge: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: Colors.light.tint,
    justifyContent: 'center', alignItems: 'center', marginBottom: 10,
  },
  orgAvatarInitial: { fontSize: 28, fontWeight: '800' as const, color: '#fff' },
  orgNameLarge: { fontSize: 20, fontWeight: '800' as const, color: Colors.light.text, textAlign: 'center' },
  orgTypeLarge: { fontSize: 13, color: Colors.light.textSecondary, marginTop: 3, marginBottom: 6 },

  divider: { width: '100%', height: 1, backgroundColor: Colors.light.border, marginVertical: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', marginBottom: 6 },
  infoText: { fontSize: 13, color: Colors.light.text },
  notesLabel: { fontSize: 11, fontWeight: '700' as const, color: Colors.light.textSecondary, textTransform: 'uppercase' as const, letterSpacing: 0.4, alignSelf: 'flex-start', marginBottom: 5 },
  notesText: { fontSize: 13, color: Colors.light.textSecondary, lineHeight: 18, alignSelf: 'flex-start' },

  statsRow: { flexDirection: 'row', gap: 12, width: '100%', justifyContent: 'center' },
  statBox: { flex: 1, alignItems: 'center', backgroundColor: Colors.light.background, borderRadius: 10, padding: 10, gap: 3 },
  statValue: { fontSize: 15, fontWeight: '800' as const, color: Colors.light.text },
  statLabel: { fontSize: 10, color: Colors.light.textSecondary, fontWeight: '500' as const },

  editOrgBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.light.surface, paddingHorizontal: 12,
    paddingVertical: 9, borderRadius: 9,
    justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.light.border,
  },
  editOrgBtnText: { fontSize: 13, fontWeight: '600' as const, color: Colors.light.text },
  deleteOrgBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.light.background, paddingHorizontal: 12,
    paddingVertical: 9, borderRadius: 9,
    justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.light.border,
  },
  deleteOrgBtnText: { fontSize: 13, fontWeight: '600' as const, color: Colors.light.error },
  memberSince: { fontSize: 11, color: Colors.light.textSecondary, marginTop: 10 },

  badge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, borderWidth: 1, marginTop: 8 },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' as const },

  rightPanel: { flex: 1, flexDirection: 'column' as const },
  tabBar: {
    flexDirection: 'row', borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    backgroundColor: Colors.light.surface,
  },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: Colors.light.tint },
  tabText: { fontSize: 14, fontWeight: '500' as const, color: Colors.light.textSecondary },
  tabTextActive: { color: Colors.light.tint, fontWeight: '700' as const },
  tabBadge: { backgroundColor: Colors.light.border, borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  tabBadgeActive: { backgroundColor: Colors.light.tint },
  tabBadgeText: { fontSize: 10, fontWeight: '700' as const, color: Colors.light.textSecondary },
  tabBadgeTextActive: { color: '#fff' },

  tabContent: { flex: 1, padding: 16 },
  tabContentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  tabContentTitle: { fontSize: 16, fontWeight: '700' as const, color: Colors.light.text },
  addItemBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.light.tint, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  addItemBtnText: { fontSize: 13, fontWeight: '600' as const, color: '#fff' },

  emptyTab: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8, paddingVertical: 50 },
  emptyTabText: { fontSize: 15, fontWeight: '600' as const, color: Colors.light.text },
  emptyTabSub: { fontSize: 13, color: Colors.light.textSecondary, textAlign: 'center' },

  tabContentScroll: { flex: 1 },
  tabContentPad: { padding: 16, gap: 0 },

  orgNotesCard: {
    backgroundColor: Colors.light.surface, borderRadius: 12, borderWidth: 1,
    borderColor: Colors.light.border, padding: 14, marginBottom: 14,
  },
  orgNotesLabel: { fontSize: 11, fontWeight: '700' as const, color: Colors.light.textSecondary, textTransform: 'uppercase' as const, letterSpacing: 0.6, marginBottom: 6 },
  orgNotesText: { fontSize: 14, color: Colors.light.text, lineHeight: 20 },

  gmailBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    backgroundColor: '#EEF3FF', borderRadius: 12, borderWidth: 1,
    borderColor: '#C7D7FC', padding: 16, marginBottom: 16,
  },
  gmailBannerTitle: { fontSize: 14, fontWeight: '700' as const, color: '#1D3BBC', marginBottom: 4 },
  gmailBannerSub: { fontSize: 13, color: '#3B55CC', lineHeight: 18 },

  activityEntry: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.light.border,
  },
  activityEntrySystem: {
    backgroundColor: '#FAFAFA',
    marginHorizontal: -12,
    paddingHorizontal: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#E5E7EB',
  },
  activityIcon: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  activityBody: { flex: 1 },
  activityHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 },
  activityType: { fontSize: 12, fontWeight: '700' as const, color: Colors.light.text },
  activityContact: { fontSize: 12, color: Colors.light.textSecondary },
  activityDate: { fontSize: 11, color: Colors.light.textSecondary, marginLeft: 'auto' as any },
  activitySubject: { fontSize: 13, fontWeight: '600' as const, color: Colors.light.text, marginBottom: 3 },
  activityNote: { fontSize: 13, color: Colors.light.textSecondary, lineHeight: 18 },
  activityDelete: { padding: 6, marginTop: 2 },

  contactCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    padding: 12, borderRadius: 12, borderWidth: 1,
    borderColor: Colors.light.border, backgroundColor: Colors.light.background,
    marginBottom: 10,
  },
  contactAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.light.tint, justifyContent: 'center', alignItems: 'center' },
  contactAvatarText: { fontSize: 16, fontWeight: '700' as const, color: '#fff' },
  contactAvatarPrimary: { backgroundColor: Colors.light.tint, borderWidth: 2, borderColor: '#FF8C40' },
  contactAvatarTextPrimary: { color: '#fff' },
  contactInfo: { flex: 1 },
  contactNameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  contactName: { fontSize: 14, fontWeight: '700' as const, color: Colors.light.text },
  primaryBadge: { backgroundColor: '#FFF4EE', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: '#FF5A00' },
  primaryBadgeText: { fontSize: 10, fontWeight: '700' as const, color: '#FF5A00' },
  contactRole: { fontSize: 12, color: Colors.light.textSecondary, marginTop: 2 },
  contactDetails: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 5 },
  contactDetailRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  contactDetailText: { fontSize: 12, color: Colors.light.textSecondary },
  contactNotes: { fontSize: 12, color: Colors.light.textSecondary, marginTop: 5, fontStyle: 'italic' },
  contactActions: { flexDirection: 'row', gap: 4 },
  contactActionBtn: { padding: 6, borderRadius: 6 },
  contactActionBtnPrimary: { backgroundColor: '#FFF4EE', borderRadius: 6 },
  contactHubBtn: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.background,
    padding: 6,
  },
  contactHubBtnActive: {
    borderColor: '#FF5A0030',
    backgroundColor: '#FF5A0010',
  },

  quoteRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.light.border,
  },
  quoteRowLeft: { flex: 1 },
  quoteProject: { fontSize: 14, fontWeight: '600' as const, color: Colors.light.text },
  quoteMeta: { flexDirection: 'row', gap: 8, marginTop: 3 },
  quoteNum: { fontSize: 12, color: Colors.light.textSecondary },
  quoteDate: { fontSize: 12, color: Colors.light.textSecondary },
  quoteRowRight: { alignItems: 'flex-end', marginRight: 8 },
  quoteAmount: { fontSize: 14, fontWeight: '700' as const, color: Colors.light.text },
  quoteStatus: { fontSize: 10, fontWeight: '700' as const, color: Colors.light.tint, marginTop: 2 },

  campaignCard: {
    backgroundColor: Colors.light.background, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.light.border,
    marginBottom: 14, overflow: 'hidden',
  },
  campaignHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12, backgroundColor: Colors.light.surface,
    borderBottomWidth: 1, borderBottomColor: Colors.light.border,
  },
  campaignHeaderLeft: { flex: 1 },
  campaignName: { fontSize: 14, fontWeight: '700' as const, color: Colors.light.text },
  campaignDate: { fontSize: 11, color: Colors.light.textSecondary, marginTop: 2 },
  campaignProgress: { alignItems: 'flex-end', gap: 4 },
  campaignProgressText: { fontSize: 12, fontWeight: '600' as const, color: Colors.light.textSecondary },
  campaignProgressBar: { width: 60, height: 4, backgroundColor: Colors.light.border, borderRadius: 2, overflow: 'hidden' },
  campaignProgressFill: { height: 4, backgroundColor: Colors.light.tint, borderRadius: 2 },
  campaignDelete: { padding: 6 },

  campaignStep: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    padding: 10, borderBottomWidth: 1, borderBottomColor: Colors.light.border,
  },
  campaignStepNum: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: Colors.light.border, justifyContent: 'center', alignItems: 'center',
    marginTop: 2,
  },
  campaignStepNumText: { fontSize: 11, fontWeight: '700' as const, color: Colors.light.textSecondary },
  campaignStepInfo: { flex: 1 },
  campaignStepLabel: { fontSize: 13, fontWeight: '600' as const, color: Colors.light.text },
  campaignStepMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  campaignStepTypeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  campaignStepTypeText: { fontSize: 11, fontWeight: '600' as const },
  campaignStepDate: { fontSize: 11, color: Colors.light.textSecondary },
  campaignStepStatus: { maxWidth: 180 },
  stepStatusRow: { flexDirection: 'row', gap: 4 },
  stepStatusBtn: {
    paddingHorizontal: 7, paddingVertical: 4,
    borderRadius: 6, borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.surface,
  },
  stepStatusBtnText: { fontSize: 10, color: Colors.light.textSecondary },

  templateOption: {
    padding: 14, borderRadius: 12, borderWidth: 2,
    borderColor: Colors.light.border, backgroundColor: Colors.light.background,
    marginBottom: 10,
  },
  templateOptionActive: { borderColor: Colors.light.tint, backgroundColor: '#FFF4EE' },
  templateOptionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  templateOptionName: { fontSize: 14, fontWeight: '700' as const, color: Colors.light.text },
  templateOptionDesc: { fontSize: 12, color: Colors.light.textSecondary, marginTop: 4 },
  templateOptionSteps: { fontSize: 11, color: Colors.light.tint, fontWeight: '600' as const, marginTop: 6 },
  templateRadio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: Colors.light.border },
  templateRadioActive: { borderColor: Colors.light.tint, backgroundColor: Colors.light.tint },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalKAV: { width: '100%', maxWidth: 520, paddingHorizontal: 16 },
  modalCard: { backgroundColor: Colors.light.surface, borderRadius: 18, padding: 20, maxHeight: '90%' as any },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  modalTitle: { fontSize: 18, fontWeight: '800' as const, color: Colors.light.text },

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
    backgroundColor: Colors.light.surface, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.light.border,
    marginTop: 4, overflow: 'hidden',
  },
  typeDropdownItem: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.light.border },
  typeDropdownText: { fontSize: 14, color: Colors.light.text },
  typeDropdownTextActive: { color: Colors.light.tint, fontWeight: '700' as const },

  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },

  primaryToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, marginBottom: 6 },
  primaryToggleText: { fontSize: 14, color: Colors.light.text },

  modalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn: { flex: 1, paddingVertical: 13, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.light.border, alignItems: 'center' },
  cancelBtnText: { fontSize: 15, fontWeight: '600' as const, color: Colors.light.textSecondary },
  saveBtn: { flex: 2, backgroundColor: Colors.light.tint, paddingVertical: 13, borderRadius: 10, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { fontSize: 15, fontWeight: '700' as const, color: '#fff' },

  tabHeaderBtns: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addItemBtnSecondary: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
    borderWidth: 1.5, borderColor: Colors.light.tint,
  },
  addItemBtnSecondaryText: { fontSize: 13, fontWeight: '600' as const, color: Colors.light.tint },

  activeProjectsBanner: {
    backgroundColor: '#F5F3FF', borderRadius: 12,
    borderWidth: 1, borderColor: '#DDD6FE',
    padding: 12, marginBottom: 12,
  },
  activeProjectsHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  activeProjectsTitle: { fontSize: 12, fontWeight: '700', color: '#7C3AED', flex: 1 },
  activeProjectsCount: {
    fontSize: 11, fontWeight: '700', color: '#7C3AED',
    backgroundColor: '#EDE9FE', paddingHorizontal: 7, paddingVertical: 1, borderRadius: 10,
  },
  activeProjectRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderTopWidth: 1, borderTopColor: '#EDE9FE' },
  activeProjectLeft: { flex: 1 },
  activeProjectName: { fontSize: 13, fontWeight: '600', color: Colors.light.text },
  activeProjectNum: { fontSize: 11, color: Colors.light.textSecondary },
  activeProjectStatusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  activeProjectStatusText: { fontSize: 11, fontWeight: '700' },

  contactsMiniPanel: {
    backgroundColor: Colors.light.surface, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.light.border,
    padding: 12, marginBottom: 12,
  },
  contactsMiniHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  contactsMiniTitle: { fontSize: 12, fontWeight: '700', color: Colors.light.tint, flex: 1 },
  contactsMiniCount: {
    fontSize: 11, fontWeight: '700', color: Colors.light.tint,
    backgroundColor: Colors.light.highlightBg, paddingHorizontal: 7, paddingVertical: 1, borderRadius: 10,
  },
  contactsMiniRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    paddingVertical: 7, borderTopWidth: 1, borderTopColor: Colors.light.border,
  },
  contactsMiniAvatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.light.highlightBg,
    alignItems: 'center', justifyContent: 'center',
  },
  contactsMiniAvatarText: { fontSize: 12, fontWeight: '700', color: Colors.light.tint },
  contactsMiniInfo: { flex: 1 },
  contactsMiniName: { fontSize: 12, fontWeight: '600', color: Colors.light.text },
  contactsMiniRole: { fontSize: 11, color: Colors.light.textSecondary, marginBottom: 2 },
  contactsMiniDetail: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  contactsMiniDetailText: { fontSize: 11, color: Colors.light.textSecondary, flex: 1 },
  contactsMiniViewAll: { paddingTop: 8, alignItems: 'flex-end' },
  contactsMiniViewAllText: { fontSize: 11, color: Colors.light.tint, fontWeight: '600' },

  newQuoteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Colors.light.tint, borderRadius: 10,
    paddingVertical: 11, marginBottom: 8,
  },
  newQuoteBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  editDeleteRow: { flexDirection: 'row', gap: 8, marginBottom: 0 },

  deptSection: { marginBottom: 4 },
  deptHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 4, paddingVertical: 8, marginBottom: 2,
    borderBottomWidth: 1, borderBottomColor: Colors.light.border,
  },
  deptHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  deptName: { fontSize: 13, fontWeight: '700' as const, color: Colors.light.text, letterSpacing: 0.3 },
  deptCount: { fontSize: 12, color: Colors.light.textSecondary, backgroundColor: Colors.light.border, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 10 },
  deptHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  deptAddBtn: { padding: 6, borderRadius: 6, backgroundColor: `${Colors.light.tint}15` },
  deptActionBtn: { padding: 6, borderRadius: 6 },
  deptEmpty: { fontSize: 12, color: Colors.light.textSecondary, fontStyle: 'italic', paddingHorizontal: 8, paddingVertical: 10 },

  hubToggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.light.surface, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.light.border,
    padding: 14, marginBottom: 16,
  },
  hubToggleLabel: { fontSize: 15, fontWeight: '600' as const, color: Colors.light.text },
  hubToggleSub: { fontSize: 12, color: Colors.light.textSecondary, marginTop: 2 },

  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 2,
    borderBottomWidth: 1, borderBottomColor: Colors.light.border,
  },
  memberRowAdmin: {
    backgroundColor: '#FFF7ED',
    borderRadius: 8,
    borderBottomWidth: 0,
    marginBottom: 1,
    paddingHorizontal: 6,
  },
  memberAvatar: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
  },
  memberAvatarText: { fontSize: 14, fontWeight: '700' as const, color: '#fff' },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 14, fontWeight: '600' as const, color: Colors.light.text },
  memberRole: { fontSize: 12, color: Colors.light.textSecondary, marginTop: 1 },
  memberDelete: { padding: 6 },
  adminBadge: {
    backgroundColor: '#FF5A00',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  adminBadgeText: { fontSize: 10, fontWeight: '700' as const, color: '#fff', textTransform: 'uppercase' as const },

  userPickerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 9, paddingHorizontal: 4,
    borderRadius: 8, marginBottom: 2,
  },
  userPickerRowSelected: { backgroundColor: `#FF5A0012` },
  userPickerName: { flex: 1, fontSize: 14, color: Colors.light.text },

  orgIdentityCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 18,
    alignItems: 'center' as const,
    position: 'relative' as const,
  },
  orgMenuBtn: {
    position: 'absolute' as const, top: 10, right: 10,
    width: 30, height: 30, borderRadius: 8,
    justifyContent: 'center' as const, alignItems: 'center' as const,
    zIndex: 10,
  },
  orgMenuOverlay: {
    flex: 1,
  },
  orgMenuDropdown: {
    position: 'absolute' as const, top: 44, right: 8,
    backgroundColor: Colors.light.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingVertical: 4,
    minWidth: 160,
    zIndex: 99,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  orgMenuItem: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  orgMenuItemDanger: {
    borderTopWidth: 1, borderTopColor: Colors.light.border,
  },
  orgMenuItemText: { fontSize: 14, color: Colors.light.text },
  orgStatusBadge: {
    position: 'absolute' as const,
    top: 12,
    left: 12,
    zIndex: 5,
  },
  orgLogoWrap: {
    alignItems: 'center' as const,
    marginBottom: 12,
    marginTop: 8,
  },
  orgInfoBlock: {
    alignSelf: 'stretch' as const,
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    paddingTop: 4,
  },
  orgInfoRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 8,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  orgInfoKey: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
    width: 78,
    flexShrink: 0,
    paddingTop: 1,
  },
  orgInfoVal: {
    flex: 1,
    fontSize: 12,
    color: Colors.light.text,
    lineHeight: 17,
  },

  leftInfoCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 12,
    gap: 8,
  },
  leftInfoCardLabel: {
    fontSize: 10, fontWeight: '700' as const, color: Colors.light.textSecondary,
    textTransform: 'uppercase' as const, letterSpacing: 0.5,
  },
  leftPersonRow: { flexDirection: 'row' as const, alignItems: 'flex-start' as const, gap: 10 },
  leftPersonAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.light.tint,
    justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
  },
  leftPersonAvatarText: { fontSize: 15, fontWeight: '800' as const, color: '#fff' },
  leftPersonName: { fontSize: 14, fontWeight: '700' as const, color: Colors.light.text },
  leftPersonRole: { fontSize: 12, color: Colors.light.textSecondary, marginTop: 1 },
  leftPersonDetail: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 5, marginTop: 3 },
  leftPersonDetailText: { fontSize: 12, color: Colors.light.textSecondary, flex: 1 },
  leftRepUnassigned: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6,
    paddingVertical: 4,
  },
  leftRepUnassignedText: { fontSize: 13, color: Colors.light.textSecondary, fontStyle: 'italic' as const },

  leftStatsRow: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12, borderWidth: 1, borderColor: Colors.light.border,
    padding: 14, flexDirection: 'row' as const, alignItems: 'center' as const,
  },
  leftStatBox: { flex: 1, alignItems: 'center' as const, gap: 3 },
  leftStatValue: { fontSize: 18, fontWeight: '800' as const, color: Colors.light.text },
  leftStatLabel: { fontSize: 11, color: Colors.light.textSecondary, fontWeight: '500' as const },
  leftStatDivider: { width: 1, height: 32, backgroundColor: Colors.light.border },

  rightPanelContent: { padding: 16, gap: 16 },

  infoCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 14, borderWidth: 1,
    borderColor: Colors.light.border,
    paddingTop: 0,
    paddingHorizontal: 14,
    paddingBottom: 14,
    overflow: 'hidden' as const,
  },
  infoCardHeader: {
    flexDirection: 'row' as const, alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    backgroundColor: '#000',
    marginHorizontal: -14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  infoCardHeaderLeft: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 7 },
  infoCardTitle: { fontSize: 13, fontWeight: '700' as const, color: '#fff', textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  infoCardBadge: {
    backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 10,
    paddingHorizontal: 6, paddingVertical: 1,
    minWidth: 18, alignItems: 'center' as const,
  },
  infoCardBadgeText: { fontSize: 11, fontWeight: '700' as const, color: '#fff' },
  infoCardViewAll: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.light.primary,
  },
  infoCardAction: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
    backgroundColor: Colors.light.tint,
  },
  infoCardActionText: { fontSize: 12, fontWeight: '600' as const, color: '#fff' },
  hubToggleBtn: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  hubToggleBtnText: { fontSize: 11, fontWeight: '600' as const, color: 'rgba(255,255,255,0.7)' },
  hubToggleBtnTextOn: { color: '#FF5A00' },
  infoCardActionSecondary: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 3,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  infoCardActionSecondaryText: { fontSize: 12, fontWeight: '600' as const, color: '#fff' },
  infoCardSubHeader: {
    flexDirection: 'row' as const, alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingTop: 8, paddingBottom: 6,
    borderTopWidth: 1, borderTopColor: Colors.light.border,
  },
  infoCardSubTitle: { fontSize: 12, fontWeight: '700' as const, color: Colors.light.textSecondary, textTransform: 'uppercase' as const, letterSpacing: 0.4 },
  emptyCard: { paddingVertical: 18, alignItems: 'center' as const, gap: 4 },
  emptyCardText: { fontSize: 14, fontWeight: '600' as const, color: Colors.light.text },
  emptyCardSub: { fontSize: 12, color: Colors.light.textSecondary, textAlign: 'center' as const },

  projectRow: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8,
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.light.border,
  },
  projectRowLeft: { flex: 1 },
  projectRowName: { fontSize: 13, fontWeight: '600' as const, color: Colors.light.text },
  projectRowNum: { fontSize: 11, color: Colors.light.textSecondary, marginTop: 1 },
  projectRowBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  projectRowBadgeText: { fontSize: 11, fontWeight: '700' as const },

  projectRowExpanded: {
    paddingVertical: 11, borderTopWidth: 1, borderTopColor: Colors.light.border, gap: 5,
  },
  projectRowExpandedTop: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 7,
  },
  projectRowExpandedMeta: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, paddingLeft: 2,
  },
  projectRowExpandedBottom: {
    flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, flexWrap: 'wrap' as const, gap: 6, paddingLeft: 2,
  },
  projectMetaItem: { fontSize: 11, color: Colors.light.textSecondary },
  projectMetaSep: { fontSize: 11, color: Colors.light.border },
  projectMetaService: { fontSize: 11, color: Colors.light.textSecondary, flex: 1 },
  projectMetaNumbers: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
  projectMetaPcs: { fontSize: 11, color: Colors.light.textSecondary },
  projectMetaTotal: { fontSize: 13, fontWeight: '700' as const, color: Colors.light.text },
  projectMetaMarkup: { fontSize: 12, fontWeight: '600' as const, color: '#FF5A00' },

  legacyKpiGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 10,
    paddingTop: 4,
  },
  legacyKpiCard: {
    flexGrow: 1,
    minWidth: 0,
    backgroundColor: Colors.light.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 12,
    gap: 8,
  },
  legacyKpiHead: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  legacyKpiDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  legacyKpiName: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
    color: Colors.light.textSecondary,
  },
  legacyKpiPct: { ...metricValueStyle },
  legacyKpiStats: { gap: 4 },
  legacyKpiStatRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: 8,
  },
  legacyKpiStatLabel: { fontSize: 11, color: Colors.light.textSecondary },
  legacyKpiStatVal: { fontSize: 12, fontWeight: '700' as const, color: Colors.light.text },
  legacyDonutRow: {
    flexDirection: 'row' as const, justifyContent: 'space-around' as const,
    alignItems: 'flex-start' as const, paddingVertical: 12, paddingHorizontal: 4,
  },
  legacyDonutItem: {
    alignItems: 'center' as const, gap: 8, cursor: 'default' as any,
  },
  legacyDonutOuter: {
    width: 82, height: 82, borderRadius: 41,
    justifyContent: 'center' as const, alignItems: 'center' as const,
  },
  legacyDonutInner: {
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: Colors.light.surface,
    justifyContent: 'center' as const, alignItems: 'center' as const, gap: 1,
  },
  legacyDonutPct: {
    fontSize: 15, fontWeight: '800' as const, color: Colors.light.text, lineHeight: 18,
  },
  legacyDonutPcs: {
    fontSize: 8, color: Colors.light.textSecondary, textAlign: 'center' as const, lineHeight: 11,
  },
  legacyDonutLabel: {
    fontSize: 10, fontWeight: '600' as const, textAlign: 'center' as const,
    maxWidth: 70, lineHeight: 13,
  },
  legacyTooltip: {
    backgroundColor: Colors.light.background, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.light.border,
    borderLeftWidth: 3, padding: 10, marginTop: 4, gap: 6,
  },
  legacyTooltipTitle: {
    fontSize: 12, fontWeight: '700' as const, marginBottom: 2,
  },
  legacyTooltipRow: {
    flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 10,
  },
  legacyTooltipItem: {
    fontSize: 11, color: Colors.light.textSecondary,
  },
  legacyTooltipBold: {
    fontWeight: '700' as const, color: Colors.light.text,
  },

  revenueStatsRow: {
    flexDirection: 'row' as const, flexWrap: 'wrap' as const,
    gap: 10, backgroundColor: '#EBEBEB', borderRadius: 12,
    padding: 12, marginBottom: 12,
  },
  revenueStatBox: { flex: 1, minWidth: 80, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 10, backgroundColor: Colors.light.surface, alignItems: 'center' as const, gap: 3 },
  // Metric typography is standardized app-wide — keep these as aliases of the
  // shared constants in components/Metric.tsx so sections never drift.
  revenueStatValue: { ...metricValueStyle },
  revenueStatLabel: { ...metricLabelStyle },
  revenueStatDivider: { display: 'none' as any },

  portalPanel: {
    backgroundColor: Colors.light.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 10,
    marginBottom: 4,
    gap: 8,
  },
  portalUrlRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
  },
  portalUrlText: {
    flex: 1,
    fontSize: 11,
    color: Colors.light.textSecondary,
    fontFamily: 'monospace',
  },
  portalActions: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  portalVisitBtn: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 5,
    backgroundColor: Colors.light.tint,
    borderRadius: 7,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  portalVisitBtnText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#fff',
  },
  portalIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: Colors.light.surface,
  },

  orgMediaEmptyBin: {
    position: 'relative' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 36,
    paddingHorizontal: 12,
    gap: 14,
    marginTop: 10,
    borderRadius: 12,
    backgroundColor: '#FF7B33',
    overflow: 'hidden' as const,
  },
  orgMediaDropZoneActive: {
    borderWidth: 1.5,
    borderColor: '#1A1210',
    backgroundColor: '#CC6A40',
  },
  mediaDot: {
    position: 'absolute' as const,
    borderRadius: 999,
    backgroundColor: '#1A1210',
    opacity: 0.3,
  },
  mediaBinIconRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
    justifyContent: 'center' as const,
    marginBottom: 4,
  },
  mediaBinCard: {
    width: 58,
    height: 58,
    borderRadius: 12,
    backgroundColor: '#1C1C1C',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  mediaBinCardCenter: {
    width: 66,
    height: 66,
    borderRadius: 14,
    backgroundColor: '#222222',
    borderColor: '#333333',
    zIndex: 3,
  },
  mediaBinEmptyText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#1A1210',
    textAlign: 'center' as const,
  },
  mediaBinEmptySub: {
    fontSize: 11,
    color: '#3A2218',
    textAlign: 'center' as const,
    marginTop: -6,
  },
  orgMediaGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    marginHorizontal: -5,
    marginTop: 10,
  },
  orgMediaCardExt: {
    fontSize: 13,
    fontWeight: '800' as const,
    color: Colors.light.tint,
    letterSpacing: 0.5,
  },
  orgMediaItem: {
    width: Platform.OS === 'web' ? 176 : 135,
    gap: 4,
  },
  orgMediaThumb: {
    width: Platform.OS === 'web' ? 176 : 135,
    height: Platform.OS === 'web' ? 140 : 108,
    borderRadius: 8,
    backgroundColor: Colors.light.border,
  },
  orgMediaIcon: {
    width: Platform.OS === 'web' ? 176 : 135,
    height: Platform.OS === 'web' ? 140 : 108,
    borderRadius: 8,
    backgroundColor: Colors.light.background,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 4,
  },
  orgMediaExt: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.light.tint,
    letterSpacing: 0.5,
  },
  orgMediaName: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.light.text,
    lineHeight: 14,
  },
  orgMediaMeta: {
    fontSize: 10,
    color: Colors.light.textSecondary,
    lineHeight: 13,
  },
  orgMediaActions: {
    flexDirection: 'row' as const,
    gap: 6,
  },
  orgMediaActionBtn: {
    padding: 3,
  },

  // ── V2 Layout ──────────────────────────────────────────────────────────────
  v2Header: {
    backgroundColor: Colors.light.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    paddingTop: 8,
  },
  v2HeaderTop: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 12,
  },
  v2HeaderInfo: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  v2HeaderNameRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    flexWrap: 'wrap' as const,
  },
  v2OrgName: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.light.text,
    flexShrink: 1,
  },
  v2OrgMeta: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  v2HeaderActions: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  v2NewQuoteBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  v2NewQuoteBtnText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#fff',
  },
  v2HeaderIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.light.background,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  v2OrgMenuDropdown: {
    position: 'absolute' as any,
    top: 46,
    right: 0,
    zIndex: 99,
  },
  v2TabBar: {
    backgroundColor: Colors.light.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  v2Tab: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 5,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  v2TabActive: {
    borderBottomColor: Colors.light.tint,
  },
  v2TabText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.light.textSecondary,
  },
  v2TabTextActive: {
    color: Colors.light.tint,
    fontWeight: '600' as const,
  },
  v2TabBadge: {
    backgroundColor: Colors.light.border,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 18,
    alignItems: 'center' as const,
  },
  v2TabBadgeActive: {
    backgroundColor: Colors.light.tint + '22',
  },
  v2TabBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
  },
  v2TabBadgeTextActive: {
    color: Colors.light.tint,
  },
  v2Body: {
    flex: 1,
    flexDirection: 'row' as const,
  },
  v2LeftCol: {
    width: 320,
    backgroundColor: Colors.light.surface,
  },
  v2LeftColContent: {
    padding: 16,
    gap: 14,
  },
  v2ColDivider: {
    width: 1,
    backgroundColor: Colors.light.border,
  },
  v2RightCol: {
    flex: 1,
  },
  v2RightColContent: {
    padding: 16,
    gap: 14,
  },
  v2MobileContent: {
    padding: 12,
    gap: 14,
  },

  // ── V2 Hierarchical Overview ─────────────────────────────────────────────
  v2OverviewScroll: { flex: 1 },
  v2OverviewContent: { padding: 12, gap: 8, flexGrow: 1 },

  v2PrimaryCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingTop: 0,
    paddingHorizontal: 16,
    paddingBottom: 16,
    overflow: 'hidden' as const,
  },
  v2PrimaryHeader: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
    paddingVertical: 11,
    marginBottom: 14,
  },
  v2PrimaryTitle: {
    fontSize: 14,
    letterSpacing: 0.6,
  },

  v2SecondaryRow: {
    flexDirection: 'row' as const,
    gap: 10,
  },
  v2SecondaryCard: {
    flex: 1,
    marginBottom: 0,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  v2SecondaryStats: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 10,
    backgroundColor: '#EBEBEB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  v2SecondaryStatValue: { ...metricValueStyle },

  v2CompactRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 7,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  v2CompactRowName: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.light.text,
  },
  v2CompactRowVal: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  v2ViewAll: {
    fontSize: 11,
    color: Colors.light.tint,
    fontWeight: '500' as const,
    paddingTop: 8,
    textAlign: 'center' as const,
  },

  crmSearchRow: {
    marginBottom: 8,
  },
  crmSearchBox: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 7,
    backgroundColor: Colors.light.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: 10,
    height: 34,
  },
  crmSearchInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.light.text,
    outlineStyle: 'none' as any,
  },
  crmFilterPillsRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 6,
    marginBottom: 6,
  },
  crmFilterPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.background,
  },
  crmFilterPillActive: {
    borderColor: Colors.light.tint,
    backgroundColor: '#FFF4EE',
  },
  crmFilterPillText: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: Colors.light.textSecondary,
  },
  crmFilterPillTextActive: {
    color: Colors.light.tint,
    fontWeight: '700' as const,
  },
  projectNumChip: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.light.tint,
    backgroundColor: '#FFF4EE',
    borderWidth: 1,
    borderColor: Colors.light.tint + '44',
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  viewAllLink: {
    paddingTop: 10,
    alignItems: 'center' as const,
  },
  viewAllLinkText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.light.tint,
  },

  v2SmallDonutRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-around' as const,
    alignItems: 'flex-start' as const,
    paddingVertical: 8,
  },
  v2SmallDonutItem: {
    alignItems: 'center' as const,
    gap: 5,
    cursor: 'default' as any,
    maxWidth: 60,
  },
  v2SmallDonutOuter: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  v2SmallDonutInner: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.light.surface,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  v2SmallDonutPct: {
    fontSize: 12,
    fontWeight: '800' as const,
    color: Colors.light.text,
  },
  v2SmallDonutLabel: {
    fontSize: 9,
    fontWeight: '600' as const,
    textAlign: 'center' as const,
    lineHeight: 12,
  },

  v2TertiaryRow: {
    flexDirection: 'row' as const,
    gap: 10,
  },
  v2TertiaryCard: {
    backgroundColor: Colors.light.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 10,
    gap: 0,
  },
  v2TertiaryHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 8,
  },
  v2TertiaryHeaderLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
  },
  v2TertiaryTitle: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.light.text,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.4,
  },
  v2TertiaryBadge: {
    backgroundColor: Colors.light.border,
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 16,
    alignItems: 'center' as const,
  },
  v2TertiaryBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.light.textSecondary,
  },
  v2TertiaryAction: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.light.tint + '60',
    backgroundColor: Colors.light.tint + '10',
  },
  v2TertiaryActionText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.light.tint,
  },
  v2TertiaryEmpty: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    paddingVertical: 10,
    textAlign: 'center' as const,
  },

  v2ContactRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    paddingVertical: 5,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  v2ContactAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.light.tint + '20',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexShrink: 0,
  },
  v2ContactAvatarText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.light.tint,
    textTransform: 'uppercase' as const,
  },
  v2ContactName: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  v2ContactRole: {
    fontSize: 10,
    color: Colors.light.textSecondary,
  },

  v2MediaGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 6,
    marginTop: 2,
  },
  v2MediaItem: {
    width: Platform.OS === 'web' ? 136 : 105,
    gap: 3,
  },
  v2MediaThumb: {
    width: Platform.OS === 'web' ? 136 : 105,
    height: Platform.OS === 'web' ? 109 : 84,
    borderRadius: 6,
    backgroundColor: Colors.light.border,
  },
  v2MediaIcon: {
    width: Platform.OS === 'web' ? 136 : 105,
    height: Platform.OS === 'web' ? 109 : 84,
    borderRadius: 6,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  v2MediaExt: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.light.tint,
    letterSpacing: 0.5,
  },
  v2MediaName: {
    fontSize: 9,
    color: Colors.light.textSecondary,
    lineHeight: 12,
  },

  // ── V2 Two-Column Layout ──────────────────────────────────────────────────
  v2Layout: {
    flexDirection: 'row' as const,
    backgroundColor: Colors.light.background,
  },

  // Left panel — flexGrow:0 is critical even as a plain View: without it the panel
  // grows to fill the row. Basis 44% (clamped) keeps the identity/contacts column
  // at ~44% with breathing room,
  // while the operational right panel (Client Legacy / Active Projects) stays dominant at ~56%.
  v2LeftPanel: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: '44%',
    minWidth: 360,
    maxWidth: 640,
    backgroundColor: Colors.light.surface,
    borderRightWidth: 1,
    borderRightColor: Colors.light.border,
  },
  v2LeftPanelContent: {
    padding: 14,
    paddingBottom: 24,
    gap: 14,
  },

  v2LPBack: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    marginBottom: 2,
  },
  v2LPBackText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    fontWeight: '500' as const,
  },

  v2LPHeader: {
    flexDirection: 'column' as const,
    gap: 10,
    marginBottom: 10,
  },
  v2LPHeaderOuterRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 12,
  },
  v2LPHeaderRightContent: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  v2LPHeaderTopRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    justifyContent: 'space-between' as const,
    gap: 12,
  },
  v2LPHeaderInfoGrid: {
    flexDirection: 'row' as const,
    gap: 20,
  },
  v2LPHeaderInfoCol: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  v2LPHeaderInfo: {
    flex: 1,
    minWidth: 0,
    gap: 0,
  },
  v2LPHeaderMetaLine: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginTop: 1,
  },
  v2LPHeaderWebsite: {
    fontSize: 11,
    color: Colors.light.tint,
  },
  v2LPName: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: Colors.light.text,
    lineHeight: 26,
  },
  v2LPHeaderDetailRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
  },
  v2LPHeaderDetailText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    flex: 1,
    minWidth: 0,
  },
  v2LPHeaderRight: {
    flexDirection: 'column' as const,
    alignItems: 'flex-end' as const,
    justifyContent: 'space-between' as const,
    alignSelf: 'stretch' as const,
    gap: 8,
  },
  v2LPHeaderActions: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'flex-end' as const,
    gap: 8,
  },
  v2LPPrimaryContact: {
    alignItems: 'flex-end' as const,
  },
  v2LPPrimaryContactRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    marginBottom: 2,
  },
  v2LPPrimaryContactLabel: {
    fontSize: 10,
    color: Colors.light.textSecondary,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  v2LPPrimaryContactName: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },

  v2LPActionRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginBottom: 2,
  },
  v2LPNewQuoteBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 5,
    backgroundColor: Colors.light.tint,
    borderRadius: 7,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  v2LPNewQuoteBtnText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#fff',
  },
  v2LPEditBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    backgroundColor: Colors.light.background,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  v2LPEditBtnText: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.light.text,
  },
  v2LPIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: Colors.light.background,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  v2LPDivider: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginVertical: 10,
  },

  v2LPSection: {
    gap: 0,
  },
  v2LPSectionHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 10,
  },
  v2LPSectionTitle: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.6,
  },
  v2LPSectionAction: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 3,
  },
  v2LPSectionActionText: {
    fontSize: 12,
    color: Colors.light.tint,
    fontWeight: '600' as const,
  },

  v2LPEmptyContacts: {
    alignItems: 'center' as const,
    paddingVertical: 20,
    gap: 4,
  },
  v2LPEmptyText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    fontWeight: '500' as const,
  },
  v2LPEmptySub: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    textAlign: 'center' as const,
  },

  v2LPContactCard: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 8,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  v2LPContactAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.light.tint + '20',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexShrink: 0,
  },
  v2LPContactAvatarText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.light.tint,
    textTransform: 'uppercase' as const,
  },
  v2LPContactInfo: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  v2LPContactName: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  v2LPContactRole: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    fontWeight: '400' as const,
  },
  v2LPContactDetail: {
    fontSize: 11,
    color: Colors.light.textSecondary,
  },
  v2LPContactActions: {
    flexDirection: 'row' as const,
    gap: 4,
    flexShrink: 0,
  },
  v2LPContactActionBtn: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: Colors.light.background,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },

  v2LPNotesText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    lineHeight: 18,
    marginTop: 6,
  },

  v2RightPanel: {
    flex: 1,
    flexDirection: 'column' as const,
    overflow: 'hidden' as const,
    backgroundColor: Colors.light.background,
  },

  // Mobile header
  v2MobileHeader: {
    backgroundColor: Colors.light.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
  },
  v2MobileHeaderTop: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
  },
  v2MobileOrgName: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  v2MobileOrgMeta: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },

  hubReadyBox: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  hubReadyHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 6,
  },
  hubReadyTitle: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.light.text,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.4,
  },
  hubReadyPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  hubReadyPillOk: {
    backgroundColor: '#DCFCE7',
  },
  hubReadyPillWarn: {
    backgroundColor: '#FEF3C7',
  },
  hubReadyPillText: {
    fontSize: 10,
    fontWeight: '700' as const,
  },
  hubReadyRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingVertical: 2,
  },
  hubReadyRowText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  hubManageBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingVertical: 9,
    backgroundColor: '#FFF1E8',
  },
  hubManageBtnText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#FF5A00',
  },
  hubDisabledBanner: {
    backgroundColor: '#F9FAFB',
    borderRadius: 0,
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  hubDisabledText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    lineHeight: 17,
  },
  hubStatusBadge: {
    backgroundColor: '#DCFCE7',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  hubStatusBadgeOff: {
    backgroundColor: '#F3F4F6',
  },
  hubStatusBadgeText: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: '#065F46',
  },
  hubStatusBadgeTextOff: {
    color: '#6B7280',
  },
  hubSettingsBtn: {
    backgroundColor: '#FF5A00',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  hubSettingsBtnText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#fff',
  },
  hubUrlRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#FAFAFA',
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  hubUrlText: {
    flex: 1,
    fontSize: 10,
    color: Colors.light.textSecondary,
    fontFamily: 'monospace',
  },
  hubUrlActions: {
    flexDirection: 'row' as const,
    gap: 2,
    flexShrink: 0,
  },
  hubUrlActionBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 2,
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  hubUrlActionBtnText: {
    fontSize: 10,
    color: Colors.light.textSecondary,
    fontWeight: '500' as const,
  },
  hubMetricsRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 10,
    backgroundColor: '#EBEBEB',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 10,
    marginBottom: 8,
  },
  hubMetricItem: {
    flex: 1,
    minWidth: 70,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: Colors.light.surface,
    alignItems: 'center' as const,
  },
  hubMetricVal: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: Colors.light.text,
  },
  hubMetricLbl: {
    fontSize: 9,
    color: Colors.light.textSecondary,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    marginTop: 1,
  },
  hubMetricDiv: {
    display: 'none' as any,
  },
  hubCollapseHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  hubCollapseTitle: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.light.text,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.3,
  },
  hubCollapseBadge: {
    backgroundColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  hubCollapseBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#4B5563',
  },
  hubInviteCompactBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    backgroundColor: '#FFF7F5',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#FF5A00',
  },
  hubInviteCompactBtnText: {
    fontSize: 10,
    color: '#FF5A00',
    fontWeight: '600' as const,
  },
  hubUserCard: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  hubUserMeta: {
    fontSize: 10,
    color: Colors.light.textSecondary,
  },
  hubActionMenuBtn: {
    padding: 5,
    borderRadius: 4,
    backgroundColor: '#F3F4F6',
  },
  hubActionMenu: {
    position: 'absolute' as any,
    right: 0,
    top: 28,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 99,
    minWidth: 165,
  },
  hubActionMenuItem: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  hubActionMenuItemText: {
    fontSize: 13,
    color: Colors.light.text,
  },
  hubPendingCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  hubPendingAction: {
    backgroundColor: '#FFF7F5',
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#FFD0B5',
  },
  hubPendingActionDanger: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  hubPendingActionText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#FF5A00',
  },
  hubModalTabs: {
    flexDirection: 'row' as const,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    marginTop: 8,
  },
  hubModalTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center' as const,
  },
  hubModalTabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#FF5A00',
  },
  hubModalTabText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
  },
  hubModalTabTextActive: {
    color: '#FF5A00',
  },
  hubModalCopyRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginBottom: 8,
  },
  hubModalCopyUrl: {
    flex: 1,
    fontSize: 12,
    color: Colors.light.text,
    fontFamily: 'monospace',
  },
  hubModalCopyBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    backgroundColor: '#FF5A00',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  hubModalCopyBtnText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#fff',
  },
  hubModalHint: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    lineHeight: 17,
  },
  hubModalMsgBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginBottom: 12,
  },
  hubModalMsgText: {
    fontSize: 13,
    color: Colors.light.text,
    lineHeight: 20,
  },
  v2LPSectionLabel: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  v2LPRepRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  clientUserRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    marginTop: 2,
  },
  clientUserInfo: {
    flex: 1,
    minWidth: 0,
  },
  clientUserActions: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    marginTop: 2,
  },
  clientUserActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: Colors.light.surface,
  },
  statusBadgeInvited: {
    backgroundColor: '#EEF2FF',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  statusBadgeActive: {
    backgroundColor: '#DCFCE7',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  statusBadgeDisabled: {
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  pwSetBadge: {
    backgroundColor: '#FEF3C7',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: '#374151',
  },
  inviteSentAt: {
    fontSize: 10,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  inviteEmailNote: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    backgroundColor: '#EEF2FF',
    borderRadius: 7,
    padding: 9,
    marginTop: 12,
    marginBottom: 4,
  },
  inviteEmailNoteText: {
    fontSize: 12,
    color: '#4338CA',
    flex: 1,
  },
  /* ── Phase 1.6 project card styles ── */
  p16Card: {
    backgroundColor: Colors.light.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 12,
    gap: 5,
  },
  p16CardTop: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  p16CardNum: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.light.primary,
    fontFamily: 'monospace',
    letterSpacing: 0.3,
  },
  p16CardName: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.text,
    marginTop: 1,
  },
  p16CardDates: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
  },
  p16CardDateItem: {
    fontSize: 11,
    color: Colors.light.textSecondary,
  },
  p16CardDateSep: {
    fontSize: 11,
    color: Colors.light.border,
  },
  p16CardService: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    fontStyle: 'italic' as const,
  },
  p16CardBottom: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginTop: 3,
    paddingTop: 7,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  p16CardBottomItem: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    fontWeight: '500' as const,
  },
  p16CardProfit: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#16A34A',
    marginLeft: 'auto' as any,
  },
  p16SearchRow: {
    marginBottom: 8,
  },
  p16SearchBox: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 7,
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  p16SearchInput: {
    flex: 1,
    fontSize: 12,
    color: Colors.light.text,
  },
  p16ViewAll: {
    alignItems: 'center' as const,
    paddingVertical: 8,
    marginTop: 4,
  },
  p16ViewAllText: {
    fontSize: 12,
    color: Colors.light.primary,
    fontWeight: '600' as const,
  },
  /* ── Actions button ── */
  v2LPActionsBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  v2LPActionsBtnText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  /* ── Visual list numbering ── */
  p16ListRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginBottom: 8,
  },
  p16ListNum: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: Colors.light.border,
    width: 28,
    textAlign: 'right' as const,
    flexShrink: 0,
  },
  /* ── Filter pills ── */
  p16FilterRow: {
    marginBottom: 6,
    marginTop: -2,
  },
  p16FilterScroll: {
    flexDirection: 'row' as const,
    gap: 5,
    paddingRight: 4,
  },
  p16Pill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  p16PillActive: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  p16PillText: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: Colors.light.textSecondary,
  },
  p16PillTextActive: {
    color: '#fff',
    fontWeight: '600' as const,
  },

  /* ── Embedded search + filter row (used in infoCard active-projects & quotes) ── */
  embSFRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  embSearchBox: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 7,
    backgroundColor: Colors.light.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  embSearchInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.light.text,
    outlineStyle: 'none' as any,
  },
  embFilterBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    backgroundColor: Colors.light.background,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  embFilterBtnActive: {
    backgroundColor: Colors.light.tint,
    borderColor: Colors.light.tint,
  },
  embFilterBtnText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
  },
  embFilterBtnTextActive: {
    color: '#fff',
  },
  embFilterSectionLabel: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 4,
  },
  embFilterOption: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 6,
    marginHorizontal: 4,
  },
  embFilterOptionSelected: {
    backgroundColor: Colors.light.tint + '22',
  },
  embFilterOptionText: {
    fontSize: 13,
    color: Colors.light.text,
  },
  embFilterOptionTextSelected: {
    color: Colors.light.tint,
    fontWeight: '600' as const,
  },
});
