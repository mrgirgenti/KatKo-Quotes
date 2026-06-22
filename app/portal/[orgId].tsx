import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Pressable,
  Image,
  Linking,
  Animated,
  Alert,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { TABLE_COL, TABLE_CELL } from '@/constants/tableLayout';
import {
  CheckCircle,
  Send,
  ArrowLeft,
  Plus,
  Trash2,
  ChevronDown,
  Calendar,
  ChevronLeft,
  ChevronRight,
  FileText,
  Check,
  Edit2,
  LayoutDashboard,
  Folder,
  Layers,
  BookOpen,
  ClipboardList,
  LogOut,
  Package,
  Clock,
  CheckCircle2,
  XCircle,
  Receipt,
  Upload,
  X,
  Download,
  Image as ImageIcon,
  ExternalLink,
  Search,
  Filter,
  SlidersHorizontal,
  User,
  UserPlus,
  UserMinus,
  Mail,
  Shield,
  Library,
  Tag,
  MapPin,
  Menu,
  ArrowUpDown,
  ChevronUp,
  Grid2x2,
  LayoutGrid,
  List,
  Film,
  Music,
  Building2,
  Phone,
  Copy,
  Users,
  Star,
  RefreshCw,
  Maximize2,
  MessageCircle,
} from 'lucide-react-native';
import { LOCATIONS, PRODUCTS, PRODUCT_COLORS } from '@/types/quote';
import MediaPickerModal from '@/components/MediaPickerModal';
import MediaCard from '@/components/MediaCard';
import OverlayMenu from '@/components/OverlayMenu';

const BRAND = '#FF5A00';
const BRAND_DARK = '#CC4700';
const BORDER = '#E5E7EB';
const BG = '#FAFAFA';
const TEXT = '#111827';
const TEXT_MED = '#374151';
const TEXT_LIGHT = '#6B7280';
const TEXT_PLACEHOLDER = '#9CA3AF';

type Step = 'email' | 'dashboard';
type ActiveView = 'home' | 'projects' | 'artwork' | 'catalogs' | 'submit' | 'profile' | 'project-view';

interface PendingFile {
  id: string;
  name: string;
  size: number;
  file: globalThis.File;
}

interface MediaFile {
  id: string;
  originalName: string;
  mimeType: string | null;
  fileSize: number | null;
  fileType: string;
  projectId: string | null;
  createdAt: string;
  firstName: string | null;
  lastName: string | null;
}

interface PortalProject {
  id: string;
  title: string;
  status: string;
  inHandsDate: string | null;
  orderDate: string | null;
  createdAt: string;
  lineItemCount: number;
  designCount: number;
  thumbUri: string | null;
  primaryImageUri: string | null;
  mockupCount: number;
  artworkCount: number;
  proofCount: number;
  invoiceCount: number;
  totalCost: string | null;
  pieces: number | null;
  perPiece: string | null;
  reorderedFromId: string | null;
  originalOrderDate: string | null;
  timesReordered: number | null;
  lastReorderedAt: string | null;
  quoteResponse: string | null;
}

interface FullPortalProject {
  id: string;
  title: string;
  status: string;
  orderType: string | null;
  orderDate: string | null;
  inHandsDate: string | null;
  notesClient: string | null;
  lineItemsData: any[] | null;
  calculations: any | null;
  hasOnlineFee: boolean;
  hasSalesTax: boolean;
  hasCardFee: boolean;
  createdAt: string;
  reorderedFromId: string | null;
  originalOrderDate: string | null;
  timesReordered: number | null;
  lastReorderedAt: string | null;
  quoteSentAt: string | null;
  quoteViewedAt: string | null;
  quoteResponse: string | null;
  quoteRespondedAt: string | null;
  quoteResponseBy: string | null;
  quoteResponseNote: string | null;
  files?: Array<{
    id: string;
    originalName: string;
    mimeType: string | null;
    fileSize: number | null;
    fileType: string;
    createdAt: string;
  }>;
  invoices?: Array<{
    id: string;
    invoiceNumber: string | null;
    status: string;
    total: string | null;
    amountPaid: string | null;
    dueDate: string | null;
    sentAt: string | null;
    paymentUrl: string | null;
  }>;
}

function assetCountSummary(p: PortalProject): string[] {
  const out: string[] = [];
  if (p.mockupCount > 0) out.push(`${p.mockupCount} Mockup${p.mockupCount !== 1 ? 's' : ''}`);
  if (p.artworkCount > 0) out.push(`${p.artworkCount} Artwork ${p.artworkCount !== 1 ? 'Files' : 'File'}`);
  if (p.invoiceCount > 0) out.push(`${p.invoiceCount} Invoice${p.invoiceCount !== 1 ? 's' : ''}`);
  if (p.proofCount > 0) out.push(`${p.proofCount} Proof${p.proofCount !== 1 ? 's' : ''}`);
  return out;
}

const STATUS_PIPELINE = ['NEEDS_REVIEW', 'QUOTING', 'QUOTED', 'INVOICE_SENT', 'PAID', 'IN_PRODUCTION', 'COMPLETED'] as const;

const PORTAL_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  NEEDS_REVIEW:  { label: 'Needs Review',    color: '#D97706', bg: '#FEF3C7' },
  QUOTING:       { label: 'Being Quoted',    color: '#2563EB', bg: '#EFF6FF' },
  QUOTED:        { label: 'Quote Ready',     color: '#7C3AED', bg: '#F5F3FF' },
  INVOICE_SENT:  { label: 'Invoice Sent',    color: '#6D28D9', bg: '#EDE9FE' },
  PAID:          { label: 'Paid',            color: '#059669', bg: '#ECFDF5' },
  IN_PRODUCTION: { label: 'In Production',   color: '#EA580C', bg: '#FFF7ED' },
  COMPLETED:     { label: 'Completed',       color: '#16A34A', bg: '#F0FDF4' },
  CANCELLED:     { label: 'Cancelled',       color: '#6B7280', bg: '#F3F4F6' },
};

const QUOTE_RESPONSE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  approved:          { label: 'Approved',          color: '#059669', bg: '#ECFDF5' },
  changes_requested: { label: 'Changes Requested', color: '#D97706', bg: '#FEF3C7' },
  declined:          { label: 'Declined',          color: '#6B7280', bg: '#F3F4F6' },
};

function StatusPill({ status, quoteResponse }: { status: string; quoteResponse?: string | null }) {
  const rc = quoteResponse ? QUOTE_RESPONSE_CONFIG[quoteResponse] : null;
  if (rc) {
    return (
      <View style={{ backgroundColor: rc.bg, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: rc.color }}>{rc.label}</Text>
      </View>
    );
  }
  const normalized = status.toUpperCase().replace('QUOTE_SENT', 'QUOTED');
  const cfg = PORTAL_STATUS_CONFIG[normalized] || { label: status, color: '#6B7280', bg: '#F3F4F6' };
  return (
    <View style={{ backgroundColor: cfg.bg, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: cfg.color }}>{cfg.label}</Text>
    </View>
  );
}

