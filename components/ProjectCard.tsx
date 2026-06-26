import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image, Alert, Platform, ScrollView,
} from 'react-native';
import {
  ChevronRight, ChevronLeft, Check, Calendar, Package,
  Scissors, ExternalLink, MoreVertical, Flame, Edit3, Trash2,
  Sheet, Download, Printer, RotateCcw, CheckCircle, Send,
  ArrowRight, ClipboardList,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { getEffectiveStatus, STATUS_CONFIG, PRIORITY_CONFIG, DEFAULT_PRIORITY } from '@/types/quote';
import type { ProjectPriority } from '@/types/quote';
import { formatCurrency } from '@/utils/quoteCalculations';
import { formatDate } from '@/utils/textFormatting';
import { parseProjectDate } from '@/lib/production';
import Colors from '@/constants/colors';
import { metricValueStyle } from '@/components/Metric';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import OverlayMenu from '@/components/OverlayMenu';
import { useQuotes } from '@/contexts/QuotesContext';
import { useUser } from '@/contexts/UserContext';
import { useCrm } from '@/contexts/CrmContext';
import { generateProjectDocumentPDF, printQuote } from '@/utils/pdfGenerator';
import { exportSingleSaleToSheets } from '@/utils/googleSheetsExport';
import { getAuthHeaders } from '@/lib/apiFetch';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getPcs(quote: any): number {
  return (quote.lineItems || []).reduce(
    (s: number, li: any) =>
      s + Object.values(li.sizes || {}).reduce((ps: number, v: any) => ps + (Number(v) || 0), 0),
    0,
  );
}

function getDueInfo(inHandsDate?: string | null): { text: string; daysText: string; isOverdue: boolean } {
  if (!inHandsDate) return { text: '—', daysText: '', isOverdue: false };
  const d = parseProjectDate(inHandsDate);
  if (!d) return { text: '—', daysText: '', isOverdue: false };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(d); due.setHours(0, 0, 0, 0);
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000);
  const text = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const isOverdue = diff < 0;
  const daysText = isOverdue
    ? `${Math.abs(diff)}d overdue`
    : diff === 0 ? 'Due today'
    : `${diff} day${diff !== 1 ? 's' : ''}`;
  return { text, daysText, isOverdue };
}

function getCtaLabel(quote: any): string {
  const eff = getEffectiveStatus(quote);
  if (['quoted', 'quoting', 'needs_review', 'invoice_sent'].includes(eff)) return 'Open Quote';
  return 'Open Project';
}

function isActiveProject(status: string): boolean {
  return ['active', 'production_started', 'completed'].includes(status);
}

function isSubmittedQuote(status: string): boolean {
  return ['needs_review', 'quoting', 'quoted', 'invoice_sent'].includes(status);
}

