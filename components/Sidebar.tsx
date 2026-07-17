import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Animated,
  ScrollView,
} from 'react-native';
import { Menu } from 'lucide-react-native';
import { useUser } from '@/contexts/UserContext';
import { SB, SidebarNav, ProfileFooter, NewQuoteButton, KK_NAV_DATASET, KK_SIDEBAR_DATASET } from '@/components/SidebarContent';

const EXPANDED_WIDTH = 240;
const COLLAPSED_WIDTH = 64;
const LOGO_AVAILABLE_W = EXPANDED_WIDTH - 32; // 16px padding each side

const FALLBACK_LOGO_URI = '/ko-logo-new.webp';

const SIDEBAR_STORAGE_KEY = 'kk_sidebar_collapsed';

function readSidebarCollapsed(defaultVal: boolean): boolean {
  if (typeof window === 'undefined') return defaultVal;
  try {
    const v = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (v === null) return defaultVal;
    return v === '1';
  } catch {
    return defaultVal;
  }
}

interface SidebarProps {
  defaultCollapsed?: boolean;
}

export function Sidebar({ defaultCollapsed = false }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(() => readSidebarCollapsed(defaultCollapsed));
  const widthAnim = useRef(
    new Animated.Value(readSidebarCollapsed(defaultCollapsed) ? COLLAPSED_WIDTH : EXPANDED_WIDTH),
  ).current;

  const { orgAdmin } = useUser();
  const logoUri = orgAdmin?.companyLogo || FALLBACK_LOGO_URI;

  const [logoDims, setLogoDims] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    if (!logoUri) {
      setLogoDims(null);
      return;
    }
    Image.getSize(logoUri, (w, h) => setLogoDims({ w, h }), () => setLogoDims(null));
  }, [logoUri]);

  const computedLogoStyle = (() => {
    if (!logoDims) return { width: LOGO_AVAILABLE_W, height: 60 };
    const { w, h } = logoDims;
    if (w >= h) {
      return { width: LOGO_AVAILABLE_W, height: Math.round(LOGO_AVAILABLE_W * (h / w)) };
    }
    return { width: Math.round(LOGO_AVAILABLE_W * (w / h)), height: LOGO_AVAILABLE_W };
  })();

  const toggle = () => {
    const next = !collapsed;
    Animated.timing(widthAnim, {
      toValue: next ? COLLAPSED_WIDTH : EXPANDED_WIDTH,
      duration: 200,
      useNativeDriver: false,
    }).start();
    setCollapsed(next);
    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? '1' : '0');
    } catch {}
  };

  return (
    <Animated.View style={[styles.sidebar, { width: widthAnim }]} {...KK_SIDEBAR_DATASET}>
      <View style={styles.header}>
        <TouchableOpacity onPress={toggle} style={styles.hamburger} {...KK_NAV_DATASET}>
          <Menu size={22} color={SB.headerText} />
        </TouchableOpacity>
        {!collapsed && (
          <Text style={styles.businessName} numberOfLines={1}>
            Katalyst Ko OS
          </Text>
        )}
      </View>

      {!collapsed && (
        <View style={styles.logoContainer}>
          <Image
            source={{ uri: logoUri }}
            style={[computedLogoStyle, { backgroundColor: 'transparent' }]}
            resizeMode="contain"
          />
        </View>
      )}

      <NewQuoteButton collapsed={collapsed} />

      <View style={styles.divider} />

      <ScrollView
        style={styles.navScroll}
        contentContainerStyle={styles.navScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <SidebarNav collapsed={collapsed} />
      </ScrollView>

      <View style={styles.divider} />

      <ProfileFooter collapsed={collapsed} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    backgroundColor: SB.bg,
    height: '100%' as any,
    flexDirection: 'column',
    borderRightWidth: 1,
    borderRightColor: SB.borderColor,
    overflow: 'hidden',
    outlineStyle: 'none' as any,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
    minHeight: 56,
  },
  hamburger: {
    padding: 2,
    outlineStyle: 'none' as any,
  },
  businessName: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: SB.headerText,
    flex: 1,
    letterSpacing: 0.3,
  },
  logoContainer: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: SB.borderColor,
  },
  navScroll: {
    flex: 1,
    outlineStyle: 'none' as any,
  },
  navScrollContent: {
    paddingVertical: 8,
  },
});
