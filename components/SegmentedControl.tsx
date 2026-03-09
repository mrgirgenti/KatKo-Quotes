import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Colors from '@/constants/colors';

interface SegmentedControlProps<T extends string> {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  centered?: boolean;
}

export function SegmentedControl<T extends string>({ 
  label, 
  options, 
  value, 
  onChange,
  centered = false,
}: SegmentedControlProps<T>) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.segmentContainer}>
        {options.map((option) => (
          <TouchableOpacity
            key={option}
            style={[
              styles.segment,
              value === option && styles.segmentActive,
            ]}
            onPress={() => onChange(option)}
          >
            <Text
              style={[
                styles.segmentText,
                value === option && styles.segmentTextActive,
                centered && styles.segmentTextCentered,
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {option}
            </Text>
          </TouchableOpacity>
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
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.light.border,
    borderRadius: 8,
    padding: 3,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 6,
  },
  segmentActive: {
    backgroundColor: Colors.light.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    fontWeight: '500' as const,
  },
  segmentTextActive: {
    color: Colors.light.tint,
    fontWeight: '600' as const,
  },
  segmentTextCentered: {
    textAlign: 'center',
    fontSize: 12,
  },
});
