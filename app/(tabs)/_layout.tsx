import { Tabs, Slot, useRouter } from 'expo-router';
import {
  LayoutDashboard,
  FilePlus,
  History,
  DollarSign,
  Users,
  BookOpen,
} from 'lucide-react-native';
import React from 'react';
import { View, Platform, StyleSheet } from 'react-native';
import Colors from '@/constants/colors';
import { Sidebar } from '@/components/Sidebar';

export default function TabLayout() {
  if (Platform.OS === 'web') {
    return (
      <View style={styles.webLayout}>
        <Sidebar />
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
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, size }) => <History size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="sales"
        options={{
          title: 'Sales',
          tabBarIcon: ({ color, size }) => <DollarSign size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="clients"
        options={{
          title: 'Clients',
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
