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
        {/* Row 1: checkbox? + Order date + Project # + Status badge */}
        <View style={styles.row1}>
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
          {quote.orderDate ? (
            <Text style={styles.orderDate}>Order: {formatDate(quote.orderDate)}</Text>
          ) : null}
          {pNum ? <Text style={styles.projectNum}>{pNum}</Text> : null}
          <View style={[styles.statusBadge, { backgroundColor: cfg.bg, borderColor: cfg.borderColor }]}>
            <Text style={[styles.statusBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>

        {/* Row 2: Project name */}
        <Text style={styles.projectName} numberOfLines={1}>
          {quote.projectName || quote.personOrganization || '—'}
        </Text>

        {/* Row 3: Due date (left) + TOTAL / PROFIT side-by-side (right) + chevron */}
        <View style={styles.row3}>
          <View style={styles.row3Left}>
            {quote.inHandsDate ? (
              <Text style={styles.dueDate}>Due: {formatDate(quote.inHandsDate)}</Text>
            ) : null}
          </View>
          <View style={styles.row3Right}>
            <View style={styles.financialItem}>
              <Text style={styles.financialLabel}>TOTAL</Text>
              <Text style={styles.financialValue}>{formatCurrency(total)}</Text>
            </View>
            <View style={styles.financialItem}>
              <Text style={styles.financialLabel}>PROFIT</Text>
              <Text style={[styles.financialValue, styles.profitValue]}>{formatCurrency(profit)}</Text>
            </View>
            <ChevronRight size={13} color={Colors.light.textSecondary} />
          </View>
        </View>

        {/* Row 4: Service + Qty */}
        {serviceQty ? (
          <Text style={styles.serviceQty} numberOfLines={1}>{serviceQty}</Text>
        ) : null}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginBottom: 8,
  },
  queueNum: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: '#111827',
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
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 5,
  },
  cardSelected: {
    borderColor: Colors.light.primary,
    backgroundColor: '#FFF7F3',
  },
  row1: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 7,
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
  orderDate: {
    fontSize: 11,
    color: '#6B7280',
  },
  projectNum: {
    fontSize: 13,
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
  },
  row3: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  row3Left: {
    flex: 1,
  },
  row3Right: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 14,
  },
  financialItem: {
    alignItems: 'flex-end' as const,
    gap: 1,
  },
  financialLabel: {
    fontSize: 9,
    fontWeight: '600' as const,
    color: '#9CA3AF',
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
  },
  financialValue: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#111827',
    lineHeight: 18,
  },
  profitValue: {
    color: '#059669',
  },
  dueDate: {
    fontSize: 11,
    color: '#6B7280',
  },
  serviceQty: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: '#374151',
  },
});
