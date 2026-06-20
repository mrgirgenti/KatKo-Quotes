import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowUpDown, Check } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { TABLE_COL, TABLE_CELL } from '@/constants/tableLayout';
import { DS } from '@/constants/designSystem';
import { formatDate } from '@/utils/textFormatting';
import { OPERATIONAL_STATUSES, OPERATIONAL_STATUS_CONFIG } from '@/types/quote';
import type { Quote, OperationalProjectStatus, ProjectPriority } from '@/types/quote';
import type { UserProfile } from '@/types/user';
import OverlayMenu from '@/components/OverlayMenu';
import { totalPieces, serviceTypeLabel } from '@/lib/production';
import type { SortField, SortDir } from '@/lib/production';
import { PriorityControl } from './PriorityControl';
import { AssigneeControl } from './AssigneeControl';
import { OperationalStatusControl } from './OperationalStatusControl';

interface Props {
  projects: Quote[];
  users: UserProfile[];
  sortField: SortField;
  sortDir: SortDir;
  onSort: (field: SortField) => void;
  selectedIds: string[];
  onToggleSelect: (quoteId: string) => void;
  onToggleSelectAll: () => void;
  onBulkSetStatus: (status: OperationalProjectStatus) => void;
  onClearSelection: () => void;
  onSetStatus: (quoteId: string, status: OperationalProjectStatus) => void;
  onSetPriority: (quoteId: string, priority: ProjectPriority) => void;
  onSetAssignee: (quoteId: string, userId: string | null) => void;
}

