import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Eye, EyeOff, CheckCircle2 } from 'lucide-react-native';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import HubAuthShell, { HUB_ORANGE, HUB_WHITE, HUB_DIM } from '@/components/HubAuthShell';

export default function HubResetPage() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token: string }>();
  const { isDesktop, isTablet } = useBreakpoint();

  const [userInfo, setUserInfo] = useState<{ email: string; name: string } | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setTokenError('No reset token found.'); return; }
    fetch(`/api/portal/reset-password?token=${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setTokenError(d.error);
        else setUserInfo({ email: d.email, name: d.name });
      })
      .catch(() => setTokenError('Could not validate your reset link.'));
  }, [token]);

  const handleSubmit = async () => {
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/portal/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Reset failed.'); return; }
      setDone(true);
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
          source={require('@/assets/images/ko-logo-horizontal.png')}
          style={wide ? s.desktopLogo : s.mobileLogo}
          resizeMode="contain"
        />
        <View style={s.card}>
          {tokenError ? (
            <>
              <Text style={s.title}>Link Expired</Text>
              <Text style={s.subtitle}>{tokenError}</Text>
              <TouchableOpacity style={s.btn} onPress={() => router.push('/hub-login/forgot' as any)}>
                <Text style={s.btnText}>REQUEST A NEW LINK</Text>
              </TouchableOpacity>
            </>
          ) : done ? (
            <View style={s.successBox}>
              <CheckCircle2 size={44} color={HUB_ORANGE} style={{ marginBottom: 16 }} />
              <Text style={s.title}>Password Updated!</Text>
              <Text style={s.subtitle}>
                {userInfo?.name ? `Welcome, ${userInfo.name.split(' ')[0]}! ` : ''}
                Your password has been set. You can now log in.
              </Text>
              <TouchableOpacity style={s.btn} onPress={() => router.replace('/hub-login' as any)}>
                <Text style={s.btnText}>GO TO LOGIN</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={s.title}>Set New Password</Text>
              {userInfo ? (
                <Text style={s.subtitle}>Setting password for <Text style={{ fontWeight: '600' }}>{userInfo.email}</Text></Text>
              ) : (
                <Text style={s.subtitle}>Validating your link…</Text>
              )}

              {error ? (
                <View style={s.errorBanner}><Text style={s.errorText}>{error}</Text></View>
              ) : null}

              <Text style={s.label}>New Password</Text>
              <View style={s.pwWrap}>
                <TextInput
                  style={[s.input, { flex: 1, marginBottom: 0 }]}
                  placeholder="Min. 8 characters"
                  placeholderTextColor="#b8b8b8"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPw}
                />
                <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPw(v => !v)}>
                  {showPw ? <EyeOff size={18} color="#aaa" /> : <Eye size={18} color="#aaa" />}
                </TouchableOpacity>
              </View>

              <Text style={[s.label, { marginTop: 16 }]}>Confirm Password</Text>
              <View style={s.pwWrap}>
                <TextInput
                  style={[s.input, { flex: 1, marginBottom: 0 }]}
                  placeholder="Re-enter password"
                  placeholderTextColor="#b8b8b8"
                  value={confirm}
                  onChangeText={setConfirm}
                  secureTextEntry={!showConfirm}
                  onSubmitEditing={handleSubmit}
                />
                <TouchableOpacity style={s.eyeBtn} onPress={() => setShowConfirm(v => !v)}>
                  {showConfirm ? <EyeOff size={18} color="#aaa" /> : <Eye size={18} color="#aaa" />}
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[s.btn, { marginTop: 24 }, loading && { opacity: 0.7 }]}
                onPress={handleSubmit}
                disabled={loading || !userInfo}
                activeOpacity={0.85}
              >
                {loading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.btnText}>SET PASSWORD</Text>}
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </HubAuthShell>
  );
}

const s = StyleSheet.create({
  desktopCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 48 },
  mobilePage: { flex: 1, alignItems: 'center', paddingHorizontal: 20, paddingVertical: 48 },
  desktopLogo: { width: 220, height: 66, marginBottom: 32 },
  mobileLogo: { width: 180, height: 54, marginBottom: 28 },
  card: {
    width: '100%', maxWidth: 420, backgroundColor: HUB_WHITE,
    borderRadius: 14, padding: 36,
    shadowColor: '#000', shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.4, shadowRadius: 32, elevation: 14,
  },
  title: { fontSize: 22, fontWeight: '700', color: '#111', marginBottom: 10 },
  subtitle: { fontSize: 13, color: '#666', lineHeight: 20, marginBottom: 22 },
  errorBanner: { backgroundColor: '#FEE2E2', borderRadius: 8, padding: 12, marginBottom: 16 },
  errorText: { fontSize: 13, color: '#dc2626' },
  label: { fontSize: 13, fontWeight: '500', color: '#444', marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: Platform.OS === 'web' ? 12 : 11,
    fontSize: 14, color: '#111', backgroundColor: '#fafafa', marginBottom: 0,
  },
  pwWrap: { flexDirection: 'row', alignItems: 'center' },
  eyeBtn: { position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' },
  btn: {
    backgroundColor: HUB_ORANGE, borderRadius: 8, paddingVertical: 15, alignItems: 'center',
  },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 1 },
  successBox: { alignItems: 'center' },
});
