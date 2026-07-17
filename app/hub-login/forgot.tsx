import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Mail } from 'lucide-react-native';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import HubAuthShell, { HUB_ORANGE } from '@/components/HubAuthShell';

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

  const wide = isDesktop || isTablet;

  return (
    <HubAuthShell scroll={!wide}>
      <View style={wide ? s.desktopCenter : s.mobilePage}>
        <Image
          source={require('@/assets/images/ko-logo-new.webp')}
          style={wide ? s.desktopLogo : s.mobileLogo}
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
                <Text style={{ fontWeight: '700', color: '#111' }}>{email}</Text>
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
                placeholderTextColor="#b0b0b0"
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
  mobilePage: {
    flex: 1, alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 48, paddingBottom: 40,
  },
  desktopLogo: { width: 210, height: 56, marginBottom: 32 },
  mobileLogo: { width: 170, height: 46, marginBottom: 28 },

  // White card — matches main login card style
  card: {
    width: '100%' as any, maxWidth: 420,
    backgroundColor: '#ffffff',
    borderRadius: 16, padding: 36,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.55, shadowRadius: 56, elevation: 24,
    ...(Platform.OS === 'web' ? { boxShadow: '0 24px 64px rgba(0,0,0,0.65)' as any } : {}),
  },

  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 24 },
  backText: { fontSize: 13, color: HUB_ORANGE, fontWeight: '500' },

  eyebrow: {
    fontSize: 10, fontWeight: '700', color: HUB_ORANGE,
    letterSpacing: 3, textTransform: 'uppercase', marginBottom: 8,
  },
  title: { fontSize: 24, fontWeight: '800', color: '#111', marginBottom: 8, letterSpacing: -0.3 },
  subtitle: { fontSize: 13, color: '#666', lineHeight: 20, marginBottom: 24 },

  errorBanner: {
    backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#fecaca',
    borderRadius: 8, padding: 12, marginBottom: 16,
  },
  errorText: { fontSize: 13, color: '#dc2626' },

  label: { fontSize: 12, fontWeight: '600', color: '#555', letterSpacing: 0.3, marginBottom: 7 },
  input: {
    borderWidth: 1, borderColor: '#e2e2e2', borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: Platform.OS === 'web' ? 12 : 11,
    fontSize: 14, color: '#111', backgroundColor: '#fafafa', marginBottom: 22,
  },

  btn: {
    backgroundColor: HUB_ORANGE, borderRadius: 8, paddingVertical: 15, alignItems: 'center',
  },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '800', letterSpacing: 1.5 },

  successBox: { alignItems: 'center', paddingTop: 4 },
  successIcon: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#FFF4EE', borderWidth: 1, borderColor: '#FFD9B3',
    alignItems: 'center', justifyContent: 'center', marginBottom: 18,
  },
  successTitle: { fontSize: 20, fontWeight: '800', color: '#111', marginBottom: 12 },
  successSub: { fontSize: 13, color: '#666', lineHeight: 20, textAlign: 'center', marginBottom: 8 },
  devNote: {
    fontSize: 11, color: '#bbb', textAlign: 'center',
    fontStyle: 'italic', marginBottom: 24,
  },
});
