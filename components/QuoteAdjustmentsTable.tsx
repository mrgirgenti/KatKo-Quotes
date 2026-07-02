import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  StyleSheet,
} from 'react-native';
import { Plus, Trash2, Pencil, X } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { formatCurrency } from '@/utils/quoteCalculations';
import { type QuoteAdjustment } from '@/types/quote';
import { calcAdjustmentAmount, adjustmentDetails } from '@/utils/adjustments';
import { AddAdjustmentModal } from '@/components/AddAdjustmentModal';
import type { LibraryKind } from '@/lib/costLibraryStore';

// Re-exported for backward compatibility with existing imports.
export { calcAdjustmentAmount } from '@/utils/adjustments';

// ── Inline Edit Modal ─────────────────────────────────────────────────────────
// Lets users update Name / Rate / Quantity for an existing row.
// `type` (the calc method) is backend-only — never displayed here.

interface EditModalProps {
  row: QuoteAdjustment;
  baseAmount: number;
  onClose: () => void;
  onSave: (updated: QuoteAdjustment) => void;
}

function EditAdjustmentModal({ row, baseAmount, onClose, onSave }: EditModalProps) {
  const [name, setName] = useState(row.name);
  const [rateStr, setRateStr] = useState(String(row.rate));
  const [qtyStr, setQtyStr] = useState(String(row.quantity ?? 1));

  const rate = parseFloat(rateStr) || 0;
  const qty = parseFloat(qtyStr) || 1;
  const showQty = row.type === 'hourly' || row.type === 'per_unit';
  const qtyLabel = row.type === 'hourly' ? 'HOURS' : 'QUANTITY';
  const preview = calcAdjustmentAmount({ ...row, rate, quantity: qty }, baseAmount);

  const handleSave = () => {
    onSave({ ...row, name: name.trim() || row.name, rate, quantity: qty });
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={editSt.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={editSt.dialog} onPress={() => {}}>
          <View style={editSt.header}>
            <Text style={editSt.title}>Edit Adjustment</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={20} color={Colors.light.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={editSt.body}>
            <Text style={editSt.fieldLabel}>NAME</Text>
            <TextInput
              style={editSt.input}
              value={name}
              onChangeText={setName}
              placeholder="Adjustment name"
              placeholderTextColor={Colors.light.textSecondary}
              autoFocus
              returnKeyType="next"
            />

            <Text style={[editSt.fieldLabel, { marginTop: 14 }]}>AMOUNT</Text>
            <TextInput
              style={editSt.input}
              value={rateStr}
              onChangeText={setRateStr}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={Colors.light.textSecondary}
            />

            {showQty && (
              <>
                <Text style={[editSt.fieldLabel, { marginTop: 14 }]}>{qtyLabel}</Text>
                <TextInput
                  style={editSt.input}
                  value={qtyStr}
                  onChangeText={setQtyStr}
                  keyboardType="decimal-pad"
                  placeholder="1"
                  placeholderTextColor={Colors.light.textSecondary}
                />
              </>
            )}

            <View style={editSt.preview}>
              <Text style={editSt.previewLabel}>CALCULATED</Text>
              <Text style={editSt.previewValue}>{formatCurrency(preview)}</Text>
            </View>

            <TouchableOpacity style={editSt.saveBtn} onPress={handleSave} activeOpacity={0.85}>
              <Text style={editSt.saveBtnText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ── Table ─────────────────────────────────────────────────────────────────────

export interface QuoteAdjustmentsTableProps {
  title: string;
  addLabel: string;
  /** Which Settings library the "Add" dialog loads from. */
  libraryKind: LibraryKind;
  rows: QuoteAdjustment[];
  /** Base amount used for percentage-type preview (e.g. the line-item subtotal). */
  baseAmount?: number;
  onChange: (rows: QuoteAdjustment[]) => void;
}

export function QuoteAdjustmentsTable({
  title,
  addLabel,
  libraryKind,
  rows,
  baseAmount = 0,
  onChange,
}: QuoteAdjustmentsTableProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<QuoteAdjustment | null>(null);

  const removeRow = useCallback(
    (id: string) => onChange(rows.filter((r) => r.id !== id)),
    [rows, onChange],
  );

  const addRow = useCallback(
    (adj: QuoteAdjustment) => onChange([...rows, adj]),
    [rows, onChange],
  );

  const saveEdit = useCallback(
    (updated: QuoteAdjustment) => {
      onChange(rows.map((r) => (r.id === updated.id ? updated : r)));
      setEditingRow(null);
    },
    [rows, onChange],
  );

  return (
    <View style={styles.section}>

      {/* Section header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{title}</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setAddOpen(true)}
          activeOpacity={0.85}
        >
          <Plus size={11} color="#fff" />
          <Text style={styles.addBtnText}>{addLabel}</Text>
        </TouchableOpacity>
      </View>

      {/* Column headings — Type column intentionally omitted (backend-only) */}
      <View style={styles.colHead}>
        <Text style={[styles.colHeadText, styles.colName]}>Name</Text>
        <Text style={[styles.colHeadText, styles.colDetails]}>Details</Text>
        <Text style={[styles.colHeadText, styles.colCalc]}>Calculated</Text>
        <View style={styles.colActions} />
      </View>

      {rows.length === 0 ? (
        <View style={styles.emptyRow}>
          <Text style={styles.emptyText}>No entries. Use Add to create a row.</Text>
        </View>
      ) : (
        rows.map((row) => {
          const calc = calcAdjustmentAmount(row, baseAmount);
          return (
            <View key={row.id} style={styles.row}>

              {/* Name */}
              <Text style={[styles.colName, styles.cellText]} numberOfLines={1}>
                {row.name || 'Untitled'}
              </Text>

              {/* Details — human-readable summary of inputs; type never shown */}
              <Text style={[styles.colDetails, styles.cellMuted]} numberOfLines={1}>
                {adjustmentDetails(row)}
              </Text>

              {/* Calculated */}
              <Text style={[styles.colCalc, styles.calcText]}>{formatCurrency(calc)}</Text>

              {/* Actions: Edit + Delete */}
              <View style={styles.colActions}>
                <TouchableOpacity
                  onPress={() => setEditingRow(row)}
                  hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                >
                  <Pencil size={13} color={Colors.light.tint} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => removeRow(row.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                >
                  <Trash2 size={13} color={Colors.light.error} />
                </TouchableOpacity>
              </View>

            </View>
          );
        })
      )}

      {/* Add modal */}
      <AddAdjustmentModal
        visible={addOpen}
        kind={libraryKind}
        baseAmount={baseAmount}
        onClose={() => setAddOpen(false)}
        onSave={addRow}
      />

      {/* Edit modal — only mounted when a row is being edited */}
      {editingRow && (
        <EditAdjustmentModal
          row={editingRow}
          baseAmount={baseAmount}
          onClose={() => setEditingRow(null)}
          onSave={saveEdit}
        />
      )}

    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  section: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    backgroundColor: Colors.light.surface,
    overflow: 'hidden',
    marginTop: 12,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 12,
    height: 30,
  },
  headerTitle: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.light.text,
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
  },
  addBtnText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#fff',
  },

  colHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: Colors.light.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    gap: 8,
  },
  colHeadText: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: Colors.light.textSecondary,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
  },

  // Compact data row — QuickBooks-style density
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.light.border,
    gap: 8,
  },

  // Column widths — Type removed, space redistributed to Name + Details
  colName:    { flex: 1,   minWidth: 110 },
  colDetails: { flex: 1.4, minWidth: 130 },
  colCalc:    { width: 80, textAlign: 'right' as const },
  colActions: {
    width: 44,
    flexDirection: 'row' as const,
    justifyContent: 'flex-end' as const,
    gap: 8,
  },

  cellText: {
    fontSize: 12,
    color: Colors.light.text,
    fontWeight: '600' as const,
  },
  cellMuted: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  calcText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },

  emptyRow: {
    paddingHorizontal: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.light.border,
  },
  emptyText: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    fontStyle: 'italic' as const,
  },
});

// Edit modal styles — separate namespace to avoid style-name collisions
const editSt = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.52)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dialog: {
    backgroundColor: Colors.light.surface,
    borderRadius: 14,
    width: 360,
    maxWidth: '100%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  title: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  body: {
    padding: 16,
  },
  fieldLabel: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 5,
  },
  input: {
    height: 38,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 14,
    color: Colors.light.text,
    backgroundColor: Colors.light.background,
  },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    padding: 12,
    backgroundColor: Colors.light.highlightBg,
    borderRadius: 8,
  },
  previewLabel: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.4,
  },
  previewValue: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: Colors.light.text,
  },
  saveBtn: {
    marginTop: 14,
    backgroundColor: Colors.light.tint,
    borderRadius: 9,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#fff',
  },
});

export default QuoteAdjustmentsTable;
