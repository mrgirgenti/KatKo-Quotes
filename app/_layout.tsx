'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { TouchableOpacity, Text } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { ClerkProvider, useAuth } from '@clerk/clerk-expo';
import { tokenCache } from '@clerk/clerk-expo/token-cache';

import { QuotesProvider } from '@/contexts/QuotesContext';
import { UserProvider } from '@/contexts/UserContext';
import { CrmProvider } from '@/contexts/CrmContext';
import { ActionsProvider } from '@/contexts/ActionsContext';
import { setClerkTokenGetter } from '@/lib/clerkToken';

const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';

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
  '*{-webkit-tap-highlight-color:transparent!important;outline:none!important;}' +
  '*:focus,*:focus-visible,*:focus-within{outline:none!important;box-shadow:none!important;}' +
  // Suppress any hover-triggered box-shadow that RN Web injects via class rules.
  // The global outline:none above catches outline on hover, but box-shadow on
  // non-focused elements (e.g. Animated.View sidebar container on mouseenter)
  // requires an explicit :hover rule. Scoped to non-input elements so form field
  // hover styles are unaffected.
  '*:not(input):not(textarea):not(select):hover{box-shadow:none!important;}' +
  '::-moz-focus-inner{border:0!important;}' +
  'html,body,#root,#__next{outline:none!important;box-shadow:none!important;}' +
  'div:focus,div:focus-visible,[tabindex]:focus,[tabindex]:focus-visible{outline:none!important;box-shadow:none!important;}' +
  '[data-rnw-scrollview]:focus,[data-rnw-scrollview]:focus-visible{outline:none!important;box-shadow:none!important;}' +
  // Safari ignores scrollbar-width:none (a Firefox/Chrome feature). Without this,
  // Safari renders its native scrollbar track on overflow:scroll containers using
  // the system accent colour (blue on most macOS/iOS setups), which shows as a
  // persistent thin blue vertical line at the right edge of any scrollable panel
  // (e.g. the sidebar nav ScrollView). Suppressing ::-webkit-scrollbar globally
  // is the correct cross-browser fix; this block is re-injected here (runtime)
  // to complement the identical rule already in the SSR <head> via +html.tsx.
  '*::-webkit-scrollbar{display:none!important;width:0!important;height:0!important;}' +
  '*::-webkit-scrollbar-track{background:transparent!important;}' +
  '*::-webkit-scrollbar-thumb{background:transparent!important;}' +
  '*::-webkit-scrollbar-corner{background:transparent!important;}';

