import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions, Image } from 'react-native';
import { ChevronRight, Check, Calendar, Package, ChevronLeft, Scissors } from 'lucide-react-native';
import { getEffectiveStatus, STATUS_CONFIG } from '@/types/quote';
import { formatCurrency } from '@/utils/quoteCalculations';
import { formatDate } from '@/utils/textFormatting';
import Colors from '@/constants/colors';
import { metricValueStyle } from '@/components/Metric';

const CMP_THUMB_COLORS = ['#FF5A00', '#2563EB', '#7C3AED', '#059669', '#DC2626', '#D97706', '#0891B2'];

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
  const allMockupUris: string[] = Array.isArray(quote.mockupGallery)
    ? quote.mockupGallery
    : (quote.lineItems || []).map((li: any) => li.mockupUri).filter(Boolean);
  const [cmpImgIdx, setCmpImgIdx] = useState(0);
  const cmpThumbColor = CMP_THUMB_COLORS[(((quote.projectName || '')[0] || '').charCodeAt(0) || 0) % CMP_THUMB_COLORS.length];
  const cmpThumbInitial = ((quote.projectName || '').trim()[0] || '?').toUpperCase();

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
            <Text style={styles.cmpName} numberOfLines={1}>{quote.projectName || '—'}</Text>
            {(quote.personOrganization || serviceText) ? (
              <Text style={styles.cmpMeta} numberOfLines={1}>
                {[quote.personOrganization, serviceText].filter(Boolean).join(' · ')}
              </Text>
            ) : null}
            {/* Data strip — same visual language as desktop */}
            <View style={styles.cmpMobileDataStrip}>
              <View style={styles.cmpMobileDataCol}>
                <View style={styles.cmpDesktopColLabelRow}>
                  <Calendar size={10} color="#94A3B8" />
                  <Text style={styles.cmpColLabelTxt}>Due</Text>
                </View>
                <Text style={styles.cmpColVal}>{dueDate}</Text>
              </View>
              <View style={styles.cmpVertDivider} />
              <View style={styles.cmpMobileDataCol}>
                <View style={styles.cmpDesktopColLabelRow}>
                  <Package size={10} color="#94A3B8" />
                  <Text style={styles.cmpColLabelTxt}>PCS</Text>
                </View>
                <Text style={styles.cmpColVal}>{pcs > 0 ? pcs.toLocaleString() : '—'}</Text>
              </View>
              <View style={styles.cmpVertDivider} />
              <View style={styles.cmpMobileFinCol}>
                <Text style={[styles.cmpFinBigVal, { color: '#059669', fontSize: 13 }]}>{formatCurrency(total)}</Text>
                <Text style={styles.cmpColLabelTxt}>Revenue</Text>
              </View>
              <View style={styles.cmpVertDivider} />
              <View style={styles.cmpMobileFinCol}>
                <Text style={[styles.cmpFinBigVal, { color: '#FF5A00', fontSize: 13 }]}>{formatCurrency(profit)}</Text>
                <Text style={styles.cmpColLabelTxt}>Profit</Text>
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
          {/* Mockup thumbnail with carousel */}
          <View style={styles.cmpThumbWrap}>
            {allMockupUris.length > 0 ? (
              <Image
                source={{ uri: allMockupUris[cmpImgIdx] }}
                style={styles.cmpThumbImg}
                resizeMode="contain"
              />
            ) : (
              <View style={[styles.cmpThumbFallback, { backgroundColor: cmpThumbColor + '22' }]}>
                <Text style={[styles.cmpThumbInitial, { color: cmpThumbColor }]}>{cmpThumbInitial}</Text>
              </View>
            )}
            {allMockupUris.length > 1 && (
              <>
                <TouchableOpacity
                  style={[styles.cmpThumbArrow, styles.cmpThumbArrowLeft]}
                  onPress={(e: any) => { e?.stopPropagation?.(); setCmpImgIdx(i => (i - 1 + allMockupUris.length) % allMockupUris.length); }}
                  hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                  activeOpacity={0.8}
                >
                  <ChevronLeft size={10} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.cmpThumbArrow, styles.cmpThumbArrowRight]}
                  onPress={(e: any) => { e?.stopPropagation?.(); setCmpImgIdx(i => (i + 1) % allMockupUris.length); }}
                  hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                  activeOpacity={0.8}
                >
                  <ChevronRight size={10} color="#fff" />
                </TouchableOpacity>
                <View style={styles.cmpThumbDots}>
                  {allMockupUris.map((_: string, di: number) => (
                    <View key={di} style={[styles.cmpThumbDot, di === cmpImgIdx && styles.cmpThumbDotActive]} />
                  ))}
                </View>
              </>
            )}
          </View>
          {/* Left: project number + name + client */}
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
            {quote.personOrganization ? (
              <Text style={styles.cmpMeta} numberOfLines={1}>{quote.personOrganization}</Text>
            ) : null}
          </View>

          <View style={styles.cmpVertDivider} />

          {/* Services */}
          <View style={styles.cmpServicesDataCol}>
            <View style={styles.cmpDesktopColLabelRow}>
              <Scissors size={11} color="#94A3B8" />
              <Text style={styles.cmpColLabelTxt}>Services</Text>
            </View>
            {services.length > 0 ? (
              services.map((s, i) => (
                <Text key={i} style={services.length > 1 ? styles.cmpColValSm : styles.cmpColVal}>{s}</Text>
              ))
            ) : (
              <Text style={styles.cmpColVal}>—</Text>
            )}
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

  /* Mobile data strip — same visual language as desktop divider columns */
  cmpMobileDataStrip: {
    flexDirection: 'row' as const,
    alignItems: 'stretch' as const,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    marginTop: 4,
    marginHorizontal: -12,
  },
  cmpMobileDataCol: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 3,
    justifyContent: 'center' as const,
  },
  cmpMobileFinCol: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 2,
    justifyContent: 'center' as const,
    alignItems: 'flex-end' as const,
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
    flex: 0.65,
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
  cmpServicesDataCol: {
    paddingHorizontal: 10,
    paddingVertical: 11,
    gap: 3,
    justifyContent: 'center' as const,
    width: 120,
  },
  cmpDesktopDataCol: {
    paddingHorizontal: 10,
    paddingVertical: 11,
    gap: 5,
    justifyContent: 'center' as const,
    width: 96,
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
  cmpColValSm: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#111827',
    lineHeight: 16,
  },
  cmpDesktopFinCol: {
    paddingHorizontal: 10,
    paddingVertical: 11,
    gap: 3,
    justifyContent: 'center' as const,
    alignItems: 'flex-end' as const,
    width: 88,
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

  /* ── Compact thumbnail carousel ── */
  cmpThumbWrap: {
    width: 77,
    height: 86,
    backgroundColor: '#F3F4F6',
    flexShrink: 0,
    overflow: 'hidden' as const,
    position: 'relative' as const,
    alignSelf: 'center' as const,
  },
  cmpThumbImg: {
    width: 77,
    height: 86,
  },
  cmpThumbFallback: {
    width: 77,
    height: 86,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  cmpThumbInitial: {
    fontSize: 22,
    fontWeight: '900' as const,
  },
  cmpThumbArrow: {
    position: 'absolute' as const,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.38)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    top: 27,
  },
  cmpThumbArrowLeft: { left: 1 },
  cmpThumbArrowRight: { right: 1 },
  cmpThumbDots: {
    position: 'absolute' as const,
    bottom: 4,
    left: 0,
    right: 0,
    flexDirection: 'row' as const,
    justifyContent: 'center' as const,
    gap: 3,
  },
  cmpThumbDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  cmpThumbDotActive: {
    backgroundColor: '#FF5A00',
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
});
