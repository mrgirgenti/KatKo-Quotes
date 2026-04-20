import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import Colors from '@/constants/colors';

interface CurrencyInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
}

const formatCurrencyDisplay = (value: number): string => {
  return `$${value.toFixed(2)}`;
};

export function CurrencyInput({ label, value, onChange, placeholder = '$0.00' }: CurrencyInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [inputValue, setInputValue] = useState(value > 0 ? value.toString() : '');

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    setInputValue(value !== 0 ? value.toString() : '');
  }, [value]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    const parsed = parseFloat(inputValue) || 0;
    onChange(parsed);
  }, [inputValue, onChange]);

  const handleChangeText = useCallback((text: string) => {
    const cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    const formatted = parts.length > 2 
      ? parts[0] + '.' + parts.slice(1).join('')
      : cleaned;
    setInputValue(formatted);
    onChange(parseFloat(formatted) || 0);
  }, [onChange]);

  const displayValue = isFocused ? inputValue : formatCurrencyDisplay(value);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={displayValue}
        onChangeText={handleChangeText}
        onFocus={handleFocus}
        onBlur={handleBlur}
        keyboardType="decimal-pad"
        placeholder={placeholder}
        placeholderTextColor={Colors.light.textSecondary}
      />
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
  input: {
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.light.text,
  },
});
