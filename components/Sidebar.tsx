import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Animated,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import {
  Menu,
  LayoutDashboard,
  FilePlus,
  FolderKanban,
  Users,
  BookOpen,
  User,
} from 'lucide-react-native';
import Colors from '@/constants/colors';

const EXPANDED_WIDTH = 240;
const COLLAPSED_WIDTH = 64;

const LOGO_URI =
  'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/4xwcbfcj6r2usqk7tds89';

const NAV_ITEMS = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { label: 'New Quote', icon: FilePlus, href: '/' },
  { label: 'Projects', icon: FolderKanban, href: '/projects' },
  { label: 'Contacts', icon: Users, href: '/clients' },
  { label: 'Catalogs', icon: BookOpen, href: '/catalogs' },
];

const SB = {
  bg: '#000000',
  borderColor: 'rgba(255,255,255,0.07)',
  headerText: '#E5E7EB',
  text: '#9CA3AF',
  textActive: '#FFFFFF',
  activeBg: '#FF5A00',
  activeBar: '#FF5A00',
  iconColor: '#6B7280',
};

function isRouteActive(href: string, pathname: string): boolean {
  if (href === '/') return pathname === '/' || pathname === '/index';
  return pathname.startsWith(href);
}

interface SidebarProps {
  defaultCollapsed?: boolean;
}

export function Sidebar({ defaultCollapsed = false }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const router = useRouter();
  const pathname = usePathname();
  const widthAnim = useRef(new Animated.Value(defaultCollapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH)).current;

  useEffect(() => {
    setCollapsed(defaultCollapsed);
    Animated.timing(widthAnim, {
      toValue: defaultCollapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH,
      duration: 0,
      useNativeDriver: false,
    }).start();
  }, [defaultCollapsed]);

  const toggle = () => {
    const toValue = collapsed ? EXPANDED_WIDTH : COLLAPSED_WIDTH;
    Animated.timing(widthAnim, {
      toValue,
      duration: 200,
      useNativeDriver: false,
    }).start();
    setCollapsed(!collapsed);
  };

  const navigate = (href: string) => {
    router.push(href as any);
  };

  return (
    <Animated.View style={[styles.sidebar, { width: widthAnim }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={toggle} style={styles.hamburger}>
          <Menu size={22} color={SB.headerText} />
        </TouchableOpacity>
        {!collapsed && (
          <Text style={styles.businessName} numberOfLines={1}>
            Katalyst Ko Printshop
          </Text>
        )}
      </View>

      {!collapsed && (
        <View style={styles.logoContainer}>
          <Image source={{ uri: LOGO_URI }} style={styles.logo} resizeMode="contain" />
        </View>
      )}

      <View style={styles.divider} />

      <View style={styles.nav}>
        {NAV_ITEMS.map((item) => {
          const active = isRouteActive(item.href, pathname);
          const IconComponent = item.icon;
          return (
            <TouchableOpacity
              key={item.href}
              style={[styles.navItem, active && styles.navItemActive, collapsed && styles.navItemCollapsed]}
              onPress={() => navigate(item.href)}
            >
              {active && !collapsed && <View style={styles.activeBar} />}
              <IconComponent
                size={20}
                color={active ? '#FFFFFF' : SB.iconColor}
              />
              {!collapsed && (
                <Text style={[styles.navLabel, active && styles.navLabelActive]}>
                  {item.label}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.spacer} />

      <View style={styles.divider} />

      <TouchableOpacity
        style={[styles.navItem, collapsed && styles.navItemCollapsed]}
        onPress={() => navigate('/profile')}
      >
        <User size={20} color={SB.iconColor} />
        {!collapsed && <Text style={styles.navLabel}>Profile</Text>}
      </TouchableOpacity>
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
  },
  businessName: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: SB.headerText,
    flex: 1,
    letterSpacing: 0.3,
  },
  logoContainer: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  logo: {
    width: 160,
    height: 58,
  },
  divider: {
    height: 1,
    backgroundColor: SB.borderColor,
    marginHorizontal: 0,
  },
  nav: {
    paddingTop: 8,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 20,
    gap: 12,
    position: 'relative',
  },
  navItemActive: {
    backgroundColor: SB.activeBg,
  },
  navItemCollapsed: {
    justifyContent: 'center',
    paddingHorizontal: 0,
    alignItems: 'center',
  },
  activeBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: SB.activeBar,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  navLabel: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: SB.text,
  },
  navLabelActive: {
    color: SB.textActive,
    fontWeight: '600' as const,
  },
  spacer: {
    flex: 1,
  },
});
