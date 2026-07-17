import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image, ActivityIndicator, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Building2, UserCheck } from 'lucide-react-native';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import HubAuthShell, {
  HUB_ORANGE, HUB_WHITE, HUB_DIM, HUB_BORDER,
} from '@/components/HubAuthShell';

export default function HubRequestJoinPage() {
  const router = useRouter();
  const { email, orgId, orgName, userName } = useLocalSearchParams<{
    email: string; orgId: string; orgName: string; userName: string;
  }>();
  const { isDesktop, isTablet } = useBreakpoint();
  const wide = isDesktop || isTablet;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRequest = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/hub/join-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, orgId }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Something went wrong.'); return; }
      router.replace(`/hub-request/pending?type=join&orgName=${encodeURIComponent(orgName ?? '')}` as any);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <HubAuthShell scroll={!wide}>
      <View style={wide ? s.desktopRow : s.mobilePage}>
        {wide ? (
          <View style={s.leftPanel}>
            <Image source={require('@/assets/images/ko-logo-horizontal.png')} style={s.leftLogo} resizeMode="contain" />
            <View style={s.divider} />
            <Text style={s.leftHeading}>Almost There.</Text>
            <Text style={s.leftSub}>
              Your organization already has an active Client Hub.{'\n\n'}
              Once approved, you'll have full access to your projects, files, and more.
            </Text>
          </View>
        ) : (
          <Image source={require('@/assets/images/ko-logo-horizontal.png')} style={s.mobileLogo} resizeMode="contain" />
        )}

        <View style={wide ? s.formCol : s.mobileForm}>
          <View style={s.card}>
            <View style={s.orgBadge}>
              <Building2 size={20} color={HUB_ORANGE} />
              <Text style={s.orgBadgeText}>{orgName || 'Your Organization'}</Text>
            </View>

            <Text style={s.title}>Request to Join</Text>
            <Text style={s.subtitle}>
              {userName ? `Hi ${userName.split(' ')[0]}! ` : ''}We found your account linked to{' '}
              <Text style={{ fontWeight: '600', color: '#111' }}>{orgName}</Text>, which already has an
              active Client Hub.
            </Text>
            <Text style={s.subtitle}>
              Submitting this request will notify both Katalyst Ko and the Hub admins at{' '}
              <Text style={{ fontWeight: '600', color: '#111' }}>{orgName}</Text>. Once approved,
              you'll receive an email to set up your password and log in.
            </Text>

            {error ? (
              <View style={s.errorBanner}><Text style={s.errorText}>{error}</Text></View>
            ) : null}

            <View style={s.emailConfirm}>
              <Text style={s.emailConfirmLabel}>Requesting access for</Text>
              <Text style={s.emailConfirmValue}>{email}</Text>
            </View>

            <TouchableOpacity
              style={[s.btn, loading && { opacity: 0.7 }]}
              onPress={handleRequest}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <View style={s.btnInner}>
                  <UserCheck size={16} color="#fff" />
                  <Text style={s.btnText}>SEND JOIN REQUEST</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={s.backLink} onPress={() => router.push('/hub-request' as any)}>
              <Text style={s.backLinkText}>← Use a different email</Text>
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
  divider: { height: 1, backgroundColor: HUB_BORDER, marginBottom: 28 },
  leftHeading: { fontSize: 36, fontWeight: '800', color: HUB_WHITE, marginBottom: 14, lineHeight: 42 },
  leftSub: { fontSize: 14, color: HUB_DIM, lineHeight: 22 },
  formCol: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, paddingVertical: 48 },
  mobileForm: { width: '100%', alignItems: 'center' },
  mobileLogo: { width: 180, height: 54, marginBottom: 28 },
  card: {
    width: '100%', maxWidth: 460, backgroundColor: HUB_WHITE,
    borderRadius: 14, padding: 36,
    shadowColor: '#000', shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.4, shadowRadius: 32, elevation: 14,
  },
  orgBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFF4EE', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12,
    alignSelf: 'flex-start', marginBottom: 20,
  },
  orgBadgeText: { fontSize: 13, fontWeight: '600', color: HUB_ORANGE },
  title: { fontSize: 22, fontWeight: '700', color: '#111', marginBottom: 12 },
  subtitle: { fontSize: 13, color: '#666', lineHeight: 20, marginBottom: 12 },
  errorBanner: { backgroundColor: '#FEE2E2', borderRadius: 8, padding: 12, marginBottom: 16 },
  errorText: { fontSize: 13, color: '#dc2626' },
  emailConfirm: {
    backgroundColor: '#f5f5f5', borderRadius: 8, padding: 14, marginBottom: 24,
    marginTop: 8,
  },
  emailConfirmLabel: { fontSize: 11, color: '#999', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  emailConfirmValue: { fontSize: 14, fontWeight: '600', color: '#111' },
  btn: {
    backgroundColor: HUB_ORANGE, borderRadius: 8, paddingVertical: 15,
    alignItems: 'center', marginBottom: 16,
  },
  btnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 1 },
  backLink: { alignItems: 'center' },
  backLinkText: { fontSize: 13, color: HUB_ORANGE, fontWeight: '500' },
});
