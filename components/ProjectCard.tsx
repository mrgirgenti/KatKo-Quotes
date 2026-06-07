import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronRight, Check } from 'lucide-react-native';
import { getEffectiveStatus, STATUS_CONFIG } from '@/types/quote';
import { formatCurrency } from '@/utils/quoteCalculations';
import { formatDate } from '@/utils/textFormatting';
import Colors from '@/constants/colors';

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
  const pNum = quote.projectNumber || quote.invoiceNumber;
  const pcs = getPcs(quote);
  const services = [...new Set(
    (quote.lineItems || []).map((li: any) => li.serviceStyle).filter(Boolean)
  )] as string[];
  const serviceQty = services.length > 0
    ? `${services.join(' · ')}${pcs > 0 ? ` • ${pcs.toLocaleString()} pcs` : ''}`
    : pcs > 0 ? `${pcs.toLocaleString()} pcs` : null;
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
        {/* Top row: project number + status badge + chevron */}
        <View style={styles.cardTop}>
          <View style={styles.cardTopLeft}>
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
            {pNum ? <Text style={styles.projectNum}>{pNum}</Text> : null}
            <View style={[styles.statusBadge, { backgroundColor: cfg.bg, borderColor: cfg.borderColor }]}>
              <Text style={[styles.statusBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
          </View>
          <ChevronRight size={13} color={Colors.light.textSecondary} />
        </View>

        {/* Project name */}
        <Text style={styles.projectName} numberOfLines={2}>
          {quote.projectName || quote.personOrganization || '—'}
        </Text>

        {/* Dates */}
        {(quote.orderDate || quote.inHandsDate) ? (
          <View style={styles.datesRow}>
            {quote.orderDate ? (
              <Text style={styles.dateText}>Order: {formatDate(quote.orderDate)}</Text>
            ) : null}
            {quote.orderDate && quote.inHandsDate ? (
              <Text style={styles.dateSep}>·</Text>
            ) : null}
            {quote.inHandsDate ? (
              <Text style={styles.dateText}>Due: {formatDate(quote.inHandsDate)}</Text>
            ) : null}
          </View>
        ) : null}

        {/* Service + Qty grouped */}
        {serviceQty ? (
          <Text style={styles.serviceQty} numberOfLines={1}>{serviceQty}</Text>
        ) : null}

        {/* Financial section */}
        <View style={styles.financials}>
          <View style={styles.financialCol}>
            <Text style={styles.financialLabel}>Total</Text>
            <Text style={styles.financialValue}>{formatCurrency(total)}</Text>
          </View>
          <View style={styles.financialDivider} />
          <View style={styles.financialCol}>
            <Text style={styles.financialLabel}>Profit</Text>
            <Text style={[styles.financialValue, styles.profitValue]}>{formatCurrency(profit)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginBottom: 10,
  },
  queueNum: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: '#CBD5E1',
    width: 36,
    textAlign: 'right' as const,
    flexShrink: 0,
  },
  card: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    gap: 5,
  },
  cardSelected: {
    borderColor: Colors.light.primary,
    backgroundColor: '#FFF7F3',
  },
  cardTop: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  cardTopLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 7,
    flex: 1,
    flexWrap: 'wrap' as const,
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
  projectNum: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#111827',
    letterSpacing: 0.3,
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
  projectName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#111827',
    lineHeight: 19,
    marginTop: 1,
  },
  datesRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    flexWrap: 'wrap' as const,
  },
  dateText: {
    fontSize: 11,
    color: '#6B7280',
  },
  dateSep: {
    fontSize: 11,
    color: '#D1D5DB',
  },
  serviceQty: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: '#374151',
  },
  financials: {
    flexDirection: 'row' as const,
    alignItems: 'stretch' as const,
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  financialCol: {
    flex: 1,
    gap: 2,
  },
  financialLabel: {
    fontSize: 10,
    fontWeight: '500' as const,
    color: '#9CA3AF',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  financialValue: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: '#111827',
    lineHeight: 22,
  },
  profitValue: {
    color: '#059669',
  },
  financialDivider: {
    width: 1,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 14,
    minHeight: 36,
  },
});
