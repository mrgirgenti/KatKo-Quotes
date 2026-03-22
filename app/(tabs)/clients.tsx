import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Image,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, Search, Edit3, Trash2, X, Users, ChevronRight, ChevronDown, MoreVertical } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useClients } from '@/contexts/ClientsContext';
import { Client, ClientStatus } from '@/types/client';
import { generateId } from '@/utils/quoteCalculations';
import { useBreakpoint } from '@/hooks/useBreakpoint';

const STATUS_OPTIONS: ClientStatus[] = ['Active', 'Prospect', 'Inactive'];

const STATUS_STYLE: Record<ClientStatus, { bg: string; text: string; border: string }> = {
  Active:   { bg: '#ECFDF5', text: '#059669', border: '#6EE7B7' },
  Prospect: { bg: Colors.light.highlightBg, text: Colors.light.tint, border: '#FFB784' },
  Inactive: { bg: '#F3F4F6', text: '#6B7280', border: '#D1D5DB' },
};

const FILTER_TABS: (ClientStatus | 'All')[] = ['All', 'Active', 'Prospect', 'Inactive'];

const EMPTY_FORM = {
  name: '',
  organization: '',
  email: '',
  phone: '',
  status: 'Prospect' as ClientStatus,
  notes: '',
};

function AvatarCircle({ client, size = 40 }: { client: Client; size?: number }) {
  const initial = client.name.charAt(0).toUpperCase();
  return (
    <View style={[styles.avatarCircle, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarInitial, { fontSize: size * 0.4 }]}>{initial}</Text>
    </View>
  );
}

function StatusBadge({ status }: { status: ClientStatus }) {
  const st = STATUS_STYLE[status];
  return (
    <View style={[styles.statusTag, { backgroundColor: st.bg, borderColor: st.border, borderWidth: 1 }]}>
      <Text style={[styles.statusTagText, { color: st.text }]}>{status}</Text>
    </View>
  );
}

