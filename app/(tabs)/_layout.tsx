import { Slot } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { View, Platform, StyleSheet } from 'react-native';
import { Sidebar } from '@/components/Sidebar';
import { MobileTopBar, MobileDrawerOverlay } from '@/components/MobileDrawer';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { ContactProfileSheet } from '@/contexts/ContactProfileContext';

export default function TabLayout() {
  const { isMobile, isTablet } = useBreakpoint();
  const [mounted, setMounted] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => setMounted(true), []);

  // SSR and the first client render must be identical to avoid a hydration
  // mismatch. On the server `useBreakpoint` reports width 0 (which would look
  // "mobile"), so until we have mounted on the client we deterministically use
  // the desktop sidebar on web. After mount we apply the real breakpoint.
  const useMobileShell = mounted ? isMobile : Platform.OS !== 'web';

  // ── Single unified return ──────────────────────────────────────────────
  // <Slot /> is ALWAYS at the same React tree position:
  //   root > body > content > Slot
  //
  // This means React never unmounts the page when the window crosses the
  // mobile/desktop breakpoint, so form state (TextInputs, etc.) is preserved
  // across resizes. Only the sidebar / top-bar chrome switches.
  return (
    <View style={s.root}>
      {/* Mobile top bar — position 0, null on desktop */}
      {useMobileShell ? (
        <MobileTopBar onOpenDrawer={() => setDrawerOpen(true)} />
      ) : null}

      {/* Content row — position 1, ALWAYS rendered */}
      <View style={s.body}>
        {/* Sidebar — position 0 inside body, null on mobile */}
        {!useMobileShell ? (
          <Sidebar
            key={mounted ? 'sidebar' : 'sidebar-init'}
            defaultCollapsed={isTablet}
          />
        ) : null}

        {/* Page content — position 1 inside body, ALWAYS at this exact path */}
        <View key="page-content" style={s.content}>
          <Slot />
          {/* Desktop-only contact profile slide-over (Modal portal) */}
          {mounted && !useMobileShell && <ContactProfileSheet />}
        </View>
      </View>

      {/* Mobile drawer overlay — position 2, null on desktop */}
      {useMobileShell ? (
        <MobileDrawerOverlay
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
        />
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    outlineStyle: 'none' as any,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    outlineStyle: 'none' as any,
  },
  content: {
    flex: 1,
    overflow: 'hidden' as any,
    outlineStyle: 'none' as any,
  },
});
