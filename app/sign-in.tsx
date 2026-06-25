import React, { useCallback, useEffect, useState } from 'react';
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
import { useSignIn, useSSO } from '@clerk/clerk-expo';
import { useRouter, Link } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Eye, EyeOff, Check, ArrowLeft } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { GoogleIcon } from '@/components/GoogleIcon';

WebBrowser.maybeCompleteAuthSession();

const REMEMBER_KEY = 'kk_remember_email';

function getStoredEmail(): string {
  if (Platform.OS !== 'web' || typeof localStorage === 'undefined') return '';
  return localStorage.getItem(REMEMBER_KEY) ?? '';
}

function clerkMsg(err: any): string {
  return (
    err?.errors?.[0]?.longMessage ||
    err?.errors?.[0]?.message ||
    String(err?.message || err || 'An unexpected error occurred.')
  );
}

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const { startSSOFlow } = useSSO();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // MFA second-factor step
  const [mfaStep, setMfaStep] = useState(false);
  const [mfaStrategy, setMfaStrategy] = useState<string>('totp');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaSubmitting, setMfaSubmitting] = useState(false);

  useEffect(() => {
    const saved = getStoredEmail();
    if (saved) {
      setEmail(saved);
      setRememberMe(true);
    }
  }, []);

  const persistRemember = useCallback(
    (emailValue: string, checked: boolean) => {
      if (Platform.OS !== 'web' || typeof localStorage === 'undefined') return;
      if (checked) localStorage.setItem(REMEMBER_KEY, emailValue);
      else localStorage.removeItem(REMEMBER_KEY);
    },
    [],
  );

  // ── Core sign-in flow ────────────────────────────────────────────────────
  // Clerk "Identifier First" instances: create() returns needs_first_factor,
  // then you call attemptFirstFactor({ strategy:'password', password }).
  // Classic instances: create() with password returns complete or needs_second_factor.
  // This recursive helper handles both patterns and the MFA gate.
  const advance = useCallback(
    async (attempt: any, pwd: string, emailVal: string, remember: boolean): Promise<void> => {
      switch (attempt.status) {
        case 'complete': {
          persistRemember(emailVal, remember);
          await setActive!({ session: attempt.createdSessionId });
          router.replace('/(tabs)');
          break;
        }

        case 'needs_first_factor': {
          // Identifier-first flow — submit the password as the first factor now.
          const result = await signIn!.attemptFirstFactor({ strategy: 'password', password: pwd });
          await advance(result, pwd, emailVal, remember);
          break;
        }

        case 'needs_second_factor': {
          const sf = attempt.supportedSecondFactors?.[0];
          const strategy = (sf?.strategy as string) ?? 'totp';
          setMfaStrategy(strategy);
          // email_code / phone_code need to be prepared before the user can submit.
          if (strategy !== 'totp' && strategy !== 'backup_code') {
            await signIn!.prepareSecondFactor({ strategy: strategy as any });
          }
          setMfaCode('');
          setMfaStep(true);
          break;
        }

        case 'needs_client_trust': {
          // Clerk's Bot Protection (Cloudflare Turnstile) is blocking sign-in.
          // @clerk/clerk-expo on web cannot run the Turnstile challenge.
          // Fix: Clerk Dashboard → Configure → Attack Protection → Bot Protection → OFF.
          setError(
            'Sign-in is blocked by bot protection. Please disable Bot Protection in your Clerk dashboard (Configure → Attack Protection → Bot Protection) and try again.',
          );
          break;
        }

        default: {
          setError(`Sign-in could not be completed. Please try again or use Google Sign-In.`);
        }
      }
    },
    [signIn, setActive, router, persistRemember],
  );

  const onSignInPress = useCallback(async () => {
    if (!isLoaded || submitting) return;
    setError(null);
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setSubmitting(true);
    try {
      const attempt = await signIn!.create({ identifier: email.trim(), password });
      await advance(attempt, password, email.trim(), rememberMe);
    } catch (err: any) {
      setError(clerkMsg(err));
    } finally {
      setSubmitting(false);
    }
  }, [isLoaded, submitting, email, password, rememberMe, signIn, advance]);

  // ── MFA second-factor submit ─────────────────────────────────────────────
  const onMfaSubmit = useCallback(async () => {
    if (!isLoaded || mfaSubmitting) return;
    setError(null);
    if (!mfaCode.trim()) {
      setError('Enter the verification code.');
      return;
    }
    setMfaSubmitting(true);
    try {
      const attempt = await signIn!.attemptSecondFactor({
        strategy: mfaStrategy as any,
        code: mfaCode.trim(),
      });
      if (attempt.status === 'complete') {
        persistRemember(email.trim(), rememberMe);
        await setActive({ session: attempt.createdSessionId });
        router.replace('/(tabs)');
      } else {
        setError('Verification failed. Please try again.');
      }
    } catch (err: any) {
      setError(clerkMsg(err));
    } finally {
      setMfaSubmitting(false);
    }
  }, [isLoaded, mfaSubmitting, mfaCode, mfaStrategy, signIn, setActive, email, rememberMe, router, persistRemember]);

  // ── Google SSO ───────────────────────────────────────────────────────────
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
      setError(clerkMsg(err));
    } finally {
      setGoogleLoading(false);
    }
  }, [googleLoading, startSSOFlow, router]);

  // ── Derived labels ───────────────────────────────────────────────────────
  const mfaTitle =
    mfaStrategy === 'totp' ? 'Check your authenticator' : 'Check your inbox';
  const mfaSubtitle =
    mfaStrategy === 'totp'
      ? 'Enter the 6-digit code from your authenticator app.'
      : mfaStrategy === 'email_code'
      ? 'A verification code was sent to your email.'
      : 'A verification code was sent to your phone.';

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <Image
          source={require('../assets/images/ko-logo.png')}
          style={styles.logoBadge}
          resizeMode="cover"
        />

        {/* ── MFA step ─────────────────────────────────────────────────── */}
        {mfaStep ? (
          <>
            <Text style={styles.title}>{mfaTitle}</Text>
            <Text style={styles.subtitle}>{mfaSubtitle}</Text>

            <Text style={styles.label}>Verification code</Text>
            <TextInput
              style={styles.input}
              value={mfaCode}
              onChangeText={setMfaCode}
              placeholder="000000"
              placeholderTextColor="#9ca3af"
              keyboardType="number-pad"
              maxLength={8}
              autoFocus
              onSubmitEditing={onMfaSubmit}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={styles.submitBtn}
              onPress={onMfaSubmit}
              disabled={mfaSubmitting}
              activeOpacity={0.85}
            >
              {mfaSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>Verify</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => { setMfaStep(false); setMfaCode(''); setError(null); }}
              activeOpacity={0.7}
            >
              <ArrowLeft size={14} color={Colors.light.textSecondary} />
              <Text style={styles.backBtnText}>Back to sign in</Text>
            </TouchableOpacity>
          </>
        ) : (
          /* ── Normal sign-in ──────────────────────────────────────────── */
          <>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Sign in to Katalyst Ko OS</Text>

            <TouchableOpacity
              style={styles.googleBtn}
              onPress={onGooglePress}
              disabled={googleLoading}
              activeOpacity={0.8}
            >
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
                placeholder="Enter your password"
                placeholderTextColor="#9ca3af"
                secureTextEntry={!showPassword}
                autoComplete="current-password"
                onSubmitEditing={onSignInPress}
              />
              <TouchableOpacity
                onPress={() => setShowPassword((s) => !s)}
                style={styles.eyeBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {showPassword ? <EyeOff size={18} color="#6b7280" /> : <Eye size={18} color="#6b7280" />}
              </TouchableOpacity>
            </View>

            <View style={styles.rememberForgotRow}>
              <TouchableOpacity
                style={styles.rememberRow}
                onPress={() => setRememberMe((v) => !v)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                  {rememberMe && <Check size={11} color="#fff" strokeWidth={3} />}
                </View>
                <Text style={styles.rememberLabel}>Remember me</Text>
              </TouchableOpacity>

              <Link href="/forgot-password" asChild>
                <TouchableOpacity>
                  <Text style={styles.forgotText}>Forgot password?</Text>
                </TouchableOpacity>
              </Link>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={styles.submitBtn}
              onPress={onSignInPress}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>Sign in</Text>
              )}
            </TouchableOpacity>

            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Don&apos;t have an account? </Text>
              <Link href="/sign-up" replace asChild>
                <TouchableOpacity>
                  <Text style={styles.footerLink}>Sign up</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </>
        )}
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
  logoBadge: {
    alignSelf: 'center',
    width: 80,
    height: 80,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  title: { fontSize: 26, fontWeight: '800', color: Colors.light.text, textAlign: 'center' },
  subtitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 24,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: '#fff',
  },
  googleBtnText: { fontSize: 15, fontWeight: '600', color: Colors.light.text },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  divider: { flex: 1, height: 1, backgroundColor: Colors.light.border },
  dividerText: { marginHorizontal: 12, color: '#9ca3af', fontSize: 13 },
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
  passwordInput: {
    flex: 1,
    height: 48,
    paddingHorizontal: 14,
    fontSize: 15,
    color: Colors.light.text,
  },
  eyeBtn: { paddingHorizontal: 12, paddingVertical: 12 },
  rememberForgotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  rememberRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  rememberLabel: { fontSize: 13, color: Colors.light.text, fontWeight: '500' },
  forgotText: { color: Colors.light.primary, fontSize: 13, fontWeight: '600' },
  error: { color: Colors.light.error, fontSize: 13, marginBottom: 12 },
  submitBtn: {
    height: 50,
    borderRadius: 10,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 22 },
  footerText: { color: Colors.light.textSecondary, fontSize: 14 },
  footerLink: { color: Colors.light.primary, fontSize: 14, fontWeight: '700' },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
  },
  backBtnText: { fontSize: 13, color: Colors.light.textSecondary, fontWeight: '500' },
});
