import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Shirt } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { DS } from '@/constants/designSystem';
import { OPERATIONAL_STATUS_CONFIG } from '@/types/quote';
import type { Quote, OperationalProjectStatus, ProjectPriority } from '@/types/quote';
import type { UserProfile } from '@/types/user';
import { BOARD_COLUMNS, columnForStatus, sortForBoard, totalPieces, serviceTypeLabel, isRush, formatMonthDay } from '@/lib/production';
import type { BoardColumnKey } from '@/lib/production';
import { PriorityBadge } from './PriorityControl';

interface Props {
  projects: Quote[];
  users: UserProfile[];
  onSetStatus: (quoteId: string, status: OperationalProjectStatus) => void;
  onSetPriority: (quoteId: string, priority: ProjectPriority) => void;
}

export function ProductionBoard({ projects, onSetStatus }: Props) {
  const router = useRouter();
  const [dragOverCol, setDragOverCol] = useState<BoardColumnKey | null>(null);

  const grouped = useMemo(() => {
    const map: Record<BoardColumnKey, Quote[]> = {
      'Ready for Production': [],
      'In Production': [],
      'On Hold': [],
      'Completed': [],
    };
    projects.forEach((q) => {
      const col = columnForStatus(q.operationalStatus);
      if (col) map[col].push(q);
    });
    (Object.keys(map) as BoardColumnKey[]).forEach((k) => { map[k] = sortForBoard(map[k]); });
    return map;
  }, [projects]);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator style={styles.boardScroll} contentContainerStyle={styles.board}>
      {BOARD_COLUMNS.map((col) => {
        const items = grouped[col.key];
        const dropProps = Platform.OS === 'web' ? ({
          onDragOver: (e: any) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverCol(col.key); },
          onDragLeave: () => setDragOverCol((c) => (c === col.key ? null : c)),
          onDrop: (e: any) => {
            e.preventDefault();
            setDragOverCol(null);
            const id = e.dataTransfer?.getData('text/plain');
            if (id) onSetStatus(id, col.canonicalStatus);
          },
        } as any) : {};
        return (
          <View
            key={col.key}
            style={[styles.column, dragOverCol === col.key && styles.columnDragOver]}
            {...dropProps}
          >
            <View style={[styles.columnHeader, { borderTopColor: col.accent }]}>
              <Text style={styles.columnTitle}>{col.title}</Text>
              <View style={styles.countPill}>
                <Text style={styles.countPillText}>{items.length}</Text>
              </View>
            </View>
            <ScrollView style={styles.columnBody} showsVerticalScrollIndicator={false} contentContainerStyle={styles.columnBodyContent}>
              {items.length === 0 ? (
                <Text style={styles.emptyCol}>No projects</Text>
              ) : (
                items.map((q) => (
                  <BoardCard
                    key={q.id}
                    quote={q}
                    onOpen={() => router.push(`/quote/${q.id}`)}
                  />
                ))
              )}
            </ScrollView>
          </View>
        );
      })}
    </ScrollView>
  );
}

