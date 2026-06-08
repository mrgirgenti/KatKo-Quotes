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
  '*{-webkit-tap-highlight-color:transparent!important;outline:none!important;}' +
  '*:focus,*:focus-visible,*:focus-within{outline:none!important;box-shadow:none!important;}' +
  // Suppress any hover-triggered box-shadow that RN Web injects via class rules.
  // The global outline:none above catches outline on hover, but box-shadow on
  // non-focused elements (e.g. Animated.View sidebar container on mouseenter)
  // requires an explicit :hover rule. Scoped to non-input elements so form field
  // hover styles are unaffected.
  '*:not(input):not(textarea):not(select):hover{box-shadow:none!important;}' +
  '::-moz-focus-inner{border:0!important;}' +
  'html,body{outline:none!important;}' +
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
  if (!(window as any).__kkFocusListenerBound) {
    (window as any).__kkFocusListenerBound = true;
    const kkStripFocus = (el: HTMLElement | null) => {
      if (!el || !el.style) return;
      el.style.setProperty('outline', 'none', 'important');
      el.style.setProperty('box-shadow', 'none', 'important');
    };
    document.addEventListener('focus', (e) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      kkStripFocus(t);
      requestAnimationFrame(() => kkStripFocus(t));
    }, true);
  }
  // Layer 4: style MutationObserver — catches any inline outline added after render.
  if (!(window as any).__kkStyleObserverBound) {
    (window as any).__kkStyleObserverBound = true;
    const styleObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        const el = m.target as HTMLElement;
        if (el.style) {
          const o = el.style.getPropertyValue('outline');
          if (o && o !== 'none') {
            el.style.setProperty('outline', 'none', 'important');
            el.style.setProperty('box-shadow', 'none', 'important');
          }
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

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const isBlue = (c: string) => {
      if (!c) return false;
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return /blue|#00?7|#1a73|#2563|#3b82|#0a8/i.test(c);
      const [r, g, b] = m[1].split(',').map((n) => parseFloat(n));
      return b > 120 && b > r + 30 && b > g + 30;
    };
    const desc = (el: HTMLElement | null) => {
      if (!el) return 'none';
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const cls = typeof el.className === 'string' ? el.className.split(' ').slice(0, 3).join('.') : '';
      return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}.${cls} | rect(x=${Math.round(r.x)},y=${Math.round(r.y)},w=${Math.round(r.width)},h=${Math.round(r.height)}) | tabindex=${el.getAttribute('tabindex')} | outline=${cs.outline} | outlineColor=${cs.outlineColor} | boxShadow=${cs.boxShadow.slice(0, 80)} | borderL=${cs.borderLeftWidth} ${cs.borderLeftColor}`;
    };
    const scan = (reason: string) => {
      const vh = window.innerHeight;
      const hits: string[] = [];
      document.querySelectorAll('*').forEach((n) => {
        const el = n as HTMLElement;
        let cs: CSSStyleDeclaration;
        try { cs = getComputedStyle(el); } catch { return; }
        const r = el.getBoundingClientRect();
        const thinTall = r.width > 0 && r.width <= 8 && r.height >= vh * 0.3;
        const blueOutline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0 && isBlue(cs.outlineColor);
        const blueShadow = cs.boxShadow && cs.boxShadow !== 'none' && isBlue(cs.boxShadow);
        if (thinTall || blueOutline || blueShadow) hits.push(`[${reason}] ${desc(el)}`);
      });
      console.log(`%c[KK2 ${reason}] activeEl=${desc(document.activeElement as HTMLElement)} | hits=${hits.length}`, 'color:#fff;background:#0a6;padding:2px');
      hits.forEach((h) => console.log('[KK2]', h));
    };
    const onFocus = () => { scan('win-focus'); requestAnimationFrame(() => scan('win-focus-raf')); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('focusin', () => scan('focusin'));
    const iv = setInterval(() => scan('interval'), 2000);
    (window as any).kk2 = scan;
    return () => { window.removeEventListener('focus', onFocus); clearInterval(iv); };
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
