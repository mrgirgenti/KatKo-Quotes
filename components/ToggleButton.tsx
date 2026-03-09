import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Colors from '@/constants/colors';

interface ToggleButtonProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  description?: string;
}

export function ToggleButton({ label, value, onChange, description }: ToggleButtonProps) {
  return (
    <View style={styles.container}>
      <View style={styles.labelContainer}>
        <Text style={styles.label}>{label}</Text>
        {description && <Text style={styles.description}>{description}</Text>}
      </View>
      <View style={styles.buttonGroup}>
        <TouchableOpacity
          style={[styles.button, styles.buttonLeft, value && styles.buttonActive]}
          onPress={() => onChange(true)}
        >
          <Text style={[styles.buttonText, value && styles.buttonTextActive]}>Yes</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.buttonRight, !value && styles.buttonInactive]}
          onPress={() => onChange(false)}
        >
          <Text style={[styles.buttonText, !value && styles.buttonTextInactive]}>No</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  labelContainer: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.light.text,
  },
  description: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  buttonGroup: {
    flexDirection: 'row',
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.light.border,
  },
  buttonLeft: {
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6,
  },
  buttonRight: {
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
  },
  buttonActive: {
    backgroundColor: Colors.light.tint,
  },
  buttonInactive: {
    backgroundColor: Colors.light.border,
  },
  buttonText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
  },
  buttonTextActive: {
    color: '#fff',
  },
  buttonTextInactive: {
    color: Colors.light.textSecondary,
  },
});
