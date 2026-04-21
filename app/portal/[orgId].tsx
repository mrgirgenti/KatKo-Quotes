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
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
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

type Step = 'email' | 'form' | 'success';

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

  const total = grandTotal(item.sizeRows);

  return (
    <View style={liStyles.card}>
      <View style={liStyles.cardHeader}>
        <View style={liStyles.cardHeaderLeft}>
          <View style={liStyles.indexBadge}>
            <Text style={liStyles.indexText}>{index + 1}</Text>
          </View>
          <Text style={liStyles.cardTitle}>Line Item {index + 1}</Text>
        </View>
        {canDelete && (
          <TouchableOpacity onPress={onDelete} style={liStyles.deleteBtn}>
            <Trash2 size={16} color="#ff6b6b" />
          </TouchableOpacity>
        )}
      </View>

      <View style={liStyles.cardBody}>
        {/* Design Name */}
        <View style={pFields.container}>
          <Text style={pFields.label}>Design Name <Text style={{ color: BRAND }}>*</Text></Text>
          <TextInput
            style={pFields.input}
            value={item.designName}
            onChangeText={v => upd({ designName: v })}
            placeholder="e.g. Front Logo, Back Print"
            placeholderTextColor={TEXT_PLACEHOLDER}
          />
        </View>

        {/* Service Style */}
        <View style={pFields.container}>
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

        {/* Locations */}
        <View style={liStyles.twoCol}>
          <View style={[pFields.container, { flex: 1 }]}>
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
          <View style={[pFields.container, { flex: 1 }]}>
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
          <View style={liStyles.twoCol}>
            {item.showLoc3 && (
              <View style={[pFields.container, { flex: 1 }]}>
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
              <View style={[pFields.container, { flex: 1 }]}>
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

        <View style={liStyles.addLocRow}>
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

        {/* Products + Sizes */}
        <View style={liStyles.sizeSection}>
          <Text style={liStyles.sizeSectionTitle}>Products + Sizes</Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              {/* Header row */}
              <View style={liStyles.sizeHeaderRow}>
                <Text style={[liStyles.sizeCell, liStyles.sizeHeaderText, { width: 130 }]}>Product</Text>
                <Text style={[liStyles.sizeCell, liStyles.sizeHeaderText, { width: 90 }]}>Color</Text>
                {SIZE_KEYS.map(k => (
                  <Text key={k} style={[liStyles.sizeCell, liStyles.sizeHeaderText, liStyles.sizeCellNum]}>
                    {SIZE_LABELS[k]}
                  </Text>
                ))}
                <Text style={[liStyles.sizeCell, liStyles.sizeHeaderText, liStyles.sizeCellTotal]}>Total</Text>
                <View style={{ width: 28 }} />
              </View>

              {/* Data rows */}
              {item.sizeRows.map((row, ri) => (
                <View key={row.id} style={liStyles.sizeDataRow}>
                  <PortalComboCell
                    value={row.product}
                    onChangeText={v => updRow(row.id, { product: v })}
                    options={PRODUCTS}
                    placeholder="Style / Product"
                    cellWidth={130}
                  />
                  <PortalComboCell
                    value={row.color}
                    onChangeText={v => updRow(row.id, { color: v })}
                    options={PRODUCT_COLORS}
                    placeholder="Color"
                    cellWidth={90}
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
                  <Text style={[liStyles.sizeCell, { width: 130, color: TEXT_LIGHT, fontSize: 11 }]}>Totals</Text>
                  <View style={{ width: 90 }} />
                  {SIZE_KEYS.map(k => (
                    <Text key={k} style={[liStyles.sizeCell, liStyles.sizeCellNum, { fontWeight: '600', fontSize: 11, color: TEXT_MED }]}>
                      {colTotal(item.sizeRows, k) || ''}
                    </Text>
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

        {/* Line Item Notes */}
        <View style={[pFields.container, { marginBottom: 0 }]}>
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
      </View>
    </View>
  );
}

// ────────────────────────────────────────────────────────────
// Main Portal Component
// ────────────────────────────────────────────────────────────
export default function ClientPortal() {
  const { orgId } = useLocalSearchParams<{ orgId: string }>();

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
      setStep('form');
    } catch {
      setEmailError('Connection error. Please try again.');
    } finally {
      setEmailLoading(false);
    }
  }, [email, orgId]);

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
      setSubmittedId(data.id);
      setSubmittedAt(data.createdAt ? new Date(data.createdAt) : new Date());
      setSubmissionEmailSent(!!data.emailSent);
      setStep('success');
    } catch {
      setSubmitError('Connection error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [session, projectName, orderType, inHandsDate, requestNotes, lineItems]);

  const handleNewRequest = useCallback(() => {
    setProjectName('');
    setOrderType('New Order');
    setInHandsDate('');
    setRequestNotes('');
    setLineItems([emptyLineItem()]);
    setSubmitError('');
    setSubmittedId('');
    setSubmittedAt(null);
    setSubmissionEmailSent(false);
    setFormErrors({});
    setStep('form');
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
    setStep('form');
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

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.topBar}>
        <View>
          <Text style={styles.logoText}>KATALYST KO</Text>
          <Text style={styles.logoSub}>Client Portal</Text>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

          {/* ── EMAIL STEP ── */}
          {step === 'email' && (
            <View style={styles.card}>
              <View style={styles.cardIcon}>
                <FileText size={28} color={BRAND} />
              </View>
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
          )}

          {/* ── FORM STEP ── */}
          {step === 'form' && session && (
            <View style={[styles.card, { maxWidth: 720 }]}>
              {/* Welcome */}
              <View style={styles.welcomeRow}>
                <View style={styles.welcomeAvatar}>
                  <Text style={styles.welcomeAvatarText}>{session.userName?.[0]?.toUpperCase() || '?'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.welcomeName}>Hi, {session.userName}!</Text>
                  <Text style={styles.welcomeOrg}>{session.orgName}</Text>
                </View>
              </View>
              <View style={styles.divider} />

              <Text style={styles.formTitle}>Submit a Project Request</Text>
              <Text style={styles.formSub}>
                Fill in the details below — your submission will come straight into Ko OS ready for pricing.
              </Text>

              {/* ── REQUEST FIELDS ── */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionLabel}>Request Details</Text>

                {/* Auto-filled read-only */}
                <View style={[liStyles.twoCol, { marginBottom: 4 }]}>
                  <View style={[pFields.container, { flex: 1 }]}>
                    <Text style={pFields.label}>Organization</Text>
                    <View style={pFields.readOnly}><Text style={pFields.readOnlyText}>{session.orgName}</Text></View>
                  </View>
                  <View style={[pFields.container, { flex: 1 }]}>
                    <Text style={pFields.label}>Submitted By</Text>
                    <View style={pFields.readOnly}><Text style={pFields.readOnlyText}>{session.userName}</Text></View>
                  </View>
                </View>

                {/* Project Name */}
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

                {/* Order Type + In Hands Date */}
                <View style={liStyles.twoCol}>
                  <View style={[pFields.container, { flex: 1 }]}>
                    <Text style={pFields.label}>Order Type</Text>
                    <TouchableOpacity
                      style={pFields.selectRow}
                      onPress={() => openDropdown('Order Type', PORTAL_ORDER_TYPES, orderType, setOrderType)}
                    >
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

              {/* ── LINE ITEMS ── */}
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

              {/* ── OVERALL NOTES ── */}
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

              {submitError ? (
                <View style={styles.errorBox}><Text style={styles.errorText}>{submitError}</Text></View>
              ) : null}

              <TouchableOpacity style={[styles.btn, submitting && styles.btnDisabled]} onPress={handleSubmit} disabled={submitting}>
                {submitting ? <ActivityIndicator size="small" color="#fff" /> : (
                  <>
                    <Send size={16} color="#fff" />
                    <Text style={[styles.btnText, { marginLeft: 8 }]}>Submit Request</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.backBtn} onPress={() => setStep('email')}>
                <ArrowLeft size={14} color={TEXT_LIGHT} />
                <Text style={styles.backBtnText}>Not you? Switch account</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── SUCCESS STEP ── */}
          {step === 'success' && session && (
            <View style={styles.card}>
              <View style={styles.successIcon}><CheckCircle size={40} color="#16A34A" /></View>
              <Text style={styles.cardTitle}>Request Submitted!</Text>
              <Text style={styles.cardSub}>
                Your project request has been received.{submissionEmailSent ? ' A confirmation has been sent to your email.' : ' The Katalyst Ko team will review it and reach out with next steps and a quote.'}
              </Text>

              <View style={styles.successRef}>
                <Text style={styles.successRefLabel}>Reference ID</Text>
                <Text style={styles.successRefValue} numberOfLines={1}>{submittedId}</Text>
              </View>

              {/* ── Edit window ── */}
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
                    <TouchableOpacity
                      style={[styles.editBtn, cancelling && styles.btnDisabled]}
                      onPress={handleEditSubmission}
                      disabled={cancelling}
                    >
                      {cancelling
                        ? <ActivityIndicator size="small" color="#374151" />
                        : <><Edit2 size={14} color="#374151" /><Text style={styles.editBtnText}>Edit Request</Text></>
                      }
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.cancelBtn, cancelling && styles.btnDisabled]}
                      onPress={handleCancelSubmission}
                      disabled={cancelling}
                    >
                      <Trash2 size={14} color="#DC2626" />
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <TouchableOpacity style={[styles.btn, { marginTop: 4 }]} onPress={handleNewRequest}>
                <Text style={styles.btnText}>Submit Another Request</Text>
              </TouchableOpacity>
              <Text style={styles.helpText}>
                Questions? Email us at <Text style={{ color: BRAND }}>jobs@katalystko.com</Text>
              </Text>
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Powered by Katalyst Ko · Client Hub</Text>
      </View>

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
                  <Text style={[ddStyles.optionText, dropdown.selected === opt && ddStyles.optionTextSelected]}>
                    {opt}
                  </Text>
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
  container: { marginBottom: 14 },
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
  cardBody: { padding: 16 },
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
  sizeCellNum: { width: 40, textAlign: 'center' },
  sizeCellTotal: { width: 46, textAlign: 'center' },
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
  logoText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 2 },
  logoSub: { color: BRAND, fontSize: 10, fontWeight: '600', letterSpacing: 1, marginTop: 1 },
  scrollContent: { flexGrow: 1, alignItems: 'center', padding: 20, paddingVertical: 36 },
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 520,
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
  formTitle: { fontSize: 18, fontWeight: '700', color: TEXT, marginBottom: 4 },
  formSub: { fontSize: 13, color: TEXT_LIGHT, marginBottom: 20, lineHeight: 19 },
  sectionCard: { backgroundColor: '#FAFAFA', borderWidth: 1, borderColor: BORDER, borderRadius: 12, padding: 16, marginBottom: 20 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: TEXT_LIGHT, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: TEXT, marginBottom: 4 },
  sectionSub: { fontSize: 13, color: TEXT_LIGHT, marginBottom: 14, lineHeight: 18 },
  addLineItemBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1.5, borderColor: BRAND, borderRadius: 10, paddingVertical: 11,
    marginBottom: 20, backgroundColor: '#FFF7F0',
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
