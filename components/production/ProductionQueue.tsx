import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { ChevronDown, ChevronUp, AlertCircle } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { DS } from '@/constants/designSystem';
import type { Quote, OperationalProjectStatus, ProjectPriority } from '@/types/quote';
import { parseProjectDate } from '@/lib/production';
import { ProductionQueueCard } from './ProductionQueueCard';

interface QueueGroup {
  id: string;
  label: string;
  accent: string;
  projects: Quote[];
  defaultCollapsed?: boolean;
}

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function formatGroupDate(d: Date): string {
  const today = startOfDay(new Date());
  const prefix = isSameDay(d, today) ? 'TODAY' : 'TOMORROW';
  const dateStr = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase();
  return `${prefix} — ${dateStr}`;
}

function groupProjects(projects: Quote[]): QueueGroup[] {
  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = startOfDay(addDays(today, 1));
  const in7 = startOfDay(addDays(today, 7));

  const overdue: Quote[] = [];
  const todayG: Quote[] = [];
  const tomorrowG: Quote[] = [];
  const next7G: Quote[] = [];
  const futureG: Quote[] = [];
  const onHoldG: Quote[] = [];
  const completedG: Quote[] = [];

  for (const q of projects) {
    const status = q.operationalStatus;
    if (['Completed', 'Delivered', 'Closed'].includes(status || '')) {
      completedG.push(q);
      continue;
    }
    if (status === 'On Hold') {
      onHoldG.push(q);
      continue;
    }
    const d = parseProjectDate(q.inHandsDate);
    if (!d) { futureG.push(q); continue; }
    const due = startOfDay(d);
    if (due < today) { overdue.push(q); continue; }
    if (isSameDay(due, today)) { todayG.push(q); continue; }
    if (isSameDay(due, tomorrow)) { tomorrowG.push(q); continue; }
    if (due <= in7) { next7G.push(q); continue; }
    futureG.push(q);
  }

  return [
    { id: 'overdue', label: 'OVERDUE', accent: '#DC2626', projects: overdue },
    { id: 'today', label: formatGroupDate(today), accent: '#FF5A00', projects: todayG },
    { id: 'tomorrow', label: formatGroupDate(tomorrow), accent: '#D97706', projects: tomorrowG },
    { id: 'next7', label: 'NEXT 7 DAYS', accent: '#2563EB', projects: next7G },
    { id: 'future', label: 'UPCOMING', accent: '#4B5563', projects: futureG, defaultCollapsed: true },
    { id: 'on_hold', label: 'ON HOLD', accent: '#DC2626', projects: onHoldG, defaultCollapsed: true },
    { id: 'completed', label: 'COMPLETED', accent: '#16A34A', projects: completedG, defaultCollapsed: true },
  ].filter((g) => g.projects.length > 0);
}

export interface ProductionQueueProps {
  projects: Quote[];
  selectedId: string | null;
  onSelectProject: (q: Quote | null) => void;
  onSetStatus: (quoteId: string, status: OperationalProjectStatus) => void;
  onSetPriority: (quoteId: string, priority: ProjectPriority) => void;
}

export function ProductionQueue({
  projects,
  selectedId,
  onSelectProject,
  onSetStatus,
  onSetPriority,
}: ProductionQueueProps) {
  const groups = useMemo(() => groupProjects(projects), [projects]);

  const defaultCollapsed = useMemo(() => {
    const init: Record<string, boolean> = {};
    groups.forEach((g) => { if (g.defaultCollapsed) init[g.id] = true; });
    return init;
  }, []);

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(defaultCollapsed);

  const toggleGroup = (id: string) =>
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));

  if (projects.length === 0) {
    return (
      <View style={s.empty}>
        <AlertCircle size={40} color={Colors.light.textSecondary} style={{ marginBottom: 12 }} />
        <Text style={s.emptyTitle}>No projects in queue</Text>
        <Text style={s.emptyText}>Projects will appear here once they enter the production workflow.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, outlineStyle: 'none' } as any}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={s.scroll}
    >
      {groups.map((group) => {
        const isCollapsed = !!collapsed[group.id];
        return (
          <View key={group.id} style={s.group}>
            {/* Group header */}
            <TouchableOpacity
              style={s.groupHeader}
              onPress={() => toggleGroup(group.id)}
              activeOpacity={0.8}
            >
              <View style={[s.groupAccent, { backgroundColor: group.accent }]} />
              <Text style={s.groupLabel}>{group.label}</Text>
              <View style={[s.groupBadge, { backgroundColor: group.accent }]}>
                <Text style={s.groupBadgeText}>{group.projects.length}</Text>
              </View>
              <View style={s.groupChevron}>
                {isCollapsed
                  ? <ChevronDown size={16} color="rgba(255,255,255,0.7)" />
                  : <ChevronUp size={16} color="rgba(255,255,255,0.7)" />}
              </View>
            </TouchableOpacity>

            {/* Cards */}
            {!isCollapsed && (
              <View style={s.groupBody}>
                {group.projects.map((q) => (
                  <ProductionQueueCard
                    key={q.id}
                    project={q}
                    isSelected={selectedId === q.id}
                    onSelect={() => onSelectProject(selectedId === q.id ? null : q)}
                    onSetStatus={(status) => onSetStatus(q.id, status)}
                    onSetPriority={(priority) => onSetPriority(q.id, priority)}
                  />
                ))}
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { padding: DS.spacing.xl, paddingBottom: 60 },

  group: { marginBottom: 20 },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: DS.radius.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 10,
    gap: 10,
  },
  groupAccent: { width: 3, height: 18, borderRadius: 2 },
  groupLabel: { flex: 1, fontSize: 12, fontWeight: '800', color: '#fff', letterSpacing: 0.8 },
  groupBadge: { borderRadius: DS.radius.pill, paddingHorizontal: 9, paddingVertical: 2, minWidth: 26, alignItems: 'center' },
  groupBadgeText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  groupChevron: { width: 24, alignItems: 'center' },

  groupBody: { gap: 0 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 48, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.light.text },
  emptyText: { fontSize: 14, color: Colors.light.textSecondary, textAlign: 'center', lineHeight: 20, maxWidth: 340 },
});
