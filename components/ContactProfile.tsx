import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Modal,
  TextInput,
  Switch,
  Pressable,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Phone, MessageSquare, Mail, Edit3, X, ChevronRight,
  Building,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { Contact, Organization, ACTIVITY_TYPE_CONFIG } from '@/types/crm';
import { useCrm } from '@/contexts/CrmContext';
import { formatPhone, formatPhoneOrNull } from '@/utils/phone';

// ── Avatar ─────────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  '#FF5A00', '#2563EB', '#7C3AED', '#16A34A',
  '#D97706', '#0891B2', '#DC2626', '#4B5563',
];
function avatarBg(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}
function initials(c: Contact) {
  return (
    (c.firstName || '').charAt(0).toUpperCase() +
    (c.lastName || '').charAt(0).toUpperCase()
  ) || '?';
}

// ── Helpers ────────────────────────────────────────────────────────────────
function SectionHeader({ label }: { label: string }) {
  return <Text style={s.sectionHeader}>{label}</Text>;
}

function FieldRow({
  label, value, link,
}: { label: string; value?: string | null; link?: string }) {
  if (!value) return null;
  return (
    <View style={s.fieldRow}>
      <Text style={s.fieldLabel}>{label}</Text>
      {link ? (
        <TouchableOpacity onPress={() => Linking.openURL(link)} activeOpacity={0.7}>
          <Text style={[s.fieldValue, s.fieldLink]}>{value}</Text>
        </TouchableOpacity>
      ) : (
        <Text style={s.fieldValue}>{value}</Text>
      )}
    </View>
  );
}

