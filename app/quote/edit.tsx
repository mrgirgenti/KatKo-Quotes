import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Plus, Save, X } from 'lucide-react-native';
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
  const { allQuotes, updateQuote } = useQuotes();
  const { currentUserId, isOrgAdmin } = useUser();

  const originalQuote = useMemo(() => {
    return allQuotes.find((q) => q.id === id);
  }, [allQuotes, id]);

  useEffect(() => {
    if (originalQuote && !isOrgAdmin() && originalQuote.userId && originalQuote.userId !== currentUserId) {
      router.back();
    }
  }, [originalQuote, currentUserId]);

  const isSale = originalQuote?.status === 'sale';
  const itemType = isSale ? 'Sale' : 'Quote';

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

  useEffect(() => {
    if (originalQuote && !isLoaded) {
      setPersonOrganization(originalQuote.personOrganization);
      setProjectName(originalQuote.projectName);
      setOrderType(originalQuote.orderType);
      setOrderDate(originalQuote.orderDate);
      setInHandsDate(originalQuote.inHandsDate);
      setInvoiceNumber(originalQuote.invoiceNumber);
      setLineItems(originalQuote.lineItems.map(item => ({ ...item, sizes: { ...item.sizes }, markupEach: item.markupEach || 0 })));
      setHasOnlineFee(originalQuote.hasOnlineFee);
      setHasSalesTax(originalQuote.hasSalesTax);
      setHasCardFee(originalQuote.hasCardFee);
      setIsLoaded(true);
    }
  }, [originalQuote, isLoaded]);

  const calculations = useMemo(
    () => calculateQuote(lineItems, hasOnlineFee, hasSalesTax, hasCardFee),
    [lineItems, hasOnlineFee, hasSalesTax, hasCardFee]
  );

  const handleAddLineItem = useCallback(() => {
    setLineItems((prev) => [...prev, createEmptyLineItem()]);
  }, []);

  const handleUpdateLineItem = useCallback((index: number, item: LineItem) => {
    setLineItems((prev) => {
      const updated = [...prev];
      updated[index] = item;
      return updated;
    });
  }, []);

  const handleDeleteLineItem = useCallback((index: number) => {
    if (lineItems.length === 1) {
      Alert.alert('Cannot Delete', 'You must have at least one line item.');
      return;
    }
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  }, [lineItems.length]);

  const handleSave = useCallback(() => {
    if (!personOrganization.trim()) {
      Alert.alert('Missing Info', 'Please enter person/organization name.');
      return;
    }
    if (!projectName.trim()) {
      Alert.alert('Missing Info', 'Please enter project name.');
      return;
    }
    if (!calculations) {
      Alert.alert('Incomplete', 'Please add line items with quantities to calculate the quote.');
      return;
    }
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
      markupEach: 0,
      hasOnlineFee,
      hasSalesTax,
      hasCardFee,
      calculations,
    };

    updateQuote(updatedQuote);
    setToastMessage(`${itemType} updated successfully!`);
    setToastVisible(true);
    setTimeout(() => {
      router.back();
    }, 1500);
  }, [
    personOrganization,
    projectName,
    orderType,
    orderDate,
    inHandsDate,
    invoiceNumber,
    lineItems,
    hasOnlineFee,
    hasSalesTax,
    hasCardFee,
    calculations,
    originalQuote,
    updateQuote,
    router,
    itemType,
  ]);

  const handleCancel = useCallback(() => {
    Alert.alert('Discard Changes', 'Are you sure you want to discard your changes?', [
      { text: 'Keep Editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => router.back() },
    ]);
  }, [router]);

  if (!originalQuote) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Edit' }} />
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>Item not found</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

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
          title: `Edit ${itemType}`,
          headerStyle: { backgroundColor: Colors.light.headerBg },
          headerTintColor: '#fff',
        }}
      />
      
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
            <View style={styles.row}>
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
              autoTitleCase
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
              onChange={(updated) => handleUpdateLineItem(index, updated)}
              onDelete={() => handleDeleteLineItem(index)}
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

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quote Summary</Text>
          <CalculationDisplay
            calculations={calculations}
            hasOnlineFee={hasOnlineFee}
            hasSalesTax={hasSalesTax}
            hasCardFee={hasCardFee}
          />
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
          <X size={18} color={Colors.light.textSecondary} />
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveButton, !calculations && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!calculations}
        >
          <Save size={18} color="#fff" />
          <Text style={styles.saveButtonText}>Save Changes</Text>
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
  halfField: {
    flex: 1,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
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
    backgroundColor: Colors.light.success,
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
