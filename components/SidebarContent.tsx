import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useRouter, usePathname, useGlobalSearchParams } from 'expo-router';
import { User, Plus, LogOut, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useClerk } from '@clerk/clerk-expo';
import { NAV_GROUPS, SYSTEM_HREFS, isItemActive, NavItem } from '@/components/navConfig';
import { useUser } from '@/contexts/UserContext';
import { useQuotes } from '@/contexts/QuotesContext';
import { useActions } from '@/contexts/ActionsContext';

export const SB = {
  bg: '#000000',
  borderColor: 'rgba(255,255,255,0.07)',
  headerText: '#E5E7EB',
  text: '#9CA3AF',
  textActive: '#FFFFFF',
  activeBg: '#FF5A00',
  activeBar: '#FF5A00',
  iconColor: '#6B7280',
  sectionLabel: '#5b626e',
};

// Web-only: strip the browser's default blue focus ring / tap highlight from
// every interactive sidebar element. Scoped via the data-kk-nav attribute so it
// never affects the rest of the app's accessibility focus styling.
if (typeof document !== 'undefined') {
  const STYLE_ID = 'kk-nav-focus-reset';
  const CSS =
    // Per-element reset for tagged interactive controls.
    '[data-kk-nav]{-webkit-tap-highlight-color:transparent;}' +
    '[data-kk-nav]:focus,[data-kk-nav]:focus-visible{outline:none !important;box-shadow:none !important;}' +
    // Subtree reset: the sidebar root is tagged data-kk-sidebar, and EVERY focusable
    // descendant (including the RN-web ScrollView, which receives a default blue
    // focus ring) has its outline/box-shadow stripped. This is the root-cause fix
    // for the stray blue line — the previous reset only covered data-kk-nav nodes.
    '[data-kk-sidebar],[data-kk-sidebar] *{-webkit-tap-highlight-color:transparent;}' +
    '[data-kk-sidebar]:focus,[data-kk-sidebar]:focus-visible,' +
    '[data-kk-sidebar] *:focus,[data-kk-sidebar] *:focus-visible{outline:none !important;box-shadow:none !important;}' +
    // Suppress any hover-triggered box-shadow on the sidebar container or its
    // descendants. RN Web can inject class-based box-shadow on mouseenter for
    // Animated.View / ScrollView containers; this ensures none bleeds through.
    '[data-kk-sidebar]:hover,[data-kk-sidebar] *:hover{box-shadow:none !important;outline:none !important;}';
  const existing = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (existing) {
    existing.textContent = CSS;
  } else {
    const el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = CSS;
    document.head.appendChild(el);
  }
}

// Spread onto interactive sidebar elements: renders data-kk-nav="" on web so the
// focus-reset CSS above applies. Typed as any because RN's TouchableOpacity props
// don't declare the web-only `dataSet` attribute.
export const KK_NAV_DATASET: any = { dataSet: { kkNav: '' } };

// Spread onto the sidebar root container so the subtree focus-reset above applies
// to every descendant (web-only).
export const KK_SIDEBAR_DATASET: any = { dataSet: { kkSidebar: '' } };

interface NavProps {
  collapsed?: boolean;
  onNavigate?: () => void;
}

