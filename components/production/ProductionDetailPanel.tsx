import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Image,
  Modal, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  X, FileText, ExternalLink, CheckSquare, Square,
  MapPin, Package, Layers, Scissors, Printer, PenLine,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { DS } from '@/constants/designSystem';
import { useUser } from '@/contexts/UserContext';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import type { Quote, OperationalProjectStatus, ProjectPriority, LineItem } from '@/types/quote';
import {
  OPERATIONAL_STATUS_CONFIG, PRIORITY_CONFIG, DEFAULT_PRIORITY,
} from '@/types/quote';
import { resolveMockups } from '@/utils/mockupService';
import { parseProjectDate, serviceTypeLabel } from '@/lib/production';
import { generateProjectDocumentPDF } from '@/utils/pdfGenerator';
import { OperationalStatusControl } from './OperationalStatusControl';
import { PriorityControl } from './PriorityControl';

function getInitials(name?: string) {
  if (!name) return '?';
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

function getDaysInfo(inHandsDate?: string | null): { text: string; diff: number } {
  if (!inHandsDate) return { text: '', diff: 0 };
  const d = parseProjectDate(inHandsDate);
  if (!d) return { text: '', diff: 0 };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(d); due.setHours(0, 0, 0, 0);
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000);
  const text = diff < 0
    ? `${Math.abs(diff)} day${Math.abs(diff) !== 1 ? 's' : ''} overdue`
    : diff === 0 ? 'Due today'
    : `${diff} day${diff !== 1 ? 's' : ''}`;
  return { text, diff };
}

function formatDate(str?: string | null): string {
  if (!str) return '—';
  const d = parseProjectDate(str);
  if (!d) return str;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const SIZE_KEYS = ['xs', 's', 'm', 'l', 'xl', 'xxl', 'xxxl', 'xxxxl'] as const;
const SIZE_DISPLAY = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];

function getSizeDisplay(lineItems: LineItem[]): string {
  if (!lineItems?.length) return '—';
  const active: string[] = [];
  lineItems.forEach((li) => {
    SIZE_KEYS.forEach((k, i) => {
      const label = SIZE_DISPLAY[i];
      if ((li.sizes as any)?.[k] > 0 && !active.includes(label)) active.push(label);
    });
  });
  if (!active.length) {
    const flat = lineItems.reduce((s, li) => s + ((li.sizes as any)?.flat || 0), 0);
    return flat > 0 ? `${flat} Flat` : '—';
  }
  const ordered = SIZE_DISPLAY.filter((l) => active.includes(l));
  return ordered.length === 1 ? ordered[0] : `${ordered[0]} – ${ordered[ordered.length - 1]}`;
}

function getNextProductionStatus(status: OperationalProjectStatus | null | undefined): OperationalProjectStatus {
  if (status === 'In Production') return 'Completed';
  if (status === 'On Hold') return 'Ready for Production';
  if (status === 'Ready for Production') return 'In Production';
  return 'In Production';
}

function getMoveLabel(status: OperationalProjectStatus | null | undefined): string | null {
  if (!status) return 'Move to Production';
  if (['Completed', 'Delivered', 'Closed'].includes(status)) return null;
  if (status === 'In Production') return 'Mark Complete';
  if (status === 'On Hold') return 'Resume Project';
  if (status === 'Ready for Production') return 'Move to Production';
  return 'Start Production';
}

interface SectionHeaderProps { title: string }
function SectionHeader({ title }: SectionHeaderProps) {
  return (
    <View style={s.sectionHeader}>
      <Text style={s.sectionHeaderText}>{title}</Text>
    </View>
  );
}

interface RowProps { label: string; value?: string | null; children?: React.ReactNode }
function InfoRow({ label, value, children }: RowProps) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      {children ?? <Text style={s.infoValue}>{value || '—'}</Text>}
    </View>
  );
}

export interface ProductionDetailPanelProps {
  project: Quote;
  onClose: () => void;
  onSetStatus: (status: OperationalProjectStatus) => void;
  onSetPriority: (priority: ProjectPriority) => void;
}

