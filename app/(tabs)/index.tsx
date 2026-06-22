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
  Image,
  Modal,
  TextInput,
  Pressable,
} from 'react-native';
import { Plus, Send, RotateCcw, X, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import { useQuotes } from '@/contexts/QuotesContext';
import { useCrm } from '@/contexts/CrmContext';
import { formatPhoneInput } from '@/utils/phone';
import { FormInput } from '@/components/FormInput';
import { DateInput } from '@/components/DateInput';
import { SegmentedControl } from '@/components/SegmentedControl';
import { ToggleButton } from '@/components/ToggleButton';
import { LineItemCard } from '@/components/LineItemCard';
import { CalculationDisplay } from '@/components/CalculationDisplay';
import { Toast } from '@/components/Toast';
import { OrgAutocomplete } from '@/components/OrgAutocomplete';
import {
  Quote,
  LineItem,
  ORDER_TYPES,
  OrderType,
  EMPTY_SIZES,
} from '@/types/quote';
import { Organization, CrmStatus, ContactRole, ORG_TYPES, CONTACT_ROLES } from '@/types/crm';
import {
  calculateQuote,
  generateId,
} from '@/utils/quoteCalculations';
import { useBreakpoint } from '@/hooks/useBreakpoint';

const LOGO_URI = '/katalyst-logo.png';

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

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const getTodayDate = () => {
  const today = new Date();
  const month = MONTH_ABBR[today.getMonth()];
  const day = String(today.getDate()).padStart(2, '0');
  const year = today.getFullYear();
  return `${month} ${day}, ${year}`;
};

const EMPTY_CRM_ORG = {
  name: '',
  type: '',
  city: '',
  state: '',
  notes: '',
  status: 'Active Client' as CrmStatus,
};

const EMPTY_CRM_CONTACT = {
  firstName: '',
  lastName: '',
  role: 'Primary Contact' as ContactRole,
  email: '',
  phone: '',
};

export default function NewQuoteScreen() {
  const { addQuote, isAdding } = useQuotes();
  const { orgs, addOrgWithContact, updateOrg, addContact, updateContact } = useCrm();
  const router = useRouter();
  const { isMobile, isDesktop } = useBreakpoint();
  const isNative = Platform.OS !== 'web';
  const params = useLocalSearchParams<{ orgName?: string; orgId?: string }>();

  const [personOrganization, setPersonOrganization] = useState('');
  const [linkedOrg, setLinkedOrg] = useState<Organization | null>(null);
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

  const [crmModalVisible, setCrmModalVisible] = useState(false);
  const [editingOrgId, setEditingOrgId] = useState<string | null>(null);
  const [crmOrgForm, setCrmOrgForm] = useState(EMPTY_CRM_ORG);
  const [crmContactForm, setCrmContactForm] = useState(EMPTY_CRM_CONTACT);
  const [showOrgTypeDropdown, setShowOrgTypeDropdown] = useState(false);

  useEffect(() => {
    if (params.orgName) {
      setPersonOrganization(params.orgName as string);
    }
  }, [params.orgName]);

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
    setLinkedOrg(null);
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

    const missingDesignNames = lineItems.filter((item) => !item.designName.trim());
    if (missingDesignNames.length > 0) {
      const lineNumbers = lineItems
        .map((item, index) => (!item.designName.trim() ? index + 1 : null))
        .filter((n) => n !== null);
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
      orgId: linkedOrg?.id,
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
      status: 'quoting',
    };

    const label = invoiceNumber ? `#${invoiceNumber} ` : '';
    setToastMessage(`Quote ${label}created! Click "Send Quote" to send to your client.`);
    setToastVisible(true);
    resetForm();
    addQuote(quote, {
      onSuccess: (saved: any) => {
        router.push(`/quote/${saved.id}` as any);
      },
    });
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
    linkedOrg,
    router,
    resetForm,
  ]);

  const handleOpenCrmModal = useCallback((typedText: string, existingOrg: Organization | null) => {
    if (existingOrg) {
      const primaryContact = existingOrg.contacts.find((c) => c.isPrimary) || existingOrg.contacts[0];
      setEditingOrgId(existingOrg.id);
      setCrmOrgForm({
        name: existingOrg.name,
        type: existingOrg.type || '',
        city: existingOrg.city || '',
        state: existingOrg.state || '',
        notes: existingOrg.notes || '',
        status: existingOrg.status,
      });
      setCrmContactForm(
        primaryContact
          ? {
              firstName: primaryContact.firstName,
              lastName: primaryContact.lastName,
              role: primaryContact.role || 'Primary Contact',
              email: primaryContact.email || '',
              phone: formatPhoneInput(primaryContact.phone || ''),
            }
          : EMPTY_CRM_CONTACT
      );
    } else {
      setEditingOrgId(null);
      setCrmOrgForm({ ...EMPTY_CRM_ORG, name: typedText });
      setCrmContactForm(EMPTY_CRM_CONTACT);
    }
    setShowOrgTypeDropdown(false);
    setCrmModalVisible(true);
  }, []);

  const handleCrmModalSave = useCallback(() => {
    if (!crmOrgForm.name.trim()) {
      setCrmModalVisible(false);
      setEditingOrgId(null);
      return;
    }
    const hasContact = crmContactForm.firstName.trim() || crmContactForm.lastName.trim();

    if (editingOrgId) {
      const existingOrg = orgs.find((o) => o.id === editingOrgId);
      if (existingOrg) {
        updateOrg({
          ...existingOrg,
          name: crmOrgForm.name.trim(),
          type: crmOrgForm.type || undefined,
          city: crmOrgForm.city || undefined,
          state: crmOrgForm.state || undefined,
          notes: crmOrgForm.notes || undefined,
          status: crmOrgForm.status,
        });
        if (hasContact) {
          const primaryContact = existingOrg.contacts.find((c) => c.isPrimary) || existingOrg.contacts[0];
          if (primaryContact) {
            updateContact({
              orgId: editingOrgId,
              contact: {
                ...primaryContact,
                firstName: crmContactForm.firstName.trim(),
                lastName: crmContactForm.lastName.trim(),
                role: crmContactForm.role || undefined,
                email: crmContactForm.email.trim() || undefined,
                phone: crmContactForm.phone.trim() || undefined,
              },
            });
          } else {
            addContact({
              orgId: editingOrgId,
              contact: {
                firstName: crmContactForm.firstName.trim(),
                lastName: crmContactForm.lastName.trim(),
                role: crmContactForm.role || undefined,
                email: crmContactForm.email.trim() || undefined,
                phone: crmContactForm.phone.trim() || undefined,
                isPrimary: true,
              },
            });
          }
        }
        setPersonOrganization(crmOrgForm.name.trim());
        const updatedOrg: Organization = {
          ...existingOrg,
          name: crmOrgForm.name.trim(),
          type: crmOrgForm.type || undefined,
          city: crmOrgForm.city || undefined,
          state: crmOrgForm.state || undefined,
          notes: crmOrgForm.notes || undefined,
          status: crmOrgForm.status,
        };
        setLinkedOrg(updatedOrg);
      }
    } else {
      addOrgWithContact({
        orgData: {
          name: crmOrgForm.name.trim(),
          type: crmOrgForm.type || undefined,
          city: crmOrgForm.city || undefined,
          state: crmOrgForm.state || undefined,
          notes: crmOrgForm.notes || undefined,
          status: crmOrgForm.status,
        },
        contactData: hasContact
          ? {
              firstName: crmContactForm.firstName.trim(),
              lastName: crmContactForm.lastName.trim(),
              role: crmContactForm.role || undefined,
              email: crmContactForm.email.trim() || undefined,
              phone: crmContactForm.phone.trim() || undefined,
              isPrimary: true,
            }
          : undefined,
      });
      setPersonOrganization(crmOrgForm.name.trim());
    }
    setCrmModalVisible(false);
    setEditingOrgId(null);
  }, [crmOrgForm, crmContactForm, editingOrgId, orgs, addOrgWithContact, updateOrg, addContact, updateContact]);

  const handleCrmModalClose = useCallback(() => {
    setCrmModalVisible(false);
    setEditingOrgId(null);
  }, []);

  const feesCard = (
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
  );

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

  const orderForm = (
    <View style={[styles.card, { zIndex: 10 }]}>
      {/* Person/Org + Project Name + Invoice on one row for tablet/desktop */}
      {!isMobile && !isNative ? (
        <View style={[styles.threeColRow, { alignItems: 'flex-start', zIndex: 10 }]}>
          <View style={[styles.thirdField, { zIndex: 10 }]}>
            <OrgAutocomplete
              value={personOrganization}
              onChangeText={setPersonOrganization}
              onSelectOrg={setLinkedOrg}
              linkedOrg={linkedOrg}
              onAddEditClient={handleOpenCrmModal}
            />
          </View>
          <View style={styles.thirdField}>
            <FormInput
              label="Project Name"
              value={projectName}
              onChangeText={setProjectName}
              placeholder="e.g., Summer Event T-Shirts"
              autoTitleCase
            />
          </View>
          <View style={styles.thirdField}>
            <FormInput
              label="Invoice Number"
              value={invoiceNumber}
              onChangeText={setInvoiceNumber}
              placeholder=""
              autoTitleCase
            />
          </View>
        </View>
      ) : (
        <>
          <OrgAutocomplete
            value={personOrganization}
            onChangeText={setPersonOrganization}
            onSelectOrg={setLinkedOrg}
            linkedOrg={linkedOrg}
            onAddEditClient={handleOpenCrmModal}
          />
          <FormInput
            label="Project Name"
            value={projectName}
            onChangeText={setProjectName}
            placeholder="e.g., Summer Event T-Shirts"
            autoTitleCase
          />
          <FormInput
            label="Invoice Number"
            value={invoiceNumber}
            onChangeText={setInvoiceNumber}
            placeholder=""
            autoTitleCase
          />
        </>
      )}
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
    </View>
  );

  const lineItemsSection = (
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
        contentContainerStyle={[
          styles.content,
          isMobile && styles.contentMobile,
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo: show on native OR mobile web (no sidebar) */}
        {(isNative || isMobile) && (
          <View style={styles.logoContainer}>
            <Image
              source={{ uri: LOGO_URI }}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
        )}

        {/* Page header */}
        {!isNative && (
          <View style={styles.pageHeader}>
            <Text style={styles.pageTitle}>New Quote</Text>
          </View>
        )}

        {/* Desktop: two-column layout */}
        {isDesktop && !isNative ? (
          <View style={styles.twoColumnLayout}>
            <View style={styles.leftColumn}>
              <View style={styles.section}>
                {orderForm}
              </View>
              {lineItemsSection}
            </View>

            <View
              style={[
                styles.rightColumn,
                // @ts-ignore
                { position: 'sticky', top: 16, alignSelf: 'flex-start' },
              ]}
            >
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Pricing & Fees</Text>
                {feesCard}
              </View>
              {summaryPanel}
            </View>
          </View>
        ) : (
          /* Tablet + Mobile: single column */
          <>
            <View style={styles.section}>
              {orderForm}
            </View>

            {lineItemsSection}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Pricing & Fees</Text>
              {feesCard}
            </View>

            {summaryPanel}
          </>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Combined Add-to-CRM modal */}
      <Modal
        visible={crmModalVisible}
        transparent
        animationType="slide"
        onRequestClose={handleCrmModalClose}
      >
        <Pressable style={crmStyles.backdrop} onPress={handleCrmModalClose}>
          <Pressable style={crmStyles.sheet} onPress={() => setShowOrgTypeDropdown(false)}>
            <View style={crmStyles.header}>
              <View>
                <Text style={crmStyles.title}>{editingOrgId ? 'Edit Client Info' : 'Add to Contacts'}</Text>
                <Text style={crmStyles.subtitle}>{editingOrgId ? 'Update this client in your CRM' : 'Save this client to your CRM'}</Text>
              </View>
              <TouchableOpacity onPress={handleCrmModalClose} hitSlop={8}>
                <X size={22} color={Colors.light.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={crmStyles.body}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* — Organization — */}
              <Text style={crmStyles.sectionLabel}>ORGANIZATION</Text>

              <Text style={crmStyles.fieldLabel}>Status</Text>
              <View style={crmStyles.statusRow}>
                {(['Cold', 'Working', 'Active Client', 'Past Client'] as CrmStatus[]).map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[crmStyles.statusChip, crmOrgForm.status === s && crmStyles.statusChipActive]}
                    onPress={() => setCrmOrgForm((f) => ({ ...f, status: s }))}
                  >
                    <Text style={[crmStyles.statusChipText, crmOrgForm.status === s && crmStyles.statusChipTextActive]}>
                      {s}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={crmStyles.fieldLabel}>Organization / Name *</Text>
              <TextInput
                style={crmStyles.input}
                value={crmOrgForm.name}
                onChangeText={(v) => setCrmOrgForm((f) => ({ ...f, name: v }))}
                placeholder="Church name, school, company…"
                placeholderTextColor={Colors.light.textSecondary}
              />

              <Text style={crmStyles.fieldLabel}>Type</Text>
              <TouchableOpacity
                style={crmStyles.dropdownBtn}
                onPress={() => setShowOrgTypeDropdown((v) => !v)}
              >
                <Text style={crmOrgForm.type ? crmStyles.dropdownBtnText : crmStyles.dropdownBtnPlaceholder}>
                  {crmOrgForm.type || 'Select type…'}
                </Text>
                {showOrgTypeDropdown
                  ? <ChevronUp size={16} color={Colors.light.textSecondary} />
                  : <ChevronDown size={16} color={Colors.light.textSecondary} />
                }
              </TouchableOpacity>
              {showOrgTypeDropdown && (
                <View style={crmStyles.dropdown}>
                  {ORG_TYPES.map((t) => (
                    <TouchableOpacity
                      key={t}
                      style={crmStyles.dropdownItem}
                      onPress={() => { setCrmOrgForm((f) => ({ ...f, type: t })); setShowOrgTypeDropdown(false); }}
                    >
                      <Text style={[crmStyles.dropdownItemText, crmOrgForm.type === t && crmStyles.dropdownItemActive]}>
                        {t}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Text style={crmStyles.fieldLabel}>City / State</Text>
              <View style={crmStyles.row}>
                <TextInput
                  style={[crmStyles.input, { flex: 2 }]}
                  value={crmOrgForm.city}
                  onChangeText={(v) => setCrmOrgForm((f) => ({ ...f, city: v }))}
                  placeholder="City"
                  placeholderTextColor={Colors.light.textSecondary}
                />
                <TextInput
                  style={[crmStyles.input, { flex: 1 }]}
                  value={crmOrgForm.state}
                  onChangeText={(v) => setCrmOrgForm((f) => ({ ...f, state: v }))}
                  placeholder="State"
                  placeholderTextColor={Colors.light.textSecondary}
                />
              </View>

              <Text style={crmStyles.fieldLabel}>Org Notes</Text>
              <TextInput
                style={[crmStyles.input, crmStyles.multilineInput]}
                value={crmOrgForm.notes}
                onChangeText={(v) => setCrmOrgForm((f) => ({ ...f, notes: v }))}
                placeholder="Any initial notes…"
                placeholderTextColor={Colors.light.textSecondary}
                multiline
                numberOfLines={2}
              />

              {/* — Primary Contact — */}
              <View style={crmStyles.divider} />
              <Text style={crmStyles.sectionLabel}>PRIMARY CONTACT (optional)</Text>

              <View style={crmStyles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={crmStyles.fieldLabel}>First Name</Text>
                  <TextInput
                    style={crmStyles.input}
                    value={crmContactForm.firstName}
                    onChangeText={(v) => setCrmContactForm((f) => ({ ...f, firstName: v }))}
                    placeholder="First"
                    placeholderTextColor={Colors.light.textSecondary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={crmStyles.fieldLabel}>Last Name</Text>
                  <TextInput
                    style={crmStyles.input}
                    value={crmContactForm.lastName}
                    onChangeText={(v) => setCrmContactForm((f) => ({ ...f, lastName: v }))}
                    placeholder="Last"
                    placeholderTextColor={Colors.light.textSecondary}
                  />
                </View>
              </View>

              <Text style={crmStyles.fieldLabel}>Role</Text>
              <View style={crmStyles.roleRow}>
                {CONTACT_ROLES.map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[crmStyles.roleChip, crmContactForm.role === r && crmStyles.roleChipActive]}
                    onPress={() => setCrmContactForm((f) => ({ ...f, role: r }))}
                  >
                    <Text style={[crmStyles.roleChipText, crmContactForm.role === r && crmStyles.roleChipTextActive]}>
                      {r}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={crmStyles.fieldLabel}>Email</Text>
              <TextInput
                style={crmStyles.input}
                value={crmContactForm.email}
                onChangeText={(v) => setCrmContactForm((f) => ({ ...f, email: v }))}
                placeholder="email@example.com"
                placeholderTextColor={Colors.light.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={crmStyles.fieldLabel}>Phone</Text>
              <TextInput
                style={crmStyles.input}
                value={crmContactForm.phone}
                onChangeText={(v) => setCrmContactForm((f) => ({ ...f, phone: formatPhoneInput(v) }))}
                placeholder="(555) 000-0000"
                placeholderTextColor={Colors.light.textSecondary}
                keyboardType="phone-pad"
              />

              <View style={{ height: 16 }} />
            </ScrollView>

            <View style={crmStyles.footer}>
              <TouchableOpacity style={crmStyles.skipBtn} onPress={handleCrmModalClose}>
                <Text style={crmStyles.skipBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[crmStyles.saveBtn, !crmOrgForm.name.trim() && crmStyles.saveBtnDisabled]}
                onPress={handleCrmModalSave}
                disabled={!crmOrgForm.name.trim()}
              >
                <Text style={crmStyles.saveBtnText}>{editingOrgId ? 'Save Changes' : 'Add to CRM'}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
    outlineStyle: 'none' as any,
  },
  content: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  contentMobile: {
    paddingHorizontal: 16,
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
    width: 380,
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
  pageHeader: {
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    marginBottom: 20,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '800' as const,
    color: Colors.light.text,
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
  threeColRow: {
    flexDirection: 'row',
    gap: 12,
  },
  thirdField: {
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

const crmStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.light.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.light.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 4,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
    marginBottom: 4,
    marginTop: 10,
  },
  input: {
    backgroundColor: Colors.light.background,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.light.text,
  },
  multilineInput: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.background,
  },
  statusChipActive: {
    borderColor: Colors.light.tint,
    backgroundColor: '#FFF4EE',
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.light.textSecondary,
  },
  statusChipTextActive: {
    color: Colors.light.tint,
    fontWeight: '700' as const,
  },
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.light.background,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dropdownBtnText: {
    fontSize: 15,
    color: Colors.light.text,
  },
  dropdownBtnPlaceholder: {
    fontSize: 15,
    color: Colors.light.textSecondary,
  },
  dropdown: {
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    marginTop: 4,
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  dropdownItemText: {
    fontSize: 14,
    color: Colors.light.text,
  },
  dropdownItemActive: {
    color: Colors.light.tint,
    fontWeight: '600' as const,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginVertical: 18,
  },
  roleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  roleChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.background,
  },
  roleChipActive: {
    borderColor: Colors.light.tint,
    backgroundColor: '#FFF4EE',
  },
  roleChipText: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.light.textSecondary,
  },
  roleChipTextActive: {
    color: Colors.light.tint,
    fontWeight: '700' as const,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
  },
  skipBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.background,
  },
  skipBtnText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
  },
  saveBtn: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: Colors.light.tint,
  },
  saveBtnDisabled: {
    backgroundColor: Colors.light.border,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#fff',
  },
});
