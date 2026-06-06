import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Shield, CheckCircle2, AlertCircle } from 'lucide-react-native';

const BRAND = '#FF5A00';

export default function ResetPassword() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const router = useRouter();

  const [validating, setValidating] = useState(true);
  const [tokenError, setTokenError] = useState('');
  const [userEmail, setUserEmail] = useState('');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) {
      setTokenError('No reset token found. Please use the link from your email.');
      setValidating(false);
      return;
    }
    fetch(`/api/portal/reset-password?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setTokenError(data.error || 'Invalid or expired reset link.');
        } else {
          setUserEmail(data.email || '');
        }
      })
      .catch(() => setTokenError('Could not validate reset link. Please try again.'))
      .finally(() => setValidating(false));
  }, [token]);

  const handleSubmit = useCallback(async () => {
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/portal/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to reset password.'); return; }
      setDone(true);
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [token, password, confirm]);

  return (
    <View style={s.screen}>
      <View style={s.card}>
        <View style={s.header}>
          <Shield size={28} color={BRAND} />
          <Text style={s.headerTitle}>KATALYST KO</Text>
          <Text style={s.headerSub}>Client Hub</Text>
        </View>

        {validating ? (
          <View style={s.center}>
            <ActivityIndicator color={BRAND} size="large" />
            <Text style={s.loadingText}>Validating link…</Text>
          </View>
        ) : tokenError ? (
          <View style={s.center}>
            <AlertCircle size={36} color="#DC2626" />
            <Text style={s.errorTitle}>Link Invalid</Text>
            <Text style={s.errorBody}>{tokenError}</Text>
            <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
              <Text style={s.backBtnText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        ) : done ? (
          <View style={s.center}>
            <CheckCircle2 size={40} color="#16A34A" />
            <Text style={s.successTitle}>Password Set!</Text>
            <Text style={s.successBody}>
              Your new password has been saved. You can now log in to your client hub.
            </Text>
            <TouchableOpacity style={s.submitBtn} onPress={() => router.back()}>
              <Text style={s.submitBtnText}>Go to Hub Login</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={s.title}>Set a new password</Text>
            {userEmail ? <Text style={s.sub}>for {userEmail}</Text> : null}

            <Text style={s.label}>New Password</Text>
            <TextInput
              style={s.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="Min. 8 characters"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
            />

            <Text style={[s.label, { marginTop: 14 }]}>Confirm Password</Text>
            <TextInput
              style={s.input}
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
              placeholder="Repeat password"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              onSubmitEditing={handleSubmit}
            />

            {error ? <Text style={s.fieldError}>{error}</Text> : null}

            <TouchableOpacity
              style={[s.submitBtn, (submitting || !password || !confirm) && { opacity: 0.4 }]}
              onPress={handleSubmit}
              disabled={submitting || !password || !confirm}
            >
              {submitting
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={s.submitBtnText}>Set Password</Text>}
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 8,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: BRAND,
    marginTop: 8,
    letterSpacing: 1,
  },
  headerSub: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  center: {
    alignItems: 'center',
    paddingVertical: 12,
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 12,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#DC2626',
    marginTop: 8,
  },
  errorBody: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 4,
  },
  backBtn: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#065F46',
    marginTop: 8,
  },
  successBody: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 4,
    maxWidth: 280,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
    marginBottom: 4,
  },
  sub: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111',
    backgroundColor: '#FAFAFA',
  },
  fieldError: {
    fontSize: 13,
    color: '#DC2626',
    marginTop: 8,
  },
  submitBtn: {
    backgroundColor: BRAND,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
