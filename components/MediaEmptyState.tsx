import React from 'react';
import { View, Text } from 'react-native';
import { Image as LucideImage, Film, Music } from 'lucide-react-native';

interface MediaEmptyStateProps {
  isDragOver?: boolean;
  onDragOver?: (e: any) => void;
  onDragLeave?: () => void;
  onDrop?: (e: any) => void;
  paddingVertical?: number;
  compact?: boolean;
  marginTop?: number;
}

const BRAND_ORANGE = '#FF7B33';
const BRAND_DARK = '#1A1210';

export default function MediaEmptyState({
  isDragOver = false,
  onDragOver,
  onDragLeave,
  onDrop,
  paddingVertical = 36,
  compact = false,
  marginTop = 10,
}: MediaEmptyStateProps) {
  const iconSz = compact ? 18 : 22;
  const centerSz = compact ? 22 : 26;
  const cardSz = compact ? 46 : 56;
  const centerCardSz = compact ? 54 : 64;

  return (
    <View
      style={{
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical,
        paddingHorizontal: 12,
        gap: 12,
        marginTop,
        borderRadius: 12,
        backgroundColor: isDragOver ? '#CC6A40' : BRAND_ORANGE,
        overflow: 'hidden',
        borderWidth: isDragOver ? 1.5 : 0,
        borderColor: isDragOver ? BRAND_DARK : 'transparent',
      }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <View style={{ position: 'absolute', top: 16, left: 24, width: 5, height: 5, borderRadius: 999, backgroundColor: BRAND_DARK, opacity: 0.3 }} />
      <View style={{ position: 'absolute', top: 10, right: 56, width: 4, height: 4, borderRadius: 999, backgroundColor: BRAND_DARK, opacity: 0.3 }} />
      <View style={{ position: 'absolute', top: 28, right: 30, width: 6, height: 6, borderRadius: 999, backgroundColor: BRAND_DARK, opacity: 0.12 }} />
      <View style={{ position: 'absolute', bottom: 40, left: 16, width: 4, height: 4, borderRadius: 999, backgroundColor: BRAND_DARK, opacity: 0.1 }} />
      <View style={{ position: 'absolute', bottom: 26, right: 18, width: 5, height: 5, borderRadius: 999, backgroundColor: BRAND_DARK, opacity: 0.15 }} />

      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', marginBottom: 2 }}>
        <View style={{
          width: cardSz, height: cardSz, borderRadius: 11, backgroundColor: '#1C1C1C',
          borderWidth: 1, borderColor: '#2A2A2A', alignItems: 'center', justifyContent: 'center',
          transform: [{ rotate: '-10deg' }], marginRight: -10, zIndex: 1,
        }}>
          <LucideImage size={iconSz} color="#888888" />
        </View>
        <View style={{
          width: centerCardSz, height: centerCardSz, borderRadius: 13, backgroundColor: '#222222',
          borderWidth: 1, borderColor: '#333333', alignItems: 'center', justifyContent: 'center', zIndex: 3,
        }}>
          <Film size={centerSz} color="#AAAAAA" />
        </View>
        <View style={{
          width: cardSz, height: cardSz, borderRadius: 11, backgroundColor: '#1C1C1C',
          borderWidth: 1, borderColor: '#2A2A2A', alignItems: 'center', justifyContent: 'center',
          transform: [{ rotate: '10deg' }], marginLeft: -10, zIndex: 1,
        }}>
          <Music size={iconSz} color="#888888" />
        </View>
      </View>

      <Text style={{ fontSize: compact ? 12 : 13, fontWeight: '600', color: BRAND_DARK, textAlign: 'center' }}>
        Drag and drop your media here
      </Text>
      <Text style={{ fontSize: 11, color: '#3A2218', textAlign: 'center', marginTop: -4 }}>
        AI · SVG · PS · PNG · JPG · PDF · EMB · DST · PES
      </Text>
    </View>
  );
}
