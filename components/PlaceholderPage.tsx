import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
} from 'react-native';
import { Search, SlidersHorizontal, Plus } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { metricValueStyle, metricLabelStyle } from '@/components/Metric';

interface PlaceholderMetric {
  label: string;
  value?: string;
}

interface PlaceholderPageProps {
  title: string;
  Icon: LucideIcon;
  primaryActionLabel?: string;
  metrics?: PlaceholderMetric[];
  searchPlaceholder?: string;
  emptyTitle: string;
  emptyMessage: string;
}

export function PlaceholderPage({
  title,
  Icon,
  primaryActionLabel,
  metrics,
  searchPlaceholder = 'Search…',
  emptyTitle,
  emptyMessage,
}: PlaceholderPageProps) {
  const [search, setSearch] = useState('');

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{title}</Text>
          {primaryActionLabel ? (
            <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.85}>
              <Plus size={16} color="#fff" />
              <Text style={styles.primaryBtnText}>{primaryActionLabel}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {metrics && metrics.length > 0 ? (
          <View style={styles.metricsRow}>
            {metrics.map((m) => (
              <View key={m.label} style={styles.metricCard}>
                <Text style={styles.metricValue}>{m.value ?? '—'}</Text>
                <Text style={styles.metricLabel}>{m.label}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.toolsRow}>
          <View style={styles.searchBox}>
            <Search size={16} color={Colors.light.textSecondary} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder={searchPlaceholder}
              placeholderTextColor={Colors.light.textSecondary}
            />
          </View>
          <TouchableOpacity style={styles.filterBtn} activeOpacity={0.7}>
            <SlidersHorizontal size={16} color={Colors.light.textSecondary} />
            <Text style={styles.filterBtnText}>Filters</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Icon size={30} color={Colors.light.primary} />
          </View>
          <Text style={styles.emptyTitle}>{emptyTitle}</Text>
          <Text style={styles.emptyMessage}>{emptyMessage}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  scroll: {
    padding: 24,
    paddingBottom: 60,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: '800' as const,
    color: Colors.light.text,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 10,
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#fff',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  metricCard: {
    flex: 1,
    minWidth: 140,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: Colors.light.surface,
  },
  metricValue: {
    ...metricValueStyle,
  },
  metricLabel: {
    ...metricLabelStyle,
    marginTop: 2,
  },
  toolsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
    alignItems: 'center',
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.light.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.light.text,
    outlineStyle: 'none' as any,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: 14,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.light.surface,
  },
  filterBtnText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFF1E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyMessage: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    maxWidth: 420,
    lineHeight: 20,
  },
});
