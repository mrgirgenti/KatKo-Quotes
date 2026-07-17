import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Image, ScrollView, ActivityIndicator, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Eye, EyeOff, Plus, X, Zap } from 'lucide-react-native';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import HubAuthShell, {
  HUB_ORANGE, HUB_WHITE, HUB_DIM, HUB_BORDER,
} from '@/components/HubAuthShell';

type Invitee = { name: string; email: string };

export default function HubRequestActivatePage() {
  const router = useRouter();
  const { email, orgId, orgName, userName } = useLocalSearchParams<{
    email: string; orgId: string; orgName: string; userName: string;
  }>();
  const { isDesktop, isTablet } = useBreakpoint();
  const wide = isDesktop || isTablet;

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [invitees, setInvitees] = useState<Invitee[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addInvitee = () => setInvitees(v => [...v, { name: '', email: '' }]);
  const removeInvitee = (i: number) => setInvitees(v => v.filter((_, j) => j !== i));
  const updateInvitee = (i: number, field: keyof Invitee, value: string) =>
    setInvitees(v => v.map((inv, j) => j === i ? { ...inv, [field]: value } : inv));

  const handleActivate = async () => {
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/hub/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, orgId, password, invitees: invitees.filter(i => i.email.trim()) }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Something went wrong.'); return; }
      router.replace(`/hub-request/pending?type=activate&orgName=${encodeURIComponent(orgName ?? '')}` as any);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const FormContent = () => (
    <View style={s.card}>
      <View style={s.orgBadge}>
        <Zap size={14} color={HUB_ORANGE} />
        <Text style={s.orgBadgeText}>Activate Hub for {orgName}</Text>
      </View>

      <Text style={s.title}>Set Up Your Access</Text>
      <Text style={s.subtitle}>
        {userName ? `Welcome, ${userName.split(' ')[0]}! ` : ''}
        Create your password to activate the Client Hub for{' '}
        <Text style={{ fontWeight: '600', color: '#111' }}>{orgName}</Text>.
      </Text>

      {error ? (
        <View style={s.errorBanner}><Text style={s.errorText}>{error}</Text></View>
      ) : null}

      <View style={s.emailRow}>
        <Text style={s.emailLabel}>Logging in as</Text>
        <Text style={s.emailVal}>{email}</Text>
      </View>

      <Text style={s.sectionLabel}>CREATE YOUR PASSWORD</Text>

      <Text style={s.label}>Password</Text>
      <View style={s.pwWrap}>
        <TextInput
          style={[s.input, { flex: 1, marginBottom: 0 }]}
          placeholder="Min. 8 characters"
          placeholderTextColor="#b8b8b8"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPw}
          autoComplete="new-password"
        />
        <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPw(v => !v)}>
          {showPw ? <EyeOff size={18} color="#aaa" /> : <Eye size={18} color="#aaa" />}
        </TouchableOpacity>
      </View>

      <Text style={[s.label, { marginTop: 14 }]}>Confirm Password</Text>
      <View style={s.pwWrap}>
        <TextInput
          style={[s.input, { flex: 1, marginBottom: 0 }]}
          placeholder="Re-enter password"
          placeholderTextColor="#b8b8b8"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry={!showConfirm}
          autoComplete="new-password"
        />
        <TouchableOpacity style={s.eyeBtn} onPress={() => setShowConfirm(v => !v)}>
          {showConfirm ? <EyeOff size={18} color="#aaa" /> : <Eye size={18} color="#aaa" />}
        </TouchableOpacity>
      </View>

      <View style={s.divider} />
      <Text style={s.sectionLabel}>INVITE TEAM MEMBERS <Text style={s.optional}>(Optional)</Text></Text>
      <Text style={s.sectionSub}>Add teammates now or do it later from your hub settings.</Text>

      {invitees.map((inv, i) => (
        <View key={i} style={s.inviteeRow}>
          <TextInput
            style={[s.input, { flex: 1, marginBottom: 0 }]}
            placeholder="Name"
            placeholderTextColor="#b8b8b8"
            value={inv.name}
            onChangeText={v => updateInvitee(i, 'name', v)}
          />
          <TextInput
            style={[s.input, { flex: 1.4, marginBottom: 0 }]}
            placeholder="Email"
            placeholderTextColor="#b8b8b8"
            value={inv.email}
            onChangeText={v => updateInvitee(i, 'email', v)}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TouchableOpacity style={s.removeBtn} onPress={() => removeInvitee(i)}>
            <X size={16} color="#999" />
          </TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity style={s.addInviteeBtn} onPress={addInvitee}>
        <Plus size={15} color={HUB_ORANGE} />
        <Text style={s.addInviteeText}>Add team member</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[s.btn, { marginTop: 24 }, loading && { opacity: 0.7 }]}
        onPress={handleActivate}
        disabled={loading}
        activeOpacity={0.85}
      >
        {loading
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={s.btnText}>ACTIVATE HUB</Text>}
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
              <Image source={require('@/assets/images/ko-logo-horizontal.png')} style={s.leftLogo} resizeMode="contain" />
              <View style={s.leftDivider} />
              <Text style={s.leftHeading}>Activate Your Hub.</Text>
              <Text style={s.leftSub}>
                Set your password and invite your team — you'll have your Client Hub live in minutes.
              </Text>
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
        <Image source={require('@/assets/images/ko-logo-horizontal.png')} style={s.mobileLogo} resizeMode="contain" />
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
  leftSub: { fontSize: 14, color: HUB_DIM, lineHeight: 22 },
  formCol: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, paddingVertical: 48 },
  mobileLogo: { width: 180, height: 54, marginBottom: 28 },
  card: {
    width: '100%', maxWidth: 500, backgroundColor: HUB_WHITE,
    borderRadius: 14, padding: 36,
    shadowColor: '#000', shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.4, shadowRadius: 32, elevation: 14,
  },
  orgBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFF4EE',
    borderRadius: 8, paddingVertical: 7, paddingHorizontal: 12, alignSelf: 'flex-start', marginBottom: 18,
  },
  orgBadgeText: { fontSize: 12, fontWeight: '700', color: HUB_ORANGE, letterSpacing: 0.3 },
  title: { fontSize: 22, fontWeight: '700', color: '#111', marginBottom: 10 },
  subtitle: { fontSize: 13, color: '#666', lineHeight: 20, marginBottom: 18 },
  errorBanner: { backgroundColor: '#FEE2E2', borderRadius: 8, padding: 12, marginBottom: 16 },
  errorText: { fontSize: 13, color: '#dc2626' },
  emailRow: { backgroundColor: '#f5f5f5', borderRadius: 8, padding: 12, marginBottom: 22 },
  emailLabel: { fontSize: 11, color: '#999', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  emailVal: { fontSize: 14, fontWeight: '600', color: '#111' },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#999', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12 },
  optional: { fontWeight: '400', color: '#bbb' },
  sectionSub: { fontSize: 12, color: '#999', marginBottom: 14, marginTop: -8 },
  label: { fontSize: 13, fontWeight: '500', color: '#444', marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: Platform.OS === 'web' ? 12 : 11,
    fontSize: 14, color: '#111', backgroundColor: '#fafafa', marginBottom: 0,
  },
  pwWrap: { flexDirection: 'row', alignItems: 'center' },
  eyeBtn: { position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' },
  divider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 22 },
  inviteeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  removeBtn: { padding: 8 },
  addInviteeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
  addInviteeText: { fontSize: 13, color: HUB_ORANGE, fontWeight: '600' },
  btn: {
    backgroundColor: HUB_ORANGE, borderRadius: 8, paddingVertical: 15, alignItems: 'center',
  },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 1 },
  backLink: { alignItems: 'center', marginTop: 16 },
  backLinkText: { fontSize: 13, color: HUB_ORANGE, fontWeight: '500' },
});
