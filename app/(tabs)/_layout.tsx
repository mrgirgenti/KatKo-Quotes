import { Tabs, Slot, useRouter } from 'expo-router';
import {
  LayoutDashboard,
  FilePlus,
  FolderKanban,
  Users,
  BookOpen,
} from 'lucide-react-native';
import React from 'react';
import { View, Platform, StyleSheet } from 'react-native';
import Colors from '@/constants/colors';
import { Sidebar } from '@/components/Sidebar';
import { useBreakpoint } from '@/hooks/useBreakpoint';

export default function TabLayout() {
  const { isMobile, isTablet } = useBreakpoint();

  if (Platform.OS === 'web' && !isMobile) {
    return (
      <View style={styles.webLayout}>
        <Sidebar defaultCollapsed={isTablet} />
        <View style={styles.webContent}>
          <Slot />
        </View>
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.light.tint,
        tabBarInactiveTintColor: Colors.light.tabIconDefault,
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.light.surface,
          borderTopColor: Colors.light.border,
          height: 60,
          paddingBottom: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <LayoutDashboard size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: 'New Quote',
          tabBarIcon: ({ color, size }) => <FilePlus size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="projects"
        options={{
          title: 'Projects',
          tabBarIcon: ({ color, size }) => <FolderKanban size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="clients"
        options={{
          title: 'Contacts',
          tabBarIcon: ({ color, size }) => <Users size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="catalogs"
        options={{
          title: 'Catalogs',
          tabBarIcon: ({ color, size }) => <BookOpen size={size} color={color} />,
        }}
      />
      <Tabs.Screen name="client-hubs" options={{ href: null }} />
      <Tabs.Screen name="history" options={{ href: null }} />
      <Tabs.Screen name="sales" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  webLayout: {
    flex: 1,
    flexDirection: 'row',
  },
  webContent: {
    flex: 1,
    overflow: 'hidden' as any,
  },
});
