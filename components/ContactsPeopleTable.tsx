import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { Plus, Edit3, Trash2, MoreHorizontal, Users } from 'lucide-react-native';
import Colors from '@/constants/colors';
import OverlayMenu from '@/components/OverlayMenu';
import type { Contact, HubAccessState } from '@/types/crm';

/**
 * CRM CONSOLIDATION — the single people-management surface.
 *
 * Renders the org's Contacts as a flat operational table. Every per-row hub /
 * admin action is dispatched through `onAction(contact, action)` which routes to
 * the consolidated contacts API (the only people write path). Hub Access, Org
 * Admin, and Status columns are all derived from the enriched Contact row, so
 * the counts here always match the Client Hub card exactly.
 */

function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function hubPill(state: HubAccessState | undefined): { label: string; bg: string; fg: string } {
  switch (state) {
    case 'enabled':
      return { label: 'Active', bg: '#DCFCE7', fg: '#166534' };
    case 'invited':
      return { label: 'Invited', bg: '#FEF3C7', fg: '#92400E' };
    case 'disabled':
      return { label: 'Disabled', bg: '#FEE2E2', fg: '#991B1B' };
    default:
      return { label: 'No Access', bg: '#F1F5F9', fg: '#64748B' };
  }
}

const COLS = {
  name: 220,
  role: 150,
  hub: 120,
  admin: 110,
  activity: 130,
  actions: 64,
};
const TABLE_WIDTH = COLS.name + COLS.role + COLS.hub + COLS.admin + COLS.activity + COLS.actions;

type Props = {
  contacts: Contact[];
  onAdd: () => void;
  onAddDept?: () => void;
  onEdit: (c: Contact) => void;
  onDelete: (c: Contact) => void;
  onAction: (c: Contact, action: string) => void;
  busyKey?: string | null;
};

