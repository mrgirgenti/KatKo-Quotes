import React from 'react';
import { View, Text, StyleSheet, TextStyle, ViewStyle, StyleProp } from 'react-native';
import Colors from '@/constants/colors';

/**
 * Single source of truth for metric typography across the entire CRM/ERP.
 * Large number = metric value. Small text = metric label.
 *
 * Value size/weight matches the approved "Active Projects" reference so every
 * metric section reads identically.
 */
export const metricValueStyle: TextStyle = {
  fontSize: 20,
  fontWeight: '800',
  color: Colors.light.text,
  lineHeight: 24,
};

export const metricLabelStyle: TextStyle = {
  fontSize: 11,
  fontWeight: '600',
  color: Colors.light.textSecondary,
};

export const metricValueStyleMobile: TextStyle = {
  fontSize: 15,
  fontWeight: '800',
  color: Colors.light.text,
  lineHeight: 19,
};

export const metricLabelStyleMobile: TextStyle = {
  fontSize: 9,
  fontWeight: '600',
  color: Colors.light.textSecondary,
};

export function MetricValue({
  children,
  color,
  style,
}: {
  children: React.ReactNode;
  color?: string;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text style={[styles.value, color ? { color } : null, style]} numberOfLines={1}>
      {children}
    </Text>
  );
}

export function MetricLabel({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  return <Text style={[styles.label, style]}>{children}</Text>;
}

export function MetricCard({
  value,
  label,
  color,
  align = 'center',
  style,
}: {
  value: React.ReactNode;
  label: string;
  color?: string;
  align?: 'center' | 'flex-start' | 'flex-end';
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.card, { alignItems: align }, style]}>
      <MetricValue color={color}>{value}</MetricValue>
      <MetricLabel>{label}</MetricLabel>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    gap: 3,
  },
  value: metricValueStyle,
  label: metricLabelStyle,
});