function Field({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <Text style={[s.fieldValue, accent && s.fieldValueAccent]} numberOfLines={1}>
        {value || '—'}
      </Text>
    </View>
  );
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface ProjectCardProps {
  queue: number;
  quote: any;
  onPress: () => void;
  isSelected?: boolean;
  selectionMode?: boolean;
  onToggleSelect?: () => void;
  compact?: boolean;
  onActionComplete?: () => void;
}

// ─── Compact Desktop Actions — internal sub-component ────────────────────────

function CompactActions({
  quote,
  onPress,
  onActionComplete,
  containerStyle,
}: {
  quote: any;
  onPress: () => void;
  onActionComplete?: () => void;
  containerStyle?: any;
}) {
  const router = useRouter();
  const { updateQuoteAsync, deleteQuote, convertToQuote, markExportedToSheets } = useQuotes();
  const { currentUser } = useUser();
  const { orgs } = useCrm();

  const status = quote.status as string;
  const ctaLabel = getCtaLabel(quote);
  const isActive = isActiveProject(status);
  const isQuote = isSubmittedQuote(status);

  // Derive linked contact for email (mirrors quote/[id].tsx linkedOrg/linkedContact logic)
  const linkedContact = useMemo(() => {
    const linkedOrg = quote.orgId
      ? orgs.find((o: any) => o.id === quote.orgId)
      : orgs.find((o: any) => o.name?.toLowerCase() === (quote.personOrganization || '').toLowerCase());
    if (!linkedOrg) return null;
    return linkedOrg.contacts?.find((c: any) => c.isPrimary) || linkedOrg.contacts?.[0] || null;
  }, [orgs, quote.orgId, quote.personOrganization]);

  const invoiceReady = ['quoted', 'invoice_sent', 'paid', 'active', 'production_started', 'completed'].includes(status);
  const productionReady = ['paid', 'active', 'production_started', 'completed'].includes(status);

  // Mirrors the same check used in quote/[id].tsx handleMarkQuoteSent
  const isReadyToSend = useMemo(() => {
    const calc = quote.calculations;
    if (!calc) return false;
    const isValidNumber = (v: unknown) =>
      typeof v === 'number' && !isNaN(v) && isFinite(v);
    return (
      isValidNumber(calc.productCostTotal) &&
      isValidNumber(calc.serviceCostTotal) &&
      isValidNumber(calc.markupAmount) &&
      isValidNumber(calc.total)
    );
  }, [quote.calculations]);

  const done = useCallback(() => {
    onActionComplete?.();
  }, [onActionComplete]);

  const handleEdit = useCallback((e?: any) => {
    e?.stopPropagation?.();
    router.push({ pathname: '/quote/edit', params: { id: quote.id } } as any);
  }, [quote.id, router]);

  const handleViewProduction = useCallback((e?: any) => {
    e?.stopPropagation?.();
    router.push(`/quote/production/${quote.id}` as any);
  }, [quote.id, router]);

  const handleStartQuoting = useCallback(async (e?: any) => {
    e?.stopPropagation?.();
    try {
      await updateQuoteAsync({ ...quote, status: 'quoting' });
      done();
    } catch {}
    router.push({ pathname: '/quote/edit', params: { id: quote.id } } as any);
  }, [quote, updateQuoteAsync, router, done]);

  const handleSendQuote = useCallback(async (e?: any) => {
    e?.stopPropagation?.();
    const isAlreadyQuoted = status === 'quoted' || status === 'invoice_sent';
    if (!isReadyToSend && !isAlreadyQuoted) {
      Alert.alert(
        'Pricing Required',
        'Please add product costs and service costs before sending the quote.',
        [
          { text: 'Edit Quote', onPress: () => handleEdit() },
          { text: 'Cancel', style: 'cancel' },
        ],
      );
      return;
    }
    try {
      const sentAt = new Date().toISOString();
      await updateQuoteAsync({ ...quote, status: 'quoted', quoteSentAt: sentAt });

      // Mirror quote/[id].tsx: copy portal link + fire email if contact has an address
      const portalUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/portal/quote/${quote.id}`
        : '';
      if (Platform.OS === 'web' && portalUrl && navigator?.clipboard) {
        navigator.clipboard.writeText(portalUrl).catch(() => {});
      }
      const contactEmail = linkedContact?.email;
      if (contactEmail && portalUrl) {
        getAuthHeaders().then(authH =>
          fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authH },
            body: JSON.stringify({
              type: 'quote',
              clientEmail: contactEmail,
              clientName: quote.personOrganization || 'there',
              projectName: quote.projectName || 'Your Order',
              total: quote.calculations?.total ?? null,
              portalUrl,
              waveLink: quote.waveInvoiceLink || '',
            }),
          }),
        ).catch((err) => console.warn('[card send-quote email]', err));
      }

      done();
    } catch {}
  }, [quote, status, isReadyToSend, updateQuoteAsync, handleEdit, linkedContact, done]);

  const handleMarkPaid = useCallback(async (e?: any) => {
    e?.stopPropagation?.();
    try {
      await updateQuoteAsync({ ...quote, status: 'paid' });
      done();
    } catch {}
  }, [quote, updateQuoteAsync, done]);

  // Use mutate's onSuccess callback for guaranteed completion semantics
  const handleRevert = useCallback((e?: any) => {
    e?.stopPropagation?.();
    if (quote.isLocked) {
      Alert.alert('Locked', 'Unlock this project first before reverting.');
      return;
    }
    convertToQuote(quote.id, { onSuccess: done });
  }, [quote, convertToQuote, done]);

  const handleDelete = useCallback((e?: any) => {
    e?.stopPropagation?.();
    Alert.alert(
      'Delete Project',
      `Delete "${quote.projectName}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteQuote(quote.id, { onSuccess: done });
          },
        },
      ],
    );
  }, [quote, deleteQuote, done]);

  const handleQuotePdf = useCallback(async (close: () => void) => {
    close();
    try {
      await generateProjectDocumentPDF(quote, 'QUOTE', currentUser);
    } catch {
      Alert.alert('Error', 'Failed to export Quote PDF');
    }
  }, [quote, currentUser]);

  const handleInvoicePdf = useCallback(async (close: () => void) => {
    close();
    try {
      await generateProjectDocumentPDF(quote, 'INVOICE', currentUser);
    } catch {
      Alert.alert('Error', 'Failed to export Invoice PDF');
    }
  }, [quote, currentUser]);

  const handleProductionSheet = useCallback(async (close: () => void) => {
    close();
    try {
      await generateProjectDocumentPDF(quote, 'PRODUCTION', currentUser);
    } catch {
      Alert.alert('Error', 'Failed to export Production Punch Sheet');
    }
  }, [quote, currentUser]);

  const handlePrint = useCallback(async (close: () => void) => {
    close();
    try {
      await printQuote(quote, currentUser);
    } catch {
      Alert.alert('Error', 'Failed to print');
    }
  }, [quote, currentUser]);

  // Mirrors quote/[id].tsx: check salesData + googleSheetsUrl, call markExportedToSheets on success
  const handleExportToSheets = useCallback(async (close: () => void) => {
    close();
    if (!quote.salesData) {
      Alert.alert('Not Available', 'Export to Sheets is only available for active projects with sales data.');
      return;
    }
    if (!currentUser?.googleSheetsUrl) {
      Alert.alert(
        'Setup Required',
        'Please set up your Google Sheets Web App URL in Profile settings first.',
        [{ text: 'OK' }],
      );
      return;
    }
    try {
      const result = await exportSingleSaleToSheets(currentUser.googleSheetsUrl, quote);
      if (result.success) {
        markExportedToSheets(quote.id, { onSuccess: done });
      } else {
        Alert.alert('Export Failed', result.message ?? 'Failed to export to Google Sheets');
      }
    } catch {
      Alert.alert('Error', 'Failed to export to Google Sheets');
    }
  }, [quote, currentUser, markExportedToSheets, done]);

  // ── Secondary orange button label / handler ──────────────────────────────
  let secondaryLabel = '';
  let secondaryIcon: React.ReactNode = null;
  let secondaryHandler: (e?: any) => void = () => {};
  let secondaryColor = '#FF5A00';

  if (isActive) {
    secondaryLabel = 'View Production';
    secondaryIcon = <Flame size={11} color="#fff" />;
    secondaryHandler = handleViewProduction;
  } else if (status === 'needs_review') {
    secondaryLabel = 'Start Quoting';
    secondaryIcon = <ArrowRight size={11} color="#fff" />;
    secondaryHandler = handleStartQuoting;
  } else if (status === 'quoting') {
    secondaryLabel = 'Send Quote';
    secondaryIcon = <Send size={11} color="#fff" />;
    secondaryHandler = handleSendQuote;
  } else if (status === 'quoted' || status === 'invoice_sent') {
    secondaryLabel = 'Mark as Paid';
    secondaryIcon = <CheckCircle size={11} color="#fff" />;
    secondaryHandler = handleMarkPaid;
    secondaryColor = '#16A34A';
  }

  return (
    <View style={[s.actionsCol, containerStyle]} onStartShouldSetResponder={() => true}>
      {/* Secondary orange action button */}
      {secondaryLabel ? (
        <TouchableOpacity
          style={[s.actionBtnSolid, { backgroundColor: secondaryColor }]}
          onPress={(e: any) => { e?.stopPropagation?.(); secondaryHandler(e); }}
          activeOpacity={0.8}
        >
          {secondaryIcon}
          <Text style={s.actionBtnSolidText} numberOfLines={1}>{secondaryLabel}</Text>
        </TouchableOpacity>
      ) : null}

      {/* Row: Open button + ellipsis */}
      <View style={s.actionBtnRow}>
        <TouchableOpacity
          style={[s.actionBtn, { flex: 1 }]}
          onPress={(e: any) => { e?.stopPropagation?.(); onPress(); }}
          activeOpacity={0.8}
        >
          <ExternalLink size={11} color={Colors.light.text} />
          <Text style={s.actionBtnText} numberOfLines={1}>{ctaLabel}</Text>
        </TouchableOpacity>

        <OverlayMenu
          align="right"
          menuWidth={200}
          trigger={({ open }) => (
            <TouchableOpacity
              style={s.ellipsisBtn}
              onPress={(e: any) => { e?.stopPropagation?.(); open(); }}
              activeOpacity={0.8}
            >
              <MoreVertical size={14} color={Colors.light.textSecondary} />
            </TouchableOpacity>
          )}
        >
          {({ close }) => (
            <>
              {/* Edit Quote */}
              {(!isActive || !quote.isLocked) && (
                <TouchableOpacity style={s.menuItem} onPress={() => { close(); handleEdit(); }}>
                  <Edit3 size={15} color={Colors.light.text} />
                  <Text style={s.menuItemText}>Edit Quote</Text>
                </TouchableOpacity>
              )}

              {/* Revert to Quoted — active projects only, when not locked */}
              {isActive && !quote.isLocked && (
                <TouchableOpacity style={s.menuItem} onPress={() => { close(); handleRevert(); }}>
                  <RotateCcw size={15} color={Colors.light.textSecondary} />
                  <Text style={[s.menuItemText, { color: Colors.light.textSecondary }]}>Revert to Quoted</Text>
                </TouchableOpacity>
              )}

              {/* Mark as Paid — submitted quotes, quoted/invoice_sent only */}
              {isQuote && (status === 'quoted' || status === 'invoice_sent') && (
                <TouchableOpacity style={s.menuItem} onPress={() => { close(); handleMarkPaid(); }}>
                  <CheckCircle size={15} color="#16A34A" />
                  <Text style={[s.menuItemText, { color: '#16A34A' }]}>Mark as Paid</Text>
                </TouchableOpacity>
              )}

              <View style={s.menuSeparator} />

              {/* Quote PDF */}
              <TouchableOpacity style={s.menuItem} onPress={() => handleQuotePdf(close)}>
                <Download size={15} color={Colors.light.text} />
                <Text style={s.menuItemText}>Quote PDF</Text>
              </TouchableOpacity>

              {/* Invoice PDF */}
              {invoiceReady && (
                <TouchableOpacity style={s.menuItem} onPress={() => handleInvoicePdf(close)}>
                  <ClipboardList size={15} color={Colors.light.text} />
                  <Text style={s.menuItemText}>Invoice PDF</Text>
                </TouchableOpacity>
              )}

              {/* Production Punch Sheet — active projects */}
              {isActive && productionReady && (
                <TouchableOpacity style={s.menuItem} onPress={() => handleProductionSheet(close)}>
                  <ClipboardList size={15} color={Colors.light.tint} />
                  <Text style={[s.menuItemText, { color: Colors.light.tint }]}>Production Punch Sheet</Text>
                </TouchableOpacity>
              )}

              {/* Export to Sheets — active projects */}
              {isActive && (
                <TouchableOpacity style={s.menuItem} onPress={() => handleExportToSheets(close)}>
                  <Sheet size={15} color={Colors.light.success} />
                  <Text style={[s.menuItemText, { color: Colors.light.success }]}>Export to Sheets</Text>
                </TouchableOpacity>
              )}

              {/* Print — submitted quotes */}
              {isQuote && (
                <TouchableOpacity style={s.menuItem} onPress={() => handlePrint(close)}>
                  <Printer size={15} color={Colors.light.text} />
                  <Text style={s.menuItemText}>Print</Text>
                </TouchableOpacity>
              )}

              {/* Locked info row — active projects when locked, mirrors quote detail */}
              {isActive && quote.isLocked && (
                <View style={s.menuItem}>
                  <Trash2 size={15} color={Colors.light.textSecondary} />
                  <Text style={[s.menuItemText, { color: Colors.light.textSecondary }]}>Project is Locked</Text>
                </View>
              )}

              {/* Delete — hidden for locked active projects (lock bypass prevention) */}
              {!(isActive && quote.isLocked) && (
                <>
                  <View style={s.menuSeparator} />
                  <TouchableOpacity style={s.menuItem} onPress={() => { close(); handleDelete(); }}>
                    <Trash2 size={15} color={Colors.light.error} />
                    <Text style={[s.menuItemText, { color: Colors.light.error }]}>Delete</Text>
                  </TouchableOpacity>
                </>
              )}
            </>
          )}
        </OverlayMenu>
      </View>
    </View>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ProjectCard({
  queue,
  quote,
  onPress,
  isSelected = false,
  selectionMode = false,
  onToggleSelect,
  compact = false,
  onActionComplete,
}: ProjectCardProps) {
  const { isMobile } = useBreakpoint();

  const eff = getEffectiveStatus(quote);
  const cfg = STATUS_CONFIG[eff];
  const pNum = quote.projectNumber || quote.invoiceNumber || '—';
  const pcs = getPcs(quote);
  const services = [...new Set(
    (quote.lineItems || []).map((li: any) => li.serviceStyle).filter(Boolean),
  )] as string[];
  const total = quote.calculations?.total ?? 0;
  const profit = quote.calculations?.markupAmount ?? 0;
  const dueInfo = getDueInfo(quote.inHandsDate);

  const priority = (quote.priority as ProjectPriority) || DEFAULT_PRIORITY;
  const priCfg = PRIORITY_CONFIG[priority];

  const allMockupUris: string[] = Array.isArray(quote.mockupGallery)
    ? quote.mockupGallery
    : (quote.lineItems || []).map((li: any) => li.mockupUri).filter(Boolean);
  const [thumbIdx, setThumbIdx] = useState(0);

  const thumbInitial = ((quote.projectName || '').trim()[0] || '?').toUpperCase();

  // ── Mobile compact ────────────────────────────────────────────────────────
  if (compact && isMobile) {
    const checkbox = selectionMode ? (
      <TouchableOpacity onPress={onToggleSelect} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <View style={[s.checkbox, isSelected && s.checkboxChecked]}>
          {isSelected && <Check size={10} color="#fff" strokeWidth={3} />}
        </View>
      </TouchableOpacity>
    ) : null;

    return (
      <View style={s.row}>
        <Text style={s.queueNum}>#{queue}</Text>
        <TouchableOpacity
          style={[s.cmpCard, isSelected && s.cmpCardSelected]}
          onPress={selectionMode ? (onToggleSelect ?? onPress) : onPress}
          activeOpacity={0.75}
        >
          {/* Top section: mockup on left, info on right */}
          <View style={s.cmpTopRow}>
            {/* Mockup thumbnail */}
            <View style={s.cmpThumbCol}>
              {allMockupUris.length > 0 ? (
                <Image
                  source={{ uri: allMockupUris[0] }}
                  style={s.cmpThumbImg}
                  resizeMode="contain"
                />
              ) : (
                <View style={s.cmpThumbFallback}>
                  <Text style={s.cmpThumbInitial}>{thumbInitial}</Text>
                </View>
              )}
              <View style={s.cmpProjBadge}>
                <Text style={s.cmpProjBadgeTxt}>{pNum}</Text>
              </View>
            </View>

            {/* Info: status + name + org + priority */}
            <View style={s.cmpInfoRight}>
              <View style={s.cmpHeader}>
                <View style={s.cmpHeaderLeft}>
                  {checkbox}
                  <View style={[s.cmpStatusBadge, { backgroundColor: cfg.bg, borderColor: cfg.borderColor }]}>
                    <Text style={[s.cmpStatusText, { color: cfg.color }]}>{cfg.label}</Text>
                  </View>
                </View>
                <ChevronRight size={14} color={Colors.light.textSecondary} />
              </View>
              <Text style={s.cmpName} numberOfLines={1}>{quote.projectName || '—'}</Text>
              {quote.personOrganization ? (
                <Text style={s.cmpMeta} numberOfLines={1}>{quote.personOrganization}</Text>
              ) : null}
              <View style={s.cmpPriRow}>
                <View style={[s.cmpPriDot, { backgroundColor: priCfg.color }]} />
                <Text style={[s.cmpPriText, { color: priCfg.color }]}>{priCfg.label} Priority</Text>
              </View>
            </View>
          </View>

          <View style={s.cmpMobileDataStrip}>
            <View style={s.cmpMobileDataCol}>
              <View style={s.cmpColLabelRow}>
                <Calendar size={10} color="#94A3B8" />
                <Text style={s.cmpColLabelTxt}>Due</Text>
              </View>
              <Text style={s.cmpColVal}>{dueInfo.text}</Text>
            </View>
            <View style={s.cmpVertDivider} />
            <View style={s.cmpMobileDataCol}>
              <View style={s.cmpColLabelRow}>
                <Package size={10} color="#94A3B8" />
                <Text style={s.cmpColLabelTxt}>PCS</Text>
              </View>
              <Text style={s.cmpColVal}>{pcs > 0 ? pcs.toLocaleString() : '—'}</Text>
            </View>
            <View style={s.cmpVertDivider} />
            <View style={s.cmpMobileDataCol}>
              <View style={s.cmpColLabelRow}>
                <Scissors size={10} color="#94A3B8" />
                <Text style={s.cmpColLabelTxt}>Service</Text>
              </View>
              <Text style={s.cmpColVal} numberOfLines={1}>{services[0] || '—'}</Text>
            </View>
          </View>
          <CompactActions
            quote={quote}
            onPress={selectionMode ? (onToggleSelect ?? onPress) : onPress}
            onActionComplete={onActionComplete}
            containerStyle={s.cmpActionsWrap}
          />
        </TouchableOpacity>
      </View>
    );
  }

  // ── Desktop compact — production-queue style horizontal row ───────────────
  if (compact) {
    return (
      <View style={s.row}>
        <Text style={s.queueNum}>#{queue}</Text>
        <TouchableOpacity
          style={[s.deskCard, isSelected && s.deskCardSelected]}
          onPress={selectionMode ? (onToggleSelect ?? onPress) : onPress}
          activeOpacity={0.85}
        >
          {/* Mockup column — dark background, project # badge, carousel */}
          <View style={s.thumbCol}>
            <View style={s.thumbWrap}>
              {allMockupUris.length > 0 ? (
                <Image
                  source={{ uri: allMockupUris[thumbIdx] }}
                  style={s.thumbImg}
                  resizeMode="contain"
                />
              ) : (
                <View style={s.thumbFallback}>
                  <Text style={s.thumbInitial}>{thumbInitial}</Text>
                </View>
              )}

              {/* Project number badge — top left */}
              <View style={s.projNumBadge}>
                <Text style={s.projNumText}>{pNum}</Text>
              </View>

              {/* Mockup count badge — bottom left */}
              {allMockupUris.length > 1 && (
                <View style={s.mockupCountBadge}>
                  <Text style={s.mockupCountText}>{allMockupUris.length} MOCKUPS</Text>
                </View>
              )}

              {/* Carousel arrows + orange dots */}
              {allMockupUris.length > 1 && (
                <>
                  <TouchableOpacity
                    style={[s.thumbArrow, s.thumbArrowLeft]}
                    onPress={(e: any) => {
                      e?.stopPropagation?.();
                      setThumbIdx(i => (i - 1 + allMockupUris.length) % allMockupUris.length);
                    }}
                    hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                    activeOpacity={0.8}
                  >
                    <ChevronLeft size={10} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.thumbArrow, s.thumbArrowRight]}
                    onPress={(e: any) => {
                      e?.stopPropagation?.();
                      setThumbIdx(i => (i + 1) % allMockupUris.length);
                    }}
                    hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                    activeOpacity={0.8}
                  >
                    <ChevronRight size={10} color="#fff" />
                  </TouchableOpacity>
                  <View style={s.thumbDots}>
                    {allMockupUris.map((_: string, di: number) => (
                      <View key={di} style={[s.thumbDot, di === thumbIdx && s.thumbDotActive]} />
                    ))}
                  </View>
                </>
              )}
            </View>
          </View>

          {/* Info column — name + org */}
          <View style={s.infoCol}>
            <Text style={s.projName} numberOfLines={2}>{quote.projectName || '—'}</Text>
            <Text style={s.orgName} numberOfLines={1}>{quote.personOrganization || '—'}</Text>
          </View>

          {/* Status + Priority column */}
          <View style={s.statusCol}>
            <Text style={s.colLabel}>STATUS</Text>
            <View style={[s.statusPill, { backgroundColor: cfg.bg, borderColor: cfg.borderColor }]}>
              <Text style={[s.statusPillText, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
            <Text style={[s.colLabel, { marginTop: 10 }]}>PRIORITY</Text>
            <View style={s.priRow}>
              <View style={[s.priDot, { backgroundColor: priCfg.color }]} />
              <Text style={[s.priText, { color: priCfg.color }]}>{priCfg.label}</Text>
            </View>
          </View>

          {/* Service column */}
          <View style={s.serviceCol}>
            <Text style={s.colLabel}>SERVICE</Text>
            {services.length > 0
              ? services.map((sv, i) => (
                  <Text key={i} style={s.colValue} numberOfLines={1}>{sv}</Text>
                ))
              : <Text style={s.colMuted}>—</Text>}
          </View>

          {/* Due Date column */}
          <View style={s.dueDateCol}>
            <Text style={s.colLabel}>DUE DATE</Text>
            <Text style={s.dueDateText}>{dueInfo.text}</Text>
            {dueInfo.daysText ? (
              <View style={[s.daysBadge, {
                backgroundColor: dueInfo.isOverdue ? '#FEE2E2' : '#FFF3E8',
              }]}>
                <Text style={[s.daysText, {
                  color: dueInfo.isOverdue ? '#DC2626' : '#FF5A00',
                }]}>{dueInfo.daysText}</Text>
              </View>
            ) : null}
          </View>

          {/* PCS column */}
          <View style={s.pcsCol}>
            <Text style={s.colLabel}>PCS</Text>
            <Text style={s.pcsValue}>{pcs > 0 ? pcs.toLocaleString() : '—'}</Text>
          </View>

          {/* Actions column — status-aware secondary button + ellipsis */}
          <CompactActions
            quote={quote}
            onPress={onPress}
            onActionComplete={onActionComplete}
          />
        </TouchableOpacity>
      </View>
    );
  }

  // ── Full card (non-compact) ───────────────────────────────────────────────
  const serviceTextFull = services.length > 0 ? services.join(' · ') : '—';

  return (
    <View style={s.row}>
      <Text style={s.queueNum}>#{queue}</Text>
      <TouchableOpacity
        style={[s.card, isSelected && s.cardSelected]}
        onPress={selectionMode ? (onToggleSelect ?? onPress) : onPress}
        activeOpacity={0.75}
      >
        <View style={s.header}>
          <View style={s.headerLeft}>
            {selectionMode && (
              <TouchableOpacity onPress={onToggleSelect} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <View style={[s.checkbox, isSelected && s.checkboxChecked]}>
                  {isSelected && <Check size={10} color="#fff" strokeWidth={3} />}
                </View>
              </TouchableOpacity>
            )}
            <Text style={s.recordNum}>{pNum}</Text>
            <View style={[s.statusBadge, { backgroundColor: cfg.bg, borderColor: cfg.borderColor }]}>
              <Text style={[s.statusBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
          </View>
          <ChevronRight size={16} color={Colors.light.textSecondary} />
        </View>

        <View style={s.grid}>
          <Field label="PROJECT" value={quote.projectName} accent />
          <Field label="CLIENT" value={quote.personOrganization} accent />
        </View>
        <View style={s.grid}>
          <Field label="ORDER DATE" value={quote.orderDate ? formatDate(quote.orderDate) : ''} />
          <Field label="DUE DATE" value={quote.inHandsDate ? formatDate(quote.inHandsDate) : ''} />
        </View>
        <View style={s.grid}>
          <Field label="SERVICE" value={serviceTextFull} />
          <Field label="PCS" value={pcs > 0 ? `${pcs.toLocaleString()}` : ''} />
        </View>

        <View style={s.footer}>
          <View style={s.finCol}>
            <Text style={s.fieldLabel}>TOTAL</Text>
            <Text style={s.finValue}>{formatCurrency(total)}</Text>
          </View>
          <View style={s.finCol}>
            <Text style={s.fieldLabel}>PROFIT</Text>
            <Text style={[s.finValue, s.profitValue]}>{formatCurrency(profit)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  rowScrollContent: {
    flexGrow: 1,
    minWidth: 880,
  },
  queueNum: {
    ...metricValueStyle,
    width: 36,
    textAlign: 'right',
    flexShrink: 0,
    paddingTop: 10,
  },

  // ── Desktop compact card ─────────────────────────────────────────────────
  deskCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: Colors.light.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    minHeight: 110,
  },
  deskCardSelected: {
    borderColor: Colors.light.tint,
    borderWidth: 2,
  },

  // Mockup col
  thumbCol: { width: 120, flexShrink: 0 },
  thumbWrap: {
    flex: 1,
    backgroundColor: '#111',
    minHeight: 110,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  thumbImg: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    width: '100%',
    height: '100%',
  },
  thumbFallback: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbInitial: { fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: 1 },

  // Project # badge
  projNumBadge: {
    position: 'absolute',
    top: 7,
    left: 7,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  projNumText: { fontSize: 10, fontWeight: '700', color: '#fff' },

  // Mockup count badge
  mockupCountBadge: {
    position: 'absolute',
    bottom: 7,
    left: 7,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  mockupCountText: { fontSize: 9, fontWeight: '700', color: '#fff', letterSpacing: 0.3 },

  // Carousel arrows
  thumbArrow: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    top: '50%',
    marginTop: -9,
  },
  thumbArrowLeft: { left: 3 },
  thumbArrowRight: { right: 3 },

  // Orange dots
  thumbDots: {
    position: 'absolute',
    bottom: 5,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 3,
  },
  thumbDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  thumbDotActive: {
    backgroundColor: '#FF5A00',
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  // Info col
  infoCol: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
    gap: 4,
    minWidth: 130,
  },
  projName: { fontSize: 14, fontWeight: '800', color: Colors.light.text, lineHeight: 19 },
  orgName: { fontSize: 12, color: Colors.light.textSecondary, fontWeight: '500' },

  // Shared column helpers
  colLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  colValue: { fontSize: 12, fontWeight: '600', color: Colors.light.text, lineHeight: 16 },
  colMuted: { fontSize: 11, color: Colors.light.textSecondary },

  // Status + Priority col
  statusCol: {
    width: 140,
    flexShrink: 0,
    padding: 12,
    justifyContent: 'flex-start',
    borderLeftWidth: 1,
    borderLeftColor: '#E2E8F0',
  },
  statusPill: {
    alignSelf: 'flex-start',
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  statusPillText: { fontSize: 10, fontWeight: '700' },
  priRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  priDot: { width: 8, height: 8, borderRadius: 4 },
  priText: { fontSize: 12, fontWeight: '600' },

  // Service col
  serviceCol: {
    width: 120,
    flexShrink: 0,
    padding: 12,
    justifyContent: 'flex-start',
    borderLeftWidth: 1,
    borderLeftColor: '#E2E8F0',
  },

  // Due Date col
  dueDateCol: {
    width: 110,
    flexShrink: 0,
    padding: 12,
    justifyContent: 'flex-start',
    borderLeftWidth: 1,
    borderLeftColor: '#E2E8F0',
  },
  dueDateText: { fontSize: 12, fontWeight: '600', color: Colors.light.text, marginBottom: 3 },
  daysBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start' },
  daysText: { fontSize: 10, fontWeight: '700' },

  // PCS col
  pcsCol: {
    width: 72,
    flexShrink: 0,
    padding: 12,
    justifyContent: 'flex-start',
    borderLeftWidth: 1,
    borderLeftColor: '#E2E8F0',
  },
  pcsValue: { fontSize: 22, fontWeight: '800', color: Colors.light.text, lineHeight: 26 },

  // Actions col — wider to accommodate secondary button + ellipsis row
  actionsCol: {
    width: 195,
    flexShrink: 0,
    padding: 10,
    justifyContent: 'center',
    gap: 6,
    borderLeftWidth: 1,
    borderLeftColor: '#E2E8F0',
  },
  actionBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
  },
  actionBtnText: { fontSize: 11, fontWeight: '600', color: Colors.light.text },
  actionBtnSolid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 7,
  },
  actionBtnSolidText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  ellipsisBtn: {
    width: 30,
    height: 30,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  // Overlay menu items
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  menuItemText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.light.text,
  },
  menuSeparator: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginVertical: 3,
    marginHorizontal: 8,
  },

  // ── Mobile compact card ──────────────────────────────────────────────────
  cmpTopRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  cmpThumbCol: {
    width: 76,
    height: 76,
    borderRadius: 8,
    backgroundColor: '#111',
    overflow: 'hidden',
    position: 'relative' as const,
    flexShrink: 0,
  },
  cmpThumbImg: {
    position: 'absolute' as const,
    top: 0, left: 0, right: 0, bottom: 0,
    width: '100%' as any,
    height: '100%' as any,
  },
  cmpThumbFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cmpThumbInitial: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: '#fff',
  },
  cmpProjBadge: {
    position: 'absolute' as const,
    top: 5,
    left: 5,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  cmpProjBadgeTxt: {
    fontSize: 8,
    fontWeight: '700' as const,
    color: '#fff',
  },
  cmpInfoRight: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  cmpCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 5,
  },
  cmpCardSelected: { borderColor: Colors.light.tint, backgroundColor: '#FFF7F3' },
  cmpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  cmpHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 0,
    flexWrap: 'wrap',
  },
  cmpRecordNum: { fontSize: 12, fontWeight: '800', color: '#111827', letterSpacing: 0.3 },
  cmpStatusBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 20, borderWidth: 1 },
  cmpStatusText: { fontSize: 9, fontWeight: '600' },
  cmpName: { fontSize: 13, fontWeight: '700', color: '#111827' },
  cmpMeta: { fontSize: 11, color: '#64748B' },
  cmpVertDivider: { width: 1, backgroundColor: '#E2E8F0', alignSelf: 'stretch' },
  cmpMobileDataStrip: {
    flexDirection: 'row',
    alignItems: 'stretch',
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
    justifyContent: 'center',
  },
  cmpColLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cmpColLabelTxt: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  cmpColVal: { fontSize: 12, fontWeight: '700', color: '#111827' },
  cmpPriRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  cmpPriDot: { width: 7, height: 7, borderRadius: 4 },
  cmpPriText: { fontSize: 11, fontWeight: '600' as const },
  cmpActionsWrap: {
    width: '100%' as any,
    borderLeftWidth: 0,
    padding: 0,
    paddingTop: 8,
    marginHorizontal: -12,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 6,
  },

  // ── Full card (non-compact) ──────────────────────────────────────────────
  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
  },
  cardSelected: { borderColor: Colors.light.tint, backgroundColor: '#FFF7F3' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
    flexWrap: 'wrap',
  },
  recordNum: { fontSize: 13, fontWeight: '800', color: '#111827', letterSpacing: 0.3 },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: Colors.light.tint, borderColor: Colors.light.tint },
  statusBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20, borderWidth: 1 },
  statusBadgeText: { fontSize: 10, fontWeight: '600' },
  grid: { flexDirection: 'row', gap: 12 },
  field: { flex: 1, minWidth: 0, gap: 2 },
  fieldLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  fieldValue: { fontSize: 13, color: '#374151' },
  fieldValueAccent: { fontSize: 14, fontWeight: '600', color: '#111827' },
  footer: {
    flexDirection: 'row',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
  },
  finCol: { flex: 1, gap: 2 },
  finValue: { fontSize: 16, fontWeight: '800', color: '#111827' },
  profitValue: { color: '#059669' },
});
