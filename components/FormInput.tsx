import React, { useCallback, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, TextInputProps } from 'react-native';
import Colors from '@/constants/colors';
import { applyTitleCaseOnSpace } from '@/utils/textFormatting';

interface FormInputProps extends TextInputProps {
  label: string;
  error?: string;
  autoTitleCase?: boolean;
}

export function FormInput({ label, error, style, autoTitleCase, onChangeText, value, ...props }: FormInputProps) {
  const previousValueRef = useRef(value || '');

  const handleChangeText = useCallback((text: string) => {
    if (autoTitleCase && onChangeText) {
      const formattedText = applyTitleCaseOnSpace(text, previousValueRef.current);
      previousValueRef.current = formattedText;
      onChangeText(formattedText);
    } else if (onChangeText) {
      previousValueRef.current = text;
      onChangeText(text);
    }
  }, [autoTitleCase, onChangeText]);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, error && styles.inputError, style]}
        placeholderTextColor={Colors.light.textSecondary}
        value={value}
        onChangeText={handleChangeText}
        {...props}
      />
      {error && <Text style={styles.error}>{error}</Text>}
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
  inputError: {
    borderColor: Colors.light.error,
  },
  error: {
    fontSize: 12,
    color: Colors.light.error,
    marginTop: 4,
  },
});
