import React, { useMemo, useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  Modal,
  Platform,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import PageBackHeader from '@/components/PageBackHeader';
import {
  Edit3,
  FileText,
  Calendar,
  MapPin,
  Phone,
  Mail,
  Package,
  Truck,
  Layers,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  ClipboardList,
  Download,
  Printer,
  User,
  MoreVertical,
  X,
  RotateCcw,
  Trash2,
  Sheet,
  Lock,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Flame,
  Send,
  Copy,
  ExternalLink,
  Inbox,
  ArrowRight,
  Link2,
  DollarSign,
  AlertCircle,
  Workflow,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useQuotes } from '@/contexts/QuotesContext';
import { formatCurrency, calculateLineItemSubtotal, getTotalQuantity } from '@/utils/quoteCalculations';
import { ONLINE_FEE_LABEL, CARD_FEE_LABEL, SALES_TAX_LABEL } from '@/constants/fees';
import { formatDate } from '@/utils/textFormatting';
import { formatPhone } from '@/utils/phone';
import { LineItem, SIZE_LABELS, GarmentVariant, STATUS_CONFIG, QuoteStatus, OperationalProjectStatus, DeliveryMethod, OPERATIONAL_STATUSES, OPERATIONAL_STATUS_CONFIG, OPERATIONAL_NEXT, HOLD_REASONS, DELIVERY_METHODS } from '@/types/quote';
import { useUser } from '@/contexts/UserContext';
import { useCrm } from '@/contexts/CrmContext';
import { printQuote, generateWorkOrderPDFs, generateProjectDocumentPDF } from '@/utils/pdfGenerator';
import { DocumentMode } from '@/utils/projectDocument';
import { Toast } from '@/components/Toast';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PriorityControl } from '@/components/production/PriorityControl';
import { exportSingleSaleToSheets } from '@/utils/googleSheetsExport';
import { getAuthHeaders } from '@/lib/apiFetch';

