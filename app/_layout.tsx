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
  // Layer 2: focus event listener — immediate removal + deferred removal via rAF
  // to catch RN Web handlers that apply inline outline AFTER the focus event fires.
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
      // Strip outline immediately + via rAF for async RN Web injection
      kkStripFocus(t);
      requestAnimationFrame(() => kkStripFocus(t));
      // Nuclear: blur any non-form element so no focus state can exist.
      // setTimeout(0) defers until after press/click handlers have fired,
      // so tap actions complete before focus is removed.
      const tag = (t.tagName || '').toLowerCase();
      if (tag !== 'input' && tag !== 'textarea' && tag !== 'select' && !t.isContentEditable) {
        setTimeout(() => {
          if (document.activeElement === t) t.blur();
        }, 0);
      }
    }, true);
  }
  // Layer 3: MutationObserver — strips tabIndex="0" from any non-form element
  // the moment it appears in the DOM. Without tabIndex, the browser has no
  // programmatic way to give these elements keyboard focus; combined with the
  // blur listener above, this makes stray focus rings impossible.
  if (!(window as any).__kkTabIndexObserverBound) {
    (window as any).__kkTabIndexObserverBound = true;
    const FORM_TAGS = new Set(['input', 'textarea', 'select', 'button', 'a']);
    const kkStripTabIndex = (node: Element) => {
      const el = node as HTMLElement;
      if (!el.tagName) return;
      const tag = el.tagName.toLowerCase();
      if (!FORM_TAGS.has(tag) && el.getAttribute('tabindex') === '0') {
        el.setAttribute('tabindex', '-1');
      }
      // Also handle all descendants
      el.querySelectorAll?.('[tabindex="0"]').forEach((child: Element) => {
        const childTag = child.tagName.toLowerCase();
        if (!FORM_TAGS.has(childTag)) {
          child.setAttribute('tabindex', '-1');
        }
      });
    };
    const tabMO = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType === 1) kkStripTabIndex(node as Element);
        }
        // Also handle attribute changes (RN Web may add tabIndex after initial render)
        if (m.type === 'attributes' && m.attributeName === 'tabindex') {
          kkStripTabIndex(m.target as Element);
        }
      }
    });
    const startTabMO = () => {
      // Strip existing elements immediately
      document.querySelectorAll('[tabindex="0"]').forEach(kkStripTabIndex);
      tabMO.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['tabindex'],
      });
    };
    if (document.body) {
      startTabMO();
    } else {
      document.addEventListener('DOMContentLoaded', startTabMO);
    }
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
