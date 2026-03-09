import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import Colors from '@/constants/colors';
import { SizeQuantities, SIZE_LABELS } from '@/types/quote';

interface SizeQuantityInputProps {
  sizes: SizeQuantities;
  onChange: (sizes: SizeQuantities) => void;
  isPromotional: boolean;
}

export function SizeQuantityInput({ sizes, onChange, isPromotional }: SizeQuantityInputProps) {
  const handleSizeChange = (key: keyof SizeQuantities, value: string) => {
    const numValue = parseInt(value) || 0;
    onChange({ ...sizes, [key]: numValue });
  };

  if (isPromotional) {
    return (
      <View style={styles.container}>
        <Text style={styles.label}>QUANTITY</Text>
        <View style={styles.flatContainer}>
          <Text style={styles.flatLabel}>Flat Quantity</Text>
          <TextInput
            style={styles.flatInput}
            value={sizes.flat > 0 ? sizes.flat.toString() : ''}
            onChangeText={(v) => handleSizeChange('flat', v)}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={Colors.light.textSecondary}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>SIZE QUANTITIES</Text>
      <View style={styles.sizesRow}>
        {SIZE_LABELS.map(({ key, label }) => (
          <View key={key} style={styles.sizeItem}>
            <Text style={styles.sizeLabel}>{label}</Text>
            <TextInput
              style={styles.sizeInput}
              value={sizes[key] > 0 ? sizes[key].toString() : ''}
              onChangeText={(v) => handleSizeChange(key, v)}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={Colors.light.textSecondary}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.text,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sizesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  sizeItem: {
    alignItems: 'center',
    flex: 1,
  },
  sizeLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
    marginBottom: 4,
  },
  sizeInput: {
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 6,
    width: '100%',
    height: 38,
    textAlign: 'center',
    fontSize: 13,
    color: Colors.light.text,
  },
  flatContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  flatLabel: {
    fontSize: 14,
    color: Colors.light.text,
  },
  flatInput: {
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 6,
    width: 80,
    height: 40,
    textAlign: 'center',
    fontSize: 14,
    color: Colors.light.text,
  },
});
