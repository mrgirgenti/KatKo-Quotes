import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Modal,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Globe,
  ShieldCheck,
  Users,
  X,
  Plus,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  Trash2,
  Edit3,
  User,
  Copy,
  ExternalLink,
  Mail,
  Clock,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useCrm } from '@/contexts/CrmContext';
import { OrgMembership, MembershipRole } from '@/types/crm';
import { OrgAvatar } from '@/components/OrgAvatar';

const ROLE_LABELS: Record<MembershipRole, string> = {
  ORG_ADMIN: 'Org Admin',
  MEMBER: 'Member',
  BILLING_CONTACT: 'Billing Contact',
  APPROVER: 'Approver',
};

const ROLE_COLORS: Record<MembershipRole, { bg: string; text: string }> = {
  ORG_ADMIN: { bg: '#FFF7ED', text: '#C2410C' },
  MEMBER: { bg: '#F0FDF4', text: '#16A34A' },
  BILLING_CONTACT: { bg: '#EFF6FF', text: '#2563EB' },
  APPROVER: { bg: '#FDF4FF', text: '#9333EA' },
};

const CLIENT_ROLES: MembershipRole[] = ['MEMBER', 'ORG_ADMIN', 'BILLING_CONTACT', 'APPROVER'];

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

export default function HubManagementScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { orgs, isLoading: crmLoading, updateOrgHubEnabled } = useCrm();

  const org = orgs.find((o) => o.id === id);

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

  const { data: internalUsers = [] } = useQuery<
    { id: string; name: string; avatarColor: string; email: string }[]
  >({
    queryKey: ['internal-users'],
    queryFn: async () => {
      const res = await fetch('/api/users?type=internal');
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Helper: exclude placeholder users with no real email and a default/empty name
  const isRealClientUser = (m: OrgMembership) =>
    !!(m.userEmail) || !!(m.userName && m.userName.trim() !== '' && m.userName.trim() !== 'User');

  // CLIENT users with ORG_ADMIN role = the org's primary admin contacts
  const clientOrgAdmins = memberships.filter((m) => m.userType === 'CLIENT' && m.role === 'ORG_ADMIN' && isRealClientUser(m));
  // CLIENT users with non-admin roles
  const regularClients = memberships.filter((m) => m.userType === 'CLIENT' && m.role !== 'ORG_ADMIN' && isRealClientUser(m));
  // All client users (for counts / portal-ready check)
  const allClientMembers = memberships.filter((m) => m.userType === 'CLIENT' && isRealClientUser(m));
  // INTERNAL users assigned as account reps for this org
  const accountReps = memberships.filter((m) => m.userType === 'INTERNAL');

  // --- Modals ---
  // Org Admin: promotes an existing CLIENT member to ORG_ADMIN role
  const [assignAdminModal, setAssignAdminModal] = useState(false);
  const [selectedAdminMembershipId, setSelectedAdminMembershipId] = useState('');
  const [assigningAdmin, setAssigningAdmin] = useState(false);

  // Account Rep: assigns an INTERNAL user as account owner for this org
  const [assignRepModal, setAssignRepModal] = useState(false);
  const [selectedRepUserId, setSelectedRepUserId] = useState('');
  const [assigningRep, setAssigningRep] = useState(false);

  // Internal users for rep assignment: exclude purely placeholder records (empty name only)
  // Show all users from User Management including those named 'User' - they may be real people
  const realInternalUsers = internalUsers.filter((u) => !!u.name?.trim());

  // Identify the default rep (first org_admin internal user) for pre-selection hint
  const defaultRepUser = realInternalUsers.find((u) => u.role === 'org_admin') || realInternalUsers[0];

  const [inviteClientModal, setInviteClientModal] = useState(false);
  const [clientForm, setClientForm] = useState({ name: '', email: '', role: 'MEMBER' as MembershipRole });
  const [invitingSaving, setInvitingSaving] = useState(false);
  const [inviteError, setInviteError] = useState('');

  const [changeRoleModal, setChangeRoleModal] = useState<{ visible: boolean; membership: OrgMembership | null }>({
    visible: false,
    membership: null,
  });
  const [newRole, setNewRole] = useState<MembershipRole>('MEMBER');
  const [changingRole, setChangingRole] = useState(false);

  const [linkCopied, setLinkCopied] = useState(false);
  const [resendCopied, setResendCopied] = useState<string | null>(null);
  const portalUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/portal/${id}`
    : `/portal/${id}`;

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

  const handleHubToggle = useCallback((val: boolean) => {
    if (!org) return;
    updateOrgHubEnabled({ orgId: org.id, enabled: val });
  }, [org, updateOrgHubEnabled]);


  // Promotes an existing CLIENT member to ORG_ADMIN by patching their membership role
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
    } catch (err) {
      Alert.alert('Error', 'Failed to assign org admin. Try again.');
    } finally {
      setAssigningAdmin(false);
    }
  }, [org, selectedAdminMembershipId, refetchMemberships, queryClient]);

  // Assigns an INTERNAL user as the account rep for this org
  const handleAssignRep = useCallback(async () => {
    if (!org || !selectedRepUserId) return;
    setAssigningRep(true);
    try {
      const res = await fetch('/api/memberships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: org.id,
          userId: selectedRepUserId,
          role: 'MEMBER',
        }),
      });
      if (!res.ok) throw new Error('Failed to assign rep');
      await refetchMemberships();
      queryClient.invalidateQueries({ queryKey: ['client-hubs'] });
      setAssignRepModal(false);
      setSelectedRepUserId('');
    } catch (err) {
      Alert.alert('Error', 'Failed to assign account rep. Try again.');
    } finally {
      setAssigningRep(false);
    }
  }, [org, selectedRepUserId, refetchMemberships, queryClient]);

  const handleInviteClient = useCallback(async () => {
    if (!org || !clientForm.name.trim() || !clientForm.email.trim()) return;
    setInvitingSaving(true);
    try {
      // 1. Create or find the client User record
      const userId = `client_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const userRes = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: userId,
          name: clientForm.name.trim(),
          email: clientForm.email.trim(),
          userType: 'CLIENT',
        }),
      });
      if (!userRes.ok && userRes.status !== 204) {
        const err = await userRes.json().catch(() => ({}));
        throw new Error((err as any)?.error || 'Failed to create user');
      }
      const newUser = userRes.status === 204 ? { id: userId } : await userRes.json();

      // 2. Create OrganizationMembership
      const memRes = await fetch('/api/memberships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: org.id,
          userId: newUser.id,
          role: clientForm.role,
        }),
      });
      if (!memRes.ok) throw new Error('Failed to add membership');

      // 3. Create or link a Contact record for this person
      const [firstName, ...restParts] = clientForm.name.trim().split(' ');
      await fetch(`/api/orgs/${org.id}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName || '',
          lastName: restParts.join(' ') || '',
          email: clientForm.email.trim(),
          linkedUserId: newUser.id,
          isPrimary: clientForm.role === 'ORG_ADMIN',
        }),
      });

      // 4. Send invite email via Resend (non-blocking — don't fail invite if email fails)
      const portalUrl =
        typeof window !== 'undefined'
          ? `${window.location.origin}/portal/${org.id}`
          : '';
      fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'client_invite',
          clientEmail: clientForm.email.trim(),
          clientName: clientForm.name.trim(),
          orgName: org.name,
          portalUrl,
        }),
      }).catch((e) => console.warn('[invite email]', e));

      await refetchMemberships();
      queryClient.invalidateQueries({ queryKey: ['client-hubs'] });
      queryClient.invalidateQueries({ queryKey: ['crm_orgs'] });
      setInviteClientModal(false);
      setClientForm({ name: '', email: '', role: 'MEMBER' });
    } catch (err: any) {
      setInviteError(err?.message || 'Failed to invite client user. Please try again.');
    } finally {
      setInvitingSaving(false);
    }
  }, [org, clientForm, refetchMemberships, queryClient]);

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
    } catch (err) {
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
          <ActivityIndicator color={Colors.light.tint} size="large" />
          <Text style={styles.notFoundText}>Loading…</Text>
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

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: org.name,
          headerStyle: { backgroundColor: Colors.light.headerBg },
          headerTintColor: '#fff',
        }}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        {/* Hub Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusCardRow}>
            {/* Org identity */}
            <View style={styles.orgAvatar}>
              <Text style={styles.orgAvatarText}>{org.name[0]?.toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1, gap: 5 }}>
              <View style={styles.orgNameRow}>
                <Text style={styles.orgName} numberOfLines={1}>{org.name}</Text>
                <View style={[styles.readyPill, isReady ? styles.readyPillGreen : styles.readyPillAmber]}>
                  {isReady
                    ? <CheckCircle2 size={9} color="#16A34A" />
                    : <AlertCircle size={9} color="#D97706" />}
                  <Text style={[styles.readyPillText, isReady ? styles.readyPillTextGreen : styles.readyPillTextAmber]}>
                    {isReady ? 'Portal Ready' : 'Needs Setup'}
                  </Text>
                </View>
              </View>
              <View style={styles.statsRow}>
                <Users size={11} color={Colors.light.textSecondary} />
                <Text style={styles.statText}>{allClientMembers.length} member{allClientMembers.length !== 1 ? 's' : ''}</Text>
                <View style={styles.statDot} />
                <ShieldCheck size={11} color={Colors.light.textSecondary} />
                <Text style={styles.statText}>{clientOrgAdmins.length > 0 ? clientOrgAdmins[0].userName : 'No org admin'}</Text>
              </View>
            </View>

            {/* Account Rep — shown prominently in header */}
            <View style={styles.headerRepBlock}>
              <View style={styles.headerRepLabelRow}>
                <Text style={styles.headerRepLabel}>Account Rep</Text>
                <TouchableOpacity
                  onPress={() => { setSelectedRepUserId(accountReps[0]?.userId || ''); setAssignRepModal(true); }}
                >
                  <Text style={styles.headerRepChange}>
                    {accountReps.length > 0 ? 'Change' : 'Assign'}
                  </Text>
                </TouchableOpacity>
              </View>
              {accountReps.length > 0 ? (
                <View style={styles.headerRepRow}>
                  <View style={[styles.headerRepAvatar, { backgroundColor: accountReps[0].userAvatarColor || Colors.light.tint }]}>
                    <Text style={styles.headerRepAvatarText}>{(accountReps[0].userName || '?')[0].toUpperCase()}</Text>
                  </View>
                  <Text style={styles.headerRepName} numberOfLines={1}>{accountReps[0].userName}</Text>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => { setSelectedRepUserId(defaultRepUser?.id || ''); setAssignRepModal(true); }}
                >
                  <Text style={styles.headerRepUnassigned}>Unassigned — tap to assign</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Hub toggle */}
            <View style={styles.hubToggle}>
              <Text style={styles.toggleLabel}>Hub</Text>
              <Switch
                value={org.hubEnabled ?? false}
                onValueChange={handleHubToggle}
                trackColor={{ false: Colors.light.border, true: Colors.light.tint }}
                thumbColor="#fff"
              />
            </View>
          </View>
        </View>

        {/* Two-column body */}
        <View style={styles.columns}>

          {/* LEFT — Org Admin + Team Members */}
          <View style={styles.colLeft}>

            {/* Org Admin */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <ShieldCheck size={13} color={Colors.light.tint} />
                <Text style={styles.sectionTitle}>Org Admin</Text>
                {regularClients.length > 0 && (
                  <TouchableOpacity
                    style={styles.sectionActionBtn}
                    onPress={() => { setSelectedAdminMembershipId(''); setAssignAdminModal(true); }}
                  >
                    <Text style={styles.sectionActionBtnText}>
                      {clientOrgAdmins.length > 0 ? 'Change' : 'Assign'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {membershipsLoading ? (
                <View style={styles.loadingRow}><ActivityIndicator size="small" color={Colors.light.tint} /></View>
              ) : clientOrgAdmins.length === 0 ? (
                <View style={styles.emptySection}>
                  <Text style={styles.emptySectionText}>No org admin assigned.</Text>
                  <Text style={styles.emptySectionSub}>
                    {regularClients.length === 0
                      ? 'Invite a team member first, then promote them.'
                      : 'Select a team member to designate as org admin.'}
                  </Text>
                </View>
              ) : (
                clientOrgAdmins.map((m) => (
                  <View key={m.id} style={styles.memberRow}>
                    <View style={[styles.memberAvatar, { backgroundColor: '#6366F1' }]}>
                      <Text style={styles.memberAvatarText}>{(m.userName || '?')[0].toUpperCase()}</Text>
                    </View>
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>{m.userName || 'Unknown'}</Text>
                      {m.userEmail ? <Text style={styles.memberEmail}>{m.userEmail}</Text> : null}
                    </View>
                    <RoleBadge role="ORG_ADMIN" />
                    <TouchableOpacity style={styles.rowActionBtn} onPress={() => handleRemoveMember(m)}>
                      <X size={13} color={Colors.light.textSecondary} />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>

            {/* Team Members */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Users size={13} color="#6366F1" />
                <Text style={styles.sectionTitle}>
                  Team Members{regularClients.length > 0 ? ` (${regularClients.length})` : ''}
                </Text>
                <TouchableOpacity
                  style={styles.sectionActionBtnPrimary}
                  onPress={() => {
                    setClientForm({ name: '', email: '', role: 'MEMBER' });
                    setInviteError('');
                    setInviteClientModal(true);
                  }}
                >
                  <Plus size={11} color="#fff" />
                  <Text style={styles.sectionActionBtnPrimaryText}>Invite</Text>
                </TouchableOpacity>
              </View>

              {membershipsLoading ? (
                <View style={styles.loadingRow}><ActivityIndicator size="small" color={Colors.light.tint} /></View>
              ) : regularClients.length === 0 ? (
                <View style={styles.emptySection}>
                  <Text style={styles.emptySectionText}>No team members yet.</Text>
                  <Text style={styles.emptySectionSub}>
                    Invite clients to give them portal access.
                  </Text>
                </View>
              ) : (
                regularClients.map((m) => (
                  <View key={m.id} style={styles.memberRow}>
                    <View style={[styles.memberAvatar, { backgroundColor: m.userStatus === 'INVITED' ? '#D1D5DB' : '#6366F1' }]}>
                      <Text style={styles.memberAvatarText}>{(m.userName || '?')[0].toUpperCase()}</Text>
                    </View>
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>{m.userName || 'Unknown'}</Text>
                      {m.userEmail ? <Text style={styles.memberEmail}>{m.userEmail}</Text> : null}
                    </View>
                    {m.userStatus === 'INVITED' ? (
                      <>
                        <InvitedBadge />
                        <TouchableOpacity
                          style={[styles.resendBtn, resendCopied === m.id && styles.resendBtnDone]}
                          onPress={() => handleResendInvite(m.id)}
                        >
                          <Mail size={11} color={resendCopied === m.id ? '#16A34A' : Colors.light.tint} />
                          <Text style={[styles.resendBtnText, resendCopied === m.id && styles.resendBtnTextDone]}>
                            {resendCopied === m.id ? 'Copied!' : 'Resend'}
                          </Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <TouchableOpacity
                        onPress={() => { setNewRole(m.role); setChangeRoleModal({ visible: true, membership: m }); }}
                      >
                        <RoleBadge role={m.role} />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={styles.rowActionBtn} onPress={() => handleRemoveMember(m)}>
                      <Trash2 size={12} color={Colors.light.error} />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>

          </View>{/* end colLeft */}

          {/* RIGHT — Portal Link */}
          <View style={styles.colRight}>

            {/* Portal Link */}
            {org.hubEnabled && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <ExternalLink size={13} color={Colors.light.tint} />
                  <Text style={styles.sectionTitle}>Portal Link</Text>
                </View>
                <View style={{ paddingHorizontal: 12, paddingVertical: 10 }}>
                  <Text style={styles.portalLinkDesc}>
                    Share with clients to let them submit project requests into Ko OS.
                  </Text>
                  <View style={styles.portalLinkRow}>
                    <Text style={styles.portalLinkUrl} numberOfLines={1} ellipsizeMode="middle">
                      {portalUrl}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.copyBtnFull, linkCopied && styles.copyBtnDone]}
                    onPress={handleCopyLink}
                  >
                    <Copy size={12} color={linkCopied ? '#16A34A' : Colors.light.tint} />
                    <Text style={[styles.copyBtnText, linkCopied && styles.copyBtnTextDone]}>
                      {linkCopied ? 'Link Copied!' : 'Copy Portal Link'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Portal Branding */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Edit3 size={13} color={Colors.light.tint} />
                <Text style={styles.sectionTitle}>Portal Branding</Text>
              </View>
              <View style={styles.brandingBody}>
                <OrgAvatar name={org.name} logoUrl={org.logoUrl} size={64} shape="square" />
                <View style={styles.brandingInfo}>
                  <Text style={styles.brandingOrgName} numberOfLines={1}>{org.name}</Text>
                  {org.logoUrl ? (
                    <Text style={styles.brandingLogoSet}>Logo configured</Text>
                  ) : (
                    <Text style={styles.brandingLogoMissing}>No logo — initials shown</Text>
                  )}
                  <Text style={styles.brandingNote}>
                    Manage this logo from the Organization Profile.
                  </Text>
                </View>
              </View>
            </View>

          </View>{/* end colRight */}

        </View>{/* end columns */}

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Assign Org Admin Modal — promotes an existing CLIENT member */}
      <Modal visible={assignAdminModal} transparent animationType="fade" onRequestClose={() => setAssignAdminModal(false)}>
        <Pressable style={styles.overlay} onPress={() => setAssignAdminModal(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Assign Org Admin</Text>
              <TouchableOpacity onPress={() => setAssignAdminModal(false)}>
                <X size={20} color={Colors.light.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSub}>
              Select an existing client member of {org.name} to designate as the primary org admin.
            </Text>
            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              {regularClients.length === 0 ? (
                <Text style={styles.modalEmpty}>No eligible client members. Invite a client user first, then promote them here.</Text>
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
                {assigningAdmin ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>Promote to Org Admin</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Assign Account Rep Modal — assigns an INTERNAL user as account owner */}
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
                realInternalUsers.map((u) => (
                  <TouchableOpacity
                    key={u.id}
                    style={[styles.userPickerRow, selectedRepUserId === u.id && styles.userPickerRowSelected]}
                    onPress={() => setSelectedRepUserId(u.id)}
                  >
                    <View style={[styles.memberAvatar, { backgroundColor: u.avatarColor || Colors.light.tint, width: 32, height: 32, borderRadius: 16 }]}>
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
                {assigningRep ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>Assign as Account Rep</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Invite Client User Modal */}
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
                  {invitingSaving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.saveBtnText}>Send Invite</Text>
                  )}
                </TouchableOpacity>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {/* Change Role Modal */}
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
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setChangeRoleModal({ visible: false, membership: null })}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, changingRole && styles.saveBtnDisabled]}
                onPress={handleChangeRole}
                disabled={changingRole}
              >
                {changingRole ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>Save Role</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  content: {
    padding: 14,
    gap: 12,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  notFoundText: {
    fontSize: 15,
    color: Colors.light.textSecondary,
  },
  backBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  backBtnText: {
    fontSize: 14,
    color: Colors.light.text,
  },

  // Two-column layout
  columns: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  colLeft: {
    flex: 3,
    gap: 12,
  },
  colRight: {
    flex: 2,
    gap: 12,
  },

  // Status Card
  statusCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    overflow: 'hidden',
  },
  statusCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  orgNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flexWrap: 'wrap',
  },
  orgAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.light.tint,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  orgAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  orgName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.light.text,
  },
  readyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  readyPillGreen: { backgroundColor: '#F0FDF4' },
  readyPillAmber: { backgroundColor: '#FFFBEB' },
  readyPillText: { fontSize: 10, fontWeight: '600' },
  readyPillTextGreen: { color: '#16A34A' },
  readyPillTextAmber: { color: '#D97706' },

  // Header Account Rep block
  headerRepBlock: {
    borderLeftWidth: 1,
    borderLeftColor: Colors.light.border,
    paddingLeft: 14,
    gap: 4,
    flexShrink: 0,
    minWidth: 140,
  },
  headerRepLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  headerRepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  headerRepAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerRepAvatarText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  headerRepName: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.light.text,
    flex: 1,
  },
  headerRepUnassigned: {
    fontSize: 11,
    color: Colors.light.tint,
  },

  hubToggle: {
    alignItems: 'center',
    gap: 3,
    flexShrink: 0,
    borderLeftWidth: 1,
    borderLeftColor: Colors.light.border,
    paddingLeft: 14,
  },
  toggleLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  toggleSub: {
    fontSize: 11,
    color: Colors.light.textSecondary,
  },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statText: {
    fontSize: 11,
    color: Colors.light.textSecondary,
  },
  statDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.light.border,
  },

  // Sections
  section: {
    backgroundColor: Colors.light.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    overflow: 'hidden',
  },
  sectionLast: {},
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    gap: 7,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.light.textSecondary,
    flex: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionActionBtn: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.light.tint,
  },
  sectionActionBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.light.tint,
  },
  sectionActionBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: Colors.light.tint,
  },
  sectionActionBtnPrimaryText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },

  loadingRow: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  emptySection: {
    padding: 12,
    gap: 3,
  },
  emptySectionText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.light.textSecondary,
  },
  emptySectionSub: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    lineHeight: 16,
  },

  // Member rows
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 9,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  memberAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  memberAvatarText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  memberInfo: {
    flex: 1,
    gap: 1,
  },
  memberName: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.light.text,
  },
  memberEmail: {
    fontSize: 11,
    color: Colors.light.textSecondary,
  },
  rowActionBtn: {
    padding: 5,
  },

  // Role badge
  roleBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },

  // Modals
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalKAV: {
    width: '100%',
    maxWidth: 440,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 20,
    width: '100%',
    maxWidth: 440,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.text,
  },
  modalSub: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginBottom: 14,
    lineHeight: 18,
  },
  modalEmpty: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    paddingVertical: 20,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  fieldInput: {
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.light.text,
    backgroundColor: Colors.light.background,
  },
  roleChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  roleChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.surface,
  },
  roleChipActive: {
    borderColor: Colors.light.tint,
    backgroundColor: '#FFF7F0',
  },
  roleChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.light.textSecondary,
  },
  roleChipTextActive: {
    color: Colors.light.tint,
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  saveBtn: {
    flex: 2,
    paddingVertical: 11,
    borderRadius: 8,
    backgroundColor: Colors.light.tint,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.45,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },

  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 5,
  },
  fieldRequired: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.light.error,
  },
  fieldInputError: {
    borderColor: Colors.light.error,
    borderWidth: 1.5,
  },
  inlineError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
  },
  inlineErrorText: {
    flex: 1,
    fontSize: 12,
    color: Colors.light.error,
  },

  portalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  portalBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#2563EB',
  },

  // User picker in Assign Admin modal
  userPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    gap: 10,
    borderRadius: 8,
  },
  userPickerRowSelected: {
    backgroundColor: '#FFF7F0',
  },
  userPickerName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
  },
  userPickerEmail: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: Colors.light.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioCircleSelected: {
    borderColor: Colors.light.tint,
  },
  radioFill: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: Colors.light.tint,
  },
  portalLinkDesc: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginBottom: 7,
    lineHeight: 15,
  },
  portalLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.background,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 8,
    gap: 6,
  },
  portalLinkUrl: {
    flex: 1,
    fontSize: 11,
    color: Colors.light.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
    backgroundColor: '#FFF7F0',
    borderWidth: 1,
    borderColor: Colors.light.tint,
  },
  logoInput: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 12,
    color: Colors.light.text,
    backgroundColor: Colors.light.background,
  },
  logoPreview: {
    width: '100%',
    height: 52,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: '#F9FAFB',
  },
  logoInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  logoUploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.light.tint,
    backgroundColor: Colors.light.background,
  },
  logoUploadBtnText: {
    fontSize: 11,
    color: Colors.light.tint,
    fontWeight: '500',
  },
  copyBtnFull: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
    paddingVertical: 8,
    borderRadius: 7,
    backgroundColor: '#FFF7F0',
    borderWidth: 1.5,
    borderColor: Colors.light.tint,
  },
  copyBtnDone: {
    backgroundColor: '#F0FDF4',
    borderColor: '#16A34A',
  },
  copyBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.tint,
  },
  copyBtnTextDone: {
    color: '#16A34A',
  },

  invitedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 3,
  },
  invitedBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#92400E',
  },

  resendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.light.tint,
    backgroundColor: '#FFF7F0',
  },
  resendBtnDone: {
    borderColor: '#16A34A',
    backgroundColor: '#F0FDF4',
  },
  resendBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.light.tint,
  },
  resendBtnTextDone: {
    color: '#16A34A',
  },

  headerRepLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  headerRepChange: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.light.tint,
  },
  brandingBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  brandingInfo: {
    flex: 1,
    gap: 3,
  },
  brandingOrgName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.light.text,
  },
  brandingLogoSet: {
    fontSize: 12,
    color: '#16A34A',
    fontWeight: '500',
  },
  brandingLogoMissing: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  brandingNote: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginTop: 4,
    lineHeight: 15,
  },
});
