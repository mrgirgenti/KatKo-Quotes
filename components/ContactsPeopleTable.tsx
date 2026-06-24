import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Plus, Edit3, Trash2, Users, MoreHorizontal } from 'lucide-react-native';
import Colors from '@/constants/colors';
import OverlayMenu from '@/components/OverlayMenu';
import { formatPhone } from '@/utils/phone';
import type { Contact, HubAccessState } from '@/types/crm';

function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

type PillCfg = { label: string; bg: string; fg: string; border: string };

function statusPill(state: HubAccessState | undefined): PillCfg {
  switch (state) {
    case 'enabled':
      return { label: 'Active',    bg: '#DCFCE7', fg: '#166534', border: '#86EFAC' };
    case 'invited':
      return { label: 'Invited',   bg: '#FEF3C7', fg: '#92400E', border: '#FCD34D' };
    case 'disabled':
      return { label: 'Disabled',  bg: '#FEE2E2', fg: '#991B1B', border: '#FCA5A5' };
    default:
      return { label: 'No Access', bg: '#F1F5F9', fg: '#64748B', border: '#E2E8F0' };
  }
}

const TABLE_MIN_W = 900;

const CW = {
  name:         180,
  role:         170,
  email:        158,
  phone:        120,
  status:        96,
  primary:       80,
  admin:         80,
  lastActivity:  96,
  actions:       54,
} as const;

type Props = {
  contacts: Contact[];
  onAdd: () => void;
  onEdit: (c: Contact) => void;
  onDelete: (c: Contact) => void;
  onAction: (c: Contact, action: string) => void;
  busyKey?: string | null;
};

