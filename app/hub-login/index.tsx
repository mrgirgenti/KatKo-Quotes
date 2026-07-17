import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Image, ScrollView, ActivityIndicator, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Eye, EyeOff, Check,
  FileText, Layers, CheckCircle2, Download, Receipt,
  ClipboardList, Users, Bookmark, MessageCircle, Plus,
} from 'lucide-react-native';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import HubAuthShell, {
  HUB_ORANGE, HUB_WHITE, HUB_DIM, HUB_BORDER,
} from '@/components/HubAuthShell';

type OrgOption = { orgId: string; orgName: string; logoUrl: string | null; role: string };

const FEATURES: { icon: React.ComponentType<{ size: number; color: string }>; label: string }[] = [
  { icon: FileText, label: 'Quotes & Proposals' },
  { icon: ClipboardList, label: 'Order History' },
  { icon: Layers, label: 'Projects & Production' },
  { icon: Users, label: 'Team Access' },
  { icon: CheckCircle2, label: 'Artwork Approvals' },
  { icon: Bookmark, label: 'Brand Assets' },
  { icon: Download, label: 'Files & Downloads' },
  { icon: MessageCircle, label: 'Messages' },
  { icon: Receipt, label: 'Invoices & Payments' },
  { icon: Plus, label: 'And More' },
];

const BENEFITS = [
  'Approve artwork online',
  'Track project progress',
  'Download invoices',
  'Access your brand assets',
  'View past orders',
  'Invite your team',
];

function saveSession(session: object, rememberMe: boolean) {
  if (typeof window === 'undefined') return;
  const expiresAt = Date.now() + (rememberMe ? 30 : 1) * 24 * 60 * 60 * 1000;
  const stored = JSON.stringify({ ...session, expiresAt });
  if (rememberMe) {
    localStorage.setItem('hubSession', stored);
    sessionStorage.removeItem('hubSession');
  } else {
    sessionStorage.setItem('hubSession', stored);
    localStorage.removeItem('hubSession');
  }
}

