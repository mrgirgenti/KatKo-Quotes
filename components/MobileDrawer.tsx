import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Pressable,
  ScrollView,
  Platform,
  Image,
} from 'react-native';
import { Menu, X } from 'lucide-react-native';
import { SB, SidebarNav, ProfileFooter, NewQuoteButton } from '@/components/SidebarContent';
import { useUser } from '@/contexts/UserContext';

const DRAWER_W = 280;
const FALLBACK_LOGO_URI =
  'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/4xwcbfcj6r2usqk7tds89';

const SAFE_TOP = Platform.OS === 'web' ? 12 : 44;

export function MobileShell({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const tx = useRef(new Animated.Value(-DRAWER_W)).current;
  const scrim = useRef(new Animated.Value(0)).current;

  const { orgAdmin } = useUser();
  const logoUri = orgAdmin?.companyLogo || FALLBACK_LOGO_URI;

  const openDrawer = () => {
    setMounted(true);
    Animated.parallel([
      Animated.timing(tx, { toValue: 0, duration: 220, useNativeDriver: true }),
      Animated.timing(scrim, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  };

  const closeDrawer = () => {
    Animated.parallel([
      Animated.timing(tx, { toValue: -DRAWER_W, duration: 200, useNativeDriver: true }),
      Animated.timing(scrim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setMounted(false));
  };

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={openDrawer}
          style={styles.menuBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Menu size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.topTitle} numberOfLines={1}>
          Katalyst Ko Printshop
        </Text>
      </View>

      <View style={styles.content}>{children}</View>

      {mounted && (
        <View style={StyleSheet.absoluteFill as any} pointerEvents="box-none">
          <Animated.View style={[styles.scrim, { opacity: scrim }]}>
            <Pressable style={StyleSheet.absoluteFill as any} onPress={closeDrawer} />
          </Animated.View>
          <Animated.View style={[styles.drawer, { transform: [{ translateX: tx }] }]}>
            <View style={styles.drawerHeader}>
              <Image source={{ uri: logoUri }} style={styles.drawerLogo} resizeMode="contain" />
              <TouchableOpacity onPress={closeDrawer} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={22} color={SB.headerText} />
              </TouchableOpacity>
            </View>
            <NewQuoteButton collapsed={false} onNavigate={closeDrawer} />
            <View style={styles.divider} />
            <ScrollView
              style={styles.navScroll}
              contentContainerStyle={styles.navScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <SidebarNav collapsed={false} onNavigate={closeDrawer} />
            </ScrollView>
            <View style={styles.divider} />
            <ProfileFooter collapsed={false} onNavigate={closeDrawer} />
          </Animated.View>
        </View>
      )}
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
  },
  navScrollContent: {
    paddingVertical: 8,
  },
});
