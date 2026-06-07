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
        {/* 4-column grid: [info] [TOTAL] [PROFIT] [chevron] */}
        <View style={styles.cardBody}>

          {/* Column 1 — Project info */}
          <View style={styles.infoCol}>
            {/* Meta row: checkbox? + order date + project # + status */}
            <View style={styles.metaRow}>
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

            {/* Project name */}
            <Text style={styles.projectName} numberOfLines={1}>
              {quote.projectName || quote.personOrganization || '—'}
            </Text>

            {/* Due date */}
            {quote.inHandsDate ? (
              <Text style={styles.dueDate}>Due: {formatDate(quote.inHandsDate)}</Text>
            ) : null}

            {/* Service + Qty */}
            {serviceQty ? (
              <Text style={styles.serviceQty} numberOfLines={1}>{serviceQty}</Text>
            ) : null}
          </View>

          {/* Column 2 — TOTAL */}
          <View style={styles.finCol}>
            <Text style={styles.finLabel}>TOTAL</Text>
            <Text style={styles.finValue}>{formatCurrency(total)}</Text>
          </View>

          {/* Column 3 — PROFIT */}
          <View style={styles.finCol}>
            <Text style={styles.finLabel}>PROFIT</Text>
            <Text style={[styles.finValue, styles.profitValue]}>{formatCurrency(profit)}</Text>
          </View>

          {/* Column 4 — Chevron */}
          <ChevronRight size={14} color={Colors.light.textSecondary} />
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
    marginBottom: 8,
  },
  queueNum: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: '#111827',
    width: 36,
    textAlign: 'right' as const,
    flexShrink: 0,
    alignSelf: 'center' as const,
  },
  card: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  cardSelected: {
    borderColor: Colors.light.primary,
    backgroundColor: '#FFF7F3',
  },
  cardBody: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
  },
  infoCol: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  metaRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
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
  dueDate: {
    fontSize: 11,
    color: '#6B7280',
  },
  serviceQty: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: '#374151',
  },
  finCol: {
    alignItems: 'flex-end' as const,
    gap: 2,
    flexShrink: 0,
    minWidth: 72,
  },
  finLabel: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: '#9CA3AF',
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  },
  finValue: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#111827',
    lineHeight: 18,
  },
  profitValue: {
    color: '#059669',
  },
});