function injectFocusReset() {
  if (typeof document === 'undefined') return;
  // Layer 1: CSS rule — always remove & re-append so our tag is LAST in <head>,
  // guaranteeing it wins over any RN Web stylesheets injected before us.
  const STYLE_ID = 'kk-global-focus-reset';
  const existing = document.getElementById(STYLE_ID);
  if (existing) existing.remove();
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = KK_FOCUS_RESET_CSS;
  document.head.appendChild(el);
  // Layer 2: focus event listener — strips any inline outline/box-shadow RN Web
  // applies AFTER the focus event fires. NOTE: deliberately does NOT blur the
  // element or rewrite tabindex. Earlier "nuclear" versions force-blurred every
  // focused element back to <body> on every focus and rewrote all tabindex="0"
  // → "-1"; that churn (a) broke keyboard accessibility and (b) repainted the
  // Replit preview-iframe's own focus ring on every mouse-enter (the stray blue
  // line is the iframe ring drawn by the parent page — unreachable from CSS here
  // and absent when the app runs in its own tab). Stripping inline styles is
  // enough; the CSS in Layer 1 already removes real in-app focus outlines.
  // Spare real form controls so keyboard users keep their native focus ring.
  // Everything else (RN-web div wrappers, ScrollViews, Pressables, root containers)
  // gets its inline outline/box-shadow stripped.
  const isFormControl = (el: HTMLElement) => {
    const t = el.tagName?.toLowerCase() ?? '';
    return t === 'input' || t === 'textarea' || t === 'select';
  };
  if (!(window as any).__kkFocusListenerBound) {
    (window as any).__kkFocusListenerBound = true;
    const kkStripFocus = (el: HTMLElement | null) => {
      if (!el || !el.style || isFormControl(el)) return;
      el.style.setProperty('outline', 'none', 'important');
      el.style.setProperty('box-shadow', 'none', 'important');
    };
    // Startup scan: strip any element that is already focused when this code runs
    // (covers the loading-skeleton phase where focus may be set before this listener).
    kkStripFocus(document.activeElement as HTMLElement | null);
    document.addEventListener('focus', (e) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      kkStripFocus(t);
      requestAnimationFrame(() => kkStripFocus(t));
    }, true);
  }
  // Layer 3: Head MutationObserver — keep our style tag LAST in <head> at all times.
  // RN Web lazily injects component CSS class rules when components first mount (e.g.
  // the Animated.View sidebar container hover box-shadow class). Those <style> tags are
  // appended to <head> AFTER this function has already run. In CSS, when two rules both
  // carry !important and equal specificity, the LATER declaration wins — so any RN Web
  // class appended after our tag would override our hover suppression. Watching head and
  // moving our tag to the end on every insertion guarantees our rules always win.
  if (!(window as any).__kkHeadObserverBound) {
    (window as any).__kkHeadObserverBound = true;
    const reorderKkStyle = () => {
      const s = document.getElementById('kk-global-focus-reset');
      if (s && document.head.lastChild !== s) document.head.appendChild(s);
    };
    new MutationObserver(reorderKkStyle).observe(document.head, { childList: true });
  }
  // Layer 4: Body style MutationObserver — catches any inline outline OR box-shadow
  // added to elements after render (RN Web may set these via JS on focus/hover).
  if (!(window as any).__kkStyleObserverBound) {
    (window as any).__kkStyleObserverBound = true;
    const styleObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        const el = m.target as HTMLElement;
        if (!el.style || isFormControl(el)) continue;
        const o = el.style.getPropertyValue('outline');
        const bs = el.style.getPropertyValue('box-shadow');
        if ((o && o !== 'none') || (bs && bs !== 'none')) {
          el.style.setProperty('outline', 'none', 'important');
          el.style.setProperty('box-shadow', 'none', 'important');
        }
      }
    });
    const startStyleMO = () => {
      styleObserver.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['style'] });
    };
    if (document.body) {
      startStyleMO();
    } else {
      document.addEventListener('DOMContentLoaded', startStyleMO);
    }
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

// Client-side auth gate. The real security boundary is server-side (API routes
// verify the Clerk session); this only handles UX redirects. Portal routes are a
// separate client-facing auth system and are intentionally NOT gated by Clerk.
function AuthGate() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  // Expose Clerk's token getter to non-React modules (apiFetch) so every API
  // request carries the session token for server-side verification.
  useEffect(() => {
    setClerkTokenGetter(() => getToken());
    return () => setClerkTokenGetter(null);
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!pathname) return;
    const isPortal = pathname.startsWith('/portal');
    const isAuthRoute = pathname === '/sign-in' || pathname === '/sign-up' || pathname === '/forgot-password';
    if (isPortal) return;
    if (!isSignedIn && !isAuthRoute) {
      router.replace('/sign-in');
    } else if (isSignedIn && isAuthRoute) {
      router.replace('/(tabs)');
    }
  }, [isLoaded, isSignedIn, pathname, router]);

  return null;
}

function RootLayoutNav() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#000000' },
        headerTintColor: '#fff',
        headerLeft: () => <HeaderBackButton />,
      }}
    >
      <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      <Stack.Screen name="sign-up" options={{ headerShown: false }} />
      <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="quote/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="quote/production/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="quote/edit" options={{ headerShown: false }} />
      <Stack.Screen name="quote/sales-tracking" options={{ headerShown: false }} />
      <Stack.Screen name="profile" options={{ title: 'Profile', presentation: 'modal' }} />
      <Stack.Screen name="clients/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="crm/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="portal/[orgId]" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
    if (typeof document !== 'undefined') {
      // NOTE: the app-wide 90% zoom is declared in the SSR <head> (app/+html.tsx,
      // APP_ZOOM_CSS) so it applies on first paint. It used to be set here in a
      // post-hydration effect, which caused a visible "large → small" resize flash
      // on every load (most noticeable on the portal login card). Do not re-add it.
      // Re-assert the focus-artifact reset after hydration (idempotent; the same
      // block is also injected at module scope above so it covers first paint).
      injectFocusReset();
    }
  }, []);

  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} tokenCache={tokenCache}>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <UserProvider>
            <QuotesProvider>
              <CrmProvider>
                <ActionsProvider>
                  <AuthGate />
                  <RootLayoutNav />
                </ActionsProvider>
              </CrmProvider>
            </QuotesProvider>
          </UserProvider>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </ClerkProvider>
  );
}
