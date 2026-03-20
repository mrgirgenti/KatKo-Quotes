import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { Plus, Send, RotateCcw } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useQuotes } from '@/contexts/QuotesContext';
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
  product: 'Next Level 6210',
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

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const getTodayDate = () => {
  const today = new Date();
  const month = MONTH_ABBR[today.getMonth()];
  const day = String(today.getDate()).padStart(2, '0');
  const year = today.getFullYear();
  return `${month} ${day}, ${year}`;
};

const isWeb = Platform.OS === 'web';

export default function NewQuoteScreen() {
  const { addQuote, isAdding } = useQuotes();

  const [personOrganization, setPersonOrganization] = useState('');
  const [projectName, setProjectName] = useState('');
  const [orderType, setOrderType] = useState<OrderType>('New');
  const [orderDate, setOrderDate] = useState(getTodayDate());
  const [inHandsDate, setInHandsDate] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([createEmptyLineItem()]);
  const [hasOnlineFee, setHasOnlineFee] = useState(true);
  const [hasSalesTax, setHasSalesTax] = useState(false);
  const [hasCardFee, setHasCardFee] = useState(true);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

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

  const resetForm = useCallback(() => {
    setPersonOrganization('');
    setProjectName('');
    setOrderType('New');
    setOrderDate(getTodayDate());
    setInHandsDate('');
    setInvoiceNumber('');
    setLineItems([createEmptyLineItem()]);
    setHasOnlineFee(true);
    setHasSalesTax(false);
    setHasCardFee(true);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!personOrganization.trim()) {
      Alert.alert('Missing Info', 'Please enter person/organization name.');
      return;
    }
    if (!projectName.trim()) {
      Alert.alert('Missing Info', 'Please enter project name.');
      return;
    }
    
    const missingDesignNames = lineItems.filter((item, index) => !item.designName.trim());
    if (missingDesignNames.length > 0) {
      const lineNumbers = lineItems
        .map((item, index) => !item.designName.trim() ? index + 1 : null)
        .filter(n => n !== null);
      Alert.alert(
        'Missing Design Name',
        `Please enter a design name for Line Item${lineNumbers.length > 1 ? 's' : ''} ${lineNumbers.join(', ')}.`
      );
      return;
    }
    
    if (!calculations) {
      Alert.alert('Incomplete', 'Please add line items with quantities to calculate the quote.');
      return;
    }

    const quote: Quote = {
      id: generateId(),
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
      createdAt: new Date().toISOString(),
      status: 'submitted',
    };

    addQuote(quote);
    setToastMessage(`Quote ${invoiceNumber ? '#' + invoiceNumber : ''} has been submitted!`);
    setToastVisible(true);
    resetForm();
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
    addQuote,
    resetForm,
  ]);

  const summaryPanel = (
    <>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quote Summary</Text>
        <CalculationDisplay
          calculations={calculations}
          lineItems={lineItems}
          hasOnlineFee={hasOnlineFee}
          hasSalesTax={hasSalesTax}
          hasCardFee={hasCardFee}
        />
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.resetButton}
          onPress={() => {
            Alert.alert('Reset Form', 'Are you sure you want to clear all fields?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Reset', style: 'destructive', onPress: resetForm },
            ]);
          }}
        >
          <RotateCcw size={18} color={Colors.light.textSecondary} />
          <Text style={styles.resetButtonText}>Reset</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.submitButton, (!calculations || isAdding) && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={!calculations || isAdding}
        >
          <Send size={18} color="#fff" />
          <Text style={styles.submitButtonText}>
            {isAdding ? 'Submitting...' : 'Submit Quote'}
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );

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
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoContainer}>
          <Image
            source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/4xwcbfcj6r2usqk7tds89' }}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {isWeb ? (
          <View style={styles.twoColumnLayout}>
            {/* Left column: form */}
            <View style={styles.leftColumn}>
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
                      <DateInput
                        label="Order Date"
                        value={orderDate}
                        onChangeText={setOrderDate}
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

            </View>

            {/* Right column: sticky pricing + summary */}
            <View
              style={[
                styles.rightColumn,
                // @ts-ignore - position: 'sticky' is web-only
                { position: 'sticky', top: 16, alignSelf: 'flex-start' },
              ]}
            >
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
              {summaryPanel}
            </View>
          </View>
        ) : (
          <>
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
                    <DateInput
                      label="Order Date"
                      value={orderDate}
                      onChangeText={setOrderDate}
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

            {summaryPanel}
          </>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>
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
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  twoColumnLayout: {
    flexDirection: 'row',
    gap: 24,
    alignItems: 'flex-start',
  },
  leftColumn: {
    flex: 1,
    minWidth: 0,
  },
  rightColumn: {
    width: 420,
    flexShrink: 0,
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
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    marginBottom: 24,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.surface,
    gap: 8,
  },
  resetButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
  },
  submitButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.tint,
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  submitButtonDisabled: {
    backgroundColor: Colors.light.border,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
  bottomPadding: {
    height: 40,
  },
  logoContainer: {
    alignItems: 'center',
    paddingVertical: 16,
    marginBottom: 8,
  },
  logo: {
    width: 220,
    height: 80,
  },
});
