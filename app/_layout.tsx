'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { TouchableOpacity, Text } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';

import { QuotesProvider } from '@/contexts/QuotesContext';
import { UserProvider } from '@/contexts/UserContext';
import { CrmProvider } from '@/contexts/CrmContext';

SplashScreen.preventAutoHideAsync();

function HeaderBackButton() {
  const router = useRouter();
  return (
    <TouchableOpacity
      onPress={() => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/(tabs)' as any);
        }
      }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        paddingLeft: 4,
        paddingRight: 8,
        paddingVertical: 6,
      }}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <ChevronLeft size={20} color="#fff" />
      <Text style={{ color: '#fff', fontSize: 15, fontWeight: '500' }}>Back</Text>
    </TouchableOpacity>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { networkMode: 'always' },
    mutations: { networkMode: 'always' },
  },
});

function RootLayoutNav() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#000000' },
        headerTintColor: '#fff',
        headerLeft: () => <HeaderBackButton />,
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="quote/[id]" options={{ title: 'Quote Details' }} />
      <Stack.Screen name="quote/edit" options={{ title: 'Edit Quote' }} />
      <Stack.Screen name="quote/sales-tracking" options={{ title: 'Sales Tracking' }} />
      <Stack.Screen name="profile" options={{ title: 'Profile', presentation: 'modal' }} />
      <Stack.Screen name="reports" options={{ title: 'Reports' }} />
      <Stack.Screen name="clients/[id]" options={{ title: 'Client Profile' }} />
      <Stack.Screen name="crm/[id]" options={{ title: 'Organization' }} />
      <Stack.Screen name="hub/[id]" options={{ title: 'Hub Management' }} />
      <Stack.Screen name="portal/[orgId]" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <UserProvider>
          <QuotesProvider>
            <CrmProvider>
              <RootLayoutNav />
            </CrmProvider>
          </QuotesProvider>
        </UserProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
