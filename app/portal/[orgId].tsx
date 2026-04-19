import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { CheckCircle, Send, ArrowLeft, FileText, Package, Hash, Calendar, AlignLeft, ChevronDown } from 'lucide-react-native';

const BRAND = '#FF5A00';
const BRAND_DARK = '#CC4700';

type Step = 'email' | 'form' | 'success';

interface ClientSession {
  userId: string;
  userName: string;
  userEmail: string;
  role: string;
  orgName: string;
  orgId: string;
}

const SERVICE_OPTIONS = [
  'Screen Printing',
  'Direct to Film',
  'Embroidery',
  'Promotional',
  'Not Sure / Other',
];

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <Text style={styles.fieldLabel}>
      {label}
      {required && <Text style={{ color: BRAND }}> *</Text>}
    </Text>
  );
}

export default function ClientPortal() {
  const { orgId } = useLocalSearchParams<{ orgId: string }>();

  const [step, setStep] = useState<Step>('email');
  const [session, setSession] = useState<ClientSession | null>(null);

  const [email, setEmail] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState('');

  const [form, setForm] = useState({
    title: '',
    serviceType: '',
    quantity: '',
    dueDate: '',
    description: '',
  });
  const [serviceDropdown, setServiceDropdown] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submittedId, setSubmittedId] = useState('');

  const handleEmailSubmit = useCallback(async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setEmailError('Please enter your email address.');
      return;
    }
    setEmailLoading(true);
    setEmailError('');
    try {
      const res = await fetch(`/api/portal/${orgId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEmailError(data.error || 'Could not verify your email. Please check and try again.');
        return;
      }
      setSession(data);
      setStep('form');
    } catch {
      setEmailError('Connection error. Please try again.');
    } finally {
      setEmailLoading(false);
    }
  }, [email, orgId]);

  const handleSubmit = useCallback(async () => {
    if (!form.title.trim()) {
      setSubmitError('Project title is required.');
      return;
    }
    if (!session) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch('/api/portal/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId: session.orgId,
          userId: session.userId,
          orgName: session.orgName,
          title: form.title.trim(),
          serviceType: form.serviceType || null,
          quantity: form.quantity ? parseInt(form.quantity) : null,
          dueDate: form.dueDate || null,
          description: form.description.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error || 'Submission failed. Please try again.');
        return;
      }
      setSubmittedId(data.id);
      setStep('success');
    } catch {
      setSubmitError('Connection error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [form, session]);

  const handleNewRequest = useCallback(() => {
    setForm({ title: '', serviceType: '', quantity: '', dueDate: '', description: '' });
    setSubmitError('');
    setSubmittedId('');
    setStep('form');
  }, []);

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.topBar}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>KATALYST KO</Text>
          <Text style={styles.logoSub}>Client Portal</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

          {step === 'email' && (
            <View style={styles.card}>
              <View style={styles.cardIcon}>
                <FileText size={28} color={BRAND} />
              </View>
              <Text style={styles.cardTitle}>Client Hub Access</Text>
              <Text style={styles.cardSub}>
                Enter the email address associated with your account to access your organization's portal.
              </Text>
              <View style={styles.field}>
                <FieldLabel label="Email Address" required />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="your@email.com"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onSubmitEditing={handleEmailSubmit}
                  returnKeyType="done"
                />
              </View>
              {emailError ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{emailError}</Text>
                </View>
              ) : null}
              <TouchableOpacity
                style={[styles.btn, emailLoading && styles.btnDisabled]}
                onPress={handleEmailSubmit}
                disabled={emailLoading}
              >
                {emailLoading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.btnText}>Access Portal</Text>
                }
              </TouchableOpacity>
              <Text style={styles.helpText}>
                Don't have an account? Contact Katalyst Ko to get set up.
              </Text>
            </View>
          )}

          {step === 'form' && session && (
            <View style={styles.card}>
              <View style={styles.welcomeRow}>
                <View style={styles.welcomeAvatar}>
                  <Text style={styles.welcomeAvatarText}>
                    {session.userName?.[0]?.toUpperCase() || '?'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.welcomeName}>Hi, {session.userName}!</Text>
                  <Text style={styles.welcomeOrg}>{session.orgName}</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <Text style={styles.formTitle}>Submit a Project Request</Text>
              <Text style={styles.formSub}>
                Tell us what you need and our team will follow up with a quote.
              </Text>

              <View style={styles.field}>
                <FieldLabel label="Project Title" required />
                <TextInput
                  style={styles.input}
                  value={form.title}
                  onChangeText={(v) => setForm((f) => ({ ...f, title: v }))}
                  placeholder="e.g. Spring 2025 Team Shirts"
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              <View style={styles.field}>
                <FieldLabel label="Service Type" />
                <TouchableOpacity
                  style={styles.selectBtn}
                  onPress={() => setServiceDropdown(!serviceDropdown)}
                  activeOpacity={0.8}
                >
                  <Package size={15} color={form.serviceType ? '#111827' : '#9CA3AF'} />
                  <Text style={[styles.selectBtnText, !form.serviceType && styles.selectBtnPlaceholder]}>
                    {form.serviceType || 'Select a service type'}
                  </Text>
                  <ChevronDown size={15} color="#9CA3AF" />
                </TouchableOpacity>
                {serviceDropdown && (
                  <View style={styles.dropdown}>
                    {SERVICE_OPTIONS.map((opt) => (
                      <TouchableOpacity
                        key={opt}
                        style={[styles.dropdownItem, form.serviceType === opt && styles.dropdownItemSelected]}
                        onPress={() => {
                          setForm((f) => ({ ...f, serviceType: opt }));
                          setServiceDropdown(false);
                        }}
                      >
                        <Text style={[styles.dropdownItemText, form.serviceType === opt && styles.dropdownItemTextSelected]}>
                          {opt}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.row}>
                <View style={[styles.field, { flex: 1, marginRight: 8 }]}>
                  <FieldLabel label="Estimated Quantity" />
                  <View style={styles.inputWithIcon}>
                    <Hash size={14} color="#9CA3AF" style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, styles.inputIconPadded]}
                      value={form.quantity}
                      onChangeText={(v) => setForm((f) => ({ ...f, quantity: v.replace(/\D/g, '') }))}
                      placeholder="e.g. 48"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="number-pad"
                    />
                  </View>
                </View>
                <View style={[styles.field, { flex: 1, marginLeft: 8 }]}>
                  <FieldLabel label="Due Date" />
                  <View style={styles.inputWithIcon}>
                    <Calendar size={14} color="#9CA3AF" style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, styles.inputIconPadded]}
                      value={form.dueDate}
                      onChangeText={(v) => setForm((f) => ({ ...f, dueDate: v }))}
                      placeholder="MM/DD/YYYY"
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
                </View>
              </View>

              <View style={styles.field}>
                <FieldLabel label="Project Details" />
                <Text style={styles.fieldHint}>
                  Include garment preferences, colors, design ideas, artwork notes, and any shipping/delivery details.
                </Text>
                <TextInput
                  style={[styles.input, styles.textarea]}
                  value={form.description}
                  onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
                  placeholder="Describe your project, preferred garments, colors, artwork details, delivery notes..."
                  placeholderTextColor="#9CA3AF"
                  multiline
                  numberOfLines={5}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.fileNote}>
                <Text style={styles.fileNoteTitle}>Artwork Files</Text>
                <Text style={styles.fileNoteText}>
                  Email artwork files (AI, EPS, PDF, PNG at 300dpi+) to{' '}
                  <Text style={{ color: BRAND, fontWeight: '600' }}>hello@katalystko.com</Text>
                  {' '}with your project title in the subject line.
                  Our team will link them to your submission.
                </Text>
              </View>

              {submitError ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{submitError}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[styles.btn, submitting && styles.btnDisabled]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Send size={16} color="#fff" />
                    <Text style={[styles.btnText, { marginLeft: 8 }]}>Submit Request</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => setStep('email')}
              >
                <ArrowLeft size={14} color="#6B7280" />
                <Text style={styles.backBtnText}>Not you? Switch account</Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 'success' && session && (
            <View style={styles.card}>
              <View style={styles.successIcon}>
                <CheckCircle size={40} color="#16A34A" />
              </View>
              <Text style={styles.successTitle}>Request Submitted!</Text>
              <Text style={styles.successSub}>
                Your project request has been received. The Katalyst Ko team will review it and reach
                out with next steps and a quote.
              </Text>
              <View style={styles.successRef}>
                <Text style={styles.successRefLabel}>Reference ID</Text>
                <Text style={styles.successRefValue} numberOfLines={1}>{submittedId}</Text>
              </View>
              <TouchableOpacity style={styles.btn} onPress={handleNewRequest}>
                <Text style={styles.btnText}>Submit Another Request</Text>
              </TouchableOpacity>
              <Text style={styles.helpText}>
                Questions? Email us at{' '}
                <Text style={{ color: BRAND }}>hello@katalystko.com</Text>
              </Text>
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Powered by Katalyst Ko · Client Hub</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  topBar: {
    backgroundColor: '#000000',
    paddingHorizontal: 24,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {},
  logoText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 2,
  },
  logoSub: {
    color: BRAND,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    marginTop: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    paddingVertical: 40,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 28,
    width: '100%',
    maxWidth: 520,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  cardIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    alignSelf: 'center',
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  cardSub: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
  },
  field: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  fieldHint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 6,
    lineHeight: 17,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#FAFAFA',
  },
  textarea: {
    height: 110,
    paddingTop: 11,
  },
  inputWithIcon: {
    position: 'relative',
  },
  inputIcon: {
    position: 'absolute',
    left: 12,
    top: 12,
    zIndex: 1,
  },
  inputIconPadded: {
    paddingLeft: 36,
  },
  selectBtn: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: '#FAFAFA',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectBtnText: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
  },
  selectBtnPlaceholder: {
    color: '#9CA3AF',
  },
  dropdown: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    marginTop: 4,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dropdownItemSelected: {
    backgroundColor: '#FFF7ED',
  },
  dropdownItemText: {
    fontSize: 14,
    color: '#374151',
  },
  dropdownItemTextSelected: {
    color: BRAND,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
  },
  btn: {
    backgroundColor: BRAND,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 4,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 13,
    lineHeight: 18,
  },
  helpText: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 14,
    lineHeight: 17,
  },
  welcomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  welcomeAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeAvatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  welcomeName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  welcomeOrg: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 1,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginBottom: 20,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  formSub: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 20,
    lineHeight: 19,
  },
  fileNote: {
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  fileNoteTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
    marginBottom: 4,
  },
  fileNoteText: {
    fontSize: 12,
    color: '#166534',
    lineHeight: 18,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    padding: 8,
  },
  backBtnText: {
    fontSize: 13,
    color: '#6B7280',
  },
  successIcon: {
    alignSelf: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 10,
  },
  successSub: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 20,
  },
  successRef: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  successRefLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  successRefValue: {
    fontSize: 13,
    color: '#374151',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  footer: {
    backgroundColor: '#F3F4F6',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingVertical: 12,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
});
