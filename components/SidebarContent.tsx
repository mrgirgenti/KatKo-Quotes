import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useRouter, usePathname, useGlobalSearchParams } from 'expo-router';
import { User, Plus } from 'lucide-react-native';
import { NAV_GROUPS, isItemActive, NavItem } from '@/components/navConfig';
import { useUser } from '@/contexts/UserContext';

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
  if (!document.getElementById(STYLE_ID)) {
    const el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent =
      '[data-kk-nav]{-webkit-tap-highlight-color:transparent;}' +
      '[data-kk-nav]:focus,[data-kk-nav]:focus-visible{outline:none !important;box-shadow:none !important;}';
    document.head.appendChild(el);
  }
}

// Spread onto interactive sidebar elements: renders data-kk-nav="" on web so the
// focus-reset CSS above applies. Typed as any because RN's TouchableOpacity props
// don't declare the web-only `dataSet` attribute.
export const KK_NAV_DATASET: any = { dataSet: { kkNav: '' } };

interface NavProps {
  collapsed?: boolean;
  onNavigate?: () => void;
}

export function SidebarNav({ collapsed = false, onNavigate }: NavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useGlobalSearchParams<{ view?: string }>();
  const view = typeof params.view === 'string' ? params.view : null;

  const go = (item: NavItem) => {
    if (item.disabled) return;
    router.push(item.href as any);
    onNavigate?.();
  };

  return (
    <>
      {NAV_GROUPS.map((group, gi) => (
        <View key={group.title ?? `group-${gi}`} style={styles.group}>
          {group.title ? (
            collapsed ? (
              <View style={styles.groupDivider} />
            ) : (
              <Text style={styles.sectionLabel}>{group.title}</Text>
            )
          ) : null}
          {group.items.map((item) => {
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
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </>
  );
}

export function ProfileFooter({ collapsed = false, onNavigate }: NavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { currentUser } = useUser();
  const active = pathname.startsWith('/profile');

  const go = () => {
    router.push('/profile' as any);
    onNavigate?.();
  };

  return (
    <TouchableOpacity
      {...KK_NAV_DATASET}
      style={[styles.navItem, active && styles.navItemActive, collapsed && styles.navItemCollapsed]}
      onPress={go}
      activeOpacity={0.7}
    >
      {active && !collapsed && <View style={styles.activeBar} />}
      {currentUser?.profilePicture ? (
        <Image source={{ uri: currentUser.profilePicture }} style={styles.profileAvatar} resizeMode="cover" />
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
        <Text style={[styles.navLabel, active && styles.navLabelActive]} numberOfLines={1}>
          {currentUser?.name || 'Profile'}
        </Text>
      )}
    </TouchableOpacity>
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
        <Plus size={18} color="#fff" />
        {!collapsed && <Text style={styles.ctaText}>New Quote</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    marginBottom: 2,
  },
  sectionLabel: {
    fontSize: 10.5,
    fontWeight: '700' as const,
    color: SB.sectionLabel,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 6,
  },
  groupDivider: {
    height: 1,
    backgroundColor: SB.borderColor,
    marginVertical: 6,
    marginHorizontal: 12,
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
