import React, { useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { FileText, ExternalLink, Printer, Layers, Scissors, Package, PenLine, ChevronRight } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { DS } from '@/constants/designSystem';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useUser } from '@/contexts/UserContext';
import type { Quote, OperationalProjectStatus, ProjectPriority } from '@/types/quote';
import { OPERATIONAL_STATUS_CONFIG, PRIORITY_CONFIG, DEFAULT_PRIORITY } from '@/types/quote';
import type { LineItem } from '@/types/quote';
import { resolveMockups } from '@/utils/mockupService';
import { totalPieces, parseProjectDate, serviceTypeLabel } from '@/lib/production';
import { OperationalStatusControl } from './OperationalStatusControl';
import { PriorityControl } from './PriorityControl';
import { generateProjectDocumentPDF } from '@/utils/pdfGenerator';

const SIZE_KEYS = ['xs', 's', 'm', 'l', 'xl', 'xxl', 'xxxl', 'xxxxl'] as const;
const SIZE_DISPLAY = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];

function getSizeRange(lineItems: LineItem[]): string {
  if (!lineItems?.length) return '—';
  const active: string[] = [];
  lineItems.forEach((li) => {
    if (!li.sizes) return;
    SIZE_KEYS.forEach((k, i) => {
      const label = SIZE_DISPLAY[i];
      if ((li.sizes as any)[k] > 0 && !active.includes(label)) active.push(label);
    });
  });
  if (active.length === 0) {
    const flat = lineItems.reduce((s, li) => s + ((li.sizes as any)?.flat || 0), 0);
    return flat > 0 ? `${flat} Flat` : '—';
  }
  const ordered = SIZE_DISPLAY.filter((l) => active.includes(l));
  return ordered.length === 1 ? ordered[0] : `${ordered[0]} – ${ordered[ordered.length - 1]}`;
}

function getDueInfo(inHandsDate?: string | null): { text: string; daysText: string; isOverdue: boolean } {
  if (!inHandsDate) return { text: '—', daysText: '', isOverdue: false };
  const d = parseProjectDate(inHandsDate);
  if (!d) return { text: '—', daysText: '', isOverdue: false };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(d); due.setHours(0, 0, 0, 0);
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000);
  const text = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const isOverdue = diff < 0;
  const daysText = isOverdue
    ? `${Math.abs(diff)}d overdue`
    : diff === 0 ? 'Due today'
    : `${diff} day${diff !== 1 ? 's' : ''}`;
  return { text, daysText, isOverdue };
}