interface ClientRowProps {
  client: Client;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function ClientRow({ client, onPress, onEdit, onDelete }: ClientRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const menuBtnRef = useRef<View>(null);

  const openMenu = () => {
    menuBtnRef.current?.measure((_fx, _fy, width, height, px, py) => {
      setMenuPos({ top: py + height + 4, right: Math.max(0, (typeof window !== 'undefined' ? window.innerWidth : 400) - px - width) });
      setMenuOpen(true);
    });
  };

  return (
    <TouchableOpacity style={styles.tableRow} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.colAvatar}>
        <AvatarCircle client={client} size={36} />
      </View>
      <View style={styles.colName}>
        <Text style={styles.tableClientName} numberOfLines={1}>{client.name}</Text>
      </View>
      <View style={styles.colOrg}>
        <Text style={styles.tableClientOrg} numberOfLines={1}>{client.organization || '—'}</Text>
      </View>
      <View style={styles.colEmail}>
        <Text style={styles.tableClientContact} numberOfLines={1}>{client.email || '—'}</Text>
      </View>
      <View style={styles.colPhone}>
        <Text style={styles.tableClientContact} numberOfLines={1}>{client.phone || '—'}</Text>
      </View>
      <View style={styles.colStatus}>
        <StatusBadge status={client.status} />
      </View>
      <View style={styles.colActions}>
        <TouchableOpacity style={styles.viewBtn} onPress={onPress}>
          <Text style={styles.viewBtnText}>View</Text>
        </TouchableOpacity>
        <View ref={menuBtnRef} collapsable={false}>
          <TouchableOpacity style={styles.menuBtn} onPress={openMenu}>
            <ChevronDown size={14} color={Colors.light.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={menuOpen} transparent animationType="none" onRequestClose={() => setMenuOpen(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setMenuOpen(false)}>
          <View style={[styles.dropdownMenu, { position: 'absolute', top: menuPos.top, right: menuPos.right }]}>
            <TouchableOpacity style={styles.dropdownItem} onPress={() => { setMenuOpen(false); onEdit(); }}>
              <Edit3 size={14} color={Colors.light.text} />
              <Text style={styles.dropdownItemText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.dropdownItem, styles.dropdownItemDanger]} onPress={() => { setMenuOpen(false); onDelete(); }}>
              <Trash2 size={14} color="#EF4444" />
              <Text style={[styles.dropdownItemText, { color: '#EF4444' }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </TouchableOpacity>
  );
}

export default function ClientsScreen() {
  const router = useRouter();
  const { clients, addClient, updateClient, deleteClient } = useClients();
  const { isDesktop } = useBreakpoint();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ClientStatus | 'All'>('All');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const filtered = useMemo(() => {
    return clients.filter((c) => {
      const matchesFilter = filter === 'All' || c.status === filter;
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        (c.organization || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q);
      return matchesFilter && matchesSearch;
    });
  }, [clients, filter, search]);

  const openAddModal = useCallback(() => {
    setEditingClient(null);
    setForm(EMPTY_FORM);
    setModalVisible(true);
  }, []);

  const openEditModal = useCallback((client: Client) => {
    setEditingClient(client);
    setForm({
      name: client.name,
      organization: client.organization || '',
      email: client.email || '',
      phone: client.phone || '',
      status: client.status,
      notes: client.notes || '',
    });
    setModalVisible(true);
  }, []);

  const handleSave = useCallback(() => {
    if (!form.name.trim()) {
      Alert.alert('Required', 'Please enter a client name.');
      return;
    }
    if (editingClient) {
      updateClient({
        ...editingClient,
        name: form.name.trim(),
        organization: form.organization.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        status: form.status,
        notes: form.notes.trim() || undefined,
      });
    } else {
      addClient({
        name: form.name.trim(),
        organization: form.organization.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        status: form.status,
        notes: form.notes.trim() || undefined,
        totalOrders: 0,
        totalSpent: 0,
      });
    }
    setModalVisible(false);
  }, [form, editingClient, addClient, updateClient]);

  const handleDelete = useCallback(
    (client: Client) => {
      Alert.alert(
        'Delete Client',
        `Remove ${client.name} from your client list?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => deleteClient(client.id) },
        ]
      );
    },
    [deleteClient]
  );

  const counts = useMemo(() => ({
    All: clients.length,
    Active: clients.filter((c) => c.status === 'Active').length,
    Prospect: clients.filter((c) => c.status === 'Prospect').length,
    Inactive: clients.filter((c) => c.status === 'Inactive').length,
  }), [clients]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.pageHeader}>
        <View style={styles.headerTop}>
          <Text style={styles.pageTitle}>Clients</Text>
          <Text style={styles.pageSubtitle}>{clients.length} client{clients.length !== 1 ? 's' : ''}</Text>
        </View>

        {/* Filter pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillsScroll} contentContainerStyle={styles.pillsRow}>
          {FILTER_TABS.map((tab) => {
            const active = filter === tab;
            const st = tab !== 'All' ? STATUS_STYLE[tab as ClientStatus] : null;
            return (
              <TouchableOpacity
                key={tab}
                style={[styles.pill, active && styles.pillActive, active && st ? { backgroundColor: st.bg, borderColor: st.border } : null]}
                onPress={() => setFilter(tab)}
              >
                <Text style={[styles.pillText, active && styles.pillTextActive, active && st ? { color: st.text } : null]}>
                  {tab}
                </Text>
                <View style={[styles.pillCount, active && st ? { backgroundColor: st.border } : null]}>
                  <Text style={[styles.pillCountText, active && st ? { color: st.text } : null]}>{counts[tab]}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Search + Add row */}
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Search size={15} color={Colors.light.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search name, org, email…"
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
          <TouchableOpacity style={styles.addBtn} onPress={openAddModal}>
            <Plus size={16} color="#fff" />
            <Text style={styles.addBtnText}>Add Client</Text>
          </TouchableOpacity>
        </View>

        {/* Desktop table header */}
        {isDesktop && (
          <View style={styles.tableHeader}>
            <View style={styles.colAvatar} />
            <View style={styles.colName}><Text style={styles.thText}>Name</Text></View>
            <View style={styles.colOrg}><Text style={styles.thText}>Organization</Text></View>
            <View style={styles.colEmail}><Text style={styles.thText}>Email</Text></View>
            <View style={styles.colPhone}><Text style={styles.thText}>Phone</Text></View>
            <View style={styles.colStatus}><Text style={styles.thText}>Status</Text></View>
            <View style={styles.colActions}><Text style={[styles.thText, { textAlign: 'right' }]}>Actions</Text></View>
          </View>
        )}
      </View>

      {/* Content */}
      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Users size={36} color={Colors.light.border} />
          <Text style={styles.emptyTitle}>No clients found</Text>
          <Text style={styles.emptyText}>
            {search ? 'Try a different search term.' : 'Add your first client to get started.'}
          </Text>
          {!search && (
            <TouchableOpacity style={styles.emptyAddBtn} onPress={openAddModal}>
              <Text style={styles.emptyAddBtnText}>Add Client</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : isDesktop ? (
        <FlatList
          data={filtered}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.tableBody}
          ItemSeparatorComponent={() => <View style={styles.tableDivider} />}
          renderItem={({ item: client }) => (
            <ClientRow
              client={client}
              onPress={() => router.push(`/clients/${client.id}` as any)}
              onEdit={() => openEditModal(client)}
              onDelete={() => handleDelete(client)}
            />
          )}
        />
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {filtered.map((client) => {
            const st = STATUS_STYLE[client.status];
            return (
              <TouchableOpacity
                key={client.id}
                style={styles.clientCard}
                onPress={() => router.push(`/clients/${client.id}` as any)}
                activeOpacity={0.85}
              >
                <View style={styles.clientCardLeft}>
                  <AvatarCircle client={client} size={44} />
                  <View style={styles.clientInfo}>
                    <View style={styles.clientNameRow}>
                      <Text style={styles.clientName}>{client.name}</Text>
                      <StatusBadge status={client.status} />
                    </View>
                    {client.organization ? (
                      <Text style={styles.clientOrg}>{client.organization}</Text>
                    ) : null}
                    <View style={styles.clientContacts}>
                      {client.email ? <Text style={styles.clientContact}>{client.email}</Text> : null}
                      {client.phone ? <Text style={styles.clientContact}>{client.phone}</Text> : null}
                    </View>
                    {client.notes ? (
                      <Text style={styles.clientNotes} numberOfLines={2}>{client.notes}</Text>
                    ) : null}
                  </View>
                </View>
                <View style={styles.clientCardRight}>
                  <TouchableOpacity style={styles.actionBtn} onPress={(e) => { e.stopPropagation?.(); openEditModal(client); }}>
                    <Edit3 size={16} color={Colors.light.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionBtn} onPress={(e) => { e.stopPropagation?.(); handleDelete(client); }}>
                    <Trash2 size={16} color={Colors.light.error} />
                  </TouchableOpacity>
                  <ChevronRight size={16} color={Colors.light.border} />
                </View>
              </TouchableOpacity>
            );
          })}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* Add/Edit Modal */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalKAV}>
            <Pressable style={styles.modalCard} onPress={() => {}}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editingClient ? 'Edit Client' : 'Add Client'}</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <X size={22} color={Colors.light.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.fieldLabel}>Status</Text>
                <View style={styles.statusRow}>
                  {STATUS_OPTIONS.map((s) => {
                    const st = STATUS_STYLE[s];
                    const selected = form.status === s;
                    return (
                      <TouchableOpacity
                        key={s}
                        style={[styles.statusOption, selected && { backgroundColor: st.bg, borderColor: st.text }]}
                        onPress={() => setForm((f) => ({ ...f, status: s }))}
                      >
                        <Text style={[styles.statusOptionText, selected && { color: st.text, fontWeight: '700' as const }]}>{s}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.fieldLabel}>Name *</Text>
                <TextInput style={styles.textInput} value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="Full name" placeholderTextColor={Colors.light.textSecondary} />

                <Text style={styles.fieldLabel}>Organization</Text>
                <TextInput style={styles.textInput} value={form.organization} onChangeText={(v) => setForm((f) => ({ ...f, organization: v }))} placeholder="Company or school name" placeholderTextColor={Colors.light.textSecondary} />

                <Text style={styles.fieldLabel}>Email</Text>
                <TextInput style={styles.textInput} value={form.email} onChangeText={(v) => setForm((f) => ({ ...f, email: v }))} placeholder="email@example.com" placeholderTextColor={Colors.light.textSecondary} keyboardType="email-address" autoCapitalize="none" />

                <Text style={styles.fieldLabel}>Phone</Text>
                <TextInput style={styles.textInput} value={form.phone} onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))} placeholder="(555) 000-0000" placeholderTextColor={Colors.light.textSecondary} keyboardType="phone-pad" />

                <Text style={styles.fieldLabel}>Notes</Text>
                <TextInput style={[styles.textInput, styles.notesInput]} value={form.notes} onChangeText={(v) => setForm((f) => ({ ...f, notes: v }))} placeholder="Any additional notes..." placeholderTextColor={Colors.light.textSecondary} multiline numberOfLines={3} />
              </ScrollView>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                  <Text style={styles.saveBtnText}>{editingClient ? 'Save Changes' : 'Add Client'}</Text>
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
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },

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
    paddingBottom: 14,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: Colors.light.text,
  },
  pageSubtitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },

  pillsScroll: { maxHeight: 46 },
  pillsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.background,
  },
  pillActive: { borderColor: Colors.light.tint, backgroundColor: '#FFF4EE' },
  pillText: { fontSize: 13, fontWeight: '500', color: Colors.light.textSecondary },
  pillTextActive: { color: Colors.light.tint, fontWeight: '700' },
  pillCount: {
    backgroundColor: Colors.light.border,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  pillCountText: { fontSize: 10, fontWeight: '700', color: Colors.light.textSecondary },

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
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
  },
  addBtnText: { fontSize: 14, fontWeight: '600' as const, color: '#fff' },

  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#111111',
  },
  thText: { fontSize: 11, fontWeight: '700', color: '#ffffff', textTransform: 'uppercase', letterSpacing: 0.5 },

  tableBody: { paddingBottom: 40 },
  tableDivider: { height: 1, backgroundColor: Colors.light.border },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: Colors.light.surface,
  },

  colAvatar:  { width: 52 },
  colName:    { flex: 1.4 },
  colOrg:     { flex: 1.2 },
  colEmail:   { flex: 1.5 },
  colPhone:   { width: 130 },
  colStatus:  { width: 100 },
  colActions: { width: 100, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 4 },

  tableClientName:    { fontSize: 13, fontWeight: '700', color: Colors.light.text },
  tableClientOrg:     { fontSize: 13, color: Colors.light.textSecondary },
  tableClientContact: { fontSize: 13, color: Colors.light.text },

  viewBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 7,
    backgroundColor: Colors.light.tint,
  },
  viewBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  menuBtn: {
    width: 28,
    height: 28,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: { flex: 1 },
  dropdownMenu: {
    backgroundColor: Colors.light.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
    minWidth: 160,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  dropdownItemDanger: { borderBottomWidth: 0 },
  dropdownItemText: { fontSize: 13, color: Colors.light.text, fontWeight: '500' },

  list: { flex: 1 },
  listContent: { gap: 10, padding: 16, paddingBottom: 40 },

  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 10,
  },
  emptyTitle: { fontSize: 17, fontWeight: '600' as const, color: Colors.light.text },
  emptyText: { fontSize: 14, color: Colors.light.textSecondary, textAlign: 'center' },
  emptyAddBtn: {
    marginTop: 8,
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  emptyAddBtnText: { fontSize: 14, fontWeight: '600' as const, color: '#fff' },

  clientCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.light.border,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  clientCardLeft: { flexDirection: 'row', gap: 12, flex: 1 },
  clientCardRight: { flexDirection: 'row', gap: 4, marginLeft: 8 },
  avatarCircle: {
    backgroundColor: Colors.light.tint,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  avatarInitial: { fontWeight: '700' as const, color: '#fff' },
  clientInfo: { flex: 1, gap: 3 },
  clientNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  clientName: { fontSize: 15, fontWeight: '700' as const, color: Colors.light.text },
  statusTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  statusTagText: { fontSize: 11, fontWeight: '700' as const },
  clientOrg: { fontSize: 13, color: Colors.light.textSecondary, fontWeight: '500' as const },
  clientContacts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  clientContact: { fontSize: 12, color: Colors.light.textSecondary },
  clientNotes: { fontSize: 12, color: Colors.light.textSecondary, fontStyle: 'italic', marginTop: 4 },
  actionBtn: { padding: 8, borderRadius: 8, backgroundColor: Colors.light.background },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalKAV: { width: '100%', maxWidth: 480 },
  modalCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    padding: 24,
    maxHeight: '90%' as any,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: '700' as const, color: Colors.light.text },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
    marginBottom: 6,
    marginTop: 12,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  statusRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  statusOption: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: 'center',
    backgroundColor: Colors.light.background,
  },
  statusOptionText: { fontSize: 13, fontWeight: '500' as const, color: Colors.light.textSecondary },
  textInput: {
    backgroundColor: Colors.light.background,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.light.text,
  },
  notesInput: { height: 80, textAlignVertical: 'top', paddingTop: 10 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600' as const, color: Colors.light.textSecondary },
  saveBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: Colors.light.tint,
    alignItems: 'center',
  },
  saveBtnText: { fontSize: 15, fontWeight: '700' as const, color: '#fff' },
});
