import { Slot } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { View, Platform, StyleSheet } from 'react-native';
import { Sidebar } from '@/components/Sidebar';
import { MobileShell } from '@/components/MobileDrawer';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { ContactProfileSheet } from '@/contexts/ContactProfileContext';

export default function TabLayout() {
  const { isMobile, isTablet } = useBreakpoint();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // SSR and the first client render must be identical to avoid a hydration
  // mismatch. On the server `useBreakpoint` reports width 0 (which would look
  // "mobile"), so until we have mounted on the client we deterministically use
  // the desktop sidebar on web. After mount we apply the real breakpoint.
  const useMobileShell = mounted ? isMobile : Platform.OS !== 'web';

  if (!useMobileShell) {
    return (
      <View style={styles.webLayout}>
        {/* Remount once after hydration so tablet's default-collapsed applies. */}
        <Sidebar key={mounted ? 'sidebar' : 'sidebar-init'} defaultCollapsed={isTablet} />
        <View style={styles.webContent}>
          <Slot />
          {/* Desktop-only contact profile slide-over (Modal portal, always above page) */}
          {mounted && <ContactProfileSheet />}
        </View>
      </View>
    );
  }

  return (
    <MobileShell>
      <Slot />
    </MobileShell>
  );
}

const styles = StyleSheet.create({
  webLayout: {
    flex: 1,
    flexDirection: 'row',
    outlineStyle: 'none' as any,
  },
  webContent: {
    flex: 1,
    overflow: 'hidden' as any,
    outlineStyle: 'none' as any,
  },
});
