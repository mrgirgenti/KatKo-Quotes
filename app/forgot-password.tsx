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
  Image,
} from 'react-native';
import { useSignIn } from '@clerk/clerk-expo';
import { useRouter, Link } from 'expo-router';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react-native';
import Colors from '@/constants/colors';

type Stage = 'email' | 'code';

export default function ForgotPasswordScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();

  const [stage, setStage] = useState<Stage>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const onSendCode = useCallback(async () => {
    if (!isLoaded || submitting) return;
    setError(null);
    if (!email.trim()) {
      setError('Enter your email address.');
      return;
    }
    setSubmitting(true);
    try {
      await signIn.create({
        strategy: 'reset_password_email_code',
        identifier: email.trim(),
      });
      setSuccessMsg(`A reset code was sent to ${email.trim()}.`);
      setStage('code');
    } catch (err: any) {
      setError(
        err?.errors?.[0]?.longMessage ||
          err?.errors?.[0]?.message ||
          'Could not send reset email. Check the address and try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }, [isLoaded, submitting, email, signIn]);

  const onResetPassword = useCallback(async () => {
    if (!isLoaded || submitting) return;
    setError(null);
    if (!code.trim()) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
    if (!password) {
      setError('Enter a new password.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code: code.trim(),
        password,
      });
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        router.replace('/(tabs)');
      } else if (result.status === 'needs_second_factor') {
        // Password reset succeeded but MFA is required — redirect to sign-in
        // where the full MFA flow is handled.
        router.replace('/sign-in');
      } else {
        setError('Password was reset but sign-in could not complete. Please sign in manually.');
      }
    } catch (err: any) {
      setError(
        err?.errors?.[0]?.longMessage ||
          err?.errors?.[0]?.message ||
          'Invalid code or password. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }, [isLoaded, submitting, code, password, signIn, setActive, router]);

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <Image
          source={require('../assets/images/ko-logo.png')}
          style={styles.logoBadge}
          resizeMode="cover"
        />

        <Text style={styles.title}>
          {stage === 'email' ? 'Reset your password' : 'Set a new password'}
        </Text>
        <Text style={styles.subtitle}>
          {stage === 'email'
            ? "Enter your email and we'll send you a reset code."
            : 'Enter the code from your email, then choose a new password.'}
        </Text>

        {stage === 'email' ? (
          <>
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
              onSubmitEditing={onSendCode}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={styles.submitBtn}
              onPress={onSendCode}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>Send reset code</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            {successMsg ? <Text style={styles.success}>{successMsg}</Text> : null}

            <Text style={styles.label}>Reset code</Text>
            <TextInput
              style={styles.input}
              value={code}
              onChangeText={setCode}
              placeholder="6-digit code"
              placeholderTextColor="#9ca3af"
              keyboardType="number-pad"
              autoComplete="one-time-code"
            />

            <Text style={styles.label}>New password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={styles.passwordInput}
                value={password}
                onChangeText={setPassword}
                placeholder="Choose a new password"
                placeholderTextColor="#9ca3af"
                secureTextEntry={!showPassword}
                autoComplete="new-password"
                onSubmitEditing={onResetPassword}
              />
              <TouchableOpacity
                onPress={() => setShowPassword((s) => !s)}
                style={styles.eyeBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {showPassword ? (
                  <EyeOff size={18} color="#6b7280" />
                ) : (
                  <Eye size={18} color="#6b7280" />
                )}
              </TouchableOpacity>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={styles.submitBtn}
              onPress={onResetPassword}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>Set new password & sign in</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => {
                setStage('email');
                setError(null);
                setSuccessMsg(null);
                setCode('');
                setPassword('');
              }}
            >
              <Text style={styles.backBtnText}>Didn&apos;t get a code? Re-send</Text>
            </TouchableOpacity>
          </>
        )}

        <View style={styles.footerRow}>
          <ArrowLeft size={14} color={Colors.light.textSecondary} />
          <Link href="/sign-in" replace asChild>
            <TouchableOpacity>
              <Text style={styles.footerLink}>Back to sign in</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 28,
    borderWidth: 1,
    borderColor: Colors.light.border,
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 10px 30px rgba(0,0,0,0.08)' } as any) : {}),
  },
  logoBadge: { alignSelf: 'center', width: 80, height: 80, borderRadius: 16, overflow: 'hidden', marginBottom: 16 },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.light.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 24,
  },
  label: { fontSize: 13, fontWeight: '600', color: Colors.light.text, marginBottom: 6 },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    color: Colors.light.text,
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 10,
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  passwordInput: { flex: 1, height: 48, paddingHorizontal: 14, fontSize: 15, color: Colors.light.text },
  eyeBtn: { paddingHorizontal: 12, paddingVertical: 12 },
  error: { color: Colors.light.error, fontSize: 13, marginBottom: 12 },
  success: {
    color: '#16a34a',
    fontSize: 13,
    marginBottom: 16,
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    padding: 10,
  },
  submitBtn: {
    height: 50,
    borderRadius: 10,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  backBtn: { alignItems: 'center', marginTop: 14 },
  backBtnText: { color: Colors.light.primary, fontSize: 14, fontWeight: '600' },
  footerRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 22 },
  footerLink: { color: Colors.light.primary, fontSize: 14, fontWeight: '700' },
});
