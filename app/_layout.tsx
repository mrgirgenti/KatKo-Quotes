'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { TouchableOpacity, Text } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';

import { QuotesProvider } from '@/contexts/QuotesContext';
import { UserProvider } from '@/contexts/UserContext';
import { CrmProvider } from '@/contexts/CrmContext';

SplashScreen.preventAutoHideAsync();

// Web-only, app-wide: eliminate every browser-drawn focus artifact. RN-web renders
// containers (ScrollViews, Pressables, the nav) as focusable <div>s; on focus the
// browser paints a blue ring — via `outline` AND, on some container/scroll <div>s,
// via `box-shadow`. The ring only appears AFTER a click/keyboard focus, so it never
// shows on a fresh load (or in screenshots) but is highly visible to users; on an
// element that overflows the viewport (e.g. a horizontal-scroll table whose content
// is wider/taller than the screen) only the ring's LEFT edge is visible — i.e. a
// stray vertical blue line. Earlier resets only stripped box-shadow from
// a/button/[tabindex], leaving plain scroll <div>s uncovered. This strips outline
// AND box-shadow from EVERY focus state, app-wide. Injected at module scope so it
// applies before first paint (not just inside an effect). Inputs rely on their own
// border styling for focus, so removing the default ring is safe.
const KK_FOCUS_RESET_CSS =
  '*{-webkit-tap-highlight-color:transparent;}' +
  '*:focus,*:focus-visible{outline:none !important;box-shadow:none !important;}' +
  '::-moz-focus-inner{border:0 !important;}';

function injectFocusReset() {
  if (typeof document === 'undefined') return;
  const STYLE_ID = 'kk-global-focus-reset';
  const existing = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (existing) {
    existing.textContent = KK_FOCUS_RESET_CSS;
  } else {
    const el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = KK_FOCUS_RESET_CSS;
    document.head.appendChild(el);
  }
}

injectFocusReset();

function HeaderBackButton() {
  const router = useRouter();
  return (
    <TouchableOpacity
      onPress={() => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/(tabs)' as any);
        }
      }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        paddingLeft: 4,
        paddingRight: 8,
        paddingVertical: 6,
      }}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <ChevronLeft size={20} color="#fff" />
      <Text style={{ color: '#fff', fontSize: 15, fontWeight: '500' }}>Back</Text>
    </TouchableOpacity>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { networkMode: 'always' },
    mutations: { networkMode: 'always' },
  },
});

function RootLayoutNav() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#000000' },
        headerTintColor: '#fff',
        headerLeft: () => <HeaderBackButton />,
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="quote/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="quote/production/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="quote/edit" options={{ headerShown: false }} />
      <Stack.Screen name="quote/sales-tracking" options={{ headerShown: false }} />
      <Stack.Screen name="profile" options={{ title: 'Profile', presentation: 'modal' }} />
      <Stack.Screen name="clients/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="crm/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="hub/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="portal/[orgId]" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
    if (typeof document !== 'undefined') {
      document.documentElement.style.zoom = '0.9';
      // Re-assert the focus-artifact reset after hydration (idempotent; the same
      // block is also injected at module scope above so it covers first paint).
      injectFocusReset();
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <UserProvider>
          <QuotesProvider>
            <CrmProvider>
              <RootLayoutNav />
            </CrmProvider>
          </QuotesProvider>
        </UserProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
