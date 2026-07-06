'use client';
import createContextHook from '@nkzw/create-context-hook';
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Modal, View, StyleSheet, Pressable, Animated, ActivityIndicator, Text,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { getClerkToken } from '@/lib/clerkToken';
import type { Organization } from '@/types/crm';
import ContactProfile from '@/components/ContactProfile';
import Colors from '@/constants/colors';

const PANEL_WIDTH = 480;

type OpenState = { contactId: string; orgId: string } | null;

export const [ContactProfileProvider, useContactProfile] = createContextHook(() => {
  const [open, setOpen] = useState<OpenState>(null);
  const router = useRouter();
  const { isDesktop } = useBreakpoint();

  const openContact = useCallback(
    (contactId: string, orgId: string) => {
      if (isDesktop) {
        setOpen({ contactId, orgId });
      } else {
        router.push(`/contact/${contactId}?orgId=${orgId}` as any);
      }
    },
    [isDesktop, router],
  );

  const close = useCallback(() => setOpen(null), []);

  return { open, openContact, close };
});

// ── Desktop slide-over sheet ────────────────────────────────────────────────
// Rendered once in app/(tabs)/_layout.tsx. The Modal is a portal so it always
// floats above every page regardless of where in the tree it lives.
export function ContactProfileSheet() {
  const { open, close } = useContactProfile();
  const queryClient = useQueryClient();

  const slideAnim = useRef(new Animated.Value(PANEL_WIDTH)).current;
  // Keep previous state alive during the slide-out animation so the content
  // doesn't vanish the instant `open` goes to null.
  const [latch, setLatch] = useState<OpenState>(null);
  const [visible, setVisible] = useState(false);
  const animatingOut = useRef(false);

  useEffect(() => {
    if (open) {
      animatingOut.current = false;
      setLatch(open);
      setVisible(true);
      slideAnim.setValue(PANEL_WIDTH);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 22,
        stiffness: 260,
        mass: 0.8,
      }).start();
    } else if (visible && !animatingOut.current) {
      animatingOut.current = true;
      Animated.timing(slideAnim, {
        toValue: PANEL_WIDTH,
        duration: 220,
        useNativeDriver: true,
      }).start(() => {
        setVisible(false);
        setLatch(null);
        animatingOut.current = false;
      });
    }
  }, [open]);

  const { data: org, isLoading } = useQuery<Organization | null>({
    queryKey: ['contact_profile_org', latch?.orgId],
    queryFn: async () => {
      if (!latch?.orgId) return null;
      const token = await getClerkToken();
      const res = await fetch(`/api/orgs/${latch.orgId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load org');
      return res.json() as Promise<Organization>;
    },
    enabled: !!latch?.orgId,
    staleTime: 30_000,
  });

  const contact = org?.contacts.find((c) => c.id === latch?.contactId);

  const handleClose = useCallback(() => {
    close();
  }, [close]);

  const handleSaved = useCallback(() => {
    if (latch?.orgId) {
      queryClient.invalidateQueries({ queryKey: ['contact_profile_org', latch.orgId] });
      queryClient.invalidateQueries({ queryKey: ['crm_orgs'] });
      queryClient.invalidateQueries({ queryKey: ['org_detail'] });
    }
  }, [latch, queryClient]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <View style={styles.container} pointerEvents="box-none">
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <Animated.View style={[styles.panel, { transform: [{ translateX: slideAnim }] }]}>
          {isLoading || !contact || !org ? (
            <View style={styles.loading}>
              <ActivityIndicator size="large" color={Colors.light.primary} />
              {!isLoading && !contact && (
                <Text style={styles.loadingText}>Contact not found.</Text>
              )}
            </View>
          ) : (
            <ContactProfile
              contact={contact}
              org={org}
              onClose={handleClose}
              onSaved={handleSaved}
            />
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  panel: {
    width: PANEL_WIDTH,
    backgroundColor: '#F9FAFB',
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 20,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
  },
});