export default function HubLoginPage() {
  const router = useRouter();
  const { isDesktop, isTablet } = useBreakpoint();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orgs, setOrgs] = useState<OrgOption[] | null>(null);
  const [pendingSession, setPendingSession] = useState<object | null>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/hub/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password, rememberMe }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Login failed. Please try again.');
        return;
      }
      if (data.orgs) {
        setOrgs(data.orgs);
        setPendingSession(data.session);
        return;
      }
      saveSession(data.session, rememberMe);
      router.replace(`/portal/${data.orgId}` as any);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOrgSelect = (orgId: string) => {
    if (!pendingSession || !orgs) return;
    const org = orgs.find(o => o.orgId === orgId);
    if (!org) return;
    saveSession({ ...pendingSession, orgId, orgName: org.orgName }, rememberMe);
    router.replace(`/portal/${orgId}` as any);
  };

  const FormBody = () => {
    if (orgs) {
      return (
        <>
          <Text style={c.title}>Choose Your Hub</Text>
          <Text style={c.subtitle}>You're linked to multiple Client Hubs.</Text>
          <View style={{ marginTop: 16 }}>
            {orgs.map(org => (
              <TouchableOpacity
                key={org.orgId}
                style={c.orgRow}
                onPress={() => handleOrgSelect(org.orgId)}
                activeOpacity={0.75}
              >
                <View style={c.orgAvatar}>
                  {org.logoUrl
                    ? <Image source={{ uri: org.logoUrl }} style={{ width: 40, height: 40, borderRadius: 6 }} />
                    : <Text style={c.orgAvatarLetter}>{org.orgName[0]?.toUpperCase()}</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={c.orgName}>{org.orgName}</Text>
                  <Text style={c.orgRole}>{org.role === 'ORG_ADMIN' ? 'Super Admin' : 'Member'}</Text>
                </View>
                <Check size={18} color={HUB_ORANGE} />
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={c.backLink} onPress={() => { setOrgs(null); setPendingSession(null); }}>
            <Text style={c.backLinkText}>← Back to login</Text>
          </TouchableOpacity>
        </>
      );
    }

    return (
      <>
        <Text style={c.title}>Log in to Your Client Hub</Text>

        {error ? (
          <View style={c.errorBanner}>
            <Text style={c.errorText}>{error}</Text>
          </View>
        ) : null}

        <Text style={c.label}>Email Address</Text>
        <TextInput
          style={c.input}
          placeholder="you@email.com"
          placeholderTextColor="#b8b8b8"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          onSubmitEditing={handleLogin}
        />

        <Text style={c.label}>Password</Text>
        <View style={c.passwordWrap}>
          <TextInput
            style={[c.input, { flex: 1, marginBottom: 0 }]}
            placeholder="••••••••••••"
            placeholderTextColor="#b8b8b8"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoComplete="current-password"
            onSubmitEditing={handleLogin}
          />
          <TouchableOpacity style={c.eyeBtn} onPress={() => setShowPassword(v => !v)}>
            {showPassword ? <EyeOff size={18} color="#aaa" /> : <Eye size={18} color="#aaa" />}
          </TouchableOpacity>
        </View>

        <View style={c.rememberRow}>
          <TouchableOpacity style={c.checkboxRow} onPress={() => setRememberMe(v => !v)} activeOpacity={0.7}>
            <View style={[c.checkbox, rememberMe && c.checkboxOn]}>
              {rememberMe ? <Check size={11} color="#fff" strokeWidth={3} /> : null}
            </View>
            <Text style={c.rememberLabel}>Remember me</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/hub-login/forgot' as any)}>
            <Text style={c.forgotLink}>Forgot your password?</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[c.loginBtn, loading && { opacity: 0.7 }]}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={c.loginBtnText}>LOG IN</Text>}
        </TouchableOpacity>

        <View style={c.requestRow}>
          <Text style={c.requestLabel}>Don't have access yet?</Text>
          <TouchableOpacity onPress={() => router.push('/hub-request' as any)}>
            <Text style={c.requestLink}> REQUEST AN INVITATION</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  };

  if (isDesktop || isTablet) {
    return (
      <HubAuthShell>
        <View style={s.desktopRow}>
          {/* ─── Left Brand Panel ─── */}
          <View style={s.leftPanel}>
            <Text style={s.hubLabel}>CLIENT HUB</Text>
            <Text style={s.welcomeHeading}>WELCOME{'\n'}BACK.</Text>
            <Text style={s.welcomeSub}>Your projects. Your brand. All in one place.</Text>
            <View style={s.divider} />
            <View style={s.featureGrid}>
              {FEATURES.map((f, i) => {
                const Icon = f.icon;
                return (
                  <View key={i} style={s.featureItem}>
                    <Icon size={13} color={HUB_ORANGE} />
                    <Text style={s.featureLabel}>{f.label}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* ─── Center Form Card ─── */}
          <View style={s.centerCol}>
            <View style={s.card}>
              <FormBody />
            </View>
          </View>

          {/* ─── Right Info Panel (desktop only) ─── */}
          {isDesktop ? (
            <View style={s.rightPanel}>
              <Text style={s.rightHeading}>WHAT IS THE{'\n'}CLIENT HUB?</Text>
              <Text style={s.rightSub}>Your central hub for everything we create together.</Text>
              <View style={{ marginTop: 20 }}>
                {BENEFITS.map((b, i) => (
                  <View key={i} style={s.benefitItem}>
                    <View style={s.benefitCheck}>
                      <Check size={11} color="#fff" strokeWidth={3} />
                    </View>
                    <Text style={s.benefitLabel}>{b}</Text>
                  </View>
                ))}
              </View>
              <View style={s.divider} />
              <Text style={s.rightTagline}>Built to make your{'\n'}experience better.</Text>
            </View>
          ) : null}
        </View>
      </HubAuthShell>
    );
  }

  // ─── Mobile ───
  return (
    <HubAuthShell scroll>
      <View style={s.mobilePage}>
        <Image
          source={require('@/assets/images/ko-logo-horizontal.png')}
          style={s.mobileLogo}
          resizeMode="contain"
        />
        <View style={s.card}>
          <FormBody />
        </View>
        <Text style={s.mobileFooter}>© Katalyst Ko</Text>
      </View>
    </HubAuthShell>
  );
}

// ─── Card interior styles ───
const c = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '700', color: '#111', marginBottom: 20 },
  subtitle: { fontSize: 13, color: '#666', marginBottom: 16 },
  errorBanner: { backgroundColor: '#FEE2E2', borderRadius: 8, padding: 12, marginBottom: 16 },
  errorText: { fontSize: 13, color: '#dc2626' },
  label: { fontSize: 13, fontWeight: '500', color: '#444', marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: Platform.OS === 'web' ? 12 : 11,
    fontSize: 14, color: '#111', backgroundColor: '#fafafa', marginBottom: 16,
  },
  passwordWrap: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  eyeBtn: { position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' },
  rememberRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22,
  },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox: {
    width: 18, height: 18, borderRadius: 4, borderWidth: 1.5,
    borderColor: '#ccc', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff',
  },
  checkboxOn: { backgroundColor: HUB_ORANGE, borderColor: HUB_ORANGE },
  rememberLabel: { fontSize: 13, color: '#555' },
  forgotLink: { fontSize: 13, color: HUB_ORANGE, fontWeight: '500' },
  loginBtn: {
    backgroundColor: HUB_ORANGE, borderRadius: 8, paddingVertical: 15,
    alignItems: 'center', marginBottom: 20,
  },
  loginBtnText: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 1 },
  requestRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' },
  requestLabel: { fontSize: 13, color: '#777' },
  requestLink: { fontSize: 13, color: HUB_ORANGE, fontWeight: '700', letterSpacing: 0.4 },
  orgRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 13, paddingHorizontal: 12, borderRadius: 10,
    borderWidth: 1, borderColor: '#e8e8e8', marginBottom: 10, backgroundColor: '#fafafa',
  },
  orgAvatar: {
    width: 40, height: 40, borderRadius: 8, backgroundColor: HUB_ORANGE,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  orgAvatarLetter: { color: '#fff', fontWeight: '700', fontSize: 16 },
  orgName: { fontSize: 14, fontWeight: '600', color: '#111' },
  orgRole: { fontSize: 12, color: '#888', marginTop: 2 },
  backLink: { marginTop: 16, alignItems: 'center' },
  backLinkText: { fontSize: 13, color: HUB_ORANGE },
});

// ─── Shell / layout styles ───
const s = StyleSheet.create({
  desktopRow: {
    flex: 1, flexDirection: 'row', alignItems: 'stretch',
    ...(Platform.OS === 'web' ? { minHeight: '100vh' as any } : {}),
  },
  leftPanel: {
    width: 290, paddingHorizontal: 36, paddingVertical: 52,
    justifyContent: 'center',
    borderRightWidth: 1, borderRightColor: HUB_BORDER,
  },
  hubLabel: {
    fontSize: 11, fontWeight: '700', color: HUB_ORANGE,
    letterSpacing: 3, textTransform: 'uppercase', marginBottom: 12,
  },
  welcomeHeading: {
    fontSize: 48, fontWeight: '900', color: HUB_WHITE,
    lineHeight: 52, marginBottom: 14, letterSpacing: -1,
  },
  welcomeSub: { fontSize: 13, color: HUB_DIM, lineHeight: 20, marginBottom: 24 },
  divider: { height: 1, backgroundColor: HUB_BORDER, marginVertical: 20 },
  featureGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  featureItem: {
    width: '50%', flexDirection: 'row', alignItems: 'center',
    gap: 7, paddingVertical: 6,
  },
  featureLabel: { fontSize: 12, color: '#cccccc', flex: 1 },
  centerCol: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 40, paddingVertical: 48,
  },
  card: {
    width: '100%', maxWidth: 430, backgroundColor: HUB_WHITE,
    borderRadius: 14, padding: 36,
    shadowColor: '#000', shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.4, shadowRadius: 32, elevation: 14,
  },
  rightPanel: {
    width: 248, paddingHorizontal: 32, paddingVertical: 52,
    justifyContent: 'center',
    borderLeftWidth: 1, borderLeftColor: HUB_BORDER,
  },
  rightHeading: {
    fontSize: 13, fontWeight: '800', color: HUB_ORANGE,
    letterSpacing: 1.5, textTransform: 'uppercase', lineHeight: 22, marginBottom: 12,
  },
  rightSub: { fontSize: 13, color: HUB_DIM, lineHeight: 20, marginBottom: 4 },
  benefitItem: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  benefitCheck: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: HUB_ORANGE,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  benefitLabel: { fontSize: 13, color: '#d8d8d8', flex: 1 },
  rightTagline: { fontSize: 13, color: HUB_DIM, lineHeight: 20, fontStyle: 'italic' },
  mobilePage: { flex: 1, alignItems: 'center', paddingHorizontal: 20, paddingVertical: 48 },
  mobileLogo: { width: 200, height: 60, marginBottom: 28 },
  mobileFooter: { marginTop: 24, fontSize: 12, color: '#3a3a3a' },
});
