import React from 'react';
import { View, Image, StyleSheet, ScrollView, Platform } from 'react-native';

export const HUB_BG = '#0c0c0c';
export const HUB_ORANGE = '#FF5A00';
export const HUB_WHITE = '#ffffff';
export const HUB_DIM = '#8a8a8a';
export const HUB_BORDER = 'rgba(255,255,255,0.08)';

interface HubAuthShellProps {
  children: React.ReactNode;
  scroll?: boolean;
}

// Full-bleed branded background — same recipe as the main login hero.
// Used by all hub auth pages (forgot, reset, request flow, etc.).
// The main login page renders its own background layers on top, so no conflict.
function HeroBg() {
  return (
    <View style={[StyleSheet.absoluteFillObject as any, { overflow: 'hidden' as any }]}>
      {/* Deep charcoal base with centered oversized logo */}
      <View style={{ flex: 1, backgroundColor: '#0d0d0d', alignItems: 'center', justifyContent: 'center' }}>
        <Image
          source={require('@/assets/images/ko-logo-new.webp')}
          style={s.heroBgLogo}
          resizeMode="contain"
        />
      </View>
      {/* Heavy overlay — logo is a whisper of depth, not a focal element */}
      <View style={[StyleSheet.absoluteFillObject as any, { backgroundColor: 'rgba(0,0,0,0.70)' }]} />
    </View>
  );
}

export default function HubAuthShell({ children, scroll = false }: HubAuthShellProps) {
  const inner = (
    <View style={s.page}>
      <HeroBg />
      {children}
    </View>
  );

  if (scroll) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: '#0d0d0d' }}
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        {inner}
      </ScrollView>
    );
  }
  return inner;
}

const s = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#0d0d0d',
    ...(Platform.OS === 'web' ? { minHeight: '100vh' as any } : {}),
    overflow: 'hidden' as any,
  },
  // Oversized centered logo — barely visible at ~2% effective opacity through the overlay
  heroBgLogo: {
    width: 1400,
    height: 380,
    opacity: 0.08,
    transform: [{ rotate: '-4deg' }],
  } as any,
});
