import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import PageBackHeader from '@/components/PageBackHeader';
import { Plus, Save, X, AlertTriangle } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useQuotes } from '@/contexts/QuotesContext';
import { useUser } from '@/contexts/UserContext';
import { FormInput } from '@/components/FormInput';
import { DateInput } from '@/components/DateInput';
import { SegmentedControl } from '@/components/SegmentedControl';
import { ToggleButton } from '@/components/ToggleButton';
import { LineItemCard } from '@/components/LineItemCard';
import { CalculationDisplay } from '@/components/CalculationDisplay';
import { Toast } from '@/components/Toast';
import {
  Quote,
  LineItem,
  ORDER_TYPES,
  OrderType,
  EMPTY_SIZES,
} from '@/types/quote';
import {
  calculateQuote,
  generateId,
} from '@/utils/quoteCalculations';
import { useBreakpoint } from '@/hooks/useBreakpoint';

const createEmptyLineItem = (): LineItem => ({
  id: generateId(),
  designName: '',
  applicator: 'Katalyst Ko Printshop',
  product: 'NL6210 — Next Level CVC Crew',
  productColor: 'Black',
  apparelProvider: "McCreary's",
  serviceStyle: 'Direct to Film',
  location1: '',
  location2: '',
  locationDetails: '',
  sizes: { ...EMPTY_SIZES },
  productCostEach: 0,
  serviceCostEach: 0,
  serviceFeeEach: 0,
  markupEach: 0,
});