export default function QuoteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { quotes, sales, convertToSale, convertToQuote, deleteQuote, isConverting, markExportedToSheets, lockSale, projects, startProduction, isLoading: quotesLoading, updateQuoteAsync, setOperationalStatus, setDeliveryMethod, setIndicator, isSettingOperationalStatus, setPriority, setRush } = useQuotes();
  const { currentUser } = useUser();
  const { orgs } = useCrm();
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [menuVisible, setMenuVisible] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);
  const [isSendingQuote, setIsSendingQuote] = useState(false);
  const [quoteLinkCopied, setQuoteLinkCopied] = useState(false);
  const [waveInvoiceLinkDraft, setWaveInvoiceLinkDraft] = useState('');
  const [isSavingWaveLink, setIsSavingWaveLink] = useState(false);
  const [waveLinkCopied, setWaveLinkCopied] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);
  const [opMenuVisible, setOpMenuVisible] = useState(false);
  const [holdModalVisible, setHoldModalVisible] = useState(false);
  const [resumeModalVisible, setResumeModalVisible] = useState(false);
  const [holdReasonDraft, setHoldReasonDraft] = useState<string>('');
  const [holdNotesDraft, setHoldNotesDraft] = useState('');
  const [deliveryEditOpen, setDeliveryEditOpen] = useState(false);

  interface ProjectFile {
    id: string;
    originalName: string;
    mimeType: string | null;
    fileSize: number | null;
    fileType: string;
    createdAt: string;
  }
  const [projectFiles, setProjectFiles] = useState<ProjectFile[]>([]);

  const toggleItem = useCallback((itemId: string) => {
    setExpandedItems(prev => ({ ...prev, [itemId]: !prev[itemId] }));
  }, []);
  const { isDesktop, isMobile } = useBreakpoint();

  const allProjects = useMemo(() => {
    return (projects || [...quotes, ...sales]).slice().sort((a, b) => {
      const da = new Date(a.orderDate).getTime();
      const db = new Date(b.orderDate).getTime();
      return db - da;
    });
  }, [projects, quotes, sales]);

  const contextQuote = useMemo(() => {
    return allProjects.find((q) => q.id === id);
  }, [allProjects, id]);

  const [directQuote, setDirectQuote] = useState<any>(null);
  const [directQuoteLoading, setDirectQuoteLoading] = useState(true);
  useEffect(() => {
    if (!id) { setDirectQuoteLoading(false); return; }
    let cancelled = false;
    fetch(`/api/projects/${id}`, { headers: { 'Content-Type': 'application/json' } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (!cancelled) { if (data) setDirectQuote(data); setDirectQuoteLoading(false); } })
      .catch(() => { if (!cancelled) setDirectQuoteLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  const quote = contextQuote || directQuote || undefined;

  useEffect(() => {
    if (!quote) return;
    const orgId = quote.orgId;
    const projectId = quote.id;
    if (!orgId) return;
    getAuthHeaders().then(authHeaders =>
      fetch(`/api/files?orgId=${orgId}&projectId=${projectId}`, { headers: authHeaders })
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data?.files) setProjectFiles(data.files); })
        .catch(() => {})
    );
  }, [quote?.id, quote?.orgId]);

  const linkedOrg = useMemo(() => {
    if (!quote) return undefined;
    if (quote.orgId) return orgs.find(o => o.id === quote.orgId);
    if (quote.personOrganization) return orgs.find(o => o.name.toLowerCase() === quote.personOrganization.toLowerCase());
    return undefined;
  }, [quote, orgs]);

  const linkedContact = useMemo(() => {
    if (!linkedOrg) return undefined;
    return linkedOrg.contacts.find(c => c.isPrimary) || linkedOrg.contacts[0];
  }, [linkedOrg]);

  const currentIndex = useMemo(() => allProjects.findIndex(q => q.id === id), [allProjects, id]);
  const prevQuote = currentIndex > 0 ? allProjects[currentIndex - 1] : null;
  const nextQuote = currentIndex < allProjects.length - 1 ? allProjects[currentIndex + 1] : null;

  const isReadyToSend = useMemo(() => {
    if (!quote) return false;
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
  }, [quote]);

  useEffect(() => {
    setWaveInvoiceLinkDraft(quote?.waveInvoiceLink || '');
  }, [quote?.waveInvoiceLink]);

  const goToPrev = useCallback(() => {
    if (prevQuote) router.replace(`/quote/${prevQuote.id}`);
  }, [prevQuote, router]);

  const goToNext = useCallback(() => {
    if (nextQuote) router.replace(`/quote/${nextQuote.id}`);
  }, [nextQuote, router]);

  

  const getTotalSizeQuantities = (item: LineItem) => {
    const sizes: string[] = [];
    SIZE_LABELS.forEach(({ key, label }) => {
      if (item.sizes[key] > 0) {
        sizes.push(`${label}: ${item.sizes[key]}`);
      }
    });
    if (item.sizes.flat > 0) {
      sizes.push(`Flat: ${item.sizes.flat}`);
    }
    return sizes.join(', ') || 'No quantities';
  };

  const getItemQuantity = (item: LineItem) => {
    const isPromotional = item.serviceStyle === 'Promotional';
    return getTotalQuantity(item.sizes, isPromotional);
  };

  const handleExportDocument = useCallback(async (mode: DocumentMode) => {
    if (!quote) return;
    try {
      await generateProjectDocumentPDF(quote, mode, currentUser);
    } catch (error) {
      console.log('Error exporting document:', error);
      Alert.alert('Error', 'Failed to export document');
    }
  }, [quote, currentUser]);

  const handleDownloadWorkOrder = useCallback(async () => {
    if (!quote) return;
    if (!quote.lineItems || quote.lineItems.length === 0) {
      Alert.alert('No Line Items', 'This project has no line items to export.');
      return;
    }
    try {
      await generateWorkOrderPDFs(quote, currentUser);
    } catch (error) {
      console.log('Error generating work order:', error);
      Alert.alert('Error', 'Failed to generate work order');
    }
  }, [quote, currentUser]);

  const handlePrint = useCallback(async () => {
    if (!quote) return;
    try {
      await printQuote(quote, currentUser);
    } catch (error) {
      console.log('Error printing:', error);
      Alert.alert('Error', 'Failed to print');
    }
  }, [quote, currentUser]);

  // Unified document exports. Quote PDF is always available; Invoice and the
  // Production Punch Sheet unlock as the project advances. All three render from
  // the SAME template as the Client Hub Order Detail (mode controls visibility).
  const renderDocumentExports = () => {
    const status = quote?.status || '';
    const invoiceReady = ['quoted', 'invoice_sent', 'paid', 'active', 'production_started', 'completed'].includes(status);
    const productionReady = ['paid', 'active', 'production_started', 'completed'].includes(status);
    return (
      <>
        <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); handleExportDocument('QUOTE'); }}>
          <Download size={18} color={Colors.light.text} />
          <Text style={styles.menuItemText}>Quote PDF</Text>
        </TouchableOpacity>
        {invoiceReady && (
          <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); handleExportDocument('INVOICE'); }}>
            <FileText size={18} color={Colors.light.text} />
            <Text style={styles.menuItemText}>Invoice PDF</Text>
          </TouchableOpacity>
        )}
        {productionReady && (
          <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); handleExportDocument('PRODUCTION'); }}>
            <ClipboardList size={18} color={Colors.light.text} />
            <Text style={styles.menuItemText}>Production Punch Sheet</Text>
          </TouchableOpacity>
        )}
      </>
    );
  };

  const handleEdit = useCallback(() => {
    if (!quote) return;
    router.push({
      pathname: '/quote/edit',
      params: { id: quote.id },
    });
  }, [quote, router]);

  const handleStartQuote = useCallback(async () => {
    if (!quote) return;
    try {
      await updateQuoteAsync({ ...quote, status: 'quoting' });
    } catch {}
    router.push({ pathname: '/quote/edit', params: { id: quote.id } });
  }, [quote, router, updateQuoteAsync]);

  const getQuotePortalUrl = useCallback(() => {
    if (!quote) return '';
    const base = typeof window !== 'undefined'
      ? window.location.origin
      : `https://${process.env.REPLIT_DEV_DOMAIN || 'localhost:5000'}`;
    return `${base}/portal/quote/${quote.id}`;
  }, [quote]);

  const handleCopyQuoteLink = useCallback(async () => {
    if (!quote) return;
    const url = getQuotePortalUrl();
    try {
      if (Platform.OS === 'web' && navigator?.clipboard) {
        await navigator.clipboard.writeText(url);
      }
      setQuoteLinkCopied(true);
      setTimeout(() => setQuoteLinkCopied(false), 2500);
    } catch {}
  }, [quote, getQuotePortalUrl]);

  const handleMarkQuoteSent = useCallback(async () => {
    if (!quote || isSendingQuote) return;
    const isQuotedAlready = quote.status === 'quoted' || quote.status === 'invoice_sent';
    if (!isReadyToSend && !isQuotedAlready) {
      Alert.alert(
        'Pricing Required',
        'Please add product costs and service costs before sending the quote. Fees and markup default to $0.00 and do not need to be set.',
        [
          { text: 'Edit Quote', onPress: handleEdit },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }
    setIsSendingQuote(true);
    try {
      const sentAt = new Date().toISOString();
      await updateQuoteAsync({ ...quote, status: 'quoted', quoteSentAt: sentAt });

      // Send quote email via Resend if the linked contact has an email address
      const contactEmail = linkedContact?.email;
      if (contactEmail) {
        const portalUrl =
          typeof window !== 'undefined'
            ? `${window.location.origin}/portal/quote/${quote.id}`
            : '';
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
          })
        ).catch((e) => console.warn('[quote email]', e));
        setToastMessage('Quote sent by email and link copied!');
      } else {
        setToastMessage('Quote marked as sent! Link copied.');
      }
      setToastVisible(true);
      await handleCopyQuoteLink();
      setTimeout(() => router.replace(`/quote/${quote.id}`), 800);
    } catch {
      setToastMessage('Error saving — please try again.');
      setToastVisible(true);
    } finally {
      setIsSendingQuote(false);
    }
  }, [quote, linkedContact, isSendingQuote, isReadyToSend, handleEdit, handleCopyQuoteLink, router, updateQuoteAsync]);

  const handleMarkPaid = useCallback(async () => {
    if (!quote) return;
    try {
      await updateQuoteAsync({ ...quote, status: 'paid' });
      setToastMessage('Marked as Paid! Ready for production.');
      setToastVisible(true);
      setTimeout(() => router.replace(`/quote/${quote.id}`), 800);
    } catch {
      setToastMessage('Error saving — please try again.');
      setToastVisible(true);
    }
  }, [quote, router, updateQuoteAsync]);

  const handleSaveWaveLink = useCallback(async () => {
    if (!quote || isSavingWaveLink) return;
    const link = waveInvoiceLinkDraft.trim();
    setIsSavingWaveLink(true);
    try {
      await updateQuoteAsync({ ...quote, waveInvoiceLink: link || null });
      setToastMessage(link ? 'Wave invoice link saved!' : 'Wave invoice link removed.');
      setToastVisible(true);
      setTimeout(() => router.replace(`/quote/${quote.id}`), 600);
    } catch {
      setToastMessage('Error saving — please try again.');
      setToastVisible(true);
    } finally {
      setIsSavingWaveLink(false);
    }
  }, [quote, waveInvoiceLinkDraft, isSavingWaveLink, router, updateQuoteAsync]);

  const handleCopyWaveLink = useCallback(async () => {
    if (!quote?.waveInvoiceLink) return;
    try {
      await navigator.clipboard.writeText(quote.waveInvoiceLink);
      setWaveLinkCopied(true);
      setTimeout(() => setWaveLinkCopied(false), 2000);
    } catch {}
  }, [quote?.waveInvoiceLink]);

  const handleCopyEmailTemplate = useCallback(async () => {
    if (!quote) return;
    const clientName = quote.personOrganization || 'there';
    const total = quote.calculations?.total;
    const portalUrl = typeof window !== 'undefined' ? `${window.location.origin}/portal/quote/${quote.id}` : '';
    const waveLink = quote.waveInvoiceLink || '';
    const lines: string[] = [
      `Hi ${clientName},`,
      '',
      `Your quote from Katalyst Ko is ready! Here's a quick summary:`,
      '',
      `  Project: ${quote.projectName || 'Your Order'}`,
      ...(total != null ? [`  Total: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(total)}`] : []),
      '',
      `Review your full quote here:`,
      `  ${portalUrl}`,
      '',
      ...(waveLink ? [
        `To pay your invoice:`,
        `  ${waveLink}`,
        '',
      ] : []),
      `Questions? Reply to this email or reach us at jobs@katalystko.com`,
      '',
      `— Katalyst Ko Printshop`,
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setEmailCopied(true);
      setTimeout(() => setEmailCopied(false), 2500);
    } catch {}
  }, [quote]);

  const handleConvertToSale = useCallback(() => {
    if (!quote) return;
    setMenuVisible(false);
    convertToSale(quote.id);
    setToastMessage('Project marked as Active!');
    setToastVisible(true);
  }, [quote, convertToSale]);

  const handleTrackSales = useCallback(() => {
    if (!quote) return;
    router.push({
      pathname: '/quote/sales-tracking',
      params: { id: quote.id },
    });
  }, [quote, router]);

  const handleStartProduction = useCallback(() => {
    if (!quote) return;
    if (quote.status !== 'paid' && quote.status !== 'active' && quote.status !== 'production_started') {
      Alert.alert(
        'Payment Required',
        'This project must be marked as Paid before it can enter production. No project can go to production without pricing and confirmed payment.',
        [{ text: 'OK' }]
      );
      return;
    }
    startProduction(quote.id);
    router.push(`/quote/production/${quote.id}`);
  }, [quote, startProduction, router]);

  const handleOpenProduction = useCallback(() => {
    if (!quote) return;
    router.push(`/quote/production/${quote.id}`);
  }, [quote, router]);

  const handleRevertToQuote = useCallback(() => {
    if (!quote) return;
    if (quote.isLocked) {
      Alert.alert('Locked', 'Unlock this project first before reverting.');
      return;
    }
    setMenuVisible(false);
    convertToQuote(quote.id);
    setToastMessage('Reverted to Quoted status.');
    setToastVisible(true);
  }, [quote, convertToQuote]);

  const handleSaveAndLock = useCallback(() => {
    if (!quote) return;
    setMenuVisible(false);
    Alert.alert(
      'Save & Lock',
      `Are you sure you want to lock "${quote.projectName}"? You will need an admin password to unlock it later.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Lock',
          onPress: () => {
            lockSale(quote.id);
            setToastMessage('Sale has been locked.');
            setToastVisible(true);
          },
        },
      ]
    );
  }, [quote, lockSale]);

  const handleExportToSheets = useCallback(async () => {
    if (!quote || !quote.salesData) return;
    setMenuVisible(false);
    
    if (!currentUser?.googleSheetsUrl) {
      Alert.alert(
        'Setup Required',
        'Please set up your Google Sheets Web App URL in Profile settings first. Tap "How to set up Google Sheets integration" for instructions.',
        [{ text: 'OK' }]
      );
      return;
    }

    setIsExporting(true);
    try {
      const result = await exportSingleSaleToSheets(currentUser.googleSheetsUrl, quote);
      
      if (result.success) {
        markExportedToSheets(quote.id);
        setToastMessage('Sale exported to Google Sheets!');
        setToastVisible(true);
      } else {
        Alert.alert('Export Failed', result.message);
      }
    } catch (error) {
      console.log('Error exporting to sheets:', error);
      Alert.alert('Error', 'Failed to export to Google Sheets. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }, [quote, currentUser?.googleSheetsUrl, markExportedToSheets]);

  const handleDelete = useCallback(() => {
    if (!quote) return;
    setMenuVisible(false);
    setConfirmDeleteVisible(true);
  }, [quote]);

  const getSalesCalculations = useCallback(() => {
    if (!quote?.salesData || !quote?.calculations) return null;
    const serviceFeesCost = quote.salesData.actualServiceFeesCost ?? 0;
    const serviceFeesProfit = quote.salesData.actualServiceFeesProfit ?? 0;
    const onlineFee = quote.salesData.actualOnlineFee ?? 0;
    const salesTax = quote.salesData.actualSalesTax ?? 0;
    const cardFee = quote.salesData.actualCardFee ?? 0;
    
    const actualCOG = (quote.salesData.actualProductCost ?? 0) + (quote.salesData.actualServiceCost ?? 0) + 
                      serviceFeesCost + (quote.salesData.actualOtherCosts ?? 0);
    const actualTotalWithFees = actualCOG + onlineFee + salesTax + cardFee;
    
    const quotedFees = quote.calculations.serviceFeeTotal ?? 0;
    const feesDifference = quotedFees - serviceFeesCost;
    
    const actualProfit = (quote.salesData.amountCollected ?? 0) - actualTotalWithFees + serviceFeesProfit;
    const actualProfitMargin = (quote.salesData.amountCollected ?? 0) > 0 
      ? ((actualProfit / quote.salesData.amountCollected) * 100) 
      : 0;
    const quotedVsActualCOGDiff = (quote.calculations.cogTotal ?? 0) - actualCOG;
    const quotedVsActualProfitDiff = actualProfit - (quote.calculations.markupAmount ?? 0);
    
    const actualSubtotal = actualCOG + actualProfit;
    const quotedSubtotal = quote.calculations.subtotal ?? 0;
    
    return { 
      actualCOG, 
      actualProfit, 
      actualProfitMargin, 
      quotedVsActualCOGDiff, 
      quotedVsActualProfitDiff, 
      serviceFeesProfit,
      actualSubtotal,
      quotedSubtotal,
      onlineFee,
      salesTax,
      cardFee,
    };
  }, [quote]);

  if (!quote) {
    if (quotesLoading || directQuoteLoading) {
      return (
        <View style={styles.container}>
          <Stack.Screen options={{ title: 'Loading…' }} />
          <View style={styles.notFound}>
            <ActivityIndicator size="large" color={Colors.light.tint} />
            <Text style={[styles.notFoundText, { marginTop: 12 }]}>Loading…</Text>
          </View>
        </View>
      );
    }
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Quote Details' }} />
        <View style={styles.notFound}>
          <FileText size={48} color={Colors.light.border} />
          <Text style={styles.notFoundText}>Quote not found</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const renderIntakeBanner = () => {
    if (quote.status !== 'needs_review') return null;
    const isClientHub = quote.intakeSource === 'CLIENT_HUB';
    return (
      <View style={styles.intakeBanner}>
        <View style={styles.intakeBannerHeader}>
          <Inbox size={18} color="#FF5A00" />
          <Text style={styles.intakeBannerTitle}>
            {isClientHub ? 'Client Hub Submission' : 'Needs Review'}
          </Text>
        </View>
        <Text style={styles.intakeBannerText}>
          {isClientHub
            ? 'This project came in from the client hub. Review the line items below, then start quoting to add pricing.'
            : 'This project is awaiting review. No pricing has been set yet — start quoting to add costs and totals.'}
        </Text>
        <View style={styles.intakeBannerActions}>
          <TouchableOpacity style={styles.intakeBannerBtn} onPress={handleStartQuote}>
            <Text style={styles.intakeBannerBtnText}>Start Quoting</Text>
            <ArrowRight size={15} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderSendQuotePanel = () => {
    const showForStatuses: string[] = ['needs_review', 'quoting', 'quoted', 'invoice_sent'];
    if (!showForStatuses.includes(quote.status)) return null;
    const portalUrl = getQuotePortalUrl();
    const isQuoted = quote.status === 'quoted' || quote.status === 'invoice_sent';
    return (
      <View style={styles.sendQuotePanel}>
        <View style={styles.sendQuotePanelHeader}>
          <Send size={16} color="#FF5A00" />
          <Text style={styles.sendQuotePanelTitle}>
            Send Quote
          </Text>
        </View>
        {quote.quoteSentAt ? (
          <View style={styles.sentStatusRow}>
            <CheckCircle size={14} color="#16A34A" />
            <Text style={styles.sentStatusText}>
              Sent {new Date(quote.quoteSentAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </Text>
          </View>
        ) : null}
        <Text style={styles.sendQuotePanelSub}>
          {isQuoted
            ? 'Re-send the quote link to your client or copy it to share manually.'
            : 'Share this link with your client so they can review and approve the quote.'}
        </Text>
        {!isReadyToSend && !isQuoted && (
          <View style={styles.pricingRequiredBanner}>
            <AlertCircle size={13} color="#B45309" />
            <Text style={styles.pricingRequiredText}>
              Pricing required before sending — edit the quote to add product &amp; service costs. Fees default to $0.00.
            </Text>
          </View>
        )}
        <View style={styles.urlBox}>
          <Text style={styles.urlText} numberOfLines={1} ellipsizeMode="middle">{portalUrl}</Text>
        </View>
        <View style={styles.sendQuoteActions}>
          <TouchableOpacity
            style={[styles.sendQuoteBtn, styles.sendQuoteBtnOutline]}
            onPress={handleCopyQuoteLink}
          >
            <Copy size={14} color="#FF5A00" />
            <Text style={styles.sendQuoteBtnOutlineText}>
              {quoteLinkCopied ? 'Copied!' : 'Copy Link'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sendQuoteBtn, styles.sendQuoteBtnSolid, (isSendingQuote || (!isQuoted && !isReadyToSend)) && { opacity: 0.45 }]}
            onPress={handleMarkQuoteSent}
            disabled={isSendingQuote}
          >
            {isSendingQuote
              ? <ActivityIndicator size="small" color="#fff" />
              : (
                <>
                  <Send size={14} color="#fff" />
                  <Text style={styles.sendQuoteBtnSolidText}>
                    {'Send Quote'}
                  </Text>
                </>
              )}
          </TouchableOpacity>
        </View>

        {/* Wave Invoice Link section */}
        <View style={styles.waveSection}>
          <View style={styles.waveSectionHeader}>
            <DollarSign size={13} color="#7C3AED" />
            <Text style={styles.waveSectionTitle}>Wave Invoice Link</Text>
            {quote.waveInvoiceLink ? (
              <View style={styles.waveSavedPill}>
                <Text style={styles.waveSavedPillText}>Saved</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.waveSectionSub}>
            Paste your Wave-hosted invoice URL. Clients will see a Pay Now button on their quote page.
          </Text>
          <View style={styles.waveLinkInputRow}>
            <TextInput
              style={styles.waveLinkInput}
              value={waveInvoiceLinkDraft}
              onChangeText={setWaveInvoiceLinkDraft}
              placeholder="https://pay.wave.com/m/..."
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <TouchableOpacity
              style={[styles.waveLinkSaveBtn, isSavingWaveLink && { opacity: 0.6 }]}
              onPress={handleSaveWaveLink}
              disabled={isSavingWaveLink}
            >
              {isSavingWaveLink
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.waveLinkSaveBtnText}>Save</Text>
              }
            </TouchableOpacity>
          </View>
          {quote.waveInvoiceLink ? (
            <View style={styles.waveActionsRow}>
              <TouchableOpacity style={styles.waveActionBtn} onPress={handleCopyWaveLink}>
                <Link2 size={12} color="#7C3AED" />
                <Text style={styles.waveActionBtnText}>{waveLinkCopied ? 'Copied!' : 'Copy Wave Link'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.waveActionBtn} onPress={handleCopyEmailTemplate}>
                <Mail size={12} color="#7C3AED" />
                <Text style={styles.waveActionBtnText}>{emailCopied ? 'Copied!' : 'Copy Email Template'}</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        {isQuoted && (
          <TouchableOpacity style={styles.markPaidBtn} onPress={handleMarkPaid}>
            <CheckCircle size={15} color="#fff" />
            <Text style={styles.markPaidBtnText}>Mark as Paid → Ready for Production</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderOrderInfo = () => {
    const statusMeta = STATUS_CONFIG[quote.status as QuoteStatus];
    const statusColor = statusMeta
      ? (statusMeta.color.toUpperCase() === '#FFFFFF' ? statusMeta.bg : statusMeta.color)
      : undefined;
    const quoteNum = quote.projectNumber || (quote.invoiceNumber ? `#${quote.invoiceNumber}` : null);
    const orgName = linkedOrg?.name || quote.personOrganization;
    const location = linkedOrg
      ? [linkedOrg.address, [linkedOrg.city, linkedOrg.state].filter(Boolean).join(', ')]
          .filter(Boolean)
          .join('\n')
      : '';

    return (
      <View style={styles.section}>
        <View style={[styles.identityRow, isDesktop && styles.identityRowDesktop]}>
          {/* Quote Information card */}
          <View style={[styles.card, styles.identityCard]}>
            <Text style={styles.identityProjectName} numberOfLines={2}>
              {quote.projectName || 'Untitled Project'}
            </Text>
            {orgName ? (
              linkedOrg ? (
                <TouchableOpacity
                  style={styles.identityOrgLink}
                  onPress={() => router.push(`/crm/${linkedOrg.id}` as any)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.identityOrgName, { color: Colors.light.tint }]} numberOfLines={1}>
                    {orgName}
                  </Text>
                  <ExternalLink size={14} color={Colors.light.tint} />
                </TouchableOpacity>
              ) : (
                <Text style={styles.identityOrgName} numberOfLines={1}>{orgName}</Text>
              )
            ) : null}
            {(quoteNum || statusMeta) ? (
              <View style={styles.identityMetaRow}>
                {quoteNum ? <Text style={styles.identityQuoteNum}>{quoteNum}</Text> : null}
                {quoteNum && statusMeta ? <Text style={styles.identityMetaDot}>•</Text> : null}
                {statusMeta ? (
                  <Text style={[styles.identityStatus, { color: statusColor }]}>{statusMeta.label}</Text>
                ) : null}
              </View>
            ) : null}
            <View style={styles.orderDivider} />
            <View style={styles.identityDatesRow}>
              <View style={styles.identityDateBlock}>
                <Text style={styles.identityDateLabel}>ORDER DATE</Text>
                <Text style={styles.identityDateValue}>{formatDate(quote.orderDate) || 'N/A'}</Text>
              </View>
              <View style={styles.identityDateBlock}>
                <Text style={styles.identityDateLabel}>DUE DATE</Text>
                <Text style={styles.identityDateValue}>{formatDate(quote.inHandsDate) || 'N/A'}</Text>
              </View>
            </View>
          </View>

          {/* Primary Contact card */}
          <View style={[styles.card, styles.contactCard, isDesktop && styles.contactCardDesktop]}>
            <Text style={styles.contactCardLabel}>PRIMARY CONTACT</Text>
            {linkedContact ? (
              <>
                <Text style={styles.contactCardName}>
                  {linkedContact.firstName} {linkedContact.lastName}
                </Text>
                <Text style={styles.contactCardRole}>{linkedContact.role || 'Primary Contact'}</Text>
              </>
            ) : orgName ? (
              <Text style={[styles.contactCardName, { marginBottom: 10 }]}>{orgName}</Text>
            ) : (
              <Text style={[styles.contactCardName, styles.contactCardEmpty]}>No primary contact on file</Text>
            )}
            {linkedContact?.phone ? (
              <View style={styles.contactCardRow}>
                <Phone size={14} color={Colors.light.textSecondary} />
                <Text style={styles.contactCardInfo}>{formatPhone(linkedContact.phone)}</Text>
              </View>
            ) : null}
            {linkedContact?.email ? (
              <View style={styles.contactCardRow}>
                <Mail size={14} color={Colors.light.textSecondary} />
                <Text style={styles.contactCardInfo}>{linkedContact.email}</Text>
              </View>
            ) : null}
            {location ? (
              <View style={styles.contactCardRow}>
                <MapPin size={14} color={Colors.light.textSecondary} />
                <Text style={styles.contactCardInfo}>{location}</Text>
              </View>
            ) : null}
          </View>

          {/* Project Workflow card */}
          {renderWorkflowCard()}
        </View>
      </View>
    );
  };

  const renderLineItems = () => {
    const totalItems = quote.lineItems.reduce((sum, item) => sum + getItemQuantity(item), 0);
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Line Items ({quote.lineItems.length})</Text>
        </View>
        {quote.lineItems.map((item, index) => {
          const isExpanded = expandedItems[item.id] !== false;
          const qty = getItemQuantity(item);
          const calcs = calculateLineItemSubtotal(item);
          const variants: GarmentVariant[] = item.garmentVariants && item.garmentVariants.length > 0
            ? item.garmentVariants
            : [{ product: item.product, color: item.productColor, sizes: item.sizes }];
          const locations = [item.location1, item.location2, item.location3, item.location4].filter(Boolean) as string[];
          const isPromotional = item.serviceStyle === 'Promotional';
          return (
            <View key={item.id} style={styles.lineItemCard}>
              <TouchableOpacity style={styles.lineItemHeader} onPress={() => toggleItem(item.id)} activeOpacity={0.8}>
                <View style={styles.lineItemHeaderLeft}>
                  <Text style={styles.lineItemNumber}>#{index + 1}</Text>
                  <View style={styles.lineItemHeaderInfo}>
                    <Text style={styles.lineItemHeaderName} numberOfLines={1}>{item.designName || 'Untitled Design'}</Text>
                  </View>
                </View>
                <View style={styles.lineItemHeaderRight}>
                  <Text style={styles.lineItemHeaderQty}>{qty} pcs</Text>
                  {isExpanded ? <ChevronUp size={16} color="rgba(255,255,255,0.7)" /> : <ChevronDown size={16} color="rgba(255,255,255,0.7)" />}
                </View>
              </TouchableOpacity>

              {/* Mobile-only: full-width mockup row between header and body */}
              {isExpanded && isMobile && (
                <View style={styles.lineItemMobileMockupRow}>
                  {item.mockupUri ? (
                    <Image source={{ uri: item.mockupUri }} style={styles.mockupImage} resizeMode="contain" />
                  ) : (
                    <View style={styles.mockupPlaceholder}>
                      <Package size={28} color={Colors.light.border} />
                      <Text style={styles.mockupPlaceholderText}>No mockup</Text>
                    </View>
                  )}
                </View>
              )}

              {isExpanded && (
                <View style={[styles.lineItemBody, isMobile && styles.lineItemBodyMobile]}>
                  {/* Mockup — desktop only (left 1/3) */}
                  {!isMobile && (
                    <View style={styles.lineItemMockupCol}>
                      {item.mockupUri ? (
                        <Image
                          source={{ uri: item.mockupUri }}
                          style={styles.mockupImage}
                          resizeMode="contain"
                        />
                      ) : (
                        <View style={styles.mockupPlaceholder}>
                          <Package size={28} color={Colors.light.border} />
                          <Text style={styles.mockupPlaceholderText}>No mockup</Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Right panel — all details + sizes + costs + subtotal */}
                  <View style={styles.lineItemRightCol}>
                    {/* Detail rows */}
                    <View style={styles.lineItemDetailsCol}>
                      {/* Service Style */}
                      <View style={styles.detailRow}>
                        <Layers size={13} color={Colors.light.textSecondary} style={{ flexShrink: 0 }} />
                        <Text style={styles.detailLabel}>Service</Text>
                        <Text style={styles.detailValue}>{item.serviceStyle}</Text>
                      </View>

                      {/* Applicator */}
                      {item.applicator ? (
                        <View style={styles.detailRow}>
                          <User size={13} color={Colors.light.text} style={{ flexShrink: 0 }} />
                          <Text style={styles.detailLabel}>Applicator</Text>
                          <Text style={[styles.detailValue, styles.applicatorValue]} numberOfLines={1}>{item.applicator}</Text>
                        </View>
                      ) : null}

                      {/* Source */}
                      <View style={styles.detailRow}>
                        <Truck size={13} color={Colors.light.textSecondary} style={{ flexShrink: 0 }} />
                        <Text style={styles.detailLabel}>Source</Text>
                        <Text style={styles.detailValue} numberOfLines={1}>{item.apparelProvider}</Text>
                      </View>

                    </View>

                    {/* Sizes grid — one per variant, each with its own header + location + notes */}
                    {variants.map((v, vi) => (
                      <View key={vi} style={styles.sizesGridSection}>
                        {/* Variant header — always shown */}
                        <View style={styles.variantSectionHeader}>
                          <Package size={13} color="rgba(255,255,255,0.7)" style={{ flexShrink: 0 }} />
                          <Text style={styles.variantSectionHeaderText} numberOfLines={2}>
                            {v.product || '—'}{v.color ? ` — ${v.color}` : ''}
                          </Text>
                        </View>

                        {/* Content area below the header */}
                        <View style={styles.variantSectionContent}>
                        {/* Location — shown once (same for all variants) */}
                        {locations.length > 0 && (
                          <View style={styles.variantMetaRow}>
                            <MapPin size={12} color={Colors.light.textSecondary} style={{ flexShrink: 0 }} />
                            <Text style={styles.variantMetaLabel}>Location</Text>
                            <Text style={styles.variantMetaValue}>{locations.join(', ')}</Text>
                          </View>
                        )}

                        {/* Project Notes */}
                        <View style={[styles.variantMetaRow, { marginBottom: 10 }]}>
                          <FileText size={12} color={Colors.light.textSecondary} style={{ flexShrink: 0 }} />
                          <Text style={styles.variantMetaLabel}>Project Notes</Text>
                          <Text style={[styles.variantMetaValue, !item.locationDetails && styles.detailValueMuted]}>
                            {item.locationDetails || 'N/A'}
                          </Text>
                        </View>

                        <Text style={styles.sizesGridLabel}>Sizes + Quantities</Text>
                        {isPromotional ? (
                          <View style={styles.sizesGridRow}>
                            <View style={styles.sizeGridCell}>
                              <Text style={styles.sizeGridCellLabel}>Qty</Text>
                              <View style={styles.sizeGridCellBox}>
                                <Text style={styles.sizeGridCellValue}>{v.sizes.flat || 0}</Text>
                              </View>
                            </View>
                          </View>
                        ) : (
                          <>
                            <View style={styles.sizesGridRow}>
                              {(['xs','s','m','l'] as const).map(k => {
                                const entry = SIZE_LABELS.find(sl => sl.key === k)!;
                                return (
                                  <View key={k} style={styles.sizeGridCell}>
                                    <Text style={styles.sizeGridCellLabel}>{entry.label}</Text>
                                    <View style={[styles.sizeGridCellBox, !v.sizes[k] && styles.sizeGridCellBoxEmpty]}>
                                      <Text style={[styles.sizeGridCellValue, !v.sizes[k] && styles.sizeGridCellValueEmpty]}>{v.sizes[k] || 0}</Text>
                                    </View>
                                  </View>
                                );
                              })}
                            </View>
                            <View style={[styles.sizesGridRow, { marginTop: 6 }]}>
                              {(['xl','xxl','xxxl','xxxxl'] as const).map(k => {
                                const entry = SIZE_LABELS.find(sl => sl.key === k)!;
                                return (
                                  <View key={k} style={styles.sizeGridCell}>
                                    <Text style={styles.sizeGridCellLabel}>{entry.label}</Text>
                                    <View style={[styles.sizeGridCellBox, !v.sizes[k] && styles.sizeGridCellBoxEmpty]}>
                                      <Text style={[styles.sizeGridCellValue, !v.sizes[k] && styles.sizeGridCellValueEmpty]}>{v.sizes[k] || 0}</Text>
                                    </View>
                                  </View>
                                );
                              })}
                            </View>
                          </>
                        )}
                        <Text style={styles.sizesGridTotal}>
                          Total: {getTotalQuantity(v.sizes, isPromotional)} pcs
                        </Text>
                        </View>{/* end variantSectionContent */}
                      </View>
                    ))}

                    {/* Product / Service / Fees / Markup */}
                    <View style={styles.costsBox}>
                      <View style={styles.costItem}>
                        <Text style={styles.costLabel}>Product</Text>
                        <Text style={styles.costValue}>{formatCurrency(item.productCostEach)}/ea</Text>
                      </View>
                      <View style={styles.costItem}>
                        <Text style={styles.costLabel}>Service</Text>
                        <Text style={styles.costValue}>{formatCurrency(item.serviceCostEach)}/ea</Text>
                      </View>
                      <View style={styles.costItem}>
                        <Text style={styles.costLabel}>Fees</Text>
                        <Text style={styles.costValue}>{formatCurrency(item.serviceFeeEach)}/ea</Text>
                      </View>
                      <View style={styles.costItem}>
                        <Text style={styles.costLabel}>Markup</Text>
                        <Text style={styles.costValue}>{formatCurrency(item.markupEach || 0)}/ea</Text>
                      </View>
                    </View>

                    {/* Subtotal */}
                    <View style={styles.lineItemSubtotalBox}>
                      <Text style={styles.lineItemSubtotalLabel}>Subtotal</Text>
                      <View style={styles.lineItemSubtotalRight}>
                        <Text style={styles.lineItemSubtotalPer}>{calcs.quantity} pcs @ {formatCurrency(calcs.perPiece)}/ea</Text>
                        <Text style={styles.lineItemSubtotalValue}>{formatCurrency(calcs.subtotal)}</Text>
                      </View>
                    </View>
                  </View>
                </View>
              )}
            </View>
          );
        })}

        {/* Totals bar */}
        <View style={styles.lineItemTotalsBar}>
          <Text style={styles.lineItemTotalsText}>
            {quote.lineItems.length} Line Item{quote.lineItems.length !== 1 ? 's' : ''}
          </Text>
          <View style={styles.lineItemTotalsDot} />
          <Text style={styles.lineItemTotalsText}>
            {totalItems} Total Item{totalItems !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>
    );
  };

  const renderUploadedArtwork = () => {
    if (projectFiles.length === 0) return null;

    function fmtBytes(bytes: number | null): string {
      if (!bytes) return '';
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
      return `${(bytes / 1048576).toFixed(1)} MB`;
    }

    function fmtMime(mime: string | null, name: string): string {
      const ext = name.split('.').pop()?.toUpperCase();
      if (ext && ['AI', 'SVG', 'PNG', 'JPG', 'JPEG', 'PDF'].includes(ext)) return ext === 'JPEG' ? 'JPG' : ext;
      if (!mime) return 'FILE';
      const map: Record<string, string> = {
        'image/png': 'PNG', 'image/jpeg': 'JPG', 'image/svg+xml': 'SVG',
        'application/pdf': 'PDF', 'application/postscript': 'AI', 'application/illustrator': 'AI',
      };
      return map[mime] || 'FILE';
    }

    function isImageMime(mime: string | null): boolean {
      return !!mime && ['image/png', 'image/jpeg', 'image/svg+xml'].includes(mime);
    }

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Uploaded Artwork ({projectFiles.length})</Text>
        </View>
        <View style={koArtStyles.grid}>
          {projectFiles.map(file => (
            <View key={file.id} style={koArtStyles.card}>
              <View style={koArtStyles.preview}>
                {isImageMime(file.mimeType) ? (
                  <Image
                    source={{ uri: `/api/files/${file.id}?inline=true` }}
                    style={koArtStyles.previewImg}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={koArtStyles.typeBadge}>
                    <Text style={koArtStyles.typeLabel}>{fmtMime(file.mimeType, file.originalName)}</Text>
                  </View>
                )}
              </View>
              <View style={koArtStyles.info}>
                <Text style={koArtStyles.fileName} numberOfLines={2}>{file.originalName}</Text>
                <Text style={koArtStyles.fileMeta}>{fmtBytes(file.fileSize)}</Text>
              </View>
              <View style={koArtStyles.actions}>
                <TouchableOpacity
                  style={koArtStyles.actionBtn}
                  onPress={() => {
                    if (Platform.OS === 'web') {
                      window.open(`/api/files/${file.id}?inline=true`, '_blank');
                    }
                  }}
                >
                  <ExternalLink size={13} color={Colors.light.tint} />
                  <Text style={koArtStyles.actionBtnText}>View</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={koArtStyles.actionBtn}
                  onPress={() => {
                    if (Platform.OS === 'web') {
                      const a = document.createElement('a');
                      a.href = `/api/files/${file.id}`;
                      a.download = file.originalName;
                      a.click();
                    }
                  }}
                >
                  <Download size={13} color={Colors.light.textSecondary} />
                  <Text style={koArtStyles.actionBtnTextMuted}>Download</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderPricingSummary = () => {
    if (!quote.calculations) return null;
    const q = quote.calculations;
    const perPc = (val: number) => (q.totalQuantity ?? 0) > 0 ? val / q.totalQuantity : 0;
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Pricing Summary</Text>
        <View style={styles.summaryCard}>
          <View style={styles.pricingTable}>
            <View style={styles.pricingTableHeader}>
              <Text style={styles.pricingTHLabel}></Text>
              <Text style={styles.pricingTHValue}>EACH</Text>
              <Text style={styles.pricingTHValue}>TOTAL</Text>
            </View>

            <View style={styles.pricingRow}>
              <Text style={styles.pricingRowLabel}>Product Cost</Text>
              <Text style={styles.pricingRowValue}>{formatCurrency(perPc(q.productCostTotal))}</Text>
              <Text style={styles.pricingRowValue}>{formatCurrency(q.productCostTotal)}</Text>
            </View>
            <View style={styles.pricingRow}>
              <Text style={styles.pricingRowLabel}>Service Cost</Text>
              <Text style={styles.pricingRowValue}>{formatCurrency(perPc(q.serviceCostTotal))}</Text>
              <Text style={styles.pricingRowValue}>{formatCurrency(q.serviceCostTotal)}</Text>
            </View>
            <View style={styles.pricingRow}>
              <Text style={styles.pricingRowLabel}>Service Fees</Text>
              <Text style={styles.pricingRowValue}>{formatCurrency(perPc(q.serviceFeeTotal))}</Text>
              <Text style={styles.pricingRowValue}>{formatCurrency(q.serviceFeeTotal)}</Text>
            </View>

            <View style={[styles.pricingRow, styles.pricingRowCOG]}>
              <Text style={styles.pricingRowLabelCOG}>Cost of Goods</Text>
              <Text style={styles.pricingRowValueCOG}>{formatCurrency(perPc(q.cogTotal))}</Text>
              <Text style={styles.pricingRowValueCOG}>{formatCurrency(q.cogTotal)}</Text>
            </View>

            <View style={[styles.pricingRow, styles.pricingRowMarkup]}>
              <Text style={styles.pricingRowLabelMarkup}>Markup ({(q.markupPercentage ?? 0).toFixed(1)}%)</Text>
              <Text style={styles.pricingRowValueMarkup}>{formatCurrency(perPc(q.markupAmount ?? 0))}</Text>
              <Text style={styles.pricingRowValueMarkup}>{formatCurrency(q.markupAmount ?? 0)}</Text>
            </View>

            <View style={styles.pricingDivider} />

            <View style={[styles.pricingRow, styles.pricingRowBold]}>
              <Text style={styles.pricingRowLabelBold}>Subtotal</Text>
              <Text style={styles.pricingRowValueBold}>{formatCurrency(perPc(q.subtotal))}</Text>
              <Text style={styles.pricingRowValueBold}>{formatCurrency(q.subtotal)}</Text>
            </View>

            {q.onlineFee > 0 && (
              <View style={styles.pricingRow}>
                <Text style={styles.pricingRowLabel}>{`Online Fee (${ONLINE_FEE_LABEL})`}</Text>
                <Text style={styles.pricingRowValue}>{formatCurrency(perPc(q.onlineFee))}</Text>
                <Text style={styles.pricingRowValue}>{formatCurrency(q.onlineFee)}</Text>
              </View>
            )}
            {q.cardFee > 0 && (
              <View style={styles.pricingRow}>
                <Text style={styles.pricingRowLabel}>{`Card Fee (${CARD_FEE_LABEL})`}</Text>
                <Text style={styles.pricingRowValue}>{formatCurrency(perPc(q.cardFee))}</Text>
                <Text style={styles.pricingRowValue}>{formatCurrency(q.cardFee)}</Text>
              </View>
            )}
            {q.salesTax > 0 && (
              <View style={styles.pricingRow}>
                <Text style={styles.pricingRowLabel}>{`Sales Tax (${SALES_TAX_LABEL})`}</Text>
                <Text style={styles.pricingRowValue}>{formatCurrency(perPc(q.salesTax))}</Text>
                <Text style={styles.pricingRowValue}>{formatCurrency(q.salesTax)}</Text>
              </View>
            )}
          </View>

          <View style={styles.totalBox}>
            <Text style={styles.totalLabel}>TOTAL</Text>
            <View style={styles.totalDoubleValue}>
              <Text style={styles.totalValueSmall}>{formatCurrency(q.totalPerPiece)}/ea</Text>
              <Text style={styles.totalValue}>{formatCurrency(q.total)}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderSalesTracking = () => {
    if ((quote.status !== 'active' && quote.status !== 'completed') || !quote.salesData) return null;
    const calc = getSalesCalculations();
    const uniqueVendors = quote.salesData.lineItemCosts
      ? [...new Set(quote.salesData.lineItemCosts.map(c => c.productVendor))]
      : quote.salesData.productVendors || [];
    const uniqueApplicators = quote.salesData.lineItemCosts
      ? [...new Set(quote.salesData.lineItemCosts.map(c => c.applicator))]
      : quote.salesData.applicator ? [quote.salesData.applicator] : [];
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sales Tracking</Text>
        <View style={styles.salesTrackingCard}>
          <View style={styles.vendorApplicatorRow}>
            <View style={styles.vendorApplicatorItem}>
              <Text style={styles.vendorApplicatorLabel}>Applicator(s)</Text>
              <Text style={styles.vendorApplicatorValue}>{uniqueApplicators.join(', ') || 'N/A'}</Text>
            </View>
            <View style={styles.vendorApplicatorItem}>
              <Text style={styles.vendorApplicatorLabel}>Source(s)</Text>
              <Text style={styles.vendorApplicatorValue}>{uniqueVendors.join(', ') || 'N/A'}</Text>
            </View>
          </View>

          <View style={styles.salesDatesRow}>
            <View style={styles.salesDateItem}>
              <Text style={styles.salesDateLabel}>Converted</Text>
              <Text style={styles.salesDateValue}>{formatDate(quote.salesData.convertedDate)}</Text>
            </View>
            {quote.salesData.completedDate && (
              <View style={styles.salesDateItem}>
                <Text style={styles.salesDateLabel}>Completed</Text>
                <Text style={styles.salesDateValue}>{formatDate(quote.salesData.completedDate)}</Text>
              </View>
            )}
          </View>

          <View style={styles.salesDivider} />

          {calc && (
            <View style={styles.salesTableContainer}>
              <View style={styles.salesTableHeader}>
                <Text style={styles.salesTableHeaderLabel}></Text>
                <Text style={styles.salesTableHeaderValue}>QUOTED</Text>
                <Text style={styles.salesTableHeaderValue}>ACTUAL</Text>
              </View>
              <View style={styles.salesTableRow}>
                <Text style={styles.salesTableRowLabel}>Product Cost</Text>
                <Text style={styles.salesTableRowValue}>{formatCurrency(quote.calculations.productCostTotal)}</Text>
                <Text style={styles.salesTableRowValue}>{formatCurrency(quote.salesData.actualProductCost)}</Text>
              </View>
              <View style={styles.salesTableRow}>
                <Text style={styles.salesTableRowLabel}>Service Cost</Text>
                <Text style={styles.salesTableRowValue}>{formatCurrency(quote.calculations.serviceCostTotal)}</Text>
                <Text style={styles.salesTableRowValue}>{formatCurrency(quote.salesData.actualServiceCost)}</Text>
              </View>
              <View style={styles.salesTableRow}>
                <Text style={styles.salesTableRowLabel}>Service Fees</Text>
                <Text style={styles.salesTableRowValue}>{formatCurrency(quote.calculations.serviceFeeTotal)}</Text>
                <Text style={styles.salesTableRowValue}>{formatCurrency(quote.salesData.actualServiceFeesCost ?? 0)}</Text>
              </View>
              {quote.salesData.actualOtherCosts > 0 && (
                <View style={styles.salesTableRow}>
                  <Text style={styles.salesTableRowLabel}>Other Costs</Text>
                  <Text style={styles.salesTableRowValue}>{formatCurrency(0)}</Text>
                  <Text style={styles.salesTableRowValue}>{formatCurrency(quote.salesData.actualOtherCosts)}</Text>
                </View>
              )}
              <View style={styles.salesTableDivider} />
              <View style={styles.salesTableRowBold}>
                <Text style={styles.salesTableRowLabelBold}>Cost of Goods</Text>
                <Text style={styles.salesTableRowValueBold}>{formatCurrency(quote.calculations.cogTotal)}</Text>
                <Text style={styles.salesTableRowValueBold}>{formatCurrency(calc.actualCOG)}</Text>
              </View>
              <View style={styles.salesTableRow}>
                <Text style={styles.salesTableRowLabel}>Markup ({(quote.calculations?.markupPercentage ?? 0).toFixed(1)}%)</Text>
                <Text style={styles.salesTableRowValue}>{formatCurrency(quote.calculations.markupAmount)}</Text>
                <Text style={[styles.salesTableRowValue, calc.actualProfit < quote.calculations.markupAmount ? styles.negativeText : styles.positiveText]}>
                  {formatCurrency(calc.actualProfit)}
                </Text>
              </View>
              <View style={styles.salesTableDivider} />
              <View style={styles.salesTableRowBold}>
                <Text style={styles.salesTableRowLabelBold}>Subtotal</Text>
                <Text style={styles.salesTableRowValueBold}>{formatCurrency(quote.calculations.subtotal)}</Text>
                <Text style={styles.salesTableRowValueBold}>{formatCurrency(calc.actualCOG + calc.actualProfit)}</Text>
              </View>
              {calc.onlineFee > 0 && (
                <View style={styles.salesTableRow}>
                  <Text style={styles.salesTableRowLabel}>Online Fee</Text>
                  <Text style={styles.salesTableRowValue}>{formatCurrency(quote.calculations.onlineFee)}</Text>
                  <Text style={styles.salesTableRowValue}>{formatCurrency(calc.onlineFee)}</Text>
                </View>
              )}
              {calc.cardFee > 0 && (
                <View style={styles.salesTableRow}>
                  <Text style={styles.salesTableRowLabel}>Card Fee</Text>
                  <Text style={styles.salesTableRowValue}>{formatCurrency(quote.calculations.cardFee)}</Text>
                  <Text style={styles.salesTableRowValue}>{formatCurrency(calc.cardFee)}</Text>
                </View>
              )}
              {calc.salesTax > 0 && (
                <View style={styles.salesTableRow}>
                  <Text style={styles.salesTableRowLabel}>Sales Tax</Text>
                  <Text style={styles.salesTableRowValue}>{formatCurrency(quote.calculations.salesTax)}</Text>
                  <Text style={styles.salesTableRowValue}>{formatCurrency(calc.salesTax)}</Text>
                </View>
              )}
            </View>
          )}

          {calc && (
            <View style={styles.amountProfitRow}>
              <View style={styles.amountCollectedBoxSide}>
                <Text style={styles.amountCollectedLabelSide}>Amount Collected</Text>
                <Text style={styles.amountCollectedValueSide}>{formatCurrency(quote.salesData.amountCollected)}</Text>
                <Text style={styles.quotedTotalHintSide}>Quoted: {formatCurrency(quote.calculations.total)}</Text>
              </View>
              <View style={[styles.profitBoxSide, calc.actualProfit < 0 && styles.profitBoxNegative]}>
                <Text style={styles.profitLabelSide}>ACTUAL PROFIT</Text>
                <View style={styles.profitValueRowSide}>
                  {calc.actualProfit >= 0 ? <TrendingUp size={16} color="#fff" /> : <TrendingDown size={16} color="#fff" />}
                  <Text style={styles.profitValueSide}>{formatCurrency(calc.actualProfit)}</Text>
                </View>
                <Text style={styles.profitMarginSide}>{calc.actualProfitMargin.toFixed(1)}% margin</Text>
              </View>
            </View>
          )}

          {quote.salesData.notes ? (
            <View style={styles.notesBox}>
              <Text style={styles.notesLabel}>Notes</Text>
              <Text style={styles.notesText}>{quote.salesData.notes}</Text>
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  const opCurrent = ((quote?.operationalStatus as OperationalProjectStatus | null) || null);
  const opOnHold = opCurrent === 'On Hold';
  const opEligible = ['paid', 'active', 'production_started', 'completed'].includes(quote?.status);
  const isOpAdmin = !currentUser || currentUser.role === 'org_admin';

  const opActionOptions: OperationalProjectStatus[] = (() => {
    if (!opCurrent) return [];
    if (isOpAdmin) return OPERATIONAL_STATUSES.filter((s) => s !== opCurrent);
    const next = [...(OPERATIONAL_NEXT[opCurrent] || [])];
    if (!opOnHold && !next.includes('On Hold')) next.push('On Hold');
    return next;
  })();

  // Resume targets: admins can return to any status; non-admins resume into the
  // active workflow only (closeout statuses stay admin-only), matching the
  // role-aware Actions menu.
  const NON_ADMIN_RESUME: OperationalProjectStatus[] = [
    'Accepted', 'Awaiting Artwork', 'Artwork Approval', 'Awaiting Payment',
    'Ready for Production', 'In Production',
  ];
  const opResumeOptions: OperationalProjectStatus[] = isOpAdmin
    ? OPERATIONAL_STATUSES.filter((s) => s !== 'On Hold')
    : NON_ADMIN_RESUME;

  const showOpToast = (msg: string) => { setToastMessage(msg); setToastVisible(true); };

  const handleStartOpTracking = () => {
    if (!quote) return;
    setOperationalStatus({ quoteId: quote.id, status: 'Accepted' });
    showOpToast('Operational tracking started');
  };

  const handleSelectOpAction = (status: OperationalProjectStatus) => {
    setOpMenuVisible(false);
    if (!quote) return;
    if (status === 'On Hold') {
      setHoldReasonDraft(HOLD_REASONS[0]);
      setHoldNotesDraft('');
      setHoldModalVisible(true);
      return;
    }
    setOperationalStatus({ quoteId: quote.id, status });
    showOpToast(`Status updated to ${status}`);
  };

  const handleConfirmHold = () => {
    if (!quote) return;
    if (!holdReasonDraft) { showOpToast('Select a hold reason'); return; }
    setOperationalStatus({
      quoteId: quote.id,
      status: 'On Hold',
      holdReason: holdReasonDraft,
      holdNotes: holdNotesDraft.trim() || null,
    });
    setHoldModalVisible(false);
    showOpToast('Project placed on hold');
  };

  const handleResumeOp = (status: OperationalProjectStatus) => {
    setResumeModalVisible(false);
    if (!quote) return;
    setOperationalStatus({ quoteId: quote.id, status });
    showOpToast(`Resumed to ${status}`);
  };

  const handleSelectDelivery = (method: DeliveryMethod) => {
    if (!quote) return;
    setDeliveryMethod({ quoteId: quote.id, deliveryMethod: quote.deliveryMethod === method ? null : method });
  };

  const handleToggleIndicator = (key: 'paymentReceived' | 'artworkReceived' | 'proofApproved') => {
    if (!quote) return;
    setIndicator({ quoteId: quote.id, key, value: !quote[key] });
  };

  const renderWorkflowCard = () => {
    if (!quote) return null;
    const cfg = opCurrent ? OPERATIONAL_STATUS_CONFIG[opCurrent] : null;
    const indicators: Array<{ key: 'paymentReceived' | 'artworkReceived' | 'proofApproved'; short: string; value: boolean }> = [
      { key: 'paymentReceived', short: 'Payment', value: !!quote.paymentReceived },
      { key: 'artworkReceived', short: 'Artwork', value: !!quote.artworkReceived },
      { key: 'proofApproved', short: 'Proof', value: !!quote.proofApproved },
    ];
    return (
      <View style={[styles.card, styles.workflowCard, isDesktop && styles.workflowCardDesktop]}>
        <View style={opStyles.wfTitleWrap}>
          <Workflow size={14} color={Colors.light.textSecondary} />
          <Text style={styles.contactCardLabel}>PROJECT WORKFLOW</Text>
        </View>

        {/* Status (primary element) + Actions */}
        <View style={opStyles.wfTopRow}>
          {opCurrent && cfg ? (
            <View style={[opStyles.statusPill, { backgroundColor: cfg.bg, borderColor: cfg.borderColor }]}>
              <View style={[opStyles.statusDot, { backgroundColor: cfg.color }]} />
              <Text style={[opStyles.statusPillText, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
          ) : opEligible ? (
            <TouchableOpacity onPress={handleStartOpTracking} disabled={isSettingOperationalStatus}>
              <Text style={opStyles.startLink}>Start tracking</Text>
            </TouchableOpacity>
          ) : (
            <Text style={opStyles.attrMuted}>Not started</Text>
          )}
          {opCurrent ? (
            <TouchableOpacity style={opStyles.actionsBtn} onPress={() => setOpMenuVisible(true)} disabled={isSettingOperationalStatus}>
              <Text style={opStyles.actionsBtnText}>Actions</Text>
              <ChevronDown size={14} color="#fff" />
            </TouchableOpacity>
          ) : null}
        </View>

        {opOnHold ? (
          <View style={opStyles.holdBannerCompact}>
            <AlertCircle size={14} color="#B45309" />
            <View style={{ flex: 1 }}>
              <Text style={opStyles.holdReason}>On Hold — {quote.holdReason || 'Reason not specified'}</Text>
              {quote.holdNotes ? <Text style={opStyles.holdNotes}>{quote.holdNotes}</Text> : null}
              {quote.holdPlacedBy ? (
                <Text style={opStyles.holdMeta}>By {quote.holdPlacedBy}{quote.holdPlacedAt ? ` · ${new Date(quote.holdPlacedAt).toLocaleDateString()}` : ''}</Text>
              ) : null}
            </View>
            <TouchableOpacity style={opStyles.resumeBtn} onPress={() => setResumeModalVisible(true)}>
              <Text style={opStyles.resumeBtnText}>Resume</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Priority + Rush */}
        <View style={opStyles.wfPriorityRow}>
          <Text style={opStyles.wfInlineLabel}>Priority</Text>
          <PriorityControl
            priority={quote.priority}
            onChange={(p) => setPriority({ quoteId: quote.id, priority: p })}
          />
          <TouchableOpacity
            style={[opStyles.wfRushToggle, quote.rush && opStyles.wfRushToggleActive]}
            onPress={() => setRush({ quoteId: quote.id, rush: !quote.rush })}
            activeOpacity={0.7}
          >
            <Text style={[opStyles.wfRushToggleText, quote.rush && opStyles.wfRushToggleTextActive]}>
              {quote.rush ? '🔥 Rush' : 'Mark Rush'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Delivery */}
        <View style={opStyles.wfDeliveryRow}>
          <Text style={opStyles.wfInlineLabel}>Delivery</Text>
          <Text style={opStyles.wfInlineValue}>{quote.deliveryMethod || 'Not set'}</Text>
          <TouchableOpacity onPress={() => setDeliveryEditOpen((v) => !v)} hitSlop={8}>
            <Text style={opStyles.wfChangeLink}>{deliveryEditOpen ? 'Done' : 'Change'}</Text>
          </TouchableOpacity>
        </View>
        {deliveryEditOpen ? (
          <View style={opStyles.wfDeliveryOptions}>
            {DELIVERY_METHODS.map((m) => {
              const active = quote.deliveryMethod === m;
              return (
                <TouchableOpacity key={m} style={[opStyles.miniChip, active && opStyles.miniChipActive]} onPress={() => handleSelectDelivery(m)}>
                  <Text style={[opStyles.miniChipText, active && opStyles.miniChipTextActive]}>{m}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}

        {/* Bottom row: requirements / indicators, compact */}
        <View style={opStyles.wfReqRow}>
          {indicators.map((ind) => (
            <TouchableOpacity key={ind.key} style={opStyles.wfReqItem} onPress={() => handleToggleIndicator(ind.key)} activeOpacity={0.7}>
              <CheckCircle size={14} color={ind.value ? '#16A34A' : '#D1D5DB'} />
              <Text style={opStyles.wfReqLabel}>{ind.short}</Text>
              <Text style={[opStyles.wfReqValue, ind.value && opStyles.wfIndicatorValueOn]}>{ind.value ? 'Yes' : 'No'}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Toast
        visible={toastVisible}
        message={toastMessage}
        type="success"
        onHide={() => setToastVisible(false)}
      />
      <ConfirmDialog
        visible={confirmDeleteVisible}
        title="Are you sure?"
        message={quote ? `Delete "${quote.projectName}"? This cannot be undone.` : ''}
        confirmText="Yes, Delete"
        cancelText="No"
        confirmDestructive
        onConfirm={() => {
          if (quote) { deleteQuote(quote.id); router.replace('/(tabs)/projects'); }
          setConfirmDeleteVisible(false);
        }}
        onCancel={() => setConfirmDeleteVisible(false)}
      />

      <Modal visible={opMenuVisible} transparent animationType="fade" onRequestClose={() => setOpMenuVisible(false)}>
        <TouchableOpacity style={opStyles.modalOverlay} activeOpacity={1} onPress={() => setOpMenuVisible(false)}>
          <View style={opStyles.menuSheet}>
            <Text style={opStyles.menuTitle}>Change Status</Text>
            {opOnHold ? (
              <TouchableOpacity style={opStyles.menuItem} onPress={() => { setOpMenuVisible(false); setResumeModalVisible(true); }}>
                <RotateCcw size={16} color={Colors.light.tint} />
                <Text style={opStyles.menuItemText}>Resume from Hold…</Text>
              </TouchableOpacity>
            ) : null}
            {opActionOptions.map((s) => (
              <TouchableOpacity key={s} style={opStyles.menuItem} onPress={() => handleSelectOpAction(s)}>
                <View style={[opStyles.menuDot, { backgroundColor: OPERATIONAL_STATUS_CONFIG[s].color === '#FFFFFF' ? OPERATIONAL_STATUS_CONFIG[s].bg : OPERATIONAL_STATUS_CONFIG[s].color }]} />
                <Text style={opStyles.menuItemText}>{s}</Text>
              </TouchableOpacity>
            ))}
            {opActionOptions.length === 0 && !opOnHold ? (
              <Text style={opStyles.menuEmpty}>No further actions available.</Text>
            ) : null}
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={holdModalVisible} transparent animationType="fade" onRequestClose={() => setHoldModalVisible(false)}>
        <View style={opStyles.modalOverlayCenter}>
          <View style={opStyles.dialog}>
            <Text style={opStyles.dialogTitle}>Place On Hold</Text>
            <Text style={opStyles.dialogLabel}>Hold Reason</Text>
            <View style={opStyles.chipWrap}>
              {HOLD_REASONS.map((r) => {
                const active = holdReasonDraft === r;
                return (
                  <TouchableOpacity key={r} style={[opStyles.chip, active && opStyles.chipActive]} onPress={() => setHoldReasonDraft(r)}>
                    <Text style={[opStyles.chipText, active && opStyles.chipTextActive]}>{r}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={opStyles.dialogLabel}>Notes (optional)</Text>
            <TextInput
              style={opStyles.notesInput}
              value={holdNotesDraft}
              onChangeText={setHoldNotesDraft}
              placeholder="Add context for the hold…"
              placeholderTextColor="#9CA3AF"
              multiline
            />
            <View style={opStyles.dialogActions}>
              <TouchableOpacity style={[opStyles.dialogBtn, opStyles.dialogBtnGhost]} onPress={() => setHoldModalVisible(false)}>
                <Text style={opStyles.dialogBtnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[opStyles.dialogBtn, opStyles.dialogBtnDanger]} onPress={handleConfirmHold}>
                <Text style={opStyles.dialogBtnDangerText}>Place On Hold</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={resumeModalVisible} transparent animationType="fade" onRequestClose={() => setResumeModalVisible(false)}>
        <View style={opStyles.modalOverlayCenter}>
          <View style={opStyles.dialog}>
            <Text style={opStyles.dialogTitle}>Resume Project</Text>
            <Text style={opStyles.dialogLabel}>Move to status</Text>
            <View style={opStyles.chipWrap}>
              {opResumeOptions.map((s) => (
                <TouchableOpacity key={s} style={opStyles.chip} onPress={() => handleResumeOp(s)}>
                  <Text style={opStyles.chipText}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={opStyles.dialogActions}>
              <TouchableOpacity style={[opStyles.dialogBtn, opStyles.dialogBtnGhost]} onPress={() => setResumeModalVisible(false)}>
                <Text style={opStyles.dialogBtnGhostText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Stack.Screen
        options={{
          title: 'Quote Details',
          headerStyle: { backgroundColor: Colors.light.headerBg },
          headerTintColor: '#fff',
        }}
      />
      <PageBackHeader title="Quote Details" />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {isDesktop ? (
          <View style={styles.desktopLayout}>
            <View style={styles.desktopLeft}>
              {renderIntakeBanner()}
              {renderOrderInfo()}
              {renderLineItems()}
              {renderUploadedArtwork()}
            </View>
            <View style={styles.desktopRight}>
              {renderSendQuotePanel()}
              {quote.status !== 'needs_review' && renderPricingSummary()}
              {(quote.status === 'active' || quote.status === 'production_started' || quote.status === 'completed') && renderSalesTracking()}
            </View>
          </View>
        ) : (
          <View>
            {renderIntakeBanner()}
            {renderOrderInfo()}
            {renderLineItems()}
            {renderUploadedArtwork()}
            {renderSendQuotePanel()}
            {quote.status !== 'needs_review' && renderPricingSummary()}
            {(quote.status === 'active' || quote.status === 'production_started' || quote.status === 'completed') && renderSalesTracking()}
          </View>
        )}
        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Prev / Next navigation strip */}
      <View style={styles.quoteNavStrip}>
        <TouchableOpacity
          style={[styles.quoteNavBtn, !prevQuote && styles.quoteNavBtnDisabled]}
          onPress={goToPrev}
          disabled={!prevQuote}
        >
          <ChevronLeft size={15} color={prevQuote ? Colors.light.tint : Colors.light.border} />
          <Text style={[styles.quoteNavBtnText, !prevQuote && styles.quoteNavBtnTextDisabled]}>
            {prevQuote ? (prevQuote.personOrganization || 'Prev') : 'No Previous'}
          </Text>
        </TouchableOpacity>
        <Text style={styles.quoteNavCount}>{currentIndex + 1} / {allProjects.length}</Text>
        <TouchableOpacity
          style={[styles.quoteNavBtn, !nextQuote && styles.quoteNavBtnDisabled]}
          onPress={goToNext}
          disabled={!nextQuote}
        >
          <Text style={[styles.quoteNavBtnText, !nextQuote && styles.quoteNavBtnTextDisabled]}>
            {nextQuote ? (nextQuote.personOrganization || 'Next') : 'No Next'}
          </Text>
          <ChevronRight size={15} color={nextQuote ? Colors.light.tint : Colors.light.border} />
        </TouchableOpacity>
      </View>

      <View style={styles.actionBar}>
        <View style={[styles.actionBarInner, isMobile && styles.actionBarInnerMobile]}>
          <TouchableOpacity style={styles.iconButton} onPress={() => setMenuVisible(true)}>
            <MoreVertical size={18} color={Colors.light.tint} />
            <Text style={styles.iconButtonLabel}>More</Text>
          </TouchableOpacity>

          {quote.status === 'needs_review' ? (
            <>
              <TouchableOpacity style={[styles.actionBtn, styles.actionBtnOutline, { flex: 1 }]} onPress={handleEdit}>
                <Edit3 size={17} color={Colors.light.tint} />
                <Text style={styles.actionBtnOutlineText}>Edit Quote</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.actionBtnSolid, { flex: 1 }]} onPress={handleStartQuote}>
                <ArrowRight size={17} color="#fff" />
                <Text style={styles.actionBtnSolidText}>Start Quoting</Text>
              </TouchableOpacity>
            </>
          ) : quote.status === 'quoting' ? (
            <>
              <TouchableOpacity style={[styles.actionBtn, styles.actionBtnOutline, { flex: 1 }]} onPress={handleEdit}>
                <Edit3 size={17} color={Colors.light.tint} />
                <Text style={styles.actionBtnOutlineText}>Edit Quote</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnSolid, { flex: 1 }, (!isReadyToSend || isSendingQuote) && { opacity: 0.5 }]}
                onPress={handleMarkQuoteSent}
                disabled={isSendingQuote}
              >
                <Send size={17} color="#fff" />
                <Text style={styles.actionBtnSolidText}>{isSendingQuote ? 'Sending…' : 'Send Quote'}</Text>
              </TouchableOpacity>
            </>
          ) : (quote.status === 'quoted' || quote.status === 'invoice_sent') ? (
            <>
              <TouchableOpacity style={[styles.actionBtn, styles.actionBtnOutline, { flex: 1 }]} onPress={handleCopyQuoteLink}>
                <Copy size={17} color={Colors.light.tint} />
                <Text style={styles.actionBtnOutlineText}>{quoteLinkCopied ? 'Copied!' : 'Copy Link'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.actionBtnSolid, { flex: 1, backgroundColor: Colors.light.success }]} onPress={handleMarkPaid}>
                <CheckCircle size={17} color="#fff" />
                <Text style={styles.actionBtnSolidText}>Mark as Paid</Text>
              </TouchableOpacity>
            </>
          ) : quote.status === 'paid' ? (
            <>
              <TouchableOpacity style={[styles.actionBtn, styles.actionBtnOutline, { flex: 1 }]} onPress={handleEdit}>
                <Edit3 size={17} color={Colors.light.tint} />
                <Text style={styles.actionBtnOutlineText}>Edit Quote</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.actionBtnSolid, { flex: 1 }]} onPress={handleStartProduction}>
                <Flame size={17} color="#fff" />
                <Text style={styles.actionBtnSolidText}>Start Production</Text>
              </TouchableOpacity>
            </>
          ) : quote.status === 'production_started' ? (
            <>
              {quote.isLocked ? (
                <View style={[styles.actionBtn, styles.actionBtnSolid, { backgroundColor: '#6b7280', flex: 1 }]}>
                  <Lock size={17} color="#fff" />
                  <Text style={styles.actionBtnSolidText}>Locked</Text>
                </View>
              ) : (
                <TouchableOpacity style={[styles.actionBtn, styles.actionBtnOutline, { flex: 1 }]} onPress={handleTrackSales}>
                  <ClipboardList size={17} color={Colors.light.tint} />
                  <Text style={styles.actionBtnOutlineText}>Track Costs</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[styles.actionBtn, styles.actionBtnSolid, { flex: 1 }]} onPress={handleOpenProduction}>
                <Flame size={17} color="#fff" />
                <Text style={styles.actionBtnSolidText}>Production Mode</Text>
              </TouchableOpacity>
            </>
          ) : (quote.status === 'active' || quote.status === 'completed') ? (
            <>
              {quote.isLocked ? (
                <View style={[styles.actionBtn, styles.actionBtnSolid, { backgroundColor: '#6b7280', flex: 1 }]}>
                  <Lock size={17} color="#fff" />
                  <Text style={styles.actionBtnSolidText}>Locked</Text>
                </View>
              ) : (
                <TouchableOpacity style={[styles.actionBtn, styles.actionBtnOutline, { flex: 1 }]} onPress={handleTrackSales}>
                  <ClipboardList size={17} color={Colors.light.tint} />
                  <Text style={styles.actionBtnOutlineText}>Track Costs</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[styles.actionBtn, styles.actionBtnSolid, { flex: 1 }]} onPress={handleOpenProduction}>
                <Flame size={17} color="#fff" />
                <Text style={styles.actionBtnSolidText}>Production Mode</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity style={[styles.actionBtn, styles.actionBtnOutline, { flex: 1 }]} onPress={handleEdit}>
                <Edit3 size={17} color={Colors.light.tint} />
                <Text style={styles.actionBtnOutlineText}>Edit Quote</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.actionBtnSolid, { flex: 1 }]} onPress={handleMarkQuoteSent} disabled={isSendingQuote}>
                <Send size={17} color="#fff" />
                <Text style={styles.actionBtnSolidText}>Send Quote</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {menuVisible && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
          <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setMenuVisible(false)}>
            <View style={styles.menuContainer}>
              <View style={styles.menuHeader}>
                <Text style={styles.menuTitle}>Options</Text>
                <TouchableOpacity onPress={() => setMenuVisible(false)}>
                  <X size={20} color={Colors.light.text} />
                </TouchableOpacity>
              </View>

              {quote.status === 'needs_review' ? (
                <>
                  <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); handleEdit(); }}>
                    <Edit3 size={18} color={Colors.light.text} />
                    <Text style={styles.menuItemText}>Edit Request</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); handleStartQuote(); }}>
                    <ArrowRight size={18} color={Colors.light.tint} />
                    <Text style={[styles.menuItemText, { color: Colors.light.tint }]}>Start Quoting</Text>
                  </TouchableOpacity>
                  <View style={styles.menuSeparator} />
                  {renderDocumentExports()}
                  <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); handlePrint(); }}>
                    <Printer size={18} color={Colors.light.text} />
                    <Text style={styles.menuItemText}>Print</Text>
                  </TouchableOpacity>
                  <View style={styles.menuSeparator} />
                  <TouchableOpacity style={[styles.menuItem, styles.menuItemLast]} onPress={handleDelete}>
                    <Trash2 size={18} color={Colors.light.error} />
                    <Text style={[styles.menuItemText, { color: Colors.light.error }]}>Delete</Text>
                  </TouchableOpacity>
                </>
              ) : (quote.status === 'quoting' || quote.status === 'quoted' || quote.status === 'invoice_sent') ? (
                <>
                  <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); handleEdit(); }}>
                    <Edit3 size={18} color={Colors.light.text} />
                    <Text style={styles.menuItemText}>Edit Quote</Text>
                  </TouchableOpacity>
                  {(quote.status === 'quoted' || quote.status === 'invoice_sent') && (
                    <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); handleMarkPaid(); }}>
                      <CheckCircle size={18} color="#16A34A" />
                      <Text style={[styles.menuItemText, { color: '#16A34A' }]}>Mark as Paid</Text>
                    </TouchableOpacity>
                  )}
                  <View style={styles.menuSeparator} />
                  {renderDocumentExports()}
                  <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); handlePrint(); }}>
                    <Printer size={18} color={Colors.light.text} />
                    <Text style={styles.menuItemText}>Print</Text>
                  </TouchableOpacity>
                  <View style={styles.menuSeparator} />
                  <TouchableOpacity style={[styles.menuItem, styles.menuItemLast]} onPress={handleDelete}>
                    <Trash2 size={18} color={Colors.light.error} />
                    <Text style={[styles.menuItemText, { color: Colors.light.error }]}>Delete</Text>
                  </TouchableOpacity>
                </>
              ) : quote.status === 'paid' ? (
                <>
                  <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); handleEdit(); }}>
                    <Edit3 size={18} color={Colors.light.text} />
                    <Text style={styles.menuItemText}>Edit Quote</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); handleStartProduction(); }}>
                    <Flame size={18} color={Colors.light.tint} />
                    <Text style={[styles.menuItemText, { color: Colors.light.tint }]}>Start Production</Text>
                  </TouchableOpacity>
                  <View style={styles.menuSeparator} />
                  {renderDocumentExports()}
                  <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); handleDownloadWorkOrder(); }}>
                    <FileText size={18} color={Colors.light.tint} />
                    <Text style={[styles.menuItemText, { color: Colors.light.tint }]}>Download Work Order</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); handlePrint(); }}>
                    <Printer size={18} color={Colors.light.text} />
                    <Text style={styles.menuItemText}>Print</Text>
                  </TouchableOpacity>
                  <View style={styles.menuSeparator} />
                  <TouchableOpacity style={[styles.menuItem, styles.menuItemLast]} onPress={handleDelete}>
                    <Trash2 size={18} color={Colors.light.error} />
                    <Text style={[styles.menuItemText, { color: Colors.light.error }]}>Delete</Text>
                  </TouchableOpacity>
                </>
              ) : (quote.status === 'active' || quote.status === 'production_started' || quote.status === 'completed') ? (
                <>
                  {!quote.isLocked ? (
                    <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); handleEdit(); }}>
                      <Edit3 size={18} color={Colors.light.text} />
                      <Text style={styles.menuItemText}>Edit Quote</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.menuItem}>
                      <Lock size={18} color={Colors.light.textSecondary} />
                      <Text style={[styles.menuItemText, { color: Colors.light.textSecondary }]}>Project is Locked</Text>
                    </View>
                  )}
                  {!quote.isLocked && (
                    <TouchableOpacity style={styles.menuItem} onPress={handleRevertToQuote}>
                      <RotateCcw size={18} color={Colors.light.textSecondary} />
                      <Text style={[styles.menuItemText, { color: Colors.light.textSecondary }]}>Revert to Quoted</Text>
                    </TouchableOpacity>
                  )}
                  <View style={styles.menuSeparator} />
                  {renderDocumentExports()}
                  <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); handleDownloadWorkOrder(); }}>
                    <FileText size={18} color={Colors.light.tint} />
                    <Text style={[styles.menuItemText, { color: Colors.light.tint }]}>Download Work Order</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); handleExportToSheets(); }}>
                    <Sheet size={18} color={Colors.light.success} />
                    <Text style={[styles.menuItemText, { color: Colors.light.success }]}>Export to Sheets</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); handlePrint(); }}>
                    <Printer size={18} color={Colors.light.text} />
                    <Text style={styles.menuItemText}>Print</Text>
                  </TouchableOpacity>
                  <View style={styles.menuSeparator} />
                  {!quote.isLocked && (
                    <TouchableOpacity style={[styles.menuItem, styles.menuItemLast]} onPress={handleDelete}>
                      <Trash2 size={18} color={Colors.light.error} />
                      <Text style={[styles.menuItemText, { color: Colors.light.error }]}>Delete</Text>
                    </TouchableOpacity>
                  )}
                </>
              ) : (
                <>
                  <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); handleEdit(); }}>
                    <Edit3 size={18} color={Colors.light.text} />
                    <Text style={styles.menuItemText}>Edit Quote</Text>
                  </TouchableOpacity>
                  <View style={styles.menuSeparator} />
                  {renderDocumentExports()}
                  <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); handlePrint(); }}>
                    <Printer size={18} color={Colors.light.text} />
                    <Text style={styles.menuItemText}>Print</Text>
                  </TouchableOpacity>
                  <View style={styles.menuSeparator} />
                  <TouchableOpacity style={[styles.menuItem, styles.menuItemLast]} onPress={handleDelete}>
                    <Trash2 size={18} color={Colors.light.error} />
                    <Text style={[styles.menuItemText, { color: Colors.light.error }]}>Delete</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  notFound: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notFoundText: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    marginTop: 12,
  },
  backBtn: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: Colors.light.tint,
    borderRadius: 8,
  },
  backBtnText: {
    color: '#fff',
    fontWeight: '600' as const,
  },
  orderDivider: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginTop: 'auto' as const,
    marginBottom: 12,
  },
  identityRow: {
    flexDirection: 'column' as const,
    gap: 12,
  },
  identityRowDesktop: {
    flexDirection: 'row' as const,
    alignItems: 'stretch' as const,
  },
  identityCard: {
    flex: 1,
    minWidth: 0,
  },
  identityProjectName: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.light.text,
    lineHeight: 28,
  },
  identityOrgLink: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    marginTop: 4,
    alignSelf: 'flex-start' as const,
  },
  identityOrgName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.light.text,
    marginTop: 4,
  },
  identityMetaRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
    marginTop: 8,
  },
  identityQuoteNum: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
  },
  identityMetaDot: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  identityStatus: {
    fontSize: 13,
    fontWeight: '700' as const,
  },
  identityDatesRow: {
    flexDirection: 'row' as const,
    gap: 36,
  },
  identityDateBlock: {},
  identityDateLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.light.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  identityDateValue: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  contactCard: {
    alignSelf: 'stretch' as const,
  },
  contactCardDesktop: {
    flex: 1,
    minWidth: 0,
    alignSelf: 'stretch' as const,
  },
  contactCardLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.light.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  contactCardName: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  contactCardRole: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginTop: 2,
    marginBottom: 10,
  },
  contactCardEmpty: {
    fontWeight: '500' as const,
    color: Colors.light.textSecondary,
  },
  contactCardRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 8,
    marginTop: 6,
  },
  contactCardInfo: {
    fontSize: 13,
    color: Colors.light.text,
    flex: 1,
    lineHeight: 18,
  },
  workflowCard: {
    alignSelf: 'stretch' as const,
  },
  workflowCardDesktop: {
    flex: 1,
    minWidth: 0,
    alignSelf: 'stretch' as const,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginBottom: 10,
  },
  card: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  sectionHeaderRow: {
    marginBottom: 10,
  },
  desktopLayout: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-start',
  },
  desktopLeft: {
    flex: 1,
    minWidth: 0,
  },
  desktopRight: {
    width: 380,
  },
  lineItemCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    overflow: 'hidden',
  },
  lineItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111111',
    padding: 14,
    gap: 10,
  },
  lineItemHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  lineItemHeaderInfo: {
    flex: 1,
    minWidth: 0,
  },
  lineItemHeaderName: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#fff',
  },
  lineItemHeaderSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 1,
  },
  lineItemHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  lineItemHeaderQty: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.light.tint,
  },
  lineItemNumber: {
    backgroundColor: Colors.light.tint,
    color: '#fff',
    fontSize: 11,
    fontWeight: '700' as const,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
    flexShrink: 0,
  },
  lineItemBody: {
    padding: 12,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  lineItemBodyMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  lineItemDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    width: 72,
    flexShrink: 0,
    marginTop: 1,
  },
  detailValue: {
    fontSize: 14,
    color: Colors.light.text,
    flex: 1,
    lineHeight: 20,
  },
  detailValueMuted: {
    color: Colors.light.textSecondary,
  },
  applicatorValue: {
    color: Colors.light.tint,
    fontWeight: '600' as const,
  },
  lineItemSubtotalBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  lineItemSubtotalLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.tint,
  },
  lineItemSubtotalRight: {
    alignItems: 'flex-end',
  },
  lineItemSubtotalPer: {
    fontSize: 11,
    color: Colors.light.textSecondary,
  },
  lineItemSubtotalValue: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.light.tint,
  },
  sizesBox: {
    backgroundColor: Colors.light.highlightBg,
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
  },
  sizesLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.light.tint,
    marginBottom: 4,
  },
  sizesValue: {
    fontSize: 13,
    color: Colors.light.text,
  },
  totalQty: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
    marginTop: 4,
  },
  costsBox: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  costItem: {
    flex: 1,
    backgroundColor: Colors.light.background,
    borderRadius: 6,
    padding: 8,
    alignItems: 'center',
  },
  costLabel: {
    fontSize: 11,
    color: Colors.light.textSecondary,
  },
  costValue: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.text,
    marginTop: 2,
  },
  summaryCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  summaryLabel: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  summaryValue: {
    fontSize: 14,
    color: Colors.light.text,
  },
  summaryLabelBold: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  summaryValueBold: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  summaryDoubleValue: {
    flexDirection: 'row',
    gap: 24,
  },
  pricingTable: {
    backgroundColor: Colors.light.background,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  pricingTableHeader: {
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    marginBottom: 4,
  },
  pricingTHLabel: {
    flex: 1.5,
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase' as const,
  },
  pricingTHValue: {
    flex: 1,
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase' as const,
    textAlign: 'right' as const,
  },
  pricingRow: {
    flexDirection: 'row',
    paddingVertical: 5,
  },
  pricingRowLabel: {
    flex: 1.5,
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  pricingRowValue: {
    flex: 1,
    fontSize: 13,
    color: Colors.light.text,
    textAlign: 'right' as const,
  },
  pricingRowCOG: {
    backgroundColor: Colors.light.highlightBg,
    marginHorizontal: -12,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.light.tint,
    marginTop: 4,
  },
  pricingRowLabelCOG: {
    flex: 1.5,
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.light.tint,
  },
  pricingRowValueCOG: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.light.tint,
    textAlign: 'right' as const,
  },
  pricingRowMarkup: {
    backgroundColor: Colors.light.highlightBg,
    marginHorizontal: -12,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.light.tint,
  },
  pricingRowLabelMarkup: {
    flex: 1.5,
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.light.tint,
  },
  pricingRowValueMarkup: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.light.tint,
    textAlign: 'right' as const,
  },
  pricingDivider: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginVertical: 8,
  },
  pricingRowBold: {},
  pricingRowLabelBold: {
    flex: 1.5,
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  pricingRowValueBold: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.light.text,
    textAlign: 'right' as const,
  },
  totalDoubleValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 16,
  },
  totalValueSmall: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.8)',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginVertical: 8,
  },
  totalBox: {
    backgroundColor: Colors.light.tint,
    borderRadius: 10,
    padding: 14,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
  totalValue: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#fff',
  },
  perPieceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.3)',
  },
  perPieceLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },
  perPieceValue: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#fff',
  },
  bottomPadding: {
    height: 100,
  },
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: Colors.light.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    alignItems: 'center',
  },
  actionBarInner: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    maxWidth: 480,
  },
  actionBarInnerMobile: {
    flexWrap: 'wrap',
    rowGap: 10,
  },
  iconButton: {
    width: 48,
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.light.tint,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'column',
    gap: 1,
    paddingVertical: 6,
  },
  iconButtonLabel: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: Colors.light.tint,
    letterSpacing: 0.5,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 7,
  },
  actionBtnSolid: {
    backgroundColor: Colors.light.tint,
  },
  actionBtnOutline: {
    borderWidth: 1.5,
    borderColor: Colors.light.tint,
  },
  actionBtnSolidText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#fff',
  },
  actionBtnOutlineText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.light.tint,
  },
  quoteNavStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.light.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  quoteNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    maxWidth: '40%',
  },
  quoteNavBtnDisabled: { opacity: 0.35 },
  quoteNavBtnText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.light.tint,
    flexShrink: 1,
  },
  quoteNavBtnTextDisabled: { color: Colors.light.border },
  quoteNavCount: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    fontWeight: '500' as const,
  },
  lineItemTopRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },
  lineItemMobileMockupRow: {
    width: '100%' as const,
    height: 200,
    backgroundColor: '#F1F5F9',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    overflow: 'hidden' as const,
  },
  lineItemMockupCol: {
    flex: 1,
    flexShrink: 0,
    alignSelf: 'flex-start',
  },
  lineItemMockupColMobile: {
    flex: 0,
    width: '100%',
    alignSelf: 'stretch',
  },
  lineItemRightCol: {
    flex: 2,
    minWidth: 0,
  },
  lineItemDetailsCol: {
    minWidth: 0,
    gap: 8,
    marginBottom: 10,
  },
  mockupImage: {
    width: '100%',
    height: 220,
    borderRadius: 8,
    backgroundColor: Colors.light.background,
  },
  mockupPlaceholder: {
    height: 220,
    width: '100%',
    borderRadius: 8,
    backgroundColor: Colors.light.background,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  mockupPlaceholderText: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  variantSizeHeading: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginBottom: 4,
  },
  sizesGridSection: {
    backgroundColor: Colors.light.background,
    borderRadius: 10,
    marginBottom: 10,
    overflow: 'hidden' as const,
  },
  variantSectionHeader: {
    backgroundColor: '#111',
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  variantSectionHeaderText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#fff',
    flex: 1,
  },
  variantSectionContent: {
    padding: 12,
  },
  variantMetaRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 6,
    marginBottom: 6,
  },
  variantMetaLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
    width: 90,
    flexShrink: 0,
  },
  variantMetaValue: {
    fontSize: 11,
    color: Colors.light.text,
    flex: 1,
    flexWrap: 'wrap' as const,
  },
  sizesGridLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.light.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  sizesGridRow: {
    flexDirection: 'row',
    gap: 6,
  },
  sizeGridCell: {
    flex: 1,
    alignItems: 'center',
  },
  sizeGridCellLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
    marginBottom: 4,
  },
  sizeGridCellBox: {
    width: '100%',
    height: 36,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.tint,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sizeGridCellBoxEmpty: {
    borderColor: Colors.light.border,
  },
  sizeGridCellValue: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  sizeGridCellValueEmpty: {
    color: Colors.light.border,
    fontWeight: '400' as const,
  },
  sizesGridTotal: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
    marginTop: 8,
    textAlign: 'right',
  },
  lineItemTotalsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.light.tint,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  lineItemTotalsText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#fff',
  },
  lineItemTotalsDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  menuSeparator: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginVertical: 4,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  menuContainer: {
    backgroundColor: Colors.light.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 34,
  },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  menuTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  menuItemText: {
    fontSize: 16,
    color: Colors.light.text,
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  amountProfitRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  amountCollectedBoxSide: {
    flex: 1,
    backgroundColor: '#111111',
    borderRadius: 8,
    padding: 12,
  },
  amountCollectedLabelSide: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.light.tint,
    marginBottom: 4,
  },
  amountCollectedValueSide: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  quotedTotalHintSide: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 4,
  },
  profitBoxSide: {
    flex: 1,
    backgroundColor: Colors.light.success,
    borderRadius: 8,
    padding: 12,
    justifyContent: 'center',
  },
  profitLabelSide: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 2,
  },
  profitValueRowSide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  profitValueSide: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#fff',
  },
  profitMarginSide: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  profitBox: {
    backgroundColor: Colors.light.success,
    borderRadius: 10,
    padding: 14,
    marginTop: 12,
  },
  profitBoxNegative: {
    backgroundColor: Colors.light.error,
  },
  profitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  profitLabel: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#fff',
  },
  profitValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  profitValue: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#fff',
  },
  profitMargin: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
    textAlign: 'right' as const,
  },
  comparisonBox: {
    backgroundColor: Colors.light.highlightBg,
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  comparisonTitle: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.light.tint,
    marginBottom: 8,
  },
  comparisonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  comparisonLabel: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  comparisonValue: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  positiveText: {
    color: Colors.light.success,
  },
  negativeText: {
    color: Colors.light.error,
  },
  summaryLabelMuted: {
    color: Colors.light.border,
  },
  summaryValueMuted: {
    color: Colors.light.border,
  },
  salesTrackingCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  vendorApplicatorRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  vendorApplicatorItem: {
    flex: 1,
  },
  vendorApplicatorLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase' as const,
    marginBottom: 4,
  },
  vendorApplicatorValue: {
    fontSize: 13,
    color: Colors.light.text,
    fontWeight: '500' as const,
  },
  salesDatesRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  salesDateItem: {
    flex: 1,
  },
  salesDateLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase' as const,
    marginBottom: 4,
  },
  salesDateValue: {
    fontSize: 13,
    color: Colors.light.text,
    fontWeight: '500' as const,
  },
  salesDivider: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginBottom: 12,
  },
  amountCollectedBox: {
    backgroundColor: Colors.light.highlightBg,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  amountCollectedLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.light.tint,
    marginBottom: 4,
  },
  amountCollectedValue: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  quotedTotalHint: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 4,
  },
  salesTableContainer: {
    backgroundColor: Colors.light.background,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  salesTableHeader: {
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    marginBottom: 4,
  },
  salesTableHeaderLabel: {
    flex: 1.5,
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase' as const,
  },
  salesTableHeaderValue: {
    flex: 1,
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase' as const,
    textAlign: 'right' as const,
  },
  salesTableRow: {
    flexDirection: 'row',
    paddingVertical: 5,
  },
  salesTableRowMuted: {},
  salesTableRowLabel: {
    flex: 1.5,
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  salesTableRowLabelMuted: {
    color: Colors.light.border,
  },
  salesTableRowValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.light.text,
    textAlign: 'right' as const,
  },
  salesTableRowValueMuted: {
    color: Colors.light.border,
  },
  salesTableDivider: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginVertical: 8,
  },
  salesTableRowBold: {
    flexDirection: 'row',
    paddingVertical: 5,
  },
  salesTableRowLabelBold: {
    flex: 1.5,
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  salesTableRowValueBold: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.light.text,
    textAlign: 'right' as const,
  },
  profitDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  profitDiff: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.9)',
  },
  notesBox: {
    marginTop: 4,
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
    marginBottom: 4,
  },
  notesText: {
    fontSize: 14,
    color: Colors.light.text,
    lineHeight: 20,
  },
  intakeBanner: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 4,
  },
  intakeBannerHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginBottom: 8,
  },
  intakeBannerTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#FF5A00',
  },
  intakeBannerText: {
    fontSize: 13,
    color: '#92400E',
    lineHeight: 19,
    marginBottom: 12,
  },
  intakeBannerActions: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  intakeBannerBtn: {
    backgroundColor: '#FF5A00',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 18,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    alignSelf: 'flex-start' as const,
  },
  intakeBannerBtnText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#fff',
  },
  sendQuotePanel: {
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 14,
    padding: 16,
    margin: 16,
  },
  pricingRequiredBanner: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 7,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
  },
  pricingRequiredText: {
    flex: 1,
    fontSize: 12,
    color: '#92400E',
    lineHeight: 17,
  },
  sendQuotePanelHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginBottom: 10,
  },
  sendQuotePanelTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  sentStatusRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginBottom: 8,
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: 'flex-start' as const,
  },
  sentStatusText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#16A34A',
  },
  sendQuotePanelSub: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    lineHeight: 17,
    marginBottom: 10,
  },
  urlBox: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 12,
  },
  urlText: {
    fontSize: 11,
    color: '#374151',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  sendQuoteActions: {
    flexDirection: 'row' as const,
    gap: 8,
  },
  sendQuoteBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
  },
  sendQuoteBtnOutline: {
    borderWidth: 1,
    borderColor: '#FF5A00',
    backgroundColor: '#fff',
  },
  sendQuoteBtnOutlineText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#FF5A00',
  },
  sendQuoteBtnSolid: {
    backgroundColor: '#FF5A00',
  },
  sendQuoteBtnSolidText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#fff',
  },
  markPaidBtn: {
    backgroundColor: '#16A34A',
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 16,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 7,
    marginTop: 10,
  },
  markPaidBtnText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#fff',
  },

  // Wave invoice link styles
  waveSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#EDE9FE',
    gap: 8,
  },
  waveSectionHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  waveSectionTitle: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#7C3AED',
    flex: 1,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.4,
  },
  waveSavedPill: {
    backgroundColor: '#EDE9FE',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  waveSavedPillText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#7C3AED',
  },
  waveSectionSub: {
    fontSize: 11,
    color: '#6B7280',
    lineHeight: 16,
  },
  waveLinkInputRow: {
    flexDirection: 'row' as const,
    gap: 8,
    alignItems: 'center' as const,
  },
  waveLinkInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#DDD6FE',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: '#111827',
    backgroundColor: '#FAFAFA',
  },
  waveLinkSaveBtn: {
    backgroundColor: '#7C3AED',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    minWidth: 54,
  },
  waveLinkSaveBtnText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#fff',
  },
  waveActionsRow: {
    flexDirection: 'row' as const,
    gap: 8,
  },
  waveActionBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    backgroundColor: '#F5F3FF',
  },
  waveActionBtnText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#7C3AED',
  },
});

