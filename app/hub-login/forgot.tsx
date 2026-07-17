import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Mail } from 'lucide-react-native';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import HubAuthShell, { HUB_ORANGE, HUB_WHITE, HUB_DIM, HUB_BORDER } from '@/components/HubAuthShell';

const HUB_INPUT_BG = '#1c1c1c';
const HUB_INPUT_BORDER = '#2e2e2e';
const HUB_MUTED = '#6b6b6b';

export default function HubForgotPage() {
  const router = useRouter();
  const { isDesktop, isTablet } = useBreakpoint();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!email.trim()) { setError('Please enter your email address.'); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/hub/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Something went wrong. Please try again.');
        return;
      }
      setSent(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <HubAuthShell scroll={!(isDesktop || isTablet)}>
      <View style={isDesktop || isTablet ? s.desktopCenter : s.mobilePage}>
        <Image
          source={require('@/assets/images/ko-logo-horizontal.png')}
          style={isDesktop || isTablet ? s.desktopLogo : s.mobileLogo}
          resizeMode="contain"
        />

        <View style={s.card}>
          <TouchableOpacity style={s.backRow} onPress={() => router.push('/hub-login' as any)}>
            <ArrowLeft size={15} color={HUB_ORANGE} />
            <Text style={s.backText}>Back to login</Text>
          </TouchableOpacity>

          {sent ? (
            <View style={s.successBox}>
              <View style={s.successIcon}>
                <Mail size={26} color={HUB_ORANGE} />
              </View>
              <Text style={s.successTitle}>Check your email</Text>
              <Text style={s.successSub}>
                If an account exists for{' '}
                <Text style={{ fontWeight: '700', color: HUB_WHITE }}>{email}</Text>
                , a password reset link has been sent. It expires in 24 hours.
              </Text>
              <Text style={s.devNote}>
                In development, check the server logs for the direct reset link.
              </Text>
              <TouchableOpacity style={s.btn} onPress={() => router.push('/hub-login' as any)}>
                <Text style={s.btnText}>BACK TO LOGIN</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={s.eyebrow}>CLIENT HUB</Text>
              <Text style={s.title}>Forgot Your Password?</Text>
              <Text style={s.subtitle}>
                Enter your email and we'll send you a link to set or reset your password.
              </Text>

              {error ? (
                <View style={s.errorBanner}><Text style={s.errorText}>{error}</Text></View>
              ) : null}

              <Text style={s.label}>Email Address</Text>
              <TextInput
                style={s.input}
                placeholder="you@company.com"
                placeholderTextColor={HUB_MUTED}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                onSubmitEditing={handleSubmit}
              />

              <TouchableOpacity
                style={[s.btn, loading && { opacity: 0.7 }]}
                onPress={handleSubmit}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.btnText}>SEND RESET LINK</Text>}
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </HubAuthShell>
  );
}

const s = StyleSheet.create({
  desktopCenter: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 20, paddingVertical: 48,
  },
  mobilePage: { flex: 1, alignItems: 'center', paddingHorizontal: 20, paddingTop: 48, paddingBottom: 40 },
  desktopLogo: { width: 200, height: 54, marginBottom: 36 },
  mobileLogo: { width: 170, height: 46, marginBottom: 28 },
  card: {
    width: '100%', maxWidth: 420,
    backgroundColor: '#141414', borderRadius: 14,
    padding: 34, borderWidth: 1, borderColor: '#1f1f1f',
  },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 24 },
  backText: { fontSize: 13, color: HUB_ORANGE, fontWeight: '500' },
  eyebrow: {
    fontSize: 10, fontWeight: '700', color: HUB_ORANGE,
    letterSpacing: 3, textTransform: 'uppercase', marginBottom: 8,
  },
  title: { fontSize: 26, fontWeight: '800', color: HUB_WHITE, marginBottom: 8, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: HUB_DIM, lineHeight: 20, marginBottom: 24 },
  errorBanner: {
    backgroundColor: '#1a0a0a', borderWidth: 1, borderColor: '#4a1010',
    borderRadius: 8, padding: 12, marginBottom: 16,
  },
  errorText: { fontSize: 13, color: '#f87171' },
  label: { fontSize: 12, fontWeight: '600', color: '#888', letterSpacing: 0.5, marginBottom: 8 },
  input: {
    borderWidth: 1, borderColor: HUB_INPUT_BORDER, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: Platform.OS === 'web' ? 13 : 12,
    fontSize: 14, color: HUB_WHITE, backgroundColor: HUB_INPUT_BG, marginBottom: 22,
  },
  btn: {
    backgroundColor: HUB_ORANGE, borderRadius: 8, paddingVertical: 15,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '800', letterSpacing: 1.5 },
  successBox: { alignItems: 'center', paddingTop: 4 },
  successIcon: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#1e1000', borderWidth: 1, borderColor: '#3d2800',
    alignItems: 'center', justifyContent: 'center', marginBottom: 18,
  },
  successTitle: { fontSize: 20, fontWeight: '800', color: HUB_WHITE, marginBottom: 12 },
  successSub: { fontSize: 13, color: HUB_DIM, lineHeight: 20, textAlign: 'center', marginBottom: 12 },
  devNote: {
    fontSize: 11, color: '#3a3a3a', textAlign: 'center',
    fontStyle: 'italic', marginBottom: 24,
  },
});
