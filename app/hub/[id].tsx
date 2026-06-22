import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import PageBackHeader from '@/components/PageBackHeader';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Globe,
  ShieldCheck,
  Users,
  X,
  Plus,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  Mail,
  Clock,
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
  Trash2,
  ChevronRight,
  Image as ImageIcon,
  Link,
  ShoppingCart,
  DollarSign,
  FileText,
  Calendar,
  LogIn,
  Activity,
  QrCode,
  MapPin,
  UserCheck,
  Eye,
  MessageSquare,
  Rocket,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useCrm } from '@/contexts/CrmContext';
import { useQuotes } from '@/contexts/QuotesContext';
import { OrgMembership, MembershipRole, Contact } from '@/types/crm';
import { OrgAvatar } from '@/components/OrgAvatar';
import { useBreakpoint } from '@/hooks/useBreakpoint';

const TINT = Colors.light.tint;

const ROLE_LABELS: Record<MembershipRole, string> = {
  ORG_ADMIN: 'Org Admin',
  MEMBER: 'Member',
  BILLING_CONTACT: 'Billing',
  APPROVER: 'Approver',
};

const ROLE_COLORS: Record<MembershipRole, { bg: string; text: string }> = {
  ORG_ADMIN: { bg: '#FFF7ED', text: '#C2410C' },
  MEMBER: { bg: '#F0FDF4', text: '#16A34A' },
  BILLING_CONTACT: { bg: '#EFF6FF', text: '#2563EB' },
  APPROVER: { bg: '#FDF4FF', text: '#9333EA' },
};

const CLIENT_ROLES: MembershipRole[] = ['MEMBER', 'ORG_ADMIN', 'BILLING_CONTACT', 'APPROVER'];

