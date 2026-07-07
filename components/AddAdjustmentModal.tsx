import React, { useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { X, ChevronLeft, Check } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { type QuoteAdjustment, type AdjustmentCalcType } from '@/types/quote';
import { calcAdjustmentAmount, adjustmentTypeLabel } from '@/utils/adjustments';
import { formatCurrency } from '@/utils/quoteCalculations';
import { useEnabledLibraryItems, type LibraryKind } from '@/lib/costLibraryStore';
import type { CostLibraryEntry } from '@/components/CostLibraryTable';

let idSeq = 0;
function genId(): string {
  idSeq += 1;
  return `adj_${Date.now().toString(36)}_${idSeq.toString(36)}`;
}

/** Parse a free-text rate like "$25", "15%", "$20-200" into a number (first value for ranges). */
function parseRate(raw: string | undefined): number {
  const s = String(raw ?? '').replace(/[$\s]/g, '');
  const first = s.split(/[-–]/)[0].replace(/%$/, '');
  const n = parseFloat(first);
  return Number.isFinite(n) ? n : 0;
}

function isPerPiece(item: CostLibraryEntry): boolean {
  return item.appliesTo === 'per_piece' || item.scope === 'per_piece';
}

function rateSummary(item: CostLibraryEntry): string {
  const rate = parseRate(item.defaultRate);
  switch (item.calcType) {
    case 'flat':
      return item.defaultRate || formatCurrency(rate);
    case 'hourly':
      return item.defaultRate ? `${item.defaultRate}/hr` : `${formatCurrency(rate)}/hr`;
    case 'per_unit':
    case 'per_color':
    case 'per_design':
      return item.defaultRate ? `${item.defaultRate}/${isPerPiece(item) ? 'pc' : 'unit'}` : `${formatCurrency(rate)}/unit`;
    case 'percentage':
      return item.defaultRate || `${rate}%`;
    default:
      return item.defaultRate || formatCurrency(rate);
  }
}

export interface AddAdjustmentModalProps {
  visible: boolean;
  kind: LibraryKind;
  /** Base amount used for percentage-type preview (e.g. the line-item subtotal). */
  baseAmount?: number;
  onClose: () => void;
  onSave: (adj: QuoteAdjustment) => void;
}

export function AddAdjustmentModal({
  visible,
  kind,
  baseAmount = 0,
  onClose,
  onSave,
}: AddAdjustmentModalProps) {
  const items = useEnabledLibraryItems(kind);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);

  const heading = kind === 'production' ? 'Add Production Cost' : 'Add Other Charge';
  const selected = useMemo(
    () => items.find((i) => i.id === selectedId) ?? null,
    [items, selectedId],
  );

  const reset = () => {
    setSelectedId(null);
    setQuantity(1);
  };

  const close = () => {
    reset();
    onClose();
  };

  const pick = (item: CostLibraryEntry) => {
    setSelectedId(item.id);
    setQuantity(1);
  };

  const selectedRate = selected ? parseRate(selected.defaultRate) : 0;

  const preview = selected
    ? calcAdjustmentAmount(
        { type: selected.calcType as AdjustmentCalcType, rate: selectedRate, quantity },
        baseAmount,
      )
    : 0;

  const save = () => {
    if (!selected) return;
    onSave({
      id: genId(),
      name: selected.name,
      type: selected.calcType as AdjustmentCalcType,
      rate: selectedRate,
      quantity: selected.calcType === 'flat' || selected.calcType === 'percentage'
        ? 1
        : quantity,
    });
    close();
  };

  const perUnitLabel = selected ? (isPerPiece(selected) ? 'Pieces' : 'Quantity') : 'Quantity';
  const needsQuantity = selected?.calcType === 'hourly'
    || selected?.calcType === 'per_unit'
    || selected?.calcType === 'per_color'
    || selected?.calcType === 'per_design';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={close}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}} style={styles.dialog}>
          {/* Header */}
          <View style={styles.header}>
            {selected ? (
              <TouchableOpacity style={styles.backBtn} onPress={reset} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <ChevronLeft size={18} color={Colors.light.text} />
                <Text style={styles.backText}>Library</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.title}>{heading}</Text>
            )}
            <TouchableOpacity onPress={close} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={20} color={Colors.light.textSecondary} />
            </TouchableOpacity>
          </View>

          {!selected ? (
            /* ── Step 1: pick a library item ── */
            <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
              {items.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptyTitle}>No library items</Text>
                  <Text style={styles.emptyMsg}>
                    Add {kind === 'production' ? 'production costs' : 'other charges'} in
                    {'\n'}Settings → Cost Configuration first.
                  </Text>
                </View>
              ) : (
                items.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.itemRow}
                    onPress={() => pick(item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.itemMain}>
                      <Text style={styles.itemName} numberOfLines={1}>{item.name || 'Untitled'}</Text>
                      <View style={styles.itemMetaRow}>
                        <View style={styles.typeBadge}>
                          <Text style={styles.typeBadgeText}>{adjustmentTypeLabel(item.calcType)}</Text>
                        </View>
                        <Text style={styles.itemRate}>{rateSummary(item)}</Text>
                      </View>
                    </View>
                    <ChevronLeft size={16} color={Colors.light.textSecondary} style={styles.chevRight} />
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          ) : (
            /* ── Step 2: configure the chosen item ── */
            <View style={styles.editor}>
              <View style={styles.selectedHead}>
                <Text style={styles.selectedName}>{selected.name || 'Untitled'}</Text>
                <View style={styles.typeBadge}>
                  <Text style={styles.typeBadgeText}>{adjustmentTypeLabel(selected.calcType)}</Text>
                </View>
              </View>

              {/* Rate display */}
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Rate</Text>
                <Text style={styles.fieldStatic}>{selected.defaultRate || '—'}</Text>
              </View>

              {/* Quantity input for time/unit-based types */}
              {needsQuantity && (
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>{perUnitLabel}</Text>
                  <NumInput
                    value={quantity}
                    onChange={(v) => setQuantity(Math.max(1, v))}
                    suffix={selected.calcType === 'hourly' ? 'hrs' : undefined}
                  />
                </View>
              )}

              {selected.calcType === 'percentage' && (
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Base</Text>
                  <Text style={styles.fieldStatic}>{formatCurrency(baseAmount)}</Text>
                </View>
              )}

              {/* Preview */}
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Calculated</Text>
                <Text style={styles.previewValue}>{formatCurrency(preview)}</Text>
              </View>

              <TouchableOpacity style={styles.saveBtn} onPress={save} activeOpacity={0.85}>
                <Check size={16} color="#fff" />
                <Text style={styles.saveBtnText}>Add to Quote</Text>
              </TouchableOpacity>
            </View>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

function NumInput({
  value,
  onChange,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <View style={styles.numWrap}>
      <TextInput
        style={styles.numInput}
        value={value ? String(value) : ''}
        onChangeText={(t) => {
          const n = parseFloat(t.replace(/[^0-9.]/g, ''));
          onChange(Number.isFinite(n) ? n : 0);
        }}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor={Colors.light.textSecondary}
        autoFocus
      />
      {suffix ? <Text style={styles.numSuffix}>{suffix}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dialog: {
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    width: 420,
    maxWidth: '100%',
    maxHeight: '80%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  title: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  backText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },

  list: { maxHeight: 380 },
  listContent: { padding: 8 },

  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.surface,
    marginBottom: 8,
  },
  itemMain: { flex: 1 },
  itemName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.text,
    marginBottom: 4,
  },
  itemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemRate: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    fontWeight: '600' as const,
  },
  chevRight: { transform: [{ rotate: '180deg' }] },

  typeBadge: {
    backgroundColor: Colors.light.highlightBg,
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.3,
  },

  emptyWrap: {
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginBottom: 6,
  },
  emptyMsg: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
  },

  editor: { padding: 16 },
  selectedHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  selectedName: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  fieldLabel: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    fontWeight: '500' as const,
  },
  fieldStatic: {
    fontSize: 14,
    color: Colors.light.text,
    fontWeight: '600' as const,
  },
  numWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 38,
    minWidth: 120,
    backgroundColor: Colors.light.surface,
  },
  numInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.light.text,
    paddingVertical: 0,
    textAlign: 'right' as const,
  },
  numSuffix: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginLeft: 4,
  },

  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: Colors.light.highlightBg,
    borderRadius: 10,
  },
  previewLabel: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.4,
  },
  previewValue: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: Colors.light.text,
  },

  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 18,
    backgroundColor: Colors.light.tint,
    borderRadius: 10,
    paddingVertical: 13,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#fff',
  },
});

export default AddAdjustmentModal;
