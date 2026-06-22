import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Plus, Edit3, Trash2, MoreHorizontal, Users } from 'lucide-react-native';
import Colors from '@/constants/colors';
import OverlayMenu from '@/components/OverlayMenu';
import { formatPhone } from '@/utils/phone';
import type { Contact, HubAccessState } from '@/types/crm';

/**
 * CRM CONSOLIDATION — the single people-management surface.
 *
 * Renders the org's Contacts as a flat operational table. Every per-row hub /
 * admin action is dispatched through `onAction(contact, action)` which routes to
 * the consolidated contacts API (the only people write path). Hub Access and Org
 * Admin are derived from the enriched Contact row, so the counts here always
 * match the Client Hub card exactly.
 *
 * Layout law: the per-row actions menu lives in a FIXED-width column rendered as
 * a sibling OUTSIDE the flexible data block (`rowData`, which is flex:1 +
 * overflow:hidden). The data columns shrink/truncate to fit any card width while
 * the actions column always keeps its space — so the ⋯ menu can never be clipped
 * off the right edge, even on narrow cards. (No horizontal scroll.)
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

const COL = {
  name: { flex: 2.4, minWidth: 140 },
  phone: { flex: 1.3, minWidth: 92 },
  role: { flex: 1.2, minWidth: 80 },
  dept: { flex: 1.2, minWidth: 84 },
  hub: { flex: 1.1, minWidth: 84 },
  activity: { flex: 1.1, minWidth: 80 },
} as const;

type Props = {
  contacts: Contact[];
  onAdd: () => void;
  onEdit: (c: Contact) => void;
  onDelete: (c: Contact) => void;
  onAction: (c: Contact, action: string) => void;
  busyKey?: string | null;
};

export default function ContactsPeopleTable({ contacts, onAdd, onEdit, onDelete, onAction, busyKey }: Props) {
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
        <TouchableOpacity style={styles.addBtn} onPress={onAdd}>
          <Plus size={13} color="#fff" />
          <Text style={styles.addBtnText}>Add Contact</Text>
        </TouchableOpacity>
      </View>

      {contacts.length === 0 ? (
        <View style={styles.empty}>
          <Users size={26} color={Colors.light.border} />
          <Text style={styles.emptyText}>No contacts yet.</Text>
          <Text style={styles.emptySub}>Add a contact to manage people and hub access from one place.</Text>
        </View>
      ) : (
        <View>
          {/* Header row */}
          <View style={styles.theadRow}>
            <View style={styles.rowData}>
              <Text style={[styles.th, COL.name]}>Name</Text>
              <Text style={[styles.th, COL.phone]}>Phone</Text>
              <Text style={[styles.th, COL.role]}>Role</Text>
              <Text style={[styles.th, COL.dept]}>Department</Text>
              <Text style={[styles.th, COL.hub]}>Hub Access</Text>
              <Text style={[styles.th, COL.activity]}>Last Activity</Text>
            </View>
            <View style={styles.actionsCol} />
          </View>

          {contacts.map((c) => {
            const pill = hubPill(c.hubAccess);
            const hasMembership = !!c.membershipId;
            const busy = !!busyKey && busyKey.startsWith(`${c.id}:`);
            return (
              <View key={c.id} style={styles.row}>
                <View style={styles.rowData}>
                  <View style={[styles.td, COL.name]}>
                    <View style={styles.nameLine}>
                      <Text style={styles.nameText} numberOfLines={1}>
                        {c.firstName} {c.lastName}
                      </Text>
                      {c.isPrimary ? <Text style={styles.starBadge}>★</Text> : null}
                      {c.isOrgAdmin ? (
                        <View style={styles.adminBadge}><Text style={styles.adminBadgeText}>Admin</Text></View>
                      ) : null}
                    </View>
                    {c.email ? <Text style={styles.subText} numberOfLines={1}>{c.email}</Text> : null}
                  </View>
                  <View style={[styles.td, COL.phone]}>
                    <Text style={styles.cellText} numberOfLines={1}>{c.phone ? formatPhone(c.phone) : '—'}</Text>
                  </View>
                  <View style={[styles.td, COL.role]}>
                    <Text style={styles.cellText} numberOfLines={1}>{c.role || '—'}</Text>
                  </View>
                  <View style={[styles.td, COL.dept]}>
                    <Text style={styles.cellText} numberOfLines={1}>{c.department || '—'}</Text>
                  </View>
                  <View style={[styles.td, COL.hub]}>
                    <View style={[styles.pill, { backgroundColor: pill.bg }]}>
                      <Text style={[styles.pillText, { color: pill.fg }]} numberOfLines={1}>{pill.label}</Text>
                    </View>
                  </View>
                  <View style={[styles.td, COL.activity]}>
                    <Text style={styles.cellText} numberOfLines={1}>{fmtDate(c.lastActivityAt)}</Text>
                  </View>
                </View>

                <View style={styles.actionsCol}>
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
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.light.tint, borderRadius: 7, paddingHorizontal: 10, paddingVertical: 5 },
  addBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 36, gap: 6 },
  emptyText: { fontSize: 14, fontWeight: '700', color: Colors.light.text },
  emptySub: { fontSize: 12, color: Colors.light.textSecondary, textAlign: 'center', paddingHorizontal: 24 },

  theadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.highlightBg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  th: { fontSize: 11, fontWeight: '700', color: Colors.light.textSecondary, textTransform: 'uppercase', letterSpacing: 0.3, paddingRight: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  // Flexible data block: shrinks/truncates so the fixed actions column never clips.
  rowData: { flex: 1, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  // Fixed actions column rendered OUTSIDE rowData — always keeps its width.
  actionsCol: { width: 44, alignItems: 'center', justifyContent: 'center' },
  td: { justifyContent: 'center', paddingRight: 10 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  nameText: { fontSize: 13, fontWeight: '600', color: Colors.light.text, flexShrink: 1 },
  starBadge: { fontSize: 12, color: '#F59E0B' },
  adminBadge: { backgroundColor: '#FFE4D3', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 },
  adminBadgeText: { fontSize: 10, fontWeight: '700', color: '#C2410C' },
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
