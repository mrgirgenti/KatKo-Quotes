import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import { DS } from '@/constants/designSystem';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useRouter } from 'expo-router';
import {
  Search,
  X,
  SlidersHorizontal,
  Trash2,
  FileText,
  RotateCcw,
  ArrowUpDown,
  ChevronDown,
  Edit3,
  Download,
  Printer,
  Sheet,
  Check,
  Minus,
  Lock,
  Unlock,
  Plus,
} from 'lucide-react-native';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import Colors from '@/constants/colors';
import { TABLE_COL, TABLE_CELL } from '@/constants/tableLayout';
import { metricValueStyle, metricLabelStyle } from '@/components/Metric';
import { useQuotes } from '@/contexts/QuotesContext';
import { useUser } from '@/contexts/UserContext';
import { Quote, QuoteStatus, getEffectiveStatus, STATUS_CONFIG } from '@/types/quote';
import { formatCurrency } from '@/utils/quoteCalculations';
import { formatDate } from '@/utils/textFormatting';
import { generateAndSharePDF, printQuote } from '@/utils/pdfGenerator';
import { exportSingleSaleToSheets } from '@/utils/googleSheetsExport';

type SortField = 'date' | 'client' | 'revenue' | 'status' | 'inHands' | 'project' | 'invoice' | 'services' | 'pcs' | 'profit' | 'applicator' | 'perPcs';
type SortDir = 'asc' | 'desc';

const STATUS_PILLS: { key: 'all' | QuoteStatus; label: string }[] = [
  { key: 'all',                label: 'All'             },
  { key: 'needs_review',       label: 'Needs Review'    },
  { key: 'quoting',            label: 'Quoting'         },
  { key: 'quoted',             label: 'Quoted'          },
  { key: 'invoice_sent',       label: 'Invoice Sent'    },
  { key: 'paid',               label: 'Paid'            },
  { key: 'active',             label: 'In Production'   },
  { key: 'production_started', label: 'In Production'   },
  { key: 'completed',          label: 'Completed'       },
  { key: 'expired',            label: 'Expired'         },
];

function getSalesRevenue(sale: Quote): number {
  return sale.salesData?.amountCollected || sale.calculations.total;
}

function getSalesProfit(sale: Quote): number {
  if (!sale.salesData) return sale.calculations.markupAmount;
  const serviceFeesCost = sale.salesData.actualServiceFeesCost ?? 0;
  const serviceFeesProfit = sale.salesData.actualServiceFeesProfit ?? 0;
  const onlineFee = sale.salesData.actualOnlineFee ?? 0;
  const salesTax = sale.salesData.actualSalesTax ?? 0;
  const cardFee = sale.salesData.actualCardFee ?? 0;

  const actualCOG = sale.salesData.actualProductCost + sale.salesData.actualServiceCost +
                    serviceFeesCost + sale.salesData.actualOtherCosts;
  const actualTotalWithFees = actualCOG + onlineFee + salesTax + cardFee;

  const quotedFees = sale.calculations.serviceFeeTotal;
  const feesDifference = quotedFees - serviceFeesCost;

  return sale.salesData.amountCollected - actualTotalWithFees + serviceFeesProfit + feesDifference;
}

function getPcs(quote: Quote): number {
  return quote.lineItems.reduce((s: number, li: any) =>
    s + Object.values(li.sizes || {}).reduce((ps: number, v: any) => ps + (Number(v) || 0), 0), 0);
}

function StatusBadge({ status }: { status: QuoteStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg, borderColor: cfg.borderColor }]}>
      <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

function Checkbox({ checked, indeterminate, onToggle }: { checked: boolean; indeterminate?: boolean; onToggle: () => void }) {
  const filled = checked || indeterminate;
  return (
    <TouchableOpacity onPress={onToggle} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <View style={[styles.checkbox, filled && styles.checkboxChecked]}>
        {checked && !indeterminate && <Check size={11} color="#fff" strokeWidth={3} />}
        {indeterminate && <Minus size={11} color="#fff" strokeWidth={3} />}
      </View>
    </TouchableOpacity>
  );
}

function parseDate(str: string): Date | null {
  if (!str) return null;
  const d = new Date(str.replace(/-/g, '/'));
  return isNaN(d.getTime()) ? null : d;
}

interface SaleRowProps {
  quote: Quote;
  effectiveStatus: QuoteStatus;
  onPress: () => void;
  onDelete: () => void;
  onRevert: () => void;
  onEdit: () => void;
  onLock: () => void;
  onUnlock: () => void;
  onExportPDF: () => void;
  onExportSheets: () => void;
  onPrint: () => void;
  isSelected: boolean;
  onToggleSelect: () => void;
  selectionMode: boolean;
}