function fmt(d?: string | Date | null): string {
  if (!d) return '—';
  try {
    return new Date(d as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '—';
  }
}

function fmtCurrency(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

function timeAgo(date?: string | Date | null): string {
  if (!date) return '—';
  const d = new Date(date as string);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return fmt(date);
}

function RoleBadge({ role }: { role: MembershipRole }) {
  const { bg, text } = ROLE_COLORS[role] || { bg: '#F3F4F6', text: '#6B7280' };
  return (
    <View style={[styles.roleBadge, { backgroundColor: bg }]}>
      <Text style={[styles.roleBadgeText, { color: text }]}>{ROLE_LABELS[role] || role}</Text>
    </View>
  );
}

function InvitedBadge() {
  return (
    <View style={styles.invitedBadge}>
      <Clock size={9} color="#D97706" />
      <Text style={styles.invitedBadgeText}>Invited</Text>
    </View>
  );
}

function CircleProgress({ pct, size = 80 }: { pct: number; size?: number }) {
  const stroke = 7;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);
  const cx = size / 2;
  const cy = size / 2;
  if (Platform.OS !== 'web') {
    return (
      <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: stroke, borderColor: '#22C55E', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: '#111' }}>{pct}%</Text>
      </View>
    );
  }
  return (
    // @ts-ignore
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
      {/* @ts-ignore */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#E5E7EB" strokeWidth={stroke} />
      {/* @ts-ignore */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#22C55E" strokeWidth={stroke} strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`} />
    </svg>
  );
}

function activityIcon(type: string) {
  switch (type) {
    case 'login':
    case 'hub_login': return { icon: <LogIn size={13} color="#6B7280" />, bg: '#F3F4F6' };
    case 'portal_request':
    case 'request': return { icon: <FileText size={13} color="#6B7280" />, bg: '#F3F4F6' };
    case 'invite_accepted':
    case 'invitation_accepted': return { icon: <UserCheck size={13} color="#6B7280" />, bg: '#F3F4F6' };
    case 'quote_viewed':
    case 'view': return { icon: <Eye size={13} color="#6B7280" />, bg: '#F3F4F6' };
    case 'note':
    case 'call': return { icon: <MessageSquare size={13} color="#6B7280" />, bg: '#F3F4F6' };
    default: return { icon: <Activity size={13} color="#6B7280" />, bg: '#F3F4F6' };
  }
}

export default function HubManagementScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { orgs, isLoading: crmLoading, updateOrgHubEnabled, updateOrgHubEnabledAsync } = useCrm();
  const { quotes } = useQuotes();
  const { isMobile, isTablet, isDesktop } = useBreakpoint();

  const org = orgs.find((o) => o.id === id);

  const [hubOn, setHubOn] = useState(org?.hubEnabled ?? false);
  useEffect(() => { setHubOn(org?.hubEnabled ?? false); }, [org?.hubEnabled]);

  const { data: memberships = [], isLoading: membershipsLoading, refetch: refetchMemberships } =
    useQuery<OrgMembership[]>({
      queryKey: ['hub-memberships', id],
      queryFn: async () => {
        if (!id) return [];
        const res = await fetch(`/api/memberships?orgId=${id}`);
        if (!res.ok) return [];
        return res.json();
      },
      enabled: !!id,
    });

  const { data: internalUsers = [] } = useQuery<{ id: string; name: string; avatarColor: string; email: string }[]>({
    queryKey: ['internal-users'],
    queryFn: async () => {
      const res = await fetch('/api/users?type=internal');
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: orgDetail } = useQuery<{ activities?: any[] }>({
    queryKey: ['org-detail-hub', id],
    queryFn: async () => {
      if (!id) return {};
      const res = await fetch(`/api/orgs/${id}`);
      if (!res.ok) return {};
      return res.json();
    },
    enabled: !!id,
  });

  const { data: orgContacts = [], refetch: refetchContacts } = useQuery<Contact[]>({
    queryKey: ['hub-contacts', id],
    queryFn: async () => {
      if (!id) return [];
      const res = await fetch(`/api/orgs/${id}/contacts`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!id,
  });

  const recentActivities = useMemo(() => {
    const acts = (orgDetail?.activities || []) as any[];
    return acts.slice(0, 5);
  }, [orgDetail]);

  const isRealClientUser = (m: OrgMembership) =>
    !!(m.userEmail) || !!(m.userName && m.userName.trim() !== '' && m.userName.trim() !== 'User');

  const allClientMembers = memberships.filter((m) => m.userType === 'CLIENT' && isRealClientUser(m));
  const clientOrgAdmins = allClientMembers.filter((m) => m.role === 'ORG_ADMIN');
  const regularClients = allClientMembers.filter((m) => m.role !== 'ORG_ADMIN');
  const accountReps = memberships.filter((m) => m.userType === 'INTERNAL');

  const membershipByUserId = useMemo(() => {
    const map = new Map<string, OrgMembership>();
    memberships.forEach((m) => { if (m.userId) map.set(m.userId, m); });
    return map;
  }, [memberships]);

  const contactsWithHub = useMemo(() => orgContacts.map((c) => ({
    contact: c,
    membership: c.linkedUserId ? membershipByUserId.get(c.linkedUserId) : undefined,
  })), [orgContacts, membershipByUserId]);
  const realInternalUsers = (internalUsers as any[]).filter((u) => !!u.name?.trim());
  const defaultRepUser = realInternalUsers.find((u: any) => u.role === 'org_admin') || realInternalUsers[0];

  const orgProjects = useMemo(() => quotes.filter((q) => q.organizationId === id), [quotes, id]);
  const orgRevenue = useMemo(() => orgProjects.reduce((sum, q) => sum + (Number(q.grandTotal) || 0), 0), [orgProjects]);

  const lastLogin = useMemo(() => {
    const logins = memberships.map((m: any) => m.lastLoginAt).filter(Boolean);
    if (!logins.length) return null;
    return logins.sort().reverse()[0];
  }, [memberships]);

  const lastActivityDate = useMemo(() => {
    if (!recentActivities.length) return null;
    return recentActivities[0]?.createdAt || null;
  }, [recentActivities]);

  const hubReadiness = useMemo(() => [
    { label: 'Hub Enabled', done: !!org?.hubEnabled },
    { label: 'Team Member Added', done: contactsWithHub.some((c) => !!c.membership) },
    { label: 'Hub Link Generated', done: !!org?.hubEnabled },
    { label: 'Organization Admin Assigned', done: contactsWithHub.some((c) => c.membership?.role === 'ORG_ADMIN') },
    { label: 'Organization Logo Added', done: !!(org?.logoUrl) },
  ], [org?.hubEnabled, contactsWithHub, org?.logoUrl]);

  const readinessPct = Math.round((hubReadiness.filter((r) => r.done).length / hubReadiness.length) * 100);

  const [assignAdminModal, setAssignAdminModal] = useState(false);
  const [selectedAdminMembershipId, setSelectedAdminMembershipId] = useState('');
  const [assigningAdmin, setAssigningAdmin] = useState(false);

  const [assignRepModal, setAssignRepModal] = useState(false);
  const [selectedRepUserId, setSelectedRepUserId] = useState('');
  const [assigningRep, setAssigningRep] = useState(false);

  const [inviteClientModal, setInviteClientModal] = useState(false);
  const [clientForm, setClientForm] = useState({ name: '', email: '', role: 'MEMBER' as MembershipRole });
  const [invitingSaving, setInvitingSaving] = useState(false);
  const [inviteError, setInviteError] = useState('');

  const [changeRoleModal, setChangeRoleModal] = useState<{ visible: boolean; membership: OrgMembership | null }>({ visible: false, membership: null });
  const [newRole, setNewRole] = useState<MembershipRole>('MEMBER');
  const [changingRole, setChangingRole] = useState(false);

  const [linkCopied, setLinkCopied] = useState(false);
  const [resendCopied, setResendCopied] = useState<string | null>(null);
  const [togglingContactId, setTogglingContactId] = useState<string | null>(null);

  const portalUrl = typeof window !== 'undefined' ? `${window.location.origin}/portal/${id}` : `/portal/${id}`;

  const handleCopyLink = useCallback(() => {
    if (typeof window !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(portalUrl).then(() => {
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
      });
    }
  }, [portalUrl]);

  const handleResendInvite = useCallback((membershipId: string) => {
    if (typeof window !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(portalUrl).then(() => {
        setResendCopied(membershipId);
        setTimeout(() => setResendCopied(null), 2500);
      });
    }
  }, [portalUrl]);

  const handleHubToggle = useCallback(async () => {
    if (!org) return;
    const newVal = !hubOn;
    setHubOn(newVal);
    try {
      await updateOrgHubEnabledAsync({ orgId: org.id, enabled: newVal });
      queryClient.invalidateQueries({ queryKey: ['org-detail-hub', id] });
      queryClient.invalidateQueries({ queryKey: ['client-hubs'] });
    } catch {
      setHubOn(!newVal);
      Alert.alert('Error', 'Failed to update hub status. Please try again.');
    }
  }, [org, hubOn, id, updateOrgHubEnabledAsync, queryClient]);

  const handleGrantHubAccess = useCallback(async (contact: Contact) => {
    if (!org) return;
    if (!contact.email) {
      Alert.alert('Missing Email', `${contact.firstName} ${contact.lastName} has no email address. Add one in Org Details first.`);
      return;
    }
    setTogglingContactId(contact.id);
    try {
      const userId = `client_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const userRes = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId, name: `${contact.firstName} ${contact.lastName}`.trim(), email: contact.email, userType: 'CLIENT' }),
      });
      if (!userRes.ok) throw new Error('Failed to create user');
      const user = await userRes.json();
      const memRes = await fetch('/api/memberships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: org.id, userId: user.id, role: 'MEMBER' }),
      });
      if (!memRes.ok) throw new Error('Failed to create membership');
      await fetch(`/api/orgs/${org.id}/contacts/${contact.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkedUserId: user.id }),
      });
      await Promise.all([refetchMemberships(), refetchContacts()]);
      queryClient.invalidateQueries({ queryKey: ['client-hubs'] });
      queryClient.invalidateQueries({ queryKey: ['crm_orgs'] });
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to grant hub access. Please try again.');
    } finally {
      setTogglingContactId(null);
    }
  }, [org, refetchMemberships, refetchContacts, queryClient]);

  const handleRevokeHubAccess = useCallback((contact: Contact, membership: OrgMembership) => {
    if (!org) return;
    Alert.alert(
      'Revoke Hub Access',
      `Remove ${contact.firstName} ${contact.lastName}'s access to this hub?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            setTogglingContactId(contact.id);
            try {
              await fetch(`/api/memberships/${membership.id}`, { method: 'DELETE' });
              await fetch(`/api/orgs/${org.id}/contacts/${contact.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ linkedUserId: null }),
              });
              await Promise.all([refetchMemberships(), refetchContacts()]);
              queryClient.invalidateQueries({ queryKey: ['client-hubs'] });
              queryClient.invalidateQueries({ queryKey: ['crm_orgs'] });
            } catch {
              Alert.alert('Error', 'Failed to revoke access. Please try again.');
            } finally {
              setTogglingContactId(null);
            }
          },
        },
      ],
    );
  }, [org, refetchMemberships, refetchContacts, queryClient]);

  const handleToggleOrgAdmin = useCallback(async (membership: OrgMembership) => {
    const newRole: MembershipRole = membership.role === 'ORG_ADMIN' ? 'MEMBER' : 'ORG_ADMIN';
    try {
      const res = await fetch(`/api/memberships/${membership.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) throw new Error('Failed');
      await refetchMemberships();
      queryClient.invalidateQueries({ queryKey: ['client-hubs'] });
    } catch {
      Alert.alert('Error', 'Failed to update role. Please try again.');
    }
  }, [refetchMemberships, queryClient]);

  const handleAssignAdmin = useCallback(async () => {
    if (!org || !selectedAdminMembershipId) return;
    setAssigningAdmin(true);
    try {
      const res = await fetch(`/api/memberships/${selectedAdminMembershipId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'ORG_ADMIN' }),
      });
      if (!res.ok) throw new Error('Failed to assign admin');
      await refetchMemberships();
      queryClient.invalidateQueries({ queryKey: ['client-hubs'] });
      setAssignAdminModal(false);
      setSelectedAdminMembershipId('');
    } catch {
      Alert.alert('Error', 'Failed to assign org admin. Try again.');
    } finally {
      setAssigningAdmin(false);
    }
  }, [org, selectedAdminMembershipId, refetchMemberships, queryClient]);

  const handleAssignRep = useCallback(async () => {
    if (!org || !selectedRepUserId) return;
    setAssigningRep(true);
    try {
      const res = await fetch('/api/memberships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: org.id, userId: selectedRepUserId, role: 'MEMBER' }),
      });
      if (!res.ok) throw new Error('Failed to assign rep');
      await refetchMemberships();
      queryClient.invalidateQueries({ queryKey: ['client-hubs'] });
      setAssignRepModal(false);
      setSelectedRepUserId('');
    } catch {
      Alert.alert('Error', 'Failed to assign account rep. Try again.');
    } finally {
      setAssigningRep(false);
    }
  }, [org, selectedRepUserId, refetchMemberships, queryClient]);

  const handleInviteClient = useCallback(async () => {
    if (!org || !clientForm.name.trim() || !clientForm.email.trim()) return;
    setInvitingSaving(true);
    try {
      const userId = `client_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const userRes = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId, name: clientForm.name.trim(), email: clientForm.email.trim(), userType: 'CLIENT' }),
      });
      if (!userRes.ok && userRes.status !== 204) {
        const err = await userRes.json().catch(() => ({}));
        throw new Error((err as any)?.error || 'Failed to create user');
      }
      const newUser = userRes.status === 204 ? { id: userId } : await userRes.json();
      const memRes = await fetch('/api/memberships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: org.id, userId: newUser.id, role: clientForm.role }),
      });
      if (!memRes.ok) throw new Error('Failed to add membership');
      const [firstName, ...restParts] = clientForm.name.trim().split(' ');
      await fetch(`/api/orgs/${org.id}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName: firstName || '', lastName: restParts.join(' ') || '', email: clientForm.email.trim(), linkedUserId: newUser.id, isPrimary: clientForm.role === 'ORG_ADMIN' }),
      });
      const pUrl = typeof window !== 'undefined' ? `${window.location.origin}/portal/${org.id}` : '';
      fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'client_invite', clientEmail: clientForm.email.trim(), clientName: clientForm.name.trim(), orgName: org.name, portalUrl: pUrl }),
      }).catch((e) => console.warn('[invite email]', e));
      await refetchMemberships();
      queryClient.invalidateQueries({ queryKey: ['client-hubs'] });
      queryClient.invalidateQueries({ queryKey: ['crm_orgs'] });
      queryClient.invalidateQueries({ queryKey: ['org-detail-hub', id] });
      setInviteClientModal(false);
      setClientForm({ name: '', email: '', role: 'MEMBER' });
    } catch (err: any) {
      setInviteError(err?.message || 'Failed to invite client user. Please try again.');
    } finally {
      setInvitingSaving(false);
    }
  }, [org, clientForm, refetchMemberships, queryClient, id]);

  const handleChangeRole = useCallback(async () => {
    if (!changeRoleModal.membership) return;
    setChangingRole(true);
    try {
      const res = await fetch(`/api/memberships/${changeRoleModal.membership.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) throw new Error('Failed to change role');
      await refetchMemberships();
      queryClient.invalidateQueries({ queryKey: ['client-hubs'] });
      setChangeRoleModal({ visible: false, membership: null });
    } catch {
      Alert.alert('Error', 'Failed to update role. Try again.');
    } finally {
      setChangingRole(false);
    }
  }, [changeRoleModal, newRole, refetchMemberships, queryClient]);

  const handleRemoveMember = useCallback((m: OrgMembership) => {
    Alert.alert(
      'Remove Member',
      `Remove ${m.userName || 'this member'} from ${org?.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await fetch(`/api/memberships/${m.id}`, { method: 'DELETE' });
              await refetchMemberships();
              queryClient.invalidateQueries({ queryKey: ['client-hubs'] });
            } catch {
              Alert.alert('Error', 'Failed to remove member.');
            }
          },
        },
      ],
    );
  }, [org, refetchMemberships, queryClient]);

  if (crmLoading && !org) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Hub Management', headerStyle: { backgroundColor: Colors.light.headerBg }, headerTintColor: '#fff' }} />
        <View style={styles.centered}>
          <ActivityIndicator color={TINT} size="large" />
        </View>
      </View>
    );
  }

  if (!org) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Hub Management', headerStyle: { backgroundColor: Colors.light.headerBg }, headerTintColor: '#fff' }} />
        <View style={styles.centered}>
          <Text style={styles.notFoundText}>Organization not found</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const isReady = org.hubEnabled && allClientMembers.length > 0;
  const orgLocation = [(org as any).city, (org as any).state].filter(Boolean).join(', ');
  const rep = accountReps[0];

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Hub Management', headerStyle: { backgroundColor: Colors.light.headerBg }, headerTintColor: '#fff' }} />
      <PageBackHeader title="Hub Management" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, isDesktop && styles.contentDesktop]}>

        {/* ── Hero ── */}
        <View style={styles.heroCard}>
          <View style={styles.heroGradientBg}>

            <View style={styles.heroTop}>
              {/* Logo Card */}
              <View style={styles.heroLogoCard}>
                <OrgAvatar name={org.name} logoUrl={org.logoUrl} size={72} shape="square" />
              </View>

              {/* Org Info */}
              <View style={styles.heroCenter}>
                <Text style={styles.heroOrgName} numberOfLines={2}>{org.name}</Text>
                {org.type ? <Text style={styles.heroOrgType}>{org.type}</Text> : null}

                <View style={styles.heroBadgesRow}>
                  <View style={[styles.pill, isReady ? styles.pillGreen : styles.pillAmber]}>
                    {isReady ? <CheckCircle2 size={9} color="#16A34A" /> : <AlertCircle size={9} color="#D97706" />}
                    <Text style={[styles.pillText, isReady ? styles.pillTextGreen : styles.pillTextAmber]}>
                      {isReady ? 'Portal Ready' : 'Needs Setup'}
                    </Text>
                  </View>

                  <TouchableOpacity style={styles.hubTogglePill} onPress={handleHubToggle} activeOpacity={0.7}>
                    <Text style={[styles.hubTogglePillText, hubOn && styles.hubTogglePillTextOn]}>
                      Hub {hubOn ? 'On' : 'Off'}
                    </Text>
                    {hubOn
                      ? <ToggleRight size={20} color={TINT} />
                      : <ToggleLeft size={20} color="#555" />}
                  </TouchableOpacity>
                </View>

                <View style={styles.heroStatsRow}>
                  <View style={styles.heroStatItem}>
                    <Users size={11} color="#888" />
                    <Text style={styles.heroStatText}>{allClientMembers.length} Member{allClientMembers.length !== 1 ? 's' : ''}</Text>
                  </View>
                  <Text style={styles.heroStatDivider}>|</Text>
                  <View style={styles.heroStatItem}>
                    <ShieldCheck size={11} color="#888" />
                    <Text style={styles.heroStatText}>
                      {clientOrgAdmins.length > 0 ? `${clientOrgAdmins[0].userName}` : 'No org admin'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Account Rep */}
              <View style={styles.heroRepSection}>
                <View style={styles.heroRepLabelRow}>
                  <Text style={styles.heroRepLabel}>ACCOUNT REP</Text>
                  <TouchableOpacity onPress={() => { setSelectedRepUserId(rep?.userId || (defaultRepUser as any)?.id || ''); setAssignRepModal(true); }}>
                    <Text style={styles.heroRepChange}>Change</Text>
                  </TouchableOpacity>
                </View>
                {rep ? (
                  <>
                    <View style={[styles.heroRepAvatar, { backgroundColor: rep.userAvatarColor || TINT }]}>
                      <Text style={styles.heroRepAvatarText}>{(rep.userName || '?')[0].toUpperCase()}</Text>
                    </View>
                    <Text style={styles.heroRepName}>{rep.userName}</Text>
                    {orgLocation ? (
                      <View style={styles.heroRepLocRow}>
                        <MapPin size={10} color="#888" />
                        <Text style={styles.heroRepLoc}>{orgLocation}</Text>
                      </View>
                    ) : null}
                  </>
                ) : (
                  <TouchableOpacity onPress={() => { setSelectedRepUserId((defaultRepUser as any)?.id || ''); setAssignRepModal(true); }}>
                    <Text style={styles.heroRepUnassigned}>Tap to assign →</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Bottom meta strip */}
            <View style={styles.heroMeta}>
              {(org as any).createdAt ? (
                <View style={styles.heroMetaItem}>
                  <Calendar size={10} color="#888" />
                  <View>
                    <Text style={styles.heroMetaLabel}>Created</Text>
                    <Text style={styles.heroMetaValue}>{fmt((org as any).createdAt)}</Text>
                  </View>
                </View>
              ) : null}
              {lastActivityDate ? (
                <View style={styles.heroMetaItem}>
                  <Clock size={10} color="#888" />
                  <View>
                    <Text style={styles.heroMetaLabel}>Last Activity</Text>
                    <Text style={styles.heroMetaValue}>{fmt(lastActivityDate)}</Text>
                  </View>
                </View>
              ) : null}
              {lastLogin ? (
                <View style={styles.heroMetaItem}>
                  <LogIn size={10} color="#888" />
                  <View>
                    <Text style={styles.heroMetaLabel}>Last Login</Text>
                    <Text style={styles.heroMetaValue}>{fmt(lastLogin)}</Text>
                  </View>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {/* ── KPI Row ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.kpiScroll}>
          <KpiCard icon={<Users size={18} color={TINT} />} value={allClientMembers.length} label="Members" linkText="View Members" />
          <KpiCard icon={<ShieldCheck size={18} color={TINT} />} value={clientOrgAdmins.length} label="Admins" linkText="Manage Admins" />
          <KpiCard icon={<FileText size={18} color={TINT} />} value="—" label="Project Requests" linkText="View Requests" />
          <KpiCard icon={<MessageSquare size={18} color={TINT} />} value={orgProjects.length} label="Quotes Generated" linkText="View Quotes" onLink={() => router.push(`/crm/${id}` as any)} />
          <KpiCard icon={<ShoppingCart size={18} color={TINT} />} value={orgProjects.filter((q) => (q as any).status === 'active' || (q as any).status === 'completed').length} label="Projects Awarded" linkText="View Projects" onLink={() => router.push(`/crm/${id}` as any)} />
          <KpiCard icon={<DollarSign size={18} color={TINT} />} value={orgRevenue > 0 ? fmtCurrency(orgRevenue) : '$0'} label="Revenue Generated" linkText="View Revenue" />
        </ScrollView>

        {/* ── 4-card grid ── */}
        <View style={[styles.grid, !isDesktop && styles.gridMobile]}>

          {/* Org Admin */}
          <View style={[styles.gridCard, !isDesktop && styles.gridCardFull]}>
            <View style={styles.cardHeader}>
              <ShieldCheck size={16} color={TINT} />
              <Text style={styles.cardTitle}>Org Admin</Text>
            </View>
            <Text style={styles.cardDesc}>Designate an organization admin who can manage hub members and settings.</Text>
            {clientOrgAdmins.length === 0 ? (
              <View style={styles.noAdminBox}>
                <Text style={styles.noAdminText}>No org admin assigned.</Text>
              </View>
            ) : (
              clientOrgAdmins.map((m) => (
                <View key={m.id} style={styles.miniMemberRow}>
                  <View style={[styles.miniAvatar, { backgroundColor: '#6366F1' }]}>
                    <Text style={styles.miniAvatarText}>{(m.userName || '?')[0].toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.miniMemberName}>{m.userName}</Text>
                    {m.userEmail ? <Text style={styles.miniMemberEmail}>{m.userEmail}</Text> : null}
                  </View>
                  <RoleBadge role={m.role} />
                </View>
              ))
            )}
            <TouchableOpacity
              style={styles.cardBtnBlack}
              onPress={() => { setSelectedAdminMembershipId(''); setAssignAdminModal(true); }}
              activeOpacity={0.8}
            >
              <Text style={styles.cardBtnBlackText}>Assign Admin</Text>
              <ChevronRight size={13} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Team Members */}
          <View style={[styles.gridCard, !isDesktop && styles.gridCardFull]}>
            <View style={styles.cardHeader}>
              <Users size={16} color={TINT} />
              <Text style={styles.cardTitle}>
                Team Members{orgContacts.length > 0 ? ` (${orgContacts.length})` : ''}
              </Text>
            </View>
            <Text style={styles.cardDesc}>Contacts from this org — toggle hub access per person.</Text>
            {membershipsLoading && orgContacts.length === 0 ? (
              <View style={{ paddingVertical: 12, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={TINT} />
              </View>
            ) : orgContacts.length === 0 ? (
              <View style={styles.noAdminBox}>
                <Text style={styles.noAdminText}>No contacts yet. Add contacts in Org Details.</Text>
              </View>
            ) : (
              contactsWithHub.slice(0, 4).map(({ contact, membership }) => {
                const isToggling = togglingContactId === contact.id;
                const fullName = `${contact.firstName} ${contact.lastName}`.trim();
                const avatarBg = membership
                  ? (membership.userStatus === 'INVITED' ? '#D1D5DB' : '#6366F1')
                  : '#E5E7EB';
                const avatarTextColor = membership ? '#fff' : '#9CA3AF';
                return (
                  <View key={contact.id} style={styles.miniMemberRow}>
                    <View style={[styles.miniAvatar, { backgroundColor: avatarBg }]}>
                      <Text style={[styles.miniAvatarText, { color: avatarTextColor }]}>
                        {(contact.firstName || '?')[0].toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.miniMemberName} numberOfLines={1}>{fullName || 'Unnamed'}</Text>
                      {contact.email
                        ? <Text style={styles.miniMemberEmail} numberOfLines={1}>{contact.email}</Text>
                        : <Text style={[styles.miniMemberEmail, { color: '#F59E0B' }]}>No email</Text>}
                    </View>
                    {isToggling ? (
                      <ActivityIndicator size="small" color={TINT} style={{ marginLeft: 6 }} />
                    ) : membership ? (
                      <View style={styles.contactHubActions}>
                        <RoleBadge role={membership.role} />
                        <TouchableOpacity
                          onPress={() => handleToggleOrgAdmin(membership)}
                          style={styles.adminToggleBtn}
                        >
                          <ShieldCheck size={13} color={membership.role === 'ORG_ADMIN' ? TINT : '#9CA3AF'} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleRevokeHubAccess(contact, membership)}
                          style={styles.revokeBtn}
                        >
                          <Text style={styles.revokeBtnText}>Revoke</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.grantAccessBtn}
                        onPress={() => handleGrantHubAccess(contact)}
                      >
                        <Text style={styles.grantAccessBtnText}>Grant Access</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })
            )}
            <TouchableOpacity
              style={styles.cardBtnOutline}
              onPress={() => { setClientForm({ name: '', email: '', role: 'MEMBER' }); setInviteError(''); setInviteClientModal(true); }}
              activeOpacity={0.8}
            >
              <Plus size={13} color={TINT} />
              <Text style={styles.cardBtnOutlineText}>Invite New Contact</Text>
            </TouchableOpacity>
          </View>

          {/* Share Hub */}
          <View style={[styles.gridCard, !isDesktop && styles.gridCardFull]}>
            <View style={styles.cardHeader}>
              <Link size={16} color={TINT} />
              <Text style={styles.cardTitle}>Share Hub</Text>
            </View>
            <Text style={styles.cardDesc}>Share this hub with clients so they can submit project requests.</Text>
            <View style={styles.shareUrlBox}>
              <Text style={styles.shareUrlText} numberOfLines={1} ellipsizeMode="middle">{portalUrl}</Text>
              <TouchableOpacity onPress={handleCopyLink}>
                <Copy size={13} color={Colors.light.textSecondary} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.cardBtnFilled, linkCopied && styles.cardBtnDone]}
              onPress={handleCopyLink}
              activeOpacity={0.8}
            >
              <Copy size={13} color="#fff" />
              <Text style={styles.cardBtnFilledText}>{linkCopied ? 'Copied!' : 'Copy Link'}</Text>
            </TouchableOpacity>
            <View style={styles.shareSecondaryRow}>
              <TouchableOpacity
                style={styles.shareSecondaryBtn}
                onPress={() => { if (Platform.OS === 'web') (window as any).open(portalUrl, '_blank'); }}
                activeOpacity={0.8}
              >
                <ExternalLink size={12} color={Colors.light.text} />
                <Text style={styles.shareSecondaryBtnText}>Open Hub</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.shareSecondaryBtn}
                onPress={() => Alert.alert('QR Code', 'QR code generation coming soon.')}
                activeOpacity={0.8}
              >
                <QrCode size={12} color={Colors.light.text} />
                <Text style={styles.shareSecondaryBtnText}>QR Code</Text>
              </TouchableOpacity>
            </View>
          </View>

        </View>

        {/* ── Bottom three columns ── */}
        <View style={[styles.bottomColumns, !isDesktop && styles.bottomColumnsMobile]}>

          {/* Branding */}
          <View style={[styles.bottomBranding, !isDesktop && styles.colFull]}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionTitleLeft}>
                <ImageIcon size={14} color={TINT} />
                <Text style={styles.sectionTitleText}>Branding</Text>
              </View>
            </View>
            <View style={styles.brandingCard}>
              <Text style={styles.cardDesc}>Manage the organization logo used throughout the hub.</Text>
              {org.logoUrl ? (
                <View style={styles.brandingLogoRow}>
                  <OrgAvatar name={org.name} logoUrl={org.logoUrl} size={48} shape="square" />
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <CheckCircle2 size={12} color="#16A34A" />
                      <Text style={styles.brandingLogoSetText}>Logo Configured</Text>
                    </View>
                    {(org as any).updatedAt ? (
                      <Text style={styles.brandingUpdatedText}>Last updated {fmt((org as any).updatedAt)}</Text>
                    ) : null}
                  </View>
                </View>
              ) : (
                <View style={styles.noAdminBox}>
                  <AlertTriangle size={12} color="#D97706" />
                  <Text style={[styles.noAdminText, { color: '#92400E' }]}>No logo uploaded.</Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.cardBtnOutline}
                onPress={() => router.push(`/crm/${org.id}` as any)}
                activeOpacity={0.8}
              >
                <Text style={styles.cardBtnOutlineText}>Edit in Org Details</Text>
                <ChevronRight size={13} color={TINT} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Recent Activity */}
          <View style={[styles.bottomLeft, !isDesktop && styles.colFull]}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionTitleLeft}>
                <Rocket size={14} color={TINT} />
                <Text style={styles.sectionTitleText}>Recent Activity</Text>
              </View>
              <TouchableOpacity onPress={() => router.push(`/crm/${id}` as any)}>
                <Text style={styles.viewAllLink}>View All Activity <ChevronRight size={11} color={TINT} /></Text>
              </TouchableOpacity>
            </View>
            <View style={styles.activityFeed}>
              {recentActivities.length === 0 ? (
                <Text style={styles.emptyFeedText}>No recent activity.</Text>
              ) : (
                recentActivities.map((a: any, i: number) => {
                  const cfg = activityIcon(a.type);
                  return (
                    <View key={a.id || i} style={styles.activityFeedRow}>
                      <View style={[styles.activityFeedIcon, { backgroundColor: cfg.bg }]}>
                        {cfg.icon}
                      </View>
                      <Text style={styles.activityFeedBody} numberOfLines={2}>{a.body || a.actionSummary || 'Activity logged'}</Text>
                      <Text style={styles.activityFeedTime}>{timeAgo(a.createdAt)}</Text>
                    </View>
                  );
                })
              )}
            </View>
          </View>

          {/* Hub Readiness */}
          <View style={[styles.bottomRight, !isDesktop && styles.colFull]}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionTitleLeft}>
                <CheckCircle2 size={14} color={TINT} />
                <Text style={styles.sectionTitleText}>Hub Readiness</Text>
              </View>
            </View>
            <View style={styles.readinessBody}>
              <View style={styles.readinessCircleWrap}>
                <CircleProgress pct={readinessPct} size={80} />
                <View style={styles.readinessPctOverlay}>
                  <Text style={styles.readinessPctText}>{readinessPct}%</Text>
                </View>
              </View>
              <View style={styles.readinessRight}>
                <Text style={styles.readinessHeading}>
                  {readinessPct === 100 ? 'Hub Ready!' : 'Almost There!'}
                </Text>
                <Text style={styles.readinessSub}>
                  {readinessPct === 100
                    ? 'Your hub is fully configured and ready for clients.'
                    : 'Complete the remaining steps to make your hub fully ready.'}
                </Text>
              </View>
            </View>
            <View style={styles.readinessChecklist}>
              {hubReadiness.map((item) => (
                <View key={item.label} style={styles.readinessItem}>
                  {item.done ? (
                    <CheckCircle2 size={14} color="#16A34A" />
                  ) : (
                    <AlertTriangle size={14} color="#D97706" />
                  )}
                  <Text style={[styles.readinessItemText, !item.done && styles.readinessItemTextWarn]}>
                    {item.label}
                  </Text>
                </View>
              ))}
            </View>
            <TouchableOpacity
              style={styles.setupGuideBtn}
              onPress={() => router.push(`/crm/${id}` as any)}
              activeOpacity={0.8}
            >
              <Text style={styles.setupGuideBtnText}>View Setup Guide</Text>
              <ChevronRight size={13} color="#fff" />
            </TouchableOpacity>
          </View>

        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* ── Assign Org Admin Modal ── */}
      <Modal visible={assignAdminModal} transparent animationType="fade" onRequestClose={() => setAssignAdminModal(false)}>
        <Pressable style={styles.overlay} onPress={() => setAssignAdminModal(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Assign Org Admin</Text>
              <TouchableOpacity onPress={() => setAssignAdminModal(false)}>
                <X size={20} color={Colors.light.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSub}>Select a client member to designate as the primary org admin.</Text>
            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              {regularClients.length === 0 ? (
                <Text style={styles.modalEmpty}>No eligible client members. Invite a client user first.</Text>
              ) : (
                regularClients.map((m) => (
                  <TouchableOpacity
                    key={m.id}
                    style={[styles.userPickerRow, selectedAdminMembershipId === m.id && styles.userPickerRowSelected]}
                    onPress={() => setSelectedAdminMembershipId(m.id)}
                  >
                    <View style={[styles.memberAvatar, { backgroundColor: '#6366F1', width: 32, height: 32, borderRadius: 16 }]}>
                      <Text style={[styles.memberAvatarText, { fontSize: 12 }]}>{(m.userName || '?')[0].toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.userPickerName}>{m.userName || 'Unknown'}</Text>
                      {m.userEmail ? <Text style={styles.userPickerEmail}>{m.userEmail}</Text> : null}
                    </View>
                    <View style={[styles.radioCircle, selectedAdminMembershipId === m.id && styles.radioCircleSelected]}>
                      {selectedAdminMembershipId === m.id && <View style={styles.radioFill} />}
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setAssignAdminModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, (!selectedAdminMembershipId || assigningAdmin) && styles.saveBtnDisabled]}
                onPress={handleAssignAdmin}
                disabled={!selectedAdminMembershipId || assigningAdmin}
              >
                {assigningAdmin
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.saveBtnText}>Promote to Org Admin</Text>}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Assign Account Rep Modal ── */}
      <Modal visible={assignRepModal} transparent animationType="fade" onRequestClose={() => setAssignRepModal(false)}>
        <Pressable style={styles.overlay} onPress={() => setAssignRepModal(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Assign Account Rep</Text>
              <TouchableOpacity onPress={() => setAssignRepModal(false)}>
                <X size={20} color={Colors.light.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSub}>Select an internal team member to own this client account.</Text>
            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              {realInternalUsers.length === 0 ? (
                <Text style={styles.modalEmpty}>No internal team members found.</Text>
              ) : (
                realInternalUsers.map((u: any) => (
                  <TouchableOpacity
                    key={u.id}
                    style={[styles.userPickerRow, selectedRepUserId === u.id && styles.userPickerRowSelected]}
                    onPress={() => setSelectedRepUserId(u.id)}
                  >
                    <View style={[styles.memberAvatar, { backgroundColor: u.avatarColor || TINT, width: 32, height: 32, borderRadius: 16 }]}>
                      <Text style={[styles.memberAvatarText, { fontSize: 12 }]}>{(u.name || '?')[0].toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.userPickerName}>{u.name}</Text>
                    </View>
                    <View style={[styles.radioCircle, selectedRepUserId === u.id && styles.radioCircleSelected]}>
                      {selectedRepUserId === u.id && <View style={styles.radioFill} />}
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setAssignRepModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, (!selectedRepUserId || assigningRep) && styles.saveBtnDisabled]}
                onPress={handleAssignRep}
                disabled={!selectedRepUserId || assigningRep}
              >
                {assigningRep
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.saveBtnText}>Assign as Account Rep</Text>}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Invite Client User Modal ── */}
      <Modal visible={inviteClientModal} transparent animationType="fade" onRequestClose={() => setInviteClientModal(false)}>
        <Pressable style={styles.overlay} onPress={() => setInviteClientModal(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalKAV}>
            <Pressable style={styles.modalCard} onPress={() => {}}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Invite Client User</Text>
                <TouchableOpacity onPress={() => setInviteClientModal(false)}>
                  <X size={20} color={Colors.light.textSecondary} />
                </TouchableOpacity>
              </View>
              <View style={styles.fieldLabelRow}>
                <Text style={[styles.fieldLabel, { marginBottom: 0 }]}>Full Name</Text>
                <Text style={styles.fieldRequired}>*</Text>
              </View>
              <TextInput
                style={[styles.fieldInput, !clientForm.name.trim() && inviteError ? styles.fieldInputError : null]}
                value={clientForm.name}
                onChangeText={(v) => { setClientForm((f) => ({ ...f, name: v })); setInviteError(''); }}
                placeholder="e.g. Jane Smith"
                placeholderTextColor={Colors.light.textSecondary}
                autoFocus
              />
              <View style={[styles.fieldLabelRow, { marginTop: 12 }]}>
                <Text style={[styles.fieldLabel, { marginBottom: 0 }]}>Email Address</Text>
                <Text style={styles.fieldRequired}>*</Text>
              </View>
              <TextInput
                style={[styles.fieldInput, !clientForm.email.trim() && inviteError ? styles.fieldInputError : null]}
                value={clientForm.email}
                onChangeText={(v) => { setClientForm((f) => ({ ...f, email: v })); setInviteError(''); }}
                placeholder="e.g. jane@client.com"
                placeholderTextColor={Colors.light.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Access Role</Text>
              <View style={styles.roleChips}>
                {CLIENT_ROLES.map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.roleChip, clientForm.role === r && styles.roleChipActive]}
                    onPress={() => setClientForm((f) => ({ ...f, role: r }))}
                  >
                    <Text style={[styles.roleChipText, clientForm.role === r && styles.roleChipTextActive]}>
                      {ROLE_LABELS[r]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {inviteError ? (
                <View style={styles.inlineError}>
                  <AlertCircle size={13} color={Colors.light.error} />
                  <Text style={styles.inlineErrorText}>{inviteError}</Text>
                </View>
              ) : null}
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setInviteClientModal(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, (!clientForm.name.trim() || !clientForm.email.trim() || invitingSaving) && styles.saveBtnDisabled]}
                  onPress={handleInviteClient}
                  disabled={!clientForm.name.trim() || !clientForm.email.trim() || invitingSaving}
                >
                  {invitingSaving
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={styles.saveBtnText}>Send Invite</Text>}
                </TouchableOpacity>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {/* ── Change Role Modal ── */}
      <Modal
        visible={changeRoleModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setChangeRoleModal({ visible: false, membership: null })}
      >
        <Pressable style={styles.overlay} onPress={() => setChangeRoleModal({ visible: false, membership: null })}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Role</Text>
              <TouchableOpacity onPress={() => setChangeRoleModal({ visible: false, membership: null })}>
                <X size={20} color={Colors.light.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSub}>
              Updating role for {changeRoleModal.membership?.userName || 'this member'}.
            </Text>
            <View style={styles.roleChips}>
              {CLIENT_ROLES.map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.roleChip, newRole === r && styles.roleChipActive]}
                  onPress={() => setNewRole(r)}
                >
                  <Text style={[styles.roleChipText, newRole === r && styles.roleChipTextActive]}>
                    {ROLE_LABELS[r]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setChangeRoleModal({ visible: false, membership: null })}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, changingRole && styles.saveBtnDisabled]}
                onPress={handleChangeRole}
                disabled={changingRole}
              >
                {changingRole
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.saveBtnText}>Save Role</Text>}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function KpiCard({
  icon, value, label, linkText, onLink,
}: {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  linkText: string;
  onLink?: () => void;
}) {
  return (
    <View style={styles.kpiCard}>
      <View style={styles.kpiIconWrap}>{icon}</View>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
      <TouchableOpacity style={styles.kpiLink} onPress={onLink} activeOpacity={0.7}>
        <Text style={styles.kpiLinkText}>{linkText}</Text>
        <ChevronRight size={11} color={TINT} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  content: { padding: 16, paddingBottom: 40, gap: 16 },
  contentDesktop: { maxWidth: 1120, alignSelf: 'center' as const, width: '100%' },
  centered: { flex: 1, justifyContent: 'center' as const, alignItems: 'center' as const, gap: 12 },
  notFoundText: { fontSize: 15, color: Colors.light.textSecondary },
  backBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: Colors.light.border },
  backBtnText: { fontSize: 14, color: Colors.light.text },

  // ── Hero ──
  heroCard: {
    borderRadius: 16,
    overflow: 'hidden' as const,
  },
  heroGradientBg: {
    borderRadius: 16,
    backgroundColor: '#000',
  },
  heroGlowRight: {
    position: 'absolute' as const,
    right: 0,
    top: 0,
    bottom: 0,
    width: '45%',
    backgroundColor: 'transparent',
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
  },
  heroTop: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    padding: 20,
    gap: 16,
  },
  heroLogoCard: {
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    flexShrink: 0,
  },
  heroCenter: { flex: 1, gap: 5 },
  heroOrgName: { fontSize: 20, fontWeight: '800' as const, color: '#fff', lineHeight: 25 },
  heroOrgType: { fontSize: 12, color: '#888' },
  heroBadgesRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 6, marginTop: 2 },

  pill: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  pillGreen: { backgroundColor: '#052e16' },
  pillAmber: { backgroundColor: '#451a03' },
  pillText: { fontSize: 10, fontWeight: '600' as const },
  pillTextGreen: { color: '#4ade80' },
  pillTextAmber: { color: '#fb923c' },

  hubTogglePill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  hubTogglePillText: { fontSize: 10, fontWeight: '600' as const, color: '#888' },
  hubTogglePillTextOn: { color: TINT },

  heroStatsRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, marginTop: 2 },
  heroStatItem: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4 },
  heroStatText: { fontSize: 11, color: '#aaa' },
  heroStatDivider: { fontSize: 11, color: '#444' },

  heroRepSection: { gap: 3, minWidth: 110, alignItems: 'flex-start' as const, flexShrink: 0 },
  heroRepLabelRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
  heroRepLabel: { fontSize: 9, fontWeight: '700' as const, color: '#666', textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  heroRepChange: { fontSize: 10, color: TINT, fontWeight: '600' as const },
  heroRepAvatar: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center' as const, alignItems: 'center' as const },
  heroRepAvatarText: { fontSize: 12, fontWeight: '700' as const, color: '#fff' },
  heroRepName: { fontSize: 13, fontWeight: '700' as const, color: '#fff' },
  heroRepLocRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 3 },
  heroRepLoc: { fontSize: 11, color: '#888' },
  heroRepUnassigned: { fontSize: 11, color: TINT, fontWeight: '500' as const },

  heroMeta: {
    flexDirection: 'row' as const,
    gap: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    flexWrap: 'wrap' as const,
  },
  heroMetaItem: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
  heroMetaLabel: { fontSize: 9, fontWeight: '600' as const, color: '#666', textTransform: 'uppercase' as const, letterSpacing: 0.4 },
  heroMetaValue: { fontSize: 11, fontWeight: '600' as const, color: '#ccc' },

  // ── KPI Bar ──
  kpiScroll: {
    gap: 10,
    paddingHorizontal: 2,
    paddingVertical: 4,
  },
  kpiCard: {
    width: 150,
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 14,
    gap: 2,
  },
  kpiIconWrap: { marginBottom: 4 },
  kpiValue: { fontSize: 22, fontWeight: '800' as const, color: Colors.light.text },
  kpiLabel: { fontSize: 11, color: Colors.light.textSecondary, marginBottom: 8 },
  kpiLink: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 2, marginTop: 'auto' as const },
  kpiLinkText: { fontSize: 11, color: TINT, fontWeight: '600' as const },

  // ── 4-card grid ──
  grid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 14,
  },
  gridMobile: { flexDirection: 'column' as const },
  gridCard: {
    flex: 1,
    minWidth: 280,
    backgroundColor: Colors.light.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 16,
    gap: 10,
  },
  gridCardFull: { flex: 0, minWidth: 0 },

  cardHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
  cardTitle: { fontSize: 14, fontWeight: '700' as const, color: Colors.light.text, flex: 1 },
  cardDesc: { fontSize: 12, color: Colors.light.textSecondary, lineHeight: 17 },

  noAdminBox: {
    backgroundColor: Colors.light.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 10,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  noAdminText: { fontSize: 12, color: Colors.light.textSecondary },

  miniMemberRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  miniAvatar: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center' as const, alignItems: 'center' as const, flexShrink: 0 },
  miniAvatarText: { fontSize: 11, fontWeight: '700' as const, color: '#fff' },
  miniMemberName: { fontSize: 13, fontWeight: '600' as const, color: Colors.light.text },
  miniMemberEmail: { fontSize: 11, color: Colors.light.textSecondary },

  cardBtnBlack: {
    backgroundColor: '#000',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 4,
    marginTop: 'auto' as const,
  },
  cardBtnBlackText: { fontSize: 13, fontWeight: '700' as const, color: '#fff' },

  cardBtnOutline: {
    borderWidth: 1.5,
    borderColor: TINT,
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 14,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 4,
    marginTop: 'auto' as const,
  },
  cardBtnOutlineText: { fontSize: 13, fontWeight: '700' as const, color: TINT },

  cardBtnFilled: {
    backgroundColor: TINT,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
  },
  cardBtnDone: { backgroundColor: '#16A34A' },
  cardBtnFilledText: { fontSize: 13, fontWeight: '700' as const, color: '#fff' },

  shareUrlBox: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    backgroundColor: Colors.light.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  shareUrlText: { flex: 1, fontSize: 11, color: Colors.light.textSecondary, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },

  shareSecondaryRow: { flexDirection: 'row' as const, gap: 8 },
  shareSecondaryBtn: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 5,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.background,
  },
  shareSecondaryBtnText: { fontSize: 12, fontWeight: '600' as const, color: Colors.light.text },

  brandingLogoRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10 },
  brandingLogoSetText: { fontSize: 12, color: '#16A34A', fontWeight: '600' as const },
  brandingUpdatedText: { fontSize: 11, color: Colors.light.textSecondary },

  // ── Bottom columns ──
  bottomColumns: { flexDirection: 'row' as const, gap: 16, alignItems: 'flex-start' as const },
  bottomColumnsMobile: { flexDirection: 'column' as const },
  bottomBranding: { flex: 2 },
  bottomLeft: { flex: 3 },
  bottomRight: { flex: 2 },
  colFull: { flex: 0 },
  brandingCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 14,
    gap: 10,
  },

  sectionTitleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 10,
  },
  sectionTitleLeft: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
  sectionTitleText: { fontSize: 14, fontWeight: '700' as const, color: Colors.light.text },
  viewAllLink: { fontSize: 11, color: TINT, fontWeight: '600' as const },

  activityFeed: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    overflow: 'hidden' as const,
  },
  emptyFeedText: { fontSize: 12, color: Colors.light.textSecondary, padding: 16, textAlign: 'center' as const },
  activityFeedRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  activityFeedIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    flexShrink: 0,
  },
  activityFeedBody: { flex: 1, fontSize: 12, color: Colors.light.text, lineHeight: 17 },
  activityFeedTime: { fontSize: 11, color: Colors.light.textSecondary, flexShrink: 0 },

  // ── Hub Readiness ──
  readinessBody: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 14,
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 14,
    marginBottom: 10,
  },
  readinessCircleWrap: { position: 'relative' as const, width: 80, height: 80, justifyContent: 'center' as const, alignItems: 'center' as const },
  readinessPctOverlay: {
    position: 'absolute' as const,
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  readinessPctText: { fontSize: 14, fontWeight: '800' as const, color: '#111' },
  readinessRight: { flex: 1, gap: 3 },
  readinessHeading: { fontSize: 14, fontWeight: '700' as const, color: Colors.light.text },
  readinessSub: { fontSize: 11, color: Colors.light.textSecondary, lineHeight: 16 },
  readinessChecklist: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 14,
    gap: 8,
    marginBottom: 10,
  },
  readinessItem: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
  readinessItemText: { fontSize: 12, color: Colors.light.text, fontWeight: '500' as const },
  readinessItemTextWarn: { color: '#D97706' },

  setupGuideBtn: {
    backgroundColor: '#000',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 4,
  },
  setupGuideBtnText: { fontSize: 13, fontWeight: '700' as const, color: '#fff' },

  // ── Member / list shared ──
  memberAvatar: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center' as const, alignItems: 'center' as const, flexShrink: 0 },
  memberAvatarText: { fontSize: 12, fontWeight: '700' as const, color: '#fff' },

  roleBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5 },
  roleBadgeText: { fontSize: 10, fontWeight: '600' as const },

  invitedBadge: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 3, backgroundColor: '#FFFBEB', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  invitedBadgeText: { fontSize: 9, fontWeight: '600' as const, color: '#D97706' },

  resendBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: TINT },
  resendBtnDone: { borderColor: '#16A34A' },
  resendBtnText: { fontSize: 10, color: TINT, fontWeight: '600' as const },
  resendBtnTextDone: { color: '#16A34A' },

  // ── Modals ──
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center' as const, alignItems: 'center' as const, padding: 20 },
  modalKAV: { width: '100%', maxWidth: 440 },
  modalCard: { backgroundColor: '#fff', borderRadius: 14, padding: 20, width: '100%', maxWidth: 440 },
  modalHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, marginBottom: 6 },
  modalTitle: { fontSize: 16, fontWeight: '700' as const, color: Colors.light.text },
  modalSub: { fontSize: 13, color: Colors.light.textSecondary, lineHeight: 18, marginBottom: 12 },
  modalEmpty: { fontSize: 12, color: Colors.light.textSecondary, paddingVertical: 10, textAlign: 'center' as const },
  modalActions: { flexDirection: 'row' as const, gap: 10, marginTop: 16 },

  userPickerRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, paddingVertical: 10, borderRadius: 8, paddingHorizontal: 6 },
  userPickerRowSelected: { backgroundColor: '#FFF7ED' },
  userPickerName: { fontSize: 13, fontWeight: '600' as const, color: Colors.light.text },
  userPickerEmail: { fontSize: 11, color: Colors.light.textSecondary },

  radioCircle: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: Colors.light.border, justifyContent: 'center' as const, alignItems: 'center' as const },
  radioCircleSelected: { borderColor: TINT },
  radioFill: { width: 8, height: 8, borderRadius: 4, backgroundColor: TINT },

  cancelBtn: { flex: 1, paddingVertical: 11, borderRadius: 8, borderWidth: 1, borderColor: Colors.light.border, alignItems: 'center' as const },
  cancelBtnText: { fontSize: 14, color: Colors.light.text },
  saveBtn: { flex: 2, paddingVertical: 11, borderRadius: 8, backgroundColor: TINT, alignItems: 'center' as const },
  saveBtnDisabled: { opacity: 0.45 },
  saveBtnText: { fontSize: 14, fontWeight: '700' as const, color: '#fff' },

  fieldLabelRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 3, marginBottom: 6 },
  fieldLabel: { fontSize: 12, fontWeight: '600' as const, color: Colors.light.text, marginBottom: 6 },
  fieldRequired: { fontSize: 12, color: Colors.light.error, fontWeight: '700' as const },
  fieldInput: { borderWidth: 1, borderColor: Colors.light.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, color: Colors.light.text },
  fieldInputError: { borderColor: Colors.light.error },

  roleChips: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 8, marginTop: 4 },
  roleChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: Colors.light.border, backgroundColor: Colors.light.background },
  roleChipActive: { backgroundColor: '#FFF7ED', borderColor: TINT },
  roleChipText: { fontSize: 12, color: Colors.light.textSecondary },
  roleChipTextActive: { color: TINT, fontWeight: '600' as const },

  inlineError: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, marginTop: 8, backgroundColor: '#FEF2F2', borderRadius: 7, padding: 8 },
  inlineErrorText: { fontSize: 12, color: Colors.light.error, flex: 1 },

  contactHubActions: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4 },
  adminToggleBtn: { padding: 4, borderRadius: 4 },
  revokeBtn: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5, borderWidth: 1, borderColor: '#FECACA' },
  revokeBtnText: { fontSize: 10, fontWeight: '600' as const, color: '#DC2626' },
  grantAccessBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: TINT },
  grantAccessBtnText: { fontSize: 11, fontWeight: '600' as const, color: '#fff' },
});
