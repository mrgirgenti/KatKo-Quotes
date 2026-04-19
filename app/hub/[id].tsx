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
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useCrm } from '@/contexts/CrmContext';
import { OrgMembership, MembershipRole } from '@/types/crm';

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

  const orgAdmins = memberships.filter((m) => m.role === 'ORG_ADMIN');
  const clientMembers = memberships.filter((m) => m.userType === 'CLIENT');
  const internalMembers = memberships.filter((m) => m.userType !== 'CLIENT');

  // --- Modals ---
  const [assignAdminModal, setAssignAdminModal] = useState(false);
  const [selectedAdminUserId, setSelectedAdminUserId] = useState('');
  const [assigningAdmin, setAssigningAdmin] = useState(false);

  const [inviteClientModal, setInviteClientModal] = useState(false);
  const [clientForm, setClientForm] = useState({ name: '', email: '', role: 'MEMBER' as MembershipRole });
  const [invitingSaving, setInvitingSaving] = useState(false);

  const [changeRoleModal, setChangeRoleModal] = useState<{ visible: boolean; membership: OrgMembership | null }>({
    visible: false,
    membership: null,
  });
  const [newRole, setNewRole] = useState<MembershipRole>('MEMBER');
  const [changingRole, setChangingRole] = useState(false);

  const [linkCopied, setLinkCopied] = useState(false);
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

  const handleHubToggle = useCallback((val: boolean) => {
    if (!org) return;
    updateOrgHubEnabled({ orgId: org.id, enabled: val });
  }, [org, updateOrgHubEnabled]);

  const handleAssignAdmin = useCallback(async () => {
    if (!org || !selectedAdminUserId) return;
    setAssigningAdmin(true);
    try {
      const res = await fetch('/api/memberships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: org.id,
          userId: selectedAdminUserId,
          role: 'ORG_ADMIN',
        }),
      });
      if (!res.ok) throw new Error('Failed to assign admin');
      await refetchMemberships();
      queryClient.invalidateQueries({ queryKey: ['client-hubs'] });
      setAssignAdminModal(false);
      setSelectedAdminUserId('');
    } catch (err) {
      Alert.alert('Error', 'Failed to assign org admin. Try again.');
    } finally {
      setAssigningAdmin(false);
    }
  }, [org, selectedAdminUserId, refetchMemberships, queryClient]);

  const handleInviteClient = useCallback(async () => {
    if (!org || !clientForm.name.trim() || !clientForm.email.trim()) return;
    setInvitingSaving(true);
    try {
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
      await refetchMemberships();
      queryClient.invalidateQueries({ queryKey: ['client-hubs'] });
      setInviteClientModal(false);
      setClientForm({ name: '', email: '', role: 'MEMBER' });
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to invite client user.');
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

  const isReady = org.hubEnabled && orgAdmins.length > 0;

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
          <View style={styles.statusCardTop}>
            <View style={styles.statusOrgInfo}>
              <View style={styles.orgAvatar}>
                <Text style={styles.orgAvatarText}>{org.name[0]?.toUpperCase()}</Text>
              </View>
              <View>
                <Text style={styles.orgName}>{org.name}</Text>
                <View style={[styles.readyPill, isReady ? styles.readyPillGreen : styles.readyPillAmber]}>
                  {isReady
                    ? <CheckCircle2 size={11} color="#16A34A" />
                    : <AlertCircle size={11} color="#D97706" />}
                  <Text style={[styles.readyPillText, isReady ? styles.readyPillTextGreen : styles.readyPillTextAmber]}>
                    {isReady ? 'Portal Ready' : 'Needs Setup'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleLabel}>Client Hub Enabled</Text>
              <Text style={styles.toggleSub}>
                {org.hubEnabled ? 'Clients can access this organization\'s portal' : 'Enable to grant client portal access'}
              </Text>
            </View>
            <Switch
              value={org.hubEnabled ?? false}
              onValueChange={handleHubToggle}
              trackColor={{ false: Colors.light.border, true: Colors.light.tint }}
              thumbColor="#fff"
            />
          </View>

          {org.hubEnabled && (
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Users size={13} color={Colors.light.textSecondary} />
                <Text style={styles.statText}>{clientMembers.length} client{clientMembers.length !== 1 ? 's' : ''}</Text>
              </View>
              <View style={styles.statDot} />
              <View style={styles.statItem}>
                <ShieldCheck size={13} color={Colors.light.textSecondary} />
                <Text style={styles.statText}>{orgAdmins.length > 0 ? orgAdmins[0].userName : 'No admin'}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Portal Link Section */}
        {org.hubEnabled && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <ExternalLink size={15} color={Colors.light.tint} />
              <Text style={styles.sectionTitle}>Client Portal Link</Text>
            </View>
            <Text style={styles.portalLinkDesc}>
              Share this link with client users so they can submit project requests directly into Ko OS.
            </Text>
            <View style={styles.portalLinkRow}>
              <Text style={styles.portalLinkUrl} numberOfLines={1} ellipsizeMode="middle">
                {portalUrl}
              </Text>
              <TouchableOpacity
                style={[styles.copyBtn, linkCopied && styles.copyBtnDone]}
                onPress={handleCopyLink}
              >
                <Copy size={13} color={linkCopied ? '#16A34A' : Colors.light.tint} />
                <Text style={[styles.copyBtnText, linkCopied && styles.copyBtnTextDone]}>
                  {linkCopied ? 'Copied!' : 'Copy'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Org Admin Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ShieldCheck size={15} color={Colors.light.tint} />
            <Text style={styles.sectionTitle}>Org Admin</Text>
            <TouchableOpacity
              style={styles.sectionActionBtn}
              onPress={() => {
                setSelectedAdminUserId('');
                setAssignAdminModal(true);
              }}
            >
              <Text style={styles.sectionActionBtnText}>
                {orgAdmins.length > 0 ? 'Change' : 'Assign'}
              </Text>
            </TouchableOpacity>
          </View>

          {membershipsLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={Colors.light.tint} />
            </View>
          ) : orgAdmins.length === 0 ? (
            <View style={styles.emptySection}>
              <Text style={styles.emptySectionText}>No org admin assigned yet.</Text>
              <Text style={styles.emptySectionSub}>
                Assign an internal team member as the org admin to mark this hub as portal-ready.
              </Text>
            </View>
          ) : (
            orgAdmins.map((m) => (
              <View key={m.id} style={styles.memberRow}>
                <View style={[styles.memberAvatar, { backgroundColor: m.userAvatarColor || Colors.light.tint }]}>
                  <Text style={styles.memberAvatarText}>{(m.userName || '?')[0].toUpperCase()}</Text>
                </View>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{m.userName || 'Unknown'}</Text>
                  {m.userEmail ? <Text style={styles.memberEmail}>{m.userEmail}</Text> : null}
                </View>
                <RoleBadge role="ORG_ADMIN" />
                <TouchableOpacity style={styles.rowActionBtn} onPress={() => handleRemoveMember(m)}>
                  <X size={14} color={Colors.light.textSecondary} />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* Client Users Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Users size={15} color="#6366F1" />
            <Text style={styles.sectionTitle}>
              Client Users{clientMembers.length > 0 ? ` (${clientMembers.length})` : ''}
            </Text>
            <TouchableOpacity
              style={styles.sectionActionBtnPrimary}
              onPress={() => {
                setClientForm({ name: '', email: '', role: 'MEMBER' });
                setInviteClientModal(true);
              }}
            >
              <Plus size={12} color="#fff" />
              <Text style={styles.sectionActionBtnPrimaryText}>Invite</Text>
            </TouchableOpacity>
          </View>

          {membershipsLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={Colors.light.tint} />
            </View>
          ) : clientMembers.length === 0 ? (
            <View style={styles.emptySection}>
              <Text style={styles.emptySectionText}>No client users yet.</Text>
              <Text style={styles.emptySectionSub}>
                Invite clients to give them access to this org's hub portal.
              </Text>
            </View>
          ) : (
            clientMembers.map((m) => (
              <View key={m.id} style={styles.memberRow}>
                <View style={[styles.memberAvatar, { backgroundColor: '#6366F1' }]}>
                  <Text style={styles.memberAvatarText}>{(m.userName || '?')[0].toUpperCase()}</Text>
                </View>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{m.userName || 'Unknown'}</Text>
                  {m.userEmail ? <Text style={styles.memberEmail}>{m.userEmail}</Text> : null}
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setNewRole(m.role);
                    setChangeRoleModal({ visible: true, membership: m });
                  }}
                >
                  <RoleBadge role={m.role} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.rowActionBtn} onPress={() => handleRemoveMember(m)}>
                  <Trash2 size={13} color={Colors.light.error} />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* Internal Team Section */}
        <View style={[styles.section, styles.sectionLast]}>
          <View style={styles.sectionHeader}>
            <User size={15} color={Colors.light.textSecondary} />
            <Text style={styles.sectionTitle}>
              Internal Team{internalMembers.length > 0 ? ` (${internalMembers.length})` : ''}
            </Text>
            <TouchableOpacity
              style={styles.sectionActionBtn}
              onPress={() => {
                setSelectedAdminUserId('');
                setAssignAdminModal(true);
              }}
            >
              <Text style={styles.sectionActionBtnText}>Add</Text>
            </TouchableOpacity>
          </View>

          {membershipsLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={Colors.light.tint} />
            </View>
          ) : internalMembers.length === 0 ? (
            <View style={styles.emptySection}>
              <Text style={styles.emptySectionText}>No internal members assigned.</Text>
            </View>
          ) : (
            internalMembers.map((m) => (
              <View key={m.id} style={styles.memberRow}>
                <View style={[styles.memberAvatar, { backgroundColor: m.userAvatarColor || Colors.light.tint }]}>
                  <Text style={styles.memberAvatarText}>{(m.userName || '?')[0].toUpperCase()}</Text>
                </View>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{m.userName || 'Unknown'}</Text>
                  {m.userEmail ? <Text style={styles.memberEmail}>{m.userEmail}</Text> : null}
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setNewRole(m.role);
                    setChangeRoleModal({ visible: true, membership: m });
                  }}
                >
                  <RoleBadge role={m.role} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.rowActionBtn} onPress={() => handleRemoveMember(m)}>
                  <X size={14} color={Colors.light.textSecondary} />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Assign Admin Modal */}
      <Modal visible={assignAdminModal} transparent animationType="fade" onRequestClose={() => setAssignAdminModal(false)}>
        <Pressable style={styles.overlay} onPress={() => setAssignAdminModal(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Assign Org Admin</Text>
              <TouchableOpacity onPress={() => setAssignAdminModal(false)}>
                <X size={20} color={Colors.light.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSub}>Select an internal team member to set as org admin for {org.name}.</Text>
            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              {internalUsers.length === 0 ? (
                <Text style={styles.modalEmpty}>No internal users found.</Text>
              ) : (
                internalUsers.map((u) => (
                  <TouchableOpacity
                    key={u.id}
                    style={[styles.userPickerRow, selectedAdminUserId === u.id && styles.userPickerRowSelected]}
                    onPress={() => setSelectedAdminUserId(u.id)}
                  >
                    <View style={[styles.memberAvatar, { backgroundColor: u.avatarColor || Colors.light.tint, width: 32, height: 32, borderRadius: 16 }]}>
                      <Text style={[styles.memberAvatarText, { fontSize: 12 }]}>{(u.name || '?')[0].toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.userPickerName}>{u.name}</Text>
                      {u.email ? <Text style={styles.userPickerEmail}>{u.email}</Text> : null}
                    </View>
                    <View style={[styles.radioCircle, selectedAdminUserId === u.id && styles.radioCircleSelected]}>
                      {selectedAdminUserId === u.id && <View style={styles.radioFill} />}
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
                style={[styles.saveBtn, (!selectedAdminUserId || assigningAdmin) && styles.saveBtnDisabled]}
                onPress={handleAssignAdmin}
                disabled={!selectedAdminUserId || assigningAdmin}
              >
                {assigningAdmin ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>Assign as Admin</Text>
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
              <Text style={styles.fieldLabel}>Full Name</Text>
              <TextInput
                style={styles.fieldInput}
                value={clientForm.name}
                onChangeText={(v) => setClientForm((f) => ({ ...f, name: v }))}
                placeholder="e.g. Jane Smith"
                placeholderTextColor={Colors.light.textSecondary}
                autoFocus
              />
              <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Email Address</Text>
              <TextInput
                style={styles.fieldInput}
                value={clientForm.email}
                onChangeText={(v) => setClientForm((f) => ({ ...f, email: v }))}
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
    padding: 16,
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

  // Status Card
  statusCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    overflow: 'hidden',
  },
  statusCardTop: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  statusOrgInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  orgAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.light.tint,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orgAvatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  orgName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 4,
  },
  readyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  readyPillGreen: { backgroundColor: '#F0FDF4' },
  readyPillAmber: { backgroundColor: '#FFFBEB' },
  readyPillText: { fontSize: 11, fontWeight: '600' },
  readyPillTextGreen: { color: '#16A34A' },
  readyPillTextAmber: { color: '#D97706' },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
  },
  toggleSub: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 1,
  },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 12,
    gap: 8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
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
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    overflow: 'hidden',
  },
  sectionLast: {},
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    gap: 7,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.light.text,
    flex: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  sectionActionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.light.tint,
  },
  sectionActionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.tint,
  },
  sectionActionBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: Colors.light.tint,
  },
  sectionActionBtnPrimaryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },

  loadingRow: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptySection: {
    padding: 16,
    gap: 4,
  },
  emptySectionText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.light.textSecondary,
  },
  emptySectionSub: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    lineHeight: 17,
  },

  // Member rows
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberAvatarText: {
    fontSize: 14,
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
    padding: 6,
  },

  // Role badge
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  roleBadgeText: {
    fontSize: 11,
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
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginBottom: 10,
    lineHeight: 17,
  },
  portalLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 10,
    gap: 8,
  },
  portalLinkUrl: {
    flex: 1,
    fontSize: 12,
    color: Colors.light.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#FFF7F0',
    borderWidth: 1,
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
});