function SaleRow({ quote, effectiveStatus, onPress, onDelete, onRevert, onEdit, onLock, onUnlock, onExportPDF, onExportSheets, onPrint, isSelected, onToggleSelect, selectionMode }: SaleRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const menuBtnRef = useRef<View>(null);
  const lineItemServices = quote.lineItems.map(i => i.serviceStyle);
  const lineItemPcs = quote.lineItems.map(i =>
    Object.values(i.sizes || {}).reduce((s: number, v: any) => s + (Number(v) || 0), 0)
  );
  const revenue = getSalesRevenue(quote);
  const totalPcs = lineItemPcs.reduce((s: number, n: number) => s + n, 0);
  const perPcs = totalPcs > 0 ? revenue / totalPcs : null;
  const profit = getSalesProfit(quote);
  const profitPositive = profit >= 0;
  const isLocked = quote.isLocked === true;

  const openMenu = () => {
    menuBtnRef.current?.measure((_fx, _fy, width, height, px, py) => {
      const winW = typeof window !== 'undefined' ? window.innerWidth : 400;
      const winH = typeof window !== 'undefined' ? window.innerHeight : 800;
      const estH = isLocked ? 210 : 320;
      const below = py + height + 4;
      const flipUp = below + estH > winH - 8;
      setMenuPos({
        top: flipUp ? Math.max(8, py - estH - 4) : below,
        right: Math.max(8, winW - px - width),
      });
      setMenuOpen(true);
    });
  };

  const menuModal = (
    <Modal
      visible={menuOpen}
      transparent
      animationType="none"
      onRequestClose={() => setMenuOpen(false)}
    >
      <TouchableOpacity
        style={styles.modalBackdrop}
        activeOpacity={1}
        onPress={() => setMenuOpen(false)}
      >
        <View style={[styles.dropdownMenu, { position: 'absolute', top: menuPos.top, right: menuPos.right }]}>
          {isLocked ? (
            <TouchableOpacity style={styles.dropdownItem} onPress={() => { setMenuOpen(false); onUnlock(); }}>
              <Unlock size={14} color={Colors.light.success} />
              <Text style={[styles.dropdownItemText, { color: Colors.light.success, fontWeight: '700' }]}>Unlock Sale</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity style={styles.dropdownItem} onPress={() => { setMenuOpen(false); onEdit(); }}>
                <Edit3 size={14} color={Colors.light.text} />
                <Text style={styles.dropdownItemText}>Edit Quote</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dropdownItem} onPress={() => { setMenuOpen(false); onLock(); }}>
                <Lock size={14} color={Colors.light.tint} />
                <Text style={[styles.dropdownItemText, { color: Colors.light.tint }]}>Save & Lock</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dropdownItem} onPress={() => { setMenuOpen(false); onRevert(); }}>
                <RotateCcw size={14} color={Colors.light.textSecondary} />
                <Text style={styles.dropdownItemText}>Revert Back</Text>
              </TouchableOpacity>
            </>
          )}
          <View style={styles.dropdownSeparator} />
          <TouchableOpacity style={styles.dropdownItem} onPress={() => { setMenuOpen(false); onExportSheets(); }}>
            <Sheet size={14} color={Colors.light.success} />
            <Text style={[styles.dropdownItemText, { color: Colors.light.success }]}>Export to Sheets</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dropdownItem} onPress={() => { setMenuOpen(false); onExportPDF(); }}>
            <Download size={14} color={Colors.light.text} />
            <Text style={styles.dropdownItemText}>Export to PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dropdownItem} onPress={() => { setMenuOpen(false); onPrint(); }}>
            <Printer size={14} color={Colors.light.text} />
            <Text style={styles.dropdownItemText}>Print</Text>
          </TouchableOpacity>
          {!isLocked && (
            <>
              <View style={styles.dropdownSeparator} />
              <TouchableOpacity style={[styles.dropdownItem, styles.dropdownItemLast]} onPress={() => { setMenuOpen(false); onDelete(); }}>
                <Trash2 size={14} color="#EF4444" />
                <Text style={[styles.dropdownItemText, { color: '#EF4444' }]}>Delete</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );

  return (
    <TouchableOpacity
      style={[styles.tableRow, isSelected && styles.tableRowSelected, isLocked && styles.tableRowLocked]}
      onPress={selectionMode ? onToggleSelect : onPress}
      activeOpacity={0.7}
    >
      <View style={styles.colCheckbox}>
        <Checkbox checked={isSelected} onToggle={onToggleSelect} />
      </View>
      <View style={styles.colStatus}>
        <StatusBadge status={effectiveStatus} />
        <View style={styles.statusIcons}>
          {isLocked && <Lock size={11} color={Colors.light.textSecondary} />}
          {quote.exportedToSheets && <Sheet size={11} color={Colors.light.success} />}
        </View>
      </View>
      <View style={styles.colOrderDate}>
        <Text style={styles.tableDate}>{formatDate(quote.orderDate)}</Text>
      </View>
      <View style={styles.colDueDate}>
        <Text style={styles.tableDate}>{quote.inHandsDate ? formatDate(quote.inHandsDate) : '—'}</Text>
      </View>
      <View style={styles.colClient}>
        <Text style={styles.tableClient} numberOfLines={1}>{quote.personOrganization}</Text>
      </View>
      <View style={styles.colProject}>
        <Text style={styles.tableProject} numberOfLines={1}>{quote.projectName}</Text>
      </View>
      <View style={styles.colQuote}>
        <Text style={styles.tableInvoice} numberOfLines={1}>{quote.invoiceNumber || quote.projectNumber || '—'}</Text>
      </View>
      <View style={styles.colServices}>
        <Text style={styles.tableServices}>
          {lineItemServices.length > 0 ? lineItemServices.join('\n') : '—'}
        </Text>
      </View>
      <View style={styles.colApplicator}>
        <Text style={styles.tableServices} numberOfLines={3}>
          {(() => {
            const apps = [...new Set(quote.lineItems.map((i: any) => i.applicator).filter(Boolean))];
            return apps.length > 0 ? apps.join('\n') : '—';
          })()}
        </Text>
      </View>
      <View style={styles.colPcs}>
        <Text style={styles.tablePcs}>
          {lineItemPcs.map(n => n > 0 ? `${n} pcs` : '—').join('\n')}
        </Text>
      </View>
      <View style={styles.colRevenue}>
        <Text style={styles.tableTotal}>{formatCurrency(revenue)}</Text>
      </View>
      <View style={styles.colPerPcs}>
        <Text style={styles.tablePerPcs}>{perPcs != null ? formatCurrency(perPcs) : '—'}</Text>
      </View>
      <View style={styles.colProfit}>
        <Text style={[styles.tableProfit, !profitPositive && styles.tableProfitNeg]}>{formatCurrency(profit)}</Text>
      </View>
      <View style={styles.colActions}>
        <TouchableOpacity style={styles.viewBtn} onPress={onPress}>
          <Text style={styles.viewBtnText}>View</Text>
        </TouchableOpacity>
        <View ref={menuBtnRef} collapsable={false}>
          <TouchableOpacity style={styles.menuBtn} onPress={openMenu}>
            <ChevronDown size={14} color={Colors.light.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {menuModal}
    </TouchableOpacity>
  );
}

function BulkActionBar({
  count,
  onClear,
  onExportPDF,
  onExportSheets,
  onPrint,
  onDelete,
}: {
  count: number;
  onClear: () => void;
  onExportPDF: () => void;
  onExportSheets: () => void;
  onPrint: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={styles.bulkBar}>
      <View style={styles.bulkBarLeft}>
        <Text style={styles.bulkCount}>{count} selected</Text>
        <TouchableOpacity onPress={onClear} style={styles.bulkClearBtn} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <X size={13} color={Colors.light.textSecondary} />
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bulkActionsRow}>
        <TouchableOpacity style={styles.bulkAction} onPress={onExportSheets}>
          <Sheet size={14} color={Colors.light.success} />
          <Text style={[styles.bulkActionText, { color: Colors.light.success }]}>Export Sheets</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bulkAction} onPress={onExportPDF}>
          <Download size={14} color={Colors.light.text} />
          <Text style={styles.bulkActionText}>Export PDF</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bulkAction} onPress={onPrint}>
          <Printer size={14} color={Colors.light.text} />
          <Text style={styles.bulkActionText}>Print</Text>
        </TouchableOpacity>
        <View style={styles.bulkDivider} />
        <TouchableOpacity style={[styles.bulkAction, styles.bulkActionDanger]} onPress={onDelete}>
          <Trash2 size={14} color="#EF4444" />
          <Text style={[styles.bulkActionText, { color: '#EF4444' }]}>Delete</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

