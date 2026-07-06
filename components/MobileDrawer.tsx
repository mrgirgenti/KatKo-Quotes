import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ScrollView,
  Platform,
  Image,
} from 'react-native';
import { Menu, X } from 'lucide-react-native';
import { SB, SidebarNav, ProfileFooter, NewQuoteButton, KK_SIDEBAR_DATASET } from '@/components/SidebarContent';
import { useUser } from '@/contexts/UserContext';

const DRAWER_W = 280;
const FALLBACK_LOGO_URI = '/ko-logo-horizontal.png';
const SAFE_TOP = Platform.OS === 'web' ? 12 : 44;

// ── MobileTopBar ───────────────────────────────────────────────────────────
// Standalone top bar for the mobile layout. Does NOT wrap its siblings.
export function MobileTopBar({ onOpenDrawer }: { onOpenDrawer: () => void }) {
  return (
    <View style={styles.topBar}>
      <TouchableOpacity
        onPress={onOpenDrawer}
        style={styles.menuBtn}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Menu size={24} color="#fff" />
      </TouchableOpacity>
      <Text style={styles.topTitle} numberOfLines={1}>
        Katalyst Ko OS
      </Text>
    </View>
  );
}

// ── MobileDrawerOverlay ────────────────────────────────────────────────────
// Absolutely-positioned drawer + scrim. Renders as a sibling overlay so it
// never wraps <Slot /> and cannot trigger a React remount of the content tree.
export function MobileDrawerOverlay({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const tx = useRef(new Animated.Value(-DRAWER_W)).current;
  const scrim = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState(false);

  const { orgAdmin } = useUser();
  const logoUri = orgAdmin?.companyLogo || FALLBACK_LOGO_URI;

  useEffect(() => {
    if (isOpen) {
      setVisible(true);
      tx.setValue(-DRAWER_W);
      scrim.setValue(0);
      Animated.parallel([
        Animated.timing(tx, { toValue: 0, duration: 220, useNativeDriver: false }),
        Animated.timing(scrim, { toValue: 1, duration: 220, useNativeDriver: false }),
      ]).start();
    } else if (visible) {
      Animated.parallel([
        Animated.timing(tx, { toValue: -DRAWER_W, duration: 200, useNativeDriver: false }),
        Animated.timing(scrim, { toValue: 0, duration: 200, useNativeDriver: false }),
      ]).start(() => setVisible(false));
    }
  }, [isOpen]);

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill as any} pointerEvents="box-none">
      <Animated.View style={[styles.scrim, { opacity: scrim }]}>
        <View
          style={StyleSheet.absoluteFill as any}
          onStartShouldSetResponder={() => true}
          onResponderRelease={onClose}
        />
      </Animated.View>
      <Animated.View
        style={[styles.drawer, { transform: [{ translateX: tx }] }]}
        {...KK_SIDEBAR_DATASET}
      >
        <View style={styles.drawerHeader}>
          <Image
            source={{ uri: logoUri }}
            style={styles.drawerLogo}
            resizeMode="contain"
          />
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={22} color={SB.headerText} />
          </TouchableOpacity>
        </View>
        <NewQuoteButton collapsed={false} onNavigate={onClose} />
        <View style={styles.divider} />
        <ScrollView
          style={styles.navScroll}
          contentContainerStyle={styles.navScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <SidebarNav collapsed={false} onNavigate={onClose} />
        </ScrollView>
        <View style={styles.divider} />
        <ProfileFooter collapsed={false} onNavigate={onClose} />
      </Animated.View>
    </View>
  );
}

// ── MobileShell (legacy wrapper — kept for any existing call sites) ─────────
export function MobileShell({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <View style={styles.root}>
      <MobileTopBar onOpenDrawer={() => setDrawerOpen(true)} />
      <View style={styles.content}>{children}</View>
      <MobileDrawerOverlay isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: SB.bg,
    paddingHorizontal: 16,
    paddingTop: SAFE_TOP,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: SB.borderColor,
  },
  menuBtn: {
    padding: 2,
    outlineStyle: 'none' as any,
  },
  topTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#fff',
    flex: 1,
    letterSpacing: 0.3,
  },
  content: {
    flex: 1,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: DRAWER_W,
    backgroundColor: SB.bg,
    borderRightWidth: 1,
    borderRightColor: SB.borderColor,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: SAFE_TOP + 6,
    paddingBottom: 12,
    gap: 12,
  },
  drawerLogo: {
    width: 150,
    height: 44,
  },
  closeBtn: {
    padding: 2,
    outlineStyle: 'none' as any,
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
