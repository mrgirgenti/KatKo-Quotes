import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';

interface PageBackHeaderProps {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
}

/**
 * Platform-standard detail-page header: "← Back   {title}".
 *
 * Visual source of truth = the global native Stack header (black bar, white
 * back affordance + title) used by Quote Details / Production Mode. This is a
 * standardization wrapper, NOT a redesign: pages that already looked correct
 * must not change visually. Set `headerShown: false` on the screen and render
 * this at the top of the page content instead.
 */
export default function PageBackHeader({ title, onBack, right }: PageBackHeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)' as any);
    }
  };

  return (
    <View style={styles.header}>
      <TouchableOpacity
        onPress={handleBack}
        style={styles.backBtn}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <ChevronLeft size={20} color="#fff" />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000000',
    height: 56,
    paddingHorizontal: 8,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingLeft: 4,
    paddingRight: 8,
    paddingVertical: 6,
  },
  backText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  title: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
    minWidth: 0,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
