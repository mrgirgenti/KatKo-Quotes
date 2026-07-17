import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Eye, EyeOff, Check,
  FileText, Layers, CheckCircle2, Download, Receipt,
  ClipboardList, Users, Bookmark, MessageCircle, Plus,
  ArrowRight,
} from 'lucide-react-native';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import HubAuthShell, {
  HUB_ORANGE, HUB_WHITE, HUB_DIM, HUB_BORDER,
} from '@/components/HubAuthShell';

const HUB_BG = '#0c0c0c';
const HUB_CARD = '#141414';
const HUB_INPUT_BG = '#1c1c1c';
const HUB_INPUT_BORDER = '#2e2e2e';
const HUB_MUTED = '#6b6b6b';

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

  if (isDesktop || isTablet) {
    return (
      <HubAuthShell>
        <View style={s.desktopRow}>
          {/* ─── Left Brand Panel ─── */}
          <View style={s.leftPanel}>
            <Image
              source={require('@/assets/images/ko-logo-horizontal.png')}
              style={s.leftLogo}
              resizeMode="contain"
            />

            <View style={s.leftMain}>
              <Text style={s.hubLabel}>CLIENT HUB</Text>
              <Text style={s.welcomeHeading}>WELCOME{'\n'}BACK.</Text>
              <Text style={s.welcomeSub}>
                Your projects. Your brand.{'\n'}All in one place.
              </Text>

              <View style={s.divider} />

              <Text style={s.sectionLabel}>WHAT'S INSIDE</Text>
              <View style={s.featureGrid}>
                {FEATURES.map((f, i) => {
                  const Icon = f.icon;
                  return (
                    <View key={i} style={s.featureItem}>
                      <Icon size={12} color={HUB_ORANGE} />
                      <Text style={s.featureLabel}>{f.label}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {isDesktop ? (
              <View style={s.leftBottom}>
                <View style={s.divider} />
                <Text style={s.sectionLabel}>WHY YOUR CLIENTS LOVE IT</Text>
                <View style={{ marginTop: 10 }}>
                  {BENEFITS.map((b, i) => (
                    <View key={i} style={s.benefitItem}>
                      <View style={s.benefitCheck}>
                        <Check size={9} color="#fff" strokeWidth={3} />
                      </View>
                      <Text style={s.benefitLabel}>{b}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </View>

          {/* ─── Right Form Panel ─── */}
          <View style={s.rightPanel}>
            <View style={s.formWrap}>
              {orgs ? (
                <OrgPicker
                  orgs={orgs}
                  onSelect={handleOrgSelect}
                  onBack={() => { setOrgs(null); setPendingSession(null); }}
                />
              ) : (
                <LoginForm
                  email={email} setEmail={setEmail}
                  password={password} setPassword={setPassword}
                  showPassword={showPassword} setShowPassword={setShowPassword}
                  rememberMe={rememberMe} setRememberMe={setRememberMe}
                  loading={loading} error={error} needsSetup={needsSetup}
                  onLogin={handleLogin}
                  onForgot={() => router.push('/hub-login/forgot' as any)}
                  onRequest={() => router.push('/hub-request' as any)}
                />
              )}
            </View>
          </View>
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
        <View style={s.mobileCard}>
          {orgs ? (
            <OrgPicker
              orgs={orgs}
              onSelect={handleOrgSelect}
              onBack={() => { setOrgs(null); setPendingSession(null); }}
              dark
            />
          ) : (
            <LoginForm
              email={email} setEmail={setEmail}
              password={password} setPassword={setPassword}
              showPassword={showPassword} setShowPassword={setShowPassword}
              rememberMe={rememberMe} setRememberMe={setRememberMe}
              loading={loading} error={error} needsSetup={needsSetup}
              onLogin={handleLogin}
              onForgot={() => router.push('/hub-login/forgot' as any)}
              onRequest={() => router.push('/hub-request' as any)}
              dark
            />
          )}
        </View>
        <Text style={s.mobileFooter}>© Katalyst Ko</Text>
      </View>
    </HubAuthShell>
  );
}

// ─── Login Form Component ─────────────────────────────────────────────────────
type LoginFormProps = {
  email: string; setEmail: (v: string) => void;
  password: string; setPassword: (v: string) => void;
  showPassword: boolean; setShowPassword: (fn: (v: boolean) => boolean) => void;
  rememberMe: boolean; setRememberMe: (fn: (v: boolean) => boolean) => void;
  loading: boolean; error: string | null; needsSetup: boolean;
  onLogin: () => void; onForgot: () => void; onRequest: () => void;
  dark?: boolean;
};

function LoginForm({
  email, setEmail, password, setPassword,
  showPassword, setShowPassword, rememberMe, setRememberMe,
  loading, error, needsSetup, onLogin, onForgot, onRequest, dark,
}: LoginFormProps) {
  return (
    <>
      <Text style={f.eyebrow}>CLIENT HUB</Text>
      <Text style={f.title}>Log In</Text>
      <Text style={f.subtitle}>Access your projects, artwork, and invoices.</Text>

      {needsSetup ? (
        <View style={f.setupBanner}>
          <Text style={f.setupTitle}>Password not set up yet</Text>
          <Text style={f.setupBody}>
            Your account was created before password login was required.
            Use "Forgot your password?" below to set one up — it only takes a minute.
          </Text>
          <TouchableOpacity style={f.setupCta} onPress={onForgot}>
            <Text style={f.setupCtaText}>Set up my password</Text>
            <ArrowRight size={14} color={HUB_ORANGE} />
          </TouchableOpacity>
        </View>
      ) : error ? (
        <View style={f.errorBanner}>
          <Text style={f.errorText}>{error}</Text>
        </View>
      ) : null}

      <Text style={f.label}>Email Address</Text>
      <TextInput
        style={f.input}
        placeholder="you@company.com"
        placeholderTextColor={HUB_MUTED}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        onSubmitEditing={onLogin}
      />

      <Text style={f.label}>Password</Text>
      <View style={f.passwordWrap}>
        <TextInput
          style={[f.input, { flex: 1, marginBottom: 0 }]}
          placeholder="••••••••••••"
          placeholderTextColor={HUB_MUTED}
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          autoComplete="current-password"
          onSubmitEditing={onLogin}
        />
        <TouchableOpacity style={f.eyeBtn} onPress={() => setShowPassword(v => !v)}>
          {showPassword
            ? <EyeOff size={17} color={HUB_MUTED} />
            : <Eye size={17} color={HUB_MUTED} />}
        </TouchableOpacity>
      </View>

      <View style={f.rememberRow}>
        <TouchableOpacity style={f.checkboxRow} onPress={() => setRememberMe(v => !v)} activeOpacity={0.7}>
          <View style={[f.checkbox, rememberMe && f.checkboxOn]}>
            {rememberMe ? <Check size={10} color="#fff" strokeWidth={3} /> : null}
          </View>
          <Text style={f.rememberLabel}>Remember me</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onForgot}>
          <Text style={f.forgotLink}>Forgot your password?</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[f.loginBtn, loading && { opacity: 0.7 }]}
        onPress={onLogin}
        disabled={loading}
        activeOpacity={0.85}
      >
        {loading
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={f.loginBtnText}>LOG IN</Text>}
      </TouchableOpacity>

      <View style={f.requestRow}>
        <Text style={f.requestLabel}>Don't have access yet? </Text>
        <TouchableOpacity onPress={onRequest}>
          <Text style={f.requestLink}>REQUEST AN INVITATION</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

// ─── Org Picker Component ─────────────────────────────────────────────────────
type OrgPickerProps = {
  orgs: OrgOption[];
  onSelect: (orgId: string) => void;
  onBack: () => void;
  dark?: boolean;
};

function OrgPicker({ orgs, onSelect, onBack }: OrgPickerProps) {
  return (
    <>
      <Text style={f.eyebrow}>CLIENT HUB</Text>
      <Text style={f.title}>Choose Your Hub</Text>
      <Text style={f.subtitle}>You're linked to multiple Client Hubs. Which would you like to enter?</Text>
      <View style={{ marginTop: 20 }}>
        {orgs.map(org => (
          <TouchableOpacity
            key={org.orgId}
            style={f.orgRow}
            onPress={() => onSelect(org.orgId)}
            activeOpacity={0.75}
          >
            <View style={f.orgAvatar}>
              {org.logoUrl
                ? <Image source={{ uri: org.logoUrl }} style={{ width: 44, height: 44, borderRadius: 6 }} />
                : <Text style={f.orgAvatarLetter}>{org.orgName[0]?.toUpperCase()}</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={f.orgName}>{org.orgName}</Text>
              <Text style={f.orgRole}>{org.role === 'ORG_ADMIN' ? 'Super Admin' : 'Member'}</Text>
            </View>
            <ArrowRight size={16} color={HUB_ORANGE} />
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity style={f.backLink} onPress={onBack}>
        <Text style={f.backLinkText}>← Back to login</Text>
      </TouchableOpacity>
    </>
  );
}

// ─── Form styles (dark-themed) ───────────────────────────────────────────────
const f = StyleSheet.create({
  eyebrow: {
    fontSize: 11, fontWeight: '700', color: HUB_ORANGE,
    letterSpacing: 3, textTransform: 'uppercase', marginBottom: 8,
  },
  title: { fontSize: 28, fontWeight: '800', color: HUB_WHITE, marginBottom: 6, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: HUB_DIM, lineHeight: 20, marginBottom: 28 },
  setupBanner: {
    backgroundColor: '#1a1300', borderWidth: 1, borderColor: '#3d2a00',
    borderRadius: 10, padding: 16, marginBottom: 20,
  },
  setupTitle: { fontSize: 13, fontWeight: '700', color: HUB_ORANGE, marginBottom: 6 },
  setupBody: { fontSize: 13, color: '#c8a96e', lineHeight: 20, marginBottom: 12 },
  setupCta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  setupCtaText: { fontSize: 13, fontWeight: '700', color: HUB_ORANGE },
  errorBanner: {
    backgroundColor: '#1a0a0a', borderWidth: 1, borderColor: '#4a1010',
    borderRadius: 10, padding: 14, marginBottom: 20,
  },
  errorText: { fontSize: 13, color: '#f87171', lineHeight: 20 },
  label: { fontSize: 12, fontWeight: '600', color: '#888', letterSpacing: 0.5, marginBottom: 8 },
  input: {
    borderWidth: 1, borderColor: HUB_INPUT_BORDER, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: Platform.OS === 'web' ? 13 : 12,
    fontSize: 14, color: HUB_WHITE, backgroundColor: HUB_INPUT_BG, marginBottom: 18,
  },
  passwordWrap: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  eyeBtn: { position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' },
  rememberRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24,
  },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox: {
    width: 18, height: 18, borderRadius: 4, borderWidth: 1.5,
    borderColor: '#3a3a3a', alignItems: 'center', justifyContent: 'center',
    backgroundColor: HUB_INPUT_BG,
  },
  checkboxOn: { backgroundColor: HUB_ORANGE, borderColor: HUB_ORANGE },
  rememberLabel: { fontSize: 13, color: '#888' },
  forgotLink: { fontSize: 13, color: HUB_ORANGE, fontWeight: '500' },
  loginBtn: {
    backgroundColor: HUB_ORANGE, borderRadius: 8, paddingVertical: 15,
    alignItems: 'center', marginBottom: 22,
  },
  loginBtnText: { color: '#fff', fontSize: 14, fontWeight: '800', letterSpacing: 1.5 },
  requestRow: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    flexWrap: 'wrap', paddingTop: 4,
  },
  requestLabel: { fontSize: 12, color: HUB_MUTED },
  requestLink: { fontSize: 12, color: HUB_ORANGE, fontWeight: '700', letterSpacing: 0.4 },
  orgRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 14, paddingHorizontal: 14, borderRadius: 10,
    borderWidth: 1, borderColor: '#2a2a2a', marginBottom: 10,
    backgroundColor: '#191919',
  },
  orgAvatar: {
    width: 44, height: 44, borderRadius: 8, backgroundColor: HUB_ORANGE,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  orgAvatarLetter: { color: '#fff', fontWeight: '700', fontSize: 18 },
  orgName: { fontSize: 14, fontWeight: '700', color: HUB_WHITE },
  orgRole: { fontSize: 12, color: HUB_DIM, marginTop: 2 },
  backLink: { marginTop: 20, alignItems: 'center' },
  backLinkText: { fontSize: 13, color: HUB_ORANGE },
});

// ─── Layout / shell styles ───────────────────────────────────────────────────
const s = StyleSheet.create({
  desktopRow: {
    flex: 1, flexDirection: 'row',
    ...(Platform.OS === 'web' ? { minHeight: '100vh' as any } : {}),
  },
  leftPanel: {
    width: 380,
    backgroundColor: '#0f0f0f',
    borderRightWidth: 1,
    borderRightColor: HUB_BORDER,
    paddingHorizontal: 40,
    paddingTop: 44,
    paddingBottom: 44,
    flexDirection: 'column',
  },
  leftLogo: { width: 160, height: 42, marginBottom: 48 },
  leftMain: { flex: 1 },
  leftBottom: { marginTop: 8 },
  hubLabel: {
    fontSize: 10, fontWeight: '700', color: HUB_ORANGE,
    letterSpacing: 3, textTransform: 'uppercase', marginBottom: 10,
  },
  welcomeHeading: {
    fontSize: 54, fontWeight: '900', color: HUB_WHITE,
    lineHeight: 58, marginBottom: 12, letterSpacing: -1.5,
  },
  welcomeSub: { fontSize: 13, color: HUB_DIM, lineHeight: 21, marginBottom: 28 },
  divider: { height: 1, backgroundColor: HUB_BORDER, marginVertical: 22 },
  sectionLabel: {
    fontSize: 10, fontWeight: '700', color: '#444',
    letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14,
  },
  featureGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  featureItem: {
    width: '50%', flexDirection: 'row', alignItems: 'center',
    gap: 8, paddingVertical: 6,
  },
  featureLabel: { fontSize: 12, color: '#9a9a9a' },
  benefitItem: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  benefitCheck: {
    width: 18, height: 18, borderRadius: 9, backgroundColor: '#1e1e1e',
    borderWidth: 1, borderColor: HUB_ORANGE,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  benefitLabel: { fontSize: 12, color: '#9a9a9a' },
  rightPanel: {
    flex: 1,
    backgroundColor: HUB_BG,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 48,
    paddingVertical: 60,
  },
  formWrap: {
    width: '100%',
    maxWidth: 420,
  },
  mobilePage: { flex: 1, alignItems: 'center', paddingHorizontal: 20, paddingTop: 48, paddingBottom: 40 },
  mobileLogo: { width: 180, height: 48, marginBottom: 32 },
  mobileCard: {
    width: '100%', maxWidth: 400,
    backgroundColor: '#141414', borderRadius: 14,
    padding: 28, borderWidth: 1, borderColor: '#1f1f1f',
  },
  mobileFooter: { marginTop: 28, fontSize: 12, color: '#2a2a2a' },
});
