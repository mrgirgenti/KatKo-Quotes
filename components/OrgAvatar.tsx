import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

const INITIAL_COLORS = ['#FF5A00', '#7C3AED', '#0284C7', '#16A34A', '#DB2777'];

function colorForName(name: string): string {
  if (!name) return INITIAL_COLORS[0];
  return INITIAL_COLORS[name.charCodeAt(0) % INITIAL_COLORS.length];
}

interface OrgAvatarProps {
  name: string;
  logoUrl?: string | null;
  size?: number;
  shape?: 'square' | 'circle';
}

export function OrgAvatar({ name, logoUrl, size = 40, shape = 'square' }: OrgAvatarProps) {
  const [imgError, setImgError] = useState(false);
  useEffect(() => { setImgError(false); }, [logoUrl]);
  const borderRadius = shape === 'circle' ? size / 2 : Math.max(8, size * 0.18);
  const initial = (name?.[0] ?? '?').toUpperCase();
  const bg = colorForName(name);

  if (logoUrl && !imgError) {
    return (
      <Image
        source={{ uri: logoUrl }}
        style={{ width: size, height: size, borderRadius, backgroundColor: 'transparent' }}
        resizeMode="contain"
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <View style={[styles.initial, { width: size, height: size, borderRadius, backgroundColor: bg }]}>
      <Text style={[styles.initialText, { fontSize: size * 0.38 }]}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  initial: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  initialText: {
    color: '#fff',
    fontWeight: '700',
  },
});
