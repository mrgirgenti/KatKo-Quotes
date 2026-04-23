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
import {
  Edit3,
  Mail,
  Phone,
  Building2,
  FileText,
  ChevronRight,
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
  PhoneCall,
  Users,
  Shield,
  Send,
  Inbox,
  Package,
  Upload,
  ExternalLink,
  ToggleLeft,
  ToggleRight,
  Copy,
  CheckCircle2,
  Settings,
  Film,
  Music,
  Image as LucideImage,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { OrgLogoUploader } from '@/components/OrgLogoUploader';
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
import { STATUS_CONFIG, getEffectiveStatus } from '@/types/quote';

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

function ContactCard({ contact: c, onEdit, onDelete }: { contact: Contact; onEdit: () => void; onDelete: () => void }) {
  return (
    <View style={styles.contactCard}>
      <View style={[styles.contactAvatar, c.isPrimary && styles.contactAvatarPrimary]}>
        <Text style={[styles.contactAvatarText, c.isPrimary && styles.contactAvatarTextPrimary]}>{c.firstName.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.contactInfo}>
        <View style={styles.contactNameRow}>
          <Text style={styles.contactName}>{c.firstName} {c.lastName}</Text>
          {c.isPrimary && (
            <View style={styles.primaryBadge}>
              <Text style={styles.primaryBadgeText}>Primary</Text>
            </View>
          )}
        </View>
        {c.role && <Text style={styles.contactRole}>{c.role}</Text>}
        <View style={styles.contactDetails}>
          {c.phone && (
            <View style={styles.contactDetailRow}>
              <Phone size={11} color={Colors.light.textSecondary} />
              <Text style={styles.contactDetailText}>{c.phone}</Text>
            </View>
          )}
          {c.email && (
            <View style={styles.contactDetailRow}>
              <Mail size={11} color={Colors.light.textSecondary} />
              <Text style={styles.contactDetailText}>{c.email}</Text>
            </View>
          )}
        </View>
        {c.notes && <Text style={styles.contactNotes}>{c.notes}</Text>}
      </View>
      <View style={styles.contactActions}>
        <TouchableOpacity style={styles.contactActionBtn} onPress={onEdit}>
          <Edit3 size={14} color={Colors.light.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.contactActionBtn} onPress={onDelete}>
          <Trash2 size={14} color={Colors.light.error} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function OrgProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const {
    orgs, templates,
    isLoading: orgsLoading,
    updateOrg, deleteOrg,
    addContact, updateContact, deleteContact,
    addActivity, deleteActivity,
    assignCampaign, updateCampaignStep, deleteCampaign,
    updateOrgStatus,
    addDepartment, updateDepartment, deleteDepartment,
    updateOrgHubEnabled,
    createMembershipAsync,
    deleteMembership,
  } = useCrm();
  const { quotes } = useQuotes();
  const { isDesktop } = useBreakpoint();

  const { data: directOrg, isLoading: directOrgLoading } = useQuery<Organization>({
    queryKey: ['org_detail', id],
    queryFn: async () => {
      const res = await fetch(`/api/orgs/${id}`, { headers: { 'Content-Type': 'application/json' } });
      if (!res.ok) throw new Error(`API error ${res.status}`);
      return res.json();
    },
    enabled: !!id,
    staleTime: 1000 * 30,
    networkMode: 'always',
  });

  const contextOrg = useMemo(() => orgs.find((o) => o.id === id), [orgs, id]);
  const org: Organization | undefined = contextOrg || directOrg;

  // Local optimistic state for hub toggle so it responds instantly on web
  const [localHubEnabled, setLocalHubEnabled] = useState(org?.hubEnabled ?? false);
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
  const [showOrgMenu, setShowOrgMenu] = useState(false);

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

  const [addMemberModal, setAddMemberModal] = useState(false);
  const [memberForm, setMemberForm] = useState<{ userId: string; role: MembershipRole }>({ userId: '', role: 'MEMBER' });
  const [memberRoleDropdown, setMemberRoleDropdown] = useState(false);

  const [addClientUserModal, setAddClientUserModal] = useState(false);
  const [clientUserForm, setClientUserForm] = useState({ name: '', email: '' });
  const [clientUserSaving, setClientUserSaving] = useState(false);


  const { data: memberships = [], isLoading: membershipsLoading, refetch: refetchMemberships } = useQuery<OrgMembership[]>({
    queryKey: ['memberships', org?.id],
    queryFn: async () => {
      if (!org?.id) return [];
      const res = await fetch(`/api/memberships?orgId=${org.id}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!org?.id,
  });

  const { data: availableUsers = [] } = useQuery<{ id: string; name: string; avatarColor: string }[]>({
    queryKey: ['db_users'],
    queryFn: async () => {
      const res = await fetch('/api/users');
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: orgFiles = [], refetch: refetchOrgFiles } = useQuery<any[]>({
    queryKey: ['org_files', org?.id],
    queryFn: async () => {
      if (!org?.id) return [];
      const res = await fetch(`/api/files?orgId=${org.id}&scope=org`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.files || [];
    },
    enabled: !!org?.id,
  });

  const [orgFilesUploading, setOrgFilesUploading] = useState(false);
  const [orgFilesDragOver, setOrgFilesDragOver] = useState(false);

  const handleOrgFileUpload = useCallback(async (file: File) => {
    if (!org) return;
    setOrgFilesUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('orgId', org.id);
      fd.append('fileType', 'ARTWORK');
      fd.append('visibility', 'CLIENT_VISIBLE');
      const res = await fetch('/api/files', { method: 'POST', body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        Alert.alert('Upload failed', err?.error || 'Could not upload file.');
      } else {
        refetchOrgFiles();
      }
    } catch {
      Alert.alert('Upload failed', 'Something went wrong.');
    } finally {
      setOrgFilesUploading(false);
    }
  }, [org, refetchOrgFiles]);

  const handleOrgFileDelete = useCallback(async (fileId: string) => {
    try {
      await fetch(`/api/files/${fileId}`, { method: 'DELETE' });
      refetchOrgFiles();
    } catch {}
  }, [refetchOrgFiles]);

  const handleAddMember = useCallback(async () => {
    if (!org || !memberForm.userId) return;
    try {
      await createMembershipAsync({
        organizationId: org.id,
        userId: memberForm.userId,
        role: memberForm.role,
      });
      setAddMemberModal(false);
      setMemberForm({ userId: '', role: 'MEMBER' });
      refetchMemberships();
    } catch (err) {
      Alert.alert('Error', 'Failed to add member. Make sure the user has been synced.');
    }
  }, [org, memberForm, createMembershipAsync, refetchMemberships]);

  const handleAddClientUser = useCallback(async () => {
    if (!org || !clientUserForm.name.trim() || !clientUserForm.email.trim()) return;
    setClientUserSaving(true);
    try {
      const userId = `client_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const userRes = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: userId,
          name: clientUserForm.name.trim(),
          email: clientUserForm.email.trim(),
          userType: 'CLIENT',
        }),
      });
      if (!userRes.ok && userRes.status !== 204) {
        const err = await userRes.json().catch(() => ({}));
        throw new Error(err?.error || 'Failed to create user');
      }
      const newUser = userRes.status === 204 ? { id: userId } : await userRes.json();
      await createMembershipAsync({
        organizationId: org.id,
        userId: newUser.id,
        role: 'MEMBER',
      });
      setAddClientUserModal(false);
      setClientUserForm({ name: '', email: '' });
      refetchMemberships();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to add client user.');
    } finally {
      setClientUserSaving(false);
    }
  }, [org, clientUserForm, createMembershipAsync, refetchMemberships]);

  const relatedQuotes = useMemo(() => {
    if (!org) return [];
    return quotes.filter((q) => {
      if (q.orgId === org.id) return true;
      const qName = q.personOrganization.toLowerCase();
      return (
        qName === org.name.toLowerCase() ||
        org.contacts.some((c) => `${c.firstName} ${c.lastName}`.toLowerCase() === qName)
      );
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [quotes, org]);

  const activeQuotes = useMemo(() => {
    return relatedQuotes.filter((q) => q.status === 'active' || q.status === 'production_started');
  }, [relatedQuotes]);

  const totalSpent = useMemo(() => {
    return relatedQuotes
      .filter((q) => q.status === 'completed')
      .reduce((sum, q) => sum + (q.salesData?.amountCollected || q.calculations?.total || 0), 0);
  }, [relatedQuotes]);

  const isLead = org && (org.status === 'Cold' || org.status === 'Working');

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

  const openAddContact = useCallback(() => {
    setEditingContact(null);
    setContactForm({ firstName: '', lastName: '', role: 'Primary Contact', email: '', phone: '', notes: '', isPrimary: org?.contacts.length === 0, departmentId: '', hubAccess: false });
    setContactModal(true);
  }, [org]);

  const openEditContact = useCallback((c: Contact) => {
    setEditingContact(c);
    const alreadyHasHub = !!(c.email && memberships.some((m) => (m as any).userType === 'CLIENT' && m.userEmail === c.email));
    setContactForm({ firstName: c.firstName, lastName: c.lastName, role: c.role || 'Primary Contact', email: c.email || '', phone: c.phone || '', notes: c.notes || '', isPrimary: !!c.isPrimary, departmentId: c.departmentId || '', hubAccess: alreadyHasHub });
    setContactModal(true);
  }, [memberships]);

  const handleSaveContact = useCallback(async () => {
    if (!org || !contactForm.firstName.trim()) return;
    const { hubAccess, ...rest } = contactForm;
    const payload = { ...rest, firstName: contactForm.firstName.trim(), lastName: contactForm.lastName.trim(), departmentId: contactForm.departmentId || undefined };
    if (editingContact) {
      updateContact({ orgId: org.id, contact: { ...editingContact, ...payload } });
    } else {
      addContact({ orgId: org.id, contact: payload });
    }
    const email = contactForm.email.trim();
    if (email) {
      const existingClientMembership = memberships.find((m) => (m as any).userType === 'CLIENT' && m.userEmail === email);
      if (hubAccess && !existingClientMembership) {
        try {
          const fullName = `${contactForm.firstName.trim()} ${contactForm.lastName.trim()}`.trim();
          const userId = `client_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const userRes = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: userId, name: fullName, email, userType: 'CLIENT' }),
          });
          const newUser = userRes.ok ? await userRes.json() : { id: userId };
          await createMembershipAsync({ organizationId: org.id, userId: newUser.id, role: 'MEMBER' });
          refetchMemberships();
        } catch {}
      } else if (!hubAccess && existingClientMembership) {
        try {
          await fetch(`/api/memberships/${existingClientMembership.id}`, { method: 'DELETE' });
          refetchMemberships();
        } catch {}
      }
    }
    setContactModal(false);
  }, [org, contactForm, editingContact, addContact, updateContact, memberships, createMembershipAsync, refetchMemberships]);

  const handleDeleteContact = useCallback((c: Contact) => {
    if (!org) return;
    Alert.alert('Remove Contact', `Remove ${c.firstName} ${c.lastName}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => deleteContact({ orgId: org.id, contactId: c.id }) },
    ]);
  }, [org, deleteContact]);

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

  if ((orgsLoading || directOrgLoading) && !org) {
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
  const accountRep = memberships.find((m) => m.userType !== 'CLIENT' && m.role === 'ORG_ADMIN') || memberships.find((m) => m.userType !== 'CLIENT') || null;

  const leftPanel = (
    <View style={styles.leftPanel}>
      {/* Identity card */}
      <View style={styles.orgIdentityCard}>
        {/* Actions menu */}
        <TouchableOpacity
          style={styles.orgMenuBtn}
          onPress={() => setShowOrgMenu((v) => !v)}
        >
          <MoreHorizontal size={18} color={Colors.light.textSecondary} />
        </TouchableOpacity>
        <Modal visible={showOrgMenu} transparent animationType="none" onRequestClose={() => setShowOrgMenu(false)}>
          <Pressable style={styles.orgMenuOverlay} onPress={() => setShowOrgMenu(false)}>
            <View style={styles.orgMenuDropdown}>
              <TouchableOpacity
                style={styles.orgMenuItem}
                onPress={() => {
                  setShowOrgMenu(false);
                  router.push({ pathname: '/(tabs)' as any, params: { orgName: org.name, orgId: org.id } });
                }}
              >
                <Plus size={14} color={Colors.light.tint} />
                <Text style={styles.orgMenuItemText}>New Quote</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.orgMenuItem}
                onPress={() => { setShowOrgMenu(false); openEditOrg(); }}
              >
                <Edit3 size={14} color={Colors.light.text} />
                <Text style={styles.orgMenuItemText}>Edit Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.orgMenuItem, styles.orgMenuItemDanger]}
                onPress={() => { setShowOrgMenu(false); handleDeleteOrg(); }}
              >
                <Trash2 size={14} color={Colors.light.error} />
                <Text style={[styles.orgMenuItemText, { color: Colors.light.error }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>
        {/* Status badge — top-left */}
        <View style={styles.orgStatusBadge}>
          <StatusBadge status={org.status} />
        </View>

        {/* Logo — larger */}
        <View style={styles.orgLogoWrap}>
          <OrgLogoUploader
            orgId={org.id}
            orgName={org.name}
            currentLogoUrl={org.logoUrl}
            onLogoChange={(url) => updateOrg({ ...org, logoUrl: url ?? undefined })}
            size={104}
          />
        </View>

        <Text style={styles.orgNameLarge}>{org.name}</Text>

        {/* Business info rows — always shown */}
        <View style={styles.orgInfoBlock}>
          {org.type ? (
            <View style={styles.orgInfoRow}>
              <Building2 size={12} color={Colors.light.textSecondary} />
              <Text style={styles.orgInfoKey}>Business Type</Text>
              <Text style={styles.orgInfoVal} numberOfLines={1}>{org.type}</Text>
            </View>
          ) : null}
          <View style={styles.orgInfoRow}>
            <MapPin size={12} color={Colors.light.textSecondary} />
            <Text style={styles.orgInfoKey}>Address</Text>
            <Text style={styles.orgInfoVal} numberOfLines={2}>
              {[org.address, [org.city, org.state].filter(Boolean).join(', ')].filter(Boolean).join(', ') || '—'}
            </Text>
          </View>
          <View style={[styles.orgInfoRow, { borderBottomWidth: 0 }]}>
            <Globe size={12} color={Colors.light.textSecondary} />
            <Text style={styles.orgInfoKey}>Website</Text>
            <Text style={styles.orgInfoVal} numberOfLines={1}>{org.website || '—'}</Text>
          </View>
        </View>
      </View>

      {/* Lead tracking */}
      {isLead && (
        <View style={styles.leadBanner}>
          <View style={styles.leadBannerHeader}>
            <TrendingUp size={15} color={CRM_STATUS_CONFIG['Working'].color} />
            <Text style={styles.leadBannerTitle}>Lead Tracking</Text>
          </View>
          <Text style={styles.leadBannerSub}>
            Update their status as you progress through outreach.
          </Text>
          <View style={styles.statusChangeRow}>
            {(['Cold', 'Working', 'Active Client', 'Past Client'] as CrmStatus[]).map((s) => {
              const cfg = CRM_STATUS_CONFIG[s];
              const selected = org.status === s;
              return (
                <TouchableOpacity
                  key={s}
                  style={[styles.statusChip, selected && { backgroundColor: cfg.bg, borderColor: cfg.border }]}
                  onPress={() => updateOrgStatus({ orgId: org.id, status: s })}
                >
                  <Text style={[styles.statusChipText, selected && { color: cfg.color, fontWeight: '700' as const }]}>{s}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {activeCampaigns.length > 0 && (
            <View style={styles.leadCampaignRow}>
              <TrendingUp size={12} color={Colors.light.tint} />
              <Text style={styles.leadCampaignText}>
                {activeCampaigns.length} active campaign{activeCampaigns.length !== 1 ? 's' : ''}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Notes */}
      {org.notes && (
        <View style={styles.leftInfoCard}>
          <Text style={styles.leftInfoCardLabel}>Notes</Text>
          <Text style={styles.notesText}>{org.notes}</Text>
        </View>
      )}

      {/* Contacts card */}
      <View style={styles.infoCard}>
        <View style={styles.infoCardHeader}>
          <View style={styles.infoCardHeaderLeft}>
            <Users size={15} color="#fff" />
            <Text style={styles.infoCardTitle}>Contacts</Text>
            {org.contacts.length > 0 && (
              <View style={styles.infoCardBadge}><Text style={styles.infoCardBadgeText}>{org.contacts.length}</Text></View>
            )}
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={styles.infoCardActionSecondary} onPress={openAddDept}>
              <Plus size={12} color="#fff" />
              <Text style={styles.infoCardActionSecondaryText}>Dept</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.infoCardAction} onPress={openAddContact}>
              <Plus size={13} color="#fff" />
              <Text style={styles.infoCardActionText}>Add Contact</Text>
            </TouchableOpacity>
          </View>
        </View>
        {org.contacts.length === 0 && (org.departments || []).length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyCardText}>No contacts yet.</Text>
            <Text style={styles.emptyCardSub}>Add departments to organize people by team, then add contacts.</Text>
          </View>
        ) : (
          <>
            {(org.departments || []).map((dept) => {
              const deptContacts = org.contacts.filter((c) => c.departmentId === dept.id);
              return (
                <View key={dept.id} style={styles.deptSection}>
                  <View style={styles.deptHeader}>
                    <View style={styles.deptHeaderLeft}>
                      <Users size={13} color={Colors.light.tint} />
                      <Text style={styles.deptName}>{dept.name}</Text>
                      <Text style={styles.deptCount}>{deptContacts.length} contact{deptContacts.length !== 1 ? 's' : ''}</Text>
                    </View>
                    <View style={styles.deptHeaderActions}>
                      <TouchableOpacity
                        style={styles.deptAddBtn}
                        onPress={() => {
                          setEditingContact(null);
                          setContactForm({ firstName: '', lastName: '', role: 'Primary Contact', email: '', phone: '', notes: '', isPrimary: false, departmentId: dept.id });
                          setContactModal(true);
                        }}
                      >
                        <Plus size={12} color={Colors.light.tint} />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.deptActionBtn} onPress={() => openEditDept(dept)}>
                        <Edit3 size={12} color={Colors.light.textSecondary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.deptActionBtn}
                        onPress={() => Alert.alert('Delete Department', `Remove "${dept.name}"? Contacts in this department will become unassigned.`, [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Delete', style: 'destructive', onPress: () => deleteDepartment({ orgId: org.id, deptId: dept.id }) },
                        ])}
                      >
                        <Trash2 size={12} color={Colors.light.error} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  {deptContacts.length === 0 ? (
                    <Text style={styles.deptEmpty}>No contacts in this department yet.</Text>
                  ) : (
                    deptContacts.map((c) => <ContactCard key={c.id} contact={c} onEdit={() => openEditContact(c)} onDelete={() => handleDeleteContact(c)} />)
                  )}
                </View>
              );
            })}
            {(() => {
              const unassigned = org.contacts.filter((c) => !c.departmentId || !(org.departments || []).find((d) => d.id === c.departmentId));
              if ((org.departments || []).length === 0) {
                return org.contacts.map((c) => <ContactCard key={c.id} contact={c} onEdit={() => openEditContact(c)} onDelete={() => handleDeleteContact(c)} />);
              }
              if (unassigned.length === 0) return null;
              return (
                <View style={styles.deptSection}>
                  <View style={styles.deptHeader}>
                    <View style={styles.deptHeaderLeft}>
                      <User size={13} color={Colors.light.textSecondary} />
                      <Text style={[styles.deptName, { color: Colors.light.textSecondary }]}>Unassigned</Text>
                      <Text style={styles.deptCount}>{unassigned.length}</Text>
                    </View>
                  </View>
                  {unassigned.map((c) => <ContactCard key={c.id} contact={c} onEdit={() => openEditContact(c)} onDelete={() => handleDeleteContact(c)} />)}
                </View>
              );
            })()}
          </>
        )}
      </View>

      {/* Client Hub card */}
      <View style={styles.infoCard}>
        <View style={styles.infoCardHeader}>
          <View style={styles.infoCardHeaderLeft}>
            <Shield size={15} color="#fff" />
            <Text style={styles.infoCardTitle}>Client Hub</Text>
          </View>
          <TouchableOpacity
            style={styles.hubToggleBtn}
            onPress={handleHubToggle}
            activeOpacity={0.7}
          >
            <Text style={[styles.hubToggleBtnText, localHubEnabled && styles.hubToggleBtnTextOn]}>
              {localHubEnabled ? 'On' : 'Off'}
            </Text>
            {localHubEnabled
              ? <ToggleRight size={26} color="#FF5A00" />
              : <ToggleLeft size={26} color={Colors.light.border} />
            }
          </TouchableOpacity>
        </View>
        {localHubEnabled && (
          <View style={styles.portalPanel}>
            <View style={styles.portalUrlRow}>
              <Globe size={11} color={Colors.light.textSecondary} />
              <Text style={styles.portalUrlText} numberOfLines={1}>
                {Platform.OS === 'web' && typeof window !== 'undefined'
                  ? `${window.location.origin}/portal/${org.id}`
                  : `/portal/${org.id}`}
              </Text>
            </View>
            <View style={styles.portalActions}>
              <TouchableOpacity
                style={styles.portalVisitBtn}
                onPress={() => { if (Platform.OS === 'web') { (window as any).open(`/portal/${org.id}`, '_blank'); } }}
              >
                <ExternalLink size={13} color="#fff" />
                <Text style={styles.portalVisitBtnText}>Visit Hub</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.portalIconBtn} onPress={handleCopyHubLink}>
                {hubLinkCopied
                  ? <CheckCircle2 size={16} color="#16A34A" />
                  : <Copy size={16} color={Colors.light.textSecondary} />}
              </TouchableOpacity>
              <TouchableOpacity style={styles.portalIconBtn} onPress={() => router.push(`/hub/${org.id}` as any)}>
                <Settings size={16} color={Colors.light.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
        )}
        <View style={styles.infoCardSubHeader}>
          <Text style={styles.infoCardSubTitle}>Katalyst Ko Rep</Text>
          <TouchableOpacity onPress={() => { setMemberForm({ userId: '', role: 'MEMBER' }); setAddMemberModal(true); }}>
            <Plus size={16} color={Colors.light.tint} />
          </TouchableOpacity>
        </View>
        {membershipsLoading ? (
          <Text style={styles.emptyCardSub}>Loading...</Text>
        ) : memberships.filter((m) => m.userType !== 'CLIENT').length === 0 ? (
          <Text style={styles.emptyCardSub}>No internal team members assigned.</Text>
        ) : (
          memberships.filter((m) => m.userType !== 'CLIENT').map((m) => (
            <View key={m.id} style={[styles.memberRow, m.role === 'ORG_ADMIN' && styles.memberRowAdmin]}>
              <View style={[styles.memberAvatar, { backgroundColor: m.userAvatarColor || '#FF5A00' }]}>
                <Text style={styles.memberAvatarText}>{(m.userName || '?')[0].toUpperCase()}</Text>
              </View>
              <View style={styles.memberInfo}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.memberName}>{m.userName || 'Unknown User'}</Text>
                  {m.role === 'ORG_ADMIN' && (
                    <View style={styles.adminBadge}><Text style={styles.adminBadgeText}>Admin</Text></View>
                  )}
                </View>
                <Text style={styles.memberRole}>{MEMBERSHIP_ROLE_LABELS[m.role] || m.role}</Text>
              </View>
              <TouchableOpacity
                style={styles.memberDelete}
                onPress={() => Alert.alert('Remove Member', `Remove ${m.userName || 'this member'}?`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Remove', style: 'destructive', onPress: () => { deleteMembership({ membershipId: m.id, orgId: org.id }); refetchMemberships(); } },
                ])}
              >
                <X size={13} color={Colors.light.textSecondary} />
              </TouchableOpacity>
            </View>
          ))
        )}
        <View style={[styles.infoCardSubHeader, { marginTop: 12 }]}>
          <Text style={styles.infoCardSubTitle}>Client Hub Users</Text>
          <TouchableOpacity onPress={() => { setClientUserForm({ name: '', email: '' }); setAddClientUserModal(true); }}>
            <Plus size={16} color={Colors.light.tint} />
          </TouchableOpacity>
        </View>
        {membershipsLoading ? (
          <Text style={styles.emptyCardSub}>Loading...</Text>
        ) : memberships.filter((m) => m.userType === 'CLIENT').length === 0 ? (
          <Text style={[styles.emptyCardSub, { marginTop: 4 }]}>No client users yet. Invite a client to give them portal access.</Text>
        ) : (
          memberships.filter((m) => m.userType === 'CLIENT').map((m) => (
            <View key={m.id} style={styles.memberRow}>
              <View style={[styles.memberAvatar, { backgroundColor: '#6366F1' }]}>
                <Text style={styles.memberAvatarText}>{(m.userName || '?')[0].toUpperCase()}</Text>
              </View>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{m.userName || 'Unknown User'}</Text>
                <Text style={styles.memberRole}>{m.userEmail || 'No email'}</Text>
              </View>
              <TouchableOpacity
                style={styles.memberDelete}
                onPress={() => Alert.alert('Remove Client', `Remove ${m.userName || 'this client'}?`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Remove', style: 'destructive', onPress: () => { deleteMembership({ membershipId: m.id, orgId: org.id }); refetchMemberships(); } },
                ])}
              >
                <X size={13} color={Colors.light.textSecondary} />
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      <Text style={styles.memberSince}>Added {formatDate(org.createdAt)}</Text>
    </View>
  );

  const rightPanel = (
    <ScrollView style={styles.rightPanel} showsVerticalScrollIndicator={false} contentContainerStyle={styles.rightPanelContent}>

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
          <TouchableOpacity
            style={styles.infoCardAction}
            onPress={() => router.push({ pathname: '/(tabs)' as any, params: { orgName: org.name, orgId: org.id } })}
          >
            <Plus size={13} color="#fff" />
            <Text style={styles.infoCardActionText}>New Quote</Text>
          </TouchableOpacity>
        </View>
        {activeQuotes.length === 0 ? (
          <View style={styles.emptyCard}>
            <ShoppingBag size={26} color={Colors.light.border} />
            <Text style={styles.emptyCardText}>No active projects yet</Text>
            <Text style={styles.emptyCardSub}>Tap New Quote to start a project for this client.</Text>
          </View>
        ) : (
          activeQuotes.map((q) => {
            const eff = getEffectiveStatus(q);
            const cfg = STATUS_CONFIG[eff];
            return (
              <TouchableOpacity key={q.id} style={styles.projectRow} onPress={() => router.push(`/quote/${q.id}` as any)}>
                <View style={styles.projectRowLeft}>
                  <Text style={styles.projectRowName} numberOfLines={1}>{q.projectName || q.personOrganization}</Text>
                  {q.invoiceNumber ? <Text style={styles.projectRowNum}>#{q.invoiceNumber}</Text> : null}
                </View>
                <View style={[styles.projectRowBadge, { backgroundColor: cfg.bg, borderColor: cfg.borderColor }]}>
                  <Text style={[styles.projectRowBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
                </View>
                <ChevronRight size={12} color={Colors.light.textSecondary} />
              </TouchableOpacity>
            );
          })
        )}
      </View>

      {/* Activity card */}
      <View style={styles.infoCard}>
        <View style={styles.infoCardHeader}>
          <View style={styles.infoCardHeaderLeft}>
            <Clock size={15} color="#fff" />
            <Text style={styles.infoCardTitle}>Activity</Text>
            {org.activityLog.length > 0 && (
              <View style={styles.infoCardBadge}><Text style={styles.infoCardBadgeText}>{org.activityLog.length}</Text></View>
            )}
          </View>
          <TouchableOpacity style={styles.infoCardAction} onPress={() => setActivityModal(true)}>
            <Plus size={13} color="#fff" />
            <Text style={styles.infoCardActionText}>Log Activity</Text>
          </TouchableOpacity>
        </View>
        {org.activityLog.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyCardText}>No activity logged yet.</Text>
            <Text style={styles.emptyCardSub}>Log a call, email, or note to start tracking.</Text>
          </View>
        ) : (
          org.activityLog.map((entry) => {
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
                  entry.type === 'member_added' || entry.type === 'member_removed' ? <User size={14} color={iconColor} /> :
                  entry.type === 'contact_added' || entry.type === 'contact_updated' ? <User size={14} color={iconColor} /> :
                  <FileText size={14} color={iconColor} />;
            return (
              <View key={entry.id} style={[styles.activityEntry, isSystemEvent && styles.activityEntrySystem]}>
                <View style={[styles.activityIcon, { backgroundColor: typeCfg.color + '20' }]}>
                  {iconEl}
                </View>
                <View style={styles.activityBody}>
                  <View style={styles.activityHeaderRow}>
                    <Text style={styles.activityType}>{typeCfg.label}</Text>
                    {entry.contactName && (
                      <Text style={styles.activityContact}>· {entry.contactName}</Text>
                    )}
                    <Text style={styles.activityDate}>{formatDate(entry.date)}</Text>
                  </View>
                  {entry.subject ? <Text style={styles.activitySubject}>{entry.subject}</Text> : null}
                  <Text style={styles.activityNote}>{entry.body}</Text>
                </View>
                <TouchableOpacity
                  style={styles.activityDelete}
                  onPress={() => deleteActivity({ orgId: org.id, entryId: entry.id })}
                >
                  <X size={13} color={Colors.light.textSecondary} />
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </View>

      {/* Quotes & Revenue card */}
      <View style={styles.infoCard}>
        <View style={styles.infoCardHeader}>
          <View style={styles.infoCardHeaderLeft}>
            <FileText size={15} color="#fff" />
            <Text style={styles.infoCardTitle}>Quotes & Revenue</Text>
          </View>
          <TouchableOpacity
            style={styles.infoCardAction}
            onPress={() => router.push({ pathname: '/(tabs)' as any, params: { orgName: org.name, orgId: org.id } })}
          >
            <Plus size={13} color="#fff" />
            <Text style={styles.infoCardActionText}>New Quote</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.revenueStatsRow}>
          <View style={styles.revenueStatBox}>
            <Text style={styles.revenueStatValue}>{relatedQuotes.length}</Text>
            <Text style={styles.revenueStatLabel}>Total Quotes</Text>
          </View>
          <View style={styles.revenueStatDivider} />
          <View style={styles.revenueStatBox}>
            <Text style={[styles.revenueStatValue, { color: Colors.light.success }]}>{formatCurrency(totalSpent)}</Text>
            <Text style={styles.revenueStatLabel}>Total Revenue</Text>
          </View>
        </View>
        {relatedQuotes.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyCardText}>No quotes yet.</Text>
            <Text style={styles.emptyCardSub}>Create a quote to link it to this organization.</Text>
          </View>
        ) : (
          relatedQuotes.map((q) => (
            <TouchableOpacity
              key={q.id}
              style={styles.quoteRow}
              onPress={() => router.push(`/quote/${q.id}` as any)}
            >
              <View style={styles.quoteRowLeft}>
                <Text style={styles.quoteProject} numberOfLines={1}>{q.projectName}</Text>
                <View style={styles.quoteMeta}>
                  {q.invoiceNumber && <Text style={styles.quoteNum}>#{q.invoiceNumber}</Text>}
                  <Text style={styles.quoteDate}>{formatDate(q.createdAt)}</Text>
                </View>
              </View>
              <View style={styles.quoteRowRight}>
                <Text style={styles.quoteAmount}>{formatCurrency(q.calculations?.total ?? 0)}</Text>
                <Text style={styles.quoteStatus}>{q.status?.toUpperCase() ?? ''}</Text>
              </View>
              <ChevronRight size={14} color={Colors.light.border} />
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Campaigns card */}
      {(isLead || org.campaigns.length > 0) && (
        <View style={styles.infoCard}>
          <View style={styles.infoCardHeader}>
            <View style={styles.infoCardHeaderLeft}>
              <TrendingUp size={15} color="#fff" />
              <Text style={styles.infoCardTitle}>Campaigns</Text>
              {org.campaigns.length > 0 && (
                <View style={styles.infoCardBadge}><Text style={styles.infoCardBadgeText}>{org.campaigns.length}</Text></View>
              )}
            </View>
            <TouchableOpacity style={styles.infoCardAction} onPress={() => setCampaignModal(true)}>
              <Plus size={13} color="#fff" />
              <Text style={styles.infoCardActionText}>Start Campaign</Text>
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
                    <TouchableOpacity
                      style={styles.campaignDelete}
                      onPress={() => {
                        Alert.alert('Remove Campaign', 'Remove this campaign from the contact?', [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Remove', style: 'destructive', onPress: () => deleteCampaign({ orgId: org.id, campaignId: campaign.id }) },
                        ]);
                      }}
                    >
                      <Trash2 size={13} color={Colors.light.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  {campaign.steps.map((step) => {
                    return (
                      <View key={step.id} style={styles.campaignStep}>
                        <View style={styles.campaignStepNum}>
                          <Text style={styles.campaignStepNumText}>{step.stepNumber}</Text>
                        </View>
                        <View style={styles.campaignStepInfo}>
                          <Text style={styles.campaignStepLabel}>{step.label}</Text>
                          <View style={styles.campaignStepMeta}>
                            <View style={[styles.campaignStepTypeBadge, { backgroundColor: ACTIVITY_TYPE_CONFIG[step.type as ActivityType]?.color + '20' || '#F3F4F6' }]}>
                              <Text style={[styles.campaignStepTypeText, { color: ACTIVITY_TYPE_CONFIG[step.type as ActivityType]?.color || '#6B7280' }]}>
                                {step.type.charAt(0).toUpperCase() + step.type.slice(1)}
                              </Text>
                            </View>
                            {step.scheduledDate && (
                              <Text style={styles.campaignStepDate}>Due {formatDate(step.scheduledDate)}</Text>
                            )}
                          </View>
                        </View>
                        <View style={styles.campaignStepStatus}>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <View style={styles.stepStatusRow}>
                              {STEP_STATUSES.map((ss) => (
                                <TouchableOpacity
                                  key={ss}
                                  style={[styles.stepStatusBtn, step.status === ss && { backgroundColor: STEP_STATUS_CONFIG[ss].bg, borderColor: STEP_STATUS_CONFIG[ss].color }]}
                                  onPress={() => handleUpdateStepStatus(campaign, step, ss)}
                                >
                                  <Text style={[styles.stepStatusBtnText, step.status === ss && { color: STEP_STATUS_CONFIG[ss].color, fontWeight: '700' as const }]}>
                                    {STEP_STATUS_CONFIG[ss].label}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          </ScrollView>
                        </View>
                      </View>
                    );
                  })}
                </View>
              );
            })
          )}
        </View>
      )}

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
                input.accept = '.ai,.svg,.png,.jpg,.jpeg,.pdf,.dst,.emb';
                input.onchange = (e: any) => {
                  const file = e.target?.files?.[0];
                  if (file) handleOrgFileUpload(file);
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
              const file = e.dataTransfer?.files?.[0];
              if (file) handleOrgFileUpload(file);
            }}
          >
            {/* Floating accent dots */}
            <View style={[styles.mediaDot, { top: 18, left: 28, width: 5, height: 5 }]} />
            <View style={[styles.mediaDot, { top: 12, right: 60, width: 4, height: 4 }]} />
            <View style={[styles.mediaDot, { top: 30, right: 32, width: 6, height: 6, opacity: 0.4 }]} />
            <View style={[styles.mediaDot, { bottom: 44, left: 18, width: 4, height: 4, opacity: 0.35 }]} />
            <View style={[styles.mediaDot, { bottom: 30, right: 20, width: 5, height: 5, opacity: 0.5 }]} />
            {/* Three tilted icon cards */}
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
            <Text style={styles.mediaBinEmptySub}>AI · SVG · PNG · JPG · PDF · DST · EMB</Text>
          </View>
        ) : (
          <View
            style={[styles.orgMediaGrid, orgFilesDragOver && { opacity: 0.7 }]}
            onDragOver={(e: any) => { e.preventDefault(); setOrgFilesDragOver(true); }}
            onDragLeave={() => setOrgFilesDragOver(false)}
            onDrop={(e: any) => {
              e.preventDefault();
              setOrgFilesDragOver(false);
              const file = e.dataTransfer?.files?.[0];
              if (file) handleOrgFileUpload(file);
            }}
          >
            {orgFiles.map((f: any) => {
              const isImage = f.mimeType?.startsWith('image/');
              const ext = (f.originalName || '').split('.').pop()?.toUpperCase() || 'FILE';
              return (
                <View key={f.id} style={styles.orgMediaItem}>
                  {isImage ? (
                    <Image
                      source={{ uri: `/api/files/${f.id}?inline=true` }}
                      style={styles.orgMediaThumb}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.orgMediaIcon}>
                      <FileText size={18} color={Colors.light.tint} />
                      <Text style={styles.orgMediaExt}>{ext}</Text>
                    </View>
                  )}
                  <Text style={styles.orgMediaName} numberOfLines={1}>{f.originalName}</Text>
                  <View style={styles.orgMediaActions}>
                    {Platform.OS === 'web' && (
                      <TouchableOpacity
                        onPress={() => (typeof window !== 'undefined') && window.open(`/api/files/${f.id}?inline=true`, '_blank')}
                        style={styles.orgMediaActionBtn}
                      >
                        <ExternalLink size={12} color={Colors.light.textSecondary} />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => handleOrgFileDelete(f.id)} style={styles.orgMediaActionBtn}>
                      <Trash2 size={12} color={Colors.light.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: org.name,
          headerStyle: { backgroundColor: Colors.light.headerBg },
          headerTintColor: '#fff',
        }}
      />

      {isDesktop ? (
        <View style={styles.desktopLayout}>
          <ScrollView style={styles.desktopLeft} contentContainerStyle={styles.desktopLeftContent} showsVerticalScrollIndicator={false}>
            {leftPanel}
          </ScrollView>
          <View style={styles.desktopRight}>
            {rightPanel}
          </View>
        </View>
      ) : (
        <ScrollView style={styles.mobileScroll} showsVerticalScrollIndicator={false}>
          {leftPanel}
          {rightPanel}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* Edit Org Modal */}
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

      {/* Contact Modal */}
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
                      <TouchableOpacity
                        style={[styles.statusChip, !contactForm.departmentId && styles.statusChipActive]}
                        onPress={() => setContactForm((f) => ({ ...f, departmentId: '' }))}
                      >
                        <Text style={[styles.statusChipText, !contactForm.departmentId && styles.statusChipTextActive]}>None</Text>
                      </TouchableOpacity>
                      {(org.departments || []).map((d) => (
                        <TouchableOpacity
                          key={d.id}
                          style={[styles.statusChip, contactForm.departmentId === d.id && styles.statusChipActive]}
                          onPress={() => setContactForm((f) => ({ ...f, departmentId: d.id }))}
                        >
                          <Text style={[styles.statusChipText, contactForm.departmentId === d.id && styles.statusChipTextActive]}>{d.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}
                <TouchableOpacity style={styles.primaryToggle} onPress={() => setContactForm((f) => ({ ...f, isPrimary: !f.isPrimary }))}>
                  {contactForm.isPrimary ? <CheckCircle size={18} color={Colors.light.tint} /> : <Circle size={18} color={Colors.light.textSecondary} />}
                  <Text style={styles.primaryToggleText}>Set as primary contact</Text>
                </TouchableOpacity>
                {!!contactForm.email.trim() && (
                  <TouchableOpacity style={[styles.primaryToggle, { marginTop: 4 }]} onPress={() => setContactForm((f) => ({ ...f, hubAccess: !f.hubAccess }))}>
                    {contactForm.hubAccess ? <CheckCircle size={18} color={Colors.light.tint} /> : <Circle size={18} color={Colors.light.textSecondary} />}
                    <Text style={styles.primaryToggleText}>Enable Client Hub Access</Text>
                  </TouchableOpacity>
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

      {/* Activity Modal */}
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

      {/* Department Modal */}
      <Modal visible={deptModal} transparent animationType="fade" onRequestClose={() => setDeptModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setDeptModal(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalKAV}>
            <Pressable style={styles.modalCard} onPress={() => {}}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editingDept ? 'Edit Department' : 'Add Department'}</Text>
                <TouchableOpacity onPress={() => setDeptModal(false)}><X size={22} color={Colors.light.textSecondary} /></TouchableOpacity>
              </View>
              <Text style={styles.fieldLabel}>Department Name *</Text>
              <TextInput
                style={styles.textInput}
                value={deptForm.name}
                onChangeText={(v) => setDeptForm((f) => ({ ...f, name: v }))}
                placeholder="e.g., Youth, Communications, Admin…"
                placeholderTextColor={Colors.light.textSecondary}
                autoFocus
              />
              <Text style={styles.fieldLabel}>Description (optional)</Text>
              <TextInput
                style={[styles.textInput, styles.notesInput]}
                value={deptForm.description}
                onChangeText={(v) => setDeptForm((f) => ({ ...f, description: v }))}
                placeholder="Brief description of this department…"
                placeholderTextColor={Colors.light.textSecondary}
                multiline
                numberOfLines={2}
              />
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

      {/* Campaign Modal */}
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
                  <TouchableOpacity
                    key={tpl.id}
                    style={[styles.templateOption, selectedTemplateId === tpl.id && styles.templateOptionActive]}
                    onPress={() => setSelectedTemplateId(tpl.id)}
                  >
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
                  onPress={() => {
                    assignCampaign({ orgId: org.id, templateId: selectedTemplateId });
                    setCampaignModal(false);
                    setSelectedTemplateId(undefined);
                  }}
                >
                  <Text style={styles.saveBtnText}>Start Campaign</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {/* Invite Client User Modal */}
      <Modal visible={addClientUserModal} transparent animationType="fade" onRequestClose={() => setAddClientUserModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setAddClientUserModal(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalKAV}>
            <Pressable style={styles.modalCard} onPress={() => {}}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Invite Client User</Text>
                <TouchableOpacity onPress={() => setAddClientUserModal(false)}><X size={22} color={Colors.light.textSecondary} /></TouchableOpacity>
              </View>
              <Text style={styles.fieldLabel}>Full Name</Text>
              <TextInput
                style={styles.fieldInput}
                value={clientUserForm.name}
                onChangeText={(v) => setClientUserForm((f) => ({ ...f, name: v }))}
                placeholder="e.g. Jane Smith"
                placeholderTextColor={Colors.light.placeholder}
              />
              <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Email Address</Text>
              <TextInput
                style={styles.fieldInput}
                value={clientUserForm.email}
                onChangeText={(v) => setClientUserForm((f) => ({ ...f, email: v }))}
                placeholder="e.g. jane@client.com"
                placeholderTextColor={Colors.light.placeholder}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setAddClientUserModal(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, (!clientUserForm.name.trim() || !clientUserForm.email.trim() || clientUserSaving) && { opacity: 0.4 }]}
                  onPress={handleAddClientUser}
                  disabled={!clientUserForm.name.trim() || !clientUserForm.email.trim() || clientUserSaving}
                >
                  <Text style={styles.saveBtnText}>{clientUserSaving ? 'Adding...' : 'Add Client'}</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {/* Add Member Modal */}
      <Modal visible={addMemberModal} transparent animationType="fade" onRequestClose={() => setAddMemberModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setAddMemberModal(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalKAV}>
            <Pressable style={styles.modalCard} onPress={() => {}}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add Member</Text>
                <TouchableOpacity onPress={() => setAddMemberModal(false)}><X size={22} color={Colors.light.textSecondary} /></TouchableOpacity>
              </View>
              <Text style={styles.fieldLabel}>Select User</Text>
              {availableUsers.length === 0 ? (
                <Text style={[styles.emptyTabSub, { marginBottom: 12 }]}>No users synced yet. Create a user in the app first.</Text>
              ) : (
                <ScrollView style={{ maxHeight: 180 }} showsVerticalScrollIndicator={false}>
                  {availableUsers.map((u) => {
                    const selected = memberForm.userId === u.id;
                    return (
                      <TouchableOpacity
                        key={u.id}
                        style={[styles.userPickerRow, selected && styles.userPickerRowSelected]}
                        onPress={() => setMemberForm((f) => ({ ...f, userId: u.id }))}
                      >
                        <View style={[styles.memberAvatar, { backgroundColor: u.avatarColor || '#FF5A00', width: 30, height: 30, borderRadius: 15 }]}>
                          <Text style={[styles.memberAvatarText, { fontSize: 12 }]}>{(u.name || '?')[0].toUpperCase()}</Text>
                        </View>
                        <Text style={[styles.userPickerName, selected && { color: '#FF5A00', fontWeight: '600' as const }]}>{u.name}</Text>
                        {selected && <CheckCircle size={16} color="#FF5A00" />}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
              <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Role</Text>
              <TouchableOpacity style={[styles.typePickerBtn, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]} onPress={() => setMemberRoleDropdown((v) => !v)}>
                <Text style={styles.typePickerBtnText}>{MEMBERSHIP_ROLE_LABELS[memberForm.role] || memberForm.role}</Text>
                <ChevronDown size={16} color={Colors.light.textSecondary} />
              </TouchableOpacity>
              {memberRoleDropdown && (
                <View style={styles.typeDropdown}>
                  {MEMBERSHIP_ROLES.map((r) => (
                    <TouchableOpacity key={r} style={styles.typeDropdownItem} onPress={() => { setMemberForm((f) => ({ ...f, role: r })); setMemberRoleDropdown(false); }}>
                      <Text style={[styles.typeDropdownText, memberForm.role === r && styles.typeDropdownTextActive]}>{MEMBERSHIP_ROLE_LABELS[r]}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setAddMemberModal(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, !memberForm.userId && { opacity: 0.4 }]}
                  onPress={handleAddMember}
                  disabled={!memberForm.userId}
                >
                  <Text style={styles.saveBtnText}>Add Member</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </View>
  );
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

  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, borderWidth: 1, marginTop: 8 },
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
  contactActionBtn: { padding: 6 },
  contactActionBtnPrimary: { backgroundColor: '#FFF4EE', borderRadius: 6 },

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
    position: 'absolute' as const, top: 56, left: 12,
    backgroundColor: Colors.light.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingVertical: 4,
    minWidth: 160,
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
    width: 52,
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

  revenueStatsRow: {
    flexDirection: 'row' as const, alignItems: 'center' as const,
    backgroundColor: Colors.light.background, borderRadius: 10,
    padding: 12, marginBottom: 12,
  },
  revenueStatBox: { flex: 1, alignItems: 'center' as const, gap: 2 },
  revenueStatValue: { fontSize: 18, fontWeight: '800' as const, color: Colors.light.text },
  revenueStatLabel: { fontSize: 11, color: Colors.light.textSecondary, fontWeight: '500' as const },
  revenueStatDivider: { width: 1, height: 32, backgroundColor: Colors.light.border },

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
    backgroundColor: '#C85C28',
    overflow: 'hidden' as const,
  },
  orgMediaDropZoneActive: {
    borderWidth: 1.5,
    borderColor: '#1A1210',
    backgroundColor: '#B85020',
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
    gap: 10,
    marginTop: 10,
  },
  orgMediaItem: {
    width: 90,
    gap: 4,
  },
  orgMediaThumb: {
    width: 90,
    height: 72,
    borderRadius: 8,
    backgroundColor: Colors.light.border,
  },
  orgMediaIcon: {
    width: 90,
    height: 72,
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
});