export default function EditQuoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { allQuotes, isLoading: quotesLoading, updateQuoteAsync } = useQuotes();
  const { currentUserId, isOrgAdmin } = useUser();
  const { isMobile } = useBreakpoint();

  const originalQuote = useMemo(() => {
    return allQuotes.find((q) => q.id === id);
  }, [allQuotes, id]);

  // Permission guard — only kick out if data has loaded and the check is valid
  useEffect(() => {
    if (!originalQuote) return;
    if (!isOrgAdmin() && originalQuote.userId && originalQuote.userId !== currentUserId) {
      router.back();
    }
  }, [originalQuote?.id]);

  const isCompleted = originalQuote?.status === 'completed';

  const [personOrganization, setPersonOrganization] = useState('');
  const [projectName, setProjectName] = useState('');
  const [orderType, setOrderType] = useState<OrderType>('New');
  const [orderDate, setOrderDate] = useState('');
  const [inHandsDate, setInHandsDate] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([createEmptyLineItem()]);
  const [hasOnlineFee, setHasOnlineFee] = useState(false);
  const [hasSalesTax, setHasSalesTax] = useState(false);
  const [hasCardFee, setHasCardFee] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [completedModalVisible, setCompletedModalVisible] = useState(false);
  const [editingUnlocked, setEditingUnlocked] = useState(false);

  // Show the confirmation modal whenever a completed project finishes loading
  useEffect(() => {
    if (isLoaded && isCompleted && !editingUnlocked) {
      setCompletedModalVisible(true);
    }
  }, [isLoaded, isCompleted, editingUnlocked]);

  // Re-init if the same edit screen is re-used for a different id
  useEffect(() => {
    setIsLoaded(false);
    setEditingUnlocked(false);
    setCompletedModalVisible(false);
  }, [id]);

  useEffect(() => {
    if (originalQuote && !isLoaded) {
      setPersonOrganization(originalQuote.personOrganization);
      setProjectName(originalQuote.projectName);
      setOrderType(originalQuote.orderType);
      setOrderDate(originalQuote.orderDate);
      setInHandsDate(originalQuote.inHandsDate);
      setInvoiceNumber(originalQuote.invoiceNumber);
      setLineItems(
        originalQuote.lineItems.length > 0
          ? originalQuote.lineItems.map(item => ({ ...item, sizes: { ...item.sizes }, markupEach: item.markupEach || 0 }))
          : [createEmptyLineItem()]
      );
      setHasOnlineFee(originalQuote.hasOnlineFee);
      setHasSalesTax(originalQuote.hasSalesTax);
      setHasCardFee(originalQuote.hasCardFee);
      setIsLoaded(true);
    }
  }, [originalQuote, isLoaded]);

  // Recalculate from current form state; fall back to saved calculations so we
  // never block a save just because quantities happen to total zero.
  const calculations = useMemo(
    () => calculateQuote(lineItems, hasOnlineFee, hasSalesTax, hasCardFee)
         ?? (isLoaded ? originalQuote?.calculations ?? null : null),
    [lineItems, hasOnlineFee, hasSalesTax, hasCardFee, isLoaded, originalQuote?.calculations]
  );

  const handleAddLineItem = useCallback(() => {
    setLineItems((prev) => [...prev, createEmptyLineItem()]);
  }, []);

  const handleUpdateLineItem = useCallback((id: string, updated: LineItem) => {
    setLineItems((prev) => prev.map((li) => (li.id === id ? updated : li)));
  }, []);

  const handleDeleteLineItem = useCallback((id: string) => {
    setLineItems((prev) => {
      if (prev.length === 1) {
        Alert.alert('Cannot Delete', 'You must have at least one line item.');
        return prev;
      }
      return prev.filter((li) => li.id !== id);
    });
  }, []);

  const doSave = useCallback(async () => {
    if (!originalQuote) {
      Alert.alert('Error', 'Original quote not found.');
      return;
    }

    const updatedQuote: Quote = {
      ...originalQuote,
      personOrganization: personOrganization.trim(),
      projectName: projectName.trim(),
      orderType,
      orderDate,
      inHandsDate,
      invoiceNumber,
      lineItems,
      hasOnlineFee,
      hasSalesTax,
      hasCardFee,
      calculations: calculations ?? originalQuote.calculations,
    };

    setIsSaving(true);
    try {
      await updateQuoteAsync(updatedQuote);
      setToastMessage('Changes saved successfully!');
      setToastVisible(true);
      setTimeout(() => {
        router.back();
      }, 1000);
    } catch (err) {
      Alert.alert('Save Failed', 'Could not save your changes. Please check your connection and try again.');
    } finally {
      setIsSaving(false);
    }
  }, [
    personOrganization, projectName, orderType, orderDate, inHandsDate,
    invoiceNumber, lineItems, hasOnlineFee, hasSalesTax, hasCardFee,
    calculations, originalQuote, updateQuoteAsync, router,
  ]);

  const handleSave = useCallback(() => {
    if (!personOrganization.trim()) {
      Alert.alert('Missing Info', 'Please enter a person or organization name.');
      return;
    }
    if (!projectName.trim()) {
      Alert.alert('Missing Info', 'Please enter a project name.');
      return;
    }
    doSave();
  }, [personOrganization, projectName, doSave]);

  const handleCancel = useCallback(() => {
    router.back();
  }, [router]);

  // Loading state — data hasn't arrived from server yet
  if (!originalQuote && quotesLoading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Edit' }} />
        <View style={styles.notFound}>
          <ActivityIndicator size="large" color={Colors.light.tint} />
          <Text style={[styles.notFoundText, { marginTop: 12 }]}>Loading quote…</Text>
        </View>
      </View>
    );
  }

  // Not found after data loaded
  if (!originalQuote) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Edit' }} />
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>Quote not found</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const statusLabel = {
    quoting: 'Quoting', needs_review: 'In Review', quoted: 'Quoted',
    active: 'In Production', production_started: 'In Production',
    completed: 'Completed', paid: 'Paid', invoice_sent: 'Invoice Sent',
  }[originalQuote.status] ?? 'Quote';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Toast
        visible={toastVisible}
        message={toastMessage}
        type="success"
        onHide={() => setToastVisible(false)}
      />
      <Stack.Screen
        options={{
          title: `Edit — ${statusLabel}`,
          headerStyle: { backgroundColor: Colors.light.headerBg },
          headerTintColor: '#fff',
        }}
      />
      <PageBackHeader title="Edit Quote" />

      {/* Completed project confirmation — centered modal, shown before any editing */}
      <Modal
        visible={completedModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => { setCompletedModalVisible(false); router.back(); }}
      >
        <View style={styles.completedOverlay}>
          <View style={styles.completedCard}>
            <View style={styles.completedIconRing}>
              <AlertTriangle size={26} color="#D97706" />
            </View>
            <Text style={styles.completedCardTitle}>
              Editing this may change finalized data such as final quotes, pricing, quantities, etc.
            </Text>
            <Text style={styles.completedCardSub}>
              Proceed carefully. Changes take effect immediately when you save.
            </Text>
            <View style={styles.completedCardButtons}>
              <TouchableOpacity
                style={[styles.completedBtn, styles.completedBtnCancel]}
                onPress={() => { setCompletedModalVisible(false); router.back(); }}
                activeOpacity={0.8}
              >
                <Text style={styles.completedBtnCancelText}>Cancel Editing</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.completedBtn, styles.completedBtnContinue]}
                onPress={() => { setCompletedModalVisible(false); setEditingUnlocked(true); }}
                activeOpacity={0.8}
              >
                <Text style={styles.completedBtnContinueText}>Continue Editing</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Information</Text>
          <View style={styles.card}>
            <FormInput
              label="Person / Organization"
              value={personOrganization}
              onChangeText={setPersonOrganization}
              placeholder="Client name or company"
              autoTitleCase
            />
            <FormInput
              label="Project Name"
              value={projectName}
              onChangeText={setProjectName}
              placeholder="e.g., Summer Event T-Shirts"
              autoTitleCase
            />
            <SegmentedControl
              label="Order Type"
              options={ORDER_TYPES}
              value={orderType}
              onChange={setOrderType}
            />
            <View style={[styles.row, isMobile && styles.rowMobile]}>
              <View style={styles.halfField}>
                <FormInput
                  label="Order Date"
                  value={orderDate}
                  onChangeText={() => {}}
                  editable={false}
                  style={{ backgroundColor: '#F3F4F6', color: '#9CA3AF' }}
                />
              </View>
              <View style={styles.halfField}>
                <DateInput
                  label="In-Hands Date"
                  value={inHandsDate}
                  onChangeText={setInHandsDate}
                />
              </View>
            </View>
            <FormInput
              label="Invoice Number"
              value={invoiceNumber}
              onChangeText={setInvoiceNumber}
              placeholder=""
            />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Line Items</Text>
            <TouchableOpacity style={styles.addButton} onPress={handleAddLineItem}>
              <Plus size={18} color="#fff" />
              <Text style={styles.addButtonText}>Add Item</Text>
            </TouchableOpacity>
          </View>
          {lineItems.map((item, index) => (
            <LineItemCard
              key={item.id}
              item={item}
              index={index}
              onChangeItem={handleUpdateLineItem}
              onDelete={handleDeleteLineItem}
            />
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pricing & Fees</Text>
          <View style={styles.card}>
            <ToggleButton
              label="Online Fee"
              description="2.9% + $0.60"
              value={hasOnlineFee}
              onChange={setHasOnlineFee}
            />
            <ToggleButton
              label="Card Fee"
              description="3.75%"
              value={hasCardFee}
              onChange={setHasCardFee}
            />
            <ToggleButton
              label="Sales Tax"
              description="8.3%"
              value={hasSalesTax}
              onChange={setHasSalesTax}
            />
          </View>
        </View>

        {calculations && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quote Summary</Text>
            <CalculationDisplay
              calculations={calculations}
              hasOnlineFee={hasOnlineFee}
              hasSalesTax={hasSalesTax}
              hasCardFee={hasCardFee}
            />
          </View>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.cancelButton} onPress={handleCancel} disabled={isSaving}>
          <X size={18} color={Colors.light.textSecondary} />
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving
            ? <ActivityIndicator size="small" color="#fff" />
            : <Save size={18} color="#fff" />}
          <Text style={styles.saveButtonText}>{isSaving ? 'Saving…' : 'Save Changes'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  notFound: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notFoundText: {
    fontSize: 16,
    color: Colors.light.textSecondary,
  },
  backBtn: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: Colors.light.tint,
    borderRadius: 8,
  },
  backBtnText: {
    color: '#fff',
    fontWeight: '600' as const,
  },
  completedOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.52)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  completedCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 28,
    maxWidth: 440,
    width: '100%' as const,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
  },
  completedIconRing: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  completedCardTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#111827',
    textAlign: 'center' as const,
    lineHeight: 23,
    marginBottom: 10,
  },
  completedCardSub: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center' as const,
    lineHeight: 19,
    marginBottom: 26,
  },
  completedCardButtons: {
    flexDirection: 'row' as const,
    gap: 10,
    width: '100%' as const,
  },
  completedBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedBtnCancel: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  completedBtnCancelText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#374151',
  },
  completedBtnContinue: {
    backgroundColor: '#FF5A00',
  },
  completedBtnContinueText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#fff',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginBottom: 12,
  },
  card: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  rowMobile: {
    flexDirection: 'column',
    gap: 0,
  },
  halfField: {
    flex: 1,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#fff',
  },
  bottomPadding: {
    height: 100,
  },
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: Colors.light.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    gap: 8,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.tint,
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  saveButtonDisabled: {
    backgroundColor: Colors.light.border,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
});
