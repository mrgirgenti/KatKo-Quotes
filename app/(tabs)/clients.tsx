import React, { useState, useMemo, useCallback } from 'react';
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
} from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, Search, Edit3, Trash2, X, Users, ChevronRight } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useClients } from '@/contexts/ClientsContext';
import { Client, ClientStatus } from '@/types/client';
import { generateId } from '@/utils/quoteCalculations';

const STATUS_OPTIONS: ClientStatus[] = ['Active', 'Prospect', 'Inactive'];

const STATUS_STYLE: Record<ClientStatus, { bg: string; text: string }> = {
  Active: { bg: '#ECFDF5', text: '#059669' },
  Prospect: { bg: Colors.light.highlightBg, text: Colors.light.tint },
  Inactive: { bg: '#F3F4F6', text: '#6B7280' },
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

export default function ClientsScreen() {
  const router = useRouter();
  const { clients, addClient, updateClient, deleteClient } = useClients();
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
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => deleteClient(client.id),
          },
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
        <Text style={styles.pageTitle}>Clients</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openAddModal}>
          <Plus size={18} color="#fff" />
          <Text style={styles.addBtnText}>Add Client</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Search size={16} color={Colors.light.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search clients..."
          placeholderTextColor={Colors.light.textSecondary}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <X size={16} color={Colors.light.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {FILTER_TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.filterTab, filter === tab && styles.filterTabActive]}
            onPress={() => setFilter(tab)}
          >
            <Text style={[styles.filterTabText, filter === tab && styles.filterTabTextActive]}>
              {tab}
            </Text>
            <View style={[styles.filterCount, filter === tab && styles.filterCountActive]}>
              <Text style={[styles.filterCountText, filter === tab && styles.filterCountTextActive]}>
                {counts[tab]}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
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
        ) : (
          filtered.map((client) => {
            const st = STATUS_STYLE[client.status];
            return (
              <TouchableOpacity
                key={client.id}
                style={styles.clientCard}
                onPress={() => router.push(`/clients/${client.id}` as any)}
                activeOpacity={0.85}
              >
                <View style={styles.clientCardLeft}>
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarInitial}>
                      {client.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.clientInfo}>
                    <View style={styles.clientNameRow}>
                      <Text style={styles.clientName}>{client.name}</Text>
                      <View style={[styles.statusTag, { backgroundColor: st.bg }]}>
                        <Text style={[styles.statusTagText, { color: st.text }]}>
                          {client.status}
                        </Text>
                      </View>
                    </View>
                    {client.organization && (
                      <Text style={styles.clientOrg}>{client.organization}</Text>
                    )}
                    <View style={styles.clientContacts}>
                      {client.email && (
                        <Text style={styles.clientContact}>{client.email}</Text>
                      )}
                      {client.phone && (
                        <Text style={styles.clientContact}>{client.phone}</Text>
                      )}
                    </View>
                    {client.notes ? (
                      <Text style={styles.clientNotes} numberOfLines={2}>
                        {client.notes}
                      </Text>
                    ) : null}
                  </View>
                </View>
                <View style={styles.clientActions}>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={(e) => { e.stopPropagation?.(); openEditModal(client); }}
                  >
                    <Edit3 size={16} color={Colors.light.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={(e) => { e.stopPropagation?.(); handleDelete(client); }}
                  >
                    <Trash2 size={16} color={Colors.light.error} />
                  </TouchableOpacity>
                  <ChevronRight size={16} color={Colors.light.border} />
                </View>
              </TouchableOpacity>
            );
          })
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalKAV}
          >
            <Pressable style={styles.modalCard} onPress={() => {}}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editingClient ? 'Edit Client' : 'Add Client'}
                </Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <X size={22} color={Colors.light.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Status selector */}
                <Text style={styles.fieldLabel}>Status</Text>
                <View style={styles.statusRow}>
                  {STATUS_OPTIONS.map((s) => {
                    const st = STATUS_STYLE[s];
                    const selected = form.status === s;
                    return (
                      <TouchableOpacity
                        key={s}
                        style={[
                          styles.statusOption,
                          selected && { backgroundColor: st.bg, borderColor: st.text },
                        ]}
                        onPress={() => setForm((f) => ({ ...f, status: s }))}
                      >
                        <Text
                          style={[
                            styles.statusOptionText,
                            selected && { color: st.text, fontWeight: '700' as const },
                          ]}
                        >
                          {s}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.fieldLabel}>Name *</Text>
                <TextInput
                  style={styles.textInput}
                  value={form.name}
                  onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
                  placeholder="Full name"
                  placeholderTextColor={Colors.light.textSecondary}
                />

                <Text style={styles.fieldLabel}>Organization</Text>
                <TextInput
                  style={styles.textInput}
                  value={form.organization}
                  onChangeText={(v) => setForm((f) => ({ ...f, organization: v }))}
                  placeholder="Company or school name"
                  placeholderTextColor={Colors.light.textSecondary}
                />

                <Text style={styles.fieldLabel}>Email</Text>
                <TextInput
                  style={styles.textInput}
                  value={form.email}
                  onChangeText={(v) => setForm((f) => ({ ...f, email: v }))}
                  placeholder="email@example.com"
                  placeholderTextColor={Colors.light.textSecondary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                <Text style={styles.fieldLabel}>Phone</Text>
                <TextInput
                  style={styles.textInput}
                  value={form.phone}
                  onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))}
                  placeholder="(555) 000-0000"
                  placeholderTextColor={Colors.light.textSecondary}
                  keyboardType="phone-pad"
                />

                <Text style={styles.fieldLabel}>Notes</Text>
                <TextInput
                  style={[styles.textInput, styles.notesInput]}
                  value={form.notes}
                  onChangeText={(v) => setForm((f) => ({ ...f, notes: v }))}
                  placeholder="Any additional notes..."
                  placeholderTextColor={Colors.light.textSecondary}
                  multiline
                  numberOfLines={3}
                />
              </ScrollView>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                  <Text style={styles.saveBtnText}>
                    {editingClient ? 'Save Changes' : 'Add Client'}
                  </Text>
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
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '800' as const,
    color: Colors.light.text,
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
  addBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#fff',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.light.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.light.text,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  filterTabActive: {
    backgroundColor: Colors.light.tint,
    borderColor: Colors.light.tint,
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.light.textSecondary,
  },
  filterTabTextActive: {
    color: '#fff',
    fontWeight: '600' as const,
  },
  filterCount: {
    backgroundColor: Colors.light.border,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: 'center',
  },
  filterCountActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  filterCountText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.light.textSecondary,
  },
  filterCountTextActive: {
    color: '#fff',
  },
  list: {
    flex: 1,
  },
  listContent: {
    gap: 10,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  emptyAddBtn: {
    marginTop: 8,
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  emptyAddBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#fff',
  },
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
  clientCardLeft: {
    flexDirection: 'row',
    gap: 12,
    flex: 1,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.tint,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  avatarInitial: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
  clientInfo: {
    flex: 1,
    gap: 3,
  },
  clientNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  clientName: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusTagText: {
    fontSize: 11,
    fontWeight: '700' as const,
  },
  clientOrg: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    fontWeight: '500' as const,
  },
  clientContacts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  clientContact: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  clientNotes: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    fontStyle: 'italic',
    marginTop: 4,
  },
  clientActions: {
    flexDirection: 'row',
    gap: 4,
    marginLeft: 8,
  },
  actionBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: Colors.light.background,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalKAV: {
    width: '100%',
    maxWidth: 480,
  },
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
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
    marginBottom: 6,
    marginTop: 12,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  statusOption: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: 'center',
    backgroundColor: Colors.light.background,
  },
  statusOptionText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.light.textSecondary,
  },
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
  notesInput: {
    height: 80,
    textAlignVertical: 'top',
    paddingTop: 10,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: Colors.light.tint,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#fff',
  },
});
