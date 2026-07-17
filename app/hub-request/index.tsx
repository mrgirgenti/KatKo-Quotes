import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import HubAuthShell, {
  HUB_ORANGE, HUB_WHITE, HUB_DIM, HUB_BORDER,
} from '@/components/HubAuthShell';

export default function HubRequestEntryPage() {
  const router = useRouter();
  const { isDesktop, isTablet } = useBreakpoint();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wide = isDesktop || isTablet;

  const handleContinue = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/hub/check-email?email=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Something went wrong.'); return; }

      const params = new URLSearchParams({ email: trimmed });
      if (data.orgId) params.set('orgId', data.orgId);
      if (data.orgName) params.set('orgName', data.orgName);
      if (data.userName) params.set('userName', data.userName);

      router.push(`/hub-request/${data.path}?${params.toString()}` as any);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <HubAuthShell scroll={!wide}>
      <View style={wide ? s.desktopRow : s.mobilePage}>
        {/* Left brand panel on wide screens */}
        {wide ? (
          <View style={s.leftPanel}>
            <Image
              source={require('@/assets/images/ko-logo-new.webp')}
              style={s.leftLogo}
              resizeMode="contain"
            />
            <View style={s.leftDivider} />
            <Text style={s.leftHeading}>Get Connected.</Text>
            <Text style={s.leftSub}>
              Request access to your organization's Client Hub and manage everything in one place.
            </Text>
          </View>
        ) : (
          <Image
            source={require('@/assets/images/ko-logo-new.webp')}
            style={s.mobileLogo}
            resizeMode="contain"
          />
        )}

        {/* Form */}
        <View style={wide ? s.formCol : s.mobileForm}>
          <View style={s.card}>
            <Text style={s.title}>Request Access</Text>
            <Text style={s.subtitle}>
              Enter your email address to get started. We'll look up your account and guide you through the right steps.
            </Text>

            {error ? (
              <View style={s.errorBanner}><Text style={s.errorText}>{error}</Text></View>
            ) : null}

            <Text style={s.label}>Your Email Address</Text>
            <TextInput
              style={s.input}
              placeholder="you@yourcompany.com"
              placeholderTextColor="#b8b8b8"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              onSubmitEditing={handleContinue}
            />

            <TouchableOpacity
              style={[s.btn, loading && { opacity: 0.7 }]}
              onPress={handleContinue}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <View style={s.btnInner}>
                  <Text style={s.btnText}>CONTINUE</Text>
                  <ArrowRight size={16} color="#fff" />
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={s.loginLink} onPress={() => router.push('/hub-login' as any)}>
              <Text style={s.loginLinkText}>Already have an account? Log in →</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </HubAuthShell>
  );
}

const s = StyleSheet.create({
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
  leftHeading: {
    fontSize: 36, fontWeight: '800', color: HUB_WHITE, marginBottom: 14, lineHeight: 42,
  },
  leftSub: { fontSize: 14, color: HUB_DIM, lineHeight: 22 },
  formCol: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, paddingVertical: 48 },
  mobileForm: { width: '100%', alignItems: 'center' },
  mobileLogo: { width: 180, height: 54, marginBottom: 28 },
  card: {
    width: '100%', maxWidth: 440, backgroundColor: HUB_WHITE,
    borderRadius: 14, padding: 36,
    shadowColor: '#000', shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.4, shadowRadius: 32, elevation: 14,
  },
  title: { fontSize: 22, fontWeight: '700', color: '#111', marginBottom: 10 },
  subtitle: { fontSize: 13, color: '#666', lineHeight: 20, marginBottom: 24 },
  errorBanner: { backgroundColor: '#FEE2E2', borderRadius: 8, padding: 12, marginBottom: 16 },
  errorText: { fontSize: 13, color: '#dc2626' },
  label: { fontSize: 13, fontWeight: '500', color: '#444', marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: Platform.OS === 'web' ? 12 : 11,
    fontSize: 14, color: '#111', backgroundColor: '#fafafa', marginBottom: 20,
  },
  btn: {
    backgroundColor: HUB_ORANGE, borderRadius: 8, paddingVertical: 15,
    alignItems: 'center', marginBottom: 16,
  },
  btnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 1 },
  loginLink: { alignItems: 'center' },
  loginLinkText: { fontSize: 13, color: HUB_ORANGE, fontWeight: '500' },
});