export default function SalesScreen() {
  const router = useRouter();
  const { isDesktop } = useBreakpoint();
  const { sales, deleteQuote, convertToQuote, unlockSale, lockSale, markExportedToSheets, isLoading } = useQuotes();
  const { currentUser, orgAdmin } = useUser();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | QuoteStatus>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [minTotal, setMinTotal] = useState('');
  const [maxTotal, setMaxTotal] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Quote | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteVisible, setBulkDeleteVisible] = useState(false);
  const [unlockTarget, setUnlockTarget] = useState<Quote | null>(null);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [pendingConfirm, setPendingConfirm] = useState<{
    title: string;
    message: string;
    confirmText: string;
    destructive?: boolean;
    onConfirm: () => void;
  } | null>(null);

  const selectionMode = selectedIds.size > 0;

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const resolvedSales = useMemo(() =>
    sales.map(q => ({ quote: q, effectiveStatus: getEffectiveStatus(q) })),
    [sales]
  );

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: resolvedSales.length };
    resolvedSales.forEach(({ effectiveStatus }) => {
      counts[effectiveStatus] = (counts[effectiveStatus] || 0) + 1;
    });
    return counts;
  }, [resolvedSales]);

  const filtered = useMemo(() => {
    let list = resolvedSales;

    if (statusFilter !== 'all') {
      list = list.filter(({ effectiveStatus }) => effectiveStatus === statusFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(({ quote }) =>
        quote.personOrganization.toLowerCase().includes(q) ||
        quote.projectName.toLowerCase().includes(q) ||
        (quote.invoiceNumber || '').toLowerCase().includes(q) ||
        (quote.projectNumber || '').toLowerCase().includes(q) ||
        quote.lineItems.some((li: any) => (li.serviceStyle || '').toLowerCase().includes(q))
      );
    }

    if (minTotal) {
      const min = parseFloat(minTotal);
      if (!isNaN(min)) list = list.filter(({ quote }) => getSalesRevenue(quote) >= min);
    }
    if (maxTotal) {
      const max = parseFloat(maxTotal);
      if (!isNaN(max)) list = list.filter(({ quote }) => getSalesRevenue(quote) <= max);
    }

    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'date') {
        cmp = (parseDate(a.quote.orderDate)?.getTime() ?? 0) - (parseDate(b.quote.orderDate)?.getTime() ?? 0);
      } else if (sortField === 'inHands') {
        cmp = (parseDate(a.quote.inHandsDate)?.getTime() ?? 0) - (parseDate(b.quote.inHandsDate)?.getTime() ?? 0);
      } else if (sortField === 'client') {
        cmp = a.quote.personOrganization.localeCompare(b.quote.personOrganization);
      } else if (sortField === 'revenue') {
        cmp = getSalesRevenue(a.quote) - getSalesRevenue(b.quote);
      } else if (sortField === 'profit') {
        cmp = getSalesProfit(a.quote) - getSalesProfit(b.quote);
      } else if (sortField === 'status') {
        cmp = a.effectiveStatus.localeCompare(b.effectiveStatus);
      } else if (sortField === 'project') {
        cmp = (a.quote.projectName || '').localeCompare(b.quote.projectName || '');
      } else if (sortField === 'invoice') {
        cmp = (a.quote.invoiceNumber || '').localeCompare(b.quote.invoiceNumber || '');
      } else if (sortField === 'services') {
        const sa = [...new Set(a.quote.lineItems.map((i: any) => i.serviceStyle))].join(' ');
        const sb = [...new Set(b.quote.lineItems.map((i: any) => i.serviceStyle))].join(' ');
        cmp = sa.localeCompare(sb);
      } else if (sortField === 'pcs') {
        cmp = getPcs(a.quote) - getPcs(b.quote);
      } else if (sortField === 'applicator') {
        const aa = a.quote.lineItems.map((i: any) => i.applicator).filter(Boolean).sort()[0] || '';
        const ab = b.quote.lineItems.map((i: any) => i.applicator).filter(Boolean).sort()[0] || '';
        cmp = aa.localeCompare(ab);
      } else if (sortField === 'perPcs') {
        const pcsA = getPcs(a.quote); const revA = getSalesRevenue(a.quote);
        const pcsB = getPcs(b.quote); const revB = getSalesRevenue(b.quote);
        cmp = (pcsA > 0 ? revA / pcsA : 0) - (pcsB > 0 ? revB / pcsB : 0);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [resolvedSales, statusFilter, search, minTotal, maxTotal, sortField, sortDir]);

  const toggleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  }, [sortField]);

  const selectedSales = useMemo(() =>
    sales.filter(q => selectedIds.has(q.id)),
    [sales, selectedIds]
  );

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === filtered.length && filtered.length > 0) {
      clearSelection();
    } else {
      setSelectedIds(new Set(filtered.map(f => f.quote.id)));
    }
  }, [filtered, selectedIds, clearSelection]);

  // ── Row actions ──
  const handleView = useCallback((quote: Quote) => {
    router.push(`/quote/${quote.id}`);
  }, [router]);

  const handleEdit = useCallback((quote: Quote) => {
    if (quote.isLocked) {
      Alert.alert('Sale Locked', 'This sale is locked. Unlock it first to edit.');
      return;
    }
    router.push({ pathname: '/quote/edit', params: { id: quote.id } });
  }, [router]);

  const handleLock = useCallback((quote: Quote) => {
    setPendingConfirm({
      title: 'Save & Lock',
      message: `Lock "${quote.projectName}"? You will need an admin password to unlock it later.`,
      confirmText: 'Lock',
      onConfirm: () => lockSale(quote.id),
    });
  }, [lockSale]);

  const handleRevert = useCallback((quote: Quote) => {
    if (quote.isLocked) {
      Alert.alert('Sale Locked', 'This sale is locked. Unlock it first to revert.');
      return;
    }
    setPendingConfirm({
      title: 'Revert Back',
      message: `Revert "${quote.projectName}" back to a pending quote?`,
      confirmText: 'Revert',
      destructive: true,
      onConfirm: () => convertToQuote(quote.id),
    });
  }, [convertToQuote]);

  const handleUnlock = useCallback((quote: Quote) => {
    setUnlockTarget(quote);
    setUnlockPassword('');
  }, []);

  const confirmUnlock = useCallback(() => {
    if (!unlockTarget) return;
    if (!orgAdmin?.adminPassword) {
      Alert.alert('Error', 'No admin password has been set. The organization admin must set a password in their profile first.');
      return;
    }
    if (unlockPassword === orgAdmin.adminPassword) {
      unlockSale(unlockTarget.id);
      setUnlockTarget(null);
      setUnlockPassword('');
    } else {
      Alert.alert('Error', 'Invalid admin password');
    }
  }, [unlockTarget, unlockPassword, orgAdmin, unlockSale]);

  const handleExportSheets = useCallback(async (quote: Quote) => {
    if (!currentUser?.googleSheetsUrl) {
      Alert.alert('Setup Required', 'Please set up your Google Sheets Web App URL in Profile settings first.');
      return;
    }
    try {
      const result = await exportSingleSaleToSheets(currentUser.googleSheetsUrl, quote);
      if (result.success) {
        markExportedToSheets(quote.id);
        Alert.alert('Success', result.message);
      } else {
        Alert.alert('Export Failed', result.message);
      }
    } catch (error) {
      console.log('Error exporting to sheets:', error);
      Alert.alert('Error', 'Failed to export to Google Sheets. Please try again.');
    }
  }, [currentUser?.googleSheetsUrl, markExportedToSheets]);

  const handleExportPDF = useCallback(async (quote: Quote) => {
    try {
      await generateAndSharePDF(quote, currentUser);
    } catch (e) {
      Alert.alert('Error', 'Could not export PDF.');
    }
  }, [currentUser]);

  const handlePrint = useCallback(async (quote: Quote) => {
    try {
      await printQuote(quote, currentUser);
    } catch (e) {
      Alert.alert('Error', 'Could not print.');
    }
  }, [currentUser]);

  const handleDelete = useCallback((quote: Quote) => {
    setDeleteTarget(quote);
  }, []);

  // ── Bulk actions ──
  const handleBulkExportSheets = useCallback(async () => {
    if (!currentUser?.googleSheetsUrl) {
      Alert.alert('Setup Required', 'Please set up your Google Sheets Web App URL in Profile settings first.');
      return;
    }
    let ok = 0, fail = 0;
    for (const sale of selectedSales) {
      try {
        const result = await exportSingleSaleToSheets(currentUser.googleSheetsUrl, sale);
        if (result.success) { markExportedToSheets(sale.id); ok++; } else { fail++; }
      } catch { fail++; }
    }
    clearSelection();
    Alert.alert(fail === 0 ? 'Success' : 'Partial Success', `Exported ${ok} sale${ok !== 1 ? 's' : ''}${fail ? `, ${fail} failed` : ''}.`);
  }, [selectedSales, currentUser?.googleSheetsUrl, markExportedToSheets, clearSelection]);

  const handleBulkExportPDF = useCallback(async () => {
    try {
      for (const q of selectedSales) await generateAndSharePDF(q, currentUser);
    } catch {
      Alert.alert('Error', 'Could not export one or more PDFs.');
    }
  }, [selectedSales, currentUser]);

  const handleBulkPrint = useCallback(async () => {
    if (selectedSales.length > 1) {
      Alert.alert('Print', `Print ${selectedSales.length} sales one at a time?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Print All', onPress: async () => { for (const q of selectedSales) await printQuote(q, currentUser); } },
      ]);
    } else if (selectedSales.length === 1) {
      await printQuote(selectedSales[0], currentUser);
    }
  }, [selectedSales, currentUser]);

  const handleBulkDelete = useCallback(() => setBulkDeleteVisible(true), []);

  const confirmBulkDelete = useCallback(() => {
    const deletable = selectedSales.filter(q => !q.isLocked);
    const lockedCount = selectedSales.length - deletable.length;
    deletable.forEach(q => deleteQuote(q.id));
    clearSelection();
    setBulkDeleteVisible(false);
    if (lockedCount > 0) {
      Alert.alert('Some Sales Skipped', `${lockedCount} locked sale${lockedCount !== 1 ? 's were' : ' was'} not deleted. Unlock them first.`);
    }
  }, [selectedSales, deleteQuote, clearSelection]);

  const selectedLockedCount = useMemo(() => selectedSales.filter(q => q.isLocked).length, [selectedSales]);

  const activeFilterCount = [minTotal, maxTotal].filter(Boolean).length;

  const SortBtn = ({ field, label }: { field: SortField; label: string }) => (
    <TouchableOpacity style={styles.sortBtn} onPress={() => toggleSort(field)}>
      <Text style={[styles.sortBtnText, sortField === field && styles.sortBtnTextActive]}>{label}</Text>
      <ArrowUpDown size={11} color={sortField === field ? Colors.light.tint : 'rgba(255,255,255,0.35)'} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>Quotes</Text>
          <TouchableOpacity style={styles.startProjectBtn} onPress={() => router.push('/')}>
            <Plus size={15} color="#fff" />
            <Text style={styles.startProjectBtnText}>New Quote</Text>
          </TouchableOpacity>
        </View>

        {/* Stats Bar */}
        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#DC2626' }]}>
              {statusCounts['needs_review'] ?? 0}
            </Text>
            <Text style={styles.statLabel}>{isDesktop ? 'Needs Review' : 'Review'}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#2563EB' }]}>
              {statusCounts['quoted'] ?? 0}
            </Text>
            <Text style={styles.statLabel}>Quoted</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#6D28D9' }]}>
              {statusCounts['invoice_sent'] ?? 0}
            </Text>
            <Text style={styles.statLabel}>{isDesktop ? 'Invoice Sent' : 'Invoices'}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#16A34A' }]}>
              {statusCounts['paid'] ?? 0}
            </Text>
            <Text style={styles.statLabel}>Paid</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#9CA3AF' }]}>
              {statusCounts['expired'] ?? 0}
            </Text>
            <Text style={styles.statLabel}>Expired</Text>
          </View>
        </View>

        {/* Status Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.pillsScroll}
          contentContainerStyle={styles.pillsRow}
        >
          {STATUS_PILLS.map(pill => {
            const count = statusCounts[pill.key] ?? 0;
            const active = statusFilter === pill.key;
            const cfg = pill.key !== 'all' ? STATUS_CONFIG[pill.key as QuoteStatus] : null;
            return (
              <TouchableOpacity
                key={pill.key}
                style={[
                  styles.pill,
                  active && styles.pillActive,
                  active && cfg ? { backgroundColor: cfg.bg, borderColor: cfg.borderColor } : null,
                ]}
                onPress={() => setStatusFilter(pill.key as any)}
              >
                <Text style={[
                  styles.pillText,
                  active && styles.pillTextActive,
                  active && cfg ? { color: cfg.color } : null,
                ]}>
                  {pill.label}
                </Text>
                <View style={[styles.pillCount, active && (cfg ? { backgroundColor: cfg.borderColor } : styles.pillCountActive)]}>
                  <Text style={[styles.pillCountText, active && (cfg ? { color: cfg.color } : styles.pillCountTextActive)]}>{count}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Search + Filter Row */}
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Search size={15} color={Colors.light.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search client, quote, project, service…"
              placeholderTextColor={Colors.light.textSecondary}
              value={search}
              onChangeText={setSearch}
              clearButtonMode="while-editing"
            />
            {search ? (
              <TouchableOpacity onPress={() => setSearch('')}>
                <X size={15} color={Colors.light.textSecondary} />
              </TouchableOpacity>
            ) : null}
          </View>
          <TouchableOpacity
            style={[styles.filterBtn, showFilters && styles.filterBtnActive]}
            onPress={() => setShowFilters(v => !v)}
          >
            <SlidersHorizontal size={16} color={showFilters ? Colors.light.tint : Colors.light.textSecondary} />
            {activeFilterCount > 0 ? (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>

        {/* Advanced Filters Panel */}
        {showFilters && (
          <View style={styles.filtersPanel}>
            <Text style={styles.filtersPanelTitle}>ADVANCED FILTERS</Text>
            <View style={styles.filtersRow}>
              <View style={styles.filterField}>
                <Text style={styles.filterLabel}>Min Revenue ($)</Text>
                <TextInput
                  style={styles.filterInput}
                  placeholder="0"
                  placeholderTextColor={Colors.light.textSecondary}
                  value={minTotal}
                  onChangeText={setMinTotal}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.filterField}>
                <Text style={styles.filterLabel}>Max Revenue ($)</Text>
                <TextInput
                  style={styles.filterInput}
                  placeholder="No limit"
                  placeholderTextColor={Colors.light.textSecondary}
                  value={maxTotal}
                  onChangeText={setMaxTotal}
                  keyboardType="numeric"
                />
              </View>
              <TouchableOpacity
                style={styles.clearFiltersBtn}
                onPress={() => { setMinTotal(''); setMaxTotal(''); }}
              >
                <Text style={styles.clearFiltersBtnText}>Clear</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

      </View>

      {/* Bulk action bar */}
      {selectionMode && (
        <BulkActionBar
          count={selectedIds.size}
          onClear={clearSelection}
          onExportPDF={handleBulkExportPDF}
          onExportSheets={handleBulkExportSheets}
          onPrint={handleBulkPrint}
          onDelete={handleBulkDelete}
        />
      )}

      {isLoading ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Loading sales…</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <FileText size={36} color={Colors.light.border} />
          <Text style={styles.emptyTitle}>No sales found</Text>
          <Text style={styles.emptyText}>
            {search || statusFilter !== 'all' || minTotal || maxTotal
              ? 'Try adjusting your filters.'
              : 'Convert a quote to a sale to see it here.'}
          </Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1, outlineStyle: 'none' } as any} showsVerticalScrollIndicator={false}>
          <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ flexGrow: 1 }} style={{ outlineStyle: 'none' } as any}>
            <View style={{ minWidth: 2090, flexGrow: 1 }}>
              <View style={styles.tableHeader}>
                <View style={styles.colCheckbox}>
                  <Checkbox
                    checked={selectedIds.size > 0 && selectedIds.size === filtered.length}
                    indeterminate={selectedIds.size > 0 && selectedIds.size < filtered.length}
                    onToggle={toggleSelectAll}
                  />
                </View>
                <View style={styles.colStatus}><SortBtn field="status" label="Status" /></View>
                <View style={styles.colOrderDate}><SortBtn field="date" label="Order Date" /></View>
                <View style={styles.colDueDate}><SortBtn field="inHands" label="Due Date" /></View>
                <View style={styles.colClient}><SortBtn field="client" label="Client" /></View>
                <View style={styles.colProject}><SortBtn field="project" label="Project" /></View>
                <View style={styles.colQuote}><SortBtn field="invoice" label="Invoice #" /></View>
                <View style={styles.colServices}><SortBtn field="services" label="Service(s)" /></View>
                <View style={styles.colApplicator}><SortBtn field="applicator" label="Applicator(s)" /></View>
                <View style={styles.colPcs}><SortBtn field="pcs" label="# PCS" /></View>
                <View style={styles.colRevenue}><SortBtn field="revenue" label="Total" /></View>
                <View style={styles.colPerPcs}><SortBtn field="perPcs" label="Per PCS" /></View>
                <View style={styles.colProfit}><SortBtn field="profit" label="Profit" /></View>
                <View style={styles.colActions}><Text style={styles.thText}>Actions</Text></View>
              </View>
              <View style={styles.tableBody}>
                {filtered.map(({ quote, effectiveStatus }, idx) => (
                  <React.Fragment key={quote.id}>
                    {idx > 0 && <View style={styles.tableDivider} />}
                    <SaleRow
                      quote={quote}
                      effectiveStatus={effectiveStatus}
                      onPress={() => handleView(quote)}
                      onDelete={() => handleDelete(quote)}
                      onRevert={() => handleRevert(quote)}
                      onEdit={() => handleEdit(quote)}
                      onLock={() => handleLock(quote)}
                      onUnlock={() => handleUnlock(quote)}
                      onExportPDF={() => handleExportPDF(quote)}
                      onExportSheets={() => handleExportSheets(quote)}
                      onPrint={() => handlePrint(quote)}
                      isSelected={selectedIds.has(quote.id)}
                      onToggleSelect={() => toggleSelect(quote.id)}
                      selectionMode={selectionMode}
                    />
                  </React.Fragment>
                ))}
              </View>
            </View>
          </ScrollView>
        </ScrollView>
      )}

      {/* Unlock password modal */}
      <Modal visible={!!unlockTarget} transparent animationType="fade" onRequestClose={() => setUnlockTarget(null)}>
        <View style={styles.unlockModalOverlay}>
          <View style={styles.unlockModalContent}>
            <View style={styles.unlockModalIcon}>
              <Lock size={28} color={Colors.light.tint} />
            </View>
            <Text style={styles.unlockModalTitle}>Unlock Sale</Text>
            <Text style={styles.unlockModalMessage}>Enter the admin password to unlock this sale for editing.</Text>
            <TextInput
              style={styles.unlockPasswordInput}
              placeholder="Admin password"
              placeholderTextColor={Colors.light.textSecondary}
              secureTextEntry
              value={unlockPassword}
              onChangeText={setUnlockPassword}
              autoFocus
            />
            <View style={styles.unlockModalButtons}>
              <TouchableOpacity style={styles.unlockCancelBtn} onPress={() => setUnlockTarget(null)}>
                <Text style={styles.unlockCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.unlockConfirmBtn} onPress={confirmUnlock}>
                <Unlock size={16} color="#fff" />
                <Text style={styles.unlockConfirmText}>Unlock</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ConfirmDialog
        visible={!!pendingConfirm}
        title={pendingConfirm?.title ?? ''}
        message={pendingConfirm?.message ?? ''}
        confirmText={pendingConfirm?.confirmText ?? 'Confirm'}
        cancelText="Cancel"
        confirmDestructive={pendingConfirm?.destructive}
        onConfirm={() => { pendingConfirm?.onConfirm(); setPendingConfirm(null); }}
        onCancel={() => setPendingConfirm(null)}
      />

      <ConfirmDialog
        visible={!!deleteTarget}
        title="Are you sure?"
        message={deleteTarget ? `Delete "${deleteTarget.projectName}"? This cannot be undone.` : ''}
        confirmText="Yes, Delete"
        cancelText="No"
        confirmDestructive
        onConfirm={() => {
          if (deleteTarget) deleteQuote(deleteTarget.id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        visible={bulkDeleteVisible}
        title="Delete Selected Sales?"
        message={`Permanently delete ${selectedIds.size - selectedLockedCount} sale${(selectedIds.size - selectedLockedCount) !== 1 ? 's' : ''}? This cannot be undone.${selectedLockedCount > 0 ? ` (${selectedLockedCount} locked sale${selectedLockedCount !== 1 ? 's' : ''} will be skipped.)` : ''}`}
        confirmText="Delete All"
        cancelText="Cancel"
        confirmDestructive
        onConfirm={confirmBulkDelete}
        onCancel={() => setBulkDeleteVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  header: { backgroundColor: Colors.light.surface, borderBottomWidth: 1, borderBottomColor: Colors.light.border, paddingTop: Platform.OS === 'web' ? 0 : 48 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: DS.spacing.xl, paddingTop: DS.spacing.xl, paddingBottom: DS.spacing.md },
  title: { fontSize: 24, fontWeight: '800', color: Colors.light.text },
  statsBar: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginHorizontal: DS.spacing.lg, marginBottom: DS.spacing.md, backgroundColor: '#EBEBEB', borderRadius: 12, padding: 16 },
  statItem: { flex: 1, minWidth: 100, borderRadius: 10, paddingVertical: 14, paddingHorizontal: 12, backgroundColor: Colors.light.surface, alignItems: 'center' },
  statValue: { ...metricValueStyle },
  statLabel: { ...metricLabelStyle, marginTop: 2 },
  statDivider: { display: 'none' as any },

  pillsScroll: { maxHeight: 44 },
  pillsRow: { flexDirection: 'row', gap: DS.spacing.sm, paddingHorizontal: DS.spacing.xl, paddingBottom: DS.spacing.md },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: Colors.light.border, backgroundColor: Colors.light.background },
  pillActive: { borderColor: Colors.light.tint, backgroundColor: '#FFF4EE' },
  pillText: { fontSize: 13, fontWeight: '600', color: Colors.light.textSecondary },
  pillTextActive: { color: Colors.light.tint },
  pillCount: { minWidth: 20, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999, backgroundColor: '#F1F1F1', alignItems: 'center' as const },
  pillCountActive: { backgroundColor: Colors.light.tint },
  pillCountText: { fontSize: 11, fontWeight: '700', color: Colors.light.textSecondary },
  pillCountTextActive: { color: '#fff' },

  searchRow: { flexDirection: 'row', gap: DS.spacing.sm, paddingHorizontal: DS.spacing.xl, paddingBottom: DS.spacing.md, alignItems: 'center' },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F5F5F5', borderRadius: DS.radius.md, borderWidth: 1, borderColor: Colors.light.border, paddingHorizontal: 12, height: 40 },
  searchInput: { flex: 1, fontSize: 14, color: Colors.light.text, outlineStyle: 'none' as any },
  startProjectBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.light.tint, paddingHorizontal: 16, borderRadius: DS.radius.md, height: 40 },
  startProjectBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  filterBtn: { width: 40, height: 40, borderRadius: DS.radius.md, borderWidth: 1, borderColor: Colors.light.border, backgroundColor: Colors.light.background, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  filterBtnActive: { borderColor: Colors.light.tint, backgroundColor: '#FFF4EE' },
  filterBadge: { position: 'absolute', top: -4, right: -4, width: 15, height: 15, borderRadius: 8, backgroundColor: Colors.light.tint, alignItems: 'center', justifyContent: 'center' },
  filterBadgeText: { fontSize: 9, color: '#fff', fontWeight: '700' },

  filtersPanel: { marginHorizontal: DS.spacing.xl, marginBottom: DS.spacing.md, padding: 14, backgroundColor: Colors.light.background, borderRadius: DS.radius.md, borderWidth: 1, borderColor: Colors.light.border, gap: 10 },
  filtersPanelTitle: { fontSize: 11, fontWeight: '700', color: Colors.light.textSecondary, letterSpacing: 0.6, textTransform: 'uppercase' },
  filtersRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' },
  filterField: { flex: 1, minWidth: 100, gap: 4 },
  filterLabel: { fontSize: 11, color: Colors.light.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  filterInput: { borderWidth: 1, borderColor: Colors.light.border, borderRadius: DS.radius.sm, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: Colors.light.text, backgroundColor: Colors.light.surface, outlineStyle: 'none' as any },
  clearFiltersBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: DS.radius.sm, borderWidth: 1, borderColor: Colors.light.border },
  clearFiltersBtnText: { fontSize: 13, color: Colors.light.textSecondary },

  tableHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: DS.spacing.xl, paddingVertical: 10, backgroundColor: '#000000' },
  thText: { fontSize: 11, fontWeight: '700', color: '#ffffff', textTransform: 'uppercase', letterSpacing: 0.5 },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sortBtnText: { fontSize: 11, fontWeight: '700', color: '#ffffff', textTransform: 'uppercase', letterSpacing: 0.5 },
  sortBtnTextActive: { color: Colors.light.tint },

  tableBody: { paddingBottom: 40 },
  tableDivider: { height: 1, backgroundColor: Colors.light.border, marginHorizontal: DS.spacing.xl, alignSelf: 'stretch' },

  tableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: DS.spacing.xl, paddingVertical: 12, backgroundColor: Colors.light.surface },
  tableRowSelected: { backgroundColor: '#FFF4EE' },
  tableRowLocked: { backgroundColor: '#FAFAFA' },
  colCheckbox: { width: 36, alignItems: 'center', justifyContent: 'center' },
  colStatus:    { ...TABLE_COL.status, ...TABLE_CELL.center, flexDirection: 'row', gap: 6 },
  statusIcons:  { flexDirection: 'row', alignItems: 'center', gap: 3 },
  colOrderDate: { ...TABLE_COL.date, ...TABLE_CELL.center },
  colDueDate:   { ...TABLE_COL.date, ...TABLE_CELL.center },
  colClient:    { ...TABLE_COL.text, ...TABLE_CELL.left },
  colProject:   { ...TABLE_COL.textPrimary, ...TABLE_CELL.left, flexBasis: 176, minWidth: 143, maxWidth: 231 },
  colQuote:     { ...TABLE_COL.numeric, ...TABLE_CELL.center },
  colServices:  { ...TABLE_COL.text, ...TABLE_CELL.left },
  colApplicator: { ...TABLE_COL.text, ...TABLE_CELL.left },
  colPcs:       { ...TABLE_COL.numeric, ...TABLE_CELL.center },
  colPerPcs:    { ...TABLE_COL.numericWide, ...TABLE_CELL.center },
  colRevenue:   { ...TABLE_COL.numericWide, ...TABLE_CELL.center },
  colProfit:    { ...TABLE_COL.numericWide, ...TABLE_CELL.center },
  colActions:   { ...TABLE_COL.action, ...TABLE_CELL.center, flexDirection: 'row', gap: 4 },

  tableDate:    { fontSize: 13, color: Colors.light.text },
  tableClient:  { fontSize: 13, color: Colors.light.text },
  tableProject: { fontSize: 13, fontWeight: '700', color: Colors.light.text },
  tableInvoice: { fontSize: 13, color: Colors.light.textSecondary },
  tableServices:{ fontSize: 12, color: Colors.light.text, lineHeight: 18 },
  tablePcs:     { fontSize: 12, color: Colors.light.text, lineHeight: 18 },
  tablePerPcs:  { fontSize: 13, fontWeight: '600', color: Colors.light.text },
  tableTotal:   { fontSize: 14, fontWeight: '700', color: Colors.light.text },
  tableProfit:  { fontSize: 13, fontWeight: '700', color: '#16A34A' },
  tableProfitNeg: { color: '#DC2626' },

  trackBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: DS.radius.sm, backgroundColor: '#1C1C1E', height: 30, justifyContent: 'center' },
  trackBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  viewBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: DS.radius.sm, backgroundColor: Colors.light.tint, height: 30, justifyContent: 'center', alignItems: 'center' },
  viewBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  menuBtn: { width: 30, height: 30, borderRadius: DS.radius.sm, borderWidth: 1, borderColor: Colors.light.border, backgroundColor: Colors.light.surface, alignItems: 'center', justifyContent: 'center' },
  modalBackdrop: { flex: 1 },
  dropdownMenu: { backgroundColor: Colors.light.surface, borderRadius: DS.radius.lg, borderWidth: 1, borderColor: Colors.light.border, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 12, minWidth: 190, overflow: 'hidden' },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: Colors.light.border },
  dropdownItemLast: { borderBottomWidth: 0 },
  dropdownSeparator: { height: 1, backgroundColor: Colors.light.border, marginVertical: 2 },
  dropdownItemText: { fontSize: 13, color: Colors.light.text, fontWeight: '500' },

  badge: { alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 3, borderRadius: DS.radius.pill, borderWidth: 1 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.light.text },
  emptyText: { fontSize: 14, color: Colors.light.textSecondary, textAlign: 'center' },

  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: Colors.light.border, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.light.surface },
  checkboxChecked: { backgroundColor: Colors.light.tint, borderColor: Colors.light.tint },

  bulkBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1C1C1E', paddingVertical: 8, paddingHorizontal: DS.spacing.lg, gap: 12, borderBottomWidth: 1, borderBottomColor: '#333' },
  bulkBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 100 },
  bulkCount: { fontSize: 13, fontWeight: '700', color: '#fff' },
  bulkClearBtn: { width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  bulkActionsRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bulkAction: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: DS.radius.sm, backgroundColor: 'rgba(255,255,255,0.1)' },
  bulkActionDanger: { backgroundColor: 'rgba(239,68,68,0.15)' },
  bulkActionText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.9)' },
  bulkDivider: { width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 4 },

  unlockModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  unlockModalContent: { backgroundColor: Colors.light.surface, borderRadius: 16, padding: 24, width: '100%', maxWidth: 340, alignItems: 'center' },
  unlockModalIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FFF4EE', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  unlockModalTitle: { fontSize: 18, fontWeight: '700', color: Colors.light.text, marginBottom: 8 },
  unlockModalMessage: { fontSize: 14, color: Colors.light.textSecondary, textAlign: 'center', marginBottom: 16 },
  unlockPasswordInput: { width: '100%', backgroundColor: Colors.light.background, borderRadius: 10, borderWidth: 1, borderColor: Colors.light.border, padding: 14, fontSize: 16, color: Colors.light.text, marginBottom: 16, outlineStyle: 'none' as any },
  unlockModalButtons: { flexDirection: 'row', gap: 12, width: '100%' },
  unlockCancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: Colors.light.border, alignItems: 'center' },
  unlockCancelText: { fontSize: 14, fontWeight: '600', color: Colors.light.textSecondary },
  unlockConfirmBtn: { flex: 1, flexDirection: 'row', paddingVertical: 12, borderRadius: 8, backgroundColor: Colors.light.tint, alignItems: 'center', justifyContent: 'center', gap: 6 },
  unlockConfirmText: { fontSize: 14, fontWeight: '600', color: '#fff' },
});