function PanelContent({ project, onClose, onSetStatus, onSetPriority }: ProductionDetailPanelProps) {
  const router = useRouter();
  const { currentUser } = useUser();

  const { primaryMockup, mockupGallery } = useMemo(() => resolveMockups(project.lineItems || []), [project.lineItems]);
  const firstItem = project.lineItems?.[0];
  const opStatus = (project.operationalStatus as OperationalProjectStatus) || 'Accepted';
  const opCfg = OPERATIONAL_STATUS_CONFIG[opStatus];
  const priority = (project.priority as ProjectPriority) || DEFAULT_PRIORITY;
  const daysInfo = getDaysInfo(project.inHandsDate);
  const sizeDisplay = useMemo(() => getSizeDisplay(project.lineItems || []), [project.lineItems]);
  const svcLabel = serviceTypeLabel(project);
  const moveLabel = getMoveLabel(opStatus);
  const nextStatus = getNextProductionStatus(opStatus);

  const locations = useMemo(() => {
    if (!firstItem) return [];
    return [firstItem.location1, firstItem.location2, firstItem.location3, firstItem.location4].filter(Boolean) as string[];
  }, [firstItem]);

  const [artworkReceived, setArtworkReceived] = useState(project.artworkReceived ?? false);
  const [proofApproved, setProofApproved] = useState(project.proofApproved ?? false);

  useEffect(() => {
    setArtworkReceived(project.artworkReceived ?? false);
    setProofApproved(project.proofApproved ?? false);
  }, [project.id, project.artworkReceived, project.proofApproved]);

  const patchChecklist = async (field: 'artworkReceived' | 'proofApproved', val: boolean) => {
    try {
      await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: val }),
      });
    } catch (e) { console.error(e); }
  };

  const toggleArtworkReceived = () => {
    const next = !artworkReceived;
    setArtworkReceived(next);
    patchChecklist('artworkReceived', next);
  };

  const toggleProofApproved = () => {
    const next = !proofApproved;
    setProofApproved(next);
    patchChecklist('proofApproved', next);
  };

  const isInProduction = ['In Production', 'Completed', 'Delivered', 'Closed'].includes(opStatus);
  const isCompleted = ['Completed', 'Delivered', 'Closed'].includes(opStatus);

  const handlePunchSheet = async () => {
    try { await generateProjectDocumentPDF(project, 'PRODUCTION', currentUser); } catch (e) { console.error(e); }
  };

  const CheckItem = ({ checked, label, onToggle, derived }: { checked: boolean; label: string; onToggle?: () => void; derived?: boolean }) => (
    <TouchableOpacity
      style={s.checkItem}
      onPress={!derived ? onToggle : undefined}
      activeOpacity={derived ? 1 : 0.7}
    >
      {checked
        ? <CheckSquare size={16} color={Colors.light.tint} />
        : <Square size={16} color={Colors.light.border} />}
      <Text style={[s.checkLabel, checked && s.checkLabelDone]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={s.panel}>
      {/* Header bar */}
      <View style={s.panelBar}>
        <Text style={s.panelBarTitle} numberOfLines={1}>{project.projectNumber || project.invoiceNumber || '—'}</Text>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <X size={20} color={Colors.light.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Mockup hero */}
        <View style={s.heroWrap}>
          {primaryMockup
            ? <Image source={{ uri: primaryMockup }} style={s.heroImg} resizeMode="contain" />
            : <View style={s.heroFallback}><Text style={s.heroInitials}>{getInitials(project.projectName)}</Text></View>}
          {mockupGallery.length > 1 && (
            <View style={s.heroCountBadge}>
              <Text style={s.heroCountText}>{mockupGallery.length} Mockups</Text>
            </View>
          )}
        </View>

        {/* Identity */}
        <View style={s.identity}>
          <View style={s.identityTop}>
            <Text style={s.identityNum}>{project.projectNumber || project.invoiceNumber}</Text>
            <View style={[s.identityStatus, { backgroundColor: opCfg.bg, borderColor: opCfg.borderColor }]}>
              <Text style={[s.identityStatusText, { color: opCfg.color }]}>{opCfg.label}</Text>
            </View>
          </View>
          <Text style={s.identityName}>{project.projectName || '—'}</Text>
          <View style={s.identityMeta}>
            <Text style={s.identityOrg}>{project.personOrganization || '—'}</Text>
            {project.inHandsDate && (
              <>
                <Text style={s.identityDot}> · </Text>
                <Text style={s.identityDue}>Due {formatDate(project.inHandsDate)}</Text>
                {daysInfo.text ? (
                  <View style={[s.daysBadge, { backgroundColor: daysInfo.diff < 0 ? '#FEE2E2' : '#FFF3E8' }]}>
                    <Text style={[s.daysText, { color: daysInfo.diff < 0 ? '#DC2626' : '#FF5A00' }]}>{daysInfo.text}</Text>
                  </View>
                ) : null}
              </>
            )}
          </View>
        </View>

        {/* PRODUCTION */}
        <SectionHeader title="PRODUCTION" />
        <View style={s.sectionBody}>
          <InfoRow label="Service Type" value={svcLabel} />
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Priority</Text>
            <PriorityControl priority={priority} onChange={onSetPriority} small align="right" />
          </View>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Status</Text>
            <OperationalStatusControl status={opStatus} onChange={onSetStatus} align="right" />
          </View>
          {project.holdReason ? <InfoRow label="Hold Reason" value={project.holdReason} /> : null}
        </View>

        {/* PRODUCT */}
        <SectionHeader title="PRODUCT" />
        <View style={s.sectionBody}>
          <InfoRow label="Garment" value={firstItem?.product} />
          <InfoRow label="Color" value={firstItem?.productColor} />
          <InfoRow label="Sizes" value={sizeDisplay} />
        </View>

        {/* DECORATION */}
        <SectionHeader title="DECORATION" />
        <View style={s.sectionBody}>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Locations</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, justifyContent: 'flex-end', flex: 1, marginLeft: 8 }}>
              {locations.length > 0
                ? locations.map((loc, i) => (
                    <View key={i} style={s.locPill}>
                      <Text style={s.locPillText}>{loc}</Text>
                    </View>
                  ))
                : <Text style={s.infoValue}>—</Text>}
            </View>
          </View>
          {firstItem?.locationDetails ? <InfoRow label="Details" value={firstItem.locationDetails} /> : null}
          <InfoRow label="Decoration" value={firstItem?.serviceStyle} />
        </View>

        {/* FILES & DOCUMENTS */}
        <SectionHeader title="FILES & DOCUMENTS" />
        <View style={s.sectionBody}>
          <TouchableOpacity style={s.fileRow} onPress={handlePunchSheet} activeOpacity={0.7}>
            <View style={s.fileIcon}><FileText size={16} color={Colors.light.tint} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.fileLabel}>Production Punch Sheet</Text>
              <Text style={s.fileMeta}>Print-ready PDF</Text>
            </View>
            <Text style={s.fileAction}>View</Text>
          </TouchableOpacity>
          {primaryMockup ? (
            <View style={s.fileRow}>
              <View style={s.fileIcon}><Package size={16} color={Colors.light.textSecondary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.fileLabel}>Mockup</Text>
                <Text style={s.fileMeta}>{mockupGallery.length} file{mockupGallery.length !== 1 ? 's' : ''}</Text>
              </View>
              <TouchableOpacity onPress={() => router.push(`/quote/${project.id}`)} activeOpacity={0.7}>
                <Text style={s.fileAction}>View</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        {/* NOTES */}
        {project.notesClient ? (
          <>
            <SectionHeader title="NOTES" />
            <View style={s.sectionBody}>
              <Text style={s.noteText}>{project.notesClient}</Text>
            </View>
          </>
        ) : null}

        {/* CHECKLIST */}
        <SectionHeader title="CHECKLIST" />
        <View style={s.sectionBody}>
          <View style={s.checkGrid}>
            <View style={s.checkCol}>
              <CheckItem checked={artworkReceived} label="Garments Received" onToggle={toggleArtworkReceived} />
              <CheckItem checked={proofApproved} label="Artwork Approved" onToggle={toggleProofApproved} />
              <CheckItem
                checked={['Ready for Production', 'In Production', 'Completed', 'Delivered', 'Closed'].includes(opStatus)}
                label="Pre-Production Complete"
                derived
              />
            </View>
            <View style={s.checkCol}>
              <CheckItem checked={isInProduction} label="In Production" derived />
              <CheckItem checked={isCompleted} label="Quality Check" derived />
              <CheckItem checked={isCompleted} label="Complete" derived />
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom action bar */}
      <View style={s.bottomBar}>
        {moveLabel ? (
          <TouchableOpacity style={s.primaryBtn} onPress={() => onSetStatus(nextStatus)} activeOpacity={0.8}>
            <Text style={s.primaryBtnText}>{moveLabel}</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={s.secondaryBtn} onPress={handlePunchSheet} activeOpacity={0.8}>
          <FileText size={14} color={Colors.light.text} />
          <Text style={s.secondaryBtnText}>Open Punch Sheet</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function ProductionDetailPanel(props: ProductionDetailPanelProps) {
  const { isMobile } = useBreakpoint();

  if (isMobile) {
    return (
      <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={props.onClose}>
        <PanelContent {...props} />
      </Modal>
    );
  }

  return <PanelContent {...props} />;
}

const s = StyleSheet.create({
  panel: { flex: 1, backgroundColor: Colors.light.surface, borderLeftWidth: 1, borderLeftColor: Colors.light.border },
  panelBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.light.border },
  panelBarTitle: { fontSize: 13, fontWeight: '700', color: Colors.light.textSecondary },

  heroWrap: { width: '100%', height: 200, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center', position: 'relative' },
  heroImg: { width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  heroFallback: { justifyContent: 'center', alignItems: 'center' },
  heroInitials: { fontSize: 40, fontWeight: '800', color: '#fff', letterSpacing: 2 },
  heroCountBadge: { position: 'absolute', bottom: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 5, paddingHorizontal: 8, paddingVertical: 3 },
  heroCountText: { fontSize: 10, fontWeight: '700', color: '#fff' },

  identity: { padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.light.border },
  identityTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  identityNum: { fontSize: 12, fontWeight: '600', color: Colors.light.textSecondary },
  identityStatus: { borderRadius: DS.radius.pill, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2 },
  identityStatusText: { fontSize: 10, fontWeight: '700' },
  identityName: { fontSize: 18, fontWeight: '800', color: Colors.light.text, marginBottom: 4 },
  identityMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 2 },
  identityOrg: { fontSize: 13, color: Colors.light.textSecondary },
  identityDot: { fontSize: 13, color: Colors.light.textSecondary },
  identityDue: { fontSize: 13, color: Colors.light.textSecondary },
  daysBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginLeft: 4 },
  daysText: { fontSize: 10, fontWeight: '700' },

  sectionHeader: { backgroundColor: '#111', paddingHorizontal: 16, paddingVertical: 10 },
  sectionHeaderText: { fontSize: 11, fontWeight: '800', color: '#fff', letterSpacing: 0.8, textTransform: 'uppercase' },
  sectionBody: { paddingHorizontal: 16, paddingVertical: 12, gap: 10, borderBottomWidth: 1, borderBottomColor: Colors.light.border },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 24 },
  infoLabel: { fontSize: 12, fontWeight: '600', color: Colors.light.textSecondary, flex: 1 },
  infoValue: { fontSize: 13, fontWeight: '600', color: Colors.light.text, textAlign: 'right', flex: 1 },
  locPill: { backgroundColor: '#F3F4F6', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  locPillText: { fontSize: 10, fontWeight: '600', color: '#374151' },

  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  fileIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  fileLabel: { fontSize: 13, fontWeight: '600', color: Colors.light.text },
  fileMeta: { fontSize: 11, color: Colors.light.textSecondary, marginTop: 1 },
  fileAction: { fontSize: 12, fontWeight: '700', color: Colors.light.tint },

  noteText: { fontSize: 13, color: Colors.light.text, lineHeight: 19 },

  checkGrid: { flexDirection: 'row', gap: 16 },
  checkCol: { flex: 1, gap: 10 },
  checkItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkLabel: { fontSize: 12, fontWeight: '500', color: Colors.light.text, flex: 1 },
  checkLabelDone: { color: Colors.light.textSecondary, textDecorationLine: 'line-through' },

  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    gap: 8,
    backgroundColor: Colors.light.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    ...(Platform.OS === 'web' ? { boxShadow: '0 -2px 8px rgba(0,0,0,0.06)' } as any : {}),
  },
  primaryBtn: { backgroundColor: Colors.light.tint, borderRadius: DS.radius.md, paddingVertical: 12, alignItems: 'center' },
  primaryBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  secondaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: DS.radius.md, paddingVertical: 10, borderWidth: 1, borderColor: Colors.light.border, backgroundColor: Colors.light.background },
  secondaryBtnText: { fontSize: 13, fontWeight: '600', color: Colors.light.text },
});
