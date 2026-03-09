import { Tabs, useRouter } from 'expo-router';
import { FilePlus, History, DollarSign } from 'lucide-react-native';
import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Colors from '@/constants/colors';
import { useUser } from '@/contexts/UserContext';

export default function TabLayout() {
  const router = useRouter();
  const { currentUser } = useUser();
  const insets = useSafeAreaInsets();

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const ProfileButton = () => (
    <TouchableOpacity
      style={[styles.profileButton, !currentUser?.profilePicture && { backgroundColor: currentUser?.avatarColor || Colors.light.tint }]}
      onPress={() => router.push('/profile')}
    >
      {currentUser?.profilePicture ? (
        <Image source={{ uri: currentUser.profilePicture }} style={styles.profileImage} />
      ) : (
        <Text style={styles.profileInitials}>
          {currentUser ? getInitials(currentUser.name) : 'U'}
        </Text>
      )}
    </TouchableOpacity>
  );

  const CustomHeader = ({ title }: { title: string }) => (
    <View style={[styles.headerContainer, { paddingTop: insets.top }]}>
      <View style={styles.brandingRow}>
        <Text style={styles.brandingTitle}>Quote Tracker 5000</Text>
        <ProfileButton />
      </View>
      <View style={styles.tabTitleRow}>
        <Text style={styles.tabTitle}>{title}</Text>
      </View>
    </View>
  );

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.light.tint,
        tabBarInactiveTintColor: Colors.light.tabIconDefault,
        headerShown: true,
        tabBarStyle: {
          backgroundColor: Colors.light.surface,
          borderTopColor: Colors.light.border,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'New Quote',
          tabBarIcon: ({ color, size }) => <FilePlus size={size} color={color} />,
          header: () => <CustomHeader title="New Quote" />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Quote History',
          tabBarIcon: ({ color, size }) => <History size={size} color={color} />,
          header: () => <CustomHeader title="Quote History" />,
        }}
      />
      <Tabs.Screen
        name="sales"
        options={{
          title: 'Sales',
          tabBarIcon: ({ color, size }) => <DollarSign size={size} color={color} />,
          header: () => <CustomHeader title="Sales" />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: '#000000',
  },
  brandingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  brandingTitle: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: Colors.light.primary,
    letterSpacing: 0.5,
  },
  tabTitleRow: {
    backgroundColor: '#000000',
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    textAlign: 'center' as const,
  },
  profileButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitials: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#fff',
  },
  profileImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
});
