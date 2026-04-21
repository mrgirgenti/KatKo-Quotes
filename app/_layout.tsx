'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { QuotesProvider } from '@/contexts/QuotesContext';
import { UserProvider } from '@/contexts/UserContext';
import { CrmProvider } from '@/contexts/CrmContext';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { networkMode: 'always' },
    mutations: { networkMode: 'always' },
  },
});

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: 'Back' }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="quote/[id]" options={{ title: 'Quote Details' }} />
      <Stack.Screen name="quote/edit" options={{ title: 'Edit Quote' }} />
      <Stack.Screen name="quote/sales-tracking" options={{ title: 'Sales Tracking' }} />
      <Stack.Screen name="profile" options={{ title: 'Profile', presentation: 'modal' }} />
      <Stack.Screen name="reports" options={{ title: 'Reports' }} />
      <Stack.Screen name="clients/[id]" options={{ title: 'Client Profile', headerStyle: { backgroundColor: '#000000' }, headerTintColor: '#fff' }} />
      <Stack.Screen name="crm/[id]" options={{ title: 'Contact', headerStyle: { backgroundColor: '#000000' }, headerTintColor: '#fff' }} />
      <Stack.Screen name="hub/[id]" options={{ title: 'Hub Management', headerStyle: { backgroundColor: '#000000' }, headerTintColor: '#fff' }} />
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
