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
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useBreakpoint } from '@/hooks/useBreakpoint';
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
  List,
} from 'lucide-react-native';
import { LOCATIONS, PRODUCTS, PRODUCT_COLORS } from '@/types/quote';

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
  createdAt: string;
  lineItemCount: number;
  totalCost: string | null;
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

function StatusPill({ status }: { status: string }) {
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

const NAV_ITEMS: { id: ActiveView; label: string; Icon: React.ComponentType<any> }[] = [
  { id: 'home',     label: 'Dashboard',       Icon: LayoutDashboard },
  { id: 'submit',   label: 'Submit a Project', Icon: ClipboardList },
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
                accept=".ai,.svg,.png,.jpg,.jpeg,.pdf"
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
                  <Text style={liStyles.artworkDropSub}>AI · SVG · PNG · JPG · PDF</Text>
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
  const [mediaBinSearch, setMediaBinSearch] = useState('');
  const [mediaBinFilter, setMediaBinFilter] = useState<string>('All');
  const [mediaBinSort, setMediaBinSort] = useState<'Newest' | 'Oldest' | 'A-Z'>('Newest');
  const [mediaBinViewMode, setMediaBinViewMode] = useState<'grid' | 'list'>('grid');
  const [catSearch, setCatSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');

  const [artworkFromBin, setArtworkFromBin] = useState<MediaFile[]>([]);
  const [binPickerVisible, setBinPickerVisible] = useState(false);
  const [binPickerTarget, setBinPickerTarget] = useState<'mockup' | 'artwork'>('artwork');
  const [binPickerLineItemId, setBinPickerLineItemId] = useState<string | null>(null);
  const [binPickerSearch, setBinPickerSearch] = useState('');

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
  const profilePicInputRef = useRef<any>(null);
  const orgLogoInputRef = useRef<any>(null);

  const [mpSearch, setMpSearch] = useState('');
  const [mpStatusFilter, setMpStatusFilter] = useState<string | null>(null);
  const [mpDateFrom, setMpDateFrom] = useState('');
  const [mpDateTo, setMpDateTo] = useState('');
  const [mpCostMin, setMpCostMin] = useState('');
  const [mpCostMax, setMpCostMax] = useState('');
  const [mpShowFilters, setMpShowFilters] = useState(false);
  type MpSortField = 'status' | 'project' | 'submitted' | 'inHands' | 'items' | 'total';
  const [mpSortField, setMpSortField] = useState<MpSortField>('submitted');
  const [mpSortDir, setMpSortDir] = useState<'asc' | 'desc'>('desc');

  const fileInputRef = useRef<any>(null);
  const mediaBinInputRef = useRef<any>(null);
  const dropZoneRef = useRef<any>(null);
  const mediaBinDropRef = useRef<any>(null);

  const [activeView, setActiveView] = useState<ActiveView>('home');
  const [orgProjects, setOrgProjects] = useState<PortalProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<FullPortalProject | null>(null);
  const [projectViewLoading, setProjectViewLoading] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const sidebarWidthAnim = useRef(new Animated.Value(210)).current;

  const [clientCatalogs, setClientCatalogs] = useState<Array<{
    id: string; name: string; description: string | null; vendorName: string | null;
    category: string; catalogUrl: string; websiteUrl: string | null;
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
        if (data.logoUrl) setOrgLogoUrl(data.logoUrl);
        if (data.name) setOrgDisplayName(data.name);
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
      }
    } catch {}
    setProjectViewLoading(false);
  }, [session]);

  const fetchMediaBin = useCallback(async (oid: string) => {
    setMediaBinLoading(true);
    try {
      const res = await fetch(`/api/files?orgId=${oid}&scope=org`);
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

  const handleFilesAdded = useCallback((rawFiles: globalThis.File[]) => {
    const allowed = rawFiles.filter(f => {
      const n = f.name.toLowerCase();
      return n.endsWith('.ai') || n.endsWith('.svg') || n.endsWith('.png')
        || n.endsWith('.jpg') || n.endsWith('.jpeg') || n.endsWith('.pdf');
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
    if (Platform.OS !== 'web' || !mediaBinDropRef.current) return;
    const el = mediaBinDropRef.current as any;
    const onDragOver = (e: any) => { e.preventDefault(); };
    const onDrop = (e: any) => {
      e.preventDefault();
      if (!session) return;
      const files = Array.from((e.dataTransfer?.files || []) as globalThis.File[]);
      if (files.length === 0) return;
      handleMediaBinUpload(files);
    };
    el.addEventListener('dragover', onDragOver);
    el.addEventListener('drop', onDrop);
    return () => {
      el.removeEventListener('dragover', onDragOver);
      el.removeEventListener('drop', onDrop);
    };
  }, [activeView, session]);

  const handleMediaBinUpload = useCallback(async (rawFiles: globalThis.File[]) => {
    if (!session) return;
    const allowed = rawFiles.filter(f => {
      const n = f.name.toLowerCase();
      return n.endsWith('.ai') || n.endsWith('.svg') || n.endsWith('.png')
        || n.endsWith('.jpg') || n.endsWith('.jpeg') || n.endsWith('.pdf');
    });
    if (allowed.length === 0) return;
    setMediaBinUploading(true);
    for (const f of allowed) {
      const fd = new FormData();
      fd.append('file', f);
      fd.append('orgId', session.orgId);
      fd.append('uploadedByUserId', session.userId);
      fd.append('fileType', 'ARTWORK');
      fd.append('visibility', 'CLIENT_VISIBLE');
      await fetch('/api/files', { method: 'POST', body: fd }).catch(() => {});
    }
    await fetchMediaBin(session.orgId);
    setMediaBinUploading(false);
  }, [session, fetchMediaBin]);

  const deleteMediaBinFile = useCallback(async (fileId: string) => {
    if (!session) return;
    await fetch(`/api/files/${fileId}`, { method: 'DELETE' }).catch(() => {});
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
    } catch {
      setEmailError('Connection error. Please try again.');
    } finally {
      setEmailLoading(false);
    }
  }, [email, orgId, fetchOrgProjects]);

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
      setStep('success');
    } catch {
      setSubmitError('Connection error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [session, projectName, orderType, inHandsDate, requestNotes, lineItems, pendingFiles, artworkFromBin]);

  const handleNewRequest = useCallback(() => {
    setProjectName('');
    setOrderType('New Order');
    setInHandsDate('');
    setRequestNotes('');
    setLineItems([emptyLineItem()]);
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

  function ProjectCard({ project }: { project: PortalProject }) {
    return (
      <View style={dash.projectCard}>
        <View style={dash.projectCardTop}>
          <Text style={dash.projectCardTitle} numberOfLines={1}>{project.title}</Text>
          <StatusPill status={project.status} />
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
                      <StatusPill status={p.status} />
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
                          <Text style={homeStyles.catName} numberOfLines={2}>{cat.vendorName || cat.name}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
            }
          </SectionCard>
        </View>
        <View style={{ flex: 1, minWidth: 200 }}>
          <SectionCard title="Media Bin" onViewAll={() => { setActiveView('artwork'); if (session) fetchMediaBin(session.orgId); }}>
            {mediaBinFiles.length === 0
              ? (
                <View style={homeStyles.mbUploadEmpty}>
                  {Platform.OS === 'web' && (
                    <input ref={mediaBinInputRef} type="file" accept=".ai,.svg,.png,.jpg,.jpeg,.pdf" multiple style={{ display: 'none' }}
                      onChange={(e: any) => { const files = Array.from((e.target.files || []) as globalThis.File[]); if (files.length > 0) { setActiveView('artwork'); handleMediaBinUpload(files); } e.target.value = ''; }}
                    />
                  )}
                  <TouchableOpacity
                    style={homeStyles.mbUploadBtn}
                    onPress={() => { setActiveView('artwork'); if (session) fetchMediaBin(session.orgId); mediaBinInputRef.current?.click?.(); }}
                    activeOpacity={0.85}
                  >
                    <Upload size={14} color="#fff" />
                    <Text style={homeStyles.mbUploadBtnText}>Upload Files</Text>
                  </TouchableOpacity>
                  <View style={homeStyles.mbDropZone}>
                    <Upload size={18} color="#9CA3AF" />
                    <Text style={homeStyles.mbDropZoneText}>Drag & drop artwork here</Text>
                    <Text style={homeStyles.mbDropZoneSub}>AI · SVG · PNG · JPG · PDF</Text>
                  </View>
                </View>
              )
              : <View style={{ gap: 8 }}>
                  {mediaBinFiles.slice(0, 4).map(f => (
                    <View key={f.id} style={homeStyles.previewRow}>
                      <View style={[homeStyles.previewDot, { backgroundColor: isImageMime(f.mimeType) ? '#10B981' : '#6366F1' }]} />
                      <Text style={homeStyles.previewName} numberOfLines={1}>{f.originalName}</Text>
                      <View style={[homeStyles.previewBadge, { backgroundColor: '#F3F4F6' }]}>
                        <Text style={[homeStyles.previewBadgeText, { color: '#6B7280' }]}>{getMimeLabel(f.mimeType, f.originalName)}</Text>
                      </View>
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
    const normalSt = (s: string) => s.toUpperCase().replace('QUOTE_SENT', 'QUOTED');

    const displayed = orgProjects.filter(p => {
      const norm = normalSt(p.status);
      if (mpStatusFilter && norm !== mpStatusFilter) return false;
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
        case 'status':
          valA = normalSt(a.status); valB = normalSt(b.status); break;
        case 'project':
          valA = (a.title || '').toLowerCase(); valB = (b.title || '').toLowerCase(); break;
        case 'submitted':
          valA = new Date(a.createdAt).getTime(); valB = new Date(b.createdAt).getTime(); break;
        case 'inHands':
          valA = a.inHandsDate ? new Date(a.inHandsDate).getTime() : 0;
          valB = b.inHandsDate ? new Date(b.inHandsDate).getTime() : 0; break;
        case 'items':
          valA = a.lineItemCount || 0; valB = b.lineItemCount || 0; break;
        case 'total':
          valA = parseFloat(a.totalCost || '0'); valB = parseFloat(b.totalCost || '0'); break;
        default: valA = 0; valB = 0;
      }
      if (valA < valB) return mpSortDir === 'asc' ? -1 : 1;
      if (valA > valB) return mpSortDir === 'asc' ? 1 : -1;
      return 0;
    });

    const SortTh = ({ field, label, width, flex, align }: {
      field: typeof mpSortField; label: string;
      width?: number; flex?: number; align?: 'left' | 'center' | 'right';
    }) => {
      const active = mpSortField === field;
      const dir = mpSortDir;
      return (
        <TouchableOpacity
          onPress={() => toggleSort(field)}
          style={[mpStyles.thBtn, width ? { width } : undefined, flex ? { flex } : undefined]}
        >
          <Text style={[mpStyles.thText, active && mpStyles.thTextActive, align === 'right' && { textAlign: 'right' }, align === 'center' && { textAlign: 'center' }]}>
            {label}
          </Text>
          {active
            ? (dir === 'asc'
              ? <ChevronUp size={10} color="#FF5A00" />
              : <ChevronDown size={10} color="#FF5A00" />)
            : <ArrowUpDown size={10} color="rgba(255,255,255,0.4)" />
          }
        </TouchableOpacity>
      );
    };

    const hasActiveFilters = !!(mpStatusFilter || mpDateFrom || mpDateTo || mpCostMin || mpCostMax);

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
      { key: 'INVOICE_SENT', label: 'Invoice Sent' },
      { key: 'IN_PRODUCTION', label: 'In Production' },
      { key: 'COMPLETED', label: 'Completed' },
    ];

    const statusCounts: Record<string, number> = {};
    orgProjects.forEach(p => {
      const norm = normalSt(p.status);
      statusCounts[norm] = (statusCounts[norm] || 0) + 1;
    });

    const isQuoteStatus = (s: string) => {
      const n = normalSt(s);
      return ['QUOTED', 'INVOICE_SENT', 'PAID', 'IN_PRODUCTION', 'COMPLETED'].includes(n);
    };

    const advFilterCount = [mpDateFrom || mpDateTo, mpCostMin || mpCostMax].filter(Boolean).length;

    return (
      <View style={{ flex: 1 }}>
        {/* White header matching admin */}
        <View style={mpStyles.header}>
          <View style={mpStyles.headerTop}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={mpStyles.headerTitle}>My Projects</Text>
              <Text style={mpStyles.headerCount}>{orgProjects.length} project{orgProjects.length !== 1 ? 's' : ''}</Text>
            </View>
            <TouchableOpacity style={mpStyles.startProjectBtn} onPress={() => setActiveView('submit')} activeOpacity={0.85}>
              <Plus size={14} color="#fff" />
              <Text style={mpStyles.startProjectBtnText}>Start a Project</Text>
            </TouchableOpacity>
          </View>

          {/* Status pills — always visible */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={mpStyles.pillsScroll}
            contentContainerStyle={mpStyles.pillsRow}
          >
            {STATUS_PILLS_CFG.map(pill => {
              const count = pill.key === null ? orgProjects.length : (statusCounts[pill.key] ?? 0);
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
                  onPress={() => setMpStatusFilter(pill.key)}
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
          </ScrollView>

          {/* Search + filter toggle */}
          <View style={mpStyles.searchRow}>
            <View style={mpStyles.searchBox}>
              <Search size={15} color="#9CA3AF" />
              <TextInput
                style={mpStyles.searchInput}
                placeholder="Search projects by name…"
                placeholderTextColor="#9CA3AF"
                value={mpSearch}
                onChangeText={setMpSearch}
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

          {/* Advanced filter panel — inside header so border falls below table header */}
          {mpShowFilters && (
            <View style={mpStyles.filterPanel}>
              <Text style={mpStyles.filterPanelTitle}>ADVANCED FILTERS</Text>
              <View style={mpStyles.filtersRow}>
                <View style={mpStyles.filterField}>
                  <Text style={mpStyles.filterLabel}>From Date</Text>
                  {Platform.OS === 'web' ? (
                    <input
                      type="date"
                      value={mpDateFrom}
                      onChange={(e: any) => setMpDateFrom(e.target.value)}
                      style={{ border: '1px solid #E5E7EB', borderRadius: 8, padding: '8px 10px', fontSize: 12, color: TEXT, backgroundColor: '#fff', outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' } as any}
                    />
                  ) : (
                    <TextInput style={mpStyles.filterInput} value={mpDateFrom} onChangeText={setMpDateFrom} placeholder="YYYY-MM-DD" placeholderTextColor="#9CA3AF" />
                  )}
                </View>
                <View style={mpStyles.filterField}>
                  <Text style={mpStyles.filterLabel}>To Date</Text>
                  {Platform.OS === 'web' ? (
                    <input
                      type="date"
                      value={mpDateTo}
                      onChange={(e: any) => setMpDateTo(e.target.value)}
                      style={{ border: '1px solid #E5E7EB', borderRadius: 8, padding: '8px 10px', fontSize: 12, color: TEXT, backgroundColor: '#fff', outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' } as any}
                    />
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

        {/* Project cards */}
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40, gap: 12 }} showsVerticalScrollIndicator={false}>
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
                  <View style={mpStyles.ctaIconWrap}>
                    <ClipboardList size={32} color={BRAND} />
                  </View>
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
            sortedDisplayed.map(p => {
              const canView = isQuoteStatus(p.status);
              const cost = p.totalCost && parseFloat(p.totalCost) > 0 ? `$${parseFloat(p.totalCost).toFixed(2)}` : null;
              const pcs = p.lineItemCount > 0 ? p.lineItemCount : null;
              return (
                <View key={p.id} style={pcStyles.card}>
                  {/* Top: project name + status badge */}
                  <View style={pcStyles.cardTop}>
                    <Text style={pcStyles.projectName} numberOfLines={1}>{p.title}</Text>
                    <StatusPill status={p.status} />
                  </View>

                  {/* Meta row */}
                  <View style={pcStyles.metaRow}>
                    <View style={pcStyles.metaItem}>
                      <Text style={pcStyles.metaLabel}>SUBMITTED</Text>
                      <Text style={pcStyles.metaValue}>{formatDate(p.createdAt)}</Text>
                    </View>
                    <View style={pcStyles.metaDivider} />
                    <View style={pcStyles.metaItem}>
                      <Text style={pcStyles.metaLabel}>IN HANDS</Text>
                      <Text style={pcStyles.metaValue}>{p.inHandsDate ? formatDate(p.inHandsDate) : '—'}</Text>
                    </View>
                    <View style={pcStyles.metaDivider} />
                    <View style={pcStyles.metaItem}>
                      <Text style={pcStyles.metaLabel}>TOTAL PCS</Text>
                      <Text style={pcStyles.metaValue}>{pcs ?? '—'}</Text>
                    </View>
                    <View style={pcStyles.metaDivider} />
                    <View style={pcStyles.metaItem}>
                      <Text style={pcStyles.metaLabel}>VALUE</Text>
                      <Text style={[pcStyles.metaValue, cost ? { color: BRAND, fontWeight: '700' } : {}]}>{cost ?? '—'}</Text>
                    </View>
                  </View>

                  {/* Pipeline timeline */}
                  <ProjectPipeline status={p.status} />

                  {/* Footer */}
                  <View style={pcStyles.cardFooter}>
                    {canView ? (
                      <TouchableOpacity style={pcStyles.viewBtn} onPress={() => handleViewProject(p.id)} activeOpacity={0.85}>
                        <Text style={pcStyles.viewBtnText}>View Project →</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={pcStyles.pendingBadge}>
                        <Text style={pcStyles.pendingBadgeText}>Pending Quote</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })
          )}

          {sortedDisplayed.length > 0 && (
            <Text style={mpStyles.resultCount}>
              {sortedDisplayed.length} project{sortedDisplayed.length !== 1 ? 's' : ''}
              {orgProjects.length !== sortedDisplayed.length ? ` of ${orgProjects.length}` : ''}
            </Text>
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

    const SIZE_LABELS = [
      { key: 'xs', label: 'XS' }, { key: 's', label: 'SM' },
      { key: 'm', label: 'MD' }, { key: 'l', label: 'LG' },
      { key: 'xl', label: 'XL' }, { key: 'xxl', label: '2XL' },
      { key: 'xxxl', label: '3XL' }, { key: 'xxxxl', label: '4XL' },
    ];

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
          <Text style={{ fontSize: 13, color: TEXT_LIGHT }}>/ Quote Details</Text>
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

              {/* Status + title card */}
              <View style={pvStyles.card}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <StatusPill status={proj.status} />
                  {proj.orderType ? (
                    <View style={{ backgroundColor: '#F3F4F6', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: TEXT_LIGHT }}>{proj.orderType}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={pvStyles.projectTitle}>{proj.title || 'Untitled Project'}</Text>
                <ProjectPipeline status={proj.status} />
              </View>

              {/* Order info card */}
              <View style={pvStyles.card}>
                <View style={{ flexDirection: 'row', gap: 24 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={pvStyles.metaLabel}>ORDER DATE</Text>
                    <Text style={pvStyles.metaValue}>{proj.orderDate ? proj.orderDate : '—'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={pvStyles.metaLabel}>IN-HANDS DATE</Text>
                    <Text style={pvStyles.metaValue}>{proj.inHandsDate ? formatDate(proj.inHandsDate) : '—'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={pvStyles.metaLabel}>SUBMITTED</Text>
                    <Text style={pvStyles.metaValue}>{formatDate(proj.createdAt)}</Text>
                  </View>
                </View>
                {proj.notesClient ? (
                  <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: BORDER }}>
                    <Text style={pvStyles.metaLabel}>NOTES</Text>
                    <Text style={{ fontSize: 13, color: TEXT, marginTop: 4, lineHeight: 20 }}>{proj.notesClient}</Text>
                  </View>
                ) : null}
              </View>

              {/* Line Items */}
              <View style={pvStyles.card}>
                <Text style={pvStyles.sectionTitle}>Line Items ({lineItems.length})</Text>

                {lineItems.length === 0 ? (
                  <Text style={{ color: TEXT_LIGHT, fontSize: 13, marginTop: 8 }}>No line items yet.</Text>
                ) : (
                  lineItems.map((li: any, idx: number) => {
                    const sizes = li.sizes ?? {};
                    const qty = Object.values(sizes).reduce((a: number, v: any) => a + (Number(v) || 0), 0);
                    const activeSizes = SIZE_LABELS.filter(s => (sizes[s.key] || 0) > 0);
                    return (
                      <View key={li.id || idx} style={[pvStyles.lineItemBlock, idx > 0 && { marginTop: 20, paddingTop: 20, borderTopWidth: 1, borderTopColor: BORDER }]}>
                        {/* Item header */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <View style={{ backgroundColor: BRAND, width: 22, height: 22, borderRadius: 4, alignItems: 'center', justifyContent: 'center' }}>
                              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>#{idx + 1}</Text>
                            </View>
                            <Text style={pvStyles.lineItemName}>{li.designName || `Item ${idx + 1}`}</Text>
                          </View>
                          <View style={{ backgroundColor: '#FFF4EE', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 4 }}>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: BRAND }}>{qty} pcs</Text>
                          </View>
                        </View>

                        {/* Item details grid */}
                        <View style={{ flexDirection: 'row', gap: 16, marginBottom: 14 }}>
                          <View style={{ flex: 1, gap: 8 }}>
                            {li.serviceStyle ? (
                              <View style={pvStyles.detailRow}>
                                <Layers size={13} color={TEXT_LIGHT} />
                                <Text style={pvStyles.detailLabel}>Service</Text>
                                <Text style={pvStyles.detailValue}>{li.serviceStyle}</Text>
                              </View>
                            ) : null}
                            {li.applicator ? (
                              <View style={pvStyles.detailRow}>
                                <User size={13} color={TEXT_LIGHT} />
                                <Text style={pvStyles.detailLabel}>Applicator</Text>
                                <Text style={[pvStyles.detailValue, { color: BRAND }]}>{li.applicator}</Text>
                              </View>
                            ) : null}
                            {li.apparelProvider ? (
                              <View style={pvStyles.detailRow}>
                                <Package size={13} color={TEXT_LIGHT} />
                                <Text style={pvStyles.detailLabel}>Source</Text>
                                <Text style={pvStyles.detailValue}>{li.apparelProvider}</Text>
                              </View>
                            ) : null}
                          </View>
                          <View style={{ flex: 1, gap: 8 }}>
                            {(li.product || li.productColor) ? (
                              <View style={pvStyles.detailRow}>
                                <Tag size={13} color={TEXT_LIGHT} />
                                <Text style={pvStyles.detailLabel}>Product</Text>
                                <Text style={pvStyles.detailValue} numberOfLines={1}>
                                  {[li.product, li.productColor].filter(Boolean).join(' — ')}
                                </Text>
                              </View>
                            ) : null}
                            {(li.location1 || li.location2) ? (
                              <View style={pvStyles.detailRow}>
                                <MapPin size={13} color={TEXT_LIGHT} />
                                <Text style={pvStyles.detailLabel}>Locations</Text>
                                <Text style={pvStyles.detailValue} numberOfLines={1}>
                                  {[li.location1, li.location2, li.location3, li.location4].filter(Boolean).join(', ')}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                        </View>

                        {/* Sizes + quantities */}
                        {activeSizes.length > 0 ? (
                          <View style={{ marginBottom: 14 }}>
                            <Text style={[pvStyles.metaLabel, { marginBottom: 8 }]}>SIZES + QUANTITIES</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                              {activeSizes.map(s => (
                                <View key={s.key} style={pvStyles.sizeBox}>
                                  <Text style={pvStyles.sizeLabel}>{s.label}</Text>
                                  <Text style={pvStyles.sizeQty}>{sizes[s.key]}</Text>
                                </View>
                              ))}
                            </View>
                            <Text style={{ fontSize: 12, color: TEXT_LIGHT, textAlign: 'right', marginTop: 6 }}>
                              Total: {qty} pcs
                            </Text>
                          </View>
                        ) : null}

                        {/* Per-piece costs */}
                        <View style={pvStyles.costRow}>
                          <View style={pvStyles.costCell}>
                            <Text style={pvStyles.costLabel}>Product</Text>
                            <Text style={pvStyles.costAmt}>{li.productCostEach > 0 ? `$${Number(li.productCostEach).toFixed(2)}/ea` : '—'}</Text>
                          </View>
                          <View style={pvStyles.costCell}>
                            <Text style={pvStyles.costLabel}>Service</Text>
                            <Text style={pvStyles.costAmt}>{li.serviceCostEach > 0 ? `$${Number(li.serviceCostEach).toFixed(2)}/ea` : '—'}</Text>
                          </View>
                          <View style={pvStyles.costCell}>
                            <Text style={pvStyles.costLabel}>Fees</Text>
                            <Text style={pvStyles.costAmt}>{li.serviceFeeEach > 0 ? `$${Number(li.serviceFeeEach).toFixed(2)}/ea` : '—'}</Text>
                          </View>
                          <View style={pvStyles.costCell}>
                            <Text style={pvStyles.costLabel}>Markup</Text>
                            <Text style={pvStyles.costAmt}>{li.markupEach > 0 ? `$${Number(li.markupEach).toFixed(2)}/ea` : '—'}</Text>
                          </View>
                        </View>
                      </View>
                    );
                  })
                )}

                {/* Footer summary bar */}
                {lineItems.length > 0 && (
                  <View style={pvStyles.lineItemFooter}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>
                      {lineItems.length} Line Item{lineItems.length !== 1 ? 's' : ''} • {totalQty} Total Items
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Right / Pricing column */}
            <View style={{ width: 260, gap: 16 }}>
              <View style={pvStyles.card}>
                <Text style={pvStyles.sectionTitle}>Pricing Summary</Text>

                <View style={{ marginTop: 14 }}>
                  {/* Column headers */}
                  <View style={pvStyles.priceHeaderRow}>
                    <Text style={{ flex: 1 }} />
                    <Text style={pvStyles.priceColHeader}>EACH</Text>
                    <Text style={pvStyles.priceColHeader}>TOTAL</Text>
                  </View>

                  <View style={pvStyles.priceDivider} />

                  <View style={pvStyles.priceRow}>
                    <Text style={pvStyles.priceRowLabel}>Product Cost</Text>
                    <Text style={pvStyles.priceRowVal}>{fmt(calc?.productCostEach)}</Text>
                    <Text style={pvStyles.priceRowVal}>{fmt(calc?.productCostTotal)}</Text>
                  </View>
                  <View style={pvStyles.priceRow}>
                    <Text style={pvStyles.priceRowLabel}>Service Cost</Text>
                    <Text style={pvStyles.priceRowVal}>{fmt(calc?.serviceCostEach)}</Text>
                    <Text style={pvStyles.priceRowVal}>{fmt(calc?.serviceCostTotal)}</Text>
                  </View>
                  <View style={pvStyles.priceRow}>
                    <Text style={pvStyles.priceRowLabel}>Service Fees</Text>
                    <Text style={pvStyles.priceRowVal}>{fmt(calc?.serviceFeeEach)}</Text>
                    <Text style={pvStyles.priceRowVal}>{fmt(calc?.serviceFeeTotal)}</Text>
                  </View>

                  <View style={pvStyles.priceDivider} />

                  <View style={pvStyles.priceRow}>
                    <Text style={[pvStyles.priceRowLabel, { fontWeight: '700', color: TEXT }]}>Cost of Goods</Text>
                    <Text style={[pvStyles.priceRowVal, { fontWeight: '700' }]}>{fmt(calc?.cogEach)}</Text>
                    <Text style={[pvStyles.priceRowVal, { fontWeight: '700' }]}>{fmt(calc?.cogTotal)}</Text>
                  </View>
                  {calc?.markupAmount > 0 ? (
                    <View style={pvStyles.priceRow}>
                      <Text style={[pvStyles.priceRowLabel, { color: BRAND, fontWeight: '600' }]}>
                        Markup {calc?.markupPercentage > 0 ? `(${calc.markupPercentage.toFixed(1)}%)` : ''}
                      </Text>
                      <Text style={[pvStyles.priceRowVal, { color: BRAND, fontWeight: '600' }]}>—</Text>
                      <Text style={[pvStyles.priceRowVal, { color: BRAND, fontWeight: '600' }]}>{fmt(calc?.markupAmount)}</Text>
                    </View>
                  ) : null}

                  <View style={pvStyles.priceDivider} />

                  <View style={pvStyles.priceRow}>
                    <Text style={[pvStyles.priceRowLabel, { fontWeight: '700', color: TEXT }]}>Subtotal</Text>
                    <Text style={[pvStyles.priceRowVal, { fontWeight: '700' }]}>{fmt(calc?.totalPerPiece)}</Text>
                    <Text style={[pvStyles.priceRowVal, { fontWeight: '700' }]}>{fmt(calc?.subtotal)}</Text>
                  </View>
                  {proj.hasOnlineFee && (
                    <View style={pvStyles.priceRow}>
                      <Text style={pvStyles.priceRowLabel}>Online Fee</Text>
                      <Text style={pvStyles.priceRowVal}>{fmt(calc?.onlineFee && calc.totalQuantity > 0 ? calc.onlineFee / calc.totalQuantity : null)}</Text>
                      <Text style={pvStyles.priceRowVal}>{fmt(calc?.onlineFee)}</Text>
                    </View>
                  )}
                  {proj.hasCardFee && (
                    <View style={pvStyles.priceRow}>
                      <Text style={pvStyles.priceRowLabel}>Card Fee (3.75%)</Text>
                      <Text style={pvStyles.priceRowVal}>{fmt(calc?.cardFee && calc.totalQuantity > 0 ? calc.cardFee / calc.totalQuantity : null)}</Text>
                      <Text style={pvStyles.priceRowVal}>{fmt(calc?.cardFee)}</Text>
                    </View>
                  )}
                </View>

                {/* Total block */}
                <View style={pvStyles.totalBlock}>
                  <Text style={pvStyles.totalLabel}>TOTAL</Text>
                  <Text style={pvStyles.totalAmt}>
                    {calc?.total > 0
                      ? `$${Number(calc.total).toFixed(2)}`
                      : 'Pending Review'}
                  </Text>
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

    const renderFileCard = (file: MediaFile) => (
      <View key={file.id} style={mbStyles.fileCard}>
        <View style={mbStyles.filePreview}>
          {isImageMime(file.mimeType) ? (
            <Image source={{ uri: `/api/files/${file.id}?inline=true` }} style={mbStyles.previewImage} resizeMode="cover" />
          ) : (
            <View style={mbStyles.fileTypeBox}>
              <Text style={mbStyles.fileTypeLabel}>{getMimeLabel(file.mimeType, file.originalName)}</Text>
            </View>
          )}
        </View>
        <View style={mbStyles.fileMeta}>
          <Text style={mbStyles.fileName} numberOfLines={1}>{file.originalName}</Text>
          <Text style={mbStyles.fileSize}>{formatBytes(file.fileSize)} · {formatDate(file.createdAt)}</Text>
        </View>
        <View style={mbStyles.fileActions}>
          <TouchableOpacity style={mbStyles.fileActionBtn} onPress={() => { if (Platform.OS === 'web') { const a = document.createElement('a'); a.href = `/api/files/${file.id}`; a.download = file.originalName; a.click(); } }}>
            <Download size={14} color={TEXT_LIGHT} />
          </TouchableOpacity>
          <TouchableOpacity style={[mbStyles.fileActionBtn, { borderColor: '#FECACA', backgroundColor: '#FEF2F2' }]} onPress={() => deleteMediaBinFile(file.id)}>
            <Trash2 size={14} color="#DC2626" />
          </TouchableOpacity>
        </View>
      </View>
    );

    return (
      <ScrollView contentContainerStyle={dash.viewContent} showsVerticalScrollIndicator={false}>
        <View style={dash.pageTitleRow}>
          <Text style={dash.pageTitle}>Media Bin</Text>
          <TouchableOpacity style={mbStyles.uploadBtn} onPress={() => mediaBinInputRef.current?.click?.()} disabled={mediaBinUploading}>
            {mediaBinUploading
              ? <ActivityIndicator size="small" color="#fff" />
              : <><Upload size={14} color="#fff" /><Text style={mbStyles.uploadBtnText}>Upload Files</Text></>
            }
          </TouchableOpacity>
        </View>
        {Platform.OS === 'web' && (
          <input ref={mediaBinInputRef} type="file" accept=".ai,.svg,.png,.jpg,.jpeg,.pdf" multiple style={{ display: 'none' }}
            onChange={(e: any) => { const files = Array.from((e.target.files || []) as globalThis.File[]); if (files.length > 0) handleMediaBinUpload(files); e.target.value = ''; }}
          />
        )}
        <View ref={mediaBinDropRef} style={mbStyles.dropZone}>
          <Upload size={18} color="#9CA3AF" />
          <Text style={mbStyles.dropZoneText}>Drop files here to upload  ·  AI, SVG, PNG, JPG, PDF</Text>
        </View>

        {/* Search */}
        <View style={mbStyles.searchRow}>
          <Search size={14} color={TEXT_PLACEHOLDER} style={{ marginRight: 8 }} />
          <TextInput style={mbStyles.searchInput} placeholder="Search files…" placeholderTextColor={TEXT_PLACEHOLDER} value={mediaBinSearch} onChangeText={setMediaBinSearch} />
          {mediaBinSearch.length > 0 && (
            <TouchableOpacity onPress={() => setMediaBinSearch('')} style={{ padding: 4 }}><X size={14} color={TEXT_LIGHT} /></TouchableOpacity>
          )}
        </View>

        {/* Filter chips + Sort + View toggle */}
        <View style={mbStyles.controlBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {MB_FILTER_CHIPS.map(chip => (
                <TouchableOpacity key={chip} style={[mbStyles.filterChip, mediaBinFilter === chip && mbStyles.filterChipActive]} onPress={() => setMediaBinFilter(chip)} activeOpacity={0.8}>
                  <Text style={[mbStyles.filterChipText, mediaBinFilter === chip && mbStyles.filterChipTextActive]}>{chip}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          <View style={mbStyles.controlRight}>
            {MB_SORT_OPTIONS.map(s => (
              <TouchableOpacity key={s} style={[mbStyles.sortBtn, mediaBinSort === s && mbStyles.sortBtnActive]} onPress={() => setMediaBinSort(s)} activeOpacity={0.8}>
                <Text style={[mbStyles.sortBtnText, mediaBinSort === s && mbStyles.sortBtnTextActive]}>{s}</Text>
              </TouchableOpacity>
            ))}
            <View style={mbStyles.viewToggle}>
              <TouchableOpacity style={[mbStyles.viewToggleBtn, mediaBinViewMode === 'grid' && mbStyles.viewToggleBtnActive]} onPress={() => setMediaBinViewMode('grid')}>
                <Grid2x2 size={14} color={mediaBinViewMode === 'grid' ? BRAND : TEXT_LIGHT} />
              </TouchableOpacity>
              <TouchableOpacity style={[mbStyles.viewToggleBtn, mediaBinViewMode === 'list' && mbStyles.viewToggleBtnActive]} onPress={() => setMediaBinViewMode('list')}>
                <List size={14} color={mediaBinViewMode === 'list' ? BRAND : TEXT_LIGHT} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {mediaBinLoading ? (
          <ActivityIndicator size="large" color={BRAND} style={{ marginTop: 32 }} />
        ) : filtered.length === 0 && (mediaBinSearch || mediaBinFilter !== 'All') ? (
          <EmptyState icon={<Search size={32} color="#D1D5DB" />} title="No matching files" sub="Try a different search or filter." />
        ) : mediaBinFiles.length === 0 ? (
          <EmptyState icon={<Layers size={40} color="#D1D5DB" />} title="No files in your Media Bin" sub="Upload reusable artwork and design files here. They'll be available for your team and future projects." />
        ) : mediaBinViewMode === 'grid' ? (
          <View style={mbStyles.visualGrid}>
            {filtered.map(file => (
              <View key={file.id} style={mbStyles.visualCard}>
                <View style={mbStyles.visualThumb}>
                  {isImageMime(file.mimeType) ? (
                    <Image source={{ uri: `/api/files/${file.id}?inline=true` }} style={mbStyles.visualThumbImg} resizeMode="cover" />
                  ) : (
                    <View style={mbStyles.visualThumbPlaceholder}>
                      <Text style={mbStyles.visualThumbLabel}>{getMimeLabel(file.mimeType, file.originalName)}</Text>
                    </View>
                  )}
                  <View style={mbStyles.visualThumbActions}>
                    <TouchableOpacity style={mbStyles.visualThumbBtn} onPress={() => { if (Platform.OS === 'web') { const a = document.createElement('a'); a.href = `/api/files/${file.id}`; a.download = file.originalName; a.click(); } }}>
                      <Download size={13} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity style={[mbStyles.visualThumbBtn, { backgroundColor: 'rgba(220,38,38,0.8)' }]} onPress={() => deleteMediaBinFile(file.id)}>
                      <Trash2 size={13} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={mbStyles.visualMeta}>
                  <Text style={mbStyles.visualFileName} numberOfLines={1}>{file.originalName}</Text>
                  <Text style={mbStyles.visualFileSub}>{formatBytes(file.fileSize)} · {formatDate(file.createdAt)}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={mbStyles.fileGrid}>{filtered.map(renderFileCard)}</View>
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
    const numCols = isMobile ? 1 : isTablet ? 2 : 3;
    const displayed = clientCatalogs.filter(cat => {
      const matchesCat = catFilter === 'All' || cat.category === catFilter;
      const q = catSearch.trim().toLowerCase();
      const matchesSearch = !q || cat.name.toLowerCase().includes(q) || (cat.vendorName || '').toLowerCase().includes(q) || (cat.description || '').toLowerCase().includes(q);
      return matchesCat && matchesSearch;
    });

    const NeedHelpCard = () => (
      <View style={catStyles.needHelpCard}>
        <Text style={catStyles.needHelpTitle}>Need Help?</Text>
        <Text style={catStyles.needHelpSub}>Not finding what you need? We'll help source products and recommend the best options.</Text>
        <View style={catStyles.needHelpDivider} />
        <Text style={catStyles.needHelpContactLabel}>CALL</Text>
        <TouchableOpacity style={catStyles.needHelpPhoneBtn} onPress={() => Linking.openURL('tel:4805599033')} activeOpacity={0.85}>
          <Text style={catStyles.needHelpPhoneText}>(480) 559-9033</Text>
        </TouchableOpacity>
        <Text style={catStyles.needHelpContactLabel}>EMAIL</Text>
        <TouchableOpacity style={catStyles.needHelpEmailBtn} onPress={() => Linking.openURL('mailto:jobs@katalystko.com')} activeOpacity={0.85}>
          <Mail size={13} color={BRAND} />
          <Text style={catStyles.needHelpEmailText}>jobs@katalystko.com</Text>
        </TouchableOpacity>
        <View style={catStyles.needHelpDivider} />
        <TouchableOpacity style={catStyles.needHelpCTABtn} onPress={() => setActiveView('submit')} activeOpacity={0.85}>
          <ClipboardList size={14} color="#fff" />
          <Text style={catStyles.needHelpCTAText}>Submit a Project Request</Text>
        </TouchableOpacity>
      </View>
    );

    return (
      <View style={{ flex: 1, flexDirection: 'row' }}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={dash.viewContent} showsVerticalScrollIndicator={false}>
          {/* Header row */}
          <View style={catStyles.headerRow}>
            <View>
              <Text style={dash.pageTitle}>Product Catalogs</Text>
              <Text style={catStyles.headerSub}>Browse product lines shared by Katalyst Ko</Text>
            </View>
            <TouchableOpacity style={catStyles.requestBtn} onPress={() => setActiveView('submit')} activeOpacity={0.85}>
              <Plus size={14} color="#fff" />
              <Text style={catStyles.requestBtnText}>Request a Product</Text>
            </TouchableOpacity>
          </View>

          {/* Search + filter chips */}
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
                const cardW = numCols === 1 ? '100%' : numCols === 2 ? '48%' : '32%';
                return (
                  <View key={cat.id} style={[catStyles.card, { width: cardW as any, flexGrow: 0, flexShrink: 0 }]}>
                    <View style={catStyles.cardTop}>
                      <View style={[catStyles.avatar, { backgroundColor: color }]}>
                        <Text style={catStyles.avatarText}>{initials}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={catStyles.name}>{cat.vendorName || cat.name}</Text>
                        {cat.vendorName && cat.vendorName !== cat.name ? <Text style={catStyles.vendor}>{cat.name}</Text> : null}
                      </View>
                      <View style={[catStyles.badge, { backgroundColor: color + '18' }]}>
                        <Text style={[catStyles.badgeText, { color }]}>{cat.category}</Text>
                      </View>
                    </View>
                    {cat.description ? <Text style={catStyles.description}>{cat.description}</Text> : null}
                    <View style={catStyles.actions}>
                      <TouchableOpacity style={catStyles.primaryBtn} onPress={() => Linking.openURL(cat.catalogUrl)} activeOpacity={0.85}>
                        <BookOpen size={15} color="#fff" />
                        <Text style={catStyles.primaryBtnText}>Open Catalog</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {isMobile && <NeedHelpCard />}
        </ScrollView>

        {/* Persistent Need Help column (desktop/tablet) */}
        {!isMobile && (
          <View style={catStyles.needHelpColumn}>
            <NeedHelpCard />
          </View>
        )}
      </View>
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
          <View style={svStyles.formRow}>
            <View style={[styles.card, { flex: 1 }]}>
            <Text style={styles.formTitle}>Submit a Project Request</Text>
            <Text style={styles.formSub}>Fill in the details below — your submission will come straight into Ko OS ready for pricing.</Text>

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
              <Text style={pFields.hint}>AI, SVG, PNG, JPG, PDF, DST, EMB · Multiple files supported</Text>
              {Platform.OS === 'web' && (
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".ai,.svg,.png,.jpg,.jpeg,.pdf,.dst,.emb"
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
                <Text style={upStyles.dropZoneSub}>AI · SVG · PNG · JPG · PDF · DST · EMB</Text>
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
            {!isMobile && (
              <View style={svStyles.helperCard}>
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
                  <Mail size={14} color={BRAND} />
                  <Text style={svStyles.helperEmailText}>Email Us</Text>
                </TouchableOpacity>
              </View>
            )}
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
        else { setTeamInviteSuccess(`${teamInviteEmail.trim()} has been added.`); setTeamInviteEmail(''); fetchTeam(session.orgId); }
      } catch { setTeamInviteError('Connection error. Please try again.'); }
      setTeamInviting(false);
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
          const logoUrl = `/api/files/${uploadData.file.id}?inline=true`;
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

    return (
      <ScrollView style={{ flex: 1, backgroundColor: '#F9FAFB' }} contentContainerStyle={{ padding: 28, paddingBottom: 60, maxWidth: 680, alignSelf: 'center', width: '100%' }}>

        {/* Hidden file inputs for web */}
        {Platform.OS === 'web' && (
          <View style={{ height: 0, overflow: 'hidden' }}>
            <input
              ref={profilePicInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleProfilePicFile}
            />
            <input
              ref={orgLogoInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleOrgLogoFile}
            />
          </View>
        )}

        {/* Profile header */}
        <View style={profStyles.section}>
          <View style={profStyles.sectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <User size={16} color={BRAND} />
              <Text style={profStyles.sectionTitle}>My Profile</Text>
            </View>
          </View>

          {/* Centered avatar — matches backend profile card style */}
          <View style={{ alignItems: 'center', paddingBottom: 20 }}>
            <View style={[profStyles.avatarLarge, { backgroundColor: profileAvatarColor }]}>
              {profilePicUri ? (
                <Image source={{ uri: profilePicUri }} style={{ width: 88, height: 88, borderRadius: 10 }} />
              ) : (
                <Text style={profStyles.avatarLargeText}>{session?.userName[0]?.toUpperCase() || '?'}</Text>
              )}
            </View>
            <Text style={[profStyles.userName, { marginTop: 14, textAlign: 'center' }]}>{session?.userName}</Text>
            <Text style={[profStyles.userEmail, { textAlign: 'center', marginBottom: 8 }]}>{session?.userEmail}</Text>
            <View style={profStyles.orgBadge}>
              <Text style={profStyles.orgBadgeText}>{session?.orgName}</Text>
            </View>
          </View>

          {/* Two-column: Profile Picture | Avatar Color */}
          <View style={{ flexDirection: 'row', gap: 16, marginTop: 4 }}>
            {/* Left column: Profile Picture */}
            <View style={{ flex: 1 }}>
              <Text style={profStyles.editLabel}>PROFILE PICTURE</Text>
              <View style={{ gap: 8, marginTop: 8 }}>
                <TouchableOpacity
                  style={profStyles.editBtn}
                  onPress={() => profilePicInputRef.current?.click()}
                  disabled={profileSaving}
                >
                  {profileSaving ? <ActivityIndicator size="small" color={BRAND} /> : <Upload size={13} color={BRAND} />}
                  <Text style={profStyles.editBtnText}>{profilePicUri ? 'Change Photo' : 'Upload Photo'}</Text>
                </TouchableOpacity>
                {profilePicUri && (
                  <TouchableOpacity style={profStyles.editBtnDestructive} onPress={handleRemoveProfilePic} disabled={profileSaving}>
                    <X size={13} color="#DC2626" />
                    <Text style={profStyles.editBtnDestructiveText}>Remove</Text>
                  </TouchableOpacity>
                )}
              </View>
              {profileSaveMsg ? <Text style={profStyles.successText}>{profileSaveMsg}</Text> : null}
            </View>

            {/* Right column: Avatar Color */}
            <View style={{ flex: 1 }}>
              <Text style={profStyles.editLabel}>AVATAR COLOR</Text>
              <View style={[profStyles.colorSwatches, { marginTop: 8 }]}>
                {AVATAR_COLORS.map(c => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => handleAvatarColorChange(c)}
                    style={[
                      profStyles.colorSwatch,
                      { backgroundColor: c },
                      profileAvatarColor === c && profStyles.colorSwatchSelected,
                    ]}
                  >
                    {profileAvatarColor === c && <Check size={12} color="#fff" strokeWidth={3} />}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* Organization Logo (ORG_ADMIN only) */}
        {isOrgAdmin && (
          <View style={profStyles.section}>
            <View style={profStyles.sectionHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ImageIcon size={16} color={BRAND} />
                <Text style={profStyles.sectionTitle}>Organization Logo</Text>
              </View>
            </View>
            <Text style={{ fontSize: 12, color: TEXT_LIGHT, marginBottom: 14 }}>
              Your organization logo appears in the Client Hub sidebar for all team members.
            </Text>
            {orgLogoUrl ? (
              <View style={profStyles.orgLogoPreview}>
                <Image source={{ uri: orgLogoUrl }} style={{ width: 200, height: 80 }} resizeMode="contain" />
              </View>
            ) : (
              <View style={profStyles.orgLogoEmpty}>
                <ImageIcon size={28} color="#D1D5DB" />
                <Text style={{ fontSize: 12, color: TEXT_PLACEHOLDER, marginTop: 6 }}>No logo uploaded</Text>
              </View>
            )}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
              <TouchableOpacity
                style={profStyles.editBtn}
                onPress={() => orgLogoInputRef.current?.click()}
                disabled={orgLogoSaving}
              >
                {orgLogoSaving ? <ActivityIndicator size="small" color={BRAND} /> : <Upload size={13} color={BRAND} />}
                <Text style={profStyles.editBtnText}>{orgLogoUrl ? 'Change Logo' : 'Upload Logo'}</Text>
              </TouchableOpacity>
              {orgLogoUrl && (
                <TouchableOpacity style={profStyles.editBtnDestructive} onPress={handleRemoveOrgLogo} disabled={orgLogoSaving}>
                  <X size={13} color="#DC2626" />
                  <Text style={profStyles.editBtnDestructiveText}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>
            {orgLogoSaveMsg ? <Text style={profStyles.successText}>{orgLogoSaveMsg}</Text> : null}
          </View>
        )}

        {/* My Team */}
        <View style={profStyles.section}>
          <View style={profStyles.sectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Shield size={16} color={BRAND} />
              <Text style={profStyles.sectionTitle}>My Team</Text>
            </View>
            <Text style={profStyles.memberCount}>{teamMembers.length} member{teamMembers.length !== 1 ? 's' : ''}</Text>
          </View>

          {isOrgAdmin && (
            <View style={profStyles.inviteRow}>
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
                style={[profStyles.inviteBtn, (teamInviting || !teamInviteEmail.trim()) && profStyles.inviteBtnDisabled]}
                onPress={handleInvite}
                disabled={teamInviting || !teamInviteEmail.trim()}
              >
                {teamInviting ? <ActivityIndicator size="small" color="#fff" /> : (
                  <>
                    <UserPlus size={14} color="#fff" />
                    <Text style={profStyles.inviteBtnText}>Add</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
          {teamInviteError ? <Text style={profStyles.errorText}>{teamInviteError}</Text> : null}
          {teamInviteSuccess ? <Text style={profStyles.successText}>{teamInviteSuccess}</Text> : null}

          {teamLoading ? (
            <ActivityIndicator color={BRAND} style={{ marginTop: 20 }} />
          ) : teamMembers.length === 0 ? (
            <View style={profStyles.emptyTeam}>
              <Text style={profStyles.emptyTeamText}>No team members found.</Text>
            </View>
          ) : (
            <View style={profStyles.memberList}>
              {teamMembers.map((m, idx) => (
                <View key={m.id} style={[profStyles.memberRow, idx % 2 === 1 && profStyles.memberRowAlt]}>
                  <View style={profStyles.memberAvatar}>
                    <Text style={profStyles.memberAvatarText}>{(m.name || m.email)[0]?.toUpperCase() || '?'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={profStyles.memberName}>{m.name || m.email}</Text>
                    <Text style={profStyles.memberEmail}>{m.email}</Text>
                  </View>
                  <View style={profStyles.memberMeta}>
                    <View style={[profStyles.rolePill, m.role === 'ORG_ADMIN' && profStyles.rolePillAdmin]}>
                      <Text style={[profStyles.rolePillText, m.role === 'ORG_ADMIN' && profStyles.rolePillTextAdmin]}>
                        {ROLE_LABELS[m.role] || m.role}
                      </Text>
                    </View>
                    {m.status === 'INVITED' && (
                      <View style={profStyles.invitedBadge}>
                        <Text style={profStyles.invitedBadgeText}>Invited</Text>
                      </View>
                    )}
                  </View>
                  {isOrgAdmin && m.id !== session?.userId && (
                    <TouchableOpacity style={profStyles.removeBtn} onPress={() => handleRemove(m.id)}>
                      <UserMinus size={14} color="#DC2626" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Sign Out */}
        <TouchableOpacity
          style={profStyles.signOutBlock}
          onPress={handleSignOut}
          activeOpacity={0.8}
        >
          <LogOut size={16} color="#DC2626" />
          <Text style={profStyles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

      </ScrollView>
    );
  };

  const BinPickerModal = () => {
    const filtered = binPickerSearch.trim()
      ? mediaBinFiles.filter(f => f.originalName.toLowerCase().includes(binPickerSearch.toLowerCase()))
      : mediaBinFiles;
    return (
      <Modal visible={binPickerVisible} transparent animationType="fade" onRequestClose={() => setBinPickerVisible(false)}>
        <Pressable style={binPickStyles.overlay} onPress={() => setBinPickerVisible(false)}>
          <Pressable style={binPickStyles.sheet} onPress={() => {}}>
            <View style={binPickStyles.header}>
              <Text style={binPickStyles.title}>Choose from Media Bin</Text>
              <TouchableOpacity onPress={() => setBinPickerVisible(false)}>
                <X size={18} color={TEXT_LIGHT} />
              </TouchableOpacity>
            </View>
            <View style={binPickStyles.searchRow}>
              <Search size={14} color={TEXT_PLACEHOLDER} />
              <TextInput
                style={binPickStyles.searchInput}
                value={binPickerSearch}
                onChangeText={setBinPickerSearch}
                placeholder="Search files…"
                placeholderTextColor={TEXT_PLACEHOLDER}
              />
            </View>
            <ScrollView style={{ maxHeight: 360 }}>
              {mediaBinLoading ? (
                <ActivityIndicator color={BRAND} style={{ margin: 24 }} />
              ) : filtered.length === 0 ? (
                <View style={{ padding: 24, alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, color: TEXT_LIGHT }}>
                    {mediaBinFiles.length === 0 ? 'No files in your Media Bin yet.' : 'No matching files.'}
                  </Text>
                </View>
              ) : (
                filtered.map((f, idx) => (
                  <TouchableOpacity
                    key={f.id}
                    style={[binPickStyles.fileRow, idx % 2 === 1 && binPickStyles.fileRowAlt]}
                    onPress={() => handleBinPickerSelect(f)}
                    activeOpacity={0.75}
                  >
                    <Library size={15} color={BRAND} style={{ flexShrink: 0 }} />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={binPickStyles.fileName} numberOfLines={1}>{f.originalName}</Text>
                      {f.fileSize && <Text style={binPickStyles.fileMeta}>{f.fileSize < 1048576 ? `${(f.fileSize / 1024).toFixed(0)} KB` : `${(f.fileSize / 1048576).toFixed(1)} MB`}</Text>}
                    </View>
                    <Check size={14} color={BRAND} style={{ opacity: 0 }} />
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    );
  };

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
                <TouchableOpacity
                  style={[dash.userRow, sidebarCollapsed && { justifyContent: 'center' }]}
                  onPress={() => { setActiveView('profile'); fetchTeam(session.orgId); }}
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
                    <View style={{ flex: 1 }}>
                      <Text style={dash.userName} numberOfLines={1}>{session.userName}</Text>
                      <Text style={dash.userOrg} numberOfLines={1}>{session.orgName}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}

          {/* Mobile: Top bar */}
          {isMobile && (
            <View style={dash.mobileTopBar}>
              <View style={dash.mobileTopBarLeft}>
                {logoSrc ? (
                  <Image source={{ uri: logoSrc }} style={dash.mobileTopLogo} resizeMode="contain" />
                ) : (
                  <Text style={dash.mobileTopOrgName} numberOfLines={1}>{displayName.toUpperCase()}</Text>
                )}
              </View>
              <TouchableOpacity onPress={handleSignOut} style={dash.signOutBtn}>
                <LogOut size={18} color="#9CA3AF" />
              </TouchableOpacity>
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

          {/* Mobile: Bottom tab bar */}
          {isMobile && (
            <View style={dash.mobileBottomBar}>
              {NAV_ITEMS.map(({ id, label, Icon }) => {
                const isActive = activeView === id;
                const shortLabel = id === 'submit' ? 'Submit' : id === 'projects' ? 'Projects' : id === 'artwork' ? 'Media' : id === 'catalogs' ? 'Catalogs' : label;
                return (
                  <TouchableOpacity
                    key={id}
                    style={dash.mobileNavItem}
                    onPress={() => {
                      setActiveView(id);
                      if (id === 'artwork' && session) fetchMediaBin(session.orgId);
                    }}
                    activeOpacity={0.7}
                  >
                    <Icon size={20} color={isActive ? BRAND : '#9CA3AF'} />
                    <Text style={[dash.mobileNavLabel, isActive && dash.mobileNavLabelActive]}>{shortLabel}</Text>
                  </TouchableOpacity>
                );
              })}
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

const dash = StyleSheet.create({
  layout: { flex: 1, flexDirection: 'row', backgroundColor: '#F3F4F6', ...Platform.select({ web: { minHeight: '100vh' as any } as any, default: {} }) },
  layoutMobile: { flexDirection: 'column' },

  // Mobile top bar
  mobileTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: SIDEBAR_BG,
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...Platform.select({ web: { position: 'sticky' as any, top: 0, zIndex: 10 } as any, default: {} }),
  },
  mobileTopBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mobileTopLogo: { width: 100, height: 28 },
  mobileTopOrgName: { color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 1.2 },

  // Mobile bottom tab bar
  mobileBottomBar: {
    flexDirection: 'row',
    backgroundColor: SIDEBAR_BG,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    ...Platform.select({ web: { position: 'sticky' as any, bottom: 0, zIndex: 10 } as any, default: {} }),
  },
  mobileNavItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 3,
  },
  mobileNavLabel: {
    fontSize: 9,
    fontWeight: '500',
    color: '#9CA3AF',
  },
  mobileNavLabelActive: {
    color: BRAND,
    fontWeight: '700',
  },

  // Main content: add bottom padding on mobile for the tab bar
  mainMobile: {
    paddingBottom: 0,
  },

  sidebar: {
    backgroundColor: SIDEBAR_BG,
    flexDirection: 'column',
    overflow: 'hidden' as any,
    ...Platform.select({ web: { position: 'sticky' as any, top: 0, height: '100vh' as any }, default: {} }),
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
  signOutBtn: { padding: 6 },

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
    borderWidth: 1, borderColor: '#E5E7EB', borderStyle: 'dashed',
    borderRadius: 10, paddingVertical: 14, paddingHorizontal: 16,
    backgroundColor: '#FAFAFA', marginBottom: 12,
  },
  dropZoneText: { fontSize: 12, color: TEXT_LIGHT },
  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
    marginBottom: 16, gap: 6,
  },
  searchInput: { flex: 1, fontSize: 13, color: TEXT },
  visualGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 3,
  },
  visualCard: {
    width: 'calc(38% - 3px)' as any,
    backgroundColor: '#fff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 2, elevation: 1,
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
    padding: 5, gap: 1,
  },
  visualFileName: {
    fontSize: 10, fontWeight: '600', color: TEXT, lineHeight: 14,
  },
  visualFileSub: {
    fontSize: 9, color: TEXT_LIGHT,
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
  viewToggleBtn: { padding: 7, backgroundColor: BG },
  viewToggleBtnActive: { backgroundColor: '#FFF4EE' },
});

const catStyles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 12,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { fontSize: 13, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  name: { fontSize: 15, fontWeight: '700', color: TEXT },
  vendor: { fontSize: 12, color: TEXT_LIGHT, marginTop: 1 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  description: { fontSize: 13, color: TEXT_LIGHT, lineHeight: 19 },
  actions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  primaryBtn: {
    flex: 1,
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
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BRAND,
  },
  secondaryBtnText: { fontSize: 13, fontWeight: '600', color: BRAND },
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
    width: 260, flexShrink: 0, padding: 16,
    ...Platform.select({ web: { position: 'sticky' as any, top: 0, height: '100vh' as any, overflowY: 'auto' as any } as any, default: {} }),
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
  needHelpEmailBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    borderWidth: 1, borderColor: BRAND, borderRadius: 8, paddingVertical: 8,
    backgroundColor: '#FFF4EE',
  },
  needHelpEmailText: { fontSize: 12, fontWeight: '600', color: BRAND },
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
    alignItems: 'baseline',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: TEXT,
  },
  headerCount: {
    fontSize: 14,
    color: TEXT_LIGHT,
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
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: BORDER,
    backgroundColor: BG,
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
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: BG,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: TEXT,
    outlineStyle: 'none',
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

  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#111111',
  },
  thText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  thBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  thTextActive: {
    color: '#FF5A00',
  },

  projectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  projectRowAlt: {
    backgroundColor: '#FAFAFA',
  },
  rowTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT,
    marginBottom: 2,
  },
  rowMeta: {
    fontSize: 12,
    color: TEXT_LIGHT,
  },
  rowCost: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_LIGHT,
  },
  rowCostFilled: {
    color: '#111827',
    fontWeight: '700',
    fontSize: 13,
  },
  viewBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 7,
    backgroundColor: BRAND,
  },
  viewBtnText: {
    fontSize: 12,
    fontWeight: '700',
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
    paddingHorizontal: 14, paddingVertical: 8,
  },
  startProjectBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  ctaCard: {
    alignItems: 'center', backgroundColor: '#fff', borderRadius: 16,
    padding: 36, maxWidth: 400, width: '100%',
    borderWidth: 1, borderColor: BORDER,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8,
  },
  ctaIconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#FFF4EE', alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  ctaTitle: { fontSize: 18, fontWeight: '700', color: TEXT, marginBottom: 8, textAlign: 'center' },
  ctaSub: { fontSize: 13, color: TEXT_LIGHT, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  ctaBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: BRAND, borderRadius: 10,
    paddingHorizontal: 24, paddingVertical: 12,
  },
  ctaBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});

const profStyles = StyleSheet.create({
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
  previewDot: {
    width: 8, height: 8, borderRadius: 4, flexShrink: 0,
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
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    paddingHorizontal: 18, paddingVertical: 14,
  },
  catCell: {
    width: '30%', flexGrow: 1,
    alignItems: 'center', gap: 6,
    paddingVertical: 10, paddingHorizontal: 4,
    borderRadius: 10, borderWidth: 1, borderColor: BORDER,
    backgroundColor: BG,
  },
  catAvatar: {
    width: 36, height: 36, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  catAvatarText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  catName: { fontSize: 10, fontWeight: '600', color: TEXT, textAlign: 'center', lineHeight: 13 },

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
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 18, gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
    borderWidth: 1, borderColor: BORDER,
  },
  cardTop: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', gap: 12,
  },
  projectName: {
    flex: 1, fontSize: 17, fontWeight: '700', color: TEXT, lineHeight: 22,
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
    fontSize: 13, fontWeight: '600', color: TEXT,
  },
  cardFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end',
  },
  viewBtn: {
    backgroundColor: BRAND, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8,
  },
  viewBtnText: {
    fontSize: 13, fontWeight: '700', color: '#fff',
  },
  pendingBadge: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8,
    backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: BORDER,
  },
  pendingBadgeText: {
    fontSize: 12, fontWeight: '600', color: TEXT_LIGHT,
  },
});

const svStyles = StyleSheet.create({
  formRow: {
    flexDirection: 'row', gap: 20, alignItems: 'flex-start',
    width: '100%',
  },
  helperCard: {
    flexBasis: '28%' as any, flexShrink: 0, flexGrow: 0, minWidth: 200, maxWidth: 320,
    backgroundColor: '#fff', borderRadius: 14, padding: 20, gap: 12,
    borderWidth: 1, borderColor: BORDER,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
    ...Platform.select({ web: { position: 'sticky' as any, top: 20, alignSelf: 'flex-start' as any } }),
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
    borderWidth: 1, borderColor: BRAND, borderRadius: 8, paddingVertical: 9,
    backgroundColor: '#FFF4EE',
  },
  helperEmailText: {
    fontSize: 13, fontWeight: '700', color: BRAND,
  },
});
