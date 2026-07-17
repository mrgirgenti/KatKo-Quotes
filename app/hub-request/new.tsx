import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Image, ScrollView, ActivityIndicator, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Plus, X, Send } from 'lucide-react-native';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import HubAuthShell, {
  HUB_ORANGE, HUB_WHITE, HUB_DIM, HUB_BORDER,
} from '@/components/HubAuthShell';
import { formatPhoneInput } from '@/utils/phone';

type TeamMember = { name: string; email: string };

export default function HubRequestNewPage() {
  const router = useRouter();
  const { email: prefillEmail } = useLocalSearchParams<{ email: string }>();
  const { isDesktop, isTablet } = useBreakpoint();
  const wide = isDesktop || isTablet;

  const [companyName, setCompanyName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState(prefillEmail ?? '');
  const [phone, setPhone] = useState('');
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addMember = () => setTeam(v => [...v, { name: '', email: '' }]);
  const removeMember = (i: number) => setTeam(v => v.filter((_, j) => j !== i));
  const updateMember = (i: number, field: keyof TeamMember, value: string) =>
    setTeam(v => v.map((m, j) => j === i ? { ...m, [field]: value } : m));

  const handleSubmit = async () => {
    if (!companyName.trim()) { setError('Company name is required.'); return; }
    if (!firstName.trim()) { setError('Your first name is required.'); return; }
    if (!email.trim() || !email.includes('@')) { setError('A valid email is required.'); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/hub/new-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: companyName.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || null,
          team: team.filter(m => m.email.trim()),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Something went wrong.'); return; }
      router.replace(`/hub-request/pending?type=new&orgName=${encodeURIComponent(companyName.trim())}` as any);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const FormContent = () => (
    <View style={s.card}>
      <Text style={s.title}>Request a Client Hub</Text>
      <Text style={s.subtitle}>
        Fill out the form below and we'll review your request. We'll reach out to get everything set up.
      </Text>

      {error ? (
        <View style={s.errorBanner}><Text style={s.errorText}>{error}</Text></View>
      ) : null}

      <Text style={s.sectionLabel}>YOUR COMPANY</Text>

      <Text style={s.label}>Company Name <Text style={s.required}>*</Text></Text>
      <TextInput
        style={s.input}
        placeholder="Acme Apparel Co."
        placeholderTextColor="#b8b8b8"
        value={companyName}
        onChangeText={setCompanyName}
      />

      <Text style={s.sectionLabel}>YOUR INFORMATION</Text>

      <View style={s.nameRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>First Name <Text style={s.required}>*</Text></Text>
          <TextInput
            style={[s.input, { marginBottom: 0 }]}
            placeholder="First"
            placeholderTextColor="#b8b8b8"
            value={firstName}
            onChangeText={setFirstName}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>Last Name</Text>
          <TextInput
            style={[s.input, { marginBottom: 0 }]}
            placeholder="Last"
            placeholderTextColor="#b8b8b8"
            value={lastName}
            onChangeText={setLastName}
          />
        </View>
      </View>

      <Text style={[s.label, { marginTop: 16 }]}>Email Address <Text style={s.required}>*</Text></Text>
      <TextInput
        style={s.input}
        placeholder="you@company.com"
        placeholderTextColor="#b8b8b8"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <Text style={s.label}>Phone Number</Text>
      <TextInput
        style={s.input}
        placeholder="(555) 000-0000"
        placeholderTextColor="#b8b8b8"
        value={phone}
        onChangeText={v => setPhone(formatPhoneInput(v))}
        keyboardType="phone-pad"
      />

      <View style={s.divider} />
      <Text style={s.sectionLabel}>TEAM MEMBERS <Text style={s.optional}>(Optional)</Text></Text>
      <Text style={s.sectionSub}>Add people you'd like to have access to your hub.</Text>

      {team.map((m, i) => (
        <View key={i} style={s.memberRow}>
          <TextInput
            style={[s.input, { flex: 1, marginBottom: 0 }]}
            placeholder="Name"
            placeholderTextColor="#b8b8b8"
            value={m.name}
            onChangeText={v => updateMember(i, 'name', v)}
          />
          <TextInput
            style={[s.input, { flex: 1.5, marginBottom: 0 }]}
            placeholder="Email"
            placeholderTextColor="#b8b8b8"
            value={m.email}
            onChangeText={v => updateMember(i, 'email', v)}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TouchableOpacity style={s.removeBtn} onPress={() => removeMember(i)}>
            <X size={16} color="#999" />
          </TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity style={s.addMemberBtn} onPress={addMember}>
        <Plus size={15} color={HUB_ORANGE} />
        <Text style={s.addMemberText}>Add team member</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[s.btn, { marginTop: 28 }, loading && { opacity: 0.7 }]}
        onPress={handleSubmit}
        disabled={loading}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <View style={s.btnInner}>
            <Send size={15} color="#fff" />
            <Text style={s.btnText}>SUBMIT REQUEST</Text>
          </View>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={s.backLink} onPress={() => router.push('/hub-request' as any)}>
        <Text style={s.backLinkText}>← Use a different email</Text>
      </TouchableOpacity>
    </View>
  );

  if (wide) {
    return (
      <HubAuthShell>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={s.desktopScroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={s.desktopRow}>
            <View style={s.leftPanel}>
              <Image source={require('@/assets/images/ko-logo-new.webp')} style={s.leftLogo} resizeMode="contain" />
              <View style={s.leftDivider} />
              <Text style={s.leftHeading}>Let's Get{'\n'}Started.</Text>
              <Text style={s.leftSub}>
                Tell us a bit about yourself and your company. We review every request and will be in touch shortly.
              </Text>
              <View style={s.reviewNote}>
                <Text style={s.reviewNoteText}>
                  We're selective about access — this ensures every client gets personalized attention.
                </Text>
              </View>
            </View>
            <View style={s.formCol}>
              <FormContent />
            </View>
          </View>
        </ScrollView>
      </HubAuthShell>
    );
  }

  return (
    <HubAuthShell scroll>
      <View style={s.mobilePage}>
        <Image source={require('@/assets/images/ko-logo-new.webp')} style={s.mobileLogo} resizeMode="contain" />
        <FormContent />
      </View>
    </HubAuthShell>
  );
}

const s = StyleSheet.create({
  desktopScroll: { flexGrow: 1 },
  desktopRow: {
    flex: 1, flexDirection: 'row', alignItems: 'stretch',
    ...(Platform.OS === 'web' ? { minHeight: '100vh' as any } : {}),
  },
  mobilePage: { flex: 1, alignItems: 'center', paddingHorizontal: 20, paddingVertical: 48 },
  leftPanel: {
    width: 320, paddingHorizontal: 40, paddingVertical: 52, justifyContent: 'center',
    borderRightWidth: 1, borderRightColor: HUB_BORDER,
  },
  leftLogo: { width: 180, height: 54, marginBottom: 28 },
  leftDivider: { height: 1, backgroundColor: HUB_BORDER, marginBottom: 28 },
  leftHeading: { fontSize: 36, fontWeight: '800', color: HUB_WHITE, marginBottom: 14, lineHeight: 42 },
  leftSub: { fontSize: 14, color: HUB_DIM, lineHeight: 22, marginBottom: 20 },
  reviewNote: { backgroundColor: 'rgba(255,90,0,0.1)', borderLeftWidth: 3, borderLeftColor: HUB_ORANGE, borderRadius: 4, padding: 12 },
  reviewNoteText: { fontSize: 12, color: '#e0b090', lineHeight: 18 },
  formCol: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, paddingVertical: 48 },
  mobileLogo: { width: 180, height: 54, marginBottom: 28 },
  card: {
    width: '100%', maxWidth: 520, backgroundColor: HUB_WHITE,
    borderRadius: 14, padding: 36,
    shadowColor: '#000', shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.4, shadowRadius: 32, elevation: 14,
  },
  title: { fontSize: 22, fontWeight: '700', color: '#111', marginBottom: 10 },
  subtitle: { fontSize: 13, color: '#666', lineHeight: 20, marginBottom: 24 },
  errorBanner: { backgroundColor: '#FEE2E2', borderRadius: 8, padding: 12, marginBottom: 16 },
  errorText: { fontSize: 13, color: '#dc2626' },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#aaa', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12 },
  sectionSub: { fontSize: 12, color: '#999', marginBottom: 12, marginTop: -6 },
  optional: { fontWeight: '400', color: '#ccc' },
  required: { color: HUB_ORANGE },
  label: { fontSize: 13, fontWeight: '500', color: '#444', marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: Platform.OS === 'web' ? 12 : 11,
    fontSize: 14, color: '#111', backgroundColor: '#fafafa', marginBottom: 16,
  },
  nameRow: { flexDirection: 'row', gap: 12 },
  divider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 20 },
  memberRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 10 },
  removeBtn: { padding: 8 },
  addMemberBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
  addMemberText: { fontSize: 13, color: HUB_ORANGE, fontWeight: '600' },
  btn: {
    backgroundColor: HUB_ORANGE, borderRadius: 8, paddingVertical: 15, alignItems: 'center',
  },
  btnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 1 },
  backLink: { alignItems: 'center', marginTop: 16 },
  backLinkText: { fontSize: 13, color: HUB_ORANGE, fontWeight: '500' },
});
