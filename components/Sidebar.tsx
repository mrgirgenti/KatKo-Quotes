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
  Globe,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useUser } from '@/contexts/UserContext';

const EXPANDED_WIDTH = 240;
const COLLAPSED_WIDTH = 64;

const FALLBACK_LOGO_URI =
  'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/4xwcbfcj6r2usqk7tds89';

const NAV_ITEMS = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { label: 'New Quote', icon: FilePlus, href: '/' },
  { label: 'Projects', icon: FolderKanban, href: '/projects' },
  { label: 'Contacts', icon: Users, href: '/clients' },
  { label: 'Client Hubs', icon: Globe, href: '/client-hubs' },
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

  const { orgAdmin, currentUser } = useUser();
  const logoUri = orgAdmin?.companyLogo || FALLBACK_LOGO_URI;

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
          <Image source={{ uri: logoUri }} style={[styles.logo, { backgroundColor: 'transparent' }]} resizeMode="contain" />
        </View>
      )}

      <View style={styles.divider} />

      <View style={styles.nav}>
        {NAV_ITEMS.map((item, idx) => {
          const active = isRouteActive(item.href, pathname);
          const IconComponent = item.icon;
          const showDivider = idx === 1 || idx === 3;
          return (
            <React.Fragment key={item.href}>
              {showDivider && <View style={styles.divider} />}
              <TouchableOpacity
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
            </React.Fragment>
          );
        })}
      </View>

      <View style={styles.spacer} />

      <TouchableOpacity
        style={[styles.navItem, isRouteActive('/catalogs', pathname) && styles.navItemActive, collapsed && styles.navItemCollapsed]}
        onPress={() => navigate('/catalogs')}
      >
        {isRouteActive('/catalogs', pathname) && !collapsed && <View style={styles.activeBar} />}
        <BookOpen size={20} color={isRouteActive('/catalogs', pathname) ? '#FFFFFF' : SB.iconColor} />
        {!collapsed && (
          <Text style={[styles.navLabel, isRouteActive('/catalogs', pathname) && styles.navLabelActive]}>
            Catalogs
          </Text>
        )}
      </TouchableOpacity>

      <View style={styles.divider} />

      <TouchableOpacity
        style={[styles.navItem, isRouteActive('/profile', pathname) && styles.navItemActive, collapsed && styles.navItemCollapsed]}
        onPress={() => navigate('/profile')}
      >
        {isRouteActive('/profile', pathname) && !collapsed && <View style={styles.activeBar} />}
        {currentUser?.profilePicture ? (
          <Image
            source={{ uri: currentUser.profilePicture }}
            style={styles.profileAvatar}
            resizeMode="cover"
          />
        ) : currentUser?.name ? (
          <View style={[styles.profileAvatar, styles.profileAvatarFallback, { backgroundColor: currentUser.avatarColor || SB.iconColor }]}>
            <Text style={styles.profileAvatarText}>{currentUser.name[0].toUpperCase()}</Text>
          </View>
        ) : (
          <View style={[styles.profileAvatar, styles.profileAvatarFallback, { backgroundColor: SB.iconColor }]}>
            <User size={14} color="#fff" />
          </View>
        )}
        {!collapsed && (
          <View style={styles.profileLabelGroup}>
            <Text style={[styles.navLabel, isRouteActive('/profile', pathname) && styles.navLabelActive]} numberOfLines={1}>
              {currentUser?.name || 'Profile'}
            </Text>
          </View>
        )}
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
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  logo: {
    width: '100%',
    height: 110,
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
  profileAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
  },
  profileAvatarFallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileAvatarText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#fff',
  },
  profileLabelGroup: {
    flex: 1,
  },
});
