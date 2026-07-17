import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Image, ScrollView, ActivityIndicator, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Eye, EyeOff, Check, ArrowRight,
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
  const [needsSetup, setNeedsSetup] = useState(false);
  const [orgs, setOrgs] = useState<OrgOption[] | null>(null);
  const [pendingSession, setPendingSession] = useState<object | null>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    setError(null);
    setNeedsSetup(false);
    try {
      const res = await fetch('/api/hub/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password, rememberMe }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Login failed. Please try again.');
        if (data.needsSetup) setNeedsSetup(true);
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

  const CardContent = () => {
    if (orgs) {
      return (
        <>
          <Text style={c.title}>Choose Your Hub</Text>
          <Text style={c.subtitle}>You're linked to multiple Client Hubs.</Text>
          <View style={{ marginTop: 14 }}>
            {orgs.map(org => (
              <TouchableOpacity
                key={org.orgId}
                style={c.orgRow}
                onPress={() => handleOrgSelect(org.orgId)}
                activeOpacity={0.75}
              >
                <View style={c.orgAvatar}>
                  {org.logoUrl
                    ? <Image source={{ uri: org.logoUrl }} style={{ width: 42, height: 42, borderRadius: 6 }} />
                    : <Text style={c.orgAvatarLetter}>{org.orgName[0]?.toUpperCase()}</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={c.orgName}>{org.orgName}</Text>
                  <Text style={c.orgRole}>{org.role === 'ORG_ADMIN' ? 'Super Admin' : 'Member'}</Text>
                </View>
                <ArrowRight size={16} color={HUB_ORANGE} />
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

        {needsSetup ? (
          <View style={c.setupBanner}>
            <Text style={c.setupTitle}>Password not set up yet</Text>
            <Text style={c.setupBody}>
              Use "Forgot your password?" below to set one up — it only takes a minute.
            </Text>
            <TouchableOpacity style={c.setupCta} onPress={() => router.push('/hub-login/forgot' as any)}>
              <Text style={c.setupCtaText}>Set up my password</Text>
              <ArrowRight size={13} color={HUB_ORANGE} />
            </TouchableOpacity>
          </View>
        ) : error ? (
          <View style={c.errorBanner}>
            <Text style={c.errorText}>{error}</Text>
          </View>
        ) : null}

        <Text style={c.label}>Email Address</Text>
        <TextInput
          style={c.input}
          placeholder="you@email.com"
          placeholderTextColor="#b0b0b0"
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
            placeholderTextColor="#b0b0b0"
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
            <Image
              source={require('@/assets/images/ko-logo-horizontal.png')}
              style={s.panelLogo}
              resizeMode="contain"
            />
            <View style={s.leftContent}>
              <Text style={s.hubLabel}>CLIENT HUB</Text>
              <Text style={s.welcomeHeading}>WELCOME{'\n'}BACK.</Text>
              <Text style={s.welcomeSub}>Your projects. Your brand.{'\n'}All in one place.</Text>
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
          </View>

          {/* ─── Center Form Card ─── */}
          <View style={s.centerCol}>
            <View style={s.card}>
              <CardContent />
            </View>
          </View>

          {/* ─── Right Info Panel (desktop only) ─── */}
          {isDesktop ? (
            <View style={s.rightPanel}>
              <View style={s.rightContent}>
                <Text style={s.rightHeading}>WHAT IS THE{'\n'}CLIENT HUB?</Text>
                <Text style={s.rightSub}>
                  Your central hub for everything we create together.
                </Text>
                <View style={s.rightDivider} />
                <View>
                  {BENEFITS.map((b, i) => (
                    <View key={i} style={s.benefitItem}>
                      <View style={s.benefitCheck}>
                        <Check size={10} color="#fff" strokeWidth={3} />
                      </View>
                      <Text style={s.benefitLabel}>{b}</Text>
                    </View>
                  ))}
                </View>
                <View style={s.rightDivider} />
                <Text style={s.rightTagline}>Built to make your{'\n'}experience better.</Text>
              </View>
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
          <CardContent />
        </View>
        <Text style={s.mobileFooter}>© Katalyst Ko</Text>
      </View>
    </HubAuthShell>
  );
}

// ─── Card (white) styles ──────────────────────────────────────────────────────
const c = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '700', color: '#111', marginBottom: 18 },
  subtitle: { fontSize: 13, color: '#666', marginBottom: 14 },
  setupBanner: {
    backgroundColor: '#FFF8F0', borderWidth: 1, borderColor: '#FFD9B3',
    borderRadius: 10, padding: 14, marginBottom: 18,
  },
  setupTitle: { fontSize: 13, fontWeight: '700', color: '#c84b00', marginBottom: 5 },
  setupBody: { fontSize: 13, color: '#7a4020', lineHeight: 19, marginBottom: 10 },
  setupCta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  setupCtaText: { fontSize: 13, fontWeight: '700', color: HUB_ORANGE },
  errorBanner: { backgroundColor: '#FEE2E2', borderRadius: 8, padding: 12, marginBottom: 16 },
  errorText: { fontSize: 13, color: '#dc2626' },
  label: { fontSize: 12, fontWeight: '600', color: '#555', letterSpacing: 0.3, marginBottom: 7 },
  input: {
    borderWidth: 1, borderColor: '#e2e2e2', borderRadius: 8,
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
    alignItems: 'center', marginBottom: 18,
  },
  loginBtnText: { color: '#fff', fontSize: 14, fontWeight: '800', letterSpacing: 1.5 },
  requestRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' },
  requestLabel: { fontSize: 12, color: '#888' },
  requestLink: { fontSize: 12, color: HUB_ORANGE, fontWeight: '700', letterSpacing: 0.3 },
  orgRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 13, paddingHorizontal: 14, borderRadius: 10,
    borderWidth: 1, borderColor: '#ebebeb', marginBottom: 10, backgroundColor: '#fafafa',
  },
  orgAvatar: {
    width: 42, height: 42, borderRadius: 8, backgroundColor: HUB_ORANGE,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  orgAvatarLetter: { color: '#fff', fontWeight: '700', fontSize: 17 },
  orgName: { fontSize: 14, fontWeight: '600', color: '#111' },
  orgRole: { fontSize: 12, color: '#888', marginTop: 2 },
  backLink: { marginTop: 18, alignItems: 'center' },
  backLinkText: { fontSize: 13, color: HUB_ORANGE },
});

// ─── Layout / panel styles ────────────────────────────────────────────────────
const s = StyleSheet.create({
  desktopRow: {
    flex: 1, flexDirection: 'row',
    ...(Platform.OS === 'web' ? { minHeight: '100vh' as any } : {}),
  },

  /* Left panel — flex:3 so it scales proportionally (~30% of screen) */
  leftPanel: {
    flex: 3,
    borderRightWidth: 1, borderRightColor: HUB_BORDER,
    paddingHorizontal: 44, paddingTop: 44, paddingBottom: 44,
  },
  panelLogo: { width: 160, height: 44, marginBottom: 52 },
  leftContent: { flex: 1, justifyContent: 'center' },
  hubLabel: {
    fontSize: 11, fontWeight: '700', color: HUB_ORANGE,
    letterSpacing: 3, textTransform: 'uppercase', marginBottom: 10,
  },
  welcomeHeading: {
    fontSize: 64, fontWeight: '900', color: HUB_WHITE,
    lineHeight: 68, marginBottom: 14, letterSpacing: -2,
  },
  welcomeSub: { fontSize: 14, color: HUB_DIM, lineHeight: 22, marginBottom: 28 },
  divider: { height: 1, backgroundColor: HUB_BORDER, marginVertical: 22 },
  featureGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  featureItem: {
    width: '50%', flexDirection: 'row', alignItems: 'center',
    gap: 8, paddingVertical: 7,
  },
  featureLabel: { fontSize: 13, color: '#b0b0b0', flex: 1 },

  /* Center form column — flex:4 (~40% of screen), tighter padding */
  centerCol: {
    flex: 4, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 24, paddingVertical: 48,
  },
  card: {
    width: '100%', maxWidth: 480, backgroundColor: '#ffffff',
    borderRadius: 14, padding: 36,
    shadowColor: '#000', shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.5, shadowRadius: 40, elevation: 18,
  },

  /* Right info panel — flex:3 (~30% of screen), #BEBEBE background */
  rightPanel: {
    flex: 3,
    backgroundColor: '#BEBEBE',
    paddingHorizontal: 40, paddingTop: 44, paddingBottom: 44,
    justifyContent: 'center',
  },
  rightContent: { justifyContent: 'center' },
  rightHeading: {
    fontSize: 20, fontWeight: '900', color: HUB_ORANGE,
    letterSpacing: 0.5, lineHeight: 26, marginBottom: 10,
    textTransform: 'uppercase',
  },
  rightSub: { fontSize: 13, color: '#333333', lineHeight: 20 },
  benefitItem: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  benefitCheck: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: HUB_ORANGE,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  benefitLabel: { fontSize: 13, color: '#222222', flex: 1 },
  rightTagline: { fontSize: 13, color: '#444444', lineHeight: 20, fontStyle: 'italic' },
  rightDivider: { height: 1, backgroundColor: '#A8A8A8', marginVertical: 18 },

  /* Mobile */
  mobilePage: { flex: 1, alignItems: 'center', paddingHorizontal: 20, paddingVertical: 48 },
  mobileLogo: { width: 200, height: 58, marginBottom: 28 },
  mobileFooter: { marginTop: 24, fontSize: 12, color: '#3a3a3a' },
});