function Badge({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return (
    <View style={[s.badge, { backgroundColor: bg }]}>
      <Text style={[s.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

function QuickBtn({
  icon, label, onPress, disabled,
}: { icon: React.ReactNode; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <TouchableOpacity
      style={[s.quickBtn, disabled && s.quickBtnOff]}
      onPress={onPress}
      activeOpacity={disabled ? 1 : 0.75}
      disabled={disabled}
    >
      {icon}
      <Text style={[s.quickBtnLabel, disabled && s.quickBtnLabelOff]}>{label}</Text>
    </TouchableOpacity>
  );
}

function ActivityItem({ entry }: { entry: any }) {
  const cfg = ACTIVITY_TYPE_CONFIG[entry.type as keyof typeof ACTIVITY_TYPE_CONFIG];
  if (!cfg) return null;
  return (
    <View style={s.actRow}>
      <View style={[s.actDot, { backgroundColor: cfg.color }]} />
      <View style={s.actBody}>
        <Text style={s.actType}>{cfg.label}</Text>
        {entry.body ? (
          <Text style={s.actText} numberOfLines={2}>{entry.body}</Text>
        ) : null}
        <Text style={s.actDate}>
          {new Date(entry.createdAt).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
          })}
        </Text>
      </View>
    </View>
  );
}

// ── Relationship Reminders (auto-hides if all empty) ───────────────────────
function RelationshipReminders({ c }: { c: Contact }) {
  const items = [
    { emoji: '🎂', label: 'Birthday', val: c.birthday },
    { emoji: '💍', label: 'Anniversary', val: c.weddingAnniversary },
    { emoji: '☕', label: 'Favorite Drink', val: c.favoriteDrink },
    { emoji: '🏈', label: 'Favorite Team', val: c.favoriteSportsTeam },
    { emoji: '👕', label: 'Shirt Size', val: c.shirtSize },
    { emoji: '🧢', label: 'Hat Size', val: c.hatSize },
  ].filter((i) => i.val);

  if (items.length === 0) return null;
  return (
    <View style={s.card}>
      <SectionHeader label="Relationship Reminders" />
      <View style={s.remGrid}>
        {items.map((i) => (
          <View key={i.label} style={s.remChip}>
            <Text style={s.remEmoji}>{i.emoji}</Text>
            <View>
              <Text style={s.remLabel}>{i.label}</Text>
              <Text style={s.remVal}>{i.val}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Edit Modal ─────────────────────────────────────────────────────────────
type EditForm = {
  firstName: string; lastName: string; title: string; preferredName: string;
  email: string; phone: string; mobilePhone: string; officePhone: string;
  extension: string; preferredContactMethod: string;
  department: string; role: string; isPrimary: boolean;
  notes: string;
  birthday: string; weddingAnniversary: string; spouseName: string;
  children: string; favoriteSportsTeam: string; favoriteDrink: string;
  shirtSize: string; hatSize: string; personalNotes: string;
  preferredDecorationMethod: string; preferredApparelBrand: string;
  typicalOrderSize: string; taxExempt: boolean; purchaseOrderRequired: boolean;
  preferredShippingMethod: string;
};

function initForm(c: Contact): EditForm {
  return {
    firstName: c.firstName || '',
    lastName: c.lastName || '',
    title: c.title || '',
    preferredName: c.preferredName || '',
    email: c.email || '',
    phone: c.phone || '',
    mobilePhone: c.mobilePhone || '',
    officePhone: c.officePhone || '',
    extension: c.extension || '',
    preferredContactMethod: c.preferredContactMethod || '',
    department: c.department || '',
    role: c.role || '',
    isPrimary: c.isPrimary || false,
    notes: c.notes || '',
    birthday: c.birthday || '',
    weddingAnniversary: c.weddingAnniversary || '',
    spouseName: c.spouseName || '',
    children: c.children || '',
    favoriteSportsTeam: c.favoriteSportsTeam || '',
    favoriteDrink: c.favoriteDrink || '',
    shirtSize: c.shirtSize || '',
    hatSize: c.hatSize || '',
    personalNotes: c.personalNotes || '',
    preferredDecorationMethod: c.preferredDecorationMethod || '',
    preferredApparelBrand: c.preferredApparelBrand || '',
    typicalOrderSize: c.typicalOrderSize || '',
    taxExempt: c.taxExempt || false,
    purchaseOrderRequired: c.purchaseOrderRequired || false,
    preferredShippingMethod: c.preferredShippingMethod || '',
  };
}

function EditContactModal({
  contact, orgId, visible, onClose, onSaved,
}: {
  contact: Contact;
  orgId: string;
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { updateContact } = useCrm();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<EditForm>(() => initForm(contact));

  useEffect(() => {
    if (visible) setForm(initForm(contact));
  }, [visible, contact]);

  const set = useCallback(
    <K extends keyof EditForm>(key: K, val: EditForm[K]) =>
      setForm((f) => ({ ...f, [key]: val })),
    [],
  );

  const handleSave = async () => {
    if (!form.firstName.trim()) {
      Alert.alert('Required', 'First name is required.');
      return;
    }
    setSaving(true);
    try {
      await updateContact({
        orgId,
        contact: {
          ...contact,
          ...form,
          phone: formatPhoneOrNull(form.phone) ?? form.phone,
          mobilePhone: formatPhoneOrNull(form.mobilePhone) ?? form.mobilePhone,
          officePhone: formatPhoneOrNull(form.officePhone) ?? form.officePhone,
        } as Contact,
      });
      onSaved();
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to save contact.');
    } finally {
      setSaving(false);
    }
  };

  function Field({
    label, field, placeholder, multiline, keyboardType,
  }: {
    label: string; field: keyof EditForm; placeholder?: string;
    multiline?: boolean; keyboardType?: any;
  }) {
    return (
      <View style={e.field}>
        <Text style={e.label}>{label}</Text>
        <TextInput
          style={[e.input, multiline && e.inputMulti]}
          value={String(form[field] ?? '')}
          onChangeText={(v) => set(field as any, v as any)}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          multiline={multiline}
          keyboardType={keyboardType}
          autoCorrect={false}
        />
      </View>
    );
  }

  function Toggle({ label, field }: { label: string; field: 'isPrimary' | 'taxExempt' | 'purchaseOrderRequired' }) {
    return (
      <View style={e.toggleRow}>
        <Text style={e.toggleLabel}>{label}</Text>
        <Switch
          value={Boolean(form[field])}
          onValueChange={(v) => set(field, v)}
          trackColor={{ false: '#E5E7EB', true: Colors.light.primary }}
          thumbColor="#fff"
        />
      </View>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={e.overlay} onPress={onClose} />
      <View style={e.sheet}>
        <View style={e.sheetHead}>
          <Text style={e.sheetTitle}>Edit Contact</Text>
          <TouchableOpacity onPress={onClose} activeOpacity={0.7} hitSlop={8}>
            <X size={22} color="#000" />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={e.body}
          contentContainerStyle={e.bodyContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={e.sec}>BASIC INFO</Text>
          <View style={e.row2}>
            <View style={{ flex: 1 }}><Field label="First Name *" field="firstName" /></View>
            <View style={{ width: 10 }} />
            <View style={{ flex: 1 }}><Field label="Last Name" field="lastName" /></View>
          </View>
          <Field label="Job Title" field="title" />
          <Field label="Preferred Name" field="preferredName" />
          <Toggle label="Primary Contact" field="isPrimary" />

          <Text style={e.sec}>CONTACT INFORMATION</Text>
          <Field label="Email" field="email" placeholder="email@example.com" keyboardType="email-address" />
          <Field label="Mobile Phone" field="mobilePhone" placeholder="(555) 000-0000" keyboardType="phone-pad" />
          <Field label="Office Phone" field="officePhone" placeholder="(555) 000-0000" keyboardType="phone-pad" />
          <Field label="Extension" field="extension" placeholder="e.g. 123" keyboardType="numeric" />
          <Field label="Direct Phone (legacy)" field="phone" placeholder="(555) 000-0000" keyboardType="phone-pad" />
          <Field label="Preferred Contact Method" field="preferredContactMethod" placeholder="e.g. Email, Mobile" />
          <Field label="Department" field="department" />
          <Field label="Role" field="role" />

          <Text style={e.sec}>PERSONAL DETAILS</Text>
          <Field label="Birthday (MM-DD)" field="birthday" placeholder="e.g. 03-15" />
          <Field label="Wedding Anniversary (MM-DD)" field="weddingAnniversary" placeholder="e.g. 06-10" />
          <Field label="Spouse / Partner Name" field="spouseName" />
          <Field label="Children" field="children" placeholder="e.g. Emma (7), Jack (5)" />
          <Field label="Favorite Sports Team" field="favoriteSportsTeam" />
          <Field label="Favorite Drink" field="favoriteDrink" />
          <Field label="Shirt Size" field="shirtSize" placeholder="e.g. L, XL, 2XL" />
          <Field label="Hat Size" field="hatSize" placeholder="e.g. L/XL" />
          <Field label="Personal Notes" field="personalNotes" multiline placeholder="Notes about the person..." />

          <Text style={e.sec}>BUSINESS DETAILS</Text>
          <Field label="Preferred Decoration Method" field="preferredDecorationMethod" placeholder="e.g. Screen Print, DTF" />
          <Field label="Preferred Apparel Brand" field="preferredApparelBrand" placeholder="e.g. Gildan, Next Level" />
          <Field label="Typical Order Size" field="typicalOrderSize" placeholder="e.g. 50-100 pcs" />
          <Toggle label="Tax Exempt" field="taxExempt" />
          <Toggle label="Purchase Order Required" field="purchaseOrderRequired" />
          <Field label="Preferred Shipping Method" field="preferredShippingMethod" placeholder="e.g. Will Call, UPS Ground" />

          <Text style={e.sec}>RELATIONSHIP NOTES</Text>
          <Field label="Notes" field="notes" multiline placeholder="Ongoing relationship notes..." />

          <View style={{ height: 32 }} />
        </ScrollView>

        <View style={e.footer}>
          <TouchableOpacity style={e.cancelBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={e.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[e.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            <Text style={e.saveText}>{saving ? 'Saving…' : 'Save Changes'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Main ContactProfile component ──────────────────────────────────────────
interface ContactProfileProps {
  contact: Contact;
  org: Organization | { id: string; name: string };
  onClose?: () => void;
  onSaved?: () => void;
}

export default function ContactProfile({
  contact, org, onClose, onSaved,
}: ContactProfileProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  // Local copy so the profile reflects saves without waiting for a refetch
  const [local, setLocal] = useState<Contact>(contact);

  useEffect(() => {
    setLocal(contact);
  }, [contact]);

  const c = local;
  const fullName = `${c.firstName} ${c.lastName}`.trim() || 'Unknown Contact';
  const primaryPhone = c.mobilePhone || c.phone || c.officePhone;
  const orgId = c.organizationId || (org as Organization).id;

  const handleCall = useCallback(() => {
    if (primaryPhone) Linking.openURL('tel:' + primaryPhone.replace(/\D/g, ''));
  }, [primaryPhone]);
  const handleText = useCallback(() => {
    if (primaryPhone) Linking.openURL('sms:' + primaryPhone.replace(/\D/g, ''));
  }, [primaryPhone]);
  const handleEmail = useCallback(() => {
    if (c.email) Linking.openURL('mailto:' + c.email);
  }, [c.email]);

  const goOrg = useCallback(() => {
    if (onClose) onClose();
    router.push(`/crm/${orgId}` as any);
  }, [orgId, onClose, router]);

  // Personal section auto-hide
  const hasPersonal = [
    c.birthday, c.weddingAnniversary, c.spouseName, c.children,
    c.favoriteSportsTeam, c.favoriteDrink, c.shirtSize, c.hatSize, c.personalNotes,
  ].some(Boolean);

  // Activity filtered by this contact
  const allActivity = (org as Organization).activityLog || [];
  const contactActivity = allActivity.filter((a) => a.contactId === c.id).slice(0, 5);

  const handleEditSaved = useCallback(() => {
    onSaved?.();
    setEditOpen(false);
  }, [onSaved]);

  return (
    <View style={s.root}>
      {/* Top bar (only shown in slide-over) */}
      {onClose && (
        <View style={s.topBar}>
          <Text style={s.topBarTitle}>Contact Profile</Text>
          <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={s.closeBtn} hitSlop={8}>
            <X size={20} color="#000" />
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header Card ── */}
        <View style={s.headerCard}>
          <View style={[s.avatar, { backgroundColor: avatarBg(fullName) }]}>
            <Text style={s.avatarText}>{initials(c)}</Text>
          </View>

          <Text style={s.name}>{fullName}</Text>
          {c.title ? <Text style={s.titleText}>{c.title}</Text> : null}
          {c.preferredName ? (
            <Text style={s.preferredName}>Goes by "{c.preferredName}"</Text>
          ) : null}

          <TouchableOpacity style={s.orgRow} onPress={goOrg} activeOpacity={0.7}>
            <Building size={13} color={Colors.light.textSecondary} />
            <Text style={s.orgName} numberOfLines={1}>{org.name}</Text>
            <ChevronRight size={14} color={Colors.light.textSecondary} />
          </TouchableOpacity>

          {/* Status badges */}
          <View style={s.badgeRow}>
            {c.isPrimary && (
              <Badge label="Primary Contact" bg="#FFF0E8" fg={Colors.light.primary} />
            )}
            {c.role ? <Badge label={c.role} bg="#F3F4F6" fg="#374151" /> : null}
            {c.hubStatus && c.hubStatus !== 'No Access' ? (
              <Badge
                label={`Hub: ${c.hubStatus}`}
                bg={
                  c.hubStatus === 'Active' ? '#DCFCE7'
                  : c.hubStatus === 'Invited' ? '#FEF3C7'
                  : '#FEE2E2'
                }
                fg={
                  c.hubStatus === 'Active' ? '#166534'
                  : c.hubStatus === 'Invited' ? '#92400E'
                  : '#991B1B'
                }
              />
            ) : null}
          </View>

          {/* Quick actions */}
          <View style={s.quickRow}>
            <QuickBtn
              icon={<Phone size={15} color={primaryPhone ? '#fff' : '#9CA3AF'} />}
              label="Call"
              onPress={handleCall}
              disabled={!primaryPhone}
            />
            <QuickBtn
              icon={<MessageSquare size={15} color={primaryPhone ? '#fff' : '#9CA3AF'} />}
              label="Text"
              onPress={handleText}
              disabled={!primaryPhone}
            />
            <QuickBtn
              icon={<Mail size={15} color={c.email ? '#fff' : '#9CA3AF'} />}
              label="Email"
              onPress={handleEmail}
              disabled={!c.email}
            />
            <QuickBtn
              icon={<Edit3 size={15} color="#fff" />}
              label="Edit"
              onPress={() => setEditOpen(true)}
            />
          </View>
        </View>

        {/* ── Contact Information ── */}
        <View style={s.card}>
          <SectionHeader label="Contact Information" />
          <FieldRow
            label="Email"
            value={c.email}
            link={c.email ? `mailto:${c.email}` : undefined}
          />
          <FieldRow
            label="Mobile"
            value={c.mobilePhone ? formatPhone(c.mobilePhone) : undefined}
            link={c.mobilePhone ? `tel:${c.mobilePhone.replace(/\D/g, '')}` : undefined}
          />
          <FieldRow
            label="Office"
            value={c.officePhone ? formatPhone(c.officePhone) : undefined}
            link={c.officePhone ? `tel:${c.officePhone.replace(/\D/g, '')}` : undefined}
          />
          <FieldRow
            label="Phone"
            value={c.phone ? formatPhone(c.phone) : undefined}
            link={c.phone ? `tel:${c.phone.replace(/\D/g, '')}` : undefined}
          />
          {c.extension ? <FieldRow label="Extension" value={c.extension} /> : null}
          <FieldRow label="Preferred Contact" value={c.preferredContactMethod} />
          <FieldRow label="Preferred Name" value={c.preferredName} />
          <FieldRow label="Department" value={c.department} />
        </View>

        {/* ── Personal Details (auto-hide if all empty) ── */}
        {hasPersonal && (
          <View style={s.card}>
            <SectionHeader label="Personal Details" />
            <FieldRow label="Birthday" value={c.birthday} />
            <FieldRow label="Anniversary" value={c.weddingAnniversary} />
            <FieldRow label="Spouse / Partner" value={c.spouseName} />
            <FieldRow label="Children" value={c.children} />
            <FieldRow label="Favorite Sports Team" value={c.favoriteSportsTeam} />
            <FieldRow label="Favorite Drink" value={c.favoriteDrink} />
            <FieldRow label="Shirt Size" value={c.shirtSize} />
            <FieldRow label="Hat Size" value={c.hatSize} />
            {c.personalNotes ? (
              <View style={s.noteBlock}>
                <Text style={s.fieldLabel}>Personal Notes</Text>
                <Text style={s.noteText}>{c.personalNotes}</Text>
              </View>
            ) : null}
          </View>
        )}

        {/* ── Business Details ── */}
        <View style={s.card}>
          <SectionHeader label="Business Details" />
          <FieldRow label="Organization" value={org.name} />
          <FieldRow label="Role" value={c.role} />
          <FieldRow label="Decoration Method" value={c.preferredDecorationMethod} />
          <FieldRow label="Preferred Brand" value={c.preferredApparelBrand} />
          <FieldRow label="Typical Order Size" value={c.typicalOrderSize} />
          {c.taxExempt ? <FieldRow label="Tax Exempt" value="Yes" /> : null}
          {c.purchaseOrderRequired ? (
            <FieldRow label="PO Required" value="Yes" />
          ) : null}
          <FieldRow label="Preferred Shipping" value={c.preferredShippingMethod} />
        </View>

        {/* ── Relationship Notes ── */}
        <View style={s.card}>
          <SectionHeader label="Relationship Notes" />
          {c.notes ? (
            <Text style={s.noteText}>{c.notes}</Text>
          ) : (
            <Text style={s.emptyText}>
              No notes yet. Tap Edit to add relationship notes about this contact.
            </Text>
          )}
        </View>

        {/* ── Recent Activity ── */}
        <View style={s.card}>
          <View style={s.sectionRow}>
            <SectionHeader label="Recent Activity" />
            <TouchableOpacity onPress={goOrg} activeOpacity={0.7}>
              <Text style={s.viewAllLink}>View Organization →</Text>
            </TouchableOpacity>
          </View>
          {contactActivity.length === 0 ? (
            <Text style={s.emptyText}>
              No recorded activity for this contact yet.
            </Text>
          ) : (
            contactActivity.map((a) => <ActivityItem key={a.id} entry={a} />)
          )}
        </View>

        {/* ── Relationship Reminders (auto-hides if empty) ── */}
        <RelationshipReminders c={c} />

        <View style={{ height: 48 }} />
      </ScrollView>

      <EditContactModal
        contact={c}
        orgId={orgId}
        visible={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={handleEditSaved}
      />
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  topBarTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
  },
  closeBtn: {
    padding: 4,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
  },
  // Header card
  headerCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 20,
    alignItems: 'center',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
  },
  name: {
    fontSize: 20,
    fontWeight: '800',
    color: '#000',
    textAlign: 'center',
    marginBottom: 2,
  },
  titleText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginBottom: 2,
  },
  preferredName: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 6,
  },
  orgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
    marginBottom: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignSelf: 'center',
  },
  orgName: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.light.textSecondary,
    maxWidth: 240,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
    marginBottom: 16,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  // Quick actions
  quickRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  quickBtn: {
    flex: 1,
    backgroundColor: Colors.light.primary,
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
    gap: 4,
  },
  quickBtnOff: {
    backgroundColor: '#F3F4F6',
  },
  quickBtnLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  quickBtnLabelOff: {
    color: '#9CA3AF',
  },
  // Cards
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    gap: 2,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#000',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  viewAllLink: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.primary,
  },
  // Fields
  fieldRow: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.textSecondary,
    flex: 0,
    minWidth: 100,
  },
  fieldValue: {
    fontSize: 13,
    color: '#000',
    flex: 1,
    textAlign: 'right',
  },
  fieldLink: {
    color: Colors.light.primary,
    textDecorationLine: 'underline',
  },
  // Notes
  noteBlock: {
    paddingTop: 6,
    gap: 4,
  },
  noteText: {
    fontSize: 13,
    color: '#1F2937',
    lineHeight: 20,
  },
  emptyText: {
    fontSize: 13,
    color: '#9CA3AF',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  // Activity
  actRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  actDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 4,
  },
  actBody: {
    flex: 1,
    gap: 2,
  },
  actType: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
  },
  actText: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 17,
  },
  actDate: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },
  // Relationship reminders
  remGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  remChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: '45%',
    flex: 1,
  },
  remEmoji: {
    fontSize: 20,
  },
  remLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  remVal: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000',
  },
});

// ── Edit modal styles ──────────────────────────────────────────────────────
const e = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '90%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#000',
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 20,
    gap: 4,
  },
  sec: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6B7280',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 18,
    marginBottom: 8,
  },
  row2: {
    flexDirection: 'row',
  },
  field: {
    marginBottom: 12,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4B5563',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: '#000',
    backgroundColor: '#fff',
  },
  inputMulti: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingTop: 10,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    marginBottom: 6,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000',
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  saveBtn: {
    flex: 2,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: Colors.light.primary,
    alignItems: 'center',
  },
  saveText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
