import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import {
  Edit3,
  Mail,
  Phone,
  Building2,
  FileText,
  CheckCircle,
  ChevronRight,
  MoreVertical,
  X,
  Trash2,
  Plus,
  Clock,
  DollarSign,
  ShoppingBag,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useClients } from '@/contexts/ClientsContext';
import { useQuotes } from '@/contexts/QuotesContext';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { Client, ClientStatus } from '@/types/client';
import { formatCurrency } from '@/utils/quoteCalculations';

const STATUS_OPTIONS: ClientStatus[] = ['Active', 'Prospect', 'Inactive'];

const STATUS_STYLE: Record<ClientStatus, { bg: string; text: string }> = {
  Active: { bg: '#ECFDF5', text: '#059669' },
  Prospect: { bg: Colors.light.highlightBg, text: Colors.light.tint },
  Inactive: { bg: '#F3F4F6', text: '#6B7280' },
};

const EMPTY_FORM = {
  name: '',
  organization: '',
  email: '',
  phone: '',
  status: 'Active' as ClientStatus,
  notes: '',
};

function formatDate(isoString?: string): string {
  if (!isoString) return 'N/A';
  const d = new Date(isoString);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ClientProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { clients, updateClient, deleteClient } = useClients();
  const { quotes, sales } = useQuotes();
  const { isDesktop } = useBreakpoint();

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [moreMenuVisible, setMoreMenuVisible] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const client = useMemo(() => clients.find((c) => c.id === id), [clients, id]);

  const relatedItems = useMemo(() => {
    if (!client) return [];
    const all = [...quotes, ...sales];
    return all
      .filter((q) => {
        const qName = q.personOrganization.toLowerCase();
        return (
          qName === client.name.toLowerCase() ||
          (client.organization && qName === client.organization.toLowerCase())
        );
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [quotes, sales, client]);

  const totalSpent = useMemo(() => {
    return relatedItems
      .filter((q) => q.status === 'sale')
      .reduce((sum, q) => sum + (q.salesData?.amountCollected || q.calculations.total), 0);
  }, [relatedItems]);

  const openEditModal = useCallback(() => {
    if (!client) return;
    setForm({
      name: client.name,
      organization: client.organization || '',
      email: client.email || '',
      phone: client.phone || '',
      status: client.status,
      notes: client.notes || '',
    });
    setEditModalVisible(true);
  }, [client]);

  const handleSaveEdit = useCallback(() => {
    if (!client || !form.name.trim()) {
      Alert.alert('Required', 'Please enter a client name.');
      return;
    }
    updateClient({
      ...client,
      name: form.name.trim(),
      organization: form.organization.trim() || undefined,
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      status: form.status,
      notes: form.notes.trim() || undefined,
    });
    setEditModalVisible(false);
  }, [client, form, updateClient]);

  const handleDelete = useCallback(() => {
    if (!client) return;
    setMoreMenuVisible(false);
    Alert.alert(
      'Delete Client',
      `Remove ${client.name} from your client list? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteClient(client.id);
            router.back();
          },
        },
      ]
    );
  }, [client, deleteClient, router]);

  const handleCreateEstimate = useCallback(() => {
    setMoreMenuVisible(false);
    router.push('/(tabs)' as any);
  }, [router]);

  if (!client) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Client Profile' }} />
        <View style={styles.notFound}>
          <FileText size={48} color={Colors.light.border} />
          <Text style={styles.notFoundText}>Client not found</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const st = STATUS_STYLE[client.status];
  const initial = client.name.charAt(0).toUpperCase();

  const infoPanel = (
    <View style={styles.infoPanel}>
      <View style={styles.avatarLarge}>
        <Text style={styles.avatarInitialLarge}>{initial}</Text>
      </View>

      <Text style={styles.clientNameLarge}>{client.name}</Text>
      {client.organization && (
        <View style={styles.orgRow}>
          <Building2 size={14} color={Colors.light.textSecondary} />
          <Text style={styles.clientOrgLarge}>{client.organization}</Text>
        </View>
      )}

      <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
        <Text style={[styles.statusBadgeText, { color: st.text }]}>{client.status}</Text>
      </View>

      <View style={styles.divider} />

      {client.email && (
        <View style={styles.contactRow}>
          <Mail size={15} color={Colors.light.textSecondary} />
          <Text style={styles.contactText}>{client.email}</Text>
        </View>
      )}
      {client.phone && (
        <View style={styles.contactRow}>
          <Phone size={15} color={Colors.light.textSecondary} />
          <Text style={styles.contactText}>{client.phone}</Text>
        </View>
      )}

      {client.notes && (
        <>
          <View style={styles.divider} />
          <Text style={styles.notesLabel}>Notes</Text>
          <Text style={styles.notesText}>{client.notes}</Text>
        </>
      )}

      <View style={styles.divider} />

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <ShoppingBag size={18} color={Colors.light.tint} />
          <Text style={styles.statValue}>{relatedItems.length}</Text>
          <Text style={styles.statLabel}>Orders</Text>
        </View>
        <View style={styles.statBox}>
          <DollarSign size={18} color={Colors.light.success} />
          <Text style={styles.statValue}>{formatCurrency(totalSpent)}</Text>
          <Text style={styles.statLabel}>Spent</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <TouchableOpacity style={styles.editBtn} onPress={openEditModal}>
        <Edit3 size={15} color="#fff" />
        <Text style={styles.editBtnText}>Edit Profile</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.moreBtn} onPress={() => setMoreMenuVisible(true)}>
        <MoreVertical size={15} color={Colors.light.textSecondary} />
        <Text style={styles.moreBtnText}>More Options</Text>
      </TouchableOpacity>

      <Text style={styles.memberSince}>
        Member since {formatDate(client.createdAt)}
      </Text>
    </View>
  );

  const invoicesPanel = (
    <View style={styles.invoicesPanel}>
      <View style={styles.invoicesPanelHeader}>
        <Text style={styles.invoicesPanelTitle}>Quotes & Invoices</Text>
        <TouchableOpacity style={styles.newEstimateBtn} onPress={handleCreateEstimate}>
          <Plus size={14} color="#fff" />
          <Text style={styles.newEstimateBtnText}>New Quote</Text>
        </TouchableOpacity>
      </View>

      {relatedItems.length === 0 ? (
        <View style={styles.emptyInvoices}>
          <FileText size={36} color={Colors.light.border} />
          <Text style={styles.emptyInvoicesTitle}>No quotes yet</Text>
          <Text style={styles.emptyInvoicesText}>
            Create a new quote for this client to get started.
          </Text>
        </View>
      ) : (
        relatedItems.map((item) => {
          const isSale = item.status === 'sale';
          return (
            <TouchableOpacity
              key={item.id}
              style={styles.invoiceRow}
              onPress={() => router.push(`/quote/${item.id}` as any)}
              activeOpacity={0.8}
            >
              <View style={styles.invoiceRowLeft}>
                <View style={[styles.invoiceStatusDot, { backgroundColor: isSale ? Colors.light.success : Colors.light.tint }]} />
                <View style={styles.invoiceInfo}>
                  <Text style={styles.invoiceProject} numberOfLines={1}>{item.projectName}</Text>
                  <View style={styles.invoiceMeta}>
                    {item.invoiceNumber && (
                      <Text style={styles.invoiceNum}>#{item.invoiceNumber}</Text>
                    )}
                    <View style={styles.invoiceDateRow}>
                      <Clock size={11} color={Colors.light.textSecondary} />
                      <Text style={styles.invoiceDate}>{formatDate(item.createdAt)}</Text>
                    </View>
                  </View>
                </View>
              </View>
              <View style={styles.invoiceRowRight}>
                <Text style={styles.invoiceAmount}>{formatCurrency(item.calculations.total)}</Text>
                <View style={[styles.invoiceBadge, { backgroundColor: isSale ? '#ECFDF5' : Colors.light.highlightBg }]}>
                  <Text style={[styles.invoiceBadgeText, { color: isSale ? Colors.light.success : Colors.light.tint }]}>
                    {isSale ? 'SALE' : item.status === 'submitted' ? 'QUOTE' : item.status.toUpperCase()}
                  </Text>
                </View>
                <ChevronRight size={14} color={Colors.light.border} />
              </View>
            </TouchableOpacity>
          );
        })
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: client.name,
          headerStyle: { backgroundColor: Colors.light.headerBg },
          headerTintColor: '#fff',
        }}
      />

      {isDesktop ? (
        <View style={styles.desktopLayout}>
          <ScrollView style={styles.desktopLeft} contentContainerStyle={styles.desktopLeftContent} showsVerticalScrollIndicator={false}>
            {infoPanel}
          </ScrollView>
          <ScrollView style={styles.desktopRight} contentContainerStyle={styles.desktopRightContent} showsVerticalScrollIndicator={false}>
            {invoicesPanel}
          </ScrollView>
        </View>
      ) : (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.mobileContent}>
          {infoPanel}
          {invoicesPanel}
        </ScrollView>
      )}

      {/* Edit Modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setEditModalVisible(false)}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalKAV}
          >
            <Pressable style={styles.modalCard} onPress={() => {}}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit Client</Text>
                <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                  <X size={22} color={Colors.light.textSecondary} />
                </TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.fieldLabel}>Status</Text>
                <View style={styles.statusRow}>
                  {STATUS_OPTIONS.map((s) => {
                    const sst = STATUS_STYLE[s];
                    const selected = form.status === s;
                    return (
                      <TouchableOpacity
                        key={s}
                        style={[styles.statusOption, selected && { backgroundColor: sst.bg, borderColor: sst.text }]}
                        onPress={() => setForm((f) => ({ ...f, status: s }))}
                      >
                        <Text style={[styles.statusOptionText, selected && { color: sst.text, fontWeight: '700' as const }]}>
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
                  placeholder="Company or school"
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
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditModalVisible(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSaveEdit}>
                  <Text style={styles.saveBtnText}>Save Changes</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {/* More Menu */}
      {moreMenuVisible && (
        <TouchableOpacity
          style={styles.moreOverlay}
          activeOpacity={1}
          onPress={() => setMoreMenuVisible(false)}
        >
          <View style={styles.moreMenu}>
            <View style={styles.moreMenuHeader}>
              <Text style={styles.moreMenuTitle}>Options</Text>
              <TouchableOpacity onPress={() => setMoreMenuVisible(false)}>
                <X size={20} color={Colors.light.text} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.moreMenuItem} onPress={handleCreateEstimate}>
              <Plus size={18} color={Colors.light.text} />
              <Text style={styles.moreMenuItemText}>Create Estimate</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.moreMenuItem} onPress={handleDelete}>
              <Trash2 size={18} color={Colors.light.error} />
              <Text style={[styles.moreMenuItemText, { color: Colors.light.error }]}>Delete Customer</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  notFound: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  notFoundText: {
    fontSize: 16,
    color: Colors.light.textSecondary,
  },
  backBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: Colors.light.tint,
    borderRadius: 8,
  },
  backBtnText: {
    color: '#fff',
    fontWeight: '600' as const,
  },
  scrollView: {
    flex: 1,
  },
  mobileContent: {
    padding: 16,
    gap: 16,
  },
  desktopLayout: {
    flex: 1,
    flexDirection: 'row',
  },
  desktopLeft: {
    width: 300,
    borderRightWidth: 1,
    borderRightColor: Colors.light.border,
    backgroundColor: Colors.light.surface,
  },
  desktopLeftContent: {
    padding: 20,
  },
  desktopRight: {
    flex: 1,
  },
  desktopRightContent: {
    padding: 20,
  },
  infoPanel: {
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  avatarLarge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.light.tint,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarInitialLarge: {
    fontSize: 30,
    fontWeight: '800' as const,
    color: '#fff',
  },
  clientNameLarge: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: Colors.light.text,
    textAlign: 'center',
  },
  orgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  clientOrgLarge: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    fontWeight: '500' as const,
  },
  statusBadge: {
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: Colors.light.border,
    marginVertical: 14,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  contactText: {
    fontSize: 14,
    color: Colors.light.text,
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  notesText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    lineHeight: 18,
    alignSelf: 'flex-start',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    width: '100%',
    justifyContent: 'center',
  },
  statBox: {
    alignItems: 'center',
    gap: 4,
    flex: 1,
    backgroundColor: Colors.light.background,
    borderRadius: 10,
    padding: 12,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: Colors.light.text,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    fontWeight: '500' as const,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 9,
    width: '100%',
    justifyContent: 'center',
    marginTop: 4,
  },
  editBtnText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#fff',
  },
  moreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.light.background,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 9,
    width: '100%',
    justifyContent: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  moreBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
  },
  memberSince: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginTop: 12,
    textAlign: 'center',
  },
  invoicesPanel: {
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
    overflow: 'hidden',
  },
  invoicesPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  invoicesPanelTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  newEstimateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 7,
  },
  newEstimateBtnText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#fff',
  },
  emptyInvoices: {
    alignItems: 'center',
    paddingVertical: 50,
    gap: 10,
    paddingHorizontal: 20,
  },
  emptyInvoicesTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  emptyInvoicesText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  invoiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  invoiceRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  invoiceStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  invoiceInfo: {
    flex: 1,
    minWidth: 0,
  },
  invoiceProject: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  invoiceMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  invoiceNum: {
    fontSize: 12,
    color: Colors.light.tint,
    fontWeight: '600' as const,
  },
  invoiceDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  invoiceDate: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  invoiceRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  invoiceAmount: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  invoiceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  invoiceBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
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
  moreOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  moreMenu: {
    backgroundColor: Colors.light.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 34,
  },
  moreMenuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  moreMenuTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  moreMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  moreMenuItemText: {
    fontSize: 15,
    color: Colors.light.text,
    fontWeight: '500' as const,
  },
});