export function SidebarNav({ collapsed = false, onNavigate }: NavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useGlobalSearchParams<{ view?: string }>();
  const view = typeof params.view === 'string' ? params.view : null;

  const isOnSystemPage = SYSTEM_HREFS.some((h) => pathname.startsWith(h));
  const [systemOpen, setSystemOpen] = useState(isOnSystemPage);

  useEffect(() => {
    if (isOnSystemPage) setSystemOpen(true);
  }, [isOnSystemPage]);

  const { sales } = useQuotes();
  const needsReviewCount = sales.filter(
    (p) => (p.status || '').toLowerCase() === 'needs_review',
  ).length;
  const { unresolvedCount } = useActions();
  const badgeMap: Record<string, number> = {
    '/sales': needsReviewCount,
    '/action-center': unresolvedCount,
  };

  const go = (item: NavItem) => {
    if (item.disabled) return;
    router.push(item.href as any);
    onNavigate?.();
  };

  const renderItem = (item: NavItem, nested = false, badge = 0) => {
    const active = isItemActive(item.href, pathname, view);
    const Icon = item.icon;
    return (
      <TouchableOpacity
        key={item.label}
        {...KK_NAV_DATASET}
        style={[
          styles.navItem,
          active && styles.navItemActive,
          collapsed && styles.navItemCollapsed,
          item.disabled && styles.navItemDisabled,
          nested && !collapsed && styles.navItemNested,
        ]}
        onPress={() => go(item)}
        disabled={item.disabled}
        activeOpacity={0.7}
      >
        {active && !collapsed && <View style={styles.activeBar} />}
        <Icon size={19} color={active ? '#FFFFFF' : SB.iconColor} />
        {!collapsed && (
          <Text
            style={[
              styles.navLabel,
              active && styles.navLabelActive,
              item.disabled && styles.navLabelDisabled,
            ]}
            numberOfLines={1}
          >
            {item.label}
          </Text>
        )}
        {!collapsed && item.soon && (
          <View style={styles.soonBadge}>
            <Text style={styles.soonText}>Soon</Text>
          </View>
        )}
        {!collapsed && badge > 0 && (
          <View style={[styles.badgePill, active && styles.badgePillActive]}>
            <Text style={[styles.badgePillText, active && styles.badgePillTextActive]}>
              {badge > 99 ? '99+' : badge}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <>
      {NAV_GROUPS.map((group, gi) => (
        <View key={`group-${gi}`}>
          {gi > 0 && <View style={styles.groupDivider} />}

          {group.collapsible && !collapsed ? (
            <>
              <TouchableOpacity
                {...KK_NAV_DATASET}
                style={styles.systemToggle}
                onPress={() => setSystemOpen((o) => !o)}
                activeOpacity={0.7}
              >
                <Text style={styles.systemToggleLabel}>System</Text>
                {systemOpen
                  ? <ChevronUp size={12} color={SB.sectionLabel} />
                  : <ChevronDown size={12} color={SB.sectionLabel} />
                }
              </TouchableOpacity>
              {systemOpen && group.items.map((item) => renderItem(item, true, badgeMap[item.href] || 0))}
            </>
          ) : (
            group.items.map((item) => renderItem(item, false, badgeMap[item.href] || 0))
          )}
        </View>
      ))}
    </>
  );
}

export function ProfileFooter({ collapsed = false, onNavigate }: NavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { currentUser } = useUser();
  const { signOut } = useClerk();
  const active = pathname.startsWith('/profile');

  const go = () => {
    router.push('/profile' as any);
    onNavigate?.();
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace('/sign-in' as any);
  };

  const avatar = currentUser?.profilePicture ? (
    <Image source={{ uri: currentUser.profilePicture }} style={styles.profileAvatar} resizeMode="cover" />
  ) : currentUser?.name ? (
    <View style={[styles.profileAvatar, styles.profileAvatarFallback, { backgroundColor: currentUser.avatarColor || SB.iconColor }]}>
      <Text style={styles.profileAvatarText}>{currentUser.name[0].toUpperCase()}</Text>
    </View>
  ) : (
    <View style={[styles.profileAvatar, styles.profileAvatarFallback, { backgroundColor: SB.iconColor }]}>
      <User size={14} color="#fff" />
    </View>
  );

  if (collapsed) {
    return (
      <TouchableOpacity
        {...KK_NAV_DATASET}
        style={[styles.navItem, active && styles.navItemActive, styles.navItemCollapsed]}
        onPress={go}
        activeOpacity={0.7}
      >
        {avatar}
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.profileFooterRow}>
      <TouchableOpacity
        {...KK_NAV_DATASET}
        style={[styles.navItem, styles.profileNavFlex, active && styles.navItemActive]}
        onPress={go}
        activeOpacity={0.7}
      >
        {active && <View style={styles.activeBar} />}
        {avatar}
        <Text style={[styles.navLabel, active && styles.navLabelActive]} numberOfLines={1}>
          {currentUser?.name || 'Profile'}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        {...KK_NAV_DATASET}
        style={styles.signOutBtn}
        onPress={handleSignOut}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <LogOut size={15} color={SB.text} />
      </TouchableOpacity>
    </View>
  );
}

export function NewQuoteButton({ collapsed = false, onNavigate }: NavProps) {
  const router = useRouter();
  const go = () => {
    router.push('/' as any);
    onNavigate?.();
  };
  return (
    <View style={[styles.ctaWrap, collapsed && styles.ctaWrapCollapsed]}>
      <TouchableOpacity
        {...KK_NAV_DATASET}
        style={[styles.ctaBtn, collapsed && styles.ctaBtnCollapsed]}
        onPress={go}
        activeOpacity={0.85}
      >
        {collapsed
          ? <Plus size={18} color="#fff" />
          : <Text style={styles.ctaText}>New Quote</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  groupDivider: {
    height: 1,
    backgroundColor: SB.borderColor,
    marginVertical: 5,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 20,
    gap: 11,
    position: 'relative',
    outlineStyle: 'none' as any,
  },
  navItemActive: {
    backgroundColor: SB.activeBg,
  },
  navItemCollapsed: {
    justifyContent: 'center',
    paddingHorizontal: 0,
    alignItems: 'center',
  },
  navItemDisabled: {
    opacity: 0.45,
  },
  navItemNested: {
    paddingLeft: 28,
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
    flex: 1,
  },
  navLabelActive: {
    color: SB.textActive,
    fontWeight: '600' as const,
  },
  navLabelDisabled: {
    color: SB.text,
  },
  soonBadge: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  soonText: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: SB.text,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
  badgePill: {
    backgroundColor: '#FF5A00',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  badgePillActive: {
    backgroundColor: '#fff',
  },
  badgePillText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#fff',
    lineHeight: 14,
  },
  badgePillTextActive: {
    color: '#FF5A00',
  },
  systemToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 7,
    outlineStyle: 'none' as any,
  },
  systemToggleLabel: {
    fontSize: 10.5,
    fontWeight: '700' as const,
    color: SB.sectionLabel,
    letterSpacing: 0.7,
    textTransform: 'uppercase' as const,
  },
  profileFooterRow: {
    flexDirection: 'row' as const,
    alignItems: 'center',
  },
  profileNavFlex: {
    flex: 1,
    minWidth: 0,
  },
  signOutBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
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
  ctaWrap: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 4,
  },
  ctaWrapCollapsed: {
    alignItems: 'center',
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: SB.activeBg,
    height: 42,
    borderRadius: 10,
    paddingHorizontal: 14,
  },
  ctaBtnCollapsed: {
    width: 40,
    height: 40,
    paddingHorizontal: 0,
  },
  ctaText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700' as const,
  },
});
