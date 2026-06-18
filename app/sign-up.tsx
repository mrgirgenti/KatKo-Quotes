import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  ScrollView,
} from 'react-native';
import { useSignUp, useSSO } from '@clerk/clerk-expo';
import { useRouter, Link } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Eye, EyeOff } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { GoogleIcon } from '@/components/GoogleIcon';

WebBrowser.maybeCompleteAuthSession();

export default function SignUpScreen() {
  const { signUp, setActive, isLoaded } = useSignUp();
  const { startSSOFlow } = useSSO();
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pendingVerification, setPendingVerification] = useState(false);
  const [code, setCode] = useState('');

  const onSignUpPress = useCallback(async () => {
    if (!isLoaded || submitting) return;
    setError(null);
    if (!email.trim() || !password) {
      setError('Enter your email and a password.');
      return;
    }
    setSubmitting(true);
    try {
      const nameParts = name.trim().split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      await signUp.create({
        emailAddress: email.trim(),
        password,
        ...(firstName ? { firstName } : {}),
        ...(lastName ? { lastName } : {}),
      });
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setPendingVerification(true);
    } catch (err: any) {
      setError(err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || 'Could not create your account.');
    } finally {
      setSubmitting(false);
    }
  }, [isLoaded, submitting, email, password, signUp]);

  const onVerifyPress = useCallback(async () => {
    if (!isLoaded || submitting) return;
    setError(null);
    if (!code.trim()) {
      setError('Enter the verification code from your email.');
      return;
    }
    setSubmitting(true);
    try {
      const attempt = await signUp.attemptEmailAddressVerification({ code: code.trim() });
      if (attempt.status === 'complete') {
        await setActive({ session: attempt.createdSessionId });
        router.replace('/(tabs)');
      } else {
        setError('Verification incomplete. Please try again.');
      }
    } catch (err: any) {
      setError(err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || 'Invalid verification code.');
    } finally {
      setSubmitting(false);
    }
  }, [isLoaded, submitting, code, signUp, setActive, router]);

  const onGooglePress = useCallback(async () => {
    if (googleLoading) return;
    setError(null);
    setGoogleLoading(true);
    try {
      const redirectUrl =
        Platform.OS === 'web' && typeof window !== 'undefined'
          ? window.location.origin
          : Linking.createURL('/');
      const { createdSessionId, setActive: ssoSetActive } = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl,
      });
      if (createdSessionId && ssoSetActive) {
        await ssoSetActive({ session: createdSessionId });
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      setError(err?.errors?.[0]?.longMessage || 'Google sign-up failed. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  }, [googleLoading, startSSOFlow, router]);

  if (pendingVerification) {
    return (
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>KK</Text>
          </View>
          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.subtitle}>We sent a verification code to {email}</Text>

          <Text style={styles.label}>Verification code</Text>
          <TextInput
            style={styles.input}
            value={code}
            onChangeText={setCode}
            placeholder="Enter the 6-digit code"
            placeholderTextColor="#9ca3af"
            keyboardType="number-pad"
            autoComplete="one-time-code"
            onSubmitEditing={onVerifyPress}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity style={styles.submitBtn} onPress={onVerifyPress} disabled={submitting} activeOpacity={0.85}>
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Verify email</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <View style={styles.logoBadge}>
          <Text style={styles.logoText}>KK</Text>
        </View>
        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>Get started with Katalyst Ko OS</Text>

        <TouchableOpacity style={styles.googleBtn} onPress={onGooglePress} disabled={googleLoading} activeOpacity={0.8}>
          {googleLoading ? (
            <ActivityIndicator color={Colors.light.text} />
          ) : (
            <>
              <GoogleIcon size={18} />
              <Text style={styles.googleBtnText}>Continue with Google</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.dividerRow}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.divider} />
        </View>

        <Text style={styles.label}>Full name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Enter your full name"
          placeholderTextColor="#9ca3af"
          autoCapitalize="words"
          autoComplete="name"
        />

        <Text style={styles.label}>Email address</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="Enter your email address"
          placeholderTextColor="#9ca3af"
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />

        <Text style={styles.label}>Password</Text>
        <View style={styles.passwordRow}>
          <TextInput
            style={styles.passwordInput}
            value={password}
            onChangeText={setPassword}
            placeholder="Create a password"
            placeholderTextColor="#9ca3af"
            secureTextEntry={!showPassword}
            autoComplete="password-new"
            onSubmitEditing={onSignUpPress}
          />
          <TouchableOpacity onPress={() => setShowPassword((s) => !s)} style={styles.eyeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            {showPassword ? <EyeOff size={18} color="#6b7280" /> : <Eye size={18} color="#6b7280" />}
          </TouchableOpacity>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity style={styles.submitBtn} onPress={onSignUpPress} disabled={submitting} activeOpacity={0.85}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Create account</Text>}
        </TouchableOpacity>

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Link href="/sign-in" replace asChild>
            <TouchableOpacity>
              <Text style={styles.footerLink}>Sign in</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6', padding: 20 },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 28,
    borderWidth: 1,
    borderColor: Colors.light.border,
    ...(Platform.OS === 'web' ? { boxShadow: '0 10px 30px rgba(0,0,0,0.08)' } as any : {}),
  },
  logoBadge: { alignSelf: 'center', width: 56, height: 56, borderRadius: 14, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  logoText: { color: Colors.light.primary, fontSize: 22, fontWeight: '800' },
  title: { fontSize: 26, fontWeight: '800', color: Colors.light.text, textAlign: 'center' },
  subtitle: { fontSize: 14, color: Colors.light.textSecondary, textAlign: 'center', marginTop: 4, marginBottom: 24 },
  googleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 48, borderRadius: 10, borderWidth: 1, borderColor: Colors.light.border, backgroundColor: '#fff' },
  googleBtnText: { fontSize: 15, fontWeight: '600', color: Colors.light.text },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  divider: { flex: 1, height: 1, backgroundColor: Colors.light.border },
  dividerText: { marginHorizontal: 12, color: '#9ca3af', fontSize: 13 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.light.text, marginBottom: 6 },
  input: { height: 48, borderWidth: 1, borderColor: Colors.light.border, borderRadius: 10, paddingHorizontal: 14, fontSize: 15, color: Colors.light.text, marginBottom: 16, backgroundColor: '#fff' },
  passwordRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: Colors.light.border, borderRadius: 10, marginBottom: 16, backgroundColor: '#fff' },
  passwordInput: { flex: 1, height: 48, paddingHorizontal: 14, fontSize: 15, color: Colors.light.text },
  eyeBtn: { paddingHorizontal: 12, paddingVertical: 12 },
  error: { color: Colors.light.error, fontSize: 13, marginBottom: 12 },
  submitBtn: { height: 50, borderRadius: 10, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 22 },
  footerText: { color: Colors.light.textSecondary, fontSize: 14 },
  footerLink: { color: Colors.light.primary, fontSize: 14, fontWeight: '700' },
});
