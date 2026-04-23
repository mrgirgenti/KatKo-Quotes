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
type ActiveView = 'home' | 'projects' | 'artwork' | 'catalogs' | 'submit';

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
  cellWidth: number;
}

function PortalComboCell({ value, onChangeText, options, placeholder, cellWidth }: PortalComboCellProps) {
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
    <View style={[comboCellStyles.wrapper, { width: cellWidth }]}>
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
}

function PortalLineItemCard({ item, index, canDelete, onChange, onDelete, openDropdown }: PortalLineItemCardProps) {
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

  const addArtworkFiles = useCallback((files: globalThis.File[]) => {
    const newFiles: PendingFile[] = files.map(f => ({
      id: `lf${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: f.name, size: f.size, file: f,
    }));
    upd({ artworkFiles: [...(item.artworkFiles || []), ...newFiles] });
  }, [item, upd]);

  const removeArtworkFile = useCallback((fileId: string) => {
    upd({ artworkFiles: (item.artworkFiles || []).filter(f => f.id !== fileId) });
  }, [item, upd]);

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
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View>
                {/* Header row */}
                <View style={liStyles.sizeHeaderRow}>
                  <View style={{ width: 200, marginHorizontal: 2 }}>
                    <Text style={[liStyles.sizeHeaderText, { textAlign: 'left' }]}>Product</Text>
                  </View>
                  <View style={{ width: 110, marginHorizontal: 2 }}>
                    <Text style={[liStyles.sizeHeaderText, { textAlign: 'left' }]}>Color</Text>
                  </View>
                  {SIZE_KEYS.map(k => (
                    <View key={k} style={[liStyles.sizeCellNum, { marginHorizontal: 2 }]}>
                      <Text style={[liStyles.sizeHeaderText, { textAlign: 'center' }]}>{SIZE_LABELS[k]}</Text>
                    </View>
                  ))}
                  <Text style={[liStyles.sizeCell, liStyles.sizeHeaderText, liStyles.sizeCellTotal]}>Total</Text>
                  <View style={{ width: 28 }} />
                </View>

                {/* Data rows */}
                {item.sizeRows.map(row => (
                  <View key={row.id} style={liStyles.sizeDataRow}>
                    <PortalComboCell
                      value={row.product}
                      onChangeText={v => updRow(row.id, { product: v })}
                      options={PRODUCTS}
                      placeholder="Style / Product"
                      cellWidth={200}
                    />
                    <PortalComboCell
                      value={row.color}
                      onChangeText={v => updRow(row.id, { color: v })}
                      options={PRODUCT_COLORS}
                      placeholder="Color"
                      cellWidth={110}
                    />
                    {SIZE_KEYS.map(k => (
                      <TextInput
                        key={k}
                        style={[liStyles.sizeInput, liStyles.sizeCellNum]}
                        value={row[k] ? String(row[k]) : ''}
                        onChangeText={v => updRow(row.id, { [k]: parseInt(v) || 0 } as any)}
                        placeholder="0"
                        placeholderTextColor={TEXT_PLACEHOLDER}
                        keyboardType="number-pad"
                      />
                    ))}
                    <Text style={[liStyles.sizeCell, liStyles.sizeCellTotal, { fontWeight: '700', color: TEXT_MED }]}>
                      {rowTotal(row)}
                    </Text>
                    <TouchableOpacity style={liStyles.delRowBtn} onPress={() => delRow(row.id)}>
                      <Trash2 size={12} color="#DC2626" />
                    </TouchableOpacity>
                  </View>
                ))}

                {/* Totals row */}
                {item.sizeRows.length > 1 && (
                  <View style={liStyles.sizeTotalRow}>
                    <View style={{ width: 200, marginHorizontal: 2 }}>
                      <Text style={{ color: TEXT_LIGHT, fontSize: 11 }}>Totals</Text>
                    </View>
                    <View style={{ width: 110, marginHorizontal: 2 }} />
                    {SIZE_KEYS.map(k => (
                      <View key={k} style={[liStyles.sizeCellNum, { marginHorizontal: 2, alignItems: 'center' }]}>
                        <Text style={{ fontWeight: '600', fontSize: 11, color: TEXT_MED, textAlign: 'center' }}>
                          {colTotal(item.sizeRows, k) || ''}
                        </Text>
                      </View>
                    ))}
                    <Text style={[liStyles.sizeCell, liStyles.sizeCellTotal, { fontWeight: '700', fontSize: 12, color: TEXT }]}>
                      {total}
                    </Text>
                    <View style={{ width: 28 }} />
                  </View>
                )}
              </View>
            </ScrollView>

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

          {/* ── Per-Item Artwork Upload ── */}
          <View style={liStyles.artworkSection}>
            <Text style={pFields.label}>Artwork / Reference Files</Text>
            {Platform.OS === 'web' && (
              <input
                ref={liFileInputRef}
                type="file"
                accept=".ai,.svg,.png,.jpg,.jpeg,.pdf,.eps,.psd"
                multiple
                style={{ display: 'none' }}
                onChange={(e: any) => {
                  addArtworkFiles(Array.from((e.target.files || []) as globalThis.File[]));
                  e.target.value = '';
                }}
              />
            )}
            <TouchableOpacity
              style={liStyles.artworkDropZone}
              onPress={() => liFileInputRef.current?.click?.()}
              activeOpacity={0.85}
            >
              <Upload size={16} color="#9CA3AF" />
              <Text style={liStyles.artworkDropText}>Click to attach artwork files</Text>
              <Text style={liStyles.artworkDropSub}>AI · EPS · SVG · PNG · JPG · PDF · PSD</Text>
            </TouchableOpacity>
            {(item.artworkFiles || []).length > 0 && (
              <View style={liStyles.artworkFileList}>
                {(item.artworkFiles || []).map(pf => (
                  <View key={pf.id} style={liStyles.artworkFileRow}>
                    <FileText size={12} color={BRAND} style={{ flexShrink: 0 }} />
                    <Text style={liStyles.artworkFileName} numberOfLines={1}>{pf.name}</Text>
                    <Text style={liStyles.artworkFileSize}>
                      {pf.size < 1048576 ? `${(pf.size / 1024).toFixed(0)} KB` : `${(pf.size / 1048576).toFixed(1)} MB`}
                    </Text>
                    <TouchableOpacity onPress={() => removeArtworkFile(pf.id)} style={{ padding: 4 }}>
                      <X size={13} color={TEXT_LIGHT} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
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
  const { isMobile } = useBreakpoint();

  const [step, setStep] = useState<Step>('email');
  const [session, setSession] = useState<ClientSession | null>(null);

  const [email, setEmail] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState('');

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

  const [mpSearch, setMpSearch] = useState('');
  const [mpStatusFilter, setMpStatusFilter] = useState<string | null>(null);
  const [mpDateFrom, setMpDateFrom] = useState('');
  const [mpDateTo, setMpDateTo] = useState('');
  const [mpCostMin, setMpCostMin] = useState('');
  const [mpCostMax, setMpCostMax] = useState('');
  const [mpShowFilters, setMpShowFilters] = useState(false);

  const fileInputRef = useRef<any>(null);
  const mediaBinInputRef = useRef<any>(null);
  const dropZoneRef = useRef<any>(null);
  const mediaBinDropRef = useRef<any>(null);

  const [activeView, setActiveView] = useState<ActiveView>('home');
  const [orgProjects, setOrgProjects] = useState<PortalProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);

  const [clientCatalogs, setClientCatalogs] = useState<Array<{
    id: string; name: string; description: string | null; vendorName: string | null;
    category: string; catalogUrl: string; websiteUrl: string | null;
  }>>([]);
  const [catalogsLoading, setCatalogsLoading] = useState(false);

  useEffect(() => {
    if (activeView !== 'catalogs') return;
    setCatalogsLoading(true);
    fetch('/api/client-catalogs')
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
        productCostEach: 0,
        serviceCostEach: 0,
        serviceFeeEach: 0,
        markupEach: 0,
      })),
    };

    try {
      const res = await fetch('/api/portal/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { setSubmitError(data.error || 'Submission failed. Please try again.'); return; }
      const projectId = data.id;
      const allFiles = [
        ...pendingFiles,
        ...lineItems.flatMap(li => li.artworkFiles || []),
      ];
      if (allFiles.length > 0) {
        setUploadingFiles(true);
        for (const pf of allFiles) {
          const fd = new FormData();
          fd.append('file', pf.file);
          fd.append('orgId', session.orgId);
          fd.append('projectId', projectId);
          fd.append('uploadedByUserId', session.userId);
          fd.append('fileType', 'ARTWORK');
          fd.append('visibility', 'CLIENT_VISIBLE');
          await fetch('/api/files', { method: 'POST', body: fd }).catch(() => {});
        }
        setUploadingFiles(false);
        setPendingFiles([]);
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
  }, [session, projectName, orderType, inHandsDate, requestNotes, lineItems, pendingFiles]);

  const handleNewRequest = useCallback(() => {
    setProjectName('');
    setOrderType('New Order');
    setInHandsDate('');
    setRequestNotes('');
    setLineItems([emptyLineItem()]);
    setPendingFiles([]);
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

      <View style={dash.dashGrid}>
        <View style={{ flex: 1.4, minWidth: 260 }}>
          <SectionCard
            title="Active Projects"
            count={activeProjects.length}
            onViewAll={() => setActiveView('projects')}
          >
            {projectsLoading
              ? <ActivityIndicator color={BRAND} style={{ marginVertical: 20 }} />
              : activeProjects.length === 0
                ? <EmptyState icon={<Folder size={22} color="#9CA3AF" />} title="No active projects" sub="Submit a request to get started." />
                : activeProjects.slice(0, 3).map(p => <ProjectCard key={p.id} project={p} />)
            }
          </SectionCard>
        </View>

        <View style={{ flex: 1, minWidth: 220 }}>
          <SectionCard
            title="Quotes & Invoices"
            count={quoteProjects.length}
            onViewAll={() => setActiveView('projects')}
          >
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

          <SectionCard title="Media Bin" onViewAll={() => { setActiveView('artwork'); if (session) fetchMediaBin(session.orgId); }}>
            <EmptyState icon={<Layers size={22} color="#9CA3AF" />} title="No artwork yet" sub="Upload files in the Media Bin section to build your media library." />
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
            <Text style={mpStyles.headerTitle}>My Projects</Text>
            <Text style={mpStyles.headerCount}>{orgProjects.length} project{orgProjects.length !== 1 ? 's' : ''}</Text>
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

          {/* Black table header — inside header so the header border falls below it */}
          <View style={mpStyles.tableHeader}>
            <View style={{ width: 110 }}><Text style={mpStyles.thText}>STATUS</Text></View>
            <View style={{ width: 115 }}><Text style={mpStyles.thText}>ORDER DATE</Text></View>
            <View style={{ width: 105 }}><Text style={mpStyles.thText}>DUE DATE</Text></View>
            <View style={{ flex: 1 }}><Text style={mpStyles.thText}>PROJECT</Text></View>
            <View style={{ width: 62 }}><Text style={mpStyles.thText}># PCS</Text></View>
            <View style={{ width: 90, alignItems: 'flex-end' }}><Text style={mpStyles.thText}>TOTAL</Text></View>
            <View style={{ width: 80, alignItems: 'flex-end' }}><Text style={mpStyles.thText}>ACTIONS</Text></View>
          </View>
        </View>

        {/* Table rows */}
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {projectsLoading ? (
            <ActivityIndicator color={BRAND} style={{ marginTop: 40 }} />
          ) : displayed.length === 0 ? (
            <View style={{ paddingHorizontal: 20, paddingTop: 40 }}>
              <EmptyState
                icon={<ClipboardList size={32} color="#9CA3AF" />}
                title={hasActiveFilters || mpSearch ? 'No matching projects' : 'No projects yet'}
                sub={hasActiveFilters || mpSearch
                  ? 'Try adjusting your search or filters.'
                  : "Use 'Submit a Project' to send your first print request to Katalyst Ko."}
              />
            </View>
          ) : (
            displayed.map((p, idx) => {
              const canView = isQuoteStatus(p.status);
              const cost = p.totalCost && parseFloat(p.totalCost) > 0 ? `$${parseFloat(p.totalCost).toFixed(2)}` : '—';
              return (
                <React.Fragment key={p.id}>
                  <View style={mpStyles.tableRow}>
                    <View style={{ width: 110 }}>
                      <StatusPill status={p.status} />
                    </View>
                    <Text style={[mpStyles.tableDate, { width: 115 }]}>{formatDate(p.createdAt)}</Text>
                    <Text style={[mpStyles.tableDate, { width: 105 }]}>{p.inHandsDate ? formatDate(p.inHandsDate) : '—'}</Text>
                    <Text style={[mpStyles.tableProject, { flex: 1 }]} numberOfLines={1}>{p.title}</Text>
                    <Text style={[mpStyles.tablePcs, { width: 62 }]}>
                      {p.lineItemCount > 0 ? `${p.lineItemCount} pcs` : '—'}
                    </Text>
                    <View style={{ width: 90, alignItems: 'flex-end' }}>
                      <Text style={[mpStyles.tableTotal, cost === '—' && mpStyles.tableTotalEmpty]}>{cost}</Text>
                    </View>
                    <View style={{ width: 80, alignItems: 'flex-end' }}>
                      {canView && (
                        <TouchableOpacity style={mpStyles.viewBtn} onPress={() => setActiveView('submit')}>
                          <Text style={mpStyles.viewBtnText}>View</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                  {idx < displayed.length - 1 && <View style={mpStyles.rowDivider} />}
                </React.Fragment>
              );
            })
          )}

          <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
            <Text style={mpStyles.resultCount}>
              {displayed.length} project{displayed.length !== 1 ? 's' : ''}
              {orgProjects.length !== displayed.length ? ` of ${orgProjects.length}` : ''}
            </Text>
          </View>
        </ScrollView>
      </View>
    );
  };

  const ArtworkView = () => {
    const filtered = mediaBinSearch.trim()
      ? mediaBinFiles.filter(f => f.originalName.toLowerCase().includes(mediaBinSearch.toLowerCase()))
      : mediaBinFiles;
    return (
      <ScrollView contentContainerStyle={dash.viewContent} showsVerticalScrollIndicator={false}>
        <View style={dash.pageTitleRow}>
          <Text style={dash.pageTitle}>Media Bin</Text>
          <TouchableOpacity
            style={mbStyles.uploadBtn}
            onPress={() => mediaBinInputRef.current?.click?.()}
            disabled={mediaBinUploading}
          >
            {mediaBinUploading
              ? <ActivityIndicator size="small" color="#fff" />
              : <><Upload size={14} color="#fff" /><Text style={mbStyles.uploadBtnText}>Upload Files</Text></>
            }
          </TouchableOpacity>
        </View>
        {Platform.OS === 'web' && (
          <input
            ref={mediaBinInputRef}
            type="file"
            accept=".ai,.svg,.png,.jpg,.jpeg,.pdf"
            multiple
            style={{ display: 'none' }}
            onChange={(e: any) => {
              const files = Array.from((e.target.files || []) as globalThis.File[]);
              if (files.length > 0) handleMediaBinUpload(files);
              e.target.value = '';
            }}
          />
        )}
        <View ref={mediaBinDropRef} style={mbStyles.dropZone}>
          <Upload size={18} color="#9CA3AF" />
          <Text style={mbStyles.dropZoneText}>Drop files here to upload  ·  AI, SVG, PNG, JPG, PDF</Text>
        </View>

        <View style={mbStyles.searchRow}>
          <Search size={14} color={TEXT_PLACEHOLDER} style={{ marginRight: 8 }} />
          <TextInput
            style={mbStyles.searchInput}
            placeholder="Search files…"
            placeholderTextColor={TEXT_PLACEHOLDER}
            value={mediaBinSearch}
            onChangeText={setMediaBinSearch}
          />
          {mediaBinSearch.length > 0 && (
            <TouchableOpacity onPress={() => setMediaBinSearch('')} style={{ padding: 4 }}>
              <X size={14} color={TEXT_LIGHT} />
            </TouchableOpacity>
          )}
        </View>

        {mediaBinLoading ? (
          <ActivityIndicator size="large" color={BRAND} style={{ marginTop: 32 }} />
        ) : filtered.length === 0 && mediaBinSearch ? (
          <EmptyState
            icon={<Search size={32} color="#D1D5DB" />}
            title="No matching files"
            sub={`No files found for "${mediaBinSearch}"`}
          />
        ) : mediaBinFiles.length === 0 ? (
          <EmptyState
            icon={<Layers size={40} color="#D1D5DB" />}
            title="No files in your Media Bin"
            sub="Upload reusable artwork and design files here. They'll be available for your team and future projects."
          />
        ) : (
          <View style={mbStyles.visualGrid}>
            {filtered.map(file => (
              <View key={file.id} style={mbStyles.visualCard}>
                <View style={mbStyles.visualThumb}>
                  {isImageMime(file.mimeType) ? (
                    <Image
                      source={{ uri: `/api/files/${file.id}?inline=true` }}
                      style={mbStyles.visualThumbImg}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={mbStyles.visualThumbPlaceholder}>
                      <Text style={mbStyles.visualThumbLabel}>{getMimeLabel(file.mimeType, file.originalName)}</Text>
                    </View>
                  )}
                  <View style={mbStyles.visualThumbActions}>
                    <TouchableOpacity
                      style={mbStyles.visualThumbBtn}
                      onPress={() => {
                        if (Platform.OS === 'web') {
                          const a = document.createElement('a');
                          a.href = `/api/files/${file.id}`;
                          a.download = file.originalName;
                          a.click();
                        }
                      }}
                    >
                      <Download size={13} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[mbStyles.visualThumbBtn, { backgroundColor: 'rgba(220,38,38,0.8)' }]}
                      onPress={() => deleteMediaBinFile(file.id)}
                    >
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
        )}
      </ScrollView>
    );
  };

  const CAT_COLORS: Record<string, string> = {
    Apparel: '#4F46E5', Promotional: '#FF5A00', Accessories: '#0891B2', Signage: '#16A34A', Other: '#6B7280',
  };

  const CatalogsView = () => {
    const numCols = isMobile ? 1 : 3;
    return (
      <ScrollView contentContainerStyle={dash.viewContent} showsVerticalScrollIndicator={false}>
        <Text style={dash.pageTitle}>Product Catalogs</Text>
        <Text style={{ fontSize: 13, color: TEXT_LIGHT, marginBottom: 20, marginTop: -8 }}>Browse product catalogs shared by Katalyst Ko</Text>
        {catalogsLoading ? (
          <View style={{ alignItems: 'center', paddingVertical: 48 }}>
            <ActivityIndicator color={BRAND} />
            <Text style={{ fontSize: 14, color: TEXT_LIGHT, marginTop: 10 }}>Loading catalogs…</Text>
          </View>
        ) : clientCatalogs.length === 0 ? (
          <EmptyState
            icon={<BookOpen size={40} color="#D1D5DB" />}
            title="No catalogs available yet"
            sub="Product catalogs will be shared here by your Katalyst Ko representative."
          />
        ) : (
          <View style={catStyles.grid}>
            {clientCatalogs.map(cat => {
              const color = CAT_COLORS[cat.category] || '#6B7280';
              const initials = (cat.vendorName || cat.name).split(' ').map((w: string) => w[0]).join('').slice(0, 3).toUpperCase();
              return (
                <View key={cat.id} style={[catStyles.card, { flex: 1, minWidth: numCols === 1 ? '100%' : numCols === 2 ? '45%' : '30%' }]}>
                  <View style={catStyles.cardTop}>
                    <View style={[catStyles.avatar, { backgroundColor: color }]}>
                      <Text style={catStyles.avatarText}>{initials}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={catStyles.name}>{cat.name}</Text>
                      {cat.vendorName ? <Text style={catStyles.vendor}>{cat.vendorName}</Text> : null}
                    </View>
                    <View style={[catStyles.badge, { backgroundColor: color + '18' }]}>
                      <Text style={[catStyles.badgeText, { color }]}>{cat.category}</Text>
                    </View>
                  </View>
                  {cat.description ? <Text style={catStyles.description}>{cat.description}</Text> : null}
                  <View style={catStyles.actions}>
                    <TouchableOpacity style={catStyles.primaryBtn} onPress={() => Linking.openURL(cat.catalogUrl)}>
                      <BookOpen size={15} color="#fff" />
                      <Text style={catStyles.primaryBtnText}>Open Catalog</Text>
                    </TouchableOpacity>
                    {cat.websiteUrl ? (
                      <TouchableOpacity style={catStyles.secondaryBtn} onPress={() => Linking.openURL(cat.websiteUrl!)}>
                        <ExternalLink size={14} color={BRAND} />
                        <Text style={catStyles.secondaryBtnText}>Website</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    );
  };

  const SubmitView = () => (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={[dash.viewContent, { alignItems: 'center' }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
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
          <View style={[styles.card, { maxWidth: 940 }]}>
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
              <Text style={pFields.hint}>AI, SVG, PNG, JPG, PDF · Multiple files supported</Text>
              {Platform.OS === 'web' && (
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".ai,.svg,.png,.jpg,.jpeg,.pdf"
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
                <Text style={upStyles.dropZoneSub}>AI · SVG · PNG · JPG · PDF</Text>
              </TouchableOpacity>
              {pendingFiles.length > 0 && (
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
                  <Text style={[styles.btnText, { marginLeft: 8 }]}>Submit Request{pendingFiles.length > 0 ? ` + ${pendingFiles.length} file${pendingFiles.length !== 1 ? 's' : ''}` : ''}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
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
                <TouchableOpacity style={[styles.btn, emailLoading && styles.btnDisabled]} onPress={handleEmailSubmit} disabled={emailLoading}>
                  {emailLoading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.btnText}>Access Portal</Text>}
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
            <View style={dash.sidebar}>
              <View style={dash.sidebarHeader}>
                {logoSrc ? (
                  <Image source={{ uri: logoSrc }} style={sidebarLogoStyle} resizeMode="contain" />
                ) : (
                  <View>
                    <Text style={dash.sidebarLogoText}>{displayName.toUpperCase()}</Text>
                    <Text style={dash.sidebarLogoBrand}>Client Hub by Katalyst Ko Printshop</Text>
                  </View>
                )}
                <Text style={dash.sidebarClientHub}>Client Hub</Text>
              </View>

              <View style={dash.sidebarNav}>
                {NAV_ITEMS.map(({ id, label, Icon }, idx) => {
                  const isActive = activeView === id;
                  const showDivider = idx === 1 || idx === 3 || idx === 4;
                  return (
                    <React.Fragment key={id}>
                      {showDivider && <View style={dash.navDivider} />}
                      <TouchableOpacity
                        style={[dash.navItem, isActive && dash.navItemActive]}
                        onPress={() => {
                          setActiveView(id);
                          if (id === 'artwork' && session) fetchMediaBin(session.orgId);
                        }}
                      >
                        <Icon size={16} color={isActive ? '#fff' : '#9CA3AF'} />
                        <Text style={[dash.navLabel, isActive && dash.navLabelActive]}>{label}</Text>
                      </TouchableOpacity>
                    </React.Fragment>
                  );
                })}
              </View>

              <View style={dash.sidebarFooter}>
                <View style={dash.userRow}>
                  <View style={dash.userAvatar}>
                    <Text style={dash.userAvatarText}>{session.userName[0]?.toUpperCase() || '?'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={dash.userName} numberOfLines={1}>{session.userName}</Text>
                    <Text style={dash.userOrg} numberOfLines={1}>{session.orgName}</Text>
                  </View>
                  <TouchableOpacity onPress={handleSignOut} style={dash.signOutBtn}>
                    <LogOut size={15} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
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
            {activeView === 'home'     && HomeView()}
            {activeView === 'projects' && <MyProjectsView />}
            {activeView === 'artwork'  && <ArtworkView />}
            {activeView === 'catalogs' && <CatalogsView />}
            {activeView === 'submit'   && SubmitView()}
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
  sizeHeaderRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: BORDER, backgroundColor: '#F3F4F6',
  },
  sizeHeaderText: { fontSize: 11, fontWeight: '600', color: TEXT_LIGHT },
  sizeDataRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 3,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  sizeCell: { paddingHorizontal: 4, textAlign: 'center' },
  sizeCellNum: { width: 52, textAlign: 'center' },
  sizeCellTotal: { width: 58, textAlign: 'center' },
  sizeInput: {
    borderWidth: 1, borderColor: '#E9EAEB', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 5, fontSize: 12, color: TEXT,
    backgroundColor: '#fff', marginHorizontal: 2, textAlign: 'center',
  },
  sizeTotalRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 5, borderTopWidth: 1, borderTopColor: BORDER,
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
  formTitle: { fontSize: 18, fontWeight: '700', color: TEXT, marginBottom: 3 },
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
  layout: { flex: 1, flexDirection: 'row', backgroundColor: '#F3F4F6' },
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
    width: 210,
    backgroundColor: SIDEBAR_BG,
    flexDirection: 'column',
    ...Platform.select({ web: { position: 'sticky' as any, top: 0, height: '100vh' as any }, default: {} }),
  },
  sidebarHeader: {
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 18,
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
    paddingHorizontal: 18, paddingTop: 16, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  sectionCardTitle: { fontSize: 14, fontWeight: '700', color: TEXT },
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

  pageTitle: { fontSize: 20, fontWeight: '700', color: TEXT, marginBottom: 20 },

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
    width: 'calc(20% - 3px)' as any,
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

  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  rowDivider: {
    height: 1,
    backgroundColor: BORDER,
    marginHorizontal: 20,
  },
  tableDate: {
    fontSize: 13,
    color: TEXT,
  },
  tableProject: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT,
    paddingRight: 8,
  },
  tablePcs: {
    fontSize: 12,
    color: TEXT,
  },
  tableTotal: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT,
  },
  tableTotalEmpty: {
    color: TEXT_LIGHT,
    fontWeight: '400',
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
});
