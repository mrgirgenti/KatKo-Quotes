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
  Trophy,
  Play,
  Flame,
  FolderPlus,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { metricValueStyle, metricLabelStyle } from '@/components/Metric';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useQuotes } from '@/contexts/QuotesContext';
import { Quote, QuoteStatus, getEffectiveStatus, STATUS_CONFIG, OperationalProjectStatus, OPERATIONAL_STATUS_CONFIG, OPERATIONAL_STATUSES } from '@/types/quote';
import { formatCurrency } from '@/utils/quoteCalculations';
import { formatDate } from '@/utils/textFormatting';
import { generateAndSharePDF, printQuote } from '@/utils/pdfGenerator';

type SortField = 'date' | 'client' | 'total' | 'status' | 'inHands' | 'project' | 'invoice' | 'services' | 'pcs' | 'markup' | 'applicator' | 'perPcs';
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

function StatusBadge({ status }: { status: QuoteStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg, borderColor: cfg.borderColor }]}>
      <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

function OpBadge({ status }: { status: OperationalProjectStatus }) {
  const cfg = OPERATIONAL_STATUS_CONFIG[status];
  return (
    <View style={[styles.opBadge, { backgroundColor: cfg.bg, borderColor: cfg.borderColor }]}>
      <Text style={[styles.opBadgeText, { color: cfg.color }]} numberOfLines={1}>{cfg.label}</Text>
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

interface ProjectRowProps {
  quote: Quote;
  effectiveStatus: QuoteStatus;
  index: number;
  onPress: () => void;
  onDelete: () => void;
  onConvert: () => void;
  onRevert: () => void;
  onComplete: () => void;
  onEdit: () => void;
  onExportPDF: () => void;
  onExportSheets: () => void;
  onPrint: () => void;
  onAcceptIntake: () => void;
  isDesktop: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  selectionMode: boolean;
}

function ProjectRow({ quote, effectiveStatus, onPress, onDelete, onConvert, onRevert, onComplete, onEdit, onExportPDF, onExportSheets, onPrint, onAcceptIntake, isSelected, onToggleSelect, selectionMode }: ProjectRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const menuBtnRef = useRef<View>(null);
  const lineItemServices = quote.lineItems.map(i => i.serviceStyle);
  const lineItemPcs = quote.lineItems.map(i =>
    Object.values(i.sizes || {}).reduce((s: number, v: any) => s + (Number(v) || 0), 0)
  );
  const total = quote.calculations?.total ?? 0;
  const totalPcs = lineItemPcs.reduce((s: number, n: number) => s + n, 0);
  const perPcs = totalPcs > 0 ? total / totalPcs : null;
  const isActive = effectiveStatus === 'active' || effectiveStatus === 'production_started';
  const isCompleted = effectiveStatus === 'completed';

  const openMenu = () => {
    menuBtnRef.current?.measure((_fx, _fy, width, height, px, py) => {
      setMenuPos({ top: py + height + 4, right: Math.max(0, (typeof window !== 'undefined' ? window.innerWidth : 400) - px - width) });
      setMenuOpen(true);
    });
  };

  const applicators = [...new Set(quote.lineItems.map(i => i.applicator).filter(Boolean))];
  const markup = quote.calculations?.markupAmount ?? 0;
  const markupPct = quote.calculations?.markupPercentage ?? 0;

  return (
    <TouchableOpacity
      style={[styles.tableRow, isSelected && styles.tableRowSelected]}
      onPress={selectionMode ? onToggleSelect : onPress}
      activeOpacity={0.7}
    >
        <View style={styles.colCheckbox}>
          <Checkbox checked={isSelected} onToggle={onToggleSelect} />
        </View>
        <View style={styles.colStatus}>
          {quote.operationalStatus
            ? <OpBadge status={quote.operationalStatus as OperationalProjectStatus} />
            : <StatusBadge status={effectiveStatus} />}
        </View>
        <View style={styles.colOrderDate}>
          <Text style={styles.tableDate}>{formatDate(quote.orderDate)}</Text>
        </View>
        <View style={styles.colDueDate}>
          <Text style={styles.tableDate}>{quote.inHandsDate ? formatDate(quote.inHandsDate) : '—'}</Text>
        </View>
        <View style={styles.colClient}>
          <Text style={styles.tableClient}>{quote.personOrganization}</Text>
        </View>
        <View style={styles.colProject}>
          <Text style={styles.tableProject}>{quote.projectName}</Text>
        </View>
        <View style={styles.colInvoice}>
          <Text style={styles.tableInvoice}>{quote.projectNumber || quote.invoiceNumber || '—'}</Text>
        </View>
        <View style={styles.colServices}>
          <Text style={styles.tableServices}>
            {lineItemServices.length > 0 ? lineItemServices.join('\n') : '—'}
          </Text>
        </View>
        <View style={styles.colApplicator}>
          <Text style={styles.tableApplicator}>
            {applicators.length > 0 ? applicators.join('\n') : '—'}
          </Text>
        </View>
        <View style={styles.colPcs}>
          <Text style={styles.tablePcs}>
            {lineItemPcs.map(n => n > 0 ? `${n} pcs` : '—').join('\n')}
          </Text>
        </View>
        <View style={styles.colTotal}>
          <Text style={styles.tableTotal}>{formatCurrency(total)}</Text>
        </View>
        <View style={styles.colPerPcs}>
          <Text style={styles.tablePerPcs}>{perPcs != null ? formatCurrency(perPcs) : '—'}</Text>
        </View>
        <View style={styles.colMarkup}>
          <Text style={styles.tableMarkup}>{formatCurrency(markup)}</Text>
          <Text style={styles.tableMarkupPct}>{markupPct.toFixed(1)}%</Text>
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
              {effectiveStatus === 'needs_review' ? (
                <TouchableOpacity style={styles.dropdownItem} onPress={() => { setMenuOpen(false); onAcceptIntake(); }}>
                  <Play size={14} color={Colors.light.tint} />
                  <Text style={[styles.dropdownItemText, { color: Colors.light.tint, fontWeight: '700' }]}>Accept & Start Quote</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={styles.dropdownItem} onPress={() => { setMenuOpen(false); onEdit(); }}>
                <Edit3 size={14} color={Colors.light.text} />
                <Text style={styles.dropdownItemText}>{effectiveStatus === 'needs_review' ? 'Edit Request' : 'Edit Quote'}</Text>
              </TouchableOpacity>
              {(isActive || isCompleted) ? (
                <TouchableOpacity style={styles.dropdownItem} onPress={() => { setMenuOpen(false); onRevert(); }}>
                  <RotateCcw size={14} color={Colors.light.textSecondary} />
                  <Text style={styles.dropdownItemText}>Revert to Quoted</Text>
                </TouchableOpacity>
              ) : null}
              {effectiveStatus === 'paid' ? (
                <TouchableOpacity style={styles.dropdownItem} onPress={() => { setMenuOpen(false); onConvert(); }}>
                  <Flame size={14} color={Colors.light.tint} />
                  <Text style={[styles.dropdownItemText, { color: Colors.light.tint }]}>Start Production</Text>
                </TouchableOpacity>
              ) : null}
              {(isActive || isCompleted) && !isCompleted ? (
                <TouchableOpacity style={styles.dropdownItem} onPress={() => { setMenuOpen(false); onComplete(); }}>
                  <Trophy size={14} color={Colors.light.success} />
                  <Text style={[styles.dropdownItemText, { color: Colors.light.success }]}>Complete Project</Text>
                </TouchableOpacity>
              ) : null}
              {effectiveStatus !== 'needs_review' && effectiveStatus !== 'quoting' ? (
                <>
                  <View style={styles.dropdownSeparator} />
                  <TouchableOpacity style={styles.dropdownItem} onPress={() => { setMenuOpen(false); onExportPDF(); }}>
                    <Download size={14} color={Colors.light.text} />
                    <Text style={styles.dropdownItemText}>Export to PDF</Text>
                  </TouchableOpacity>
                  {(isActive || isCompleted) ? (
                    <TouchableOpacity style={styles.dropdownItem} onPress={() => { setMenuOpen(false); onExportSheets(); }}>
                      <Sheet size={14} color={Colors.light.success} />
                      <Text style={[styles.dropdownItemText, { color: Colors.light.success }]}>Export to Sheets</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity style={styles.dropdownItem} onPress={() => { setMenuOpen(false); onPrint(); }}>
                    <Printer size={14} color={Colors.light.text} />
                    <Text style={styles.dropdownItemText}>Print</Text>
                  </TouchableOpacity>
                </>
              ) : <View style={styles.dropdownSeparator} />}
              <TouchableOpacity style={[styles.dropdownItem, styles.dropdownItemLast]} onPress={() => { setMenuOpen(false); onDelete(); }}>
                <Trash2 size={14} color="#EF4444" />
                <Text style={[styles.dropdownItemText, { color: '#EF4444' }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
    </TouchableOpacity>
  );
}

function BulkActionBar({
  count,
  onClear,
  onConvertToActive,
  onComplete,
  onRevert,
  onExportPDF,
  onExportSheets,
  onPrint,
  onDelete,
}: {
  count: number;
  onClear: () => void;
  onConvertToActive: () => void;
  onComplete: () => void;
  onRevert: () => void;
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
        <TouchableOpacity style={styles.bulkAction} onPress={onConvertToActive}>
          <Play size={14} color={Colors.light.tint} />
          <Text style={[styles.bulkActionText, { color: Colors.light.tint }]}>Convert to Active</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bulkAction} onPress={onComplete}>
          <Trophy size={14} color={Colors.light.success} />
          <Text style={[styles.bulkActionText, { color: Colors.light.success }]}>Complete Project</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bulkAction} onPress={onRevert}>
          <RotateCcw size={14} color={Colors.light.textSecondary} />
          <Text style={styles.bulkActionText}>Revert to Quoted</Text>
        </TouchableOpacity>
        <View style={styles.bulkDivider} />
        <TouchableOpacity style={styles.bulkAction} onPress={onExportPDF}>
          <Download size={14} color={Colors.light.text} />
          <Text style={styles.bulkActionText}>Export PDF</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bulkAction} onPress={onExportSheets}>
          <Sheet size={14} color={Colors.light.success} />
          <Text style={[styles.bulkActionText, { color: Colors.light.success }]}>Sheets</Text>
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

export default function ProjectsScreen() {
  const router = useRouter();
  const { isDesktop } = useBreakpoint();
  const { projects, deleteQuote, convertToSale, convertToQuote, markProjectComplete, isLoading } = useQuotes();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | QuoteStatus>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [minTotal, setMinTotal] = useState('');
  const [maxTotal, setMinMax] = useState('');
  const [opFilter, setOpFilter] = useState<'all' | OperationalProjectStatus>('all');
  const [deleteTarget, setDeleteTarget] = useState<Quote | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteVisible, setBulkDeleteVisible] = useState(false);
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

  const resolvedProjects = useMemo(() =>
    projects.map(q => ({ quote: q, effectiveStatus: getEffectiveStatus(q) })),
    [projects]
  );

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: resolvedProjects.length };
    resolvedProjects.forEach(({ effectiveStatus }) => {
      counts[effectiveStatus] = (counts[effectiveStatus] || 0) + 1;
    });
    return counts;
  }, [resolvedProjects]);

  const filtered = useMemo(() => {
    let list = resolvedProjects;

    if (statusFilter !== 'all') {
      list = list.filter(({ effectiveStatus }) => effectiveStatus === statusFilter);
    }

    if (opFilter !== 'all') {
      list = list.filter(({ quote }) => quote.operationalStatus === opFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(({ quote }) =>
        quote.personOrganization.toLowerCase().includes(q) ||
        quote.projectName.toLowerCase().includes(q) ||
        (quote.invoiceNumber || '').toLowerCase().includes(q) ||
        (quote.projectNumber || '').toLowerCase().includes(q)
      );
    }

    if (minTotal) {
      const min = parseFloat(minTotal);
      if (!isNaN(min)) list = list.filter(({ quote }) => (quote.calculations?.total ?? 0) >= min);
    }
    if (maxTotal) {
      const max = parseFloat(maxTotal);
      if (!isNaN(max)) list = list.filter(({ quote }) => (quote.calculations?.total ?? 0) <= max);
    }

    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'date') {
        const da = parseDate(a.quote.orderDate)?.getTime() ?? 0;
        const db = parseDate(b.quote.orderDate)?.getTime() ?? 0;
        cmp = da - db;
      } else if (sortField === 'inHands') {
        const da = parseDate(a.quote.inHandsDate)?.getTime() ?? 0;
        const db = parseDate(b.quote.inHandsDate)?.getTime() ?? 0;
        cmp = da - db;
      } else if (sortField === 'client') {
        cmp = a.quote.personOrganization.localeCompare(b.quote.personOrganization);
      } else if (sortField === 'total') {
        cmp = (a.quote.calculations?.total ?? 0) - (b.quote.calculations?.total ?? 0);
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
        const pa = a.quote.lineItems.reduce((s: number, li: any) =>
          s + Object.values(li.sizes || {}).reduce((ps: number, v: any) => ps + (Number(v) || 0), 0), 0);
        const pb = b.quote.lineItems.reduce((s: number, li: any) =>
          s + Object.values(li.sizes || {}).reduce((ps: number, v: any) => ps + (Number(v) || 0), 0), 0);
        cmp = pa - pb;
      } else if (sortField === 'markup') {
        cmp = (a.quote.calculations?.markupAmount ?? 0) - (b.quote.calculations?.markupAmount ?? 0);
      } else if (sortField === 'applicator') {
        const aa = a.quote.lineItems.map((i: any) => i.applicator).filter(Boolean).sort()[0] || '';
        const ab = b.quote.lineItems.map((i: any) => i.applicator).filter(Boolean).sort()[0] || '';
        cmp = aa.localeCompare(ab);
      } else if (sortField === 'perPcs') {
        const totalA = a.quote.calculations?.total ?? 0;
        const pcsA = a.quote.lineItems.reduce((s: number, li: any) =>
          s + Object.values(li.sizes || {}).reduce((ps: number, v: any) => ps + (Number(v) || 0), 0), 0);
        const totalB = b.quote.calculations?.total ?? 0;
        const pcsB = b.quote.lineItems.reduce((s: number, li: any) =>
          s + Object.values(li.sizes || {}).reduce((ps: number, v: any) => ps + (Number(v) || 0), 0), 0);
        cmp = (pcsA > 0 ? totalA / pcsA : 0) - (pcsB > 0 ? totalB / pcsB : 0);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [resolvedProjects, statusFilter, opFilter, search, minTotal, maxTotal, sortField, sortDir]);

  const toggleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  }, [sortField]);

  const selectedQuotes = useMemo(() =>
    filtered.filter(({ quote }) => selectedIds.has(quote.id)).map(f => f.quote),
    [filtered, selectedIds]
  );

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === filtered.length && filtered.length > 0) {
      clearSelection();
    } else {
      setSelectedIds(new Set(filtered.map(f => f.quote.id)));
    }
  }, [filtered, selectedIds, clearSelection]);

  const handleBulkConvertToActive = useCallback(() => {
    const n = selectedQuotes.length;
    setPendingConfirm({
      title: 'Convert to Active',
      message: `Convert ${n} project${n !== 1 ? 's' : ''} to Active status?`,
      confirmText: 'Convert',
      onConfirm: () => { selectedQuotes.forEach(q => convertToSale(q.id)); clearSelection(); },
    });
  }, [selectedQuotes, convertToSale, clearSelection]);

  const handleBulkComplete = useCallback(() => {
    const n = selectedQuotes.length;
    setPendingConfirm({
      title: 'Complete Projects',
      message: `Mark ${n} project${n !== 1 ? 's' : ''} as Completed? All line items will be auto-completed.`,
      confirmText: 'Complete Project',
      onConfirm: () => { selectedQuotes.forEach(q => markProjectComplete(q.id)); clearSelection(); },
    });
  }, [selectedQuotes, markProjectComplete, clearSelection]);

  const handleBulkRevert = useCallback(() => {
    const n = selectedQuotes.length;
    setPendingConfirm({
      title: 'Revert to Quoted',
      message: `Revert ${n} project${n !== 1 ? 's' : ''} back to Quoted status? This will clear any sales data and production progress.`,
      confirmText: 'Revert',
      destructive: true,
      onConfirm: () => { selectedQuotes.forEach(q => convertToQuote(q.id)); clearSelection(); },
    });
  }, [selectedQuotes, convertToQuote, clearSelection]);

  const handleBulkExportPDF = useCallback(async () => {
    try {
      for (const q of selectedQuotes) {
        await generateAndSharePDF(q, null);
      }
    } catch (e) {
      Alert.alert('Error', 'Could not export one or more PDFs.');
    }
  }, [selectedQuotes]);

  const handleBulkPrint = useCallback(async () => {
    if (selectedQuotes.length > 1) {
      Alert.alert('Print', `Print ${selectedQuotes.length} projects one at a time?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Print All', onPress: async () => { for (const q of selectedQuotes) { await printQuote(q, null); } } },
      ]);
    } else if (selectedQuotes.length === 1) {
      await printQuote(selectedQuotes[0], null);
    }
  }, [selectedQuotes]);

  const handleBulkExportSheets = useCallback(() => {
    if (selectedQuotes.length === 1) {
      router.push(`/quote/${selectedQuotes[0].id}`);
    } else {
      Alert.alert('Export to Sheets', 'Select one project at a time to export to Google Sheets.');
    }
  }, [selectedQuotes, router]);

  const handleBulkDelete = useCallback(() => {
    setBulkDeleteVisible(true);
  }, []);

  const confirmBulkDelete = useCallback(() => {
    selectedQuotes.forEach(q => deleteQuote(q.id));
    clearSelection();
    setBulkDeleteVisible(false);
  }, [selectedQuotes, deleteQuote, clearSelection]);

  const handleView = useCallback((quote: Quote) => {
    router.push(`/quote/${quote.id}`);
  }, [router]);

  const handleDelete = useCallback((quote: Quote) => {
    setDeleteTarget(quote);
  }, []);

  const handleAcceptIntake = useCallback((quote: Quote) => {
    setPendingConfirm({
      title: 'Accept Client Intake',
      message: `Accept "${quote.projectName}" and start building the quote?`,
      confirmText: 'Accept & Start Quote',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/projects/${quote.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...quote, status: 'quoting' }),
          });
          if (!res.ok) {
            console.warn('[handleAcceptIntake] Status update failed, proceeding to quote editor anyway');
          }
        } catch (err) {
          console.warn('[handleAcceptIntake] Status update error:', err);
        }
        router.push(`/quote/${quote.id}`);
      },
    });
  }, [router]);

  const handleConvert = useCallback((quote: Quote) => {
    setPendingConfirm({
      title: 'Mark as Active',
      message: `Convert "${quote.projectName}" to Active status?`,
      confirmText: 'Convert',
      onConfirm: () => convertToSale(quote.id),
    });
  }, [convertToSale]);

  const handleRevert = useCallback((quote: Quote) => {
    convertToQuote(quote.id);
  }, [convertToQuote]);

  const handleComplete = useCallback((quote: Quote) => {
    setPendingConfirm({
      title: 'Complete Project',
      message: `Mark "${quote.projectName}" as Completed? All line items will be auto-completed.`,
      confirmText: 'Complete Project',
      onConfirm: () => markProjectComplete(quote.id),
    });
  }, [markProjectComplete]);

  const handleEdit = useCallback((quote: Quote) => {
    router.push({ pathname: '/quote/edit', params: { id: quote.id } });
  }, [router]);

  const handleExportPDF = useCallback(async (quote: Quote) => {
    try {
      await generateAndSharePDF(quote, null);
    } catch (e) {
      Alert.alert('Error', 'Could not export PDF.');
    }
  }, []);

  const handlePrint = useCallback(async (quote: Quote) => {
    try {
      await printQuote(quote, null);
    } catch (e) {
      Alert.alert('Error', 'Could not print.');
    }
  }, []);

  const handleExportSheets = useCallback((quote: Quote) => {
    router.push(`/quote/${quote.id}`);
  }, [router]);

  const activeFilterCount = [
    minTotal,
    maxTotal,
    opFilter !== 'all' ? opFilter : '',
  ].filter(Boolean).length;

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
          <Text style={styles.title}>Projects</Text>
          <TouchableOpacity style={styles.startProjectBtn} onPress={() => router.push('/')}>
            <FolderPlus size={15} color="#fff" />
            <Text style={styles.startProjectBtnText}>Start Project</Text>
          </TouchableOpacity>
        </View>

        {/* Stats Bar */}
        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#16A34A' }]}>
              {statusCounts['completed'] ?? 0}
            </Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: Colors.light.tint }]}>
              {(statusCounts['active'] ?? 0) + (statusCounts['production_started'] ?? 0)}
            </Text>
            <Text style={styles.statLabel}>{isDesktop ? 'In Production' : 'Production'}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: Colors.light.text }]}>
              {resolvedProjects.length}
            </Text>
            <Text style={styles.statLabel}>{isDesktop ? 'Active Projects' : 'Active'}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#2563EB' }]}>
              {(statusCounts['quoting'] ?? 0) + (statusCounts['quoted'] ?? 0)}
            </Text>
            <Text style={styles.statLabel}>Quoted</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#DC2626' }]}>
              {statusCounts['needs_review'] ?? 0}
            </Text>
            <Text style={styles.statLabel}>{isDesktop ? 'Needs Review' : 'Review'}</Text>
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
              placeholder="Search client, project, invoice…"
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
                <Text style={styles.filterLabel}>Min Total ($)</Text>
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
                <Text style={styles.filterLabel}>Max Total ($)</Text>
                <TextInput
                  style={styles.filterInput}
                  placeholder="No limit"
                  placeholderTextColor={Colors.light.textSecondary}
                  value={maxTotal}
                  onChangeText={setMinMax}
                  keyboardType="numeric"
                />
              </View>
              <TouchableOpacity
                style={styles.clearFiltersBtn}
                onPress={() => { setMinTotal(''); setMinMax(''); setOpFilter('all'); }}
              >
                <Text style={styles.clearFiltersBtnText}>Clear</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.filterLabel, { marginTop: 6 }]}>Operational Status</Text>
            <View style={styles.opFilterRow}>
              <TouchableOpacity
                style={[styles.opFilterChip, opFilter === 'all' && styles.opFilterChipActive]}
                onPress={() => setOpFilter('all')}
              >
                <Text style={[styles.opFilterChipText, opFilter === 'all' && styles.opFilterChipTextActive]}>All</Text>
              </TouchableOpacity>
              {OPERATIONAL_STATUSES.map((s) => {
                const active = opFilter === s;
                return (
                  <TouchableOpacity
                    key={s}
                    style={[styles.opFilterChip, active && styles.opFilterChipActive]}
                    onPress={() => setOpFilter(s)}
                  >
                    <Text style={[styles.opFilterChipText, active && styles.opFilterChipTextActive]}>{s}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

      </View>

      {/* Bulk action bar */}
      {selectionMode && (
        <BulkActionBar
          count={selectedIds.size}
          onClear={clearSelection}
          onConvertToActive={handleBulkConvertToActive}
          onComplete={handleBulkComplete}
          onRevert={handleBulkRevert}
          onExportPDF={handleBulkExportPDF}
          onExportSheets={handleBulkExportSheets}
          onPrint={handleBulkPrint}
          onDelete={handleBulkDelete}
        />
      )}

      {isLoading ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Loading projects…</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <FileText size={36} color={Colors.light.border} />
          <Text style={styles.emptyTitle}>No projects found</Text>
          <Text style={styles.emptyText}>
            {search || statusFilter !== 'all' || minTotal || maxTotal
              ? 'Try adjusting your filters.'
              : 'Submit a quote to see it here.'}
          </Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1, outlineStyle: 'none' } as any} showsVerticalScrollIndicator={false}>
          <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ flexGrow: 1 }} style={{ outlineStyle: 'none' } as any}>
            <View style={{ minWidth: 1500, flexGrow: 1 }}>
              <View style={styles.tableHeader}>
                <View style={styles.colCheckbox}>
                  <Checkbox
                    checked={selectedIds.size > 0 && selectedIds.size === filtered.length}
                    indeterminate={selectedIds.size > 0 && selectedIds.size < filtered.length}
                    onToggle={toggleSelectAll}
                  />
                </View>
                <View style={styles.colStatus}>
                  <SortBtn field="status" label="Status" />
                </View>
                <View style={styles.colOrderDate}>
                  <SortBtn field="date" label="Order Date" />
                </View>
                <View style={styles.colDueDate}>
                  <SortBtn field="inHands" label="Due Date" />
                </View>
                <View style={styles.colClient}>
                  <SortBtn field="client" label="Client" />
                </View>
                <View style={styles.colProject}>
                  <SortBtn field="project" label="Project" />
                </View>
                <View style={styles.colInvoice}>
                  <SortBtn field="invoice" label="Invoice #" />
                </View>
                <View style={styles.colServices}>
                  <SortBtn field="services" label="Service(s)" />
                </View>
                <View style={styles.colApplicator}><SortBtn field="applicator" label="Applicator(s)" /></View>
                <View style={styles.colPcs}>
                  <SortBtn field="pcs" label="# PCS" />
                </View>
                <View style={styles.colTotal}>
                  <SortBtn field="total" label="Total" />
                </View>
                <View style={styles.colPerPcs}>
                  <SortBtn field="perPcs" label="Per PCS" />
                </View>
                <View style={styles.colMarkup}>
                  <SortBtn field="markup" label="Profit" />
                </View>
                <View style={styles.colActions}><Text style={styles.thText}>Actions</Text></View>
              </View>
              <View style={styles.tableBody}>
                {filtered.map(({ quote, effectiveStatus }, idx) => (
                  <React.Fragment key={quote.id}>
                    {idx > 0 && <View style={styles.tableDivider} />}
                    <ProjectRow
                      quote={quote}
                      effectiveStatus={effectiveStatus}
                      index={idx}
                      onPress={() => handleView(quote)}
                      onDelete={() => handleDelete(quote)}
                      onConvert={() => handleConvert(quote)}
                      onRevert={() => handleRevert(quote)}
                      onComplete={() => handleComplete(quote)}
                      onEdit={() => handleEdit(quote)}
                      onExportPDF={() => handleExportPDF(quote)}
                      onExportSheets={() => handleExportSheets(quote)}
                      onPrint={() => handlePrint(quote)}
                      onAcceptIntake={() => handleAcceptIntake(quote)}
                      isDesktop={true}
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
        title="Delete Selected Projects?"
        message={`Permanently delete ${selectedIds.size} project${selectedIds.size !== 1 ? 's' : ''}? This cannot be undone.`}
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
  statsBar: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 12, marginHorizontal: DS.spacing.lg, marginBottom: DS.spacing.md, backgroundColor: '#EBEBEB', borderRadius: 12, padding: 16 },
  statItem: { flex: 1, minWidth: 100, borderRadius: 10, paddingVertical: 14, paddingHorizontal: 12, backgroundColor: Colors.light.surface, alignItems: 'center' as const },
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
  startProjectBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, backgroundColor: Colors.light.tint, paddingHorizontal: 16, borderRadius: DS.radius.md, height: 40 },
  startProjectBtnText: { fontSize: 14, fontWeight: '700' as const, color: '#fff' },
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
  tableDivider: { height: 1, backgroundColor: Colors.light.border, marginHorizontal: DS.spacing.xl },

  tableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: DS.spacing.xl, paddingVertical: 12, backgroundColor: Colors.light.surface },
  colStatus:    { width: 100 },
  colOrderDate: { width: 125 },
  colDueDate:   { width: 110 },
  colClient:    { flex: 1.2, minWidth: 150 },
  colProject:   { flex: 1.2, minWidth: 160 },
  colInvoice:   { width: 90 },
  colApplicator:{ flex: 1.2, minWidth: 150 },
  colServices:  { flex: 1.0, minWidth: 140 },
  colPcs:       { width: 72 },
  colPerPcs:    { width: 85, alignItems: 'flex-end' },
  colTotal:     { width: 85, alignItems: 'flex-end' },
  colMarkup:    { width: 85, alignItems: 'flex-end' },
  colActions:   { width: 100, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 4 },

  tableDate:       { fontSize: 13, color: Colors.light.text },
  tableClient:     { fontSize: 13, fontWeight: '700', color: Colors.light.text },
  tableProject:    { fontSize: 13, color: Colors.light.text },
  tableInvoice:    { fontSize: 13, color: Colors.light.textSecondary },
  tableApplicator: { fontSize: 12, color: Colors.light.text, lineHeight: 18 },
  tableServices:   { fontSize: 12, color: Colors.light.text, lineHeight: 18 },
  tablePcs:        { fontSize: 12, color: Colors.light.text, lineHeight: 18 },
  tablePerPcs:     { fontSize: 13, fontWeight: '600', color: Colors.light.text },
  tableTotal:      { fontSize: 14, fontWeight: '700', color: Colors.light.text },
  tableMarkup:     { fontSize: 13, fontWeight: '700', color: '#16A34A' },
  tableMarkupPct:  { fontSize: 11, color: Colors.light.textSecondary, marginTop: 1 },

  viewBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: DS.radius.sm, backgroundColor: Colors.light.tint, height: 30, justifyContent: 'center', alignItems: 'center' },
  viewBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  menuBtn: { width: 30, height: 30, borderRadius: DS.radius.sm, borderWidth: 1, borderColor: Colors.light.border, backgroundColor: Colors.light.surface, alignItems: 'center', justifyContent: 'center' },
  modalBackdrop: { flex: 1 },
  dropdownMenu: { backgroundColor: Colors.light.surface, borderRadius: DS.radius.lg, borderWidth: 1, borderColor: Colors.light.border, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 12, minWidth: 180, overflow: 'hidden' },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: Colors.light.border },
  dropdownItemDanger: { borderBottomWidth: 0 },
  dropdownItemLast: { borderBottomWidth: 0 },
  dropdownSeparator: { height: 1, backgroundColor: Colors.light.border, marginVertical: 2 },
  dropdownItemText: { fontSize: 13, color: Colors.light.text, fontWeight: '500' },

  badge: { alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 3, borderRadius: DS.radius.pill, borderWidth: 1 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  opBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: DS.radius.pill, borderWidth: 1, maxWidth: 150 },
  opBadgeText: { fontSize: 10, fontWeight: '700' },
  opFilterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  opFilterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: DS.radius.pill, borderWidth: 1, borderColor: Colors.light.border, backgroundColor: Colors.light.background },
  opFilterChipActive: { borderColor: Colors.light.tint, backgroundColor: '#FFF4EE' },
  opFilterChipText: { fontSize: 12, color: Colors.light.textSecondary, fontWeight: '600' },
  opFilterChipTextActive: { color: Colors.light.tint },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.light.text },
  emptyText: { fontSize: 14, color: Colors.light.textSecondary, textAlign: 'center' },

  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: Colors.light.border, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.light.surface },
  checkboxChecked: { backgroundColor: Colors.light.tint, borderColor: Colors.light.tint },
  colCheckbox: { width: 36, alignItems: 'center', justifyContent: 'center' },

  tableRowSelected: { backgroundColor: '#FFF4EE' },

  bulkBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1C1C1E', paddingVertical: 8, paddingHorizontal: DS.spacing.lg, gap: 12, borderBottomWidth: 1, borderBottomColor: '#333' },
  bulkBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 100 },
  bulkCount: { fontSize: 13, fontWeight: '700', color: '#fff' },
  bulkClearBtn: { width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  bulkActionsRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bulkAction: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: DS.radius.sm, backgroundColor: 'rgba(255,255,255,0.1)' },
  bulkActionDanger: { backgroundColor: 'rgba(239,68,68,0.15)' },
  bulkActionText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.9)' },
  bulkDivider: { width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 4 },
});