export function ProductionQueue({
  projects,
  users,
  sortField,
  sortDir,
  onSort,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onBulkSetStatus,
  onClearSelection,
  onSetStatus,
  onSetPriority,
  onSetAssignee,
}: Props) {
  const router = useRouter();

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allSelected = projects.length > 0 && projects.every((q) => selectedSet.has(q.id));
  const someSelected = selectedIds.length > 0;

  const SortBtn = ({ field, label }: { field: SortField; label: string }) => (
    <TouchableOpacity style={styles.sortBtn} onPress={() => onSort(field)}>
      <Text style={[styles.thText, sortField === field && { color: Colors.light.tint }]}>{label}</Text>
      <ArrowUpDown size={11} color={sortField === field ? Colors.light.tint : 'rgba(255,255,255,0.35)'} />
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1 }}>
      {/* Bulk action bar */}
      {someSelected ? (
        <View style={styles.bulkBar}>
          <Text style={styles.bulkText}>{selectedIds.length} selected</Text>
          <OverlayMenu
            menuWidth={220}
            align="left"
            trigger={({ open }) => (
              <TouchableOpacity style={styles.bulkBtn} onPress={open}>
                <Text style={styles.bulkBtnText}>Set status…</Text>
              </TouchableOpacity>
            )}
          >
            {({ close }) => (
              <View>
                {OPERATIONAL_STATUSES.map((s) => {
                  const cfg = OPERATIONAL_STATUS_CONFIG[s];
                  return (
                    <TouchableOpacity
                      key={s}
                      style={styles.menuItem}
                      onPress={() => { close(); onBulkSetStatus(s); }}
                    >
                      <View style={[styles.menuDot, { backgroundColor: cfg.color }]} />
                      <Text style={styles.menuItemText}>{cfg.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </OverlayMenu>
          <TouchableOpacity style={styles.bulkClear} onPress={onClearSelection}>
            <Text style={styles.bulkClearText}>Clear</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <ScrollView style={{ flex: 1, outlineStyle: 'none' } as any} showsVerticalScrollIndicator={false}>
        <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ flexGrow: 1 }} style={{ outlineStyle: 'none' } as any}>
          <View style={{ minWidth: 1900, flexGrow: 1 }}>
            <View style={styles.tableHeader}>
              <View style={styles.colCheck}>
                <Checkbox checked={allSelected} onPress={onToggleSelectAll} />
              </View>
              <View style={styles.colPriority}><SortBtn field="priority" label="Priority" /></View>
              <View style={styles.colNum}><Text style={styles.thText}>Project #</Text></View>
              <View style={styles.colProject}><SortBtn field="project" label="Name" /></View>
              <View style={styles.colClient}><SortBtn field="client" label="Organization" /></View>
              <View style={styles.colStatus}><SortBtn field="status" label="Status" /></View>
              <View style={styles.colService}><Text style={styles.thText}>Service Type</Text></View>
              <View style={styles.colPcs}><Text style={styles.thText}>Qty</Text></View>
              <View style={styles.colOrder}><SortBtn field="orderDate" label="Order Date" /></View>
              <View style={styles.colDue}><SortBtn field="dueDate" label="Due Date" /></View>
              <View style={styles.colAssignee}><Text style={styles.thText}>Assigned</Text></View>
              <View style={styles.colDelivery}><Text style={styles.thText}>Delivery</Text></View>
            </View>

            {projects.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No projects match the current filters.</Text>
              </View>
            ) : (
              <View style={styles.tableBody}>
                {projects.map((q, idx) => {
                  const opStatus = q.operationalStatus as OperationalProjectStatus | undefined;
                  const checked = selectedSet.has(q.id);
                  return (
                    <React.Fragment key={q.id}>
                      {idx > 0 && <View style={styles.tableDivider} />}
                      <TouchableOpacity
                        style={[styles.tableRow, checked && styles.tableRowSelected]}
                        activeOpacity={0.6}
                        onPress={() => router.push(`/quote/${q.id}`)}
                      >
                        <View style={styles.colCheck} onStartShouldSetResponder={() => true}>
                          <Checkbox checked={checked} onPress={() => onToggleSelect(q.id)} />
                        </View>
                        <View style={styles.colPriority} onStartShouldSetResponder={() => true}>
                          <PriorityControl priority={q.priority} onChange={(p) => onSetPriority(q.id, p)} small />
                        </View>
                        <View style={styles.colNum}>
                          <Text style={styles.cellMuted} numberOfLines={1}>{q.projectNumber || q.invoiceNumber || '—'}</Text>
                        </View>
                        <View style={styles.colProject}>
                          <Text style={styles.cell} numberOfLines={1}>{q.projectName || '—'}</Text>
                        </View>
                        <View style={styles.colClient}>
                          <Text style={styles.cellStrong} numberOfLines={1}>{q.personOrganization || '—'}</Text>
                        </View>
                        <View style={styles.colStatus} onStartShouldSetResponder={() => true}>
                          {opStatus ? (
                            <OperationalStatusControl
                              status={opStatus}
                              onChange={(s) => onSetStatus(q.id, s)}
                            />
                          ) : (
                            <Text style={styles.cellMuted}>—</Text>
                          )}
                        </View>
                        <View style={styles.colService}>
                          <Text style={styles.cell} numberOfLines={1}>{serviceTypeLabel(q)}</Text>
                        </View>
                        <View style={styles.colPcs}>
                          <Text style={styles.cell}>{totalPieces(q) || '—'}</Text>
                        </View>
                        <View style={styles.colOrder}>
                          <Text style={styles.cell}>{q.orderDate ? formatDate(q.orderDate) : '—'}</Text>
                        </View>
                        <View style={styles.colDue}>
                          <Text style={styles.cell}>{q.inHandsDate ? formatDate(q.inHandsDate) : '—'}</Text>
                        </View>
                        <View style={styles.colAssignee} onStartShouldSetResponder={() => true}>
                          <AssigneeControl
                            assignedToUserId={q.assignedToUserId}
                            users={users}
                            onChange={(uid) => onSetAssignee(q.id, uid)}
                            showName
                          />
                        </View>
                        <View style={styles.colDelivery}>
                          <Text style={styles.cell} numberOfLines={1}>{q.deliveryMethod || '—'}</Text>
                        </View>
                      </TouchableOpacity>
                    </React.Fragment>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>
      </ScrollView>
    </View>
  );
}

function Checkbox({ checked, onPress }: { checked: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.checkbox, checked && styles.checkboxChecked]}
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      {checked ? <Check size={13} color="#fff" /> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  bulkBar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: DS.spacing.xl, paddingVertical: 10, backgroundColor: '#FFF4EE', borderBottomWidth: 1, borderBottomColor: Colors.light.tint },
  bulkText: { fontSize: 13, fontWeight: '700', color: Colors.light.tint },
  bulkBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: DS.radius.sm, backgroundColor: Colors.light.tint },
  bulkBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  bulkClear: { paddingHorizontal: 10, paddingVertical: 7 },
  bulkClearText: { fontSize: 13, fontWeight: '600', color: Colors.light.textSecondary },

  tableHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: DS.spacing.xl, paddingVertical: 10, backgroundColor: '#000000' },
  thText: { fontSize: 11, fontWeight: '700', color: '#ffffff', textTransform: 'uppercase', letterSpacing: 0.5 },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },

  tableBody: { paddingBottom: 40 },
  tableDivider: { height: 1, backgroundColor: Colors.light.border, marginHorizontal: DS.spacing.xl },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: DS.spacing.xl, paddingVertical: 12, backgroundColor: Colors.light.surface },
  tableRowSelected: { backgroundColor: '#FFF8F4' },

  colCheck:    { width: 40, ...TABLE_CELL.center },
  colPriority: { ...TABLE_COL.status, ...TABLE_CELL.center },
  colNum:      { ...TABLE_COL.numericWide, ...TABLE_CELL.center },
  colProject:  { ...TABLE_COL.textPrimary, ...TABLE_CELL.left },
  colClient:   { ...TABLE_COL.text, ...TABLE_CELL.left },
  colStatus:   { ...TABLE_COL.status, ...TABLE_CELL.center },
  colService:  { ...TABLE_COL.text, ...TABLE_CELL.left },
  colPcs:      { ...TABLE_COL.numeric, ...TABLE_CELL.center },
  colOrder:    { ...TABLE_COL.date, ...TABLE_CELL.center },
  colDue:      { ...TABLE_COL.date, ...TABLE_CELL.center },
  colAssignee: { ...TABLE_COL.text, ...TABLE_CELL.left },
  colDelivery: { ...TABLE_COL.text, ...TABLE_CELL.left },

  cell: { fontSize: 13, color: Colors.light.text },
  cellStrong: { fontSize: 13, fontWeight: '700', color: Colors.light.text },
  cellMuted: { fontSize: 13, color: Colors.light.textSecondary },

  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: Colors.light.border, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.light.background },
  checkboxChecked: { backgroundColor: Colors.light.tint, borderColor: Colors.light.tint },

  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
  menuDot: { width: 10, height: 10, borderRadius: 5 },
  menuItemText: { fontSize: 13, fontWeight: '600', color: Colors.light.text },

  emptyState: { alignItems: 'center', justifyContent: 'center', padding: 48 },
  emptyText: { fontSize: 14, color: Colors.light.textSecondary },
});
