import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Image,
  Linking,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import {
  CheckCircle,
  Calendar,
  Layers,
  MapPin,
  Package,
  ChevronDown,
  ChevronUp,
  FileText,
  MessageSquare,
  ExternalLink,
  CreditCard,
  Download,
  Maximize2,
  MessageCircle,
} from 'lucide-react-native';

const BRAND = '#FF5A00';
const BORDER = '#E5E7EB';
const TEXT = '#111827';
const TEXT_MED = '#374151';
const TEXT_LIGHT = '#6B7280';
const TEXT_PLACEHOLDER = '#9CA3AF';
const BG = '#F9FAFB';

const SIZE_KEYS = ['xs', 's', 'm', 'l', 'xl', 'xxl', 'xxxl', 'xxxxl'] as const;
type SizeKey = (typeof SIZE_KEYS)[number];
const SIZE_LABELS: Record<SizeKey, string> = {
  xs: 'XS', s: 'SM', m: 'MD', l: 'LG', xl: 'XL', xxl: '2XL', xxxl: '3XL', xxxxl: '4XL',
};

function formatCurrency(n: number | null | undefined): string {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function rowTotal(sizes: Record<string, number>): number {
  return Object.values(sizes || {}).reduce((sum, v) => sum + (Number(v) || 0), 0);
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
    serviceStyle: string;
    location1: string;
    location2: string;
    location3: string;
    location4: string;
    locationDetails: string;
    sizes: Record<string, number>;
    garmentVariants: Array<{
      product: string;
      color: string;
      sizes: Record<string, number>;
    }>;
  }>;
  mockups: Array<{ id: string; designName: string; uri: string }>;
  files: Array<{ id: string; originalName: string; mimeType: string | null; fileSize: number | null; url: string; inlineUrl: string }>;
  subtotal: number | null;
  salesTax: number | null;
  processingFee: number | null;
  shipping: number | null;
  total: number | null;
  totalPerPiece: number | null;
  hasCalculations: boolean;
}

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = bytes; let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function escapeHtml(s: any): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Customer-safe quote PDF via browser print. Never exposes cost / markup / margin /
// COGS / vendor / applicator / fee-percentage details.
function downloadCustomerQuotePdf(opts: {
  title: string; status: string; orderType?: string | null;
  inHandsDate?: string | null; orgName?: string; notes?: string | null;
  lineItems: ClientQuoteData['lineItems']; pricing: Array<{ label: string; value: number }>; total: number | null;
}): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  const win = window.open('', '_blank', 'width=820,height=900');
  if (!win) return;
  const liHtml = opts.lineItems.map((li, idx) => {
    const variants = li.garmentVariants?.length > 0 ? li.garmentVariants : [{ product: '', color: '', sizes: li.sizes }];
    const products = variants.map(v => [v.product, v.color].filter(Boolean).join(' — ')).filter(Boolean);
    const qty = variants.reduce((s, v) => s + rowTotal(v.sizes), 0);
    const sizeAgg: Record<string, number> = {};
    variants.forEach(v => SIZE_KEYS.forEach(k => { sizeAgg[k] = (sizeAgg[k] || 0) + (Number(v.sizes?.[k]) || 0); }));
    const sizeStr = SIZE_KEYS.filter(k => sizeAgg[k] > 0).map(k => `${SIZE_LABELS[k]}: ${sizeAgg[k]}`).join(', ');
    const locations = [li.location1, li.location2, li.location3, li.location4].filter(Boolean).join(', ');
    return `
      <div class="item">
        <div class="item-h"><strong>#${idx + 1} ${escapeHtml(li.designName || `Item ${idx + 1}`)}</strong><span>${qty} pcs</span></div>
        ${products.length ? `<div class="row"><span class="k">Product</span><span>${escapeHtml(products.join(' • '))}</span></div>` : ''}
        ${li.serviceStyle ? `<div class="row"><span class="k">Service</span><span>${escapeHtml(li.serviceStyle)}</span></div>` : ''}
        ${locations ? `<div class="row"><span class="k">Locations</span><span>${escapeHtml(locations)}</span></div>` : ''}
        ${sizeStr ? `<div class="row"><span class="k">Sizes</span><span>${escapeHtml(sizeStr)}</span></div>` : ''}
      </div>`;
  }).join('');
  const priceHtml = opts.pricing.map(p =>
    `<div class="prow"><span>${escapeHtml(p.label)}</span><span>$${p.value.toFixed(2)}</span></div>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(opts.title)}</title>
    <style>
      *{box-sizing:border-box}body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111827;margin:0;padding:32px}
      h1{font-size:22px;margin:0 0 4px}.sub{color:#6B7280;font-size:13px;margin-bottom:14px}
      .badge{display:inline-block;background:#FFF4EE;color:#FF5A00;border-radius:14px;padding:3px 10px;font-size:12px;font-weight:700;margin-right:8px}
      .sec{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#6B7280;margin:22px 0 8px}
      .item{border:1px solid #E5E7EB;border-radius:10px;padding:12px 14px;margin-bottom:10px}
      .item-h{display:flex;justify-content:space-between;font-size:15px;margin-bottom:6px}
      .row{display:flex;font-size:13px;padding:2px 0}.k{width:90px;color:#6B7280}
      .prow{display:flex;justify-content:space-between;font-size:14px;padding:5px 0;border-bottom:1px solid #F3F4F6}
      .total{display:flex;justify-content:space-between;font-size:18px;font-weight:800;background:#FF5A00;color:#fff;border-radius:10px;padding:12px 16px;margin-top:10px}
      .meta{color:#6B7280;font-size:13px;margin-bottom:4px}
    </style></head><body>
      <h1>${escapeHtml(opts.title)}</h1>
      <div class="sub">${escapeHtml(opts.orgName || 'Katalyst Ko')}</div>
      <div><span class="badge">${escapeHtml(opts.status)}</span>${opts.orderType ? `<span class="badge">${escapeHtml(opts.orderType)}</span>` : ''}</div>
      ${opts.inHandsDate ? `<div class="meta" style="margin-top:10px">In-Hands Date: ${escapeHtml(opts.inHandsDate)}</div>` : ''}
      <div class="sec">Items</div>
      ${liHtml || '<div class="meta">No items.</div>'}
      <div class="sec">Pricing</div>
      ${priceHtml}
      ${opts.total != null ? `<div class="total"><span>Total</span><span>$${opts.total.toFixed(2)}</span></div>` : ''}
      ${opts.notes ? `<div class="sec">Notes</div><div class="meta">${escapeHtml(opts.notes)}</div>` : ''}
      <div class="meta" style="margin-top:28px">Questions? Contact Katalyst Ko at jobs@katalystko.com</div>
    </body></html>`;
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { try { win.print(); } catch {} }, 500);
}

