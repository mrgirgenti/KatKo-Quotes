import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import ProjectDocument from '@/components/ProjectDocument';
import { buildProjectDocumentHTML } from '@/utils/projectDocumentHtml';
import { htmlToPdf } from '@/utils/htmlToPdf';
import {
  CheckCircle,
  FileText,
  Download,
  MessageCircle,
  CreditCard,
  ExternalLink,
} from 'lucide-react-native';

const BRAND = '#FF5A00';
const BORDER = '#E5E7EB';
const TEXT = '#111827';
const TEXT_MED = '#374151';
const TEXT_LIGHT = '#6B7280';
const TEXT_PLACEHOLDER = '#9CA3AF';
const BG = '#F3F4F6';

function formatCurrency(n: number | null | undefined): string {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = bytes; let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function fmtDate(d: string | null | undefined): string | null {
  if (!d) return null;
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return d; }
}

interface ClientQuoteData {
  id: string;
  projectName: string;
  clientName: string;
  orgName: string;
  orderType: string;
  inHandsDate: string;
  notesClient: string;
  quoteSentAt: string | null;
  waveInvoiceLink: string | null;
  status: string;
  lineItems: Array<{
    id: string;
    designName: string;
    product: string;
    productColor: string;
    serviceStyle: string;
    location1: string;
    location2: string;
    location3: string;
    location4: string;
    locationDetails: string;
    sizes: Record<string, number>;
    garmentVariants: Array<{ product: string; color: string; sizes: Record<string, number> }>;
    mockups: string[];
  }>;
  files: Array<{
    id: string;
    originalName: string;
    mimeType: string | null;
    fileSize: number | null;
    url: string;
    inlineUrl: string;
  }>;
  subtotal: number | null;
  onlineFee: number | null;
  cardFee: number | null;
  salesTax: number | null;
  shipping: number | null;
  rushFee: number | null;
  total: number | null;
  totalPerPiece: number | null;
  hasCalculations: boolean;
}

function buildPricingRows(q: Pick<ClientQuoteData,
  'subtotal' | 'onlineFee' | 'cardFee' | 'salesTax' | 'shipping' | 'rushFee'
>): Array<{ label: string; value: number }> {
  const rows: Array<{ label: string; value: number }> = [];
  if (q.subtotal   != null && q.subtotal   > 0) rows.push({ label: 'Subtotal',   value: q.subtotal });
  if (q.onlineFee  != null && q.onlineFee  > 0) rows.push({ label: 'Online Fee', value: q.onlineFee });
  if (q.cardFee    != null && q.cardFee    > 0) rows.push({ label: 'Card Fee',   value: q.cardFee });
  if (q.salesTax   != null && q.salesTax   > 0) rows.push({ label: 'Sales Tax',  value: q.salesTax });
  if (q.shipping   != null && q.shipping   > 0) rows.push({ label: 'Shipping',   value: q.shipping });
  if (q.rushFee    != null && q.rushFee    > 0) rows.push({ label: 'Rush Fee',   value: q.rushFee });
  return rows;
}

async function downloadQuotePdf(quote: ClientQuoteData): Promise<void> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  const source = {
    personOrganization: quote.orgName || quote.clientName,
    projectName: quote.projectName,
    title: quote.projectName,
    orderType: quote.orderType,
    inHandsDate: quote.inHandsDate,
    notesClient: quote.notesClient,
    lineItems: quote.lineItems,
    calculations: {
      total: quote.total,
      subtotal: quote.subtotal,
      totalPerPiece: quote.totalPerPiece,
      onlineFee: quote.onlineFee,
      cardFee: quote.cardFee,
      salesTax: quote.salesTax,
      shipping: quote.shipping,
      rushFee: quote.rushFee,
    },
  };
  const html = buildProjectDocumentHTML(source, 'QUOTE');
  const base =
    `${quote.orgName || quote.clientName || 'Quote'} ${quote.projectName || ''}`
      .trim()
      .replace(/[^a-zA-Z0-9 _-]/g, '')
      .replace(/\s+/g, '_')
      .slice(0, 60) || 'Quote';
  try {
    await htmlToPdf(html, `${base}.pdf`);
  } catch (err) {
    console.error('PDF download failed:', err);
    if (typeof window !== 'undefined') {
      window.alert('Sorry, the PDF could not be generated. Please try again.');
    }
  }
}