function getInitials(name?: string): string {
  if (!name) return '?';
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

function getPrimaryAction(status: OperationalProjectStatus | null | undefined): { label: string; next: OperationalProjectStatus } | null {
  if (!status) return { label: 'Move to Production', next: 'In Production' };
  if (['Completed', 'Delivered', 'Closed'].includes(status)) return null;
  if (status === 'In Production') return { label: 'Mark Complete', next: 'Completed' };
  if (status === 'On Hold') return { label: 'Resume', next: 'Ready for Production' };
  if (status === 'Ready for Production') return { label: 'Move to Production', next: 'In Production' };
  return { label: 'Start Production', next: 'In Production' };
}

const SERVICE_ICON: Record<string, any> = {
  'Screen Printing': Printer,
  'Direct to Film': Layers,
  'DTF Transfers': Layers,
  'Embroidery': Scissors,
  'Promotional': Package,
  'Design Work': PenLine,
};

export interface ProductionQueueCardProps {
  project: Quote;
  isSelected: boolean;
  onSelect: () => void;
  onSetStatus: (status: OperationalProjectStatus) => void;
  onSetPriority: (priority: ProjectPriority) => void;
}

export function ProductionQueueCard({ project, isSelected, onSelect, onSetStatus, onSetPriority }: ProductionQueueCardProps) {
  const router = useRouter();
  const { isMobile } = useBreakpoint();
  const { currentUser } = useUser();

  const { primaryMockup, mockupCount } = useMemo(() => resolveMockups(project.lineItems || []), [project.lineItems]);
  const firstItem = project.lineItems?.[0];
  const sizeRange = useMemo(() => getSizeRange(project.lineItems || []), [project.lineItems]);
  const locations = useMemo(() => {
    if (!firstItem) return [];
    return [firstItem.location1, firstItem.location2, firstItem.location3, firstItem.location4].filter(Boolean) as string[];
  }, [firstItem]);

  const opStatus = (project.operationalStatus as OperationalProjectStatus) || 'Accepted';
  const opCfg = OPERATIONAL_STATUS_CONFIG[opStatus];
  const priority = (project.priority as ProjectPriority) || DEFAULT_PRIORITY;
  const priBg = PRIORITY_CONFIG[priority].bg;
  const priColor = PRIORITY_CONFIG[priority].color;
  const priBorder = PRIORITY_CONFIG[priority].borderColor;
  const dueInfo = getDueInfo(project.inHandsDate);
  const primaryAction = getPrimaryAction(opStatus);
  const svcLabel = serviceTypeLabel(project);
  const ServiceIcon = (firstItem?.serviceStyle && SERVICE_ICON[firstItem.serviceStyle]) || Printer;

  const handlePunchSheet = async () => {
    try { await generateProjectDocumentPDF(project, 'PRODUCTION', currentUser); } catch (e) { console.error(e); }
  };
  const handleOpenProject = () => router.push(`/quote/${project.id}`);

  if (isMobile) {
    return (
      <TouchableOpacity style={[s.mobileCard, isSelected && s.cardSelected]} onPress={onSelect} activeOpacity={0.8}>
        <View style={s.mobileMockup}>
          {primaryMockup
            ? <Image source={{ uri: primaryMockup }} style={s.mobileMockupImg} resizeMode="contain" />
            : <View style={s.mobileFallback}><Text style={s.fallbackText}>{getInitials(project.projectName)}</Text></View>}
        </View>
        <View style={{ flex: 1, paddingLeft: 12, gap: 3 }}>
          <Text style={s.mobileProjName} numberOfLines={1}>{project.projectName || '—'}</Text>
          <Text style={s.mobileOrg} numberOfLines={1}>{project.personOrganization || '—'}</Text>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 4 }}>
            <View style={[s.statusPill, { backgroundColor: opCfg.bg, borderColor: opCfg.borderColor }]}>
              <Text style={[s.statusPillText, { color: opCfg.color }]}>{opCfg.label}</Text>
            </View>
            {dueInfo.daysText ? (
              <Text style={[s.mobileDays, { color: dueInfo.isOverdue ? '#DC2626' : '#FF5A00' }]}>{dueInfo.text}</Text>
            ) : null}
          </View>
        </View>
        <ChevronRight size={16} color={Colors.light.textSecondary} />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={[s.card, isSelected && s.cardSelected]} onPress={onSelect} activeOpacity={0.85}>
      {/* Mockup column */}
      <View style={s.mockupCol}>
        <View style={s.mockupWrap}>
          {primaryMockup
            ? <Image source={{ uri: primaryMockup }} style={s.mockupImg} resizeMode="contain" />
            : <View style={s.fallback}><Text style={s.fallbackText}>{getInitials(project.projectName)}</Text></View>}
          <View style={s.projectNumBadge}>
            <Text style={s.projectNumText}>{project.projectNumber || project.invoiceNumber || '—'}</Text>
          </View>
          {mockupCount > 0 && (
            <View style={s.mockupCountBadge}>
              <Text style={s.mockupCountText}>{mockupCount} MOCKUP{mockupCount !== 1 ? 'S' : ''}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Project info column */}
      <View style={s.infoCol}>
        <Text style={s.projectName} numberOfLines={2}>{project.projectName || '—'}</Text>
        <Text style={s.orgName} numberOfLines={1}>{project.personOrganization || '—'}</Text>
        <View style={s.metaRow}>
          <ServiceIcon size={12} color={Colors.light.textSecondary} />
          <Text style={s.metaText} numberOfLines={1}>{svcLabel}</Text>
        </View>
        <View style={s.metaRow}>
          <Text style={s.metaText}>{totalPieces(project) || '—'} Pieces</Text>
          {sizeRange !== '—' && <>
            <View style={s.metaDot} />
            <Text style={s.metaText}>{sizeRange}</Text>
          </>}
        </View>
      </View>

      {/* Garment + Locations column */}
      <View style={s.garmentCol}>
        <Text style={s.colLabel}>GARMENT</Text>
        <Text style={s.colValue} numberOfLines={2}>{firstItem?.product || '—'}</Text>
        <Text style={s.colMuted} numberOfLines={1}>{firstItem?.productColor || ''}</Text>
        <Text style={[s.colLabel, { marginTop: 10 }]}>LOCATIONS</Text>
        <View style={s.locationPills}>
          {locations.length > 0
            ? locations.map((loc, i) => (
                <View key={i} style={s.locationPill}>
                  <Text style={s.locationPillText}>{loc}</Text>
                </View>
              ))
            : <Text style={s.colMuted}>—</Text>}
        </View>
      </View>

      {/* Status column */}
      <View style={s.statusCol} onStartShouldSetResponder={() => true}>
        <Text style={s.colLabel}>STATUS</Text>
        <OperationalStatusControl status={opStatus} onChange={onSetStatus} align="right" />
        <Text style={[s.colLabel, { marginTop: 10 }]}>PRIORITY</Text>
        <PriorityControl priority={priority} onChange={onSetPriority} small align="right" />
        <Text style={[s.colLabel, { marginTop: 10 }]}>DUE DATE</Text>
        <Text style={s.dueDateText}>{dueInfo.text}</Text>
        {dueInfo.daysText ? (
          <View style={[s.daysBadge, { backgroundColor: dueInfo.isOverdue ? '#FEE2E2' : '#FFF3E8' }]}>
            <Text style={[s.daysText, { color: dueInfo.isOverdue ? '#DC2626' : '#FF5A00' }]}>{dueInfo.daysText}</Text>
          </View>
        ) : null}
      </View>

      {/* Actions column */}
      <View style={s.actionsCol} onStartShouldSetResponder={() => true}>
        <TouchableOpacity style={s.actionBtn} onPress={handlePunchSheet} activeOpacity={0.7}>
          <FileText size={12} color={Colors.light.text} />
          <Text style={s.actionBtnText}>View Punch Sheet</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.actionBtn} onPress={handleOpenProject} activeOpacity={0.7}>
          <ExternalLink size={12} color={Colors.light.text} />
          <Text style={s.actionBtnText}>Open Project</Text>
        </TouchableOpacity>
        {primaryAction && (
          <TouchableOpacity style={s.primaryActionBtn} onPress={() => onSetStatus(primaryAction.next)} activeOpacity={0.8}>
            <Text style={s.primaryActionText}>{primaryAction.label}</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: Colors.light.surface,
    borderRadius: DS.radius.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
    overflow: 'hidden',
    marginBottom: 10,
  },
  cardSelected: {
    borderColor: Colors.light.tint,
    borderWidth: 2,
  },

  mockupCol: { width: 140, minHeight: 130 },
  mockupWrap: { flex: 1, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center', minHeight: 130, position: 'relative' },
  mockupImg: { width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  fallback: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  fallbackText: { fontSize: 24, fontWeight: '800', color: '#fff', letterSpacing: 1 },
  projectNumBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  projectNumText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  mockupCountBadge: { position: 'absolute', bottom: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  mockupCountText: { fontSize: 9, fontWeight: '700', color: '#fff', letterSpacing: 0.3 },

  infoCol: { flex: 1, padding: 14, justifyContent: 'center', gap: 4, minWidth: 160 },
  projectName: { fontSize: 15, fontWeight: '800', color: Colors.light.text, lineHeight: 20 },
  orgName: { fontSize: 12, color: Colors.light.textSecondary, fontWeight: '500' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  metaText: { fontSize: 11, color: Colors.light.textSecondary },
  metaDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: Colors.light.textSecondary },

  garmentCol: { width: 140, padding: 12, justifyContent: 'flex-start', borderLeftWidth: 1, borderLeftColor: Colors.light.border },
  colLabel: { fontSize: 9, fontWeight: '700', color: Colors.light.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  colValue: { fontSize: 12, fontWeight: '600', color: Colors.light.text, lineHeight: 16 },
  colMuted: { fontSize: 11, color: Colors.light.textSecondary },
  locationPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 },
  locationPill: { backgroundColor: '#F3F4F6', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  locationPillText: { fontSize: 10, fontWeight: '600', color: '#374151' },

  statusCol: { width: 155, padding: 12, justifyContent: 'flex-start', borderLeftWidth: 1, borderLeftColor: Colors.light.border },
  statusPill: { borderRadius: DS.radius.pill, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2, alignSelf: 'flex-start' },
  statusPillText: { fontSize: 10, fontWeight: '700' },
  dueDateText: { fontSize: 12, fontWeight: '600', color: Colors.light.text, marginBottom: 3 },
  daysBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start' },
  daysText: { fontSize: 10, fontWeight: '700' },

  actionsCol: { width: 160, padding: 12, justifyContent: 'center', gap: 6, borderLeftWidth: 1, borderLeftColor: Colors.light.border },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 8, borderRadius: DS.radius.sm, borderWidth: 1, borderColor: Colors.light.border, backgroundColor: Colors.light.background },
  actionBtnText: { fontSize: 11, fontWeight: '600', color: Colors.light.text },
  primaryActionBtn: { paddingHorizontal: 10, paddingVertical: 9, borderRadius: DS.radius.sm, backgroundColor: Colors.light.tint, alignItems: 'center' },
  primaryActionText: { fontSize: 12, fontWeight: '700', color: '#fff' },

  mobileCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.light.surface, borderRadius: DS.radius.lg, borderWidth: 1, borderColor: Colors.light.border, padding: 10, marginBottom: 8 },
  mobileMockup: { width: 64, height: 64, borderRadius: 8, overflow: 'hidden', backgroundColor: '#111' },
  mobileMockupImg: { width: 64, height: 64 },
  mobileFallback: { width: 64, height: 64, justifyContent: 'center', alignItems: 'center' },
  mobileProjName: { fontSize: 14, fontWeight: '700', color: Colors.light.text },
  mobileOrg: { fontSize: 12, color: Colors.light.textSecondary },
  mobileDays: { fontSize: 11, fontWeight: '600' },
});