function LineItemCard({ item, index }: { item: ClientQuoteData['lineItems'][0]; index: number }) {
  const [expanded, setExpanded] = useState(true);
  const locations = [item.location1, item.location2, item.location3, item.location4].filter(Boolean);
  const variants = item.garmentVariants?.length > 0
    ? item.garmentVariants
    : [{ product: '', color: '', sizes: item.sizes }];
  const totalQty = variants.reduce((sum, v) => sum + rowTotal(v.sizes), 0);

  return (
    <View style={liStyles.card}>
      <TouchableOpacity style={liStyles.header} onPress={() => setExpanded(e => !e)} activeOpacity={0.8}>
        <View style={liStyles.headerLeft}>
          <View style={liStyles.badge}>
            <Text style={liStyles.badgeText}>{index + 1}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={liStyles.name} numberOfLines={1}>
              {item.designName || 'Design'}
            </Text>
            <Text style={liStyles.sub}>{item.serviceStyle} · {totalQty} pcs</Text>
          </View>
        </View>
        {expanded ? <ChevronUp size={16} color="rgba(255,255,255,0.7)" /> : <ChevronDown size={16} color="rgba(255,255,255,0.7)" />}
      </TouchableOpacity>

      {expanded && (
        <View style={liStyles.body}>
          {/* Service & Locations */}
          <View style={liStyles.detailSection}>
            <View style={liStyles.detailRow}>
              <Layers size={13} color={TEXT_LIGHT} />
              <Text style={liStyles.detailLabel}>Service</Text>
              <Text style={liStyles.detailValue}>{item.serviceStyle}</Text>
            </View>
            {locations.length > 0 && (
              <View style={liStyles.detailRow}>
                <MapPin size={13} color={TEXT_LIGHT} />
                <Text style={liStyles.detailLabel}>Location{locations.length > 1 ? 's' : ''}</Text>
                <Text style={liStyles.detailValue}>{locations.join(' · ')}</Text>
              </View>
            )}
            {item.locationDetails ? (
              <View style={liStyles.detailRow}>
                <MessageSquare size={13} color={TEXT_LIGHT} />
                <Text style={liStyles.detailLabel}>Notes</Text>
                <Text style={[liStyles.detailValue, { flex: 1 }]}>{item.locationDetails}</Text>
              </View>
            ) : null}
          </View>

          {/* Products + Sizes */}
          <View style={liStyles.sizesSection}>
            <Text style={liStyles.sizesSectionTitle}>Products + Sizes</Text>
            {variants.map((v, vi) => {
              const qty = rowTotal(v.sizes);
              const sizeEntries = SIZE_KEYS.filter(k => (v.sizes[k] || 0) > 0);
              if (qty === 0 && !v.product) return null;
              return (
                <View key={vi} style={liStyles.variantRow}>
                  <View style={liStyles.variantInfo}>
                    {v.product ? (
                      <Text style={liStyles.variantProduct}>{v.product}{v.color ? ` — ${v.color}` : ''}</Text>
                    ) : null}
                    {sizeEntries.length > 0 && (
                      <Text style={liStyles.variantSizes}>
                        {sizeEntries.map(k => `${SIZE_LABELS[k]}: ${v.sizes[k]}`).join(' · ')}
                      </Text>
                    )}
                  </View>
                  <View style={liStyles.variantQty}>
                    <Text style={liStyles.variantQtyText}>{qty}</Text>
                    <Text style={liStyles.variantQtyLabel}>pcs</Text>
                  </View>
                </View>
              );
            })}
            <View style={liStyles.variantTotalRow}>
              <Text style={liStyles.variantTotalLabel}>Line Item Total</Text>
              <Text style={liStyles.variantTotalValue}>{totalQty} pcs</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

export default function ClientQuoteView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [quote, setQuote] = useState<ClientQuoteData | null>(null);
  const [error, setError] = useState('');
  const [approved, setApproved] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approvalEmailSent, setApprovalEmailSent] = useState(false);

  useEffect(() => {
    if (!id) { setError('Invalid quote link.'); setLoading(false); return; }
    fetch(`/api/portal/quote/${id}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); }
        else { setQuote(data); }
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
      } else { setError(data.error || 'Could not approve. Please contact us.'); }
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setApproving(false);
    }
  }, [id, approving]);

  const totalQty = quote?.lineItems.reduce((sum, item) => {
    const variants = item.garmentVariants?.length > 0 ? item.garmentVariants : [{ sizes: item.sizes }];
    return sum + variants.reduce((s, v) => s + rowTotal(v.sizes), 0);
  }, 0) ?? 0;

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.topBar}>
        <View>
          <Text style={styles.logoText}>KATALYST KO</Text>
          <Text style={styles.logoSub}>Quote Summary</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {loading && (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={BRAND} />
            <Text style={styles.loadingText}>Loading your quote…</Text>
          </View>
        )}

        {!loading && error && (
          <View style={styles.card}>
            <FileText size={36} color={BORDER} style={{ alignSelf: 'center', marginBottom: 12 }} />
            <Text style={styles.errorTitle}>Quote Not Available</Text>
            <Text style={styles.errorSub}>{error}</Text>
            <Text style={styles.helpText}>
              Questions? Reach out to <Text style={{ color: BRAND }}>jobs@katalystko.com</Text>
            </Text>
          </View>
        )}

        {!loading && quote && !error && (
          <>
            {approved ? (
              <View style={styles.card}>
                <View style={styles.approvedBadge}>
                  <CheckCircle size={14} color="#065F46" />
                  <Text style={styles.approvedBadgeText}>Quote Approved</Text>
                </View>
                <View style={styles.successIcon}><CheckCircle size={44} color="#16A34A" /></View>
                <Text style={styles.cardTitle}>You're all set!</Text>
                <Text style={styles.cardSub}>
                  {approvalEmailSent
                    ? 'The Katalyst Ko team has been notified and will follow up shortly to confirm next steps.'
                    : 'Your approval has been recorded. Reach out to us and we\'ll confirm next steps.'}
                </Text>
                <Text style={styles.helpText}>
                  Questions? Email <Text style={{ color: BRAND }}>jobs@katalystko.com</Text>
                </Text>
              </View>
            ) : (
              <>
                {/* Header card */}
                <View style={styles.headerCard}>
                  <View style={styles.headerCardTop}>
                    <View style={styles.orderTypePill}>
                      <Text style={styles.orderTypePillText}>{quote.orderType} Order</Text>
                    </View>
                    {quote.quoteSentAt && (
                      <Text style={styles.sentDate}>
                        Sent {new Date(quote.quoteSentAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.projectName}>{quote.projectName}</Text>
                  <Text style={styles.orgName}>{quote.orgName || quote.clientName}</Text>

                  <View style={styles.headerMeta}>
                    {quote.inHandsDate ? (
                      <View style={styles.metaRow}>
                        <Calendar size={14} color={TEXT_LIGHT} />
                        <Text style={styles.metaLabel}>In Hands By</Text>
                        <Text style={styles.metaValue}>{quote.inHandsDate}</Text>
                      </View>
                    ) : null}
                    <View style={styles.metaRow}>
                      <Package size={14} color={TEXT_LIGHT} />
                      <Text style={styles.metaLabel}>Line Items</Text>
                      <Text style={styles.metaValue}>{quote.lineItems.length}</Text>
                    </View>
                  </View>

                  {quote.notesClient ? (
                    <View style={styles.notesBox}>
                      <Text style={styles.notesLabel}>Notes from Katalyst Ko</Text>
                      <Text style={styles.notesText}>{quote.notesClient}</Text>
                    </View>
                  ) : null}
                </View>

                {/* Mockups — prominent visual */}
                {quote.mockups.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Mockups</Text>
                    <Text style={styles.sectionSub}>Visual previews of your order</Text>
                    <View style={styles.mockupGrid}>
                      {quote.mockups.map((m) => (
                        <TouchableOpacity
                          key={m.id}
                          style={styles.mockupCard}
                          activeOpacity={0.85}
                          onPress={() => {
                            if (Platform.OS === 'web') window.open(m.uri, '_blank', 'noopener,noreferrer');
                          }}
                        >
                          <Image source={{ uri: m.uri }} style={styles.mockupImg} resizeMode="cover" />
                          <View style={styles.mockupExpand}><Maximize2 size={13} color="#fff" /></View>
                          {m.designName ? <Text style={styles.mockupCaption} numberOfLines={1}>{m.designName}</Text> : null}
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {/* Line Items */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>
                    Line Items ({quote.lineItems.length})
                  </Text>
                  {quote.lineItems.map((item, i) => (
                    <LineItemCard key={item.id || i} item={item} index={i} />
                  ))}
                </View>

                {/* Customer Files */}
                {quote.files.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Files</Text>
                    {quote.files.map((f) => (
                      <View key={f.id} style={styles.fileRow}>
                        <View style={styles.fileIcon}><FileText size={16} color={BRAND} /></View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.fileName} numberOfLines={1}>{f.originalName}</Text>
                          <Text style={styles.fileMeta}>{formatBytes(f.fileSize)}</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.fileDownloadBtn}
                          onPress={() => { if (Platform.OS === 'web') window.open(f.url, '_blank', 'noopener,noreferrer'); }}
                        >
                          <Download size={15} color={TEXT_MED} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                {/* Pricing Summary */}
                <View style={styles.pricingCard}>
                  <View style={styles.pricingRow}>
                    <Text style={styles.pricingLabel}>Total Quantity</Text>
                    <Text style={styles.pricingValue}>{totalQty} pcs</Text>
                  </View>
                  {quote.hasCalculations && quote.total != null ? (
                    <>
                      {quote.subtotal != null && (
                        <View style={styles.pricingRow}>
                          <Text style={styles.pricingLabel}>Subtotal</Text>
                          <Text style={styles.pricingValue}>{formatCurrency(quote.subtotal)}</Text>
                        </View>
                      )}
                      {quote.salesTax != null && quote.salesTax > 0 && (
                        <View style={styles.pricingRow}>
                          <Text style={styles.pricingLabel}>Tax</Text>
                          <Text style={styles.pricingValue}>{formatCurrency(quote.salesTax)}</Text>
                        </View>
                      )}
                      {quote.shipping != null && quote.shipping > 0 && (
                        <View style={styles.pricingRow}>
                          <Text style={styles.pricingLabel}>Shipping</Text>
                          <Text style={styles.pricingValue}>{formatCurrency(quote.shipping)}</Text>
                        </View>
                      )}
                      {quote.processingFee != null && quote.processingFee > 0 && (
                        <View style={styles.pricingRow}>
                          <Text style={styles.pricingLabel}>Processing &amp; Handling</Text>
                          <Text style={styles.pricingValue}>{formatCurrency(quote.processingFee)}</Text>
                        </View>
                      )}
                      {quote.totalPerPiece != null && (
                        <View style={styles.pricingRow}>
                          <Text style={styles.pricingLabel}>Per Piece</Text>
                          <Text style={styles.pricingValue}>{formatCurrency(quote.totalPerPiece)}</Text>
                        </View>
                      )}
                      <View style={[styles.pricingRow, styles.pricingTotalRow]}>
                        <Text style={styles.pricingTotalLabel}>Quote Total</Text>
                        <Text style={styles.pricingTotalValue}>{formatCurrency(quote.total)}</Text>
                      </View>
                    </>
                  ) : (
                    <View style={styles.pricingPendingBox}>
                      <Text style={styles.pricingPendingText}>
                        Pricing is being finalized — we'll be in touch shortly.
                      </Text>
                    </View>
                  )}
                </View>

                {/* Secondary actions — always available */}
                <View style={styles.secondaryActions}>
                  <TouchableOpacity
                    style={styles.actionSecondary}
                    onPress={() => downloadCustomerQuotePdf({
                      title: quote.projectName || 'Quote',
                      status: 'Quote',
                      orderType: quote.orderType ? `${quote.orderType} Order` : null,
                      inHandsDate: quote.inHandsDate,
                      orgName: quote.orgName || quote.clientName,
                      notes: quote.notesClient,
                      lineItems: quote.lineItems,
                      pricing: [
                        ...(quote.subtotal != null ? [{ label: 'Subtotal', value: quote.subtotal }] : []),
                        ...(quote.salesTax != null && quote.salesTax > 0 ? [{ label: 'Tax', value: quote.salesTax }] : []),
                        ...(quote.shipping != null && quote.shipping > 0 ? [{ label: 'Shipping', value: quote.shipping }] : []),
                        ...(quote.processingFee != null && quote.processingFee > 0 ? [{ label: 'Processing & Handling', value: quote.processingFee }] : []),
                      ],
                      total: quote.total,
                    })}
                  >
                    <Download size={16} color={TEXT_MED} />
                    <Text style={styles.actionSecondaryText}>Download PDF</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionSecondary}
                    onPress={() => Linking.openURL(`mailto:jobs@katalystko.com?subject=${encodeURIComponent(`Question about ${quote.projectName || 'my quote'}`)}`)}
                  >
                    <MessageCircle size={16} color={TEXT_MED} />
                    <Text style={styles.actionSecondaryText}>Contact</Text>
                  </TouchableOpacity>
                </View>

                {/* Actions */}
                {quote.hasCalculations && quote.total != null && (
                  <View style={styles.actionsCard}>
                    <Text style={styles.actionsTitle}>Ready to move forward?</Text>
                    <Text style={styles.actionsSub}>
                      {quote.waveInvoiceLink
                        ? 'Pay your invoice securely through Wave. Once paid, we\'ll get to work!'
                        : 'Approve this quote to let Katalyst Ko know you\'re good to go. We\'ll follow up to confirm details and next steps.'}
                    </Text>

                    {/* Pay Now — primary CTA when Wave link exists */}
                    {quote.waveInvoiceLink ? (
                      <TouchableOpacity
                        style={styles.payNowBtn}
                        onPress={() => {
                          if (Platform.OS === 'web') {
                            window.open(quote.waveInvoiceLink!, '_blank', 'noopener,noreferrer');
                          }
                        }}
                      >
                        <CreditCard size={18} color="#fff" />
                        <Text style={styles.payNowBtnText}>Pay Now</Text>
                        <ExternalLink size={14} color="rgba(255,255,255,0.75)" />
                      </TouchableOpacity>
                    ) : null}

                    {/* Approve quote — always available */}
                    <TouchableOpacity
                      style={[
                        styles.approveBtn,
                        approving && styles.approveBtnDisabled,
                        quote.waveInvoiceLink ? styles.approveBtnSecondary : null,
                      ]}
                      onPress={handleApprove}
                      disabled={approving}
                    >
                      {approving
                        ? <ActivityIndicator size="small" color={quote.waveInvoiceLink ? '#374151' : '#fff'} />
                        : (
                          <>
                            <CheckCircle size={18} color={quote.waveInvoiceLink ? '#374151' : '#fff'} />
                            <Text style={[styles.approveBtnText, quote.waveInvoiceLink ? styles.approveBtnTextSecondary : null]}>
                              Approve This Quote
                            </Text>
                          </>
                        )}
                    </TouchableOpacity>
                    <Text style={styles.requestChangesNote}>
                      Need changes? Email us at <Text style={{ color: BRAND }}>jobs@katalystko.com</Text>
                    </Text>
                  </View>
                )}

                <Text style={styles.footerNote}>
                  Quote prepared by Katalyst Ko Printshop · jobs@katalystko.com
                </Text>
              </>
            )}
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Powered by Katalyst Ko · Client Hub</Text>
      </View>
    </View>
  );
}

const liStyles = StyleSheet.create({
  card: {
    borderWidth: 1, borderColor: BORDER, borderRadius: 12, marginBottom: 12,
    backgroundColor: '#fff', overflow: 'hidden',
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14, backgroundColor: '#000',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  badge: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: BRAND,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  badgeText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  name: { fontSize: 14, fontWeight: '700', color: '#fff' },
  sub: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 1 },
  body: { padding: 16 },
  detailSection: { marginBottom: 14 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 7 },
  detailLabel: { fontSize: 12, fontWeight: '600', color: TEXT_LIGHT, width: 64 },
  detailValue: { fontSize: 13, color: TEXT_MED, flexShrink: 1 },
  sizesSection: {
    borderWidth: 1, borderColor: BORDER, borderRadius: 10, overflow: 'hidden',
  },
  sizesSectionTitle: {
    fontSize: 11, fontWeight: '700', color: TEXT_LIGHT, textTransform: 'uppercase',
    letterSpacing: 0.5, paddingHorizontal: 12, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: BORDER, backgroundColor: '#F9FAFB',
  },
  variantRow: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  variantInfo: { flex: 1, marginRight: 12 },
  variantProduct: { fontSize: 13, fontWeight: '600', color: TEXT },
  variantSizes: { fontSize: 12, color: TEXT_LIGHT, marginTop: 2, lineHeight: 18 },
  variantQty: { alignItems: 'flex-end' },
  variantQtyText: { fontSize: 16, fontWeight: '700', color: TEXT },
  variantQtyLabel: { fontSize: 10, color: TEXT_LIGHT },
  variantTotalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#F9FAFB',
  },
  variantTotalLabel: { fontSize: 12, fontWeight: '600', color: TEXT_LIGHT },
  variantTotalValue: { fontSize: 14, fontWeight: '700', color: TEXT },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  topBar: { backgroundColor: '#000', paddingHorizontal: 24, paddingVertical: 14 },
  logoText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 2 },
  logoSub: { color: BRAND, fontSize: 10, fontWeight: '600', letterSpacing: 1, marginTop: 1 },
  scrollContent: { flexGrow: 1, alignItems: 'center', padding: 20, paddingVertical: 36, gap: 0 },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  loadingText: { fontSize: 14, color: TEXT_LIGHT },
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 520,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06,
    shadowRadius: 12, elevation: 3, alignItems: 'center',
  },
  errorTitle: { fontSize: 20, fontWeight: '700', color: TEXT, textAlign: 'center', marginBottom: 8 },
  errorSub: { fontSize: 14, color: TEXT_LIGHT, textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  approvedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#D1FAE5', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
    marginBottom: 16,
  },
  approvedBadgeText: { fontSize: 12, fontWeight: '700', color: '#065F46', textTransform: 'uppercase', letterSpacing: 0.5 },
  successIcon: { marginBottom: 16 },
  cardTitle: { fontSize: 22, fontWeight: '700', color: TEXT, textAlign: 'center', marginBottom: 8 },
  cardSub: { fontSize: 14, color: TEXT_LIGHT, textAlign: 'center', lineHeight: 21, marginBottom: 20 },
  helpText: { fontSize: 12, color: TEXT_PLACEHOLDER, textAlign: 'center', lineHeight: 17 },
  headerCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 20, width: '100%', maxWidth: 560,
    borderWidth: 1, borderColor: BORDER, marginBottom: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  headerCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  orderTypePill: { backgroundColor: '#FFF7ED', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#FED7AA' },
  orderTypePillText: { fontSize: 11, fontWeight: '600', color: BRAND },
  sentDate: { fontSize: 11, color: TEXT_PLACEHOLDER },
  projectName: { fontSize: 22, fontWeight: '800', color: TEXT, marginBottom: 4 },
  orgName: { fontSize: 15, color: TEXT_LIGHT, marginBottom: 14 },
  headerMeta: { gap: 6, marginBottom: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaLabel: { fontSize: 12, fontWeight: '600', color: TEXT_LIGHT, width: 80 },
  metaValue: { fontSize: 13, color: TEXT_MED },
  notesBox: { backgroundColor: '#F9FAFB', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: BORDER, marginTop: 4 },
  notesLabel: { fontSize: 11, fontWeight: '600', color: TEXT_LIGHT, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 },
  notesText: { fontSize: 13, color: TEXT_MED, lineHeight: 20 },
  section: { width: '100%', maxWidth: 560, marginBottom: 24 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: TEXT, marginBottom: 12 },
  pricingCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 18, width: '100%', maxWidth: 560,
    borderWidth: 1, borderColor: BORDER, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  pricingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  pricingTotalRow: { borderBottomWidth: 0, paddingTop: 12, marginTop: 4 },
  pricingLabel: { fontSize: 13, color: TEXT_LIGHT },
  pricingValue: { fontSize: 14, fontWeight: '600', color: TEXT_MED },
  pricingTotalLabel: { fontSize: 16, fontWeight: '700', color: TEXT },
  pricingTotalValue: { fontSize: 22, fontWeight: '800', color: BRAND },
  pricingPendingBox: { backgroundColor: '#FFF7ED', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#FED7AA' },
  pricingPendingText: { fontSize: 13, color: BRAND, textAlign: 'center', lineHeight: 19 },
  actionsCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 20, width: '100%', maxWidth: 560,
    borderWidth: 1, borderColor: BORDER, marginBottom: 24, alignItems: 'center',
  },
  actionsTitle: { fontSize: 17, fontWeight: '700', color: TEXT, marginBottom: 6, textAlign: 'center' },
  actionsSub: { fontSize: 13, color: TEXT_LIGHT, textAlign: 'center', lineHeight: 19, marginBottom: 18 },
  payNowBtn: {
    backgroundColor: BRAND, borderRadius: 12, paddingVertical: 15, paddingHorizontal: 32,
    flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%', justifyContent: 'center',
    marginBottom: 10,
  },
  payNowBtnText: { fontSize: 17, fontWeight: '800', color: '#fff' },
  approveBtn: {
    backgroundColor: '#16A34A', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32,
    flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%', justifyContent: 'center',
    marginBottom: 12,
  },
  approveBtnSecondary: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  approveBtnDisabled: { opacity: 0.6 },
  approveBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  approveBtnTextSecondary: { color: '#374151' },
  requestChangesNote: { fontSize: 12, color: TEXT_PLACEHOLDER, textAlign: 'center', lineHeight: 17 },
  footerNote: { fontSize: 12, color: TEXT_PLACEHOLDER, textAlign: 'center', marginBottom: 12, maxWidth: 560, width: '100%' },
  footer: { backgroundColor: '#F3F4F6', borderTopWidth: 1, borderTopColor: BORDER, paddingVertical: 12, alignItems: 'center' },
  footerText: { fontSize: 12, color: TEXT_PLACEHOLDER },

  sectionSub: { fontSize: 12, color: TEXT_LIGHT, marginTop: -8, marginBottom: 12 },

  mockupGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  mockupCard: {
    width: 150, borderRadius: 12, borderWidth: 1, borderColor: BORDER,
    backgroundColor: '#F9FAFB', overflow: 'hidden',
  },
  mockupImg: { width: '100%', height: 150, backgroundColor: '#F3F4F6' },
  mockupExpand: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 14,
    width: 26, height: 26, alignItems: 'center', justifyContent: 'center',
  },
  mockupCaption: { fontSize: 12, fontWeight: '600', color: TEXT, paddingHorizontal: 10, paddingVertical: 8 },

  fileRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: BORDER, borderRadius: 10, padding: 12, marginBottom: 10,
    backgroundColor: '#fff',
  },
  fileIcon: {
    width: 34, height: 34, borderRadius: 8, backgroundColor: '#FFF4EE',
    alignItems: 'center', justifyContent: 'center',
  },
  fileName: { fontSize: 13, fontWeight: '600', color: TEXT },
  fileMeta: { fontSize: 11, color: TEXT_LIGHT, marginTop: 2 },
  fileDownloadBtn: {
    width: 34, height: 34, borderRadius: 8, borderWidth: 1, borderColor: BORDER,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB',
  },

  secondaryActions: {
    flexDirection: 'row', gap: 12, width: '100%', maxWidth: 560, marginBottom: 24,
  },
  actionSecondary: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER,
    borderRadius: 10, paddingVertical: 12,
  },
  actionSecondaryText: { fontSize: 14, fontWeight: '600', color: TEXT_MED },
});
