import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import Colors from '@/constants/colors';

interface CurrencyInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
}

export function CurrencyInput({ label, value, onChange, placeholder = '0.00' }: CurrencyInputProps) {
  const [text, setText] = useState(() => (value > 0 ? value.toFixed(2) : ''));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setText(value > 0 ? value.toFixed(2) : '');
    }
  }, [value, isFocused]);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    const num = parseFloat(text) || 0;
    const formatted = num > 0 ? num.toFixed(2) : '';
    setText(formatted);
    onChange(num);
  }, [text, onChange]);

  const handleChangeText = useCallback((t: string) => {
    const cleaned = t.replace(/[^0-9.]/g, '');
    const firstDot = cleaned.indexOf('.');
    const sanitized =
      firstDot === -1
        ? cleaned
        : cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
    setText(sanitized);
    onChange(parseFloat(sanitized) || 0);
  }, [onChange]);

  const displayValue = isFocused ? text : (text ? `$${text}` : '');

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, isFocused && styles.inputFocused]}
        value={displayValue}
        onChangeText={handleChangeText}
        onFocus={handleFocus}
        onBlur={handleBlur}
        keyboardType="decimal-pad"
        placeholder={`$${placeholder}`}
        placeholderTextColor={Colors.light.textSecondary}
        selectTextOnFocus
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  label: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  input: {
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 40,
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.text,
    textAlign: 'right' as const,
  },
  inputFocused: {
    borderColor: Colors.light.tint,
  },
});
