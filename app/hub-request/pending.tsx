import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { CheckCircle2, Clock } from 'lucide-react-native';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import HubAuthShell, { HUB_ORANGE, HUB_WHITE } from '@/components/HubAuthShell';

export default function HubRequestPendingPage() {
  const router = useRouter();
  const { type, orgName } = useLocalSearchParams<{ type: string; orgName: string }>();
  const { isDesktop, isTablet } = useBreakpoint();
  const wide = isDesktop || isTablet;

  const isActivated = type === 'activate';

  return (
    <HubAuthShell scroll={!wide}>
      <View style={wide ? s.desktopCenter : s.mobilePage}>
        <Image
          source={require('@/assets/images/ko-logo-horizontal.png')}
          style={wide ? s.desktopLogo : s.mobileLogo}
          resizeMode="contain"
        />
        <View style={s.card}>
          <View style={s.iconWrap}>
            {isActivated
              ? <CheckCircle2 size={48} color={HUB_ORANGE} />
              : <Clock size={48} color={HUB_ORANGE} />}
          </View>

          <Text style={s.title}>
            {isActivated ? 'Hub Activated!' : 'Request Submitted!'}
          </Text>

          <Text style={s.body}>
            {isActivated
              ? `The Client Hub for ${orgName ? `"${orgName}"` : 'your organization'} is now active. You can log in with the password you just created.`
              : type === 'join'
                ? `Your request to join ${orgName ? `"${orgName}"` : 'the hub'} has been sent. You'll be notified by email once it's approved.`
                : `Your request has been received. We'll review your information and reach out soon to get your Client Hub set up.`}
          </Text>

          {isActivated ? (
            <TouchableOpacity style={s.btn} onPress={() => router.replace('/hub-login' as any)}>
              <Text style={s.btnText}>LOG IN NOW</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={s.btnOutline} onPress={() => router.replace('/hub-login' as any)}>
              <Text style={s.btnOutlineText}>Back to Login</Text>
            </TouchableOpacity>
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
    width: '100%', maxWidth: 440, backgroundColor: HUB_WHITE,
    borderRadius: 14, padding: 40, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.4, shadowRadius: 32, elevation: 14,
  },
  iconWrap: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: '#FFF4EE',
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  title: { fontSize: 24, fontWeight: '700', color: '#111', textAlign: 'center', marginBottom: 14 },
  body: { fontSize: 14, color: '#555', lineHeight: 22, textAlign: 'center', marginBottom: 32 },
  btn: {
    backgroundColor: HUB_ORANGE, borderRadius: 8, paddingVertical: 15,
    paddingHorizontal: 40, alignItems: 'center',
  },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 1 },
  btnOutline: {
    borderWidth: 1.5, borderColor: HUB_ORANGE, borderRadius: 8,
    paddingVertical: 14, paddingHorizontal: 40, alignItems: 'center',
  },
  btnOutlineText: { color: HUB_ORANGE, fontSize: 15, fontWeight: '600' },
});
