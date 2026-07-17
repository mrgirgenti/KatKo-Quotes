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

export default function HubAuthShell({ children, scroll = false }: HubAuthShellProps) {
  const inner = (
    <View style={s.page}>
      <Image
        source={require('@/assets/images/ko-logo-new.webp')}
        style={s.watermark}
        resizeMode="contain"
      />
      {children}
    </View>
  );

  if (scroll) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: HUB_BG }}
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
    backgroundColor: HUB_BG,
    ...(Platform.OS === 'web' ? { minHeight: '100vh' as any } : {}),
    overflow: 'hidden' as any,
  },
  watermark: {
    position: 'absolute',
    width: 700,
    height: 280,
    right: -40,
    bottom: 50,
    opacity: 0.048,
    tintColor: '#ffffff',
  },
});