export default function ContactsPeopleTable({ contacts, onAdd, onAddDept, onEdit, onDelete, onAction, busyKey }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Users size={15} color="#fff" />
          <Text style={styles.headerTitle}>Contacts</Text>
          {contacts.length > 0 && (
            <View style={styles.headerBadge}><Text style={styles.headerBadgeText}>{contacts.length}</Text></View>
          )}
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {onAddDept && (
            <TouchableOpacity style={styles.deptBtn} onPress={onAddDept}>
              <Plus size={12} color="#fff" />
              <Text style={styles.deptBtnText}>Dept</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.addBtn} onPress={onAdd}>
            <Plus size={13} color="#fff" />
            <Text style={styles.addBtnText}>Add Contact</Text>
          </TouchableOpacity>
        </View>
      </View>

      {contacts.length === 0 ? (
        <View style={styles.empty}>
          <Users size={26} color={Colors.light.border} />
          <Text style={styles.emptyText}>No contacts yet.</Text>
          <Text style={styles.emptySub}>Add a contact to manage people and hub access from one place.</Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ minWidth: TABLE_WIDTH }}>
          <View style={{ minWidth: TABLE_WIDTH }}>
            {/* Header row */}
            <View style={styles.theadRow}>
              <Text style={[styles.th, { width: COLS.name }]}>Name</Text>
              <Text style={[styles.th, { width: COLS.role }]}>Role</Text>
              <Text style={[styles.th, { width: COLS.hub }]}>Hub Access</Text>
              <Text style={[styles.th, { width: COLS.admin }]}>Org Admin</Text>
              <Text style={[styles.th, { width: COLS.activity }]}>Last Activity</Text>
              <Text style={[styles.th, { width: COLS.actions, textAlign: 'center' }]}>·</Text>
            </View>

            {contacts.map((c) => {
              const pill = hubPill(c.hubAccess);
              const hasMembership = !!c.membershipId;
              const busy = !!busyKey && busyKey.startsWith(`${c.id}:`);
              return (
                <View key={c.id} style={styles.row}>
                  <View style={[styles.td, { width: COLS.name }]}>
                    <Text style={styles.nameText} numberOfLines={1}>
                      {c.firstName} {c.lastName}{c.isPrimary ? ' ★' : ''}
                    </Text>
                    {c.email ? <Text style={styles.subText} numberOfLines={1}>{c.email}</Text> : null}
                  </View>
                  <View style={[styles.td, { width: COLS.role }]}>
                    <Text style={styles.cellText} numberOfLines={1}>{c.role || '—'}</Text>
                  </View>
                  <View style={[styles.td, { width: COLS.hub }]}>
                    <View style={[styles.pill, { backgroundColor: pill.bg }]}>
                      <Text style={[styles.pillText, { color: pill.fg }]}>{pill.label}</Text>
                    </View>
                  </View>
                  <View style={[styles.td, { width: COLS.admin }]}>
                    {c.isOrgAdmin ? (
                      <View style={[styles.pill, { backgroundColor: '#FFE4D3' }]}>
                        <Text style={[styles.pillText, { color: '#C2410C' }]}>Admin</Text>
                      </View>
                    ) : hasMembership ? (
                      <View style={[styles.pill, { backgroundColor: '#F1F5F9' }]}>
                        <Text style={[styles.pillText, { color: '#64748B' }]}>Member</Text>
                      </View>
                    ) : (
                      <Text style={styles.cellText}>—</Text>
                    )}
                  </View>
                  <View style={[styles.td, { width: COLS.activity }]}>
                    <Text style={styles.cellText} numberOfLines={1}>{fmtDate(c.lastActivityAt)}</Text>
                  </View>
                  <View style={[styles.td, { width: COLS.actions, alignItems: 'center' }]}>
                    {busy ? (
                      <ActivityIndicator size="small" color={Colors.light.tint} />
                    ) : (
                      <OverlayMenu
                        menuWidth={210}
                        align="right"
                        trigger={({ open }) => (
                          <TouchableOpacity style={styles.actionBtn} onPress={open}>
                            <MoreHorizontal size={15} color={Colors.light.textSecondary} />
                          </TouchableOpacity>
                        )}
                      >
                        {({ close }) => (
                          <>
                            <TouchableOpacity style={styles.menuItem} onPress={() => { close(); onEdit(c); }}>
                              <Edit3 size={14} color={Colors.light.text} />
                              <Text style={styles.menuItemText}>Edit Contact</Text>
                            </TouchableOpacity>

                            {(c.hubAccess === 'none' || c.hubAccess === 'disabled') && !!c.email && (
                              <TouchableOpacity style={styles.menuItem} onPress={() => { close(); onAction(c, 'enableHubAccess'); }}>
                                <Text style={styles.menuItemText}>
                                  {c.hubAccess === 'disabled' ? 'Re-enable Hub Access' : 'Enable Hub Access'}
                                </Text>
                              </TouchableOpacity>
                            )}
                            {c.hubAccess === 'invited' && (
                              <TouchableOpacity style={styles.menuItem} onPress={() => { close(); onAction(c, 'resendInvite'); }}>
                                <Text style={styles.menuItemText}>Resend Invite</Text>
                              </TouchableOpacity>
                            )}
                            {c.hubAccess === 'enabled' && (
                              <TouchableOpacity style={styles.menuItem} onPress={() => { close(); onAction(c, 'resetPassword'); }}>
                                <Text style={styles.menuItemText}>Reset Password</Text>
                              </TouchableOpacity>
                            )}
                            {(c.hubAccess === 'enabled' || c.hubAccess === 'invited') && (
                              <TouchableOpacity style={styles.menuItem} onPress={() => { close(); onAction(c, 'disableHubAccess'); }}>
                                <Text style={styles.menuItemText}>Disable Hub Access</Text>
                              </TouchableOpacity>
                            )}

                            {hasMembership && !c.isOrgAdmin && (
                              <TouchableOpacity style={styles.menuItem} onPress={() => { close(); onAction(c, 'promoteAdmin'); }}>
                                <Text style={styles.menuItemText}>Promote to Org Admin</Text>
                              </TouchableOpacity>
                            )}
                            {hasMembership && c.isOrgAdmin && (
                              <TouchableOpacity style={styles.menuItem} onPress={() => { close(); onAction(c, 'removeAdmin'); }}>
                                <Text style={styles.menuItemText}>Remove Org Admin</Text>
                              </TouchableOpacity>
                            )}

                            <TouchableOpacity style={[styles.menuItem, styles.menuItemLast]} onPress={() => { close(); onDelete(c); }}>
                              <Trash2 size={14} color={Colors.light.error} />
                              <Text style={[styles.menuItemText, { color: Colors.light.error }]}>Delete Contact</Text>
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
  headerBadge: { backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 9, paddingHorizontal: 7, paddingVertical: 1 },
  headerBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  deptBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 7, paddingHorizontal: 8, paddingVertical: 5 },
  deptBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.light.tint, borderRadius: 7, paddingHorizontal: 10, paddingVertical: 5 },
  addBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 36, gap: 6 },
  emptyText: { fontSize: 14, fontWeight: '700', color: Colors.light.text },
  emptySub: { fontSize: 12, color: Colors.light.textSecondary, textAlign: 'center', paddingHorizontal: 24 },

  theadRow: {
    flexDirection: 'row',
    backgroundColor: Colors.light.highlightBg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  th: { fontSize: 11, fontWeight: '700', color: Colors.light.textSecondary, textTransform: 'uppercase', letterSpacing: 0.3 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  td: { justifyContent: 'center', paddingRight: 10 },
  nameText: { fontSize: 13, fontWeight: '600', color: Colors.light.text },
  subText: { fontSize: 11, color: Colors.light.textSecondary, marginTop: 1 },
  cellText: { fontSize: 12, color: Colors.light.text },
  pill: { alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 3 },
  pillText: { fontSize: 11, fontWeight: '700' },
  actionBtn: { padding: 5, borderRadius: 6 },

  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 11,
    paddingHorizontal: 13,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  menuItemLast: { borderBottomWidth: 0 },
  menuItemText: { fontSize: 13, color: Colors.light.text, fontWeight: '500' },
});