const koArtStyles = StyleSheet.create({
  grid: {
    gap: 8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E2E',
    borderRadius: 10,
    padding: 10,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  preview: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  previewImg: {
    width: 48,
    height: 48,
  },
  typeBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  typeLabel: {
    fontSize: 9,
    fontWeight: '800' as const,
    color: '#FF5A00',
    letterSpacing: 0.5,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  fileName: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#fff',
    lineHeight: 16,
  },
  fileMeta: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
  },
  actions: {
    flexDirection: 'row' as const,
    gap: 6,
    flexShrink: 0,
  },
  actionBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  actionBtnText: {
    fontSize: 11,
    color: '#60A5FA',
    fontWeight: '500' as const,
  },
  actionBtnTextMuted: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500' as const,
  },
});

const opStyles = StyleSheet.create({
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  actionsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  actionsBtnText: { color: '#fff', fontWeight: '600' as const, fontSize: 12 },
  attrMuted: { fontSize: 13, color: '#9CA3AF' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusPillText: { fontSize: 12, fontWeight: '700' as const },
  startLink: { fontSize: 13, color: Colors.light.tint, fontWeight: '600' as const },
  holdBannerCompact: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
  },
  holdReason: { fontSize: 12, fontWeight: '700' as const, color: '#92400E' },
  holdNotes: { fontSize: 12, color: '#78350F', marginTop: 2 },
  holdMeta: { fontSize: 11, color: '#A16207', marginTop: 4 },
  resumeBtn: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D97706',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  resumeBtnText: { color: '#B45309', fontWeight: '600' as const, fontSize: 12 },
  miniChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.light.tint,
    backgroundColor: '#fff',
  },
  miniChipActive: { backgroundColor: Colors.light.tint, borderColor: Colors.light.tint },
  miniChipText: { fontSize: 12, color: Colors.light.tint, fontWeight: '600' as const },
  miniChipTextActive: { color: '#fff' },
  wfTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  wfSectionLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#9CA3AF',
    letterSpacing: 0.5,
    marginTop: 14,
    marginBottom: 8,
  },
  wfTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  wfDeliveryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
  },
  wfPriorityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  wfRushToggle: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  wfRushToggleActive: { borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' },
  wfRushToggleText: { fontSize: 12, fontWeight: '700' as const, color: '#6B7280' },
  wfRushToggleTextActive: { color: '#DC2626' },
  wfInlineLabel: { fontSize: 13, fontWeight: '600' as const, color: '#6B7280' },
  wfInlineValue: { fontSize: 13, fontWeight: '700' as const, color: Colors.light.text, flex: 1 },
  wfChangeLink: { fontSize: 12, fontWeight: '600' as const, color: Colors.light.tint },
  wfDeliveryOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  wfReqRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  wfReqItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexGrow: 1,
  },
  wfReqLabel: { fontSize: 13, fontWeight: '600' as const, color: '#374151' },
  wfReqValue: { fontSize: 13, fontWeight: '700' as const, color: '#9CA3AF' },
  statusPillLeft: { alignSelf: 'flex-start' as const },
  wfChipsLeft: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  wfIndicatorsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
  wfIndicator: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wfIndicatorText: { gap: 1 },
  wfIndicatorLabel: { fontSize: 13, fontWeight: '600' as const, color: '#374151' },
  wfIndicatorValue: { fontSize: 12, color: '#9CA3AF', fontWeight: '500' as const },
  wfIndicatorValueOn: { color: '#16A34A' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.light.tint,
    backgroundColor: '#fff',
  },
  chipActive: { backgroundColor: Colors.light.tint, borderColor: Colors.light.tint },
  chipText: { fontSize: 13, color: Colors.light.tint, fontWeight: '600' as const },
  chipTextActive: { color: '#fff' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalOverlayCenter: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  menuSheet: {
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 8,
    width: 280,
    maxWidth: '100%',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  menuTitle: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  menuDot: { width: 9, height: 9, borderRadius: 5 },
  menuItemText: { fontSize: 14, color: '#111827', fontWeight: '500' as const },
  menuEmpty: { fontSize: 13, color: '#9CA3AF', paddingHorizontal: 16, paddingVertical: 10 },
  dialog: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: 420,
    maxWidth: '100%',
  },
  dialogTitle: { fontSize: 17, fontWeight: '700' as const, color: '#111827', marginBottom: 14 },
  dialogLabel: { fontSize: 12, fontWeight: '700' as const, color: '#6B7280', marginBottom: 8 },
  notesInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    minHeight: 70,
    textAlignVertical: 'top',
    marginBottom: 14,
  },
  dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
  dialogBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  dialogBtnGhost: { backgroundColor: '#F3F4F6' },
  dialogBtnGhostText: { color: '#374151', fontWeight: '600' as const, fontSize: 13 },
  dialogBtnDanger: { backgroundColor: '#DC2626' },
  dialogBtnDangerText: { color: '#fff', fontWeight: '600' as const, fontSize: 13 },
});
