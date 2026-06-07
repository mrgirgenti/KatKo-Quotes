import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronRight, Check } from 'lucide-react-native';
import { getEffectiveStatus, STATUS_CONFIG } from '@/types/quote';
import { formatCurrency } from '@/utils/quoteCalculations';
import { formatDate } from '@/utils/textFormatting';
import Colors from '@/constants/colors';
import { metricValueStyle } from '@/components/Metric';

interface ProjectCardProps {
  queue: number;
  quote: any;
  onPress: () => void;
  isSelected?: boolean;
  selectionMode?: boolean;
  onToggleSelect?: () => void;
}

function getPcs(quote: any): number {
  return (quote.lineItems || []).reduce(
    (s: number, li: any) =>
      s + Object.values(li.sizes || {}).reduce((ps: number, v: any) => ps + (Number(v) || 0), 0),
    0
  );
}

function Field({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text
        style={[styles.fieldValue, accent && styles.fieldValueAccent]}
        numberOfLines={1}
      >
        {value || '—'}
      </Text>
    </View>
  );
}

export function ProjectCard({
  queue,
  quote,
  onPress,
  isSelected = false,
  selectionMode = false,
  onToggleSelect,
}: ProjectCardProps) {
  const eff = getEffectiveStatus(quote);
  const cfg = STATUS_CONFIG[eff];
  const pNum = quote.projectNumber || quote.invoiceNumber || '—';
  const pcs = getPcs(quote);
  const services = [...new Set(
    (quote.lineItems || []).map((li: any) => li.serviceStyle).filter(Boolean)
  )] as string[];
  const serviceText = services.length > 0 ? services.join(' · ') : '—';
  const total = quote.calculations?.total ?? 0;
  const profit = quote.calculations?.markupAmount ?? 0;

  return (
    <View style={styles.row}>
      <Text style={styles.queueNum}>#{queue}</Text>
      <TouchableOpacity
        style={[styles.card, isSelected && styles.cardSelected]}
        onPress={selectionMode ? (onToggleSelect ?? onPress) : onPress}
        activeOpacity={0.75}
      >
        {/* Header: record # + status (+ optional checkbox) + chevron */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {selectionMode && (
              <TouchableOpacity
                onPress={onToggleSelect}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                  {isSelected && <Check size={10} color="#fff" strokeWidth={3} />}
                </View>
              </TouchableOpacity>
            )}
            <Text style={styles.recordNum}>{pNum}</Text>
            <View style={[styles.statusBadge, { backgroundColor: cfg.bg, borderColor: cfg.borderColor }]}>
              <Text style={[styles.statusBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
          </View>
          <ChevronRight size={16} color={Colors.light.textSecondary} />
        </View>

        {/* Labeled field grid — preserves desktop column meaning */}
        <View style={styles.grid}>
          <Field label="PROJECT" value={quote.projectName} accent />
          <Field label="CLIENT" value={quote.personOrganization} accent />
        </View>
        <View style={styles.grid}>
          <Field label="ORDER DATE" value={quote.orderDate ? formatDate(quote.orderDate) : ''} />
          <Field label="DUE DATE" value={quote.inHandsDate ? formatDate(quote.inHandsDate) : ''} />
        </View>
        <View style={styles.grid}>
          <Field label="SERVICE" value={serviceText} />
          <Field label="PCS" value={pcs > 0 ? `${pcs.toLocaleString()}` : ''} />
        </View>

        {/* Financials footer */}
        <View style={styles.footer}>
          <View style={styles.finCol}>
            <Text style={styles.fieldLabel}>TOTAL</Text>
            <Text style={styles.finValue}>{formatCurrency(total)}</Text>
          </View>
          <View style={styles.finCol}>
            <Text style={styles.fieldLabel}>PROFIT</Text>
            <Text style={[styles.finValue, styles.profitValue]}>{formatCurrency(profit)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 8,
    marginBottom: 8,
  },
  queueNum: {
    ...metricValueStyle,
    width: 36,
    textAlign: 'right' as const,
    flexShrink: 0,
    paddingTop: 10,
  },
  card: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
  },
  cardSelected: {
    borderColor: Colors.light.primary,
    backgroundColor: '#FFF7F3',
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: 8,
  },
  headerLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    flex: 1,
    minWidth: 0,
    flexWrap: 'wrap' as const,
  },
  recordNum: {
    fontSize: 13,
    fontWeight: '800' as const,
    color: '#111827',
    letterSpacing: 0.3,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#fff',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  checkboxChecked: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '600' as const,
  },
  grid: {
    flexDirection: 'row' as const,
    gap: 12,
  },
  field: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  fieldLabel: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: '#94A3B8',
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
  fieldValue: {
    fontSize: 13,
    color: '#374151',
  },
  fieldValueAccent: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#111827',
  },
  footer: {
    flexDirection: 'row' as const,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
  },
  finCol: {
    flex: 1,
    gap: 2,
  },
  finValue: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: '#111827',
  },
  profitValue: {
    color: '#059669',
  },
});
