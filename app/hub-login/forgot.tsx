import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Mail } from 'lucide-react-native';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import HubAuthShell, { HUB_ORANGE, HUB_WHITE, HUB_DIM, HUB_BORDER } from '@/components/HubAuthShell';

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
      await fetch('/api/hub/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
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
        {wide ? (
          <Image
            source={require('@/assets/images/ko-logo-horizontal.png')}
            style={s.desktopLogo}
            resizeMode="contain"
          />
        ) : (
          <Image
            source={require('@/assets/images/ko-logo-horizontal.png')}
            style={s.mobileLogo}
            resizeMode="contain"
          />
        )}

        <View style={s.card}>
          <TouchableOpacity style={s.backRow} onPress={() => router.push('/hub-login' as any)}>
            <ArrowLeft size={16} color={HUB_ORANGE} />
            <Text style={s.backText}>Back to login</Text>
          </TouchableOpacity>

          {sent ? (
            <View style={s.successBox}>
              <View style={s.successIcon}>
                <Mail size={28} color={HUB_ORANGE} />
              </View>
              <Text style={s.successTitle}>Check your email</Text>
              <Text style={s.successSub}>
                If an account exists for <Text style={{ fontWeight: '600' }}>{email}</Text>, a reset link
                has been sent. It expires in 24 hours.
              </Text>
              <TouchableOpacity style={s.loginBtn} onPress={() => router.push('/hub-login' as any)}>
                <Text style={s.loginBtnText}>BACK TO LOGIN</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={s.title}>Forgot Your Password?</Text>
              <Text style={s.subtitle}>
                Enter your email address and we'll send you a link to reset your password.
              </Text>

              {error ? (
                <View style={s.errorBanner}><Text style={s.errorText}>{error}</Text></View>
              ) : null}

              <Text style={s.label}>Email Address</Text>
              <TextInput
                style={s.input}
                placeholder="you@email.com"
                placeholderTextColor="#b8b8b8"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                onSubmitEditing={handleSubmit}
              />

              <TouchableOpacity
                style={[s.loginBtn, loading && { opacity: 0.7 }]}
                onPress={handleSubmit}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.loginBtnText}>SEND RESET LINK</Text>}
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
  mobilePage: { flex: 1, alignItems: 'center', paddingHorizontal: 20, paddingVertical: 48 },
  desktopLogo: { width: 220, height: 66, marginBottom: 32 },
  mobileLogo: { width: 180, height: 54, marginBottom: 28 },
  card: {
    width: '100%', maxWidth: 420, backgroundColor: HUB_WHITE,
    borderRadius: 14, padding: 36,
    shadowColor: '#000', shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.4, shadowRadius: 32, elevation: 14,
  },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20 },
  backText: { fontSize: 13, color: HUB_ORANGE, fontWeight: '500' },
  title: { fontSize: 22, fontWeight: '700', color: '#111', marginBottom: 10 },
  subtitle: { fontSize: 13, color: '#666', lineHeight: 20, marginBottom: 22 },
  errorBanner: { backgroundColor: '#FEE2E2', borderRadius: 8, padding: 12, marginBottom: 16 },
  errorText: { fontSize: 13, color: '#dc2626' },
  label: { fontSize: 13, fontWeight: '500', color: '#444', marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: Platform.OS === 'web' ? 12 : 11,
    fontSize: 14, color: '#111', backgroundColor: '#fafafa', marginBottom: 20,
  },
  loginBtn: {
    backgroundColor: HUB_ORANGE, borderRadius: 8, paddingVertical: 15,
    alignItems: 'center',
  },
  loginBtnText: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 1 },
  successBox: { alignItems: 'center', paddingTop: 8 },
  successIcon: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: '#FFF4EE', alignItems: 'center', justifyContent: 'center', marginBottom: 18,
  },
  successTitle: { fontSize: 20, fontWeight: '700', color: '#111', marginBottom: 12 },
  successSub: { fontSize: 13, color: '#666', lineHeight: 20, textAlign: 'center', marginBottom: 28 },
});