export default function ContactsPeopleTable({
  contacts,
  onAdd,
  onEdit,
  onDelete,
  onAction,
  busyKey,
}: Props) {
  const hasContacts = contacts.length > 0;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Users size={15} color="#fff" />
          <Text style={styles.headerTitle}>Contacts</Text>
          {hasContacts && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{contacts.length}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={onAdd}>
          <Plus size={13} color="#fff" />
          <Text style={styles.addBtnText}>Add Contact</Text>
        </TouchableOpacity>
      </View>

      {!hasContacts ? (
        <View style={styles.empty}>
          <Users size={26} color={Colors.light.border} />
          <Text style={styles.emptyTitle}>No contacts yet.</Text>
          <Text style={styles.emptySub}>
            Add a contact to manage people and hub access from one place.
          </Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator
          style={{ outlineStyle: 'none' } as any}
        >
          <View style={{ minWidth: TABLE_MIN_W }}>
            <View style={styles.theadRow}>
              <View style={[styles.th, { width: CW.name }]}>
                <Text style={styles.thText}>NAME</Text>
              </View>
              <View style={[styles.th, { width: CW.role }]}>
                <Text style={styles.thText}>ROLE / TITLE</Text>
              </View>
              <View style={[styles.th, { width: CW.email }]}>
                <Text style={styles.thText}>EMAIL</Text>
              </View>
              <View style={[styles.th, { width: CW.phone }]}>
                <Text style={styles.thText}>PHONE</Text>
              </View>
              <View style={[styles.th, { width: CW.status }]}>
                <Text style={styles.thText}>STATUS</Text>
              </View>
              <View style={[styles.th, { width: CW.primary }]}>
                <Text style={styles.thText}>PRIMARY</Text>
              </View>
              <View style={[styles.th, { width: CW.admin }]}>
                <Text style={styles.thText}>ORG ADMIN</Text>
              </View>
              <View style={[styles.th, { width: CW.lastActivity }]}>
                <Text style={styles.thText}>LAST ACTIVITY</Text>
              </View>
              <View style={{ width: CW.actions }} />
            </View>

            {contacts.map((c, idx) => {
              const pill = statusPill(c.hubAccess);
              const hasMembership = !!c.membershipId;
              const busy = !!busyKey && busyKey.startsWith(`${c.id}:`);
              const isLast = idx === contacts.length - 1;
              return (
                <View key={c.id} style={[styles.row, !isLast && styles.rowBorder]}>
                  <View style={[styles.td, { width: CW.name }]}>
                    <Text style={styles.nameText} numberOfLines={1}>
                      {c.firstName} {c.lastName}
                    </Text>
                  </View>
                  <View style={[styles.td, { width: CW.role }]}>
                    <Text style={styles.cellText} numberOfLines={1}>
                      {c.role || '—'}
                    </Text>
                  </View>
                  <View style={[styles.td, { width: CW.email }]}>
                    <Text style={styles.cellText} numberOfLines={1}>
                      {c.email || '—'}
                    </Text>
                  </View>
                  <View style={[styles.td, { width: CW.phone }]}>
                    <Text style={styles.cellText} numberOfLines={1}>
                      {c.phone ? formatPhone(c.phone) : '—'}
                    </Text>
                  </View>
                  <View style={[styles.td, { width: CW.status }]}>
                    <View style={[styles.pill, { backgroundColor: pill.bg, borderColor: pill.border }]}>
                      <Text style={[styles.pillText, { color: pill.fg }]}>{pill.label}</Text>
                    </View>
                  </View>
                  <View style={[styles.td, { width: CW.primary }]}>
                    {c.isPrimary ? (
                      <View style={styles.primaryPill}>
                        <Text style={styles.primaryPillText}>Primary</Text>
                      </View>
                    ) : (
                      <Text style={styles.dimText}>—</Text>
                    )}
                  </View>
                  <View style={[styles.td, { width: CW.admin }]}>
                    {c.isOrgAdmin ? (
                      <View style={styles.adminPill}>
                        <Text style={styles.adminPillText}>Admin</Text>
                      </View>
                    ) : (
                      <Text style={styles.dimText}>—</Text>
                    )}
                  </View>
                  <View style={[styles.td, { width: CW.lastActivity }]}>
                    <Text style={styles.cellText} numberOfLines={1}>
                      {fmtDate(c.lastActivityAt)}
                    </Text>
                  </View>
                  <View style={[styles.td, { width: CW.actions, alignItems: 'center' as const }]}>
                    {busy ? (
                      <ActivityIndicator size="small" color={Colors.light.tint} />
                    ) : (
                      <OverlayMenu
                        menuWidth={230}
                        align="right"
                        trigger={({ open }) => (
                          <TouchableOpacity style={styles.actionBtn} onPress={open}>
                            <MoreHorizontal size={15} color={Colors.light.textSecondary} />
                          </TouchableOpacity>
                        )}
                      >
                        {({ close }) => (
                          <>
                            <TouchableOpacity
                              style={styles.menuItem}
                              onPress={() => { close(); onEdit(c); }}
                            >
                              <Edit3 size={14} color={Colors.light.text} />
                              <Text style={styles.menuItemText}>Edit Contact</Text>
                            </TouchableOpacity>

                            {(c.hubAccess === 'none' || c.hubAccess === 'disabled' || !c.hubAccess) && !!c.email && (
                              <TouchableOpacity
                                style={styles.menuItem}
                                onPress={() => { close(); onAction(c, 'enableHubAccess'); }}
                              >
                                <Text style={styles.menuItemText}>
                                  {c.hubAccess === 'disabled' ? 'Re-enable Hub Access' : 'Enable Hub Access'}
                                </Text>
                              </TouchableOpacity>
                            )}
                            {c.hubAccess === 'invited' && (
                              <TouchableOpacity
                                style={styles.menuItem}
                                onPress={() => { close(); onAction(c, 'resendInvite'); }}
                              >
                                <Text style={styles.menuItemText}>Resend Invite</Text>
                              </TouchableOpacity>
                            )}
                            {c.hubAccess === 'enabled' && (
                              <TouchableOpacity
                                style={styles.menuItem}
                                onPress={() => { close(); onAction(c, 'resetPassword'); }}
                              >
                                <Text style={styles.menuItemText}>Reset Password</Text>
                              </TouchableOpacity>
                            )}
                            {(c.hubAccess === 'enabled' || c.hubAccess === 'invited') && (
                              <TouchableOpacity
                                style={styles.menuItem}
                                onPress={() => { close(); onAction(c, 'disableHubAccess'); }}
                              >
                                <Text style={styles.menuItemText}>Disable Hub Access</Text>
                              </TouchableOpacity>
                            )}
                            {hasMembership && !c.isOrgAdmin && (
                              <TouchableOpacity
                                style={styles.menuItem}
                                onPress={() => { close(); onAction(c, 'promoteAdmin'); }}
                              >
                                <Text style={styles.menuItemText}>Promote to Org Admin</Text>
                              </TouchableOpacity>
                            )}
                            {hasMembership && c.isOrgAdmin && (
                              <TouchableOpacity
                                style={styles.menuItem}
                                onPress={() => { close(); onAction(c, 'removeAdmin'); }}
                              >
                                <Text style={styles.menuItemText}>Remove Org Admin</Text>
                              </TouchableOpacity>
                            )}
                            <TouchableOpacity
                              style={[styles.menuItem, styles.menuItemDanger]}
                              onPress={() => { close(); onDelete(c); }}
                            >
                              <Trash2 size={14} color={Colors.light.error} />
                              <Text style={[styles.menuItemText, { color: Colors.light.error }]}>
                                Delete Contact
                              </Text>
                            </TouchableOpacity>
                          </>
                        )}
                      </OverlayMenu>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.light.headerBg,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  headerTitle: { color: '#fff', fontSize: 14, fontWeight: '700' },
  headerBadge: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 9,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  headerBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.light.tint,
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  addBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    gap: 6,
  },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: Colors.light.text },
  emptySub: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 24,
  },

  theadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.headerBg,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  th: { paddingRight: 10 },
  thText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.65)',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: Colors.light.surface,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  td: { paddingRight: 10, justifyContent: 'center' },

  nameText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.light.text,
  },
  cellText: { fontSize: 12, color: Colors.light.text },
  dimText: { fontSize: 12, color: Colors.light.textSecondary },

  pill: {
    alignSelf: 'flex-start',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  pillText: { fontSize: 11, fontWeight: '700' },

  primaryPill: {
    alignSelf: 'flex-start',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FCD34D',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  primaryPillText: { fontSize: 11, fontWeight: '700', color: '#92400E' },

  adminPill: {
    alignSelf: 'flex-start',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FDBA74',
    backgroundColor: '#FFE4D3',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  adminPillText: { fontSize: 11, fontWeight: '700', color: '#C2410C' },

  actionBtn: { padding: 6, borderRadius: 6 },

  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 11,
    paddingHorizontal: 13,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  menuItemDanger: { borderBottomWidth: 0 },
  menuItemText: { fontSize: 13, color: Colors.light.text, fontWeight: '500' },
});