function BoardCard({ quote, onOpen }: { quote: Quote; onOpen: () => void }) {
  const opStatus = quote.operationalStatus as OperationalProjectStatus | undefined;
  const opCfg = opStatus ? OPERATIONAL_STATUS_CONFIG[opStatus] : null;
  const stripColor = opCfg?.color || Colors.light.tint;
  const pcs = totalPieces(quote);
  const projNum = quote.projectNumber || quote.invoiceNumber;
  const service = serviceTypeLabel(quote);
  const rush = isRush(quote);
  const mockupUri = (quote.lineItems || []).find((li) => li.mockupUri)?.mockupUri;

  // Only show badge for elevated priorities — Normal is the default and needs no label
  const showPriority = quote.priority && quote.priority !== 'Normal' && quote.priority !== 'Low';

  const dragProps = Platform.OS === 'web' ? ({
    draggable: true,
    onDragStart: (e: any) => {
      e.dataTransfer.setData('text/plain', quote.id);
      e.dataTransfer.effectAllowed = 'move';
    },
  } as any) : {};

  return (
    <View style={styles.card} {...dragProps}>
      <TouchableOpacity activeOpacity={0.75} onPress={onOpen} style={styles.cardRow}>
        {/* Status strip */}
        <View style={[styles.statusStrip, { backgroundColor: stripColor }]} />

        {/* Mockup / artwork preview */}
        <View style={styles.mockupWrap}>
          <View style={styles.mockupBox}>
            {mockupUri ? (
              <Image source={{ uri: mockupUri }} style={styles.mockupImg} resizeMode="cover" />
            ) : (
              <Shirt size={46} color="#1F2937" strokeWidth={1.75} />
            )}
          </View>
          {rush ? <Text style={styles.flame}>🔥</Text> : null}
        </View>

        {/* Main content: left info column + right operational column */}
        <View style={styles.main}>
          <View style={styles.splitRow}>

            {/* LEFT: priority (if elevated) → project number → name → submitted */}
            <View style={styles.leftInfo}>
              {showPriority && <PriorityBadge priority={quote.priority} small />}
              {projNum ? <Text style={styles.projNum}>#{projNum}</Text> : null}
              <Text style={styles.projectName} numberOfLines={1}>
                {quote.projectName || 'Untitled Project'}
              </Text>
              <Text style={styles.submittedText}>
                Submitted: {formatMonthDay(quote.orderDate)}
              </Text>
            </View>

            {/* RIGHT: due date (single line) → pcs (single line) → service */}
            <View style={styles.rightInfo}>
              <Text style={styles.dueDateLine} numberOfLines={1}>
                {'Due Date: '}<Text style={styles.dueValueInline}>{formatMonthDay(quote.inHandsDate)}</Text>
              </Text>
              {pcs > 0 ? (
                <Text style={styles.pcsLine} numberOfLines={1}>
                  {'PCS: '}<Text style={styles.pcsValueInline}>{pcs}</Text>
                </Text>
              ) : null}
              {service ? (
                <Text style={styles.serviceText} numberOfLines={1}>{service}</Text>
              ) : null}
            </View>

          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  boardScroll: { flex: 1 },
  board: { flexGrow: 1, flexDirection: 'row', gap: 12, padding: DS.spacing.lg, alignItems: 'flex-start' },
  column: { flex: 1, minWidth: 340, backgroundColor: '#F7F7F8', borderRadius: DS.radius.lg, borderWidth: 1, borderColor: Colors.light.border, maxHeight: '100%' as any },
  columnDragOver: { borderColor: Colors.light.tint, backgroundColor: '#FFF4EE' },
  columnHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 3, borderTopLeftRadius: DS.radius.lg, borderTopRightRadius: DS.radius.lg },
  columnTitle: { fontSize: 13, fontWeight: '800', color: Colors.light.text, textTransform: 'uppercase', letterSpacing: 0.4 },
  countPill: { minWidth: 22, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: '#E5E7EB', alignItems: 'center' },
  countPillText: { fontSize: 11, fontWeight: '700', color: Colors.light.textSecondary },
  columnBody: { paddingHorizontal: 10 },
  columnBodyContent: { paddingBottom: 16, gap: 10 },
  emptyCol: { fontSize: 12, color: Colors.light.textSecondary, textAlign: 'center', paddingVertical: 24 },

  card: { backgroundColor: Colors.light.surface, borderRadius: DS.radius.lg, borderWidth: 1, borderColor: Colors.light.border, ...DS.shadow.small, cursor: 'grab' as any },
  cardRow: { flexDirection: 'row', alignItems: 'stretch', minHeight: 100 },
  statusStrip: { width: 5, borderTopLeftRadius: DS.radius.lg, borderBottomLeftRadius: DS.radius.lg },

  mockupWrap: { width: 76, padding: 7, position: 'relative' },
  mockupBox: { flex: 1, borderRadius: DS.radius.md, backgroundColor: '#E8F0FE', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  mockupImg: { width: '100%', height: '100%' },
  flame: { position: 'absolute', top: -4, left: -2, fontSize: 22, lineHeight: 26, zIndex: 2 },

  main: { flex: 1, paddingHorizontal: 10, paddingVertical: 10, justifyContent: 'center' },
  splitRow: { flexDirection: 'row', alignItems: 'stretch', gap: 8 },

  leftInfo: { flex: 1, gap: 1 },
  projNum: { fontSize: 11, fontWeight: '700', color: Colors.light.textSecondary, letterSpacing: 0.2, marginBottom: 3 },
  projectName: { fontSize: 14, fontWeight: '800', color: Colors.light.text, lineHeight: 19 },
  submittedText: { fontSize: 10, fontWeight: '500', color: Colors.light.textSecondary, marginTop: 2 },

  rightInfo: { width: 96, alignItems: 'flex-end', gap: 5, justifyContent: 'center' },
  dueDateLine: { fontSize: 9, fontWeight: '600', color: Colors.light.textSecondary, textAlign: 'right' },
  dueValueInline: { fontSize: 9, fontWeight: '800', color: '#ff5a00' },
  pcsLine: { fontSize: 9, fontWeight: '600', color: Colors.light.textSecondary, textAlign: 'right' },
  pcsValueInline: { fontSize: 10, fontWeight: '800', color: Colors.light.text },
  serviceText: { fontSize: 10, fontWeight: '600', color: Colors.light.textSecondary, textAlign: 'right' },
});
