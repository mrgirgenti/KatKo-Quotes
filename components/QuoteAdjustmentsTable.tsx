import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Plus, Trash2 } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { formatCurrency } from '@/utils/quoteCalculations';
import { type QuoteAdjustment } from '@/types/quote';
import {
  calcAdjustmentAmount,
  adjustmentTypeLabel,
  adjustmentDetails,
} from '@/utils/adjustments';
import { AddAdjustmentModal } from '@/components/AddAdjustmentModal';
import type { LibraryKind } from '@/lib/costLibraryStore';

// Re-exported for backward compatibility with existing imports.
export { calcAdjustmentAmount } from '@/utils/adjustments';

// ── Table ────────────────────────────────────────────────────────────────────

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
  const [modalOpen, setModalOpen] = useState(false);

  const removeRow = useCallback(
    (id: string) => {
      onChange(rows.filter((r) => r.id !== id));
    },
    [rows, onChange],
  );

  const addRow = useCallback(
    (adj: QuoteAdjustment) => {
      onChange([...rows, adj]);
    },
    [rows, onChange],
  );

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{title}</Text>
        <TouchableOpacity
          style={styles.addHdrBtn}
          onPress={() => setModalOpen(true)}
          activeOpacity={0.85}
        >
          <Plus size={12} color="#fff" />
          <Text style={styles.addHdrBtnText}>{addLabel}</Text>
        </TouchableOpacity>
      </View>

      {/* Column headings */}
      <View style={styles.colHead}>
        <Text style={[styles.colHeadText, styles.colName]}>Name</Text>
        <Text style={[styles.colHeadText, styles.colType]}>Type</Text>
        <Text style={[styles.colHeadText, styles.colDetails]}>Details</Text>
        <Text style={[styles.colHeadText, styles.colCalc]}>Calculated</Text>
        <View style={styles.colDelete} />
      </View>

      {rows.length === 0 ? (
        <View style={styles.emptyRow}>
          <Text style={styles.emptyText}>No entries yet.</Text>
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

              {/* Type */}
              <Text style={[styles.colType, styles.cellMuted]} numberOfLines={1}>
                {adjustmentTypeLabel(row.type)}
              </Text>

              {/* Details */}
              <Text style={[styles.colDetails, styles.cellMuted]} numberOfLines={1}>
                {adjustmentDetails(row)}
              </Text>

              {/* Calculated */}
              <Text style={[styles.colCalc, styles.calcText]}>{formatCurrency(calc)}</Text>

              {/* Delete */}
              <View style={styles.colDelete}>
                <TouchableOpacity
                  onPress={() => removeRow(row.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Trash2 size={15} color={Colors.light.error} />
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}

      <AddAdjustmentModal
        visible={modalOpen}
        kind={libraryKind}
        baseAmount={baseAmount}
        onClose={() => setModalOpen(false)}
        onSave={addRow}
      />
    </View>
  );
}

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
    paddingHorizontal: 16,
    height: 32,
  },
  headerTitle: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.light.text,
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
  },
  addHdrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  addHdrBtnText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#fff',
  },

  colHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Colors.light.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  colHeadText: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: Colors.light.textSecondary,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    gap: 8,
  },

  // Column widths
  colName: { flex: 1, minWidth: 120, paddingRight: 8 },
  colType: { width: 120, paddingRight: 8 },
  colDetails: { flex: 1.2, minWidth: 150, paddingRight: 8 },
  colCalc: { width: 90, textAlign: 'right' as const },
  colDelete: { width: 32, alignItems: 'center' as const },

  cellText: {
    fontSize: 13,
    color: Colors.light.text,
    fontWeight: '600' as const,
  },
  cellMuted: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  calcText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },

  emptyRow: {
    paddingHorizontal: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  emptyText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    fontStyle: 'italic' as const,
  },

  addFooterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 12,
  },
  addFooterText: {
    fontSize: 13,
    color: Colors.light.tint,
    fontWeight: '600' as const,
  },
});

export default QuoteAdjustmentsTable;