function ProjectPipeline({ status }: { status: string }) {
  const normalized = status.toUpperCase().replace('QUOTE_SENT', 'QUOTED') as any;
  const currentIdx = STATUS_PIPELINE.indexOf(normalized);
  const PIPE_LABELS = ['Review', 'Quoting', 'Quoted', 'Invoice', 'Paid', 'Production', 'Done'];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 0, marginTop: 8 }}>
      {STATUS_PIPELINE.map((s, i) => {
        const done = currentIdx > i;
        const active = currentIdx === i;
        return (
          <React.Fragment key={s}>
            <View style={{ alignItems: 'center', flex: 1 }}>
              <View style={{
                width: active ? 14 : 10,
                height: active ? 14 : 10,
                borderRadius: active ? 7 : 5,
                backgroundColor: done ? '#16A34A' : active ? BRAND : '#E5E7EB',
                borderWidth: active ? 2 : 0,
                borderColor: active ? BRAND : 'transparent',
              }} />
              <Text style={{ fontSize: 8, color: active ? BRAND : done ? '#16A34A' : '#9CA3AF', marginTop: 3, textAlign: 'center' }}>
                {PIPE_LABELS[i]}
              </Text>
            </View>
            {i < STATUS_PIPELINE.length - 1 && (
              <View style={{ height: 2, flex: 0.5, backgroundColor: done ? '#16A34A' : '#E5E7EB', marginBottom: 14 }} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

// Rewrite Clerk-gated /api/files/{id} mockup URLs to the public portal route.
// data: URIs pass through unchanged (they render directly).
function resolveMockupUrl(uri: string, orgId: string): string {
  if (!uri) return '';
  if (uri.startsWith('data:')) return uri;
  const m = uri.match(/\/api\/files\/([^?]+)/);
  if (m && orgId) return `/api/portal/${orgId}/files/${m[1]}?inline=true`;
  return uri;
}

const CUSTOMER_SIZE_LABELS: Array<{ key: string; label: string }> = [
  { key: 'xs', label: 'XS' }, { key: 's', label: 'SM' }, { key: 'm', label: 'MD' },
  { key: 'l', label: 'LG' }, { key: 'xl', label: 'XL' }, { key: 'xxl', label: '2XL' },
  { key: 'xxxl', label: '3XL' }, { key: 'xxxxl', label: '4XL' },
];

// Customer-facing line-item product card. Each line item OWNS its mockup(s):
// a hero image plus an optional thumbnail strip (selectable when a line item
// carries more than one mockup). A line item carries a single `mockupUri` today;
// it is modeled as an array so this UI is ready for future multi-mockup items.
// Never renders cost / vendor / applicator / internal data.
function PortalCustomerLineItemCard({ li, index, orgIdForFiles }: { li: any; index: number; orgIdForFiles: string }) {
  const [activeMockup, setActiveMockup] = useState(0);

  const variants = Array.isArray(li.garmentVariants) && li.garmentVariants.length > 0 ? li.garmentVariants : null;
  const sizeSets = variants ? variants.map((v: any) => v.sizes ?? {}) : [li.sizes ?? {}];
  const qty = sizeSets.reduce((s: number, sz: any) => s + Object.values(sz).reduce((a: number, v: any) => a + (Number(v) || 0), 0), 0);
  const sizeAgg: Record<string, number> = {};
  sizeSets.forEach((sz: any) => CUSTOMER_SIZE_LABELS.forEach(s => { sizeAgg[s.key] = (sizeAgg[s.key] || 0) + (Number(sz[s.key]) || 0); }));
  const activeSizes = CUSTOMER_SIZE_LABELS.filter(s => (sizeAgg[s.key] || 0) > 0);
  const products = variants
    ? variants.map((v: any) => [v.product, v.color].filter(Boolean).join(' — ')).filter(Boolean)
    : [[li.product, li.productColor].filter(Boolean).join(' — ')].filter(Boolean);
  const locations = [li.location1, li.location2, li.location3, li.location4].filter(Boolean).join(', ');

  const rawMockups: string[] = Array.isArray(li.mockups) && li.mockups.length
    ? li.mockups
    : (li.mockupUri ? [li.mockupUri] : []);
  const mockups: string[] = rawMockups
    .map((u: string) => resolveMockupUrl(u, orgIdForFiles))
    .filter(Boolean);
  const heroUri = mockups[activeMockup] || mockups[0] || '';

  const openMockup = (uri: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && uri) window.open(uri, '_blank');
  };
  const triggerDownload = (url: string, name: string) => {
    if (Platform.OS === 'web' && typeof document !== 'undefined' && url) {
      const a = document.createElement('a');
      a.href = url;
      a.download = name || '';
      a.click();
    }
  };

  return (
    <View style={[pvStyles.liCard, index > 0 && { marginTop: 16 }]}>
      {/* Item header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
          <View style={{ backgroundColor: BRAND, width: 22, height: 22, borderRadius: 4, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>#{index + 1}</Text>
          </View>
          <Text style={pvStyles.lineItemName} numberOfLines={1}>{li.designName || `Item ${index + 1}`}</Text>
        </View>
        <View style={{ backgroundColor: '#FFF4EE', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 4 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: BRAND }}>{qty} pcs</Text>
        </View>
      </View>

      {/* Mockup hero — owned and displayed by this line item */}
      {heroUri ? (
        <View style={pvStyles.liMockupSection}>
          <View style={pvStyles.liHeroWrap}>
            <Image source={{ uri: heroUri }} style={pvStyles.liHeroImg} resizeMode="contain" />
            <View style={pvStyles.assetActions}>
              <TouchableOpacity style={pvStyles.assetBtn} onPress={() => openMockup(heroUri)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <Maximize2 size={13} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={pvStyles.assetBtn} onPress={() => triggerDownload(heroUri, li.designName || `mockup-${index + 1}`)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <Download size={13} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
          {mockups.length > 1 ? (
            <View style={pvStyles.liThumbStrip}>
              {mockups.map((m, mi) => (
                <TouchableOpacity key={mi} style={[pvStyles.liThumb, mi === activeMockup && pvStyles.liThumbActive]} activeOpacity={0.8} onPress={() => setActiveMockup(mi)}>
                  <Image source={{ uri: m }} style={pvStyles.liThumbImg} resizeMode="cover" />
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Customer-facing details (no cost / vendor / applicator) */}
      <View style={{ gap: 8, marginBottom: activeSizes.length > 0 ? 14 : 0 }}>
        {products.length > 0 ? (
          <View style={pvStyles.detailRow}>
            <Tag size={13} color={TEXT_LIGHT} />
            <Text style={pvStyles.detailLabel}>Product</Text>
            <Text style={pvStyles.detailValue}>{products.join('   •   ')}</Text>
          </View>
        ) : null}
        {li.serviceStyle ? (
          <View style={pvStyles.detailRow}>
            <Layers size={13} color={TEXT_LIGHT} />
            <Text style={pvStyles.detailLabel}>Service</Text>
            <Text style={pvStyles.detailValue}>{li.serviceStyle}</Text>
          </View>
        ) : null}
        {locations ? (
          <View style={pvStyles.detailRow}>
            <MapPin size={13} color={TEXT_LIGHT} />
            <Text style={pvStyles.detailLabel}>Locations</Text>
            <Text style={pvStyles.detailValue}>{locations}</Text>
          </View>
        ) : null}
        {li.locationDetails ? (
          <View style={pvStyles.detailRow}>
            <FileText size={13} color={TEXT_LIGHT} />
            <Text style={pvStyles.detailLabel}>Details</Text>
            <Text style={pvStyles.detailValue}>{li.locationDetails}</Text>
          </View>
        ) : null}
      </View>

      {/* Sizes + quantities */}
      {activeSizes.length > 0 ? (
        <View>
          <Text style={[pvStyles.metaLabel, { marginBottom: 8 }]}>SIZES + QUANTITIES</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {activeSizes.map(s => (
              <View key={s.key} style={pvStyles.sizeBox}>
                <Text style={pvStyles.sizeLabel}>{s.label}</Text>
                <Text style={pvStyles.sizeQty}>{sizeAgg[s.key]}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function escapeHtml(s: any): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Customer-safe project PDF via browser print. Each line item shows its own
// mockup(s). Deliberately omits every internal field (cost, markup, margin,
// COGS, vendor, applicator, fee breakdowns).
function downloadCustomerProjectPdf(opts: {
  title: string; status: string; orderType?: string | null;
  inHandsDate?: string | null; orgName?: string; customerName?: string | null; notes?: string | null;
  orgId?: string; lineItems: any[]; pricing: Array<{ label: string; value: number }>; total: number | null;
}): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  const win = window.open('', '_blank', 'width=820,height=900');
  if (!win) return;
  const liHtml = opts.lineItems.map((li, idx) => {
    const variants = Array.isArray(li.garmentVariants) && li.garmentVariants.length > 0 ? li.garmentVariants : null;
    const products = variants
      ? variants.map((v: any) => [v.product, v.color].filter(Boolean).join(' — ')).filter(Boolean)
      : [[li.product, li.productColor].filter(Boolean).join(' — ')].filter(Boolean);
    const sizeSets = variants ? variants.map((v: any) => v.sizes ?? {}) : [li.sizes ?? {}];
    const qty = sizeSets.reduce((s: number, sz: any) =>
      s + Object.values(sz).reduce((a: number, n: any) => a + (Number(n) || 0), 0), 0);
    const sizeAgg: Record<string, number> = {};
    sizeSets.forEach((sz: any) => CUSTOMER_SIZE_LABELS.forEach(s => {
      sizeAgg[s.key] = (sizeAgg[s.key] || 0) + (Number(sz[s.key]) || 0);
    }));
    const sizeStr = CUSTOMER_SIZE_LABELS.filter(s => sizeAgg[s.key] > 0).map(s => `${s.label}: ${sizeAgg[s.key]}`).join(', ');
    const locations = [li.location1, li.location2, li.location3, li.location4].filter(Boolean).join(', ');
    const rawMockups: string[] = Array.isArray(li.mockups) && li.mockups.length
      ? li.mockups
      : (li.mockupUri ? [li.mockupUri] : []);
    const mockups: string[] = rawMockups
      .map((u: string) => resolveMockupUrl(u, opts.orgId || ''))
      .filter(Boolean);
    const mockupsHtml = mockups.length
      ? `<div class="mockups">${mockups.map(m => `<div class="mockup"><img src="${escapeHtml(m)}" alt="Mockup for ${escapeHtml(li.designName || `Item ${idx + 1}`)}"/></div>`).join('')}</div>`
      : '<div class="nomock">No mockup provided for this item.</div>';
    return `
      <div class="item">
        <div class="item-h"><strong>#${idx + 1} ${escapeHtml(li.designName || `Item ${idx + 1}`)}</strong><span>${qty} pcs</span></div>
        ${mockupsHtml}
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
      *{box-sizing:border-box}
      body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111827;margin:0;padding:32px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      h1{font-size:22px;margin:0 0 4px}.sub{color:#6B7280;font-size:13px;margin-bottom:14px}
      .badge{display:inline-block;background:#FFF4EE;color:#FF5A00;border-radius:14px;padding:3px 10px;font-size:12px;font-weight:700;margin-right:8px}
      .sec{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#6B7280;margin:22px 0 8px}
      .kv{display:flex;font-size:13px;padding:2px 0}.kv .k{width:110px;color:#6B7280}
      .item{border:1px solid #E5E7EB;border-radius:10px;padding:12px 14px;margin-bottom:10px;break-inside:avoid;page-break-inside:avoid}
      .item-h{display:flex;justify-content:space-between;font-size:15px;margin-bottom:6px}
      .mockups{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 10px}
      .mockup{width:170px;height:170px;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;background:#F9FAFB;display:flex;align-items:center;justify-content:center}
      .mockup img{max-width:100%;max-height:100%;object-fit:contain}
      .nomock{font-size:12px;color:#9CA3AF;font-style:italic;margin:6px 0 8px}
      .row{display:flex;font-size:13px;padding:2px 0}.k{width:90px;color:#6B7280}
      .prow{display:flex;justify-content:space-between;font-size:14px;padding:5px 0;border-bottom:1px solid #F3F4F6}
      .total{display:flex;justify-content:space-between;font-size:18px;font-weight:800;background:#FF5A00;color:#fff;border-radius:10px;padding:12px 16px;margin-top:10px}
      .meta{color:#6B7280;font-size:13px;margin-bottom:4px}
    </style></head><body>
      <h1>${escapeHtml(opts.title)}</h1>
      <div class="sub">${escapeHtml(opts.orgName || 'Katalyst Ko')}</div>
      <div><span class="badge">${escapeHtml(opts.status)}</span>${opts.orderType ? `<span class="badge">${escapeHtml(opts.orderType)}</span>` : ''}</div>
      ${opts.inHandsDate ? `<div class="meta" style="margin-top:10px">Due Date: ${escapeHtml(opts.inHandsDate)}</div>` : ''}
      <div class="sec">Customer Information</div>
      <div class="kv"><span class="k">Customer</span><span>${escapeHtml(opts.orgName || 'Katalyst Ko')}</span></div>
      ${opts.customerName ? `<div class="kv"><span class="k">Contact</span><span>${escapeHtml(opts.customerName)}</span></div>` : ''}
      ${opts.inHandsDate ? `<div class="kv"><span class="k">Due Date</span><span>${escapeHtml(opts.inHandsDate)}</span></div>` : ''}
      <div class="sec">Items</div>
      ${liHtml || '<div class="meta">No items.</div>'}
      <div class="sec">Pricing</div>
      ${priceHtml}
      ${opts.total != null ? `<div class="total"><span>Total</span><span>$${opts.total.toFixed(2)}</span></div>` : ''}
      ${opts.notes ? `<div class="sec">Notes</div><div class="meta">${escapeHtml(opts.notes)}</div>` : ''}
      <div class="sec">Contact Information</div>
      <div class="meta">Katalyst Ko</div>
      <div class="meta">jobs@katalystko.com</div>
      <script>
        (function(){
          var go=function(){try{window.focus();window.print();}catch(e){}};
          var imgs=[].slice.call(document.images);
          var pending=imgs.filter(function(i){return !i.complete;});
          if(!pending.length){setTimeout(go,300);return;}
          var left=pending.length,fired=false;
          var fire=function(){if(fired)return;fired=true;setTimeout(go,250);};
          pending.forEach(function(i){i.addEventListener('load',function(){if(--left<=0)fire();});i.addEventListener('error',function(){if(--left<=0)fire();});});
          setTimeout(function(){if(!fired){fired=true;go();}},6000);
        })();
      </script>
    </body></html>`;
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
}

const NAV_ITEMS: { id: ActiveView; label: string; Icon: React.ComponentType<any> }[] = [
  { id: 'home',     label: 'Dashboard',       Icon: LayoutDashboard },
  { id: 'submit',   label: 'Start a Project',  Icon: ClipboardList },
  { id: 'projects', label: 'My Projects',      Icon: Folder },
  { id: 'artwork',  label: 'Media Bin',        Icon: Layers },
  { id: 'catalogs', label: 'Product Catalogs', Icon: BookOpen },
];

interface ClientSession {
  userId: string;
  userName: string;
  userEmail: string;
  role: string;
  orgName: string;
  orgId: string;
  avatarColor?: string;
  avatarUri?: string | null;
}

const PORTAL_SERVICE_STYLES = [
  'Screen Printing',
  'Direct to Film',
  'Embroidery',
  'Promotional',
  'Not Sure / Other',
];

const PORTAL_ORDER_TYPES = ['New Order', 'Reorder'];

const SIZE_KEYS = ['xs', 's', 'm', 'l', 'xl', 'xxl', 'xxxl', 'xxxxl'] as const;
type SizeKey = (typeof SIZE_KEYS)[number];
const SIZE_LABELS: Record<SizeKey, string> = {
  xs: 'XS', s: 'SM', m: 'MD', l: 'LG', xl: 'XL', xxl: '2XL', xxxl: '3XL', xxxxl: '4XL',
};

interface SizeRow {
  id: string;
  product: string;
  color: string;
  xs: number; s: number; m: number; l: number;
  xl: number; xxl: number; xxxl: number; xxxxl: number;
}

interface PortalLineItem {
  id: string;
  designName: string;
  serviceStyle: string;
  location1: string;
  location2: string;
  location3: string;
  location4: string;
  showLoc3: boolean;
  showLoc4: boolean;
  notes: string;
  sizeRows: SizeRow[];
  mockupFile: PendingFile | null;
  mockupBinFile: { id: string; name: string } | null;
  artworkFiles: PendingFile[];
  collapsed: boolean;
}

let _uid = 0;
function uid() { return `p${++_uid}`; }

function emptyRow(): SizeRow {
  return { id: uid(), product: '', color: '', xs: 0, s: 0, m: 0, l: 0, xl: 0, xxl: 0, xxxl: 0, xxxxl: 0 };
}

function emptyLineItem(): PortalLineItem {
  return {
    id: uid(),
    designName: '',
    serviceStyle: 'Screen Printing',
    location1: 'Left Chest',
    location2: '',
    location3: '',
    location4: '',
    showLoc3: false,
    showLoc4: false,
    notes: '',
    sizeRows: [emptyRow()],
    mockupFile: null,
    mockupBinFile: null,
    artworkFiles: [],
    collapsed: false,
  };
}

function rowTotal(r: SizeRow) {
  return (r.xs || 0) + (r.s || 0) + (r.m || 0) + (r.l || 0) +
    (r.xl || 0) + (r.xxl || 0) + (r.xxxl || 0) + (r.xxxxl || 0);
}

function colTotal(rows: SizeRow[], key: SizeKey) {
  return rows.reduce((acc, r) => acc + (r[key] || 0), 0);
}

function grandTotal(rows: SizeRow[]) {
  return rows.reduce((acc, r) => acc + rowTotal(r), 0);
}

function sizesToPayload(rows: SizeRow[]) {
  const sizes: Record<SizeKey | 'flat', number> = {
    xs: 0, s: 0, m: 0, l: 0, xl: 0, xxl: 0, xxxl: 0, xxxxl: 0, flat: 0,
  };
  for (const r of rows) {
    for (const k of SIZE_KEYS) sizes[k] += r[k] || 0;
  }
  return sizes;
}

function numSize(obj: any, key: string): number {
  if (!obj) return 0;
  const v = obj[key];
  if (typeof v === 'number') return v;
  if (typeof v === 'string') { const n = Number(v); return Number.isFinite(n) ? n : 0; }
  return 0;
}

// Parse a stored File id out of a mockup URI like `/api/files/<id>?inline=true`
// (also tolerates the portal-scoped form). Returns null for data: URIs or
// anything that isn't a server file reference, so reorders never carry an
// un-resolvable inline blob forward.
function fileIdFromMockupUri(uri: any): string | null {
  if (!uri || typeof uri !== 'string' || uri.startsWith('data:')) return null;
  const m = uri.match(/\/api\/(?:portal\/[^/]+\/)?files\/([^/?#]+)/);
  return m ? m[1] : null;
}

// Build editable line-item rows from a source project's sanitized line items
// for the Reorder flow. Copies products / colors / sizes / locations / notes /
// mockup file refs only — never pricing, status, or internal data (the customer
// detail API already strips those before this runs).
function reorderLineItemsFromSource(items: any[]): PortalLineItem[] {
  const mapped = (Array.isArray(items) ? items : []).map((li: any): PortalLineItem => {
    const variants = Array.isArray(li?.garmentVariants) ? li.garmentVariants.filter(Boolean) : [];
    let sizeRows: SizeRow[];
    if (variants.length > 0) {
      sizeRows = variants.map((v: any) => ({
        id: uid(),
        product: v?.product || '',
        color: v?.color || '',
        xs: numSize(v?.sizes, 'xs'), s: numSize(v?.sizes, 's'), m: numSize(v?.sizes, 'm'), l: numSize(v?.sizes, 'l'),
        xl: numSize(v?.sizes, 'xl'), xxl: numSize(v?.sizes, 'xxl'), xxxl: numSize(v?.sizes, 'xxxl'), xxxxl: numSize(v?.sizes, 'xxxxl'),
      }));
    } else {
      sizeRows = [{
        id: uid(),
        product: li?.product || '',
        color: li?.productColor || '',
        xs: numSize(li?.sizes, 'xs'), s: numSize(li?.sizes, 's'), m: numSize(li?.sizes, 'm'), l: numSize(li?.sizes, 'l'),
        xl: numSize(li?.sizes, 'xl'), xxl: numSize(li?.sizes, 'xxl'), xxxl: numSize(li?.sizes, 'xxxl'), xxxxl: numSize(li?.sizes, 'xxxxl'),
      }];
    }
    if (sizeRows.length === 0) sizeRows = [emptyRow()];
    const fileId = fileIdFromMockupUri(li?.mockupUri);
    return {
      id: uid(),
      designName: li?.designName || '',
      serviceStyle: li?.serviceStyle || 'Screen Printing',
      location1: li?.location1 || '',
      location2: li?.location2 || '',
      location3: li?.location3 || '',
      location4: li?.location4 || '',
      showLoc3: !!li?.location3,
      showLoc4: !!li?.location4,
      notes: li?.locationDetails || '',
      sizeRows,
      mockupFile: null,
      mockupBinFile: fileId ? { id: fileId, name: li?.designName ? `${li.designName} Mockup` : 'Mockup' } : null,
      artworkFiles: [],
      collapsed: false,
    };
  });
  return mapped.length > 0 ? mapped : [emptyLineItem()];
}

// ────────────────────────────────────────────────────────────
// Shared dropdown modal
// ────────────────────────────────────────────────────────────
interface DropdownState {
  visible: boolean;
  title: string;
  options: readonly string[];
  selected: string;
  onSelect: (v: string) => void;
}

// ────────────────────────────────────────────────────────────
// Inline mini date calendar (portal styled)
// ────────────────────────────────────────────────────────────
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function parsePortalDate(s: string): Date | null {
  if (!s) return null;
  const m = s.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s*(\d{4})$/);
  if (m) {
    const mi = MONTH_ABBR.findIndex(a => a.toLowerCase() === m[1].toLowerCase().slice(0,3));
    if (mi >= 0) return new Date(+m[3], mi, +m[2]);
  }
  const n = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (n) {
    let y = +n[3]; if (y < 100) y += 2000;
    return new Date(y, +n[1] - 1, +n[2]);
  }
  return null;
}

function formatPortalDate(d: Date): string {
  return `${MONTH_ABBR[d.getMonth()]} ${String(d.getDate()).padStart(2,'0')}, ${d.getFullYear()}`;
}

interface PortalDatePickerProps {
  value: string;
  onChange: (v: string) => void;
  label: string;
  required?: boolean;
  hasError?: boolean;
}

function PortalDatePicker({ value, onChange, label, required, hasError }: PortalDatePickerProps) {
  const [open, setOpen] = useState(false);
  const parsed = parsePortalDate(value);
  const [month, setMonth] = useState(() => {
    const p = parsed;
    return p ? new Date(p.getFullYear(), p.getMonth(), 1) : new Date();
  });

  const openPicker = useCallback(() => {
    const p = parsePortalDate(value);
    setMonth(p ? new Date(p.getFullYear(), p.getMonth(), 1) : new Date());
    setOpen(true);
  }, [value]);

  const select = useCallback((day: number) => {
    const d = new Date(month.getFullYear(), month.getMonth(), day);
    onChange(formatPortalDate(d));
    setOpen(false);
  }, [month, onChange]);

  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const today = new Date();
  const weeks: (number | null)[][] = [];
  let week: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    week.push(d);
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length > 0) { while (week.length < 7) week.push(null); weeks.push(week); }

  const selectedDay = parsed?.getMonth() === month.getMonth() && parsed?.getFullYear() === month.getFullYear()
    ? parsed.getDate() : null;

  return (
    <View style={pFields.container}>
      <Text style={pFields.label}>{label}{required && <Text style={{ color: BRAND }}> *</Text>}</Text>
      <TouchableOpacity
        style={[pFields.dateRow, hasError && pFields.dateRowError]}
        onPress={openPicker}
      >
        <TextInput
          style={pFields.dateText}
          value={value}
          onChangeText={onChange}
          placeholder="MMM DD, YYYY"
          placeholderTextColor={TEXT_PLACEHOLDER}
        />
        <TouchableOpacity onPress={openPicker} style={pFields.calIcon}>
          <Calendar size={16} color={TEXT_LIGHT} />
        </TouchableOpacity>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={pCal.overlay} onPress={() => setOpen(false)}>
          <Pressable style={pCal.card} onPress={() => {}}>
            <View style={pCal.header}>
              <TouchableOpacity onPress={() => setMonth(p => new Date(p.getFullYear(), p.getMonth() - 1, 1))} style={pCal.navBtn}>
                <ChevronLeft size={20} color={TEXT} />
              </TouchableOpacity>
              <Text style={pCal.monthLabel}>{MONTHS[month.getMonth()]} {month.getFullYear()}</Text>
              <TouchableOpacity onPress={() => setMonth(p => new Date(p.getFullYear(), p.getMonth() + 1, 1))} style={pCal.navBtn}>
                <ChevronRight size={20} color={TEXT} />
              </TouchableOpacity>
            </View>
            <View style={pCal.dayHeaders}>
              {DAYS.map(d => <Text key={d} style={pCal.dayHeader}>{d}</Text>)}
            </View>
            {weeks.map((w, wi) => (
              <View key={wi} style={pCal.week}>
                {w.map((day, di) => {
                  const isSelected = day === selectedDay;
                  const isToday = day !== null && today.getMonth() === month.getMonth() && today.getFullYear() === month.getFullYear() && day === today.getDate();
                  return (
                    <TouchableOpacity
                      key={di}
                      style={[pCal.day, isSelected && pCal.daySelected, isToday && !isSelected && pCal.dayToday]}
                      onPress={() => day && select(day)}
                      disabled={!day}
                    >
                      <Text style={[pCal.dayText, isSelected && pCal.dayTextSelected, isToday && !isSelected && pCal.dayTextToday]}>
                        {day || ''}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
            <View style={pCal.footer}>
              <TouchableOpacity style={pCal.todayBtn} onPress={() => { onChange(formatPortalDate(today)); setOpen(false); }}>
                <Text style={pCal.todayBtnText}>Today</Text>
              </TouchableOpacity>
              <TouchableOpacity style={pCal.clearBtn} onPress={() => { onChange(''); setOpen(false); }}>
                <Text style={pCal.clearBtnText}>Clear</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ────────────────────────────────────────────────────────────
// PortalComboCell — searchable + free-text input for table cells
// ────────────────────────────────────────────────────────────
interface PortalComboCellProps {
  value: string;
  onChangeText: (v: string) => void;
  options: readonly string[];
  placeholder: string;
  cellWidth?: number;
  containerStyle?: any;
}

function PortalComboCell({ value, onChangeText, options, placeholder, cellWidth, containerStyle }: PortalComboCellProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = search.trim()
    ? options.filter(o => o.toLowerCase().includes(search.toLowerCase()))
    : options;

  const handleOpen = () => {
    setSearch(value || '');
    setOpen(true);
  };

  const handleSelect = (opt: string) => {
    onChangeText(opt);
    setOpen(false);
    setSearch('');
  };

  const handleConfirmTyped = () => {
    if (search.trim()) onChangeText(search.trim());
    setOpen(false);
    setSearch('');
  };

  const typedIsNew = !!search.trim() && !filtered.some(o => o.toLowerCase() === search.trim().toLowerCase());

  return (
    <View style={[comboCellStyles.wrapper, containerStyle ?? { width: cellWidth }]}>
      <TextInput
        style={[liStyles.sizeInput, { flex: 1, marginHorizontal: 0 }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={TEXT_PLACEHOLDER}
      />
      <TouchableOpacity style={comboCellStyles.chevron} onPress={handleOpen}>
        <ChevronDown size={10} color={TEXT_LIGHT} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={comboCellStyles.overlay} onPress={() => setOpen(false)}>
          <Pressable style={comboCellStyles.card} onPress={() => {}}>
            <Text style={comboCellStyles.cardTitle}>{placeholder}</Text>
            <View style={comboCellStyles.searchRow}>
              <TextInput
                style={comboCellStyles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="Search or type a custom value…"
                placeholderTextColor={TEXT_PLACEHOLDER}
                autoFocus
                onSubmitEditing={handleConfirmTyped}
              />
            </View>
            <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
              {typedIsNew && (
                <TouchableOpacity style={comboCellStyles.customOption} onPress={handleConfirmTyped}>
                  <Edit2 size={12} color={BRAND} />
                  <Text style={comboCellStyles.customOptionText}>Use "{search.trim()}"</Text>
                </TouchableOpacity>
              )}
              {filtered.map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={[comboCellStyles.option, value === opt && comboCellStyles.optionSel]}
                  onPress={() => handleSelect(opt)}
                >
                  <Text style={[comboCellStyles.optionText, value === opt && comboCellStyles.optionTextSel]}>
                    {opt}
                  </Text>
                  {value === opt && <Check size={13} color={BRAND} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ────────────────────────────────────────────────────────────
// PortalLineItemCard
// ────────────────────────────────────────────────────────────
interface PortalLineItemCardProps {
  item: PortalLineItem;
  index: number;
  canDelete: boolean;
  onChange: (updated: PortalLineItem) => void;
  onDelete: () => void;
  openDropdown: (title: string, options: readonly string[], selected: string, onSelect: (v: string) => void) => void;
  onOpenMockupBinPicker: (itemId: string) => void;
}

function PortalLineItemCard({ item, index, canDelete, onChange, onDelete, openDropdown, onOpenMockupBinPicker }: PortalLineItemCardProps) {
  const upd = useCallback((patch: Partial<PortalLineItem>) => onChange({ ...item, ...patch }), [item, onChange]);
  const liFileInputRef = useRef<any>(null);

  const updRow = useCallback((rowId: string, patch: Partial<SizeRow>) => {
    onChange({ ...item, sizeRows: item.sizeRows.map(r => r.id === rowId ? { ...r, ...patch } : r) });
  }, [item, onChange]);

  const addRow = useCallback(() => {
    onChange({ ...item, sizeRows: [...item.sizeRows, emptyRow()] });
  }, [item, onChange]);

  const delRow = useCallback((rowId: string) => {
    const remaining = item.sizeRows.filter(r => r.id !== rowId);
    onChange({ ...item, sizeRows: remaining.length > 0 ? remaining : [emptyRow()] });
  }, [item, onChange]);

  const addMockupFile = useCallback((file: globalThis.File) => {
    const pf: PendingFile = {
      id: `mk${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: file.name, size: file.size, file,
    };
    upd({ mockupFile: pf, mockupBinFile: null });
  }, [upd]);

  const removeMockupFile = useCallback(() => {
    upd({ mockupFile: null });
  }, [upd]);

  const removeMockupBinFile = useCallback(() => {
    upd({ mockupBinFile: null });
  }, [upd]);

  const total = grandTotal(item.sizeRows);
  const isCollapsed = item.collapsed;

  return (
    <View style={liStyles.card}>
      {/* ── Collapsible Header ── */}
      <TouchableOpacity
        style={liStyles.cardHeader}
        onPress={() => upd({ collapsed: !isCollapsed })}
        activeOpacity={0.85}
      >
        <View style={liStyles.cardHeaderLeft}>
          <View style={liStyles.indexBadge}>
            <Text style={liStyles.indexText}>{index + 1}</Text>
          </View>
          <View>
            <Text style={liStyles.cardTitle} numberOfLines={1}>
              {item.designName.trim() || `Line Item ${index + 1}`}
            </Text>
            {isCollapsed && (item.serviceStyle || item.location1) ? (
              <Text style={liStyles.cardSubtitle}>
                {[item.serviceStyle, item.location1].filter(Boolean).join(' · ')}
              </Text>
            ) : null}
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {canDelete && (
            <TouchableOpacity onPress={onDelete} style={liStyles.deleteBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Trash2 size={15} color="#ff6b6b" />
            </TouchableOpacity>
          )}
          <ChevronDown
            size={16}
            color="#fff"
            style={{ transform: [{ rotate: isCollapsed ? '0deg' : '180deg' }] } as any}
          />
        </View>
      </TouchableOpacity>

      {!isCollapsed && (
        <View style={liStyles.cardBody}>
          {/* ── Design Name + Service Style — side by side ── */}
          <View style={[liStyles.twoCol, { marginBottom: 10 }]}>
            <View style={[pFields.container, { flex: 2, marginBottom: 0 }]}>
              <Text style={pFields.label}>Design Name <Text style={{ color: BRAND }}>*</Text></Text>
              <TextInput
                style={pFields.input}
                value={item.designName}
                onChangeText={v => upd({ designName: v })}
                placeholder="e.g. Front Logo, Back Print"
                placeholderTextColor={TEXT_PLACEHOLDER}
              />
            </View>
            <View style={[pFields.container, { flex: 1.5, marginBottom: 0 }]}>
              <Text style={pFields.label}>Service Style</Text>
              <TouchableOpacity
                style={pFields.selectRow}
                onPress={() => openDropdown('Service Style', PORTAL_SERVICE_STYLES, item.serviceStyle, v => upd({ serviceStyle: v }))}
              >
                <Text style={[pFields.selectText, !item.serviceStyle && pFields.selectPlaceholder]}>
                  {item.serviceStyle || 'Select…'}
                </Text>
                <ChevronDown size={15} color={TEXT_LIGHT} />
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Locations ── */}
          <View style={[liStyles.twoCol, { marginBottom: 10 }]}>
            <View style={[pFields.container, { flex: 1, marginBottom: 0 }]}>
              <Text style={pFields.label}>Location #1</Text>
              <TouchableOpacity
                style={pFields.selectRow}
                onPress={() => openDropdown('Location #1', LOCATIONS, item.location1, v => upd({ location1: v }))}
              >
                <Text style={[pFields.selectText, !item.location1 && pFields.selectPlaceholder]} numberOfLines={1}>
                  {item.location1 || 'Select…'}
                </Text>
                <ChevronDown size={14} color={TEXT_LIGHT} />
              </TouchableOpacity>
            </View>
            <View style={[pFields.container, { flex: 1, marginBottom: 0 }]}>
              <Text style={pFields.label}>Location #2</Text>
              <TouchableOpacity
                style={pFields.selectRow}
                onPress={() => openDropdown('Location #2', LOCATIONS, item.location2, v => upd({ location2: v }))}
              >
                <Text style={[pFields.selectText, !item.location2 && pFields.selectPlaceholder]} numberOfLines={1}>
                  {item.location2 || 'Select…'}
                </Text>
                <ChevronDown size={14} color={TEXT_LIGHT} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Loc 3 / 4 */}
          {(item.showLoc3 || item.showLoc4) && (
            <View style={[liStyles.twoCol, { marginBottom: 10 }]}>
              {item.showLoc3 && (
                <View style={[pFields.container, { flex: 1, marginBottom: 0 }]}>
                  <Text style={pFields.label}>Location #3</Text>
                  <TouchableOpacity
                    style={pFields.selectRow}
                    onPress={() => openDropdown('Location #3', LOCATIONS, item.location3, v => upd({ location3: v }))}
                  >
                    <Text style={[pFields.selectText, !item.location3 && pFields.selectPlaceholder]} numberOfLines={1}>
                      {item.location3 || 'Select…'}
                    </Text>
                    <ChevronDown size={14} color={TEXT_LIGHT} />
                  </TouchableOpacity>
                </View>
              )}
              {item.showLoc4 && (
                <View style={[pFields.container, { flex: 1, marginBottom: 0 }]}>
                  <Text style={pFields.label}>Location #4</Text>
                  <TouchableOpacity
                    style={pFields.selectRow}
                    onPress={() => openDropdown('Location #4', LOCATIONS, item.location4, v => upd({ location4: v }))}
                  >
                    <Text style={[pFields.selectText, !item.location4 && pFields.selectPlaceholder]} numberOfLines={1}>
                      {item.location4 || 'Select…'}
                    </Text>
                    <ChevronDown size={14} color={TEXT_LIGHT} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          <View style={[liStyles.addLocRow, { marginTop: 0, marginBottom: 10 }]}>
            {!item.showLoc3 && (
              <TouchableOpacity style={liStyles.addLocBtn} onPress={() => upd({ showLoc3: true })}>
                <Plus size={12} color={BRAND} />
                <Text style={liStyles.addLocText}>Add Location #3</Text>
              </TouchableOpacity>
            )}
            {item.showLoc3 && !item.showLoc4 && (
              <TouchableOpacity style={liStyles.addLocBtn} onPress={() => upd({ showLoc4: true })}>
                <Plus size={12} color={BRAND} />
                <Text style={liStyles.addLocText}>Add Location #4</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ── Products + Sizes ── */}
          <View style={liStyles.sizeSection}>
            <Text style={liStyles.sizeSectionTitle}>Products + Sizes</Text>

            {item.sizeRows.map((row, rIdx) => {
              const rt = rowTotal(row);
              return (
                <View key={row.id} style={[liStyles.sizeVariantRow, rIdx % 2 === 1 && liStyles.sizeVariantRowAlt]}>
                  {/* Row A: Product + Color + Delete */}
                  <View style={liStyles.sizePickerRow}>
                    <PortalComboCell
                      value={row.product}
                      onChangeText={v => updRow(row.id, { product: v })}
                      options={PRODUCTS}
                      placeholder="Style / Product"
                      containerStyle={{ flex: 2, marginHorizontal: 0 }}
                    />
                    <PortalComboCell
                      value={row.color}
                      onChangeText={v => updRow(row.id, { color: v })}
                      options={PRODUCT_COLORS}
                      placeholder="Color"
                      containerStyle={{ flex: 1, marginHorizontal: 0 }}
                    />
                    <TouchableOpacity style={liStyles.delRowBtn} onPress={() => delRow(row.id)}>
                      <Trash2 size={12} color="#DC2626" />
                    </TouchableOpacity>
                  </View>
                  {/* Row B: Size inputs */}
                  <View style={liStyles.sizeCellsRow}>
                    {SIZE_KEYS.map(k => (
                      <View key={k} style={liStyles.sizeCellCol}>
                        <Text style={liStyles.sizeColLabel}>{SIZE_LABELS[k]}</Text>
                        <TextInput
                          style={liStyles.sizeColInput}
                          value={row[k] ? String(row[k]) : ''}
                          onChangeText={v => updRow(row.id, { [k]: parseInt(v) || 0 } as any)}
                          placeholder="0"
                          placeholderTextColor={TEXT_PLACEHOLDER}
                          keyboardType="number-pad"
                        />
                      </View>
                    ))}
                    <View style={liStyles.sizeTotalCol}>
                      <Text style={liStyles.sizeColLabel}>Total</Text>
                      <Text style={liStyles.sizeTotalValue}>{rt > 0 ? rt : '—'}</Text>
                    </View>
                  </View>
                </View>
              );
            })}

            {/* Column totals row — only when multiple rows */}
            {item.sizeRows.length > 1 && (
              <View style={liStyles.sizeSumRow}>
                <Text style={liStyles.sizeSumLabel}>Totals</Text>
                <View style={{ flex: 1, flexDirection: 'row' }}>
                  {SIZE_KEYS.map(k => (
                    <View key={k} style={{ flex: 1, alignItems: 'center' }}>
                      <Text style={liStyles.sizeSumValue}>{colTotal(item.sizeRows, k) || ''}</Text>
                    </View>
                  ))}
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={[liStyles.sizeSumValue, { color: '#15803D', fontWeight: '700' }]}>{total}</Text>
                  </View>
                </View>
              </View>
            )}

            <TouchableOpacity style={liStyles.addRowBtn} onPress={addRow}>
              <Plus size={12} color={BRAND} />
              <Text style={liStyles.addRowText}>Add Garment / Style</Text>
            </TouchableOpacity>

            {total > 0 && (
              <View style={liStyles.grandTotalRow}>
                <Text style={liStyles.grandTotalLabel}>Grand Total</Text>
                <Text style={liStyles.grandTotalValue}>{total} pcs</Text>
              </View>
            )}
          </View>

          {/* ── Line Item Notes ── */}
          <View style={[pFields.container, { marginBottom: 10 }]}>
            <Text style={pFields.label}>Line Item Notes</Text>
            <TextInput
              style={pFields.textarea}
              value={item.notes}
              onChangeText={v => upd({ notes: v })}
              placeholder="Design details, artwork notes, special instructions for this item…"
              placeholderTextColor={TEXT_PLACEHOLDER}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* ── Per-Item Mockup Upload ── */}
          <View style={liStyles.artworkSection}>
            <Text style={pFields.label}>Mockup</Text>
            <Text style={liStyles.mockupBlurb}>
              Please use this upload area to share a mockup with us (not required). For all actual artwork files, please upload at the end of the form.
            </Text>
            {Platform.OS === 'web' && (
              <input
                ref={liFileInputRef}
                type="file"
                accept=".ai,.svg,.ps,.png,.jpg,.jpeg,.pdf,.emb,.dst,.pes"
                multiple={false}
                style={{ display: 'none' }}
                onChange={(e: any) => {
                  const files = Array.from((e.target.files || []) as globalThis.File[]);
                  if (files[0]) addMockupFile(files[0]);
                  e.target.value = '';
                }}
              />
            )}
            {item.mockupFile ? (
              <View style={liStyles.artworkFileList}>
                <View style={liStyles.artworkFileRow}>
                  <FileText size={12} color={BRAND} style={{ flexShrink: 0 }} />
                  <Text style={liStyles.artworkFileName} numberOfLines={1}>{item.mockupFile.name}</Text>
                  <Text style={liStyles.artworkFileSize}>
                    {item.mockupFile.size < 1048576 ? `${(item.mockupFile.size / 1024).toFixed(0)} KB` : `${(item.mockupFile.size / 1048576).toFixed(1)} MB`}
                  </Text>
                  <TouchableOpacity onPress={removeMockupFile} style={{ padding: 4 }}>
                    <X size={13} color={TEXT_LIGHT} />
                  </TouchableOpacity>
                </View>
              </View>
            ) : item.mockupBinFile ? (
              <View style={liStyles.artworkFileList}>
                <View style={liStyles.artworkFileRow}>
                  <Library size={12} color={BRAND} style={{ flexShrink: 0 }} />
                  <Text style={liStyles.artworkFileName} numberOfLines={1}>{item.mockupBinFile.name}</Text>
                  <Text style={liStyles.artworkFileSize}>Media Bin</Text>
                  <TouchableOpacity onPress={removeMockupBinFile} style={{ padding: 4 }}>
                    <X size={13} color={TEXT_LIGHT} />
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                <TouchableOpacity
                  style={liStyles.artworkDropZone}
                  onPress={() => liFileInputRef.current?.click?.()}
                  activeOpacity={0.85}
                >
                  <Upload size={16} color="#9CA3AF" />
                  <Text style={liStyles.artworkDropText}>Click to attach a mockup (1 file)</Text>
                  <Text style={liStyles.artworkDropSub}>AI · SVG · PS · PNG · JPG · PDF · EMB · DST · PES</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={liStyles.binPickLink}
                  onPress={() => onOpenMockupBinPicker(item.id)}
                  activeOpacity={0.7}
                >
                  <Library size={12} color={BRAND} />
                  <Text style={liStyles.binPickLinkText}>Choose from Media Bin</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

// ────────────────────────────────────────────────────────────
// Main Portal Component
// ────────────────────────────────────────────────────────────
export default function ClientPortal() {
  const { orgId, tab } = useLocalSearchParams<{ orgId: string; tab?: string }>();
  const { isMobile, isTablet } = useBreakpoint();

  const [step, setStep] = useState<Step>('email');
  const [session, setSession] = useState<ClientSession | null>(null);

  const [email, setEmail] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [forgotSending, setForgotSending] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const [projectName, setProjectName] = useState('');
  const [orderType, setOrderType] = useState('New Order');
  const [inHandsDate, setInHandsDate] = useState('');
  const [requestNotes, setRequestNotes] = useState('');
  const [lineItems, setLineItems] = useState<PortalLineItem[]>([emptyLineItem()]);
  // Non-null while the submit form is in "Review Your Reorder" mode; holds the
  // source project id so the new request links back to it on submit.
  const [reorderSourceId, setReorderSourceId] = useState<string | null>(null);

  const [formErrors, setFormErrors] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submittedId, setSubmittedId] = useState('');
  const [submittedAt, setSubmittedAt] = useState<Date | null>(null);
  const [submissionEmailSent, setSubmissionEmailSent] = useState(false);
  const [editSecondsLeft, setEditSecondsLeft] = useState(0);
  const [cancelling, setCancelling] = useState(false);

  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const [mediaBinFiles, setMediaBinFiles] = useState<MediaFile[]>([]);
  const [mediaBinLoading, setMediaBinLoading] = useState(false);
  const [mediaBinUploading, setMediaBinUploading] = useState(false);
  const [isDraggingMB, setIsDraggingMB] = useState(false);
  const [isDraggingDashMB, setIsDraggingDashMB] = useState(false);
  const [mediaBinSearch, setMediaBinSearch] = useState('');
  const [mediaBinFilter, setMediaBinFilter] = useState<string>('All');
  const [mediaBinSort, setMediaBinSort] = useState<'Newest' | 'Oldest' | 'A-Z'>('Newest');
  const [mediaBinGridSize, setMediaBinGridSize] = useState<4 | 6 | 8>(6);
  const [catSearch, setCatSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');

  const [artworkFromBin, setArtworkFromBin] = useState<MediaFile[]>([]);
  const [binPickerVisible, setBinPickerVisible] = useState(false);
  const [binPickerTarget, setBinPickerTarget] = useState<'mockup' | 'artwork'>('artwork');
  const [binPickerLineItemId, setBinPickerLineItemId] = useState<string | null>(null);
  const [binPickerSearch, setBinPickerSearch] = useState('');
  const [renamingPortalFileId, setRenamingPortalFileId] = useState<string | null>(null);
  const [renamePortalText, setRenamePortalText] = useState('');

  const [teamMembers, setTeamMembers] = useState<Array<{
    id: string; name: string; email: string; status: string; role: string;
  }>>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamInviteEmail, setTeamInviteEmail] = useState('');
  const [teamInviting, setTeamInviting] = useState(false);
  const [teamInviteError, setTeamInviteError] = useState('');
  const [teamInviteSuccess, setTeamInviteSuccess] = useState('');
  const [profileAvatarColor, setProfileAvatarColor] = useState<string>(BRAND);
  const [profilePicUri, setProfilePicUri] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaveMsg, setProfileSaveMsg] = useState('');
  const [orgLogoSaving, setOrgLogoSaving] = useState(false);
  const [orgLogoSaveMsg, setOrgLogoSaveMsg] = useState('');
  const [orgPhone, setOrgPhone] = useState<string | null>(null);
  const [orgEmail, setOrgEmail] = useState<string | null>(null);
  const profilePicInputRef = useRef<any>(null);
  const orgLogoInputRef = useRef<any>(null);

  const [mpSearch, setMpSearch] = useState('');
  const [mpStatusFilter, setMpStatusFilter] = useState<string | null>(null);
  const [mpDateFrom, setMpDateFrom] = useState('');
  const [mpDateTo, setMpDateTo] = useState('');
  const [mpCostMin, setMpCostMin] = useState('');
  const [mpCostMax, setMpCostMax] = useState('');
  const [mpShowFilters, setMpShowFilters] = useState(false);
  type MpSortField = 'status' | 'project' | 'submitted' | 'order' | 'inHands' | 'items' | 'total';
  const [mpSortField, setMpSortField] = useState<MpSortField>('submitted');
  const [mpSortDir, setMpSortDir] = useState<'asc' | 'desc'>('desc');
  const [mpPage, setMpPage] = useState(1);

  const fileInputRef = useRef<any>(null);
  const mediaBinInputRef = useRef<any>(null);
  const dropZoneRef = useRef<any>(null);
  const mediaBinDropRef = useRef<any>(null);
  const dashMBDropRef = useRef<any>(null);

  const [activeView, setActiveView] = useState<ActiveView>('home');
  const [orgProjects, setOrgProjects] = useState<PortalProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<FullPortalProject | null>(null);
  const [favoriteProjectIds, setFavoriteProjectIds] = useState<string[]>([]);
  const [quoteActionModal, setQuoteActionModal] = useState<null | { action: 'approve' | 'request_changes' | 'decline' }>(null);
  const [quoteActionNote, setQuoteActionNote] = useState('');
  const [quoteActionSubmitting, setQuoteActionSubmitting] = useState(false);
  const [quoteActionError, setQuoteActionError] = useState<string | null>(null);

  // Favorites are DB-backed (per customer + org), so they survive device,
  // browser, and re-login changes. Loaded on login; toggled optimistically.
  const fetchFavorites = useCallback(async (oid: string, uid: string) => {
    try {
      const res = await fetch(`/api/portal/${oid}/favorites?userId=${encodeURIComponent(uid)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.projectIds)) setFavoriteProjectIds(data.projectIds);
      }
    } catch {}
  }, []);

  const toggleFavorite = useCallback((projectId: string) => {
    if (!session) return;
    const wasFavorite = favoriteProjectIds.includes(projectId);
    // Optimistic flip, reconciled with the server's authoritative result below.
    setFavoriteProjectIds(prev =>
      prev.includes(projectId) ? prev.filter(id => id !== projectId) : [...prev, projectId]
    );
    fetch(`/api/portal/${session.orgId}/favorites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: session.userId, projectId }),
    })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('toggle failed'))))
      .then((data: { favorited?: boolean }) => {
        if (typeof data.favorited === 'boolean') {
          setFavoriteProjectIds(prev => {
            const has = prev.includes(projectId);
            if (data.favorited && !has) return [...prev, projectId];
            if (!data.favorited && has) return prev.filter(id => id !== projectId);
            return prev;
          });
        }
      })
      .catch(() => {
        // Revert to the pre-click state on failure.
        setFavoriteProjectIds(prev => {
          const has = prev.includes(projectId);
          if (wasFavorite && !has) return [...prev, projectId];
          if (!wasFavorite && has) return prev.filter(id => id !== projectId);
          return prev;
        });
      });
  }, [session, favoriteProjectIds]);

  const handleReorderProject = useCallback(async (projectId: string, title: string) => {
    if (!session) return;
    // Reset any prior submission state, prefill from the source project, and
    // enter "Review Your Reorder" mode. reorderSourceId drives the heading and
    // links the new request back to its source on submit.
    setSubmittedId('');
    setSubmittedAt(null);
    setSubmissionEmailSent(false);
    setSubmitError('');
    setFormErrors({});
    setPendingFiles([]);
    setArtworkFromBin([]);
    setProjectName(title || '');
    setOrderType('Reorder');
    setInHandsDate('');
    setRequestNotes('');
    setLineItems([emptyLineItem()]);
    setReorderSourceId(projectId);
    setActiveView('submit');
    try {
      const res = await fetch(`/api/portal/${session.orgId}/projects/${projectId}`);
      if (res.ok) {
        const data = await res.json();
        setLineItems(reorderLineItemsFromSource(data.lineItemsData || []));
        if (data.notesClient) setRequestNotes(data.notesClient);
      }
    } catch {}
  }, [session]);
  const [projectViewLoading, setProjectViewLoading] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const sidebarWidthAnim = useRef(new Animated.Value(210)).current;
  // Mobile nav drawer (Client Hub) — emulates the main-site mobile sidebar
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const mobileDrawerTx = useRef(new Animated.Value(-MOBILE_DRAWER_W)).current;
  const mobileScrimOpacity = useRef(new Animated.Value(0)).current;

  const [clientCatalogs, setClientCatalogs] = useState<Array<{
    id: string; name: string; description: string | null; vendorName: string | null;
    category: string; catalogUrl: string; websiteUrl: string | null;
    coverImageUrl: string | null;
  }>>([]);
  const [catalogsLoading, setCatalogsLoading] = useState(false);

  useEffect(() => {
    if (activeView !== 'catalogs') return;
    setCatalogsLoading(true);
    fetch('/api/client-catalogs?clientHub=1')
      .then(r => r.ok ? r.json() : [])
      .then(data => setClientCatalogs(Array.isArray(data) ? data : []))
      .catch(() => setClientCatalogs([]))
      .finally(() => setCatalogsLoading(false));
  }, [activeView]);

  const [orgLogoUrl, setOrgLogoUrl] = useState<string | null>(null);
  const [orgLogoDims, setOrgLogoDims] = useState<{ w: number; h: number } | null>(null);
  const [orgDisplayName, setOrgDisplayName] = useState<string>('');
  const [hubDisabled, setHubDisabled] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    fetch(`/api/portal/${orgId}`)
      .then(r => {
        if (!r.ok) { setHubDisabled(true); return null; }
        return r.json();
      })
      .then(data => {
        if (!data) return;
        if (data.logoUrl) {
          // Rewrite Clerk-gated /api/files/{id} → public /api/portal/{orgId}/files/{id}
          const raw: string = data.logoUrl;
          const m = raw.match(/\/api\/files\/([^?]+)/);
          const publicUrl = m
            ? `/api/portal/${orgId}/files/${m[1]}?inline=true`
            : raw;
          setOrgLogoUrl(publicUrl);
        }
        if (data.name) setOrgDisplayName(data.name);
        if (data.phone) setOrgPhone(data.phone);
        if (data.email) setOrgEmail(data.email);
      })
      .catch(() => {});
  }, [orgId]);

  useEffect(() => {
    if (!orgLogoUrl) { setOrgLogoDims(null); return; }
    Image.getSize(orgLogoUrl, (w, h) => setOrgLogoDims({ w, h }), () => setOrgLogoDims(null));
  }, [orgLogoUrl]);

  const SIDEBAR_INNER_W = 174; // sidebar 210px - 18px*2 padding
  const LOGO_MAX = SIDEBAR_INNER_W * 0.9;
  const sidebarLogoStyle = (() => {
    if (!orgLogoDims) return { width: LOGO_MAX, height: 40 };
    const { w, h } = orgLogoDims;
    if (w >= h) {
      return { width: LOGO_MAX, height: LOGO_MAX * (h / w) };
    } else {
      return { width: LOGO_MAX * (w / h), height: LOGO_MAX };
    }
  })();

  const EDIT_WINDOW_MS = 10 * 60 * 1000;

  useEffect(() => {
    if (!submittedAt) { setEditSecondsLeft(0); return; }
    const tick = () => {
      const remaining = Math.max(0, EDIT_WINDOW_MS - (Date.now() - submittedAt.getTime()));
      setEditSecondsLeft(Math.ceil(remaining / 1000));
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [submittedAt]);

  const [dropdown, setDropdown] = useState<DropdownState>({
    visible: false, title: '', options: [], selected: '', onSelect: () => {},
  });

  const openDropdown = useCallback((
    title: string,
    options: readonly string[],
    selected: string,
    onSelect: (v: string) => void,
  ) => {
    setDropdown({ visible: true, title, options, selected, onSelect });
  }, []);

  useEffect(() => {
    if (step === 'dashboard' && tab === 'projects') {
      setActiveView('projects');
    }
  }, [step, tab]);

  const fetchOrgProjects = useCallback(async (oid: string) => {
    setProjectsLoading(true);
    try {
      const res = await fetch(`/api/portal/${oid}/projects`);
      if (res.ok) {
        const data = await res.json();
        setOrgProjects(data);
      }
    } catch {}
    setProjectsLoading(false);
  }, []);

  const handleViewProject = useCallback(async (projectId: string) => {
    if (!session) return;
    setSelectedProjectId(projectId);
    setSelectedProject(null);
    setActiveView('project-view');
    setProjectViewLoading(true);
    try {
      const res = await fetch(`/api/portal/${session.orgId}/projects/${projectId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedProject(data);
        // Fire-and-forget: record that the customer viewed this quote. The API
        // only records a view for an unviewed QUOTE_SENT quote (idempotent).
        fetch(`/api/portal/${session.orgId}/projects/${projectId}/quote-response`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: session.userId, action: 'view' }),
        }).catch(() => {});
      }
    } catch {}
    setProjectViewLoading(false);
  }, [session]);

  const submitQuoteResponse = useCallback(async (action: 'approve' | 'request_changes' | 'decline', note: string) => {
    if (!session || !selectedProjectId) return;
    setQuoteActionSubmitting(true);
    setQuoteActionError(null);
    try {
      const res = await fetch(`/api/portal/${session.orgId}/projects/${selectedProjectId}/quote-response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: session.userId, action, note }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setQuoteActionModal(null);
        setQuoteActionNote('');
        // Refetch the detail so the banner + timeline reflect the new state,
        // and refresh the list so the card badge updates.
        const ref = await fetch(`/api/portal/${session.orgId}/projects/${selectedProjectId}`);
        if (ref.ok) setSelectedProject(await ref.json());
        fetchOrgProjects(session.orgId);
      } else {
        setQuoteActionError(data.error || 'Something went wrong. Please try again.');
      }
    } catch {
      setQuoteActionError('Network error. Please try again.');
    }
    setQuoteActionSubmitting(false);
  }, [session, selectedProjectId, fetchOrgProjects]);

  const fetchMediaBin = useCallback(async (oid: string) => {
    setMediaBinLoading(true);
    try {
      const res = await fetch(`/api/portal/${oid}/files`);
      if (res.ok) {
        const data = await res.json();
        setMediaBinFiles(data.files || []);
      }
    } catch {}
    setMediaBinLoading(false);
  }, []);

  const fetchTeam = useCallback(async (oid: string) => {
    setTeamLoading(true);
    try {
      const res = await fetch(`/api/portal/team?orgId=${oid}`);
      if (res.ok) { const d = await res.json(); setTeamMembers(d.members || []); }
    } catch {}
    setTeamLoading(false);
  }, []);

  const openBinPicker = useCallback((target: 'mockup' | 'artwork', lineItemId?: string) => {
    setBinPickerTarget(target);
    setBinPickerLineItemId(lineItemId || null);
    setBinPickerSearch('');
    setBinPickerVisible(true);
    if (session && mediaBinFiles.length === 0) fetchMediaBin(session.orgId);
  }, [session, mediaBinFiles.length, fetchMediaBin]);

  const handleBinPickerSelect = useCallback((file: MediaFile) => {
    setBinPickerVisible(false);
    if (binPickerTarget === 'mockup' && binPickerLineItemId) {
      setLineItems(prev => prev.map(li =>
        li.id === binPickerLineItemId
          ? { ...li, mockupBinFile: { id: file.id, name: file.originalName }, mockupFile: null }
          : li
      ));
    } else if (binPickerTarget === 'artwork') {
      setArtworkFromBin(prev => prev.find(f => f.id === file.id) ? prev : [...prev, file]);
    }
  }, [binPickerTarget, binPickerLineItemId]);

  const handleRenamePortalFile = useCallback(async (fileId: string, newName: string) => {
    if (!session || !newName.trim()) { setRenamingPortalFileId(null); return; }
    setMediaBinFiles(prev => prev.map(f => f.id === fileId ? { ...f, originalName: newName.trim() } : f));
    setRenamingPortalFileId(null);
    try {
      await fetch(`/api/portal/${session.orgId}/files/${fileId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ originalName: newName.trim() }),
      });
    } catch {}
  }, [session]);

  const handleFilesAdded = useCallback((rawFiles: globalThis.File[]) => {
    const allowed = rawFiles.filter(f => {
      const n = f.name.toLowerCase();
      return n.endsWith('.ai') || n.endsWith('.svg') || n.endsWith('.ps')
        || n.endsWith('.png') || n.endsWith('.jpg') || n.endsWith('.jpeg')
        || n.endsWith('.pdf') || n.endsWith('.emb') || n.endsWith('.dst') || n.endsWith('.pes');
    });
    if (allowed.length === 0) return;
    setPendingFiles(prev => [
      ...prev,
      ...allowed.map(f => ({ id: Math.random().toString(36).slice(2), name: f.name, size: f.size, file: f })),
    ]);
  }, []);

  const removePendingFile = useCallback((id: string) => {
    setPendingFiles(prev => prev.filter(f => f.id !== id));
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || !dropZoneRef.current) return;
    const el = dropZoneRef.current as any;
    const onDragOver = (e: any) => { e.preventDefault(); setIsDraggingOver(true); };
    const onDragLeave = () => setIsDraggingOver(false);
    const onDrop = (e: any) => {
      e.preventDefault();
      setIsDraggingOver(false);
      const files = Array.from((e.dataTransfer?.files || []) as globalThis.File[]);
      handleFilesAdded(files);
    };
    el.addEventListener('dragover', onDragOver);
    el.addEventListener('dragleave', onDragLeave);
    el.addEventListener('drop', onDrop);
    return () => {
      el.removeEventListener('dragover', onDragOver);
      el.removeEventListener('dragleave', onDragLeave);
      el.removeEventListener('drop', onDrop);
    };
  }, [handleFilesAdded, activeView]);

  useEffect(() => {
    if (Platform.OS !== 'web' || activeView !== 'artwork') return;
    const onDragOver = (e: any) => { e.preventDefault(); setIsDraggingMB(true); };
    const onDragLeave = (e: any) => { if (!e.relatedTarget) setIsDraggingMB(false); };
    const onDrop = (e: any) => {
      e.preventDefault();
      setIsDraggingMB(false);
      if (!session) return;
      const files = Array.from((e.dataTransfer?.files || []) as globalThis.File[]);
      if (files.length === 0) return;
      handleMediaBinUpload(files);
    };
    document.addEventListener('dragover', onDragOver);
    document.addEventListener('dragleave', onDragLeave);
    document.addEventListener('drop', onDrop);
    return () => {
      document.removeEventListener('dragover', onDragOver);
      document.removeEventListener('dragleave', onDragLeave);
      document.removeEventListener('drop', onDrop);
    };
  }, [activeView, session]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !dashMBDropRef.current) return;
    const el = dashMBDropRef.current as any;
    const onDragOver = (e: any) => { e.preventDefault(); setIsDraggingDashMB(true); };
    const onDragLeave = (e: any) => { if (!el.contains(e.relatedTarget)) setIsDraggingDashMB(false); };
    const onDrop = (e: any) => {
      e.preventDefault();
      setIsDraggingDashMB(false);
      if (!session) return;
      const files = Array.from((e.dataTransfer?.files || []) as globalThis.File[]);
      if (files.length === 0) return;
      handleMediaBinUpload(files);
    };
    el.addEventListener('dragover', onDragOver);
    el.addEventListener('dragleave', onDragLeave);
    el.addEventListener('drop', onDrop);
    return () => {
      el.removeEventListener('dragover', onDragOver);
      el.removeEventListener('dragleave', onDragLeave);
      el.removeEventListener('drop', onDrop);
    };
  }, [session]);

  const handleMediaBinUpload = useCallback(async (rawFiles: globalThis.File[]) => {
    if (!session) return;
    const allowed = rawFiles.filter(f => {
      const n = f.name.toLowerCase();
      return n.endsWith('.ai') || n.endsWith('.svg') || n.endsWith('.ps')
        || n.endsWith('.png') || n.endsWith('.jpg') || n.endsWith('.jpeg')
        || n.endsWith('.pdf') || n.endsWith('.emb') || n.endsWith('.dst') || n.endsWith('.pes');
    });
    if (allowed.length === 0) {
      Alert.alert('Unsupported file type', 'Allowed: AI, SVG, PS, PNG, JPG, PDF, EMB, DST, PES');
      return;
    }
    setMediaBinUploading(true);
    for (const f of allowed) {
      const fd = new FormData();
      fd.append('file', f);
      fd.append('uploadedByUserId', session.userId);
      fd.append('fileType', 'ARTWORK');
      fd.append('visibility', 'CLIENT_VISIBLE');
      try {
        const res = await fetch(`/api/portal/${session.orgId}/upload`, { method: 'POST', body: fd });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          Alert.alert('Upload failed', err?.error || `Could not upload "${f.name}".`);
        }
      } catch {
        Alert.alert('Upload failed', `Network error uploading "${f.name}".`);
      }
    }
    await fetchMediaBin(session.orgId);
    setMediaBinUploading(false);
  }, [session, fetchMediaBin]);

  const deleteMediaBinFile = useCallback(async (fileId: string) => {
    if (!session) return;
    await fetch(`/api/portal/${session.orgId}/files/${fileId}`, { method: 'DELETE' }).catch(() => {});
    setMediaBinFiles(prev => prev.filter(f => f.id !== fileId));
  }, [session]);

  const handleSignOut = useCallback(() => {
    setSession(null);
    setStep('email');
    setActiveView('home');
    setOrgProjects([]);
    setEmail('');
  }, []);

  const toggleSidebar = useCallback(() => {
    const toValue = sidebarCollapsed ? 210 : 56;
    Animated.timing(sidebarWidthAnim, {
      toValue,
      duration: 200,
      useNativeDriver: false,
    }).start();
    setSidebarCollapsed(c => !c);
  }, [sidebarCollapsed, sidebarWidthAnim]);

  const openMobileNav = useCallback(() => {
    setMobileNavOpen(true);
    Animated.parallel([
      Animated.timing(mobileDrawerTx, { toValue: 0, duration: 220, useNativeDriver: false }),
      Animated.timing(mobileScrimOpacity, { toValue: 1, duration: 220, useNativeDriver: false }),
    ]).start();
  }, [mobileDrawerTx, mobileScrimOpacity]);

  const closeMobileNav = useCallback(() => {
    Animated.parallel([
      Animated.timing(mobileDrawerTx, { toValue: -MOBILE_DRAWER_W, duration: 200, useNativeDriver: false }),
      Animated.timing(mobileScrimOpacity, { toValue: 0, duration: 200, useNativeDriver: false }),
    ]).start(() => setMobileNavOpen(false));
  }, [mobileDrawerTx, mobileScrimOpacity]);

  // Reset the mobile drawer instantly if the viewport grows past the mobile breakpoint
  useEffect(() => {
    if (!isMobile && mobileNavOpen) {
      setMobileNavOpen(false);
      mobileDrawerTx.setValue(-MOBILE_DRAWER_W);
      mobileScrimOpacity.setValue(0);
    }
  }, [isMobile, mobileNavOpen, mobileDrawerTx, mobileScrimOpacity]);

  const handleForgotPassword = useCallback(async () => {
    const trimmed = email.trim();
    if (!trimmed) { setEmailError('Enter your email address first, then click Forgot password.'); return; }
    setForgotSending(true);
    try {
      await fetch('/api/portal/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed, orgId }),
      });
      setForgotSent(true);
    } catch {}
    setForgotSending(false);
  }, [email, orgId]);

  const handleEmailSubmit = useCallback(async () => {
    const trimmed = email.trim();
    if (!trimmed) { setEmailError('Please enter your email address.'); return; }
    setEmailLoading(true);
    setEmailError('');
    try {
      const res = await fetch(`/api/portal/${orgId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) { setEmailError(data.error || 'Could not verify your email.'); return; }
      setSession(data);
      setProfileAvatarColor(data.avatarColor || BRAND);
      setProfilePicUri(data.avatarUri || null);
      setStep('dashboard');
      setActiveView('home');
      fetchOrgProjects(data.orgId);
      if (data.userId) fetchFavorites(data.orgId, data.userId);
    } catch {
      setEmailError('Connection error. Please try again.');
    } finally {
      setEmailLoading(false);
    }
  }, [email, orgId, fetchOrgProjects, fetchFavorites]);

  const handleSubmit = useCallback(async () => {
    if (!session) return;
    const errors: Record<string, boolean> = {};
    if (!projectName.trim()) errors.projectName = true;
    if (!inHandsDate.trim()) errors.inHandsDate = true;
    lineItems.forEach((item, i) => {
      if (!item.designName.trim()) errors[`item_${i}_name`] = true;
    });
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      setSubmitError('Please fill in the required fields marked with *');
      return;
    }

    setSubmitting(true);
    setSubmitError('');
    setFormErrors({});

    try {
      // Pre-upload mockup files (one per line item) to get their URLs for the admin view
      const mockupUris: Record<string, string> = {};
      for (const item of lineItems) {
        if (item.mockupBinFile) {
          mockupUris[item.id] = `/api/files/${item.mockupBinFile.id}?inline=true`;
        } else if (item.mockupFile) {
          const fd = new FormData();
          fd.append('file', item.mockupFile.file);
          fd.append('orgId', session.orgId);
          fd.append('uploadedByUserId', session.userId);
          fd.append('fileType', 'MOCKUP');
          fd.append('visibility', 'CLIENT_VISIBLE');
          try {
            const uploadRes = await fetch('/api/files', { method: 'POST', body: fd });
            if (uploadRes.ok) {
              const uploadData = await uploadRes.json();
              if (uploadData.file?.id) {
                mockupUris[item.id] = `/api/files/${uploadData.file.id}?inline=true`;
              }
            }
          } catch { /* non-fatal */ }
        }
      }

      const payload = {
        orgId: session.orgId,
        userId: session.userId,
        orgName: session.orgName,
        title: projectName.trim(),
        orderType,
        inHandsDate,
        notes: requestNotes.trim() || null,
        reorderedFromProjectId: reorderSourceId || null,
        lineItems: lineItems.map(item => ({
          id: item.id,
          designName: item.designName.trim(),
          serviceStyle: item.serviceStyle,
          location1: item.location1,
          location2: item.location2,
          location3: item.location3,
          location4: item.location4,
          locationDetails: item.notes,
          product: item.sizeRows[0]?.product || '',
          productColor: item.sizeRows[0]?.color || '',
          apparelProvider: '',
          applicator: 'Katalyst Ko Printshop',
          sizes: sizesToPayload(item.sizeRows),
          garmentVariants: item.sizeRows
            .filter(r => r.product || rowTotal(r) > 0)
            .map(r => ({
              product: r.product,
              color: r.color,
              sizes: { xs: r.xs, s: r.s, m: r.m, l: r.l, xl: r.xl, xxl: r.xxl, xxxl: r.xxxl, xxxxl: r.xxxxl, flat: 0 },
            })),
          mockupUri: mockupUris[item.id] || null,
          productCostEach: 0,
          serviceCostEach: 0,
          serviceFeeEach: 0,
          markupEach: 0,
        })),
      };

      const res = await fetch('/api/portal/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { setSubmitError(data.error || 'Submission failed. Please try again.'); return; }
      const projectId = data.id;
      if (pendingFiles.length > 0 || artworkFromBin.length > 0) {
        setUploadingFiles(true);
        for (const pf of pendingFiles) {
          const fd = new FormData();
          fd.append('file', pf.file);
          fd.append('orgId', session.orgId);
          fd.append('projectId', projectId);
          fd.append('uploadedByUserId', session.userId);
          fd.append('fileType', 'ARTWORK');
          fd.append('visibility', 'CLIENT_VISIBLE');
          await fetch('/api/files', { method: 'POST', body: fd }).catch(() => {});
        }
        for (const bf of artworkFromBin) {
          await fetch(`/api/files/${bf.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId }),
          }).catch(() => {});
        }
        setUploadingFiles(false);
        setPendingFiles([]);
        setArtworkFromBin([]);
      }
      setSubmittedId(projectId);
      setSubmittedAt(data.createdAt ? new Date(data.createdAt) : new Date());
      setSubmissionEmailSent(!!data.emailSent);
      // Consume the reorder linkage so a later unrelated submit can't be
      // mis-attributed to this source project.
      setReorderSourceId(null);
      setStep('success');
    } catch {
      setSubmitError('Connection error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [session, projectName, orderType, inHandsDate, requestNotes, lineItems, pendingFiles, artworkFromBin, reorderSourceId]);

  const handleNewRequest = useCallback(() => {
    setProjectName('');
    setOrderType('New Order');
    setInHandsDate('');
    setRequestNotes('');
    setLineItems([emptyLineItem()]);
    setReorderSourceId(null);
    setPendingFiles([]);
    setArtworkFromBin([]);
    setSubmitError('');
    setSubmittedId('');
    setSubmittedAt(null);
    setSubmissionEmailSent(false);
    setFormErrors({});
    setActiveView('submit');
  }, []);

  const handleEditSubmission = useCallback(async () => {
    if (!session || !submittedId || cancelling) return;
    setCancelling(true);
    try {
      await fetch('/api/portal/submit', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: submittedId, userId: session.userId, orgId: session.orgId }),
      });
    } catch {}
    setSubmittedId('');
    setSubmittedAt(null);
    setSubmissionEmailSent(false);
    setSubmitError('');
    setFormErrors({});
    setActiveView('submit');
    setCancelling(false);
  }, [session, submittedId, cancelling]);

  const handleCancelSubmission = useCallback(async () => {
    if (!session || !submittedId || cancelling) return;
    setCancelling(true);
    try {
      await fetch('/api/portal/submit', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: submittedId, userId: session.userId, orgId: session.orgId }),
      });
    } catch {}
    setCancelling(false);
    handleNewRequest();
  }, [session, submittedId, cancelling, handleNewRequest]);

  const updateLineItem = useCallback((id: string, updated: PortalLineItem) => {
    setLineItems(prev => prev.map(li => li.id === id ? updated : li));
  }, []);

  const addLineItem = useCallback(() => {
    setLineItems(prev => [...prev, emptyLineItem()]);
  }, []);

  const removeLineItem = useCallback((id: string) => {
    setLineItems(prev => prev.filter(li => li.id !== id));
  }, []);

  const logoSrc = orgLogoUrl;
  const displayName = orgDisplayName || session?.orgName || 'KATALYST KO';

  const normalizeStatus = (s: string) => s.toUpperCase().replace('QUOTE_SENT', 'QUOTED');

  const requestProjects = orgProjects.filter(p =>
    ['NEEDS_REVIEW', 'QUOTING'].includes(normalizeStatus(p.status))
  );
  const quoteProjects = orgProjects.filter(p =>
    ['QUOTED', 'QUOTE_SENT', 'INVOICE_SENT', 'PAID', 'IN_PRODUCTION', 'COMPLETED'].includes(normalizeStatus(p.status))
  );
  const activeProjects = orgProjects.filter(p =>
    !['COMPLETED', 'CANCELLED'].includes(normalizeStatus(p.status))
  );

  function formatDate(d: string | null) {
    if (!d) return '—';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '—';
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function formatBytes(bytes: number | null): string {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }

  function getMimeLabel(mime: string | null, name: string): string {
    const ext = name.split('.').pop()?.toUpperCase();
    if (ext && ['AI', 'SVG', 'PS', 'PNG', 'JPG', 'JPEG', 'PDF', 'EMB', 'DST', 'PES'].includes(ext)) return ext === 'JPEG' ? 'JPG' : ext;
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

  const downloadPortalFile = (file: MediaFile) => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const a = document.createElement('a');
    a.href = `/api/portal/${session?.orgId}/files/${file.id}`;
    a.download = file.originalName;
    a.click();
  };

  const renderPortalMediaCard = (file: MediaFile, cardStyle: any) => (
    <MediaCard
      key={file.id}
      file={file}
      showTypeBadge={false}
      style={cardStyle}
      thumbnail={isImageMime(file.mimeType)
        ? <Image source={{ uri: `/api/portal/${session?.orgId}/files/${file.id}?inline=true` }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        : <Text style={mbStyles.visualThumbLabel}>{getMimeLabel(file.mimeType, file.originalName)}</Text>}
      typeLabel={getMimeLabel(file.mimeType, file.originalName)}
      dateLabel={formatDate(file.createdAt)}
      sizeLabel={formatBytes(file.fileSize)}
      onDownload={() => downloadPortalFile(file)}
      onDelete={() => deleteMediaBinFile(file.id)}
      renamable
      isRenaming={renamingPortalFileId === file.id}
      renameValue={renamePortalText}
      onRenameChange={setRenamePortalText}
      onRenameStart={() => { setRenamingPortalFileId(file.id); setRenamePortalText(file.originalName); }}
      onRenameSubmit={() => handleRenamePortalFile(file.id, renamePortalText)}
      onRenameCancel={() => setRenamingPortalFileId(null)}
    />
  );

  function ProjectCard({ project }: { project: PortalProject }) {
    return (
      <View style={dash.projectCard}>
        <View style={dash.projectCardTop}>
          <Text style={dash.projectCardTitle} numberOfLines={1}>{project.title}</Text>
          <StatusPill status={project.status} quoteResponse={project.quoteResponse} />
          <TouchableOpacity
            onPress={(e: any) => { e?.stopPropagation?.(); toggleFavorite(project.id); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <Star
              size={16}
              color={favoriteProjectIds.includes(project.id) ? BRAND : '#C9CDD3'}
              fill={favoriteProjectIds.includes(project.id) ? BRAND : 'transparent'}
            />
          </TouchableOpacity>
        </View>
        <ProjectPipeline status={project.status} />
        <View style={dash.projectCardMeta}>
          <Clock size={11} color={TEXT_LIGHT} />
          <Text style={dash.projectCardMetaText}>In Hands: {formatDate(project.inHandsDate)}</Text>
          {project.lineItemCount > 0 && (
            <>
              <View style={dash.metaDot} />
              <Package size={11} color={TEXT_LIGHT} />
              <Text style={dash.projectCardMetaText}>{project.lineItemCount} item{project.lineItemCount !== 1 ? 's' : ''}</Text>
            </>
          )}
        </View>
      </View>
    );
  }

  function EmptyState({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
    return (
      <View style={dash.emptyState}>
        <View style={dash.emptyIcon}>{icon}</View>
        <Text style={dash.emptyTitle}>{title}</Text>
        <Text style={dash.emptySub}>{sub}</Text>
      </View>
    );
  }

  function SectionCard({ title, count, onViewAll, children }: {
    title: string; count?: number; onViewAll?: () => void; children: React.ReactNode;
  }) {
    return (
      <View style={dash.sectionCard}>
        <View style={dash.sectionCardHeader}>
          <Text style={dash.sectionCardTitle}>{title}{count != null ? ` (${count})` : ''}</Text>
          {onViewAll && (
            <TouchableOpacity onPress={onViewAll}>
              <Text style={dash.viewAllLink}>View all →</Text>
            </TouchableOpacity>
          )}
        </View>
        {children}
      </View>
    );
  }

  const HomeView = () => (
    <ScrollView contentContainerStyle={dash.viewContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Text style={dash.welcomeText}>Welcome back, <Text style={{ color: BRAND }}>{session?.userName}</Text></Text>
      <Text style={dash.welcomeSub}>{displayName} · Client Hub</Text>

      {/* Quick Actions */}
      <View style={homeStyles.qaRow}>
        {([
          { label: 'Start Project',   Icon: Plus,     action: () => setActiveView('submit') },
          { label: 'View Quotes',     Icon: FileText, action: () => setActiveView('projects') },
          { label: 'Upload Files',    Icon: Upload,   action: () => { setActiveView('artwork'); if (session) fetchMediaBin(session.orgId); } },
          { label: 'Browse Catalogs', Icon: BookOpen, action: () => setActiveView('catalogs') },
        ] as { label: string; Icon: any; action: () => void }[]).map(({ label, Icon, action }) => (
          <TouchableOpacity key={label} style={homeStyles.qaCard} onPress={action} activeOpacity={0.85}>
            <View style={homeStyles.qaIcon}><Icon size={20} color={BRAND} /></View>
            <Text style={homeStyles.qaLabel}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Main columns: Active Projects + Quotes */}
      <View style={dash.dashGrid}>
        <View style={{ flex: 1.5, minWidth: 260 }}>
          <SectionCard title="Active Projects" count={activeProjects.length} onViewAll={() => setActiveView('projects')}>
            {projectsLoading
              ? <ActivityIndicator color={BRAND} style={{ marginVertical: 20 }} />
              : activeProjects.length === 0
                ? <EmptyState icon={<Folder size={22} color="#9CA3AF" />} title="No active projects" sub="Submit a request to get started." />
                : activeProjects.slice(0, 3).map(p => <ProjectCard key={p.id} project={p} />)
            }
          </SectionCard>
        </View>
        <View style={{ flex: 1, minWidth: 220 }}>
          <SectionCard title="Quotes & Invoices" count={quoteProjects.length} onViewAll={() => setActiveView('projects')}>
            {projectsLoading
              ? <ActivityIndicator color={BRAND} style={{ marginVertical: 20 }} />
              : quoteProjects.length === 0
                ? <EmptyState icon={<Receipt size={22} color="#9CA3AF" />} title="No pending quotes" sub="Quotes ready for review will appear here." />
                : quoteProjects.slice(0, 3).map(p => (
                    <View key={p.id} style={dash.quoteRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={dash.quoteTitle} numberOfLines={1}>{p.title}</Text>
                        <Text style={dash.quoteMeta}>{formatDate(p.createdAt)}</Text>
                      </View>
                      <StatusPill status={p.status} quoteResponse={p.quoteResponse} />
                    </View>
                  ))
            }
          </SectionCard>
        </View>
      </View>

      {/* Bottom row: Catalogs + Media Bin */}
      <View style={[dash.dashGrid, { marginTop: 0 }]}>
        <View style={{ flex: 1.5, minWidth: 200 }}>
          <SectionCard title="Product Catalogs" onViewAll={() => setActiveView('catalogs')}>
            {catalogsLoading
              ? <ActivityIndicator color={BRAND} style={{ marginVertical: 16 }} />
              : clientCatalogs.length === 0
                ? <EmptyState icon={<BookOpen size={22} color="#9CA3AF" />} title="No catalogs yet" sub="Product catalogs will appear here." />
                : <View style={homeStyles.catGrid}>
                    {clientCatalogs.slice(0, 9).map(cat => {
                      const initials = (cat.vendorName || cat.name).split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
                      const color = CAT_COLORS[cat.category] || BRAND;
                      return (
                        <TouchableOpacity
                          key={cat.id}
                          style={homeStyles.catCell}
                          onPress={() => Linking.openURL(cat.catalogUrl)}
                          activeOpacity={0.75}
                        >
                          <View style={[homeStyles.catAvatar, { backgroundColor: color }]}>
                            <Text style={homeStyles.catAvatarText}>{initials}</Text>
                          </View>
                          <Text style={homeStyles.catName} numberOfLines={1}>{cat.vendorName || cat.name}</Text>
                          <ChevronRight size={14} color="#9CA3AF" />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
            }
          </SectionCard>
        </View>
        <View ref={dashMBDropRef} style={{ flex: 1, minWidth: 200 }}>
          <SectionCard title="Media Bin" onViewAll={() => { setActiveView('artwork'); if (session) fetchMediaBin(session.orgId); }}>
            {Platform.OS === 'web' && (
              <input ref={mediaBinInputRef} type="file" accept=".ai,.svg,.ps,.png,.jpg,.jpeg,.pdf,.emb,.dst,.pes" multiple style={{ display: 'none' }}
                onChange={(e: any) => { const files = Array.from((e.target.files || []) as globalThis.File[]); if (files.length > 0) handleMediaBinUpload(files); e.target.value = ''; }}
              />
            )}
            {mediaBinFiles.length === 0
              ? (
                <View style={[mbStyles.mbEmptyBin, isDraggingDashMB && { borderWidth: 2, borderColor: '#1A1210' }]}>
                  <View style={[mbStyles.mediaDot, { top: 14, left: 20, width: 4, height: 4 }]} />
                  <View style={[mbStyles.mediaDot, { top: 10, right: 40, width: 3, height: 3 }]} />
                  <View style={[mbStyles.mediaDot, { bottom: 30, left: 14, width: 3, height: 3, opacity: 0.35 }]} />
                  <View style={[mbStyles.mediaDot, { bottom: 20, right: 16, width: 4, height: 4, opacity: 0.5 }]} />
                  <View style={mbStyles.mediaBinIconRow}>
                    <View style={[mbStyles.mediaBinCard, { transform: [{ rotate: '-10deg' }], marginRight: -10, zIndex: 1 }]}>
                      <ImageIcon size={20} color="#9CA3AF" />
                    </View>
                    <View style={[mbStyles.mediaBinCard, mbStyles.mediaBinCardCenter, { zIndex: 3 }]}>
                      <Film size={24} color="#9CA3AF" />
                    </View>
                    <View style={[mbStyles.mediaBinCard, { transform: [{ rotate: '10deg' }], marginLeft: -10, zIndex: 1 }]}>
                      <Music size={20} color="#9CA3AF" />
                    </View>
                  </View>
                  <Text style={mbStyles.mediaBinEmptyText}>Drag and drop your media here</Text>
                  <Text style={mbStyles.mediaBinEmptySub}>AI · SVG · PS · PNG · JPG · PDF · EMB · DST · PES</Text>
                </View>
              )
              : <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 }}>
                  {mediaBinFiles.slice(0, 4).map(f => (
                    <View key={f.id} style={{ width: '25%', paddingHorizontal: 5, marginBottom: 10 }}>
                      {renderPortalMediaCard(f, { width: '100%' })}
                    </View>
                  ))}
                </View>
            }
          </SectionCard>
        </View>
      </View>
    </ScrollView>
  );

  const MyProjectsView = () => {
    const PAGE_SIZE = 5;
    const normalSt = (s: string) => s.toUpperCase().replace('QUOTE_SENT', 'QUOTED');

    const displayed = orgProjects.filter(p => {
      const norm = normalSt(p.status);
      if (mpStatusFilter === 'FAVORITES') {
        if (!favoriteProjectIds.includes(p.id)) return false;
      } else if (mpStatusFilter && norm !== mpStatusFilter) {
        return false;
      }
      if (mpSearch.trim()) {
        const q = mpSearch.toLowerCase();
        if (!p.title.toLowerCase().includes(q)) return false;
      }
      if (mpDateFrom) {
        const sub = new Date(p.createdAt);
        const from = new Date(mpDateFrom);
        if (sub < from) return false;
      }
      if (mpDateTo) {
        const sub = new Date(p.createdAt);
        const to = new Date(mpDateTo);
        to.setHours(23, 59, 59, 999);
        if (sub > to) return false;
      }
      if (mpCostMin && p.totalCost != null) {
        if (parseFloat(p.totalCost) < parseFloat(mpCostMin)) return false;
      }
      if (mpCostMax && p.totalCost != null) {
        if (parseFloat(p.totalCost) > parseFloat(mpCostMax)) return false;
      }
      return true;
    });

    const toggleSort = (field: typeof mpSortField) => {
      if (mpSortField === field) {
        setMpSortDir(d => d === 'asc' ? 'desc' : 'asc');
      } else {
        setMpSortField(field);
        setMpSortDir('asc');
      }
    };

    const sortedDisplayed = [...displayed].sort((a, b) => {
      let valA: any, valB: any;
      switch (mpSortField) {
        case 'status': valA = normalSt(a.status); valB = normalSt(b.status); break;
        case 'project': valA = (a.title || '').toLowerCase(); valB = (b.title || '').toLowerCase(); break;
        case 'submitted': valA = new Date(a.createdAt).getTime(); valB = new Date(b.createdAt).getTime(); break;
        case 'order':
          valA = a.orderDate ? new Date(a.orderDate).getTime() : 0;
          valB = b.orderDate ? new Date(b.orderDate).getTime() : 0; break;
        case 'inHands':
          valA = a.inHandsDate ? new Date(a.inHandsDate).getTime() : 0;
          valB = b.inHandsDate ? new Date(b.inHandsDate).getTime() : 0; break;
        case 'items': valA = a.pieces || 0; valB = b.pieces || 0; break;
        case 'total': valA = parseFloat(a.totalCost || '0'); valB = parseFloat(b.totalCost || '0'); break;
        default: valA = 0; valB = 0;
      }
      if (valA < valB) return mpSortDir === 'asc' ? -1 : 1;
      if (valA > valB) return mpSortDir === 'asc' ? 1 : -1;
      return 0;
    });

    const ACTIVE_STATUSES = ['NEEDS_REVIEW', 'QUOTING', 'QUOTED', 'INVOICE_SENT', 'IN_PRODUCTION'];
    const COMPLETED_STATUSES = ['COMPLETED', 'EXPIRED', 'CANCELLED'];
    const activeProjects = sortedDisplayed.filter(p => ACTIVE_STATUSES.includes(normalSt(p.status)));
    const completedProjects = sortedDisplayed.filter(p => COMPLETED_STATUSES.includes(normalSt(p.status)));

    const totalPages = Math.max(1, Math.ceil(Math.max(activeProjects.length, completedProjects.length) / PAGE_SIZE));

    const hasActiveFilters = !!(mpStatusFilter || mpDateFrom || mpDateTo || mpCostMin || mpCostMax);
    const advFilterCount = [mpDateFrom || mpDateTo, mpCostMin || mpCostMax].filter(Boolean).length;

    const clearAll = () => {
      setMpSearch('');
      setMpStatusFilter(null);
      setMpDateFrom('');
      setMpDateTo('');
      setMpCostMin('');
      setMpCostMax('');
    };

    const STATUS_PILLS_CFG = [
      { key: null as string | null, label: 'All' },
      { key: 'NEEDS_REVIEW', label: 'Needs Review' },
      { key: 'QUOTING', label: 'Being Quoted' },
      { key: 'QUOTED', label: 'Quote Ready' },
      { key: 'IN_PRODUCTION', label: 'In Production' },
      { key: 'COMPLETED', label: 'Completed' },
      { key: 'FAVORITES', label: 'Favorites' },
    ];

    const statusCounts: Record<string, number> = {};
    orgProjects.forEach(p => {
      const norm = normalSt(p.status);
      statusCounts[norm] = (statusCounts[norm] || 0) + 1;
    });

    const THUMB_COLORS = ['#FF5A00', '#2563EB', '#7C3AED', '#059669', '#DC2626', '#D97706', '#0891B2'];

    const SortTh = ({ field, label, style, align }: {
      field: typeof mpSortField; label: string;
      style?: any; align?: 'left' | 'right';
    }) => {
      const active = mpSortField === field;
      const dir = mpSortDir;
      return (
        <TouchableOpacity
          onPress={() => toggleSort(field)}
          style={[
            mpStyles.thBtn,
            style,
            align === 'right' && { justifyContent: 'flex-end' },
          ]}
        >
          <Text style={[mpStyles.thText, active && mpStyles.thTextActive, align === 'right' && { textAlign: 'right' }]}>
            {label}
          </Text>
          {active
            ? (dir === 'asc' ? <ChevronUp size={10} color="#FF5A00" /> : <ChevronDown size={10} color="#FF5A00" />)
            : <ArrowUpDown size={10} color="rgba(17,24,39,0.35)" />
          }
        </TouchableOpacity>
      );
    };

    const ColHeaders = () => (
      <View style={mpStyles.tableHeader}>
        <View style={mpStyles.thumbCol} />
        <SortTh field="project" label="PROJECT" style={mpStyles.colProject} />
        <SortTh field="status" label="STATUS" style={mpStyles.colStatus} />
        <SortTh field="order" label="ORDER DATE" style={mpStyles.colOrderDate} />
        <SortTh field="inHands" label="DUE DATE" style={mpStyles.colDueDate} />
        <SortTh field="items" label="PCS" style={mpStyles.colPcs} />
        <SortTh field="total" label="TOTAL" style={mpStyles.colTotal} />
        <View style={mpStyles.colPerPcs}>
          <Text style={mpStyles.thText}>PER PCS</Text>
        </View>
        <View style={mpStyles.colActions}>
          <Text style={mpStyles.thText}>ACTION</Text>
        </View>
      </View>
    );

    const renderRow = (p: PortalProject, idx: number) => {
      const cost = p.totalCost && parseFloat(p.totalCost) > 0 ? parseFloat(p.totalCost) : null;
      const pcs = p.pieces && p.pieces > 0 ? p.pieces : null;
      const perPcs = p.perPiece && parseFloat(p.perPiece) > 0 ? parseFloat(p.perPiece) : null;
      const thumbColor = THUMB_COLORS[(p.title.charCodeAt(0) || 0) % THUMB_COLORS.length];
      const initial = (p.title.trim()[0] || '?').toUpperCase();
      return (
        <View key={p.id} style={[mpStyles.tRow, idx % 2 === 1 && mpStyles.tRowAlt]}>
          <View style={mpStyles.thumbCol}>
            <View style={[mpStyles.thumb, { backgroundColor: thumbColor + '22' }]}>
              <Text style={[mpStyles.thumbInitial, { color: thumbColor }]}>{initial}</Text>
            </View>
          </View>
          <View style={[mpStyles.colProject, mpStyles.tdCell, { paddingRight: 10 }]}>
            <Text style={mpStyles.tRowName} numberOfLines={2}>{p.title}</Text>
            {(() => {
              const chips = assetCountSummary(p);
              if (chips.length === 0) return null;
              return (
                <View style={mpStyles.assetChipsRow}>
                  {chips.map(c => (
                    <View key={c} style={mpStyles.assetChip}>
                      <Text style={mpStyles.assetChipText}>{c}</Text>
                    </View>
                  ))}
                </View>
              );
            })()}
          </View>
          <View style={[mpStyles.colStatus, mpStyles.tdCell]}>
            <StatusPill status={p.status} quoteResponse={p.quoteResponse} />
          </View>
          <View style={[mpStyles.colOrderDate, mpStyles.tdCell]}>
            <Text style={mpStyles.tDue}>{p.orderDate ? formatDate(p.orderDate) : '\u2014'}</Text>
          </View>
          <View style={[mpStyles.colDueDate, mpStyles.tdCell]}>
            <Text style={mpStyles.tDue}>Due {p.inHandsDate ? formatDate(p.inHandsDate) : '\u2014'}</Text>
          </View>
          <View style={[mpStyles.colPcs, mpStyles.tdCellRight]}>
            <Text style={mpStyles.tNum}>{pcs ?? '\u2014'}</Text>
          </View>
          <View style={[mpStyles.colTotal, mpStyles.tdCellRight]}>
            <Text style={[mpStyles.tNum, cost ? mpStyles.tNumBold : undefined]}>
              {cost ? `$${cost.toFixed(2)}` : '\u2014'}
            </Text>
          </View>
          <View style={[mpStyles.colPerPcs, mpStyles.tdCellRight]}>
            <Text style={mpStyles.tNum}>{perPcs ? `$${perPcs.toFixed(2)}` : '\u2014'}</Text>
          </View>
          <View style={[mpStyles.colActions, mpStyles.tdCellActions]}>
            <TouchableOpacity
              onPress={(e: any) => { e?.stopPropagation?.(); toggleFavorite(p.id); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
              style={{ padding: 4 }}
            >
              <Star
                size={16}
                color={favoriteProjectIds.includes(p.id) ? BRAND : '#C9CDD3'}
                fill={favoriteProjectIds.includes(p.id) ? BRAND : 'transparent'}
              />
            </TouchableOpacity>
            <TouchableOpacity style={mpStyles.viewBtn} onPress={() => handleViewProject(p.id)} activeOpacity={0.85}>
              <Text style={mpStyles.viewBtnText}>View Project</Text>
            </TouchableOpacity>
            <TouchableOpacity style={mpStyles.dotsMenuBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={mpStyles.dotsMenuBtnText}>{String.fromCharCode(8942)}</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    };

    const renderSection = (
      title: string,
      projects: PortalProject[],
      viewAllLabel: string,
      filterStatus: string | null,
    ) => {
      if (projects.length === 0) return null;
      const pagedRows = projects.slice((mpPage - 1) * PAGE_SIZE, mpPage * PAGE_SIZE);
      if (pagedRows.length === 0) return null;
      return (
        <View style={mpStyles.section} key={title}>
          <View style={mpStyles.sectionBar}>
            <Text style={mpStyles.sectionBarTitle}>{title}</Text>
            <TouchableOpacity onPress={() => { setMpStatusFilter(filterStatus); setMpPage(1); }}>
              <Text style={mpStyles.viewAllLink}>{viewAllLabel} {String.fromCharCode(8594)}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ flexGrow: 1 }}
          >
            <View style={{ minWidth: 1360, flexGrow: 1 }}>
              <ColHeaders />
              {pagedRows.map((p, i) => renderRow(p, i))}
            </View>
          </ScrollView>
        </View>
      );
    };

    const Pagination = () => {
      if (totalPages <= 1) return null;
      return (
        <View style={mpStyles.pagination}>
          <TouchableOpacity
            style={[mpStyles.pageBtn, mpPage === 1 && mpStyles.pageBtnDisabled]}
            onPress={() => setMpPage(p => Math.max(1, p - 1))}
            disabled={mpPage === 1}
          >
            <ChevronLeft size={16} color={mpPage === 1 ? '#D1D5DB' : TEXT} />
          </TouchableOpacity>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
            <TouchableOpacity
              key={page}
              style={[mpStyles.pageBtn, page === mpPage && mpStyles.pageBtnActive]}
              onPress={() => setMpPage(page)}
            >
              <Text style={[mpStyles.pageBtnText, page === mpPage && mpStyles.pageBtnTextActive]}>{page}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[mpStyles.pageBtn, mpPage === totalPages && mpStyles.pageBtnDisabled]}
            onPress={() => setMpPage(p => Math.min(totalPages, p + 1))}
            disabled={mpPage === totalPages}
          >
            <ChevronRight size={16} color={mpPage === totalPages ? '#D1D5DB' : TEXT} />
          </TouchableOpacity>
        </View>
      );
    };

    return (
      <View style={{ flex: 1 }}>
        <View style={mpStyles.header}>
          <View style={mpStyles.headerTop}>
            <View>
              <Text style={mpStyles.headerTitle}>My Projects</Text>
              <Text style={mpStyles.headerSubtitle}>Track the status of your projects in real time.</Text>
            </View>
            <TouchableOpacity style={mpStyles.startProjectBtn} onPress={() => setActiveView('submit')} activeOpacity={0.85}>
              <Plus size={14} color="#fff" />
              <Text style={mpStyles.startProjectBtnText}>Start a Project</Text>
            </TouchableOpacity>
          </View>

          <View style={mpStyles.controlsRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1, flexShrink: 1 }}>
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                {STATUS_PILLS_CFG.map(pill => {
                  const count = pill.key === null
                    ? orgProjects.length
                    : pill.key === 'FAVORITES'
                      ? orgProjects.filter(p => favoriteProjectIds.includes(p.id)).length
                      : (statusCounts[pill.key] ?? 0);
                  const active = mpStatusFilter === pill.key;
                  const cfg = pill.key ? PORTAL_STATUS_CONFIG[pill.key] : null;
                  return (
                    <TouchableOpacity
                      key={String(pill.key)}
                      style={[
                        mpStyles.pill,
                        active && mpStyles.pillActive,
                        active && cfg ? { backgroundColor: cfg.bg, borderColor: cfg.color } : null,
                      ]}
                      onPress={() => { setMpStatusFilter(pill.key); setMpPage(1); }}
                    >
                      <Text style={[
                        mpStyles.pillText,
                        active && mpStyles.pillTextActive,
                        active && cfg ? { color: cfg.color } : null,
                      ]}>
                        {pill.label}
                      </Text>
                      <View style={[mpStyles.pillCount, active && cfg ? { backgroundColor: cfg.color } : null]}>
                        <Text style={[mpStyles.pillCountText, active && cfg ? { color: '#fff' } : null]}>{count}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
            <View style={mpStyles.searchBox}>
              <Search size={15} color="#9CA3AF" />
              <TextInput
                style={mpStyles.searchInput}
                placeholder="Search projects..."
                placeholderTextColor="#9CA3AF"
                value={mpSearch}
                onChangeText={v => { setMpSearch(v); setMpPage(1); }}
              />
              {mpSearch.length > 0 && (
                <TouchableOpacity onPress={() => setMpSearch('')}>
                  <X size={14} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              style={[mpStyles.filterToggleBtn, (mpShowFilters || hasActiveFilters) && mpStyles.filterToggleBtnActive]}
              onPress={() => setMpShowFilters(v => !v)}
            >
              <SlidersHorizontal size={16} color={mpShowFilters || hasActiveFilters ? BRAND : '#9CA3AF'} />
              {advFilterCount > 0 && (
                <View style={mpStyles.filterBadge}>
                  <Text style={mpStyles.filterBadgeText}>{advFilterCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {mpShowFilters && (
            <View style={mpStyles.filterPanel}>
              <Text style={mpStyles.filterPanelTitle}>ADVANCED FILTERS</Text>
              <View style={mpStyles.filtersRow}>
                <View style={mpStyles.filterField}>
                  <Text style={mpStyles.filterLabel}>From Date</Text>
                  {Platform.OS === 'web' ? (
                    <input type="date" value={mpDateFrom} onChange={(e: any) => setMpDateFrom(e.target.value)}
                      style={{ border: '1px solid #E5E7EB', borderRadius: 8, padding: '8px 10px', fontSize: 12, color: TEXT, backgroundColor: '#fff', outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' } as any} />
                  ) : (
                    <TextInput style={mpStyles.filterInput} value={mpDateFrom} onChangeText={setMpDateFrom} placeholder="YYYY-MM-DD" placeholderTextColor="#9CA3AF" />
                  )}
                </View>
                <View style={mpStyles.filterField}>
                  <Text style={mpStyles.filterLabel}>To Date</Text>
                  {Platform.OS === 'web' ? (
                    <input type="date" value={mpDateTo} onChange={(e: any) => setMpDateTo(e.target.value)}
                      style={{ border: '1px solid #E5E7EB', borderRadius: 8, padding: '8px 10px', fontSize: 12, color: TEXT, backgroundColor: '#fff', outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' } as any} />
                  ) : (
                    <TextInput style={mpStyles.filterInput} value={mpDateTo} onChangeText={setMpDateTo} placeholder="YYYY-MM-DD" placeholderTextColor="#9CA3AF" />
                  )}
                </View>
                <View style={mpStyles.filterField}>
                  <Text style={mpStyles.filterLabel}>Min Total ($)</Text>
                  <TextInput style={mpStyles.filterInput} value={mpCostMin} onChangeText={setMpCostMin} placeholder="0" placeholderTextColor="#9CA3AF" keyboardType="numeric" />
                </View>
                <View style={mpStyles.filterField}>
                  <Text style={mpStyles.filterLabel}>Max Total ($)</Text>
                  <TextInput style={mpStyles.filterInput} value={mpCostMax} onChangeText={setMpCostMax} placeholder="No limit" placeholderTextColor="#9CA3AF" keyboardType="numeric" />
                </View>
                {hasActiveFilters && (
                  <TouchableOpacity style={mpStyles.clearFiltersBtn} onPress={clearAll}>
                    <Text style={mpStyles.clearFiltersBtnText}>Clear</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40, gap: 24 }}
          showsVerticalScrollIndicator={false}
        >
          {projectsLoading ? (
            <ActivityIndicator color={BRAND} style={{ marginTop: 40 }} />
          ) : sortedDisplayed.length === 0 ? (
            <View style={{ paddingTop: 48, alignItems: 'center' }}>
              {hasActiveFilters || mpSearch ? (
                <EmptyState
                  icon={<ClipboardList size={32} color="#9CA3AF" />}
                  title="No matching projects"
                  sub="Try adjusting your search or filters."
                />
              ) : (
                <View style={mpStyles.ctaCard}>
                  <View style={mpStyles.ctaIconWrap}><ClipboardList size={32} color={BRAND} /></View>
                  <Text style={mpStyles.ctaTitle}>No projects yet</Text>
                  <Text style={mpStyles.ctaSub}>
                    Ready to get started? Submit your first print request and we'll take it from there.
                  </Text>
                  <TouchableOpacity style={mpStyles.ctaBtn} onPress={() => setActiveView('submit')} activeOpacity={0.85}>
                    <Plus size={16} color="#fff" />
                    <Text style={mpStyles.ctaBtnText}>Start a Project</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ) : (
            <>
              {renderSection('ACTIVE PROJECTS', activeProjects, 'View all active', null)}
              {renderSection('COMPLETED PROJECTS', completedProjects, 'View all completed', 'COMPLETED')}
              <Pagination />
            </>
          )}
        </ScrollView>
      </View>
    );
  };

  const ProjectDetailView = () => {
    const proj = selectedProject;
    const calc = proj?.calculations;
    const lineItems: any[] = proj?.lineItemsData ?? [];
    const totalQty = lineItems.reduce((s: number, li: any) => {
      const sizes = li.sizes ?? {};
      return s + Object.values(sizes).reduce((a: number, v: any) => a + (Number(v) || 0), 0);
    }, 0);

    const fmt = (n: number | null | undefined) =>
      n != null && n > 0 ? `$${n.toFixed(2)}` : '—';

    const orgIdForFiles = session?.orgId || '';
    const projFiles = proj?.files ?? [];

    // Customer-safe pricing only — Katalyst terminology, fee rows with a value
    // only. Never expose cost / markup / margin / COGS / fee %. `rushFee` is
    // reserved for a future rush charge and stays hidden until calc writes it.
    const subtotal = Number(calc?.subtotal) || 0;
    const onlineFee = Number(calc?.onlineFee) || 0;
    const cardFee = Number(calc?.cardFee) || 0;
    const salesTax = Number(calc?.salesTax) || 0;
    const shipping = Number(calc?.shipping) || 0;
    const rushFee = Number(calc?.rushFee) || 0;
    const grandTotal = calc?.total != null ? Number(calc.total) : null;
    const perPiece = calc?.totalPerPiece != null && Number(calc.totalPerPiece) > 0 ? Number(calc.totalPerPiece) : null;
    const pricingRows: Array<{ label: string; value: number }> = [];
    if (subtotal > 0) pricingRows.push({ label: 'Subtotal', value: subtotal });
    if (onlineFee > 0) pricingRows.push({ label: 'Online Fee', value: onlineFee });
    if (cardFee > 0) pricingRows.push({ label: 'Card Fee', value: cardFee });
    if (salesTax > 0) pricingRows.push({ label: 'Sales Tax', value: salesTax });
    if (shipping > 0) pricingRows.push({ label: 'Shipping', value: shipping });
    if (rushFee > 0) pricingRows.push({ label: 'Rush Fee', value: rushFee });
    const isFavorite = proj ? favoriteProjectIds.includes(proj.id) : false;

    // ── Quote response (Phase 7) ────────────────────────────────────────────
    const mappedStatusPV = (proj?.status || '').toUpperCase().replace('QUOTE_SENT', 'QUOTED');
    const quoteResp = proj?.quoteResponse || null;
    const canRespondToQuote = mappedStatusPV === 'QUOTED' && !quoteResp;
    const respCfg = quoteResp ? QUOTE_RESPONSE_CONFIG[quoteResp] : null;
    const fmtDateTime = (d: string | null | undefined): string | null => {
      if (!d) return null;
      try {
        const dt = new Date(d);
        if (isNaN(dt.getTime())) return formatDate(d as string);
        return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          + ' · ' + dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      } catch { return formatDate(d as string); }
    };
    const quoteReachedSent =
      ['QUOTED', 'INVOICE_SENT', 'PAID', 'IN_PRODUCTION', 'COMPLETED'].includes(mappedStatusPV)
      || !!quoteResp || !!proj?.quoteSentAt;
    const quoteTimeline: Array<{ key: string; label: string; date: string | null; done: boolean; color?: string }> = [];
    if (quoteReachedSent || proj?.quoteViewedAt) {
      quoteTimeline.push({ key: 'sent', label: 'Quote Sent', date: proj?.quoteSentAt || null, done: quoteReachedSent });
      quoteTimeline.push({ key: 'viewed', label: 'Viewed', date: proj?.quoteViewedAt || null, done: !!proj?.quoteViewedAt });
      if (quoteResp && respCfg) {
        quoteTimeline.push({ key: 'resp', label: respCfg.label, date: proj?.quoteRespondedAt || null, done: true, color: respCfg.color });
      }
    }

    // ── Project Assets ────────────────────────────────────────────────────
    // Everything tied to this project, categorized by fileType. Mockups are NOT
    // aggregated here — each line item owns and displays its own mockup below.
    const artworkFiles = projFiles.filter((f: any) => f.fileType === 'ARTWORK');
    const proofFiles = projFiles.filter((f: any) => f.fileType === 'PROOF');
    const invoiceFiles = projFiles.filter((f: any) => f.fileType === 'INVOICE_PDF');
    const downloadFiles = projFiles.filter((f: any) => f.fileType === 'REFERENCE' || f.fileType === 'OTHER');
    const invoices = proj?.invoices ?? [];

    const invoiceTotal = invoices.length + invoiceFiles.length;
    const uploadedAssetTotal =
      artworkFiles.length + proofFiles.length + invoiceTotal;

    const fileInlineUrl = (id: string) => `/api/portal/${orgIdForFiles}/files/${id}?inline=true`;
    const fileDownloadUrl = (id: string) => `/api/portal/${orgIdForFiles}/files/${id}`;
    const openInTab = (url: string | null) => {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && url) window.open(url, '_blank');
    };
    const triggerDownload = (url: string, name: string) => {
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const a = document.createElement('a');
        a.href = url;
        a.download = name || '';
        a.click();
      }
    };
    const extOf = (name: string) => (name?.split('.').pop() || '').toUpperCase();
    const IMG_EXTS = ['PNG', 'JPG', 'JPEG', 'GIF', 'WEBP', 'SVG'];
    const isImgFile = (f: any) => isImageMime(f.mimeType) || IMG_EXTS.includes(extOf(f.originalName));
    const isPdfFile = (f: any) => f.mimeType === 'application/pdf' || extOf(f.originalName) === 'PDF';
    const canPreviewFile = (f: any) => isImgFile(f) || isPdfFile(f);

    const downloadSummaryPdf = () => {
      if (!proj) return;
      downloadCustomerProjectPdf({
        title: proj.title || 'Project',
        status: PORTAL_STATUS_CONFIG[proj.status.toUpperCase().replace('QUOTE_SENT', 'QUOTED')]?.label || proj.status,
        orderType: proj.orderType,
        inHandsDate: proj.inHandsDate ? formatDate(proj.inHandsDate) : null,
        orgName: orgDisplayName || undefined,
        customerName: session?.userName,
        notes: proj.notesClient,
        orgId: orgIdForFiles,
        lineItems,
        pricing: pricingRows,
        total: grandTotal,
      });
    };

    const assetCatHeader = (title: string, count: number) => (
      <View style={pvStyles.assetCatHead}>
        <Text style={pvStyles.assetCatTitle}>{title}</Text>
        <View style={pvStyles.assetCatCount}><Text style={pvStyles.assetCatCountText}>{count}</Text></View>
      </View>
    );

    const renderAssetTile = (opts: {
      tileKey: string; imageUri?: string; typeLabel: string; name: string; meta?: string;
      onPreview?: () => void; onDownload?: () => void;
    }) => (
      <View key={opts.tileKey} style={pvStyles.assetTile}>
        <View style={pvStyles.assetThumb}>
          {opts.imageUri ? (
            <Image source={{ uri: opts.imageUri }} style={pvStyles.assetThumbImg} resizeMode="cover" />
          ) : (
            <View style={pvStyles.assetTypeBox}>
              <FileText size={22} color={BRAND} />
              <Text style={pvStyles.assetTypeLabel}>{opts.typeLabel}</Text>
            </View>
          )}
          <View style={pvStyles.assetActions}>
            {opts.onPreview && (
              <TouchableOpacity style={pvStyles.assetBtn} onPress={opts.onPreview} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <Maximize2 size={13} color="#fff" />
              </TouchableOpacity>
            )}
            {opts.onDownload && (
              <TouchableOpacity style={pvStyles.assetBtn} onPress={opts.onDownload} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <Download size={13} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        </View>
        <View style={pvStyles.assetTileMeta}>
          <Text style={pvStyles.assetTileName} numberOfLines={2}>{opts.name}</Text>
          {opts.meta ? <Text style={pvStyles.assetTileMetaLine} numberOfLines={1}>{opts.meta}</Text> : null}
        </View>
      </View>
    );

    const renderFileTile = (f: any, label: string) =>
      renderAssetTile({
        tileKey: f.id,
        imageUri: isImgFile(f) ? fileInlineUrl(f.id) : undefined,
        typeLabel: getMimeLabel(f.mimeType, f.originalName),
        name: f.originalName,
        meta: [formatDate(f.createdAt), label, formatBytes(f.fileSize)].filter(Boolean).join(' · '),
        onPreview: canPreviewFile(f) ? () => openInTab(fileInlineUrl(f.id)) : undefined,
        onDownload: () => triggerDownload(fileDownloadUrl(f.id), f.originalName),
      });

    const renderInvoiceRow = (inv: any) => {
      const amt = inv.total != null && inv.total !== '' ? `$${Number(inv.total).toFixed(2)}` : '';
      const statusLabel = (inv.status || '')
        .replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase());
      return (
        <View key={inv.id} style={pvStyles.fileRow}>
          <View style={pvStyles.fileIcon}><FileText size={16} color={BRAND} /></View>
          <View style={{ flex: 1 }}>
            <Text style={pvStyles.fileName} numberOfLines={1}>{inv.invoiceNumber ? `Invoice ${inv.invoiceNumber}` : 'Invoice'}</Text>
            <Text style={pvStyles.fileMeta}>{[amt, statusLabel].filter(Boolean).join(' · ')}</Text>
          </View>
          {inv.paymentUrl ? (
            <TouchableOpacity style={pvStyles.fileDownloadBtn} activeOpacity={0.7} onPress={() => openInTab(inv.paymentUrl)}>
              <ExternalLink size={15} color={TEXT_MED} />
            </TouchableOpacity>
          ) : null}
        </View>
      );
    };

    return (
      <ScrollView contentContainerStyle={[dash.viewContent, { paddingBottom: 40 }]} showsVerticalScrollIndicator={false}>
        {/* Back header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <TouchableOpacity
            onPress={() => setActiveView('projects')}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, padding: 4 }}
            activeOpacity={0.7}
          >
            <ChevronLeft size={18} color={BRAND} />
            <Text style={{ fontSize: 13, color: BRAND, fontWeight: '600' }}>My Projects</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 13, color: TEXT_LIGHT }}>/ Order Details</Text>
        </View>

        {projectViewLoading ? (
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <ActivityIndicator size="large" color={BRAND} />
            <Text style={{ marginTop: 12, color: TEXT_LIGHT }}>Loading project…</Text>
          </View>
        ) : !proj ? (
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <Text style={{ color: TEXT_LIGHT }}>Project not found.</Text>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: 20, alignItems: 'flex-start' }}>
            {/* Left / Main column */}
            <View style={{ flex: 1, gap: 16 }}>

              {/* Header card */}
              <View style={pvStyles.card}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <StatusPill status={proj.status} quoteResponse={proj.quoteResponse} />
                  {proj.orderType ? (
                    <View style={{ backgroundColor: '#F3F4F6', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: TEXT_LIGHT }}>{proj.orderType}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={pvStyles.projectTitle}>{proj.title || 'Untitled Project'}</Text>
                <View style={{ flexDirection: 'row', gap: 28, marginTop: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                  <View>
                    <Text style={pvStyles.metaLabel}>IN-HANDS DATE</Text>
                    <Text style={pvStyles.metaValue}>{proj.inHandsDate ? formatDate(proj.inHandsDate) : '—'}</Text>
                  </View>
                  <View>
                    <Text style={pvStyles.metaLabel}>SUBMITTED</Text>
                    <Text style={pvStyles.metaValue}>{formatDate(proj.createdAt)}</Text>
                  </View>
                  <View>
                    <Text style={pvStyles.metaLabel}>TOTAL PIECES</Text>
                    <Text style={pvStyles.metaValue}>{totalQty} pcs</Text>
                  </View>
                </View>
                <ProjectPipeline status={proj.status} />
                {proj.notesClient ? (
                  <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: BORDER }}>
                    <Text style={pvStyles.metaLabel}>NOTES</Text>
                    <Text style={{ fontSize: 13, color: TEXT, marginTop: 4, lineHeight: 20 }}>{proj.notesClient}</Text>
                  </View>
                ) : null}
              </View>

              {/* Order Summary — line-item product cards lead the page */}
              <View style={pvStyles.card}>
                <Text style={pvStyles.sectionTitle}>Order Summary</Text>

                {lineItems.length === 0 ? (
                  <Text style={{ color: TEXT_LIGHT, fontSize: 13, marginTop: 8 }}>No items yet.</Text>
                ) : (
                  <View style={{ marginTop: 4 }}>
                    {lineItems.map((li: any, idx: number) => (
                      <PortalCustomerLineItemCard key={li.id || idx} li={li} index={idx} orgIdForFiles={orgIdForFiles} />
                    ))}
                  </View>
                )}

                {/* Footer summary bar */}
                {lineItems.length > 0 && (
                  <View style={pvStyles.lineItemFooter}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>
                      {lineItems.length} Design{lineItems.length !== 1 ? 's' : ''} • {totalQty} Total Pieces
                    </Text>
                  </View>
                )}
              </View>

              {/* Project Assets — single download center for the whole project */}
              <View style={pvStyles.card}>
                <Text style={pvStyles.sectionTitle}>Project Assets</Text>
                <Text style={pvStyles.sectionSub}>Everything tied to this project — artwork, invoices, proofs and downloads. Mockups live on each line item above.</Text>

                {/* Artwork */}
                {artworkFiles.length > 0 && (
                  <View style={pvStyles.assetCat}>
                    {assetCatHeader('Artwork', artworkFiles.length)}
                    <View style={pvStyles.assetGrid}>
                      {artworkFiles.map((f: any) => renderFileTile(f, 'Artwork'))}
                    </View>
                  </View>
                )}

                {/* Invoices */}
                {invoiceTotal > 0 && (
                  <View style={pvStyles.assetCat}>
                    {assetCatHeader('Invoices', invoiceTotal)}
                    {invoices.length > 0 && (
                      <View style={{ gap: 8, marginTop: 4 }}>
                        {invoices.map((inv: any) => renderInvoiceRow(inv))}
                      </View>
                    )}
                    {invoiceFiles.length > 0 && (
                      <View style={[pvStyles.assetGrid, invoices.length > 0 && { marginTop: 10 }]}>
                        {invoiceFiles.map((f: any) => renderFileTile(f, 'Invoice'))}
                      </View>
                    )}
                  </View>
                )}

                {/* Proofs */}
                {proofFiles.length > 0 && (
                  <View style={pvStyles.assetCat}>
                    {assetCatHeader('Proofs', proofFiles.length)}
                    <View style={pvStyles.assetGrid}>
                      {proofFiles.map((f: any) => renderFileTile(f, 'Proof'))}
                    </View>
                  </View>
                )}

                {/* Downloads — generated project summary is always available */}
                <View style={pvStyles.assetCat}>
                  {assetCatHeader('Downloads', 1 + downloadFiles.length)}
                  <View style={{ gap: 8, marginTop: 4 }}>
                    <View style={pvStyles.fileRow}>
                      <View style={pvStyles.fileIcon}><FileText size={16} color={BRAND} /></View>
                      <View style={{ flex: 1 }}>
                        <Text style={pvStyles.fileName} numberOfLines={1}>Project Summary (PDF)</Text>
                        <Text style={pvStyles.fileMeta}>Generated on demand</Text>
                      </View>
                      <TouchableOpacity style={pvStyles.fileDownloadBtn} activeOpacity={0.7} onPress={downloadSummaryPdf}>
                        <Download size={15} color={TEXT_MED} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  {downloadFiles.length > 0 && (
                    <View style={[pvStyles.assetGrid, { marginTop: 10 }]}>
                      {downloadFiles.map((f: any) => renderFileTile(f, 'Download'))}
                    </View>
                  )}
                </View>

                {/* Empty state — no uploaded assets yet */}
                {uploadedAssetTotal === 0 && (
                  <Text style={{ fontSize: 12, color: TEXT_LIGHT, marginTop: 12, lineHeight: 18 }}>
                    No artwork, proofs, or invoices have been added to this project yet. Your project summary is always available to download above.
                  </Text>
                )}
              </View>

            </View>

            {/* Right column: Quote response + Pricing + Actions */}
            <View style={{ width: 280, gap: 16 }}>
              {/* Quote response (Approve / Request Changes / Decline) */}
              {(canRespondToQuote || quoteResp) && (
                <View style={pvStyles.card}>
                  <Text style={pvStyles.sectionTitle}>Your Quote</Text>
                  {canRespondToQuote ? (
                    <View style={{ marginTop: 12, gap: 10 }}>
                      <Text style={{ fontSize: 12, color: TEXT_LIGHT, lineHeight: 18 }}>
                        Review your quote and let us know how you’d like to proceed.
                      </Text>
                      <TouchableOpacity
                        style={pvStyles.qrApprove}
                        activeOpacity={0.85}
                        onPress={() => { setQuoteActionError(null); setQuoteActionNote(''); setQuoteActionModal({ action: 'approve' }); }}
                      >
                        <Check size={16} color="#fff" />
                        <Text style={pvStyles.qrApproveText}>Approve Quote</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={pvStyles.actionSecondary}
                        activeOpacity={0.85}
                        onPress={() => { setQuoteActionError(null); setQuoteActionNote(''); setQuoteActionModal({ action: 'request_changes' }); }}
                      >
                        <MessageCircle size={16} color={TEXT_MED} />
                        <Text style={pvStyles.actionSecondaryText}>Request Changes</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={pvStyles.qrDecline}
                        activeOpacity={0.85}
                        onPress={() => { setQuoteActionError(null); setQuoteActionNote(''); setQuoteActionModal({ action: 'decline' }); }}
                      >
                        <X size={16} color="#DC2626" />
                        <Text style={pvStyles.qrDeclineText}>Decline</Text>
                      </TouchableOpacity>
                    </View>
                  ) : respCfg ? (
                    <View style={{ marginTop: 12 }}>
                      <View style={[pvStyles.qrBanner, { backgroundColor: respCfg.bg }]}>
                        <Text style={[pvStyles.qrBannerLabel, { color: respCfg.color }]}>{respCfg.label}</Text>
                        {proj?.quoteRespondedAt ? (
                          <Text style={pvStyles.qrBannerMeta}>
                            {proj.quoteResponseBy ? `${proj.quoteResponseBy} · ` : ''}{fmtDateTime(proj.quoteRespondedAt)}
                          </Text>
                        ) : null}
                      </View>
                      {proj?.quoteResponseNote ? (
                        <View style={{ marginTop: 10 }}>
                          <Text style={pvStyles.metaLabel}>{quoteResp === 'declined' ? 'REASON' : quoteResp === 'changes_requested' ? 'REQUESTED CHANGES' : 'YOUR NOTE'}</Text>
                          <Text style={{ fontSize: 13, color: TEXT_MED, lineHeight: 19, marginTop: 2 }}>{proj.quoteResponseNote}</Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              )}

              <View style={pvStyles.card}>
                <Text style={pvStyles.sectionTitle}>Pricing</Text>
                {grandTotal == null ? (
                  <Text style={{ color: TEXT_LIGHT, fontSize: 13, marginTop: 10 }}>Pricing is pending review.</Text>
                ) : (
                  <View style={{ marginTop: 12 }}>
                    {pricingRows.map(r => (
                      <View key={r.label} style={pvStyles.priceRow}>
                        <Text style={pvStyles.priceRowLabel}>{r.label}</Text>
                        <Text style={pvStyles.priceRowVal}>{fmt(r.value)}</Text>
                      </View>
                    ))}
                    <View style={pvStyles.totalBlock}>
                      <Text style={pvStyles.totalLabel}>TOTAL</Text>
                      <Text style={pvStyles.totalAmt}>${grandTotal.toFixed(2)}</Text>
                    </View>
                    {perPiece ? (
                      <Text style={{ fontSize: 12, color: TEXT_LIGHT, textAlign: 'center', marginTop: 8 }}>
                        ${perPiece.toFixed(2)} per piece
                      </Text>
                    ) : null}
                  </View>
                )}
              </View>

              {/* Actions */}
              <View style={pvStyles.card}>
                <Text style={pvStyles.sectionTitle}>Actions</Text>
                <View style={{ marginTop: 12, gap: 10 }}>
                  <TouchableOpacity
                    style={pvStyles.actionPrimary}
                    activeOpacity={0.85}
                    onPress={() => downloadCustomerProjectPdf({
                      title: proj.title || 'Project',
                      status: PORTAL_STATUS_CONFIG[proj.status.toUpperCase().replace('QUOTE_SENT', 'QUOTED')]?.label || proj.status,
                      orderType: proj.orderType,
                      inHandsDate: proj.inHandsDate ? formatDate(proj.inHandsDate) : null,
                      orgName: orgDisplayName || undefined,
                      customerName: session?.userName,
                      notes: proj.notesClient,
                      orgId: orgIdForFiles,
                      lineItems,
                      pricing: pricingRows,
                      total: grandTotal,
                    })}
                  >
                    <Download size={16} color="#fff" />
                    <Text style={pvStyles.actionPrimaryText}>Download PDF</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={pvStyles.actionSecondary}
                    activeOpacity={0.85}
                    onPress={() => Linking.openURL(`mailto:jobs@katalystko.com?subject=${encodeURIComponent('Question about ' + (proj.title || 'my project'))}`)}
                  >
                    <MessageCircle size={16} color={TEXT_MED} />
                    <Text style={pvStyles.actionSecondaryText}>Contact Katalyst Ko</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={pvStyles.actionSecondary} activeOpacity={0.85} onPress={() => handleReorderProject(proj.id, proj.title || '')}>
                    <RefreshCw size={16} color={TEXT_MED} />
                    <Text style={pvStyles.actionSecondaryText}>Reorder Project</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={[pvStyles.actionSecondary, isFavorite && pvStyles.actionFavActive]} activeOpacity={0.85} onPress={() => toggleFavorite(proj.id)}>
                    <Star size={16} color={isFavorite ? BRAND : TEXT_MED} fill={isFavorite ? BRAND : 'transparent'} />
                    <Text style={[pvStyles.actionSecondaryText, isFavorite && { color: BRAND }]}>{isFavorite ? 'Favorited' : 'Favorite Project'}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Quote Timeline */}
              {quoteTimeline.length > 0 && (
                <View style={pvStyles.card}>
                  <Text style={pvStyles.sectionTitle}>Quote Timeline</Text>
                  <View style={{ marginTop: 14 }}>
                    {quoteTimeline.map((ev, i) => (
                      <View key={ev.key} style={pvStyles.tlRow}>
                        <View style={pvStyles.tlMarkerCol}>
                          <View style={[pvStyles.tlDot, ev.done ? { backgroundColor: ev.color || BRAND, borderColor: ev.color || BRAND } : null]} />
                          {i < quoteTimeline.length - 1 ? <View style={pvStyles.tlLine} /> : null}
                        </View>
                        <View style={{ flex: 1, paddingBottom: i < quoteTimeline.length - 1 ? 16 : 0 }}>
                          <Text style={[pvStyles.tlLabel, !ev.done && { color: TEXT_LIGHT }]}>{ev.label}</Text>
                          <Text style={pvStyles.tlDate}>{ev.date ? fmtDateTime(ev.date) : (ev.done ? 'Completed' : 'Pending')}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Project History */}
              <View style={pvStyles.card}>
                <Text style={pvStyles.sectionTitle}>Project History</Text>
                <View style={{ marginTop: 12 }}>
                  <View style={pvStyles.priceRow}>
                    <Text style={pvStyles.priceRowLabel}>Originally Ordered</Text>
                    <Text style={pvStyles.priceRowVal}>
                      {proj.originalOrderDate
                        || (proj.orderDate ? formatDate(proj.orderDate) : (proj.createdAt ? formatDate(proj.createdAt) : '\u2014'))}
                    </Text>
                  </View>
                  <View style={pvStyles.priceRow}>
                    <Text style={pvStyles.priceRowLabel}>Last Reordered</Text>
                    <Text style={pvStyles.priceRowVal}>{proj.lastReorderedAt ? formatDate(proj.lastReorderedAt) : 'Never'}</Text>
                  </View>
                  <View style={pvStyles.priceRow}>
                    <Text style={pvStyles.priceRowLabel}>Times Reordered</Text>
                    <Text style={pvStyles.priceRowVal}>{proj.timesReordered ?? 0}</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    );
  };

  const MB_FILTER_CHIPS = ['All', 'Logos', 'Artwork', 'Proofs', 'Invoices', 'Mockups'];
  const MB_SORT_OPTIONS: Array<'Newest' | 'Oldest' | 'A-Z'> = ['Newest', 'Oldest', 'A-Z'];

  const ArtworkView = () => {
    const matchesFilter = (f: MediaFile) => {
      if (mediaBinFilter === 'All') return true;
      const ft = (f.fileType || '').toLowerCase();
      const name = f.originalName.toLowerCase();
      if (mediaBinFilter === 'Logos')    return ft === 'logo'    || name.includes('logo');
      if (mediaBinFilter === 'Artwork')  return ft === 'artwork' || ft === 'design' || name.includes('artwork');
      if (mediaBinFilter === 'Proofs')   return ft === 'proof'   || name.includes('proof');
      if (mediaBinFilter === 'Invoices') return ft === 'invoice' || name.includes('invoice') || f.mimeType === 'application/pdf';
      if (mediaBinFilter === 'Mockups')  return ft === 'mockup'  || name.includes('mockup');
      return true;
    };

    const base = mediaBinSearch.trim()
      ? mediaBinFiles.filter(f => f.originalName.toLowerCase().includes(mediaBinSearch.toLowerCase()))
      : mediaBinFiles;

    const filtered = base.filter(matchesFilter).sort((a, b) => {
      if (mediaBinSort === 'Newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (mediaBinSort === 'Oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return a.originalName.localeCompare(b.originalName);
    });

    const gridCols = isMobile
      ? (mediaBinGridSize === 4 ? 2 : mediaBinGridSize === 6 ? 3 : 4)
      : isTablet
      ? (mediaBinGridSize === 4 ? 3 : mediaBinGridSize === 6 ? 4 : 6)
      : mediaBinGridSize;

    return (
      <ScrollView contentContainerStyle={dash.viewContent} showsVerticalScrollIndicator={false}>
        <View style={dash.pageTitleRow}>
          <View>
            <Text style={dash.pageTitle}>Media Bin</Text>
            <Text style={mbStyles.pageSubtitle}>Store and manage your artwork, logos, and files.</Text>
          </View>
          <TouchableOpacity style={mbStyles.uploadBtn} onPress={() => mediaBinInputRef.current?.click?.()} disabled={mediaBinUploading}>
            {mediaBinUploading
              ? <ActivityIndicator size="small" color="#fff" />
              : <><Upload size={14} color="#fff" /><Text style={mbStyles.uploadBtnText}>Upload Files</Text></>
            }
          </TouchableOpacity>
        </View>
        {Platform.OS === 'web' && (
          <input ref={mediaBinInputRef} type="file" accept=".ai,.svg,.ps,.png,.jpg,.jpeg,.pdf,.emb,.dst,.pes" multiple style={{ display: 'none' }}
            onChange={(e: any) => { const files = Array.from((e.target.files || []) as globalThis.File[]); if (files.length > 0) handleMediaBinUpload(files); e.target.value = ''; }}
          />
        )}

        {/* Unified toolbar: chips left · search + sort + sizing right */}
        <View style={mbStyles.toolbar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1, flexShrink: 1 }}>
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              {MB_FILTER_CHIPS.map(chip => (
                <TouchableOpacity key={chip} style={[mbStyles.filterChip, mediaBinFilter === chip && mbStyles.filterChipActive]} onPress={() => setMediaBinFilter(chip)} activeOpacity={0.8}>
                  <Text style={[mbStyles.filterChipText, mediaBinFilter === chip && mbStyles.filterChipTextActive]}>{chip}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <View style={mbStyles.toolbarRight}>
            {/* Search */}
            <View style={mbStyles.searchBox}>
              <Search size={13} color={TEXT_PLACEHOLDER} />
              <TextInput
                style={mbStyles.searchInput}
                placeholder="Search files…"
                placeholderTextColor={TEXT_PLACEHOLDER}
                value={mediaBinSearch}
                onChangeText={setMediaBinSearch}
              />
              {mediaBinSearch.length > 0 && (
                <TouchableOpacity onPress={() => setMediaBinSearch('')} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <X size={12} color={TEXT_LIGHT} />
                </TouchableOpacity>
              )}
            </View>

            {/* Sort dropdown */}
            <OverlayMenu menuWidth={130} align="right"
              trigger={({ open: openMenu }) => (
                <TouchableOpacity style={mbStyles.sortDropBtn} onPress={openMenu} activeOpacity={0.8}>
                  <ArrowUpDown size={13} color={TEXT_MED} />
                  <Text style={mbStyles.sortDropBtnText}>{mediaBinSort}</Text>
                  <ChevronDown size={12} color={TEXT_LIGHT} />
                </TouchableOpacity>
              )}
            >
              {({ close }) => (
                <>
                  {MB_SORT_OPTIONS.map(s => (
                    <TouchableOpacity
                      key={s}
                      style={[mbStyles.sortDropItem, mediaBinSort === s && mbStyles.sortDropItemActive]}
                      onPress={() => { close(); setMediaBinSort(s); }}
                      activeOpacity={0.8}
                    >
                      <Text style={[mbStyles.sortDropItemText, mediaBinSort === s && mbStyles.sortDropItemTextActive]}>{s}</Text>
                      {mediaBinSort === s && <Check size={12} color={BRAND} />}
                    </TouchableOpacity>
                  ))}
                </>
              )}
            </OverlayMenu>

            {/* Grid size toggle */}
            <View style={mbStyles.viewToggle}>
              {([4, 6, 8] as const).map(n => (
                <TouchableOpacity
                  key={n}
                  style={[mbStyles.viewToggleBtn, mediaBinGridSize === n && mbStyles.viewToggleBtnActive]}
                  onPress={() => setMediaBinGridSize(n)}
                >
                  <Text style={[mbStyles.viewToggleNum, mediaBinGridSize === n && mbStyles.viewToggleNumActive]}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {mediaBinLoading ? (
          <ActivityIndicator size="large" color={BRAND} style={{ marginTop: 32 }} />
        ) : filtered.length === 0 && (mediaBinSearch || mediaBinFilter !== 'All') ? (
          <EmptyState icon={<Search size={32} color="#D1D5DB" />} title="No matching files" sub="Try a different search or filter." />
        ) : mediaBinFiles.length === 0 ? (
          <View style={mbStyles.mbEmptyBin}>
            <View style={[mbStyles.mediaDot, { top: 18, left: 28, width: 5, height: 5 }]} />
            <View style={[mbStyles.mediaDot, { top: 12, right: 60, width: 4, height: 4 }]} />
            <View style={[mbStyles.mediaDot, { top: 30, right: 32, width: 6, height: 6, opacity: 0.4 }]} />
            <View style={[mbStyles.mediaDot, { bottom: 44, left: 18, width: 4, height: 4, opacity: 0.35 }]} />
            <View style={[mbStyles.mediaDot, { bottom: 30, right: 20, width: 5, height: 5, opacity: 0.5 }]} />
            <View style={mbStyles.mediaBinIconRow}>
              <View style={[mbStyles.mediaBinCard, { transform: [{ rotate: '-10deg' }], marginRight: -12, zIndex: 1 }]}>
                <ImageIcon size={22} color="#9CA3AF" />
              </View>
              <View style={[mbStyles.mediaBinCard, mbStyles.mediaBinCardCenter, { zIndex: 3 }]}>
                <Film size={26} color="#9CA3AF" />
              </View>
              <View style={[mbStyles.mediaBinCard, { transform: [{ rotate: '10deg' }], marginLeft: -12, zIndex: 1 }]}>
                <Music size={22} color="#9CA3AF" />
              </View>
            </View>
            <Text style={mbStyles.mediaBinEmptyText}>Drag and drop your media here</Text>
            <Text style={mbStyles.mediaBinEmptySub}>AI · SVG · PS · PNG · JPG · PDF · EMB · DST · PES</Text>
          </View>
        ) : (
          <View style={mbStyles.visualGrid}>
            {filtered.map(file => (
              <View key={file.id} style={{ width: `${100 / gridCols}%`, paddingHorizontal: 5, marginBottom: 10 }}>
                {renderPortalMediaCard(file, { width: '100%' })}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    );
  };

  const CAT_COLORS: Record<string, string> = {
    Apparel: '#4F46E5', Promotional: '#FF5A00', Accessories: '#0891B2', Signage: '#16A34A',
    Streetwear: '#9333EA', Workwear: '#0891B2', Other: '#6B7280',
  };
  const CAT_FILTER_CHIPS = ['All', 'Apparel', 'Streetwear', 'Promotional', 'Workwear'];

  const CatalogsView = () => {
    const numCols = isMobile ? 2 : isTablet ? 2 : 4;
    const displayed = clientCatalogs.filter(cat => {
      const matchesCat = catFilter === 'All' || cat.category === catFilter;
      const q = catSearch.trim().toLowerCase();
      const matchesSearch = !q || cat.name.toLowerCase().includes(q) || (cat.vendorName || '').toLowerCase().includes(q) || (cat.description || '').toLowerCase().includes(q);
      return matchesCat && matchesSearch;
    });

    const NeedHelpCard = () => (
      <View style={catStyles.needHelpCard}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Shield size={16} color={BRAND} />
          <Text style={catStyles.needHelpTitle}>Need Help?</Text>
        </View>
        <Text style={catStyles.needHelpSub}>Our team is here to help you get the perfect print.</Text>
        {([
          { heading: 'Not sure what you need?', body: "Describe your project — we'll suggest the right options." },
          { heading: 'Want to see samples?',    body: 'We can set up a call or arrange a sample run.' },
          { heading: 'Tight deadline?',         body: "Tell us your date and we'll make it work." },
        ] as { heading: string; body: string }[]).map(({ heading, body }) => (
          <View key={heading} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
            <CheckCircle2 size={14} color={BRAND} style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={catStyles.needHelpItemTitle}>{heading}</Text>
              <Text style={catStyles.needHelpItemBody}>{body}</Text>
            </View>
          </View>
        ))}
        <View style={catStyles.needHelpDivider} />
        <Text style={catStyles.needHelpContactLabel}>CONTACT US</Text>
        <TouchableOpacity style={catStyles.needHelpPhoneBtn} onPress={() => Linking.openURL('tel:4805599033')} activeOpacity={0.85}>
          <Text style={catStyles.needHelpPhoneText}>(480) 559-9033</Text>
        </TouchableOpacity>
        <TouchableOpacity style={catStyles.needHelpEmailBtn} onPress={() => Linking.openURL('mailto:jobs@katalystko.com')} activeOpacity={0.85}>
          <Mail size={13} color="#fff" />
          <Text style={catStyles.needHelpEmailText}>Email Us</Text>
        </TouchableOpacity>
      </View>
    );

    return (
      <ScrollView contentContainerStyle={dash.viewContent} showsVerticalScrollIndicator={false}>
        {/* Header row */}
        <View style={catStyles.headerRow}>
          <View>
            <Text style={dash.pageTitle}>Product Catalogs</Text>
            <Text style={catStyles.headerSub}>Browse product lines shared by Katalyst Ko</Text>
          </View>
          <TouchableOpacity style={catStyles.requestBtn} onPress={() => setActiveView('submit')} activeOpacity={0.85}>
            <ExternalLink size={14} color="#fff" />
            <Text style={catStyles.requestBtnText}>Request a Product</Text>
          </TouchableOpacity>
        </View>

        {/* Search + filter chips — full width above the split */}
        <View style={catStyles.searchRow}>
          <Search size={14} color={TEXT_PLACEHOLDER} style={{ marginRight: 8 }} />
          <TextInput style={catStyles.searchInput} placeholder="Search catalogs by brand or product…" placeholderTextColor={TEXT_PLACEHOLDER} value={catSearch} onChangeText={setCatSearch} />
          {catSearch.length > 0 && <TouchableOpacity onPress={() => setCatSearch('')} style={{ padding: 4 }}><X size={14} color={TEXT_LIGHT} /></TouchableOpacity>}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={catStyles.chipsScroll}>
          <View style={catStyles.chipsRow}>
            {CAT_FILTER_CHIPS.map(chip => (
              <TouchableOpacity key={chip} style={[catStyles.chip, catFilter === chip && catStyles.chipActive]} onPress={() => setCatFilter(chip)} activeOpacity={0.8}>
                <Text style={[catStyles.chipText, catFilter === chip && catStyles.chipTextActive]}>{chip}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Grid + Need Help side-by-side, starting below the search bar */}
        <View style={{ flexDirection: 'row', gap: 16, alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            {catalogsLoading ? (
              <View style={{ alignItems: 'center', paddingVertical: 48 }}>
                <ActivityIndicator color={BRAND} />
                <Text style={{ fontSize: 14, color: TEXT_LIGHT, marginTop: 10 }}>Loading catalogs…</Text>
              </View>
            ) : displayed.length === 0 ? (
              <EmptyState icon={<BookOpen size={40} color="#D1D5DB" />} title={clientCatalogs.length === 0 ? "No catalogs available yet" : "No matching catalogs"} sub={clientCatalogs.length === 0 ? "Product catalogs will be shared here by your Katalyst Ko representative." : "Try a different search or filter."} />
            ) : (
              <View style={catStyles.grid}>
                {displayed.map(cat => {
                  const color = CAT_COLORS[cat.category] || '#6B7280';
                  const initials = (cat.vendorName || cat.name).split(' ').map((w: string) => w[0]).join('').slice(0, 3).toUpperCase();
                  const cardW = numCols === 1 ? '100%' : numCols === 2 ? '48%' : numCols === 4 ? '23.5%' : '32%';
                  return (
                    <View key={cat.id} style={[catStyles.card, { width: cardW as any, flexGrow: 0, flexShrink: 0 }]}>
                      {/* Badge row */}
                      <View style={catStyles.cardTopRow}>
                        <View style={[catStyles.avatar, { backgroundColor: color }]}>
                          <Text style={catStyles.avatarText}>{initials}</Text>
                        </View>
                        <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Text style={catStyles.dotsBtn}>•••</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Logo image area */}
                      <View style={catStyles.imgArea}>
                        {cat.coverImageUrl ? (
                          <Image source={{ uri: cat.coverImageUrl }} style={catStyles.logoImg} resizeMode="contain" />
                        ) : (
                          <View style={[catStyles.logoPlaceholder, { backgroundColor: color + '15' }]}>
                            <Text style={[catStyles.logoPlaceholderText, { color }]}>{initials}</Text>
                          </View>
                        )}
                      </View>

                      {/* Name + description + category */}
                      <Text style={catStyles.name}>{cat.vendorName || cat.name}</Text>
                      {cat.description ? <Text style={catStyles.description}>{cat.description}</Text> : null}
                      <View style={[catStyles.badge, { backgroundColor: color + '18', alignSelf: 'flex-start' }]}>
                        <Text style={[catStyles.badgeText, { color }]}>{cat.category}</Text>
                      </View>

                      {/* Action buttons */}
                      <View style={catStyles.actions}>
                        <TouchableOpacity style={catStyles.primaryBtn} onPress={() => Linking.openURL(cat.catalogUrl)} activeOpacity={0.85}>
                          <BookOpen size={15} color="#fff" />
                          <Text style={catStyles.primaryBtnText}>Open Catalog</Text>
                        </TouchableOpacity>
                        {cat.websiteUrl ? (
                          <TouchableOpacity style={catStyles.secondaryBtn} onPress={() => Linking.openURL(cat.websiteUrl!)} activeOpacity={0.85}>
                            <ExternalLink size={14} color={BRAND} />
                            <Text style={catStyles.secondaryBtnText}>Visit Website</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
            {isMobile && <NeedHelpCard />}
          </View>

          {/* Persistent Need Help column — starts flush with the top of the grid */}
          {!isMobile && (
            <View style={catStyles.needHelpColumn}>
              <NeedHelpCard />
            </View>
          )}
        </View>
      </ScrollView>
    );
  };

  const SubmitView = () => (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={[dash.viewContent, submittedId ? { alignItems: 'center' } : {}]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {submittedId ? (
          <View style={[styles.card, { maxWidth: 520 }]}>
            <View style={styles.successIcon}><CheckCircle size={40} color="#16A34A" /></View>
            <Text style={styles.cardTitle}>Request Submitted!</Text>
            <Text style={styles.cardSub}>
              Your project request has been received.{submissionEmailSent ? ' A confirmation has been sent to your email.' : ' The Katalyst Ko team will review it and reach out with a quote.'}
            </Text>
            <View style={styles.successRef}>
              <Text style={styles.successRefLabel}>Reference ID</Text>
              <Text style={styles.successRefValue} numberOfLines={1}>{submittedId}</Text>
            </View>
            {editSecondsLeft > 0 && (
              <View style={styles.editWindowBox}>
                <Text style={styles.editWindowTitle}>Need to make a change?</Text>
                <Text style={styles.editWindowSub}>
                  You can edit or cancel this request for{' '}
                  <Text style={{ fontWeight: '700', color: TEXT }}>
                    {Math.floor(editSecondsLeft / 60)}:{String(editSecondsLeft % 60).padStart(2, '0')}
                  </Text>
                </Text>
                <View style={styles.editWindowBtns}>
                  <TouchableOpacity style={[styles.editBtn, cancelling && styles.btnDisabled]} onPress={handleEditSubmission} disabled={cancelling}>
                    {cancelling
                      ? <ActivityIndicator size="small" color="#374151" />
                      : <><Edit2 size={14} color="#374151" /><Text style={styles.editBtnText}>Edit Request</Text></>
                    }
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.cancelBtn, cancelling && styles.btnDisabled]} onPress={handleCancelSubmission} disabled={cancelling}>
                    <Trash2 size={14} color="#DC2626" />
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            <TouchableOpacity style={[styles.btn, { marginTop: 4 }]} onPress={handleNewRequest}>
              <Text style={styles.btnText}>Submit Another Request</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.backBtn} onPress={() => setActiveView('home')}>
              <ArrowLeft size={14} color={TEXT_LIGHT} />
              <Text style={styles.backBtnText}>Back to Dashboard</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[svStyles.formRow, isMobile && { flexDirection: 'column' as any }]}>
            <View style={[styles.card, { flex: 1, maxWidth: 680 }]}>
            <Text style={styles.formTitle}>{reorderSourceId ? 'Review Your Reorder' : 'Submit a Project Request'}</Text>
            <Text style={styles.formSub}>{reorderSourceId
              ? "We've pre-filled your previous order below. Adjust quantities, add notes, or upload new artwork, then submit."
              : 'Fill in the details below — your submission will come straight into Ko OS ready for pricing.'}</Text>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionLabel}>Request Details</Text>
              <View style={[liStyles.twoCol, { marginBottom: 4 }]}>
                <View style={[pFields.container, { flex: 1 }]}>
                  <Text style={pFields.label}>Organization</Text>
                  <View style={pFields.readOnly}><Text style={pFields.readOnlyText}>{session?.orgName}</Text></View>
                </View>
                <View style={[pFields.container, { flex: 1 }]}>
                  <Text style={pFields.label}>Submitted By</Text>
                  <View style={pFields.readOnly}><Text style={pFields.readOnlyText}>{session?.userName}</Text></View>
                </View>
              </View>
              <View style={pFields.container}>
                <Text style={pFields.label}>Project Name <Text style={{ color: BRAND }}>*</Text></Text>
                <TextInput
                  style={[pFields.input, formErrors.projectName && pFields.inputError]}
                  value={projectName}
                  onChangeText={v => { setProjectName(v); setFormErrors(e => ({ ...e, projectName: false })); }}
                  placeholder="e.g. Spring 2025 Team Shirts"
                  placeholderTextColor={TEXT_PLACEHOLDER}
                />
              </View>
              <View style={liStyles.twoCol}>
                <View style={[pFields.container, { flex: 1 }]}>
                  <Text style={pFields.label}>Order Type</Text>
                  <TouchableOpacity style={pFields.selectRow} onPress={() => openDropdown('Order Type', PORTAL_ORDER_TYPES, orderType, setOrderType)}>
                    <Text style={pFields.selectText}>{orderType}</Text>
                    <ChevronDown size={15} color={TEXT_LIGHT} />
                  </TouchableOpacity>
                </View>
                <View style={[{ flex: 1 }]}>
                  <PortalDatePicker
                    label="In Hands Date"
                    required
                    value={inHandsDate}
                    onChange={v => { setInHandsDate(v); setFormErrors(e => ({ ...e, inHandsDate: false })); }}
                    hasError={formErrors.inHandsDate}
                  />
                </View>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Line Items</Text>
            <Text style={styles.sectionSub}>Add one line item per design or service type.</Text>
            {lineItems.map((item, i) => (
              <PortalLineItemCard
                key={item.id}
                item={item}
                index={i}
                canDelete={lineItems.length > 1}
                onChange={updated => updateLineItem(item.id, updated)}
                onDelete={() => removeLineItem(item.id)}
                openDropdown={openDropdown}
                onOpenMockupBinPicker={(itemId) => openBinPicker('mockup', itemId)}
              />
            ))}
            <TouchableOpacity style={styles.addLineItemBtn} onPress={addLineItem}>
              <Plus size={14} color={BRAND} />
              <Text style={styles.addLineItemText}>Add Another Line Item</Text>
            </TouchableOpacity>

            <View style={[pFields.container, { marginTop: 4 }]}>
              <Text style={pFields.label}>Overall Request Notes</Text>
              <Text style={pFields.hint}>Any general instructions or context for the entire request.</Text>
              <TextInput
                style={pFields.textarea}
                value={requestNotes}
                onChangeText={setRequestNotes}
                placeholder="Shipping details, rush notes, color direction, brand standards…"
                placeholderTextColor={TEXT_PLACEHOLDER}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            {/* Artwork Upload Zone */}
            <View style={[pFields.container, { marginTop: 4 }]}>
              <Text style={pFields.label}>Attach Artwork Files</Text>
              <Text style={pFields.hint}>AI, SVG, PS, PNG, JPG, PDF, EMB, DST, PES · Multiple files supported</Text>
              {Platform.OS === 'web' && (
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".ai,.svg,.ps,.png,.jpg,.jpeg,.pdf,.emb,.dst,.pes"
                  multiple
                  style={{ display: 'none' }}
                  onChange={(e: any) => {
                    const files = Array.from((e.target.files || []) as globalThis.File[]);
                    handleFilesAdded(files);
                    e.target.value = '';
                  }}
                />
              )}
              <TouchableOpacity
                ref={dropZoneRef}
                style={[upStyles.dropZone, isDraggingOver && upStyles.dropZoneActive]}
                onPress={() => fileInputRef.current?.click?.()}
                activeOpacity={0.85}
              >
                <Upload size={22} color={isDraggingOver ? BRAND : '#9CA3AF'} />
                <Text style={[upStyles.dropZoneText, isDraggingOver && { color: BRAND }]}>
                  {isDraggingOver ? 'Drop to add files' : 'Click or drag files here'}
                </Text>
                <Text style={upStyles.dropZoneSub}>AI · SVG · PS · PNG · JPG · PDF · EMB · DST · PES</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={liStyles.binPickLink}
                onPress={() => openBinPicker('artwork')}
                activeOpacity={0.7}
              >
                <Library size={13} color={BRAND} />
                <Text style={liStyles.binPickLinkText}>Choose from Media Bin</Text>
              </TouchableOpacity>
              {(pendingFiles.length > 0 || artworkFromBin.length > 0) && (
                <View style={upStyles.fileList}>
                  {pendingFiles.map(pf => (
                    <View key={pf.id} style={upStyles.fileRow}>
                      <FileText size={14} color={BRAND} style={{ flexShrink: 0 }} />
                      <Text style={upStyles.fileRowName} numberOfLines={1}>{pf.name}</Text>
                      <Text style={upStyles.fileRowSize}>{pf.size < 1048576 ? `${(pf.size / 1024).toFixed(0)} KB` : `${(pf.size / 1048576).toFixed(1)} MB`}</Text>
                      <TouchableOpacity onPress={() => removePendingFile(pf.id)} style={upStyles.fileRemoveBtn}>
                        <X size={13} color={TEXT_LIGHT} />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {artworkFromBin.map(f => (
                    <View key={f.id} style={upStyles.fileRow}>
                      <Library size={14} color={BRAND} style={{ flexShrink: 0 }} />
                      <Text style={upStyles.fileRowName} numberOfLines={1}>{f.originalName}</Text>
                      <Text style={upStyles.fileRowSize}>Media Bin</Text>
                      <TouchableOpacity onPress={() => setArtworkFromBin(prev => prev.filter(x => x.id !== f.id))} style={upStyles.fileRemoveBtn}>
                        <X size={13} color={TEXT_LIGHT} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
              {uploadingFiles && (
                <View style={upStyles.uploadingRow}>
                  <ActivityIndicator size="small" color={BRAND} />
                  <Text style={upStyles.uploadingText}>Uploading files…</Text>
                </View>
              )}
            </View>

            {submitError ? <View style={styles.errorBox}><Text style={styles.errorText}>{submitError}</Text></View> : null}

            <TouchableOpacity style={[styles.btn, (submitting || uploadingFiles) && styles.btnDisabled]} onPress={handleSubmit} disabled={submitting || uploadingFiles}>
              {submitting ? <ActivityIndicator size="small" color="#fff" /> : (
                <>
                  <Send size={16} color="#fff" />
                  <Text style={[styles.btnText, { marginLeft: 8 }]}>{(() => { const total = pendingFiles.length + artworkFromBin.length; return `Submit Request${total > 0 ? ` + ${total} file${total !== 1 ? 's' : ''}` : ''}`; })()}</Text>
                </>
              )}
            </TouchableOpacity>
            </View>
            <View style={[svStyles.helperCard, isMobile && svStyles.helperCardMobile]}>
                <View style={svStyles.helperBrand}>
                  <Shield size={16} color={BRAND} />
                  <Text style={svStyles.helperBrandText}>Need Help?</Text>
                </View>
                <Text style={svStyles.helperTagline}>Our team is here to help you get the perfect print.</Text>
                {([
                  { heading: 'Not sure what you need?', body: "Describe your project — we'll suggest the right options." },
                  { heading: 'Want to see samples?',    body: 'We can set up a call or arrange a sample run.' },
                  { heading: 'Tight deadline?',         body: "Tell us your date and we'll make it work." },
                ] as { heading: string; body: string }[]).map(({ heading, body }) => (
                  <View key={heading} style={svStyles.helperItem}>
                    <CheckCircle2 size={14} color={BRAND} style={{ marginTop: 2 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={svStyles.helperItemTitle}>{heading}</Text>
                      <Text style={svStyles.helperItemBody}>{body}</Text>
                    </View>
                  </View>
                ))}
                <View style={svStyles.helperDivider} />
                <Text style={svStyles.helperCallLabel}>CONTACT US</Text>
                <TouchableOpacity style={svStyles.helperPhoneBtn} onPress={() => Linking.openURL('tel:4805599033')} activeOpacity={0.85}>
                  <Text style={svStyles.helperPhoneText}>(480) 559-9033</Text>
                </TouchableOpacity>
                <TouchableOpacity style={svStyles.helperEmailBtn} onPress={() => Linking.openURL('mailto:jobs@katalystko.com')} activeOpacity={0.85}>
                  <Mail size={14} color="#fff" />
                  <Text style={svStyles.helperEmailText}>Email Us</Text>
                </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );

  const isOrgAdmin = session?.role === 'ORG_ADMIN';

  const AVATAR_COLORS = [
    '#FF5A00', '#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
    '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#14B8A6', '#64748B',
  ];

  const ProfileView = () => {
    const [showInviteInput, setShowInviteInput] = useState(false);
    const [copied, setCopied] = useState(false);
    const [openSections, setOpenSections] = useState<{ branding: boolean; info: boolean; settings: boolean }>({ branding: false, info: false, settings: false });
    const toggleSection = (k: 'branding' | 'info' | 'settings') => setOpenSections((s) => ({ ...s, [k]: !s[k] }));
    const showBranding = !isMobile || openSections.branding;
    const showInfo = !isMobile || openSections.info;
    const showSettings = !isMobile || openSections.settings;

    const CardHead = ({ title, right, collapsible, expanded, onToggle }: { title: string; right?: React.ReactNode; collapsible?: boolean; expanded?: boolean; onToggle?: () => void }) => {
      const inner = (
        <View style={profStyles.cardHead}>
          <Text style={profStyles.cardHeadText}>{title}</Text>
          <View style={profStyles.cardHeadRight}>
            {right}
            {collapsible ? (expanded ? <ChevronUp size={18} color="#fff" /> : <ChevronDown size={18} color="#fff" />) : null}
          </View>
        </View>
      );
      return collapsible
        ? <TouchableOpacity activeOpacity={0.85} onPress={onToggle}>{inner}</TouchableOpacity>
        : inner;
    };

    const handleInvite = async () => {
      if (!session || !teamInviteEmail.trim()) return;
      setTeamInviting(true);
      setTeamInviteError('');
      setTeamInviteSuccess('');
      try {
        const res = await fetch('/api/portal/team', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orgId: session.orgId, callerUserId: session.userId, email: teamInviteEmail.trim() }),
        });
        const d = await res.json();
        if (!res.ok) { setTeamInviteError(d.error || 'Failed to add member.'); }
        else { setTeamInviteSuccess(`${teamInviteEmail.trim()} has been added.`); setTeamInviteEmail(''); setShowInviteInput(false); fetchTeam(session.orgId); }
      } catch { setTeamInviteError('Connection error. Please try again.'); }
      setTeamInviting(false);
    };

    const handleResendInvite = async (email: string) => {
      if (!session) return;
      setTeamInviteError('');
      setTeamInviteSuccess('');
      try {
        const res = await fetch('/api/portal/team', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orgId: session.orgId, callerUserId: session.userId, email }),
        });
        const d = await res.json();
        if (!res.ok) { setTeamInviteError(d.error || 'Failed to resend.'); }
        else { setTeamInviteSuccess(`Invite resent to ${email}.`); fetchTeam(session.orgId); }
      } catch { setTeamInviteError('Connection error.'); }
    };

    const handleRemove = async (userId: string) => {
      if (!session) return;
      try {
        await fetch(`/api/portal/team/${userId}?orgId=${session.orgId}&callerUserId=${session.userId}`, { method: 'DELETE' });
        setTeamMembers(prev => prev.filter(m => m.id !== userId));
      } catch {}
    };

    const handleProfilePicFile = async (e: any) => {
      const file = e.target?.files?.[0];
      if (!file || !session) return;
      setProfileSaving(true);
      setProfileSaveMsg('');
      try {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('orgId', session.orgId);
        fd.append('userId', session.userId);
        const uploadRes = await fetch('/api/files', { method: 'POST', body: fd });
        const uploadData = await uploadRes.json();
        if (uploadRes.ok && uploadData.file?.id) {
          const picUrl = `/api/files/${uploadData.file.id}?inline=true`;
          await fetch('/api/users', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: session.userId, avatarUri: picUrl }),
          });
          setProfilePicUri(picUrl);
          setProfileSaveMsg('Profile picture updated!');
        }
      } catch {}
      setProfileSaving(false);
      if (profilePicInputRef.current) profilePicInputRef.current.value = '';
    };

    const handleRemoveProfilePic = async () => {
      if (!session) return;
      setProfileSaving(true);
      setProfileSaveMsg('');
      try {
        await fetch('/api/users', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: session.userId, avatarUri: null }),
        });
        setProfilePicUri(null);
        setProfileSaveMsg('Profile picture removed.');
      } catch {}
      setProfileSaving(false);
    };

    const handleAvatarColorChange = async (color: string) => {
      if (!session) return;
      setProfileAvatarColor(color);
      try {
        await fetch('/api/users', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: session.userId, avatarColor: color }),
        });
        setProfileSaveMsg('Avatar color saved!');
      } catch {}
    };

    const handleOrgLogoFile = async (e: any) => {
      const file = e.target?.files?.[0];
      if (!file || !session) return;
      setOrgLogoSaving(true);
      setOrgLogoSaveMsg('');
      try {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('orgId', session.orgId);
        fd.append('userId', session.userId);
        const uploadRes = await fetch('/api/files', { method: 'POST', body: fd });
        const uploadData = await uploadRes.json();
        if (uploadRes.ok && uploadData.file?.id) {
          const logoUrl = `/api/portal/${session.orgId}/files/${uploadData.file.id}?inline=true`;
          await fetch(`/api/portal/${session.orgId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callerUserId: session.userId, logoUrl }),
          });
          setOrgLogoUrl(logoUrl);
          setOrgLogoSaveMsg('Organization logo updated!');
        }
      } catch {}
      setOrgLogoSaving(false);
      if (orgLogoInputRef.current) orgLogoInputRef.current.value = '';
    };

    const handleRemoveOrgLogo = async () => {
      if (!session) return;
      setOrgLogoSaving(true);
      setOrgLogoSaveMsg('');
      try {
        await fetch(`/api/portal/${session.orgId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callerUserId: session.userId, logoUrl: null }),
        });
        setOrgLogoUrl(null);
        setOrgLogoSaveMsg('Organization logo removed.');
      } catch {}
      setOrgLogoSaving(false);
    };

    const ROLE_LABELS: Record<string, string> = {
      ORG_ADMIN: 'Admin', MEMBER: 'Member', BILLING_CONTACT: 'Billing', APPROVER: 'Approver',
    };

    const primaryAdmin = teamMembers.find(m => m.role === 'ORG_ADMIN');
    const hubUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/portal/${session?.orgId}`
      : `/portal/${session?.orgId}`;

    const copyHubUrl = () => {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(hubUrl).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }).catch(() => {});
      }
    };

    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: '#F9FAFB' }}
        contentContainerStyle={{ padding: isMobile ? 16 : 24, paddingBottom: 60, maxWidth: 980, alignSelf: 'center', width: '100%' }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hidden file inputs */}
        {Platform.OS === 'web' && (
          <View style={{ height: 0, overflow: 'hidden' }}>
            <input ref={profilePicInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleProfilePicFile} />
            <input ref={orgLogoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleOrgLogoFile} />
          </View>
        )}

        {/* Page header */}
        <View style={{ marginBottom: 22 }}>
          <Text style={profStyles.pageTitle}>My Profile</Text>
          <Text style={profStyles.pageSubtitle}>
            {isOrgAdmin
              ? 'Manage your account, team and organization settings.'
              : 'Manage your account and organization information.'}
          </Text>
        </View>

        {/* ROW 1: 3 equal cards (accordions on mobile) */}
        <View style={[profStyles.row3, (isMobile || isTablet) && { flexDirection: 'column' }]}>

          {/* Card 1: Organization Branding */}
          <View style={[profStyles.card, { flex: 1 }]}>
            <CardHead title="ORGANIZATION BRANDING" collapsible={isMobile} expanded={openSections.branding} onToggle={() => toggleSection('branding')} />
            {showBranding && (
              <View style={[profStyles.cardBody, isMobile && profStyles.cardBodyMobile]}>
                <View style={[profStyles.logoSquare, isMobile && { alignSelf: 'center' }]}>
                  {orgLogoUrl ? (
                    <Image source={{ uri: orgLogoUrl }} style={{ width: '100%', height: '100%' } as any} resizeMode="contain" />
                  ) : (
                    <View style={profStyles.logoSquareEmpty}>
                      <Text style={profStyles.logoInitials}>{(session?.orgName || '?')[0].toUpperCase()}</Text>
                    </View>
                  )}
                </View>
                <Text style={[profStyles.logoHint, isMobile && { textAlign: 'center' }]}>Recommended: 500 × 500 PNG</Text>
                {isOrgAdmin ? (
                  <View style={{ gap: 8, marginTop: 14 }}>
                    <TouchableOpacity style={[profStyles.outlineBtn, isMobile && profStyles.btnFull]} onPress={() => orgLogoInputRef.current?.click()} disabled={orgLogoSaving} activeOpacity={0.8}>
                      {orgLogoSaving ? <ActivityIndicator size="small" color={BRAND} /> : <Upload size={13} color={BRAND} />}
                      <Text style={profStyles.outlineBtnText}>{orgLogoUrl ? 'Change Logo' : 'Upload Logo'}</Text>
                    </TouchableOpacity>
                    {orgLogoUrl && (
                      <TouchableOpacity style={[profStyles.destructiveBtn, isMobile && profStyles.btnFull]} onPress={handleRemoveOrgLogo} disabled={orgLogoSaving} activeOpacity={0.8}>
                        <X size={13} color="#DC2626" />
                        <Text style={profStyles.destructiveBtnText}>Remove Logo</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ) : (
                  <Text style={profStyles.logoManagedNote}>Organization logo managed by your Org Admin.</Text>
                )}
                {orgLogoSaveMsg ? <Text style={profStyles.successText}>{orgLogoSaveMsg}</Text> : null}
              </View>
            )}
          </View>

          {/* Card 2: Organization Information */}
          <View style={[profStyles.card, { flex: 1 }]}>
            <CardHead title="ORGANIZATION INFORMATION" collapsible={isMobile} expanded={openSections.info} onToggle={() => toggleSection('info')} />
            {showInfo && (
              <View style={[profStyles.cardBody, isMobile && profStyles.cardBodyMobile]}>
                <View style={{ gap: 14 }}>
                  <View style={profStyles.orgInfoRow}>
                    <Building2 size={14} color={TEXT_PLACEHOLDER} />
                    <View style={{ flex: 1 }}>
                      <Text style={profStyles.infoLabel}>Organization Name</Text>
                      <Text style={profStyles.infoValue}>{session?.orgName}</Text>
                    </View>
                  </View>
                  <View style={profStyles.orgInfoRow}>
                    <User size={14} color={TEXT_PLACEHOLDER} />
                    <View style={{ flex: 1 }}>
                      <Text style={profStyles.infoLabel}>Primary Contact</Text>
                      <Text style={profStyles.infoValue}>{primaryAdmin?.name || '—'}</Text>
                      {primaryAdmin?.email ? <Text style={profStyles.infoSub}>{primaryAdmin.email}</Text> : null}
                    </View>
                  </View>
                  <View style={profStyles.orgInfoRow}>
                    <Phone size={14} color={TEXT_PLACEHOLDER} />
                    <View style={{ flex: 1 }}>
                      <Text style={profStyles.infoLabel}>Phone</Text>
                      <Text style={profStyles.infoValue}>{orgPhone || '—'}</Text>
                    </View>
                  </View>
                  <View style={profStyles.orgInfoRow}>
                    <Mail size={14} color={TEXT_PLACEHOLDER} />
                    <View style={{ flex: 1 }}>
                      <Text style={profStyles.infoLabel}>Email</Text>
                      <Text style={profStyles.infoValue}>{orgEmail || '—'}</Text>
                    </View>
                  </View>
                  <View style={profStyles.orgInfoRow}>
                    <Shield size={14} color={TEXT_PLACEHOLDER} />
                    <View style={{ flex: 1 }}>
                      <Text style={profStyles.infoLabel}>Account Representative</Text>
                      <Text style={profStyles.infoValue}>Katalyst Ko Team</Text>
                    </View>
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* Card 3: Client Hub Settings */}
          <View style={[profStyles.card, { flex: 1 }]}>
            <CardHead title="CLIENT HUB SETTINGS" collapsible={isMobile} expanded={openSections.settings} onToggle={() => toggleSection('settings')} />
            {showSettings && (
              <View style={[profStyles.cardBody, isMobile && profStyles.cardBodyMobile]}>
                <View style={{ gap: 14 }}>
                  <View>
                    <Text style={profStyles.infoLabel}>Hub Status</Text>
                    <View style={profStyles.statusLivePill}>
                      <View style={profStyles.statusLiveDot} />
                      <Text style={profStyles.statusLiveText}>Live</Text>
                    </View>
                  </View>
                  <View>
                    <Text style={profStyles.infoLabel}>Hub URL</Text>
                    <View style={profStyles.hubUrlRow}>
                      <Text style={profStyles.hubUrlText} numberOfLines={1}>{hubUrl}</Text>
                      <TouchableOpacity onPress={copyHubUrl} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        {copied ? <CheckCircle size={14} color="#16A34A" /> : <Copy size={14} color={BRAND} />}
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={profStyles.orgInfoRow}>
                    <Shield size={14} color={TEXT_PLACEHOLDER} />
                    <View style={{ flex: 1 }}>
                      <Text style={profStyles.infoLabel}>Organization Admin</Text>
                      <Text style={profStyles.infoValue}>{primaryAdmin?.name || '—'}</Text>
                      {primaryAdmin?.email ? <Text style={profStyles.infoSub}>{primaryAdmin.email}</Text> : null}
                    </View>
                  </View>
                  <View style={profStyles.orgInfoRow}>
                    <Users size={14} color={TEXT_PLACEHOLDER} />
                    <View style={{ flex: 1 }}>
                      <Text style={profStyles.infoLabel}>Total Members</Text>
                      <Text style={profStyles.infoValue}>{teamMembers.length} Active Member{teamMembers.length !== 1 ? 's' : ''}</Text>
                    </View>
                  </View>
                </View>
              </View>
            )}
          </View>

        </View>

        {/* ROW 2: My Profile (75%) + Need Help (25%) */}
        <View style={[profStyles.row2, (isMobile || isTablet) && { flexDirection: 'column' }]}>

          {/* My Profile */}
          <View style={[profStyles.card, !(isMobile || isTablet) && { flex: 3 }]}>
            <CardHead title="MY PROFILE" />
            <View style={[profStyles.cardBody, isMobile && profStyles.cardBodyMobile]}>
              <View style={[profStyles.myProfileRow, isMobile && profStyles.myProfileRowMobile]}>

                {/* LEFT: Square avatar + color picker + upload/remove */}
                <View style={[profStyles.profileLeft, isMobile && profStyles.profileLeftMobile]}>
                  <View style={[profStyles.avatarSquare, { backgroundColor: profileAvatarColor }]}>
                    {profilePicUri ? (
                      <Image source={{ uri: profilePicUri }} style={{ width: 120, height: 120, borderRadius: 12 }} resizeMode="cover" />
                    ) : (
                      <Text style={profStyles.avatarSquareText}>{(session?.userName[0] || '?').toUpperCase()}</Text>
                    )}
                  </View>
                  <Text style={[profStyles.infoLabel, { marginTop: 14 }, isMobile && { textAlign: 'center' }]}>AVATAR COLOR</Text>
                  <View style={[profStyles.colorSwatches, isMobile && { justifyContent: 'center' }]}>
                    {AVATAR_COLORS.map(c => (
                      <TouchableOpacity
                        key={c}
                        onPress={() => handleAvatarColorChange(c)}
                        style={[profStyles.colorSwatch, { backgroundColor: c }, profileAvatarColor === c && profStyles.colorSwatchSelected]}
                      >
                        {profileAvatarColor === c && <Check size={11} color="#fff" strokeWidth={3} />}
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={[{ gap: 8, marginTop: 14 }, isMobile && { width: '100%' }]}>
                    <TouchableOpacity style={[profStyles.outlineBtn, isMobile && profStyles.btnFull]} onPress={() => profilePicInputRef.current?.click()} disabled={profileSaving} activeOpacity={0.8}>
                      {profileSaving ? <ActivityIndicator size="small" color={BRAND} /> : <Upload size={13} color={BRAND} />}
                      <Text style={profStyles.outlineBtnText}>{profilePicUri ? 'Change Photo' : 'Upload Photo'}</Text>
                    </TouchableOpacity>
                    {profilePicUri && (
                      <TouchableOpacity style={[profStyles.destructiveBtn, isMobile && profStyles.btnFull]} onPress={handleRemoveProfilePic} disabled={profileSaving} activeOpacity={0.8}>
                        <X size={13} color="#DC2626" />
                        <Text style={profStyles.destructiveBtnText}>Remove Photo</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {profileSaveMsg ? <Text style={profStyles.successText}>{profileSaveMsg}</Text> : null}
                </View>

                {/* Vertical divider */}
                {!isMobile && <View style={profStyles.profileDivider} />}

                {/* RIGHT: User info */}
                <View style={[profStyles.profileRight, isMobile && { width: '100%' }]}>
                  <View style={profStyles.profileField}>
                    <Text style={profStyles.profileFieldLabel}>Full Name</Text>
                    <Text style={profStyles.profileFieldValue}>{session?.userName}</Text>
                  </View>
                  <View style={profStyles.profileField}>
                    <Text style={profStyles.profileFieldLabel}>Email Address</Text>
                    <Text style={profStyles.profileFieldValue}>{session?.userEmail}</Text>
                  </View>
                  <View style={profStyles.profileField}>
                    <Text style={profStyles.profileFieldLabel}>Organization</Text>
                    <Text style={profStyles.profileFieldValue}>{session?.orgName}</Text>
                  </View>
                  <View style={profStyles.profileField}>
                    <Text style={profStyles.profileFieldLabel}>Role</Text>
                    <View style={[profStyles.rolePill, isOrgAdmin && profStyles.rolePillAdmin]}>
                      <Text style={[profStyles.rolePillText, isOrgAdmin && profStyles.rolePillTextAdmin]}>
                        {isOrgAdmin ? 'Admin' : 'Member'}
                      </Text>
                    </View>
                  </View>
                  <View style={profStyles.profileField}>
                    <Text style={profStyles.profileFieldLabel}>Mobile Number</Text>
                    <Text style={profStyles.profileFieldValue}>—</Text>
                  </View>
                </View>

              </View>
            </View>
          </View>

          {/* Need Help */}
          <View style={[profStyles.card, !(isMobile || isTablet) && { flex: 1 }]}>
            <CardHead title="NEED HELP?" />
            <View style={[profStyles.cardBody, isMobile && profStyles.cardBodyMobile]}>
              <Text style={profStyles.cardSubtitle}>Need assistance with your project, artwork, products, or account?</Text>
              <View style={{ gap: 10, marginTop: 4 }}>
                <TouchableOpacity style={profStyles.helpBtn} onPress={() => Linking.openURL('tel:4805599033')} activeOpacity={0.85}>
                  <Phone size={16} color="#fff" />
                  <View style={{ flex: 1 }}>
                    <Text style={profStyles.helpBtnLabel}>Call Us</Text>
                    <Text style={profStyles.helpBtnValue}>(480) 559-9033</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={profStyles.helpBtn} onPress={() => Linking.openURL('mailto:jobs@katalystko.com')} activeOpacity={0.85}>
                  <Mail size={16} color="#fff" />
                  <View style={{ flex: 1 }}>
                    <Text style={profStyles.helpBtnLabel}>Email Us</Text>
                    <Text style={profStyles.helpBtnValue}>jobs@katalystko.com</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </View>

        </View>

        {/* ROW 3: Team Management (admin only) */}
        {isOrgAdmin && (
          <View style={profStyles.card}>
            <CardHead
              title="TEAM MANAGEMENT"
              right={
                <TouchableOpacity style={profStyles.primaryBtn} onPress={() => setShowInviteInput(v => !v)} activeOpacity={0.85}>
                  <UserPlus size={13} color="#fff" />
                  <Text style={profStyles.primaryBtnText}>Invite User</Text>
                </TouchableOpacity>
              }
            />
            <View style={[profStyles.cardBody, isMobile && profStyles.cardBodyMobile]}>
              <Text style={profStyles.cardSubtitle}>Manage users with access to your Client Hub.</Text>

              {showInviteInput && (
                <View style={[profStyles.inviteRow, isMobile && { flexDirection: 'column' }, { marginBottom: 12 }]}>
                  <View style={profStyles.inviteInputWrap}>
                    <Mail size={14} color={TEXT_PLACEHOLDER} />
                    <TextInput
                      style={profStyles.inviteInput}
                      value={teamInviteEmail}
                      onChangeText={setTeamInviteEmail}
                      placeholder="Enter email to invite…"
                      placeholderTextColor={TEXT_PLACEHOLDER}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>
                  <TouchableOpacity
                    style={[profStyles.primaryBtn, isMobile && profStyles.btnFull, (teamInviting || !teamInviteEmail.trim()) && { opacity: 0.5 }]}
                    onPress={handleInvite}
                    disabled={teamInviting || !teamInviteEmail.trim()}
                    activeOpacity={0.85}
                  >
                    {teamInviting
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={profStyles.primaryBtnText}>Send Invite</Text>
                    }
                  </TouchableOpacity>
                </View>
              )}
              {teamInviteError ? <Text style={profStyles.errorText}>{teamInviteError}</Text> : null}
              {teamInviteSuccess ? <Text style={profStyles.successText}>{teamInviteSuccess}</Text> : null}

              {teamLoading ? (
                <ActivityIndicator color={BRAND} style={{ marginTop: 20 }} />
              ) : teamMembers.length === 0 ? (
                <View style={profStyles.emptyTeam}>
                  <Text style={profStyles.emptyTeamText}>No team members yet. Invite someone to get started.</Text>
                </View>
              ) : isMobile ? (
                <View style={{ gap: 10, marginTop: 4 }}>
                  {teamMembers.map((m) => (
                    <View key={m.id} style={profStyles.memberCard}>
                      <View style={profStyles.memberCardTop}>
                        <View style={profStyles.memberAvatar}>
                          <Text style={profStyles.memberAvatarText}>{(m.name || m.email)[0]?.toUpperCase() || '?'}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                            <Text style={profStyles.memberName} numberOfLines={1}>{m.name || m.email}</Text>
                            {m.id === session?.userId && (
                              <View style={profStyles.youBadge}><Text style={profStyles.youBadgeText}>You</Text></View>
                            )}
                          </View>
                          <Text style={profStyles.memberEmail} numberOfLines={1}>{m.email}</Text>
                        </View>
                      </View>
                      <View style={profStyles.memberCardBadges}>
                        <View style={[profStyles.rolePill, m.role === 'ORG_ADMIN' && profStyles.rolePillAdmin]}>
                          <Text style={[profStyles.rolePillText, m.role === 'ORG_ADMIN' && profStyles.rolePillTextAdmin]}>
                            {ROLE_LABELS[m.role] || m.role}
                          </Text>
                        </View>
                        {m.status === 'INVITED'
                          ? <View style={profStyles.invitedBadge}><Text style={profStyles.invitedBadgeText}>Invited</Text></View>
                          : <View style={profStyles.activeBadge}><Text style={profStyles.activeBadgeText}>Active</Text></View>
                        }
                      </View>
                      {(m.status === 'INVITED' || m.id !== session?.userId) && (
                        <View style={profStyles.memberCardActions}>
                          {m.status === 'INVITED' && (
                            <TouchableOpacity style={profStyles.resendBtn} onPress={() => handleResendInvite(m.email)} activeOpacity={0.85}>
                              <Text style={profStyles.resendBtnText}>Resend Invite</Text>
                            </TouchableOpacity>
                          )}
                          {m.id !== session?.userId && (
                            <TouchableOpacity style={[profStyles.removeBtnLg, m.status !== 'INVITED' && { flex: 1 }]} onPress={() => handleRemove(m.id)} activeOpacity={0.85}>
                              <UserMinus size={13} color="#DC2626" />
                              <Text style={profStyles.removeBtnLgText}>Remove</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              ) : (
                <View style={profStyles.teamTable}>
                  <View style={[profStyles.teamRow, profStyles.teamHeaderRow]}>
                    <Text style={[profStyles.teamCell, profStyles.teamHeaderCell, { flex: 2 }]}>USER</Text>
                    <Text style={[profStyles.teamCell, profStyles.teamHeaderCell, { flex: 2 }]}>EMAIL</Text>
                    <Text style={[profStyles.teamCell, profStyles.teamHeaderCell, { flex: 1 }]}>ROLE</Text>
                    <Text style={[profStyles.teamCell, profStyles.teamHeaderCell, { flex: 1 }]}>STATUS</Text>
                    <Text style={[profStyles.teamCell, profStyles.teamHeaderCell, { flex: 1 }]}>ACTIONS</Text>
                  </View>
                  {teamMembers.map((m, idx) => (
                    <View key={m.id} style={[profStyles.teamRow, idx % 2 === 1 && profStyles.teamRowAlt]}>
                      <View style={[profStyles.teamCell, { flex: 2, flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                        <View style={profStyles.memberAvatar}>
                          <Text style={profStyles.memberAvatarText}>{(m.name || m.email)[0]?.toUpperCase() || '?'}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                            <Text style={profStyles.memberName} numberOfLines={1}>{m.name || m.email}</Text>
                            {m.id === session?.userId && (
                              <View style={profStyles.youBadge}><Text style={profStyles.youBadgeText}>You</Text></View>
                            )}
                          </View>
                        </View>
                      </View>
                      <Text style={[profStyles.teamCell, profStyles.memberEmail, { flex: 2 }]} numberOfLines={1}>{m.email}</Text>
                      <View style={[profStyles.teamCell, { flex: 1 }]}>
                        <View style={[profStyles.rolePill, m.role === 'ORG_ADMIN' && profStyles.rolePillAdmin]}>
                          <Text style={[profStyles.rolePillText, m.role === 'ORG_ADMIN' && profStyles.rolePillTextAdmin]}>
                            {ROLE_LABELS[m.role] || m.role}
                          </Text>
                        </View>
                      </View>
                      <View style={[profStyles.teamCell, { flex: 1 }]}>
                        {m.status === 'INVITED'
                          ? <View style={profStyles.invitedBadge}><Text style={profStyles.invitedBadgeText}>Invited</Text></View>
                          : <View style={profStyles.activeBadge}><Text style={profStyles.activeBadgeText}>Active</Text></View>
                        }
                      </View>
                      <View style={[profStyles.teamCell, { flex: 1, flexDirection: 'row', gap: 4, alignItems: 'center' }]}>
                        {m.status === 'INVITED' && (
                          <TouchableOpacity style={profStyles.actionBtn} onPress={() => handleResendInvite(m.email)} activeOpacity={0.8}>
                            <Text style={profStyles.actionBtnText}>Resend</Text>
                          </TouchableOpacity>
                        )}
                        {m.id !== session?.userId && (
                          <TouchableOpacity style={profStyles.removeBtn} onPress={() => handleRemove(m.id)} activeOpacity={0.8}>
                            <UserMinus size={13} color="#DC2626" />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        )}

      </ScrollView>
    );
  };

  const BinPickerModal = () => (
    <MediaPickerModal
      visible={binPickerVisible}
      onClose={() => setBinPickerVisible(false)}
      onSelect={handleBinPickerSelect}
      files={mediaBinFiles}
      loading={mediaBinLoading}
      orgId={session?.orgId || ''}
      isMobile={isMobile}
      isTablet={isTablet}
      title={binPickerTarget === 'mockup' ? 'Choose Mockup from Media Bin' : 'Choose from Media Bin'}
    />
  );

  if (hubDisabled) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB' }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={{ alignItems: 'center', gap: 14, maxWidth: 320, padding: 32 }}>
          <View style={{
            width: 64, height: 64, borderRadius: 32,
            backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ fontSize: 28 }}>🔒</Text>
          </View>
          <Text style={{ fontSize: 20, fontWeight: '700', color: '#111827', textAlign: 'center' }}>
            Hub Unavailable
          </Text>
          <Text style={{ fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 }}>
            This client portal is currently not available. Please contact your account manager for access.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── EMAIL STEP ── */}
      {step === 'email' && (
        <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
          <View style={styles.topBar}>
            {logoSrc ? (
              <View style={styles.topBarBrandRow}>
                <Image source={{ uri: logoSrc }} style={styles.topBarLogo} resizeMode="contain" />
                {orgDisplayName ? (
                  <View style={{ marginLeft: 10 }}>
                    <Text style={styles.logoText}>{orgDisplayName.toUpperCase()}</Text>
                    <Text style={styles.logoSub}>Client Hub by Katalyst Ko Printshop</Text>
                  </View>
                ) : null}
              </View>
            ) : (
              <View>
                <Text style={styles.logoText}>KATALYST KO</Text>
                <Text style={styles.logoSub}>Client Hub by Katalyst Ko Printshop</Text>
              </View>
            )}
          </View>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
              <View style={styles.card}>
                <View style={styles.cardIcon}><FileText size={28} color={BRAND} /></View>
                <Text style={styles.cardTitle}>Client Hub Access</Text>
                <Text style={styles.cardSub}>
                  Enter the email address associated with your account to access your organization's portal.
                </Text>
                <View style={pFields.container}>
                  <Text style={pFields.label}>Email Address <Text style={{ color: BRAND }}>*</Text></Text>
                  <TextInput
                    style={pFields.input}
                    value={email}
                    onChangeText={v => { setEmail(v); setEmailError(''); }}
                    placeholder="your@email.com"
                    placeholderTextColor={TEXT_PLACEHOLDER}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    onSubmitEditing={handleEmailSubmit}
                    returnKeyType="done"
                  />
                </View>
                {emailError ? <View style={styles.errorBox}><Text style={styles.errorText}>{emailError}</Text></View> : null}
                {forgotSent ? (
                  <View style={[styles.errorBox, { backgroundColor: '#DCFCE7', borderColor: '#86EFAC' }]}>
                    <Text style={[styles.errorText, { color: '#065F46' }]}>Check your email — a password reset link has been sent.</Text>
                  </View>
                ) : null}
                <TouchableOpacity style={[styles.btn, emailLoading && styles.btnDisabled]} onPress={handleEmailSubmit} disabled={emailLoading}>
                  {emailLoading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.btnText}>Access Portal</Text>}
                </TouchableOpacity>
                <TouchableOpacity onPress={handleForgotPassword} disabled={forgotSending} style={{ marginTop: 10, alignSelf: 'center' as const }}>
                  <Text style={[styles.helpText, { color: BRAND, textDecorationLine: 'underline' as const }]}>
                    {forgotSending ? 'Sending reset link…' : 'Forgot your password?'}
                  </Text>
                </TouchableOpacity>
                <Text style={styles.helpText}>Don't have an account? Contact Katalyst Ko to get set up.</Text>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
          <View style={styles.footer}>
            <Text style={styles.footerText}>Powered by Katalyst Ko · Client Hub</Text>
          </View>
        </View>
      )}

      {/* ── DASHBOARD STEP ── */}
      {step === 'dashboard' && session && (
        <View style={[dash.layout, isMobile && dash.layoutMobile]}>
          {/* Desktop/tablet: Sidebar */}
          {!isMobile && (
            <Animated.View style={[dash.sidebar, { width: sidebarWidthAnim }]}>
              {/* Hamburger + "Client Hub" title row */}
              <View style={dash.sidebarHamburgerRow}>
                <TouchableOpacity onPress={toggleSidebar} style={dash.hamburgerBtn} activeOpacity={0.7}>
                  <Menu size={20} color="#fff" />
                </TouchableOpacity>
                {!sidebarCollapsed && (
                  <Text style={dash.sidebarClientHubTitle} numberOfLines={1}>Client Hub</Text>
                )}
              </View>

              {/* Logo / org name — only when expanded */}
              {!sidebarCollapsed && (
                <View style={dash.sidebarHeader}>
                  {logoSrc ? (
                    <Image source={{ uri: logoSrc }} style={sidebarLogoStyle} resizeMode="contain" />
                  ) : (
                    <View>
                      <Text style={dash.sidebarLogoText}>{displayName.toUpperCase()}</Text>
                      <Text style={dash.sidebarLogoBrand}>Client Hub by Katalyst Ko Printshop</Text>
                    </View>
                  )}
                </View>
              )}

              <View style={[dash.sidebarNav, sidebarCollapsed && { alignItems: 'center', paddingHorizontal: 0 }]}>
                {NAV_ITEMS.map(({ id, label, Icon }, idx) => {
                  const isActive = activeView === id;
                  const showDivider = idx === 1 || idx === 3 || idx === 5;
                  return (
                    <React.Fragment key={id}>
                      {showDivider && <View style={dash.navDivider} />}
                      <TouchableOpacity
                        style={[dash.navItem, isActive && dash.navItemActive, sidebarCollapsed && dash.navItemCollapsed]}
                        onPress={() => {
                          setActiveView(id);
                          if (id === 'artwork' && session) fetchMediaBin(session.orgId);
                        }}
                      >
                        <Icon size={16} color={isActive ? '#fff' : '#9CA3AF'} />
                        {!sidebarCollapsed && (
                          <Text style={[dash.navLabel, isActive && dash.navLabelActive]}>{label}</Text>
                        )}
                      </TouchableOpacity>
                    </React.Fragment>
                  );
                })}
              </View>

              <View style={[dash.sidebarFooter, sidebarCollapsed && { alignItems: 'center', paddingHorizontal: 0 }]}>
                <OverlayMenu
                  align="left"
                  menuWidth={210}
                  menuStyle={{ backgroundColor: '#1C1C1E', borderColor: '#2A2A2A' }}
                  trigger={({ open, isOpen }) => (
                    <TouchableOpacity
                      style={[dash.userRow, sidebarCollapsed && { justifyContent: 'center' }]}
                      onPress={() => {
                        if (sidebarCollapsed) { setActiveView('profile'); fetchTeam(session.orgId); }
                        else { open(); }
                      }}
                      activeOpacity={0.8}
                    >
                      <View style={[dash.userAvatar, { backgroundColor: profileAvatarColor }, activeView === 'profile' && { borderWidth: 2, borderColor: BRAND }]}>
                        {profilePicUri ? (
                          <Image source={{ uri: profilePicUri }} style={{ width: 32, height: 32, borderRadius: 16 }} />
                        ) : (
                          <Text style={dash.userAvatarText}>{session.userName[0]?.toUpperCase() || '?'}</Text>
                        )}
                      </View>
                      {!sidebarCollapsed && (
                        <>
                          <View style={{ flex: 1 }}>
                            <Text style={dash.userName} numberOfLines={1}>{session.userName}</Text>
                            <Text style={dash.userOrg} numberOfLines={1}>{session.orgName}</Text>
                          </View>
                          {isOpen ? <ChevronDown size={12} color="#6B7280" /> : <ChevronUp size={12} color="#6B7280" />}
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                >
                  {({ close }) => (
                    <>
                      <TouchableOpacity style={profStyles.sidebarDropdownItem} onPress={() => { close(); setActiveView('profile'); fetchTeam(session.orgId); }} activeOpacity={0.75}>
                        <User size={14} color="#D1D5DB" />
                        <Text style={profStyles.sidebarDropdownText}>My Profile</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={profStyles.sidebarDropdownItem} onPress={() => { close(); handleSignOut(); }} activeOpacity={0.75}>
                        <LogOut size={14} color="#D1D5DB" />
                        <Text style={profStyles.sidebarDropdownText}>Switch Organization</Text>
                      </TouchableOpacity>
                      <View style={profStyles.sidebarDropdownSep} />
                      <TouchableOpacity style={profStyles.sidebarDropdownItem} onPress={() => { close(); handleSignOut(); }} activeOpacity={0.75}>
                        <LogOut size={14} color="#EF4444" />
                        <Text style={[profStyles.sidebarDropdownText, { color: '#EF4444' }]}>Sign Out</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </OverlayMenu>
              </View>
            </Animated.View>
          )}

          {/* Mobile: Top bar — hamburger + "Client Hub" */}
          {isMobile && (
            <View style={dash.mobileTopBar}>
              <View style={dash.mobileTopBarLeft}>
                <TouchableOpacity
                  onPress={openMobileNav}
                  style={dash.mobileMenuBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  activeOpacity={0.7}
                >
                  <Menu size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={dash.mobileTopTitle} numberOfLines={1}>Client Hub</Text>
              </View>
            </View>
          )}

          {/* Main content */}
          <View style={[dash.main, isMobile && dash.mainMobile]}>
            {activeView === 'home'         && HomeView()}
            {activeView === 'projects'     && <MyProjectsView />}
            {activeView === 'project-view' && <ProjectDetailView />}
            {activeView === 'artwork'      && <ArtworkView />}
            {activeView === 'catalogs'     && <CatalogsView />}
            {activeView === 'submit'       && SubmitView()}
            {activeView === 'profile'      && <ProfileView />}
          </View>

          {/* Mobile: Slide-in nav drawer (logo lives here) */}
          {isMobile && mobileNavOpen && (
            <View style={StyleSheet.absoluteFill as any} pointerEvents="box-none">
              <Animated.View style={[dash.mobileScrim, { opacity: mobileScrimOpacity }]}>
                <View
                  style={StyleSheet.absoluteFill as any}
                  onStartShouldSetResponder={() => true}
                  onResponderRelease={closeMobileNav}
                />
              </Animated.View>
              <Animated.View style={[dash.mobileDrawer, { transform: [{ translateX: mobileDrawerTx }] }]}>
                {/* Logo header + close */}
                <View style={dash.mobileDrawerHeader}>
                  {logoSrc ? (
                    <Image source={{ uri: logoSrc }} style={dash.mobileDrawerLogo} resizeMode="contain" />
                  ) : (
                    <View style={{ flex: 1 }}>
                      <Text style={dash.sidebarLogoText}>{displayName.toUpperCase()}</Text>
                      <Text style={dash.sidebarLogoBrand}>Client Hub by Katalyst Ko Printshop</Text>
                    </View>
                  )}
                  <TouchableOpacity onPress={closeMobileNav} style={dash.mobileDrawerClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <X size={22} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>

                {/* Nav */}
                <ScrollView style={dash.mobileDrawerNav} contentContainerStyle={{ paddingVertical: 8 }} showsVerticalScrollIndicator={false}>
                  {NAV_ITEMS.map(({ id, label, Icon }, idx) => {
                    const isActive = activeView === id;
                    const showDivider = idx === 1 || idx === 3 || idx === 5;
                    return (
                      <React.Fragment key={id}>
                        {showDivider && <View style={dash.navDivider} />}
                        <TouchableOpacity
                          style={[dash.navItem, isActive && dash.navItemActive]}
                          onPress={() => {
                            setActiveView(id);
                            if (id === 'artwork' && session) fetchMediaBin(session.orgId);
                            closeMobileNav();
                          }}
                        >
                          <Icon size={16} color={isActive ? '#fff' : '#9CA3AF'} />
                          <Text style={[dash.navLabel, isActive && dash.navLabelActive]}>{label}</Text>
                        </TouchableOpacity>
                      </React.Fragment>
                    );
                  })}
                </ScrollView>

                {/* Footer: profile + sign out */}
                <View style={dash.mobileDrawerFooter}>
                  <TouchableOpacity
                    style={dash.userRow}
                    onPress={() => { setActiveView('profile'); fetchTeam(session.orgId); closeMobileNav(); }}
                    activeOpacity={0.8}
                  >
                    <View style={[dash.userAvatar, { backgroundColor: profileAvatarColor }, activeView === 'profile' && { borderWidth: 2, borderColor: BRAND }]}>
                      {profilePicUri ? (
                        <Image source={{ uri: profilePicUri }} style={{ width: 32, height: 32, borderRadius: 16 }} />
                      ) : (
                        <Text style={dash.userAvatarText}>{session.userName[0]?.toUpperCase() || '?'}</Text>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={dash.userName} numberOfLines={1}>{session.userName}</Text>
                      <Text style={dash.userOrg} numberOfLines={1}>{session.orgName}</Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity style={dash.mobileDrawerSignOut} onPress={() => { closeMobileNav(); handleSignOut(); }} activeOpacity={0.8}>
                    <LogOut size={16} color="#EF4444" />
                    <Text style={dash.mobileDrawerSignOutText}>Sign Out</Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            </View>
          )}
        </View>
      )}

      {/* ── BIN PICKER MODAL ── */}
      <BinPickerModal />

      {/* ── SHARED DROPDOWN MODAL ── */}
      <Modal visible={dropdown.visible} transparent animationType="fade" onRequestClose={() => setDropdown(d => ({ ...d, visible: false }))}>
        <Pressable style={ddStyles.overlay} onPress={() => setDropdown(d => ({ ...d, visible: false }))}>
          <Pressable style={ddStyles.sheet} onPress={() => {}}>
            <View style={ddStyles.handle} />
            <Text style={ddStyles.title}>{dropdown.title}</Text>
            <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
              {dropdown.options.map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={[ddStyles.option, dropdown.selected === opt && ddStyles.optionSelected]}
                  onPress={() => {
                    dropdown.onSelect(opt);
                    setDropdown(d => ({ ...d, visible: false }));
                  }}
                >
                  <Text style={[ddStyles.optionText, dropdown.selected === opt && ddStyles.optionTextSelected]}>{opt}</Text>
                  {dropdown.selected === opt && <View style={ddStyles.dot} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── QUOTE RESPONSE MODAL ── */}
      <Modal
        visible={!!quoteActionModal}
        transparent
        animationType="fade"
        onRequestClose={() => { if (!quoteActionSubmitting) setQuoteActionModal(null); }}
      >
        <Pressable style={qmStyles.overlay} onPress={() => { if (!quoteActionSubmitting) setQuoteActionModal(null); }}>
          <Pressable style={qmStyles.sheet} onPress={() => {}}>
            {(() => {
              const action = quoteActionModal?.action;
              const cfg = action === 'approve'
                ? { title: 'Approve Quote', body: 'Approving lets Katalyst Ko know you’re ready to move forward with this quote. Add an optional note below.', confirm: 'Approve Quote', confirmStyle: qmStyles.confirmApprove, placeholder: 'Optional note (e.g. delivery preferences)…', required: false }
                : action === 'request_changes'
                ? { title: 'Request Changes', body: 'Tell us what you’d like changed and our team will revise your quote.', confirm: 'Send Request', confirmStyle: qmStyles.confirmPrimary, placeholder: 'Describe the changes you’d like…', required: true }
                : { title: 'Decline Quote', body: 'Let us know this quote isn’t the right fit. A reason is optional but helps us improve.', confirm: 'Decline Quote', confirmStyle: qmStyles.confirmDecline, placeholder: 'Optional reason…', required: false };
              const noteEmpty = quoteActionNote.trim().length === 0;
              const disableConfirm = quoteActionSubmitting || (cfg.required && noteEmpty);
              return (
                <>
                  <Text style={qmStyles.title}>{cfg.title}</Text>
                  <Text style={qmStyles.body}>{cfg.body}</Text>
                  <TextInput
                    style={qmStyles.input}
                    placeholder={cfg.placeholder}
                    placeholderTextColor={TEXT_PLACEHOLDER}
                    value={quoteActionNote}
                    onChangeText={setQuoteActionNote}
                    multiline
                    editable={!quoteActionSubmitting}
                  />
                  {quoteActionError ? <Text style={qmStyles.err}>{quoteActionError}</Text> : null}
                  <View style={qmStyles.actions}>
                    <TouchableOpacity style={qmStyles.cancel} activeOpacity={0.85} disabled={quoteActionSubmitting} onPress={() => setQuoteActionModal(null)}>
                      <Text style={qmStyles.cancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[qmStyles.confirm, cfg.confirmStyle, disableConfirm && { opacity: 0.5 }]}
                      activeOpacity={0.85}
                      disabled={disableConfirm}
                      onPress={() => action && submitQuoteResponse(action, quoteActionNote.trim())}
                    >
                      {quoteActionSubmitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={qmStyles.confirmText}>{cfg.confirm}</Text>}
                    </TouchableOpacity>
                  </View>
                </>
              );
            })()}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ────────────────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────────────────

const pFields = StyleSheet.create({
  container: { marginBottom: 10 },
  label: { fontSize: 13, fontWeight: '600', color: TEXT_MED, marginBottom: 5 },
  hint: { fontSize: 11, color: TEXT_PLACEHOLDER, marginBottom: 5, lineHeight: 16 },
  input: {
    borderWidth: 1, borderColor: BORDER, borderRadius: 9, paddingHorizontal: 13,
    paddingVertical: 10, fontSize: 14, color: TEXT, backgroundColor: BG,
  },
  inputError: { borderColor: '#EF4444' },
  textarea: {
    borderWidth: 1, borderColor: BORDER, borderRadius: 9, paddingHorizontal: 13,
    paddingTop: 10, paddingBottom: 10, fontSize: 13, color: TEXT, backgroundColor: BG, height: 90,
  },
  selectRow: {
    borderWidth: 1, borderColor: BORDER, borderRadius: 9, paddingHorizontal: 13,
    paddingVertical: 10, backgroundColor: BG, flexDirection: 'row', alignItems: 'center',
  },
  selectText: { flex: 1, fontSize: 14, color: TEXT },
  selectPlaceholder: { color: TEXT_PLACEHOLDER },
  readOnly: {
    borderWidth: 1, borderColor: BORDER, borderRadius: 9, paddingHorizontal: 13,
    paddingVertical: 10, backgroundColor: '#F3F4F6',
  },
  readOnlyText: { fontSize: 14, color: TEXT_LIGHT },
  dateRow: {
    borderWidth: 1, borderColor: BORDER, borderRadius: 9, backgroundColor: BG,
    flexDirection: 'row', alignItems: 'center', overflow: 'hidden',
  },
  dateRowError: { borderColor: '#EF4444' },
  dateText: { flex: 1, fontSize: 14, color: TEXT, paddingHorizontal: 13, paddingVertical: 10 },
  calIcon: { paddingHorizontal: 10, paddingVertical: 10 },
});

const liStyles = StyleSheet.create({
  card: {
    borderWidth: 1, borderColor: BORDER, borderRadius: 12, marginBottom: 16,
    backgroundColor: '#fff', overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 14,
    backgroundColor: '#000000',
  },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  indexBadge: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: BRAND,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  indexText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#fff' },
  deleteBtn: { padding: 4 },
  cardBody: { padding: 12 },
  twoCol: { flexDirection: 'row', gap: 10 },
  addLocRow: { flexDirection: 'row', gap: 10, marginBottom: 14, marginTop: -4 },
  addLocBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  addLocText: { fontSize: 12, color: BRAND, fontWeight: '600' },
  sizeSection: {
    borderWidth: 1, borderColor: BORDER, borderRadius: 10,
    backgroundColor: '#FAFAFA', overflow: 'hidden', marginBottom: 14,
  },
  sizeSectionTitle: {
    fontSize: 11, fontWeight: '700', color: TEXT_LIGHT, textTransform: 'uppercase',
    letterSpacing: 0.5, paddingHorizontal: 12, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  sizeVariantRow: {
    flexDirection: 'column',
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
    backgroundColor: '#fff',
  },
  sizeVariantRowAlt: { backgroundColor: '#FAFAFA' },
  sizePickerRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingTop: 8, paddingBottom: 4, gap: 6,
  },
  sizeCellsRow: {
    flexDirection: 'row', paddingHorizontal: 8, paddingBottom: 8, gap: 4,
  },
  sizeCellCol: { flex: 1, alignItems: 'center' },
  sizeTotalCol: { flex: 1, alignItems: 'center' },
  sizeColLabel: {
    fontSize: 9, fontWeight: '700', color: TEXT_LIGHT,
    textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 3,
  },
  sizeColInput: {
    borderWidth: 1, borderColor: '#E9EAEB', borderRadius: 4,
    width: '100%', height: 32, textAlign: 'center', fontSize: 12, color: TEXT,
    backgroundColor: '#fff',
  },
  sizeTotalValue: {
    fontSize: 13, fontWeight: '700', color: BRAND,
    textAlign: 'center', paddingTop: 6,
  },
  sizeSumRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 6,
    borderTopWidth: 1, borderTopColor: BORDER, backgroundColor: '#F9FAFB',
  },
  sizeSumLabel: { fontSize: 10, fontWeight: '600', color: TEXT_LIGHT, width: 44 },
  sizeSumValue: { fontSize: 11, fontWeight: '600', color: TEXT_MED, textAlign: 'center' },
  sizeInput: {
    borderWidth: 1, borderColor: '#E9EAEB', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 5, fontSize: 12, color: TEXT,
    backgroundColor: '#fff', marginHorizontal: 2, textAlign: 'center',
  },
  delRowBtn: { width: 28, alignItems: 'center', justifyContent: 'center', paddingVertical: 6 },
  addRowBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 9,
    borderTopWidth: 1, borderTopColor: BORDER,
  },
  addRowText: { fontSize: 12, color: BRAND, fontWeight: '600' },
  grandTotalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: BORDER, backgroundColor: '#F0FDF4',
  },
  grandTotalLabel: { fontSize: 12, fontWeight: '600', color: '#15803D' },
  grandTotalValue: { fontSize: 14, fontWeight: '700', color: '#15803D' },
  cardSubtitle: { fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 1 },
  mockupBlurb: {
    fontSize: 11,
    color: TEXT_LIGHT,
    lineHeight: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingTop: 2,
  },
  artworkSection: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 9,
    overflow: 'hidden',
    marginBottom: 4,
  },
  artworkDropZone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FAFAFA',
  },
  artworkDropText: { fontSize: 13, color: TEXT_LIGHT, flex: 1 },
  artworkDropSub: { fontSize: 11, color: TEXT_PLACEHOLDER },
  artworkFileList: {
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  artworkFileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  artworkFileName: { flex: 1, fontSize: 12, color: TEXT_MED },
  artworkFileSize: { fontSize: 11, color: TEXT_PLACEHOLDER },
  binPickLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  binPickLinkText: {
    fontSize: 12,
    fontWeight: '600',
    color: BRAND,
    textDecorationLine: 'underline',
  },
});

const comboCellStyles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 2,
  },
  chevron: {
    paddingHorizontal: 2,
    paddingVertical: 6,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '100%',
    maxWidth: 340,
    overflow: 'hidden',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  searchRow: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: TEXT,
    backgroundColor: BG,
  },
  customOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    backgroundColor: '#FFF7F0',
  },
  customOptionText: {
    fontSize: 13,
    color: BRAND,
    fontWeight: '600',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  optionSel: { backgroundColor: '#FFF7ED' },
  optionText: { fontSize: 13, color: TEXT_MED, flex: 1 },
  optionTextSel: { color: BRAND, fontWeight: '600' },
});

const pCal = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { backgroundColor: '#fff', borderRadius: 16, width: '100%', maxWidth: 320, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderBottomWidth: 1, borderBottomColor: BORDER },
  navBtn: { padding: 4 },
  monthLabel: { fontSize: 15, fontWeight: '700', color: TEXT },
  dayHeaders: { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: BORDER },
  dayHeader: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '600', color: TEXT_LIGHT },
  week: { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 2 },
  day: { flex: 1, aspectRatio: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 6, margin: 1 },
  daySelected: { backgroundColor: BRAND },
  dayToday: { borderWidth: 2, borderColor: BRAND },
  dayText: { fontSize: 13, fontWeight: '500', color: TEXT },
  dayTextSelected: { color: '#fff', fontWeight: '700' },
  dayTextToday: { color: BRAND, fontWeight: '700' },
  footer: { flexDirection: 'row', gap: 10, padding: 12, borderTopWidth: 1, borderTopColor: BORDER },
  todayBtn: { flex: 1, backgroundColor: BRAND, paddingVertical: 9, borderRadius: 8, alignItems: 'center' },
  todayBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  clearBtn: { flex: 1, backgroundColor: '#F3F4F6', paddingVertical: 9, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: BORDER },
  clearBtnText: { fontSize: 13, fontWeight: '600', color: TEXT_LIGHT },
});

const ddStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    ...Platform.select({
      web: { justifyContent: 'center', alignItems: 'center', padding: 24 },
      default: { justifyContent: 'flex-end' },
    }),
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    ...Platform.select({
      web: { borderRadius: 12, width: '100%', maxWidth: 320, paddingBottom: 12 } as any,
      default: {},
    }),
  },
  handle: { width: 40, height: 4, backgroundColor: '#D1D5DB', borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 6 },
  title: { fontSize: 15, fontWeight: '700', color: TEXT, paddingHorizontal: 20, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: BORDER },
  option: { paddingHorizontal: 20, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', flexDirection: 'row', alignItems: 'center' },
  optionSelected: { backgroundColor: '#FFF7ED' },
  optionText: { flex: 1, fontSize: 14, color: TEXT_MED },
  optionTextSelected: { color: BRAND, fontWeight: '600' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: BRAND },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F9FAFB' },
  topBar: { backgroundColor: '#000', paddingHorizontal: 24, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' },
  topBarBrandRow: { flexDirection: 'row', alignItems: 'center' },
  topBarLogo: { width: 100, height: 40 },
  logoText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 2 },
  logoSub: { color: BRAND, fontSize: 9, fontWeight: '600', letterSpacing: 0, marginTop: 2 },
  scrollContent: { flexGrow: 1, alignItems: 'center', padding: 20, paddingVertical: 36 },
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '100%', maxWidth: 520,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3,
  },
  cardIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFF7ED', alignItems: 'center', justifyContent: 'center', marginBottom: 16, alignSelf: 'center' },
  cardTitle: { fontSize: 22, fontWeight: '700', color: TEXT, textAlign: 'center', marginBottom: 8 },
  cardSub: { fontSize: 14, color: TEXT_LIGHT, textAlign: 'center', lineHeight: 21, marginBottom: 24 },
  welcomeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  welcomeAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#6366F1', alignItems: 'center', justifyContent: 'center' },
  welcomeAvatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  welcomeName: { fontSize: 16, fontWeight: '700', color: TEXT },
  welcomeOrg: { fontSize: 13, color: TEXT_LIGHT, marginTop: 1 },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginBottom: 20 },
  formTitle: { fontSize: 24, fontWeight: '800', color: TEXT, marginBottom: 3 },
  formSub: { fontSize: 13, color: TEXT_LIGHT, marginBottom: 14, lineHeight: 19 },
  sectionCard: { backgroundColor: '#FAFAFA', borderWidth: 1, borderColor: BORDER, borderRadius: 12, padding: 12, marginBottom: 14 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: TEXT_LIGHT, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: TEXT, marginBottom: 3 },
  sectionSub: { fontSize: 13, color: TEXT_LIGHT, marginBottom: 10, lineHeight: 18 },
  addLineItemBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1.5, borderColor: BRAND, borderRadius: 10, paddingVertical: 9,
    marginBottom: 14, backgroundColor: '#FFF7F0',
  },
  addLineItemText: { fontSize: 13, fontWeight: '700', color: BRAND },
  btn: { backgroundColor: BRAND, borderRadius: 10, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', marginTop: 4 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  errorBox: { backgroundColor: '#FEF2F2', borderRadius: 8, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#FECACA' },
  errorText: { color: '#B91C1C', fontSize: 13, lineHeight: 18 },
  helpText: { fontSize: 12, color: TEXT_PLACEHOLDER, textAlign: 'center', marginTop: 14, lineHeight: 17 },
  backBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, padding: 8 },
  backBtnText: { fontSize: 13, color: TEXT_LIGHT },
  successIcon: { alignSelf: 'center', marginBottom: 16 },
  successRef: { backgroundColor: '#F9FAFB', borderRadius: 8, padding: 12, marginBottom: 20, borderWidth: 1, borderColor: BORDER, width: '100%' },
  successRefLabel: { fontSize: 11, fontWeight: '600', color: TEXT_PLACEHOLDER, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  successRefValue: { fontSize: 13, color: TEXT_MED, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  editWindowBox: {
    width: '100%', borderWidth: 1, borderColor: '#FED7AA', borderRadius: 10,
    backgroundColor: '#FFF7ED', padding: 14, marginBottom: 16,
  },
  editWindowTitle: { fontSize: 13, fontWeight: '700', color: '#92400E', marginBottom: 3 },
  editWindowSub: { fontSize: 12, color: '#78350F', marginBottom: 10 },
  editWindowBtns: { flexDirection: 'row', gap: 8 },
  editBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1, borderColor: BORDER, borderRadius: 8, paddingVertical: 9,
    backgroundColor: '#fff',
  },
  editBtnText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  cancelBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    borderWidth: 1, borderColor: '#FCA5A5', borderRadius: 8, paddingVertical: 9, paddingHorizontal: 14,
    backgroundColor: '#FEF2F2',
  },
  cancelBtnText: { fontSize: 13, fontWeight: '600', color: '#DC2626' },
  footer: { backgroundColor: '#F3F4F6', borderTopWidth: 1, borderTopColor: BORDER, paddingVertical: 12, alignItems: 'center' },
  footerText: { fontSize: 12, color: TEXT_PLACEHOLDER },
});

const SIDEBAR_BG = '#000000';
const SIDEBAR_ACTIVE = '#FF5A00';
const MOBILE_DRAWER_W = 280;

const dash = StyleSheet.create({
  layout: { flex: 1, flexDirection: 'row', backgroundColor: '#F3F4F6' },
  layoutMobile: { flexDirection: 'column' },

  // Mobile top bar — hamburger + title
  mobileTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SIDEBAR_BG,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    ...Platform.select({ web: { position: 'sticky' as any, top: 0, zIndex: 10 } as any, default: {} }),
  },
  mobileTopBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  mobileMenuBtn: { padding: 2, outlineStyle: 'none' as any },
  mobileTopTitle: { fontSize: 15, fontWeight: '700', color: '#fff', letterSpacing: 0.3, flex: 1 },

  // Mobile nav drawer
  mobileScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    ...Platform.select({ web: { zIndex: 50 } as any, default: {} }),
  },
  mobileDrawer: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    width: MOBILE_DRAWER_W,
    backgroundColor: SIDEBAR_BG,
    flexDirection: 'column',
    borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.06)',
    ...Platform.select({ web: { zIndex: 51 } as any, default: {} }),
  },
  mobileDrawerHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    paddingHorizontal: 18, paddingTop: 16, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  mobileDrawerLogo: { width: 140, height: 40 },
  mobileDrawerClose: { padding: 2, outlineStyle: 'none' as any },
  mobileDrawerNav: { flex: 1, paddingHorizontal: 10, outlineStyle: 'none' as any },
  mobileDrawerFooter: {
    paddingHorizontal: 10, paddingTop: 12, paddingBottom: 16, gap: 8,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  mobileDrawerSignOut: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8,
  },
  mobileDrawerSignOutText: { fontSize: 13, color: '#EF4444', fontWeight: '600' },

  // Main content on mobile
  mainMobile: {
    paddingBottom: 0,
  },

  sidebar: {
    backgroundColor: SIDEBAR_BG,
    flexDirection: 'column',
    overflow: 'hidden' as any,
  },
  sidebarHamburgerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  hamburgerBtn: { padding: 4 },
  sidebarClientHubTitle: {
    color: '#fff', fontSize: 14, fontWeight: '700', letterSpacing: 0.3, flex: 1,
  },
  sidebarHeader: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  sidebarLogo: { width: 130, height: 36 },
  sidebarLogoText: { color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 1.5 },
  sidebarLogoBrand: { color: BRAND, fontSize: 8, fontWeight: '600', letterSpacing: 0, marginTop: 2 },
  sidebarClientHub: { color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginTop: 10, opacity: 1 },
  navDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginHorizontal: 10, marginVertical: 6 },

  sidebarNav: { flex: 1, paddingTop: 10, paddingHorizontal: 10 },
  navItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, marginBottom: 2,
  },
  navItemActive: { backgroundColor: SIDEBAR_ACTIVE },
  navItemCollapsed: { justifyContent: 'center', paddingHorizontal: 0, width: 40, alignSelf: 'center' },
  navLabel: { fontSize: 13, color: '#9CA3AF', fontWeight: '500' },
  navLabelActive: { color: '#fff', fontWeight: '700' },

  sidebarFooter: {
    paddingHorizontal: 10,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingTop: 12,
  },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  userAvatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center',
  },
  userAvatarText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  userName: { fontSize: 12, fontWeight: '600', color: '#E5E7EB' },
  userOrg: { fontSize: 10, color: '#6B7280', marginTop: 1 },

  main: { flex: 1, backgroundColor: '#F3F4F6', overflow: 'hidden' as any },

  viewContent: { padding: 20, paddingBottom: 48 },

  welcomeText: { fontSize: 22, fontWeight: '700', color: TEXT, marginBottom: 4 },
  welcomeSub: { fontSize: 13, color: TEXT_LIGHT, marginBottom: 24 },

  dashGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 16,
  },

  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
    overflow: 'hidden',
  },
  sectionCardHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingTop: 13, paddingBottom: 13,
    backgroundColor: '#111827',
  },
  sectionCardTitle: { fontSize: 11, fontWeight: '700', color: '#fff', textTransform: 'uppercase', letterSpacing: 0.9 },
  viewAllLink: { fontSize: 12, color: BRAND, fontWeight: '600' },

  projectCard: {
    paddingHorizontal: 18, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F9FAFB',
  },
  projectCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  projectCardTitle: { flex: 1, fontSize: 13, fontWeight: '700', color: TEXT },
  projectCardMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  projectCardMetaText: { fontSize: 11, color: TEXT_LIGHT },
  metaDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#D1D5DB' },

  quoteRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F9FAFB', gap: 10,
  },
  quoteTitle: { fontSize: 13, fontWeight: '600', color: TEXT },
  quoteMeta: { fontSize: 11, color: TEXT_LIGHT, marginTop: 2 },

  emptyState: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 20 },
  emptyIcon: { marginBottom: 10, opacity: 0.5 },
  emptyTitle: { fontSize: 13, fontWeight: '600', color: TEXT_LIGHT, marginBottom: 4 },
  emptySub: { fontSize: 12, color: TEXT_PLACEHOLDER, textAlign: 'center', lineHeight: 17 },

  pageTitle: { fontSize: 24, fontWeight: '800', color: TEXT, marginBottom: 20 },

  pageTitleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20,
  },
});

const upStyles = StyleSheet.create({
  dropZone: {
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 22,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FAFAFA',
    marginTop: 8,
  },
  dropZoneActive: {
    borderColor: BRAND,
    backgroundColor: '#FFF7F5',
  },
  dropZoneText: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_LIGHT,
    marginTop: 4,
  },
  dropZoneSub: {
    fontSize: 11,
    color: TEXT_PLACEHOLDER,
  },
  fileList: {
    marginTop: 10,
    gap: 6,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  fileRowName: {
    flex: 1,
    fontSize: 12,
    color: TEXT_MED,
    fontWeight: '500',
  },
  fileRowSize: {
    fontSize: 11,
    color: TEXT_LIGHT,
  },
  fileRemoveBtn: {
    padding: 2,
  },
  uploadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingVertical: 8,
  },
  uploadingText: {
    fontSize: 12,
    color: TEXT_LIGHT,
  },
});

const mbStyles = StyleSheet.create({
  uploadBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: BRAND, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
  },
  uploadBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  dropZone: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1.5, borderColor: '#E5E7EB', borderStyle: 'dashed',
    borderRadius: 10, paddingVertical: 14, paddingHorizontal: 16,
    backgroundColor: '#FAFAFA', marginBottom: 12, transitionDuration: '150ms' as any,
  },
  dropZoneActive: {
    borderColor: BRAND, backgroundColor: '#FFF4EE',
  },
  dropZoneText: { fontSize: 12, color: TEXT_LIGHT, flex: 1 },
  uploadFirstEmpty: {
    alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24, gap: 10,
  },
  uploadFirstIcon: {
    width: 64, height: 64, borderRadius: 16, backgroundColor: '#FFF4EE',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  uploadFirstTitle: { fontSize: 17, fontWeight: '700', color: TEXT },
  uploadFirstSub: { fontSize: 13, color: TEXT_LIGHT, textAlign: 'center', lineHeight: 19, maxWidth: 340 },
  uploadFirstBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: BRAND, paddingHorizontal: 20, paddingVertical: 11, borderRadius: 8, marginTop: 6,
  },
  uploadFirstBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  uploadFirstTypes: { fontSize: 11, color: TEXT_PLACEHOLDER, letterSpacing: 0.5, marginTop: 2 },
  pageSubtitle: { fontSize: 12, color: TEXT_LIGHT, marginTop: 2 },
  toolbar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginBottom: 16, flexWrap: 'nowrap' as any,
  },
  toolbarRight: {
    flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0,
  },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
    minWidth: 150,
  },
  searchInput: { fontSize: 13, color: TEXT, minWidth: 100, outlineStyle: 'none' } as any,
  sortWrap: { position: 'relative' as any, zIndex: 100 },
  sortDropBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
  },
  sortDropBtnText: { fontSize: 12, fontWeight: '500', color: TEXT_MED },
  sortDropMenu: {
    position: 'absolute' as any, top: '110%' as any, right: 0,
    backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER,
    borderRadius: 10, minWidth: 110, zIndex: 200,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 8,
  },
  sortDropItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 10, gap: 8,
  },
  sortDropItemActive: { backgroundColor: '#FFF4EE' },
  sortDropItemText: { fontSize: 13, color: TEXT_MED },
  sortDropItemTextActive: { color: BRAND, fontWeight: '700' },
  visualGrid: {
    flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5,
  },
  visualCard: {
    width: '23%',
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  visualThumb: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#F3F4F6',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  visualThumbImg: { width: '100%', height: '100%' },
  visualThumbPlaceholder: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
  },
  visualThumbLabel: {
    fontSize: 14, fontWeight: '800', color: BRAND, letterSpacing: 1,
  },
  visualThumbActions: {
    position: 'absolute', bottom: 6, right: 6,
    flexDirection: 'row', gap: 4,
  },
  visualThumbBtn: {
    width: 28, height: 28, borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  visualMeta: {
    padding: 8, gap: 3,
  },
  visualTypeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F3F4F6', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2, marginBottom: 2,
  },
  visualTypeBadgeText: { fontSize: 8, fontWeight: '800', color: BRAND, letterSpacing: 0.5 },
  visualFileName: {
    fontSize: 11, fontWeight: '600', color: TEXT, lineHeight: 15,
  },
  visualFileSub: {
    fontSize: 10, color: TEXT_LIGHT,
  },
  fileGrid: { gap: 10 },
  fileCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB',
    padding: 12, gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  filePreview: {
    width: 52, height: 52, borderRadius: 8,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', flexShrink: 0,
  },
  previewImage: { width: 52, height: 52 },
  fileTypeBox: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  fileTypeLabel: { fontSize: 10, fontWeight: '800', color: BRAND, letterSpacing: 0.5 },
  fileMeta: { flex: 1, gap: 2 },
  fileName: { fontSize: 13, fontWeight: '600', color: TEXT, lineHeight: 17 },
  fileSize: { fontSize: 11, color: TEXT_LIGHT },
  fileActions: { flexDirection: 'row', gap: 4, flexShrink: 0 },
  fileActionBtn: {
    padding: 8, borderRadius: 6, backgroundColor: '#F9FAFB',
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  controlBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap',
  },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
    borderWidth: 1.5, borderColor: BORDER, backgroundColor: BG,
  },
  filterChipActive: { borderColor: BRAND, backgroundColor: '#FFF4EE' },
  filterChipText: { fontSize: 12, fontWeight: '500', color: TEXT_LIGHT },
  filterChipTextActive: { color: BRAND, fontWeight: '700' },
  controlRight: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' as any },
  sortBtn: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6,
    borderWidth: 1, borderColor: BORDER, backgroundColor: BG,
  },
  sortBtnActive: { borderColor: BRAND, backgroundColor: '#FFF4EE' },
  sortBtnText: { fontSize: 11, fontWeight: '500', color: TEXT_LIGHT },
  sortBtnTextActive: { color: BRAND, fontWeight: '700' },
  viewToggle: {
    flexDirection: 'row', borderRadius: 8, overflow: 'hidden',
    borderWidth: 1, borderColor: BORDER, marginLeft: 4,
  },
  viewToggleBtn: { paddingVertical: 6, paddingHorizontal: 11, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' },
  viewToggleBtnActive: { backgroundColor: '#FFF4EE' },
  viewToggleNum: { fontSize: 12, fontWeight: '700' as const, color: TEXT_LIGHT },
  viewToggleNumActive: { color: BRAND },
  mbEmptyBin: {
    position: 'relative' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 36,
    paddingHorizontal: 12,
    gap: 14,
    marginTop: 10,
    borderRadius: 12,
    backgroundColor: '#FF7B33',
    overflow: 'hidden' as const,
  },
  mediaDot: {
    position: 'absolute' as const,
    borderRadius: 999,
    backgroundColor: '#1A1210',
    opacity: 0.3,
  },
  mediaBinIconRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
    justifyContent: 'center' as const,
    marginBottom: 4,
  },
  mediaBinCard: {
    width: 58, height: 58, borderRadius: 12,
    backgroundColor: '#1C1C1C', borderWidth: 1, borderColor: '#2A2A2A',
    alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  mediaBinCardCenter: {
    width: 66, height: 66, borderRadius: 14,
    backgroundColor: '#222222', borderColor: '#333333', zIndex: 3,
  },
  mediaBinEmptyText: {
    fontSize: 13, fontWeight: '600' as const, color: '#1A1210', textAlign: 'center' as const,
  },
  mediaBinEmptySub: {
    fontSize: 11, color: '#3A2218', textAlign: 'center' as const, marginTop: -6,
  },
});

const catStyles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 10,
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  avatar: { width: 30, height: 30, borderRadius: 7, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
  dotsBtn: { fontSize: 13, color: '#9CA3AF', letterSpacing: 2, lineHeight: 18 },
  imgArea: {
    height: 110,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImg: { width: '100%', height: '100%' } as any,
  logoPlaceholder: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },
  logoPlaceholderText: { fontSize: 32, fontWeight: '800' },
  name: { fontSize: 14, fontWeight: '700', color: TEXT },
  vendor: { fontSize: 12, color: TEXT_LIGHT, marginTop: 1 },
  badge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  description: { fontSize: 12, color: TEXT_LIGHT, lineHeight: 18 },
  actions: { flexDirection: 'column', gap: 7, marginTop: 2 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: BRAND,
    paddingVertical: 10,
    borderRadius: 8,
  },
  primaryBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER,
  },
  secondaryBtnText: { fontSize: 13, fontWeight: '600', color: TEXT },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  headerRow: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    marginBottom: 8, gap: 12, flexWrap: 'wrap',
  },
  headerSub: { fontSize: 13, color: TEXT_LIGHT, marginTop: 2 },
  requestBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: BRAND, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8,
  },
  requestBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9,
    marginBottom: 10, gap: 6,
  },
  searchInput: { flex: 1, fontSize: 13, color: TEXT, outlineStyle: 'none' } as any,
  chipsScroll: { marginBottom: 18 },
  chipsRow: { flexDirection: 'row', gap: 6, paddingVertical: 2 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    borderWidth: 1.5, borderColor: BORDER, backgroundColor: BG,
  },
  chipActive: { borderColor: BRAND, backgroundColor: '#FFF4EE' },
  chipText: { fontSize: 13, fontWeight: '500', color: TEXT_LIGHT },
  chipTextActive: { color: BRAND, fontWeight: '700' },
  ctaBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: SIDEBAR_BG, borderRadius: 14,
    padding: 20, marginTop: 24, flexWrap: 'wrap',
  },
  ctaTitle: { fontSize: 15, fontWeight: '700', color: '#fff' },
  ctaSub: { fontSize: 13, color: '#9CA3AF', marginTop: 3 },
  ctaBtn: {
    backgroundColor: BRAND, paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: 8, flexShrink: 0,
  },
  ctaBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  needHelpColumn: {
    width: 260, flexShrink: 0,
    ...Platform.select({ web: { position: 'sticky' as any, top: 20, alignSelf: 'flex-start' as any } as any, default: {} }),
  },
  needHelpCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 18, gap: 10,
    borderWidth: 1, borderColor: BORDER,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  needHelpTitle: { fontSize: 16, fontWeight: '800', color: TEXT },
  needHelpSub: { fontSize: 12, color: TEXT_LIGHT, lineHeight: 18 },
  needHelpDivider: { height: 1, backgroundColor: BORDER, marginVertical: 2 },
  needHelpContactLabel: { fontSize: 9, fontWeight: '700', color: TEXT_PLACEHOLDER, letterSpacing: 0.8 },
  needHelpPhoneBtn: {
    backgroundColor: BRAND, borderRadius: 8, paddingVertical: 9,
    alignItems: 'center', justifyContent: 'center',
  },
  needHelpPhoneText: { fontSize: 14, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  needHelpItemTitle: { fontSize: 13, fontWeight: '700', color: TEXT },
  needHelpItemBody: { fontSize: 12, color: TEXT_LIGHT, lineHeight: 17, marginTop: 2 },
  needHelpEmailBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    borderRadius: 8, paddingVertical: 9,
    backgroundColor: '#000',
  },
  needHelpEmailText: { fontSize: 14, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  needHelpCTABtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#111827', borderRadius: 8, paddingVertical: 10,
  },
  needHelpCTAText: { fontSize: 12, fontWeight: '700', color: '#fff' },
});

const mpStyles = StyleSheet.create({
  header: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: TEXT,
    lineHeight: 30,
  },
  headerSubtitle: {
    fontSize: 13,
    color: TEXT_LIGHT,
    marginTop: 2,
  },
  headerCount: {
    fontSize: 14,
    color: TEXT_LIGHT,
  },

  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 12,
    paddingTop: 2,
  },

  pillsScroll: { maxHeight: 46 },
  pillsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: BORDER,
    backgroundColor: '#fff',
  },
  pillActive: {
    borderColor: BRAND,
    backgroundColor: '#FFF4EE',
  },
  pillText: {
    fontSize: 13,
    fontWeight: '500',
    color: TEXT_LIGHT,
  },
  pillTextActive: {
    color: BRAND,
    fontWeight: '700',
  },
  pillCount: {
    backgroundColor: BORDER,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  pillCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: TEXT_LIGHT,
  },

  searchRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 12,
    alignItems: 'center',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: BG,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 12,
    paddingVertical: 9,
    minWidth: 180,
  },
  searchInput: {
    fontSize: 14,
    color: TEXT,
    outlineStyle: 'none',
    minWidth: 100,
  } as any,
  filterToggleBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  filterToggleBtnActive: {
    borderColor: BRAND,
    backgroundColor: '#FFF4EE',
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: BRAND,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  filterBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
  },

  filterPanel: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  filterPanelTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: TEXT_LIGHT,
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  filtersRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-end',
    flexWrap: 'wrap',
  },
  filterField: {
    flex: 1,
    minWidth: 120,
    gap: 4,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: TEXT_LIGHT,
  },
  filterInput: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: TEXT,
    backgroundColor: '#fff',
  },
  clearFiltersBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: BG,
    alignSelf: 'flex-end',
  },
  clearFiltersBtnText: {
    fontSize: 13,
    color: TEXT_LIGHT,
    fontWeight: '600',
  },

  section: { gap: 0 },
  sectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#111827',
    borderRadius: 10,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  sectionBarTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  viewAllLink: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND,
  },

  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F3F4F6',
  },
  thText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4B5563',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  thBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  thTextActive: {
    color: '#FF5A00',
  },

  tRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    minHeight: 72,
  },
  tRowAlt: {
    backgroundColor: '#FAFAFA',
  },
  thumbCol: {
    width: 58,
    paddingRight: 14,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  colProject: { ...TABLE_COL.textPrimary, ...TABLE_CELL.left },
  colStatus: { ...TABLE_COL.status, ...TABLE_CELL.center },
  colOrderDate: { ...TABLE_COL.date, ...TABLE_CELL.center },
  colDueDate: { ...TABLE_COL.date, ...TABLE_CELL.center },
  colPcs: { ...TABLE_COL.numeric, ...TABLE_CELL.center },
  colTotal: { ...TABLE_COL.numericWide, ...TABLE_CELL.center },
  colPerPcs: { ...TABLE_COL.numericWide, ...TABLE_CELL.center },
  colActions: { ...TABLE_COL.action, ...TABLE_CELL.center },
  tdCell: { justifyContent: 'center' },
  tdCellRight: { justifyContent: 'center', alignItems: 'center' },
  tdCellActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbInitial: {
    fontSize: 17,
    fontWeight: '800',
  },
  tRowName: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT,
    lineHeight: 18,
  },
  tDue: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT,
  },
  tNum: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT,
  },
  tNumBold: {
    fontWeight: '800',
    color: '#111827',
  },
  assetChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 6,
  },
  assetChip: {
    backgroundColor: '#FFF4EE',
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  assetChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: BRAND,
    letterSpacing: 0.2,
  },
  viewBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 7,
    backgroundColor: BRAND,
  },
  viewBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  dotsMenuBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  dotsMenuBtnText: {
    fontSize: 18,
    color: TEXT_LIGHT,
    lineHeight: 20,
  },

  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 8,
  },
  pageBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#fff',
  },
  pageBtnActive: {
    backgroundColor: BRAND,
    borderColor: BRAND,
  },
  pageBtnDisabled: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
  },
  pageBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT,
  },
  pageBtnTextActive: {
    color: '#fff',
  },

  resultCount: {
    fontSize: 11,
    color: TEXT_LIGHT,
    paddingTop: 4,
  },

  rangeSep: { fontSize: 13, color: TEXT_LIGHT },
  rangeInput: {
    flex: 1, borderWidth: 1, borderColor: BORDER, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8, fontSize: 12, color: TEXT, backgroundColor: '#fff',
  },
  costInputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: BORDER, borderRadius: 8, paddingHorizontal: 10, backgroundColor: '#fff',
  },
  costPrefix: { fontSize: 12, color: TEXT_LIGHT, marginRight: 2 },
  costInput: { flex: 1, fontSize: 12, color: TEXT, paddingVertical: 8, outlineStyle: 'none' } as any,
  clearAllBtn: {
    marginTop: 14, alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 8, borderWidth: 1, borderColor: '#FECACA', backgroundColor: '#FEF2F2',
  },
  clearAllText: { fontSize: 12, fontWeight: '600', color: '#DC2626' },

  startProjectBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: BRAND, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 9,
  },
  startProjectBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  ctaCard: {
    alignItems: 'center', backgroundColor: '#fff', borderRadius: 16,
    padding: 36, maxWidth: 400, width: '100%',
    borderWidth: 1, borderColor: BORDER,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8,
  },
  ctaIconWrap: {
    width: 60, height: 60, borderRadius: 16, backgroundColor: '#FFF4EE',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  ctaTitle: { fontSize: 18, fontWeight: '800', color: TEXT, marginBottom: 8 },
  ctaSub: { fontSize: 13, color: TEXT_LIGHT, textAlign: 'center', lineHeight: 20, marginBottom: 20, maxWidth: 280 },
  ctaBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: BRAND, borderRadius: 10,
    paddingHorizontal: 20, paddingVertical: 12,
  },
  ctaBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});

const profStyles = StyleSheet.create({
  // ── Page ──────────────────────────────────────────────────────────────────
  pageTitle: { fontSize: 22, fontWeight: '800', color: TEXT, marginBottom: 4 },
  pageSubtitle: { fontSize: 13, color: TEXT_LIGHT, lineHeight: 18 },

  // ── Card base ─────────────────────────────────────────────────────────────
  card: {
    backgroundColor: '#fff', borderRadius: 14, marginBottom: 16, overflow: 'hidden' as const,
    borderWidth: 1, borderColor: BORDER,
  },
  cardBody: { padding: 22 },
  cardBodyMobile: { padding: 18 },
  cardHead: {
    backgroundColor: '#000', minHeight: 46, paddingHorizontal: 18, paddingVertical: 8,
    flexDirection: 'row' as const, alignItems: 'center' as const,
    justifyContent: 'space-between' as const, gap: 10,
  },
  cardHeadText: {
    fontSize: 12, fontWeight: '800' as const, color: '#fff',
    textTransform: 'uppercase' as const, letterSpacing: 0.8,
  },
  cardHeadRight: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10 },
  cardLabel: {
    fontSize: 10, fontWeight: '800' as const, color: TEXT_PLACEHOLDER,
    textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 14,
  },
  cardSubtitle: { fontSize: 12, color: TEXT_LIGHT, marginBottom: 14, lineHeight: 17 },
  cardHeaderRow: {
    flexDirection: 'row' as const, alignItems: 'flex-start' as const,
    justifyContent: 'space-between' as const, marginBottom: 16, flexWrap: 'wrap' as const, gap: 10,
  },

  // ── Row-1: 3 equal cards ──────────────────────────────────────────────────
  row3: { flexDirection: 'row' as const, gap: 14, marginBottom: 16 },
  // ── Row-2: My Profile (75%) + Need Help (25%) ─────────────────────────────
  row2: { flexDirection: 'row' as const, gap: 14, alignItems: 'flex-start' as const },

  // ── Org Branding card ─────────────────────────────────────────────────────
  logoSquare: {
    width: 120, height: 120, borderRadius: 12, borderWidth: 1, borderColor: BORDER,
    backgroundColor: '#F9FAFB', overflow: 'hidden' as const,
    alignItems: 'center' as const, justifyContent: 'center' as const, marginTop: 4,
  },
  logoSquareEmpty: {
    width: '100%' as any, height: '100%' as any,
    alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: '#F3F4F6',
  },
  logoInitials: { fontSize: 40, fontWeight: '800' as const, color: '#D1D5DB' },
  logoHint: { fontSize: 10, color: TEXT_PLACEHOLDER, marginTop: 6 },
  logoManagedNote: { fontSize: 11, color: TEXT_PLACEHOLDER, fontStyle: 'italic' as const, marginTop: 12, lineHeight: 16 },

  // ── Org Information card ──────────────────────────────────────────────────
  orgInfoRow: { flexDirection: 'row' as const, alignItems: 'flex-start' as const, gap: 10 },
  infoLabel: {
    fontSize: 10, fontWeight: '700' as const, color: TEXT_PLACEHOLDER,
    textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 2,
  },
  infoValue: { fontSize: 13, fontWeight: '600' as const, color: TEXT },
  infoSub: { fontSize: 11, color: TEXT_LIGHT, marginTop: 1 },

  // ── Hub Settings card ─────────────────────────────────────────────────────
  statusLivePill: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 5,
    alignSelf: 'flex-start' as const,
    backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, marginTop: 3,
  },
  statusLiveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#16A34A' },
  statusLiveText: { fontSize: 11, fontWeight: '700' as const, color: '#16A34A' },
  hubUrlRow: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8,
    backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: BORDER,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, marginTop: 3,
  },
  hubUrlText: { flex: 1, fontSize: 11, color: TEXT_LIGHT, fontFamily: 'monospace' as any },

  // ── My Profile card ───────────────────────────────────────────────────────
  myProfileRow: { flexDirection: 'row' as const, gap: 28, marginTop: 8 },
  profileLeft: { alignItems: 'flex-start' as const, width: 160 },
  profileRight: { flex: 1, gap: 16 },
  profileDivider: { width: 1, backgroundColor: BORDER, alignSelf: 'stretch' as const },
  profileField: { gap: 3 },
  profileFieldLabel: {
    fontSize: 10, fontWeight: '700' as const, color: TEXT_PLACEHOLDER,
    textTransform: 'uppercase' as const, letterSpacing: 0.5,
  },
  profileFieldValue: { fontSize: 14, fontWeight: '600' as const, color: TEXT },
  avatarSquare: {
    width: 120, height: 120, borderRadius: 12,
    alignItems: 'center' as const, justifyContent: 'center' as const, overflow: 'hidden' as const,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6,
  },
  avatarSquareText: { fontSize: 44, fontWeight: '800' as const, color: '#fff' },
  colorSwatches: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 8, marginTop: 8 },
  colorSwatch: { width: 26, height: 26, borderRadius: 13, alignItems: 'center' as const, justifyContent: 'center' as const },
  colorSwatchSelected: {
    borderWidth: 3, borderColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 4,
  },

  // ── Team Management card ──────────────────────────────────────────────────
  teamTable: { borderRadius: 10, overflow: 'hidden' as const, borderWidth: 1, borderColor: BORDER, marginTop: 4 },
  teamRow: {
    flexDirection: 'row' as const, alignItems: 'center' as const,
    paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#fff',
  },
  teamRowAlt: { backgroundColor: '#FAFAFA' },
  teamHeaderRow: { backgroundColor: '#F9FAFB', paddingVertical: 8 },
  teamCell: { paddingRight: 8 },
  teamHeaderCell: {
    fontSize: 10, fontWeight: '800' as const, color: TEXT_PLACEHOLDER,
    textTransform: 'uppercase' as const, letterSpacing: 0.5,
  },
  memberAvatar: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#E5E7EB', alignItems: 'center' as const, justifyContent: 'center' as const, flexShrink: 0,
  },
  memberAvatarText: { fontSize: 12, fontWeight: '700' as const, color: TEXT_MED },
  memberName: { fontSize: 13, fontWeight: '600' as const, color: TEXT },
  memberEmail: { fontSize: 12, color: TEXT_LIGHT },
  youBadge: {
    backgroundColor: '#FFF4EE', borderRadius: 10,
    paddingHorizontal: 5, paddingVertical: 1, borderWidth: 1, borderColor: '#FFD5BB',
  },
  youBadgeText: { fontSize: 9, fontWeight: '700' as const, color: BRAND },
  rolePill: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
    backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: BORDER, alignSelf: 'flex-start' as const,
  },
  rolePillAdmin: { backgroundColor: '#FFF4EE', borderColor: '#FFD5BB' },
  rolePillText: { fontSize: 10, fontWeight: '600' as const, color: TEXT_LIGHT },
  rolePillTextAdmin: { color: BRAND },
  invitedBadge: {
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20,
    backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', alignSelf: 'flex-start' as const,
  },
  invitedBadgeText: { fontSize: 10, fontWeight: '600' as const, color: '#2563EB' },
  activeBadge: {
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20,
    backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0', alignSelf: 'flex-start' as const,
  },
  activeBadgeText: { fontSize: 10, fontWeight: '600' as const, color: '#16A34A' },
  actionBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: BRAND },
  actionBtnText: { fontSize: 10, fontWeight: '600' as const, color: BRAND },
  removeBtn: { padding: 6, borderRadius: 6, backgroundColor: '#FEF2F2' },
  emptyTeam: { alignItems: 'center' as const, paddingVertical: 28 },
  emptyTeamText: { fontSize: 13, color: TEXT_LIGHT },

  // ── Invite row (inline) ───────────────────────────────────────────────────
  inviteRow: { flexDirection: 'row' as const, gap: 8 },
  inviteInputWrap: {
    flex: 1, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8,
    borderWidth: 1, borderColor: BORDER, borderRadius: 9,
    paddingHorizontal: 12, paddingVertical: 9, backgroundColor: BG,
  },
  inviteInput: { flex: 1, fontSize: 13, color: TEXT, outlineStyle: 'none' } as any,

  // ── Shared buttons ────────────────────────────────────────────────────────
  outlineBtn: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6,
    borderWidth: 1, borderColor: BRAND, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
  },
  outlineBtnText: { fontSize: 12, fontWeight: '600' as const, color: BRAND },
  destructiveBtn: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6,
    borderWidth: 1, borderColor: '#FECACA', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FEF2F2',
  },
  destructiveBtnText: { fontSize: 12, fontWeight: '600' as const, color: '#DC2626' },
  primaryBtn: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6,
    backgroundColor: BRAND, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9,
  },
  primaryBtnText: { fontSize: 13, fontWeight: '700' as const, color: '#fff' },
  helpBtn: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10,
    backgroundColor: BRAND, borderRadius: 9, paddingHorizontal: 16, paddingVertical: 11,
  },
  helpBtnText: { fontSize: 13, fontWeight: '700' as const, color: '#fff' },
  helpBtnLabel: { fontSize: 13, fontWeight: '800' as const, color: '#fff' },
  helpBtnValue: { fontSize: 12, fontWeight: '600' as const, color: 'rgba(255,255,255,0.85)' as any, marginTop: 1 },

  // ── Full-width button (mobile) ────────────────────────────────────────────
  btnFull: { alignSelf: 'stretch' as const, justifyContent: 'center' as const },

  // ── My Profile (mobile centered) ──────────────────────────────────────────
  myProfileRowMobile: { flexDirection: 'column' as const, gap: 20, alignItems: 'center' as const },
  profileLeftMobile: { width: '100%' as any, alignItems: 'center' as const },

  // ── Team member cards (mobile) ────────────────────────────────────────────
  memberCard: {
    borderWidth: 1, borderColor: BORDER, borderRadius: 12, padding: 14, gap: 12, backgroundColor: '#fff',
  },
  memberCardTop: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10 },
  memberCardBadges: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, flexWrap: 'wrap' as const },
  memberCardActions: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
  resendBtn: {
    flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 6,
    borderWidth: 1, borderColor: BRAND, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, flex: 1,
  },
  resendBtnText: { fontSize: 12, fontWeight: '700' as const, color: BRAND },
  removeBtnLg: {
    flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 6,
    borderWidth: 1, borderColor: '#FECACA', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: '#FEF2F2',
  },
  removeBtnLgText: { fontSize: 12, fontWeight: '700' as const, color: '#DC2626' },

  // ── Feedback ──────────────────────────────────────────────────────────────
  successText: { fontSize: 12, color: '#16A34A', marginTop: 8 },
  errorText: { fontSize: 12, color: '#DC2626', marginBottom: 8 },

  // ── Sidebar dropdown ──────────────────────────────────────────────────────
  sidebarDropdown: {
    position: 'absolute' as const, bottom: 64, left: 0, right: 0,
    backgroundColor: '#1C1C1E', borderRadius: 12, borderWidth: 1, borderColor: '#2A2A2A',
    padding: 4, zIndex: 999,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.4, shadowRadius: 16,
  },
  sidebarDropdownItem: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10,
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8,
  },
  sidebarDropdownText: { fontSize: 13, fontWeight: '500' as const, color: '#E5E7EB' },
  sidebarDropdownSep: { height: 1, backgroundColor: '#2A2A2A', marginVertical: 2, marginHorizontal: 4 },

  // ── LEGACY stubs (kept so any stale references don't error) ───────────────
  section: {
    backgroundColor: '#fff', borderRadius: 14, padding: 22,
    marginBottom: 18, borderWidth: 1, borderColor: BORDER,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4,
  },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 20 },
  avatar: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 24, fontWeight: '700', color: '#fff' },
  avatarLarge: {
    width: 88, height: 88, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6,
  },
  avatarLargeText: { fontSize: 38, fontWeight: '700', color: '#fff' },
  userName: { fontSize: 18, fontWeight: '700', color: TEXT, marginBottom: 2 },
  userEmail: { fontSize: 13, color: TEXT_LIGHT, marginBottom: 6 },
  orgBadge: {
    alignSelf: 'flex-start', backgroundColor: '#FFF4EE', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1, borderColor: '#FFD5BB',
  },
  orgBadgeText: { fontSize: 11, fontWeight: '600', color: BRAND },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  infoCell: { flex: 1, minWidth: 120 },
  infoLabel: { fontSize: 10, fontWeight: '700', color: TEXT_PLACEHOLDER, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  infoValue: { fontSize: 14, fontWeight: '500', color: TEXT },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: TEXT },
  memberCount: { fontSize: 12, color: TEXT_LIGHT },
  inviteRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  inviteInputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: BORDER, borderRadius: 9,
    paddingHorizontal: 12, paddingVertical: 9, backgroundColor: BG,
  },
  inviteInput: { flex: 1, fontSize: 13, color: TEXT, outlineStyle: 'none' } as any,
  inviteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: BRAND, borderRadius: 9,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  inviteBtnDisabled: { opacity: 0.5 },
  inviteBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  errorText: { fontSize: 12, color: '#DC2626', marginBottom: 8 },
  successText: { fontSize: 12, color: '#16A34A', marginBottom: 8 },
  memberList: { borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: BORDER },
  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#fff',
  },
  memberRowAlt: { backgroundColor: '#FAFAFA' },
  memberAvatar: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  memberAvatarText: { fontSize: 13, fontWeight: '700', color: TEXT_MED },
  memberName: { fontSize: 13, fontWeight: '600', color: TEXT },
  memberEmail: { fontSize: 11, color: TEXT_LIGHT },
  memberMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  rolePill: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
    backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: BORDER,
  },
  rolePillAdmin: { backgroundColor: '#FFF4EE', borderColor: '#FFD5BB' },
  rolePillText: { fontSize: 10, fontWeight: '600', color: TEXT_LIGHT },
  rolePillTextAdmin: { color: BRAND },
  invitedBadge: {
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20,
    backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE',
  },
  invitedBadgeText: { fontSize: 10, fontWeight: '600', color: '#2563EB' },
  removeBtn: { padding: 6, borderRadius: 6, backgroundColor: '#FEF2F2' },
  emptyTeam: { alignItems: 'center', paddingVertical: 20 },
  emptyTeamText: { fontSize: 13, color: TEXT_LIGHT },
  editBlock: { marginBottom: 18 },
  editLabel: { fontSize: 10, fontWeight: '700', color: TEXT_PLACEHOLDER, textTransform: 'uppercase', letterSpacing: 0.5 },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: BRAND, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  editBtnText: { fontSize: 12, fontWeight: '600', color: BRAND },
  editBtnDestructive: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: '#FECACA', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FEF2F2',
  },
  editBtnDestructiveText: { fontSize: 12, fontWeight: '600', color: '#DC2626' },
  colorSwatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  colorSwatch: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  colorSwatchSelected: {
    borderWidth: 3, borderColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 4,
  },
  orgLogoPreview: {
    borderRadius: 10, borderWidth: 1, borderColor: BORDER,
    backgroundColor: '#F9FAFB', padding: 16, alignItems: 'center',
  },
  orgLogoEmpty: {
    borderRadius: 10, borderWidth: 1, borderColor: BORDER, borderStyle: 'dashed' as any,
    backgroundColor: '#F9FAFB', padding: 28, alignItems: 'center',
  },
  signOutBlock: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginTop: 8, padding: 16, borderRadius: 12,
    borderWidth: 1, borderColor: '#FEE2E2', backgroundColor: '#FFF5F5',
  },
  signOutText: { fontSize: 14, fontWeight: '600', color: '#DC2626' },
});

const pvStyles = StyleSheet.create({
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 20,
    borderWidth: 1, borderColor: BORDER,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4,
  },
  projectTitle: { fontSize: 22, fontWeight: '800', color: TEXT, marginBottom: 4 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: TEXT, marginBottom: 2 },
  metaLabel: { fontSize: 10, fontWeight: '700', color: TEXT_LIGHT, letterSpacing: 0.5 },
  metaValue: { fontSize: 13, fontWeight: '600', color: TEXT, marginTop: 3 },
  lineItemBlock: {},
  lineItemName: { fontSize: 15, fontWeight: '700', color: TEXT },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailLabel: { fontSize: 12, color: TEXT_LIGHT, width: 66 },
  detailValue: { fontSize: 12, color: TEXT, fontWeight: '500', flex: 1 },
  sizeBox: {
    borderWidth: 1, borderColor: BORDER, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8, minWidth: 52, alignItems: 'center',
  },
  sizeLabel: { fontSize: 10, fontWeight: '700', color: TEXT_LIGHT },
  sizeQty: { fontSize: 15, fontWeight: '700', color: TEXT, marginTop: 2 },
  costRow: {
    flexDirection: 'row', gap: 0,
    borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 12,
  },
  costCell: { flex: 1, alignItems: 'center', gap: 4 },
  costLabel: { fontSize: 10, fontWeight: '600', color: TEXT_LIGHT },
  costAmt: { fontSize: 12, fontWeight: '700', color: TEXT },
  lineItemFooter: {
    marginTop: 20, backgroundColor: BRAND, borderRadius: 10, padding: 14,
    alignItems: 'center',
  },
  priceHeaderRow: { flexDirection: 'row', paddingBottom: 6 },
  priceColHeader: { width: 70, textAlign: 'right', fontSize: 10, fontWeight: '700', color: TEXT_LIGHT, letterSpacing: 0.4 },
  priceDivider: { height: 1, backgroundColor: BORDER, marginVertical: 8 },
  priceRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  priceRowLabel: { flex: 1, fontSize: 12, color: TEXT_LIGHT },
  priceRowVal: { width: 70, textAlign: 'right', fontSize: 12, color: TEXT },
  totalBlock: {
    marginTop: 16, backgroundColor: BRAND, borderRadius: 10, padding: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  totalLabel: { fontSize: 14, fontWeight: '800', color: '#fff' },
  totalAmt: { fontSize: 22, fontWeight: '900', color: '#fff' },

  sectionSub: { fontSize: 12, color: TEXT_LIGHT, marginTop: 4, marginBottom: 12 },

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
  mockupCaption: {
    fontSize: 12, fontWeight: '600', color: TEXT,
    paddingHorizontal: 10, paddingVertical: 8,
  },

  assetCat: { marginTop: 14 },
  assetCatHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  assetCatTitle: { fontSize: 13, fontWeight: '800', color: TEXT, letterSpacing: 0.2 },
  assetCatCount: {
    minWidth: 20, paddingHorizontal: 6, height: 18, borderRadius: 9,
    backgroundColor: '#FFF4EE', alignItems: 'center', justifyContent: 'center',
  },
  assetCatCountText: { fontSize: 11, fontWeight: '800', color: BRAND },
  assetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  assetTile: {
    width: 140, borderRadius: 10, borderWidth: 1, borderColor: BORDER,
    backgroundColor: '#fff', overflow: 'hidden',
  },
  assetThumb: {
    width: '100%', aspectRatio: 1, backgroundColor: '#F3F4F6',
    position: 'relative', alignItems: 'center', justifyContent: 'center',
  },
  assetThumbImg: { width: '100%', height: '100%' },
  assetTypeBox: { alignItems: 'center', justifyContent: 'center', gap: 6 },
  assetTypeLabel: { fontSize: 11, fontWeight: '800', color: BRAND, letterSpacing: 0.5 },
  assetActions: {
    position: 'absolute', bottom: 6, right: 6, flexDirection: 'row', gap: 4,
  },
  assetBtn: {
    width: 28, height: 28, borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center',
  },
  assetTileMeta: { padding: 8, gap: 2 },
  assetTileName: { fontSize: 11, fontWeight: '600', color: TEXT, lineHeight: 15 },
  assetTileMetaLine: { fontSize: 10, color: TEXT_LIGHT },

  liCard: {
    borderWidth: 1, borderColor: BORDER, borderRadius: 12, padding: 14,
    backgroundColor: '#fff',
  },
  liMockupSection: { marginBottom: 14 },
  liHeroWrap: {
    position: 'relative', width: '100%', borderRadius: 10, borderWidth: 1,
    borderColor: BORDER, backgroundColor: '#F9FAFB', overflow: 'hidden',
  },
  liHeroImg: { width: '100%', aspectRatio: 4 / 3, backgroundColor: '#F3F4F6' },
  liThumbStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  liThumb: {
    width: 52, height: 52, borderRadius: 8, borderWidth: 1, borderColor: BORDER,
    overflow: 'hidden', backgroundColor: '#F9FAFB',
  },
  liThumbActive: { borderColor: BRAND, borderWidth: 2 },
  liThumbImg: { width: '100%', height: '100%' },

  fileRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: BORDER, borderRadius: 10, padding: 12,
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
  actionFavActive: { borderColor: BRAND, backgroundColor: '#FFF4EE' },
  qrApprove: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#059669', borderRadius: 10, paddingVertical: 12,
  },
  qrApproveText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  qrDecline: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#FCA5A5',
    borderRadius: 10, paddingVertical: 12,
  },
  qrDeclineText: { fontSize: 14, fontWeight: '600', color: '#DC2626' },
  qrBanner: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  qrBannerLabel: { fontSize: 14, fontWeight: '700' },
  qrBannerMeta: { fontSize: 11, color: TEXT_LIGHT, marginTop: 2 },
  tlRow: { flexDirection: 'row', gap: 12 },
  tlMarkerCol: { alignItems: 'center', width: 14 },
  tlDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: BORDER, backgroundColor: '#fff' },
  tlLine: { flex: 1, width: 2, backgroundColor: BORDER, marginVertical: 2 },
  tlLabel: { fontSize: 13, fontWeight: '600', color: TEXT, lineHeight: 16 },
  tlDate: { fontSize: 11, color: TEXT_LIGHT, marginTop: 2 },
});

const qmStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  sheet: { backgroundColor: '#fff', borderRadius: 16, width: '100%', maxWidth: 440, padding: 22 },
  title: { fontSize: 18, fontWeight: '700', color: TEXT },
  body: { fontSize: 13, color: TEXT_MED, lineHeight: 19, marginTop: 8 },
  input: {
    marginTop: 14, minHeight: 90, borderWidth: 1, borderColor: BORDER, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: TEXT,
    textAlignVertical: 'top', outlineStyle: 'none',
  } as any,
  err: { fontSize: 12, color: '#DC2626', marginTop: 10 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 18 },
  cancel: { paddingVertical: 11, paddingHorizontal: 18, borderRadius: 10, borderWidth: 1, borderColor: BORDER, backgroundColor: '#fff' },
  cancelText: { fontSize: 14, fontWeight: '600', color: TEXT_MED },
  confirm: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minWidth: 130, paddingVertical: 11, paddingHorizontal: 18, borderRadius: 10 },
  confirmText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  confirmApprove: { backgroundColor: '#059669' },
  confirmPrimary: { backgroundColor: BRAND },
  confirmDecline: { backgroundColor: '#DC2626' },
});

const binPickStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  sheet: { backgroundColor: '#fff', borderRadius: 14, width: '100%', maxWidth: 480, overflow: 'hidden' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 18, borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  title: { fontSize: 15, fontWeight: '700', color: TEXT },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: BORDER, backgroundColor: '#F9FAFB',
  },
  searchInput: { flex: 1, fontSize: 13, color: TEXT, outlineStyle: 'none' } as any,
  fileRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 13, backgroundColor: '#fff',
  },
  fileRowAlt: { backgroundColor: '#FAFAFA' },
  fileName: { fontSize: 13, fontWeight: '500', color: TEXT },
  fileMeta: { fontSize: 11, color: TEXT_PLACEHOLDER, marginTop: 1 },
});

const homeStyles = StyleSheet.create({
  qaRow: {
    flexDirection: 'row', gap: 12, marginBottom: 20, flexWrap: 'wrap',
  },
  qaCard: {
    flex: 1, minWidth: 120,
    backgroundColor: '#fff', borderRadius: 12,
    padding: 16, alignItems: 'center', gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
    borderWidth: 1, borderColor: BORDER,
  },
  qaIcon: {
    width: 40, height: 40, borderRadius: 10, backgroundColor: '#FFF4EE',
    alignItems: 'center', justifyContent: 'center',
  },
  qaLabel: {
    fontSize: 12, fontWeight: '600', color: TEXT, textAlign: 'center',
  },
  previewRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4,
  },
  previewThumb: {
    width: 40, height: 40, borderRadius: 6, flexShrink: 0,
    backgroundColor: '#F3F4F6',
  },
  previewThumbPlaceholder: {
    width: 40, height: 40, borderRadius: 6, flexShrink: 0,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
  },
  previewThumbLabel: {
    fontSize: 8, fontWeight: '800', color: BRAND, letterSpacing: 0.5,
  },
  previewName: {
    flex: 1, fontSize: 12, color: TEXT, fontWeight: '500',
  },
  previewBadge: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 20,
  },
  previewBadgeText: {
    fontSize: 10, fontWeight: '600',
  },
  catGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 14, paddingVertical: 10,
  },
  catCell: {
    width: '33.33%',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 7, paddingHorizontal: 6,
  },
  catAvatar: {
    width: 34, height: 34, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  catAvatarText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  catName: { flex: 1, fontSize: 12, fontWeight: '600', color: TEXT, lineHeight: 15 },
  mbUploadEmpty: {
    paddingHorizontal: 18, paddingVertical: 14, gap: 10,
  },
  mbUploadBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: BRAND, borderRadius: 8, paddingVertical: 9,
  },
  mbUploadBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  mbDropZone: {
    borderWidth: 1.5, borderColor: '#D1D5DB', borderStyle: 'dashed' as any,
    borderRadius: 10, paddingVertical: 16, paddingHorizontal: 12,
    alignItems: 'center', gap: 5, backgroundColor: '#FAFAFA',
  },
  mbDropZoneText: { fontSize: 12, fontWeight: '600', color: TEXT_LIGHT, marginTop: 3 },
  mbDropZoneSub: { fontSize: 10, color: TEXT_PLACEHOLDER },
});

const pcStyles = StyleSheet.create({
  section: { gap: 12 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingBottom: 4,
    borderBottomWidth: 2, borderBottomColor: '#111827',
  },
  sectionTitle: {
    fontSize: 11, fontWeight: '800', color: '#111827', letterSpacing: 1.2,
  },
  sectionBadge: {
    backgroundColor: '#111827', borderRadius: 10, minWidth: 22, height: 22,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
  },
  sectionBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  cardGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 4,
  },
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16, gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
    borderWidth: 1, borderColor: BORDER,
  },
  cardTop: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', gap: 8,
  },
  projectName: {
    flex: 1, fontSize: 14, fontWeight: '700', color: TEXT, lineHeight: 19,
  },
  thumbBanner: {
    height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
  },
  thumbBannerLabel: {
    fontSize: 10, fontWeight: '800', letterSpacing: 1,
  },
  metaGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
    backgroundColor: '#F9FAFB', borderRadius: 8, padding: 10,
  },
  metaItem2: {
    width: '48%', gap: 2,
  },
  metaRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F9FAFB', borderRadius: 10, padding: 12,
  },
  metaItem: {
    flex: 1, alignItems: 'center', gap: 3,
  },
  metaDivider: {
    width: 1, height: 30, backgroundColor: BORDER,
  },
  metaLabel: {
    fontSize: 9, fontWeight: '700', color: TEXT_LIGHT, letterSpacing: 0.6,
  },
  metaValue: {
    fontSize: 12, fontWeight: '600', color: TEXT,
  },
  cardFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end',
    marginTop: 2,
  },
  viewBtn: {
    flex: 1, backgroundColor: BRAND, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8,
    alignItems: 'center',
  },
  viewBtnText: {
    fontSize: 12, fontWeight: '700', color: '#fff',
  },
  pendingBadge: {
    flex: 1, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8,
    backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: BORDER,
    alignItems: 'center',
  },
  pendingBadgeText: {
    fontSize: 12, fontWeight: '600', color: TEXT_LIGHT,
  },
});

const svStyles = StyleSheet.create({
  formRow: {
    flexDirection: 'row', gap: 20, alignItems: 'flex-start',
    width: '100%', maxWidth: 1040, marginHorizontal: 'auto' as any,
  },
  helperCard: {
    flexBasis: '28%' as any, flexShrink: 0, flexGrow: 0, minWidth: 200, maxWidth: 320,
    backgroundColor: '#fff', borderRadius: 14, padding: 20, gap: 12,
    borderWidth: 1, borderColor: BORDER,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
    ...Platform.select({ web: { position: 'sticky' as any, top: 20, alignSelf: 'flex-start' as any } }),
  },
  helperCardMobile: {
    flexBasis: 'auto' as any, flexShrink: 1, flexGrow: 1, minWidth: 0,
    width: '100%' as any,
    ...Platform.select({ web: { position: 'relative' as any, top: 0, alignSelf: 'stretch' as any } }),
  },
  helperBrand: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  helperBrandText: {
    fontSize: 16, fontWeight: '800', color: TEXT,
  },
  helperTagline: {
    fontSize: 13, color: TEXT_LIGHT, lineHeight: 19,
  },
  helperItem: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
  },
  helperItemTitle: {
    fontSize: 13, fontWeight: '700', color: TEXT,
  },
  helperItemBody: {
    fontSize: 12, color: TEXT_LIGHT, lineHeight: 17, marginTop: 2,
  },
  helperDivider: {
    height: 1, backgroundColor: BORDER, marginVertical: 4,
  },
  helperCallLabel: {
    fontSize: 10, fontWeight: '700', color: TEXT_LIGHT, letterSpacing: 0.8,
  },
  helperPhoneBtn: {
    backgroundColor: BRAND, borderRadius: 8, paddingVertical: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  helperPhoneText: {
    fontSize: 15, fontWeight: '800', color: '#fff', letterSpacing: 0.5,
  },
  helperEmailBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: 8, paddingVertical: 9,
    backgroundColor: '#000',
  },
  helperEmailText: {
    fontSize: 13, fontWeight: '700', color: '#fff',
  },
});