export default function ClientQuoteView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [quote, setQuote] = useState<ClientQuoteData | null>(null);
  const [error, setError] = useState('');
  const [approved, setApproved] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approvalEmailSent, setApprovalEmailSent] = useState(false);
  const [mounted, setMounted] = useState(false);

  const { width } = useWindowDimensions();
  useEffect(() => { setMounted(true); }, []);
  const isMobile = !mounted || width < 900;

  useEffect(() => {
    if (!id) { setError('Invalid quote link.'); setLoading(false); return; }
    fetch(`/api/portal/quote/${id}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error);
        else setQuote(data);
      })
      .catch(() => setError('Could not load quote. Please try again.'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleApprove = useCallback(async () => {
    if (!id || approving) return;
    setApproving(true);
    try {
      const res = await fetch(`/api/portal/quote/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setApproved(true);
        setApprovalEmailSent(!!data.emailSent);
      } else {
        setError(data.error || 'Could not approve. Please contact us.');
      }
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setApproving(false);
    }
  }, [id, approving]);

  const docSource = quote ? {
    personOrganization: quote.orgName || quote.clientName,
    projectName: quote.projectName,
    title: quote.projectName,
    orderType: quote.orderType,
    inHandsDate: quote.inHandsDate,
    notesClient: quote.notesClient,
    lineItems: quote.lineItems,
    calculations: {
      total: quote.total,
      subtotal: quote.subtotal,
      totalPerPiece: quote.totalPerPiece,
      onlineFee: quote.onlineFee,
      cardFee: quote.cardFee,
      salesTax: quote.salesTax,
      shipping: quote.shipping,
      rushFee: quote.rushFee,
    },
  } : null;

  const pricingRows = quote ? buildPricingRows(quote) : [];

  const quoteTimeline: Array<{ key: string; label: string; date: string | null; done: boolean }> = [];
  if (quote?.quoteSentAt) {
    quoteTimeline.push({ key: 'sent',   label: 'Quote Sent', date: quote.quoteSentAt, done: true  });
    quoteTimeline.push({ key: 'viewed', label: 'Viewed',     date: null,              done: false });
  }

  const canApprove = !!quote && quote.hasCalculations && quote.total != null && !approved;

  return (
    <View style={s.root}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Top bar */}
      <View style={s.topBar}>
        <Text style={s.logoText}>KATALYST KO</Text>
        <Text style={s.logoSub}>Quote Summary</Text>
      </View>

      <ScrollView contentContainerStyle={[s.scroll, isMobile && s.scrollMobile]}>

        {/* Loading */}
        {loading && (
          <View style={s.centerBox}>
            <ActivityIndicator size="large" color={BRAND} />
            <Text style={s.loadingText}>Loading your quote…</Text>
          </View>
        )}

        {/* Error */}
        {!loading && error && !quote && (
          <View style={s.centerBox}>
            <View style={s.stateCard}>
              <FileText size={36} color={BORDER} style={{ alignSelf: 'center', marginBottom: 12 }} />
              <Text style={s.stateTitle}>Quote Not Available</Text>
              <Text style={s.stateSub}>{error}</Text>
              <Text style={s.helpText}>
                Questions? Reach out to{' '}
                <Text style={{ color: BRAND }}>jobs@katalystko.com</Text>
              </Text>
            </View>
          </View>
        )}

        {/* Approved success */}
        {!loading && approved && (
          <View style={s.centerBox}>
            <View style={s.stateCard}>
              <View style={s.approvedBadge}>
                <CheckCircle size={14} color="#065F46" />
                <Text style={s.approvedBadgeText}>Quote Approved</Text>
              </View>
              <View style={{ alignItems: 'center', marginVertical: 16 }}>
                <CheckCircle size={44} color="#16A34A" />
              </View>
              <Text style={s.stateTitle}>You're all set!</Text>
              <Text style={s.stateSub}>
                {approvalEmailSent
                  ? 'The Katalyst Ko team has been notified and will follow up shortly to confirm next steps.'
                  : "Your approval has been recorded. Reach out to us and we'll confirm next steps."}
              </Text>
              <Text style={s.helpText}>
                Questions? Email{' '}
                <Text style={{ color: BRAND }}>jobs@katalystko.com</Text>
              </Text>
            </View>
          </View>
        )}

        {/* ── Main two-column layout ── */}
        {!loading && quote && !error && !approved && (
          <View style={[s.body, isMobile && s.bodyMobile]}>

            {/* Left column — document + files */}
            <View style={s.leftCol}>
              {docSource && (
                <ProjectDocument source={docSource} mode="QUOTE" minHeight={700} />
              )}

              {/* Customer files (only when present) */}
              {quote.files.length > 0 && (
                <View style={s.card}>
                  <Text style={s.cardTitle}>Files</Text>
                  <View style={{ gap: 8, marginTop: 10 }}>
                    {quote.files.map((f) => (
                      <View key={f.id} style={s.fileRow}>
                        <View style={s.fileIcon}>
                          <FileText size={16} color={BRAND} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.fileName} numberOfLines={1}>{f.originalName}</Text>
                          <Text style={s.fileMeta}>{formatBytes(f.fileSize)}</Text>
                        </View>
                        <TouchableOpacity
                          style={s.fileBtn}
                          onPress={() => {
                            if (Platform.OS === 'web')
                              window.open(f.url, '_blank', 'noopener,noreferrer');
                          }}
                        >
                          <Download size={15} color={TEXT_MED} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>

            {/* Right sidebar */}
            <View style={[s.sidebar, isMobile && s.sidebarMobile]}>

              {/* Pricing */}
              <View style={s.card}>
                <Text style={s.cardTitle}>Pricing</Text>
                {quote.hasCalculations && quote.total != null ? (
                  <>
                    <View style={{ marginTop: 10 }}>
                      {pricingRows.map((row) => (
                        <View key={row.label} style={s.priceRow}>
                          <Text style={s.priceLabel}>{row.label}</Text>
                          <Text style={s.priceVal}>{formatCurrency(row.value)}</Text>
                        </View>
                      ))}
                    </View>
                    <View style={s.totalBlock}>
                      <Text style={s.totalLabel}>TOTAL</Text>
                      <Text style={s.totalAmt}>{formatCurrency(quote.total)}</Text>
                    </View>
                    {quote.totalPerPiece != null && quote.totalPerPiece > 0 && (
                      <Text style={s.perPiece}>{formatCurrency(quote.totalPerPiece)} per piece</Text>
                    )}
                  </>
                ) : (
                  <View style={s.pendingBox}>
                    <Text style={s.pendingText}>
                      Pricing is being finalized — we'll be in touch shortly.
                    </Text>
                  </View>
                )}
              </View>

              {/* Actions */}
              <View style={s.card}>
                <Text style={s.cardTitle}>Actions</Text>
                <View style={{ gap: 8, marginTop: 10 }}>

                  <TouchableOpacity
                    style={s.actionPrimary}
                    activeOpacity={0.85}
                    onPress={() => downloadQuotePdf(quote)}
                  >
                    <Download size={16} color="#fff" />
                    <Text style={s.actionPrimaryText}>Download PDF</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={s.actionSecondary}
                    activeOpacity={0.85}
                    onPress={() =>
                      Linking.openURL(
                        `mailto:jobs@katalystko.com?subject=${encodeURIComponent(
                          `Question about ${quote.projectName || 'my quote'}`
                        )}`
                      )
                    }
                  >
                    <MessageCircle size={16} color={TEXT_MED} />
                    <Text style={s.actionSecondaryText}>Contact Katalyst Ko</Text>
                  </TouchableOpacity>

                  {canApprove && quote.waveInvoiceLink && (
                    <TouchableOpacity
                      style={s.actionPayNow}
                      activeOpacity={0.85}
                      onPress={() => {
                        if (Platform.OS === 'web')
                          window.open(quote.waveInvoiceLink!, '_blank', 'noopener,noreferrer');
                      }}
                    >
                      <CreditCard size={16} color="#fff" />
                      <Text style={s.actionPrimaryText}>Pay Now</Text>
                      <ExternalLink size={13} color="rgba(255,255,255,0.75)" />
                    </TouchableOpacity>
                  )}

                  {canApprove && (
                    <>
                      <TouchableOpacity
                        style={[
                          s.actionApprove,
                          approving && { opacity: 0.6 },
                          quote.waveInvoiceLink ? s.actionApproveGhost : null,
                        ]}
                        activeOpacity={0.85}
                        onPress={handleApprove}
                        disabled={approving}
                      >
                        {approving ? (
                          <ActivityIndicator
                            size="small"
                            color={quote.waveInvoiceLink ? TEXT_MED : '#fff'}
                          />
                        ) : (
                          <>
                            <CheckCircle
                              size={16}
                              color={quote.waveInvoiceLink ? TEXT_MED : '#fff'}
                            />
                            <Text style={[
                              s.actionApproveText,
                              quote.waveInvoiceLink && { color: TEXT_MED },
                            ]}>
                              Approve This Quote
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                      <Text style={s.changesNote}>
                        Need changes? Email{' '}
                        <Text style={{ color: BRAND }}>jobs@katalystko.com</Text>
                      </Text>
                    </>
                  )}
                </View>
              </View>

              {/* Quote Timeline */}
              {quoteTimeline.length > 0 && (
                <View style={s.card}>
                  <Text style={s.cardTitle}>Quote Timeline</Text>
                  <View style={{ marginTop: 14 }}>
                    {quoteTimeline.map((ev, i) => (
                      <View key={ev.key} style={s.tlRow}>
                        <View style={s.tlMarkerCol}>
                          <View style={[
                            s.tlDot,
                            ev.done && { backgroundColor: BRAND, borderColor: BRAND },
                          ]} />
                          {i < quoteTimeline.length - 1 ? <View style={s.tlLine} /> : null}
                        </View>
                        <View style={{
                          flex: 1,
                          paddingBottom: i < quoteTimeline.length - 1 ? 16 : 0,
                        }}>
                          <Text style={[s.tlLabel, !ev.done && { color: TEXT_LIGHT }]}>
                            {ev.label}
                          </Text>
                          <Text style={s.tlDate}>
                            {ev.date
                              ? (fmtDate(ev.date) ?? 'Completed')
                              : ev.done ? 'Completed' : 'Pending'}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )}

            </View>
          </View>
        )}
      </ScrollView>

      <View style={s.footer}>
        <Text style={s.footerText}>Powered by Katalyst Ko · Client Hub</Text>
      </View>
    </View>
  );
}

const SIDEBAR_W = 288;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  topBar: { backgroundColor: '#000', paddingHorizontal: 24, paddingVertical: 14 },
  logoText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 2 },
  logoSub: { color: BRAND, fontSize: 10, fontWeight: '600', letterSpacing: 1, marginTop: 1 },

  scroll:       { flexGrow: 1, padding: 32 },
  scrollMobile: { flexGrow: 1, padding: 16 },

  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  stateCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 28,
    width: '100%', maxWidth: 460, alignItems: 'center',
    borderWidth: 1, borderColor: BORDER,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 12, elevation: 3,
  },
  stateTitle: { fontSize: 20, fontWeight: '700', color: TEXT, textAlign: 'center', marginBottom: 8 },
  stateSub:   { fontSize: 14, color: TEXT_LIGHT, textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  helpText:   { fontSize: 12, color: TEXT_PLACEHOLDER, textAlign: 'center' },
  loadingText:{ fontSize: 14, color: TEXT_LIGHT, marginTop: 12 },
  approvedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#D1FAE5', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 5, marginBottom: 4,
  },
  approvedBadgeText: {
    fontSize: 12, fontWeight: '700', color: '#065F46',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },

  body:       { flexDirection: 'row', alignItems: 'flex-start', gap: 20 },
  bodyMobile: { flexDirection: 'column' },

  leftCol: { flex: 1, gap: 16, minWidth: 0 },

  sidebar:       { width: SIDEBAR_W, gap: 16, flexShrink: 0 },
  sidebarMobile: { width: '100%' },

  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 18,
    borderWidth: 1, borderColor: BORDER,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4,
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: TEXT },

  priceRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  priceLabel: { fontSize: 13, color: TEXT_LIGHT },
  priceVal:   { fontSize: 13, fontWeight: '600', color: TEXT_MED },
  totalBlock: {
    marginTop: 12, backgroundColor: BRAND, borderRadius: 10,
    paddingVertical: 13, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  totalLabel: { fontSize: 14, fontWeight: '800', color: '#fff' },
  totalAmt:   { fontSize: 22, fontWeight: '900', color: '#fff' },
  perPiece:   { fontSize: 12, color: TEXT_LIGHT, textAlign: 'center', marginTop: 8 },
  pendingBox: {
    backgroundColor: '#FFF7ED', borderRadius: 8, padding: 12,
    borderWidth: 1, borderColor: '#FED7AA', marginTop: 10,
  },
  pendingText: { fontSize: 13, color: BRAND, textAlign: 'center', lineHeight: 19 },

  actionPrimary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: BRAND, borderRadius: 10, paddingVertical: 12,
  },
  actionPrimaryText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  actionSecondary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER,
    borderRadius: 10, paddingVertical: 12,
  },
  actionSecondaryText: { fontSize: 14, fontWeight: '600', color: TEXT_MED },
  actionPayNow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#059669', borderRadius: 10, paddingVertical: 12,
  },
  actionApprove: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#16A34A', borderRadius: 10, paddingVertical: 12,
  },
  actionApproveGhost: {
    backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: BORDER,
  },
  actionApproveText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  changesNote: {
    fontSize: 12, color: TEXT_PLACEHOLDER, textAlign: 'center', lineHeight: 17, marginTop: 2,
  },

  tlRow:       { flexDirection: 'row', gap: 12 },
  tlMarkerCol: { alignItems: 'center', width: 14 },
  tlDot: {
    width: 12, height: 12, borderRadius: 6,
    borderWidth: 2, borderColor: BORDER, backgroundColor: '#fff',
  },
  tlLine: { width: 2, flex: 1, backgroundColor: BORDER, marginTop: 4, minHeight: 12 },
  tlLabel: { fontSize: 13, fontWeight: '600', color: TEXT },
  tlDate:  { fontSize: 11, color: TEXT_LIGHT, marginTop: 2 },

  fileRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: BORDER, borderRadius: 10, padding: 12, backgroundColor: '#fff',
  },
  fileIcon: {
    width: 34, height: 34, borderRadius: 8, backgroundColor: '#FFF4EE',
    alignItems: 'center', justifyContent: 'center',
  },
  fileName: { fontSize: 13, fontWeight: '600', color: TEXT },
  fileMeta: { fontSize: 11, color: TEXT_LIGHT, marginTop: 2 },
  fileBtn: {
    width: 34, height: 34, borderRadius: 8, borderWidth: 1, borderColor: BORDER,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB',
  },

  footer:     { backgroundColor: '#F3F4F6', borderTopWidth: 1, borderTopColor: BORDER, paddingVertical: 12, alignItems: 'center' },
  footerText: { fontSize: 12, color: TEXT_PLACEHOLDER },
});
