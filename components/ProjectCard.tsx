import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { ChevronRight, Check, Calendar, Package } from 'lucide-react-native';
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
  compact?: boolean;
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
  compact = false,
}: ProjectCardProps) {
  const { width } = useWindowDimensions();
  const isMobile = width > 0 && width < 768;

  const eff = getEffectiveStatus(quote);
  const cfg = STATUS_CONFIG[eff];
  const pNum = quote.projectNumber || quote.invoiceNumber || '—';
  const pcs = getPcs(quote);
  const services = [...new Set(
    (quote.lineItems || []).map((li: any) => li.serviceStyle).filter(Boolean)
  )] as string[];
  const serviceText = services.length > 0 ? services.join(' · ') : '';
  const total = quote.calculations?.total ?? 0;
  const profit = quote.calculations?.markupAmount ?? 0;
  const dueDate = quote.inHandsDate ? formatDate(quote.inHandsDate) : '—';

  if (compact) {
    const checkbox = selectionMode ? (
      <TouchableOpacity
        onPress={onToggleSelect}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
          {isSelected && <Check size={10} color="#fff" strokeWidth={3} />}
        </View>
      </TouchableOpacity>
    ) : null;

    const cmpHeader = (
      <View style={styles.cmpHeader}>
        <View style={styles.cmpHeaderLeft}>
          {checkbox}
          <Text style={styles.cmpRecordNum}>{pNum}</Text>
          <View style={[styles.cmpStatusBadge, { backgroundColor: cfg.bg, borderColor: cfg.borderColor }]}>
            <Text style={[styles.cmpStatusText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>
        <ChevronRight size={14} color={Colors.light.textSecondary} />
      </View>
    );

    if (isMobile) {
      return (
        <View style={styles.row}>
          <Text style={styles.queueNum}>#{queue}</Text>
          <TouchableOpacity
            style={[styles.cmpCard, isSelected && styles.cmpCardSelected]}
            onPress={selectionMode ? (onToggleSelect ?? onPress) : onPress}
            activeOpacity={0.75}
          >
            {cmpHeader}
            <View style={styles.cmpBodyMobile}>
              <View style={styles.cmpBodyLeft}>
                <Text style={styles.cmpName} numberOfLines={1}>{quote.projectName || '—'}</Text>
                {quote.personOrganization ? (
                  <Text style={styles.cmpMeta} numberOfLines={1}>{quote.personOrganization}</Text>
                ) : null}
                {serviceText ? (
                  <Text style={styles.cmpMeta} numberOfLines={1}>{serviceText}</Text>
                ) : null}
              </View>
              <View style={styles.cmpBodyRight}>
                <Text style={styles.cmpRightLabel}>Due Date</Text>
                <Text style={styles.cmpRightVal}>{dueDate}</Text>
                <Text style={[styles.cmpRightLabel, { marginTop: 6 }]}>PCS</Text>
                <Text style={styles.cmpRightVal}>{pcs > 0 ? pcs.toLocaleString() : '—'}</Text>
              </View>
            </View>
            <View style={styles.cmpFinRowMobile}>
              <View style={styles.cmpFinColMobile}>
                <Text style={styles.cmpFinLabel}>Revenue</Text>
                <Text style={[styles.cmpFinVal, { color: '#059669' }]}>{formatCurrency(total)}</Text>
              </View>
              <View style={styles.cmpFinColMobile}>
                <Text style={styles.cmpFinLabel}>Profit</Text>
                <Text style={[styles.cmpFinVal, { color: '#FF5A00' }]}>{formatCurrency(profit)}</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      );
    }

    // Desktop compact — single horizontal row with divider-separated columns
    return (
      <View style={styles.row}>
        <Text style={styles.queueNum}>#{queue}</Text>
        <TouchableOpacity
          style={[styles.cmpDesktopCard, isSelected && styles.cmpCardSelected]}
          onPress={selectionMode ? (onToggleSelect ?? onPress) : onPress}
          activeOpacity={0.75}
        >
          {/* Left: project number + name + client · service */}
          <View style={styles.cmpDesktopLeft}>
            <View style={styles.cmpDesktopTopRow}>
              {selectionMode && (
                <TouchableOpacity onPress={onToggleSelect} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                    {isSelected && <Check size={10} color="#fff" strokeWidth={3} />}
                  </View>
                </TouchableOpacity>
              )}
              <Text style={styles.cmpRecordNum}>{pNum}</Text>
              <View style={[styles.cmpStatusBadge, { backgroundColor: cfg.bg, borderColor: cfg.borderColor }]}>
                <Text style={[styles.cmpStatusText, { color: cfg.color }]}>{cfg.label}</Text>
              </View>
            </View>
            <Text style={styles.cmpName} numberOfLines={1}>{quote.projectName || '—'}</Text>
            {(quote.personOrganization || serviceText) ? (
              <Text style={styles.cmpMeta} numberOfLines={1}>
                {[quote.personOrganization, serviceText].filter(Boolean).join(' · ')}
              </Text>
            ) : null}
          </View>

          <View style={styles.cmpVertDivider} />

          {/* Due Date */}
          <View style={styles.cmpDesktopDataCol}>
            <View style={styles.cmpDesktopColLabelRow}>
              <Calendar size={11} color="#94A3B8" />
              <Text style={styles.cmpColLabelTxt}>Due Date</Text>
            </View>
            <Text style={styles.cmpColVal}>{dueDate}</Text>
          </View>

          <View style={styles.cmpVertDivider} />

          {/* PCS */}
          <View style={styles.cmpDesktopDataCol}>
            <View style={styles.cmpDesktopColLabelRow}>
              <Package size={11} color="#94A3B8" />
              <Text style={styles.cmpColLabelTxt}>PCS</Text>
            </View>
            <Text style={styles.cmpColVal}>{pcs > 0 ? pcs.toLocaleString() : '—'}</Text>
          </View>

          <View style={styles.cmpVertDivider} />

          {/* Revenue */}
          <View style={styles.cmpDesktopFinCol}>
            <Text style={[styles.cmpFinBigVal, { color: '#059669' }]}>{formatCurrency(total)}</Text>
            <Text style={styles.cmpColLabelTxt}>Revenue</Text>
          </View>

          <View style={styles.cmpVertDivider} />

          {/* Profit */}
          <View style={styles.cmpDesktopFinCol}>
            <Text style={[styles.cmpFinBigVal, { color: '#FF5A00' }]}>{formatCurrency(profit)}</Text>
            <Text style={styles.cmpColLabelTxt}>Profit</Text>
          </View>

          <View style={styles.cmpChevronWrap}>
            <ChevronRight size={16} color={Colors.light.textSecondary} />
          </View>
        </TouchableOpacity>
      </View>
    );
  }

  const serviceTextFull = services.length > 0 ? services.join(' · ') : '—';

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
          <Field label="SERVICE" value={serviceTextFull} />
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

  /* ── Compact card styles ── */
  cmpCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 5,
  },
  cmpCardSelected: {
    borderColor: Colors.light.primary,
    backgroundColor: '#FFF7F3',
  },
  cmpHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: 6,
  },
  cmpHeaderLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    flex: 1,
    minWidth: 0,
    flexWrap: 'wrap' as const,
  },
  cmpRecordNum: {
    fontSize: 12,
    fontWeight: '800' as const,
    color: '#111827',
    letterSpacing: 0.3,
  },
  cmpStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 20,
    borderWidth: 1,
  },
  cmpStatusText: {
    fontSize: 9,
    fontWeight: '600' as const,
  },
  cmpName: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#111827',
  },
  cmpMeta: {
    fontSize: 11,
    color: '#64748B',
  },
  cmpRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    flexWrap: 'wrap' as const,
  },
  cmpStatItem: {
    fontSize: 11,
    color: '#94A3B8',
  },
  cmpStatVal: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#374151',
  },
  cmpSep: {
    fontSize: 11,
    color: '#CBD5E1',
  },

  /* Mobile two-column compact */
  cmpBodyMobile: {
    flexDirection: 'row' as const,
    gap: 10,
  },
  cmpBodyLeft: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  cmpBodyRight: {
    gap: 2,
    alignItems: 'flex-end' as const,
    minWidth: 80,
  },
  cmpRightLabel: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: '#94A3B8',
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
  },
  cmpRightVal: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#111827',
  },
  cmpFinRowMobile: {
    flexDirection: 'row' as const,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 6,
    gap: 8,
  },
  cmpFinColMobile: {
    flex: 1,
    gap: 2,
  },
  cmpFinLabel: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: '#94A3B8',
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
  },
  cmpFinVal: {
    fontSize: 13,
    fontWeight: '800' as const,
    color: '#111827',
  },

  /* ── Desktop compact — single horizontal row ── */
  cmpDesktopCard: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'stretch' as const,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden' as const,
  },
  cmpDesktopLeft: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 3,
    justifyContent: 'center' as const,
  },
  cmpDesktopTopRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    flexWrap: 'wrap' as const,
  },
  cmpVertDivider: {
    width: 1,
    backgroundColor: '#E2E8F0',
    alignSelf: 'stretch' as const,
  },
  cmpDesktopDataCol: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 5,
    justifyContent: 'center' as const,
    minWidth: 106,
  },
  cmpDesktopColLabelRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  cmpColLabelTxt: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#94A3B8',
    letterSpacing: 0.3,
    textTransform: 'uppercase' as const,
  },
  cmpColVal: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#111827',
  },
  cmpDesktopFinCol: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 3,
    justifyContent: 'center' as const,
    alignItems: 'flex-end' as const,
    minWidth: 84,
  },
  cmpFinBigVal: {
    fontSize: 15,
    fontWeight: '800' as const,
  },
  cmpChevronWrap: {
    paddingHorizontal: 10,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    alignSelf: 'stretch' as const,
  },
});
