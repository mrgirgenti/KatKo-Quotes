import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { DS } from '@/constants/designSystem';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import type { Quote, OperationalProjectStatus } from '@/types/quote';
import { OPERATIONAL_STATUS_CONFIG } from '@/types/quote';
import { parseProjectDate } from '@/lib/production';
import { resolveMockups } from '@/utils/mockupService';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function getInitials(name?: string) {
  if (!name) return '?';
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

function buildCalendarDays(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = firstDay.getDay();
  const days: (Date | null)[] = [];
  for (let i = 0; i < startPad; i++) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d));
  const trailing = 7 - (days.length % 7);
  if (trailing < 7) for (let i = 0; i < trailing; i++) days.push(null);
  return days;
}

interface MiniMockupProps { project: Quote }
function MiniMockup({ project }: MiniMockupProps) {
  const { primaryMockup } = useMemo(() => resolveMockups(project.lineItems || []), [project.lineItems]);
  const opStatus = (project.operationalStatus as OperationalProjectStatus) || 'Accepted';
  const cfg = OPERATIONAL_STATUS_CONFIG[opStatus];
  return (
    <View style={cs.miniCard}>
      <View style={cs.miniMockupWrap}>
        {primaryMockup
          ? <Image source={{ uri: primaryMockup }} style={cs.miniMockupImg} resizeMode="contain" />
          : <View style={cs.miniFallback}><Text style={cs.miniFallbackText}>{getInitials(project.projectName)}</Text></View>}
      </View>
      <Text style={cs.miniName} numberOfLines={1}>{project.projectName || '—'}</Text>
      <View style={[cs.miniStatusDot, { backgroundColor: cfg.bg, borderColor: cfg.borderColor }]}>
        <Text style={[cs.miniStatusText, { color: cfg.color }]} numberOfLines={1}>{cfg.label}</Text>
      </View>
    </View>
  );
}

export interface ProductionCalendarProps {
  projects: Quote[];
  selectedId: string | null;
  onSelectProject: (q: Quote | null) => void;
  currentMonth: Date;
  onChangeMonth: (d: Date) => void;
}

export function ProductionCalendar({ projects, selectedId, onSelectProject, currentMonth, onChangeMonth }: ProductionCalendarProps) {
  const { isMobile } = useBreakpoint();

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const days = useMemo(() => buildCalendarDays(year, month), [year, month]);

  const projectsByDate = useMemo(() => {
    const map: Record<string, Quote[]> = {};
    projects.forEach((q) => {
      const d = parseProjectDate(q.inHandsDate);
      if (!d) return;
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map[key]) map[key] = [];
      map[key].push(q);
    });
    return map;
  }, [projects]);

  const todayD = new Date();
  const todayKey = `${todayD.getFullYear()}-${todayD.getMonth()}-${todayD.getDate()}`;

  const goBack = () => {
    const d = new Date(year, month - 1, 1);
    onChangeMonth(d);
  };
  const goForward = () => {
    const d = new Date(year, month + 1, 1);
    onChangeMonth(d);
  };

  if (isMobile) {
    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <View style={cs.mobileNav}>
          <TouchableOpacity onPress={goBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <ChevronLeft size={20} color={Colors.light.text} />
          </TouchableOpacity>
          <Text style={cs.mobileNavTitle}>{MONTHS[month]} {year}</Text>
          <TouchableOpacity onPress={goForward} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <ChevronRight size={20} color={Colors.light.text} />
          </TouchableOpacity>
        </View>

        {projects.filter((q) => {
          const d = parseProjectDate(q.inHandsDate);
          if (!d) return false;
          return d.getMonth() === month && d.getFullYear() === year;
        }).sort((a, b) => {
          const da = parseProjectDate(a.inHandsDate)?.getTime() ?? 0;
          const db = parseProjectDate(b.inHandsDate)?.getTime() ?? 0;
          return da - db;
        }).map((q) => {
          const d = parseProjectDate(q.inHandsDate)!;
          const opStatus = (q.operationalStatus as OperationalProjectStatus) || 'Accepted';
          const cfg = OPERATIONAL_STATUS_CONFIG[opStatus];
          const { primaryMockup } = resolveMockups(q.lineItems || []);
          const isSelected = q.id === selectedId;
          return (
            <TouchableOpacity key={q.id} style={[cs.agendaCard, isSelected && cs.agendaCardSelected]} onPress={() => onSelectProject(isSelected ? null : q)} activeOpacity={0.8}>
              <View style={cs.agendaDate}>
                <Text style={cs.agendaDateNum}>{d.getDate()}</Text>
                <Text style={cs.agendaDateDay}>{WEEKDAYS[d.getDay()]}</Text>
              </View>
              <View style={cs.agendaMockupWrap}>
                {primaryMockup
                  ? <Image source={{ uri: primaryMockup }} style={cs.agendaMockup} resizeMode="contain" />
                  : <View style={cs.agendaFallback}><Text style={cs.agendaFallbackText}>{getInitials(q.projectName)}</Text></View>}
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={cs.agendaName} numberOfLines={1}>{q.projectName || '—'}</Text>
                <Text style={cs.agendaOrg} numberOfLines={1}>{q.personOrganization}</Text>
                <View style={[cs.agendaStatus, { backgroundColor: cfg.bg, borderColor: cfg.borderColor }]}>
                  <Text style={[cs.agendaStatusText, { color: cfg.color }]}>{cfg.label}</Text>
                </View>
              </View>
              <ChevronRight size={16} color={Colors.light.textSecondary} />
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Calendar nav */}
      <View style={cs.nav}>
        <TouchableOpacity style={cs.navBtn} onPress={goBack}>
          <ChevronLeft size={18} color={Colors.light.text} />
        </TouchableOpacity>
        <Text style={cs.navTitle}>{MONTHS[month]} {year}</Text>
        <TouchableOpacity style={cs.navBtn} onPress={goForward}>
          <ChevronRight size={18} color={Colors.light.text} />
        </TouchableOpacity>
      </View>

      {/* Weekday headers */}
      <View style={cs.weekRow}>
        {WEEKDAYS.map((d) => (
          <View key={d} style={cs.weekCell}>
            <Text style={cs.weekLabel}>{d}</Text>
          </View>
        ))}
      </View>

      {/* Days grid */}
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <View style={cs.grid}>
          {days.map((day, idx) => {
            if (!day) {
              return <View key={`pad-${idx}`} style={cs.cell} />;
            }
            const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
            const dayProjects = projectsByDate[key] || [];
            const isToday = key === todayKey;
            const isOtherMonth = day.getMonth() !== month;

            return (
              <View key={key} style={[cs.cell, isToday && cs.cellToday]}>
                <Text style={[cs.dayNum, isToday && cs.dayNumToday, isOtherMonth && cs.dayNumOther]}>
                  {day.getDate()}
                </Text>
                <View style={cs.dayProjects}>
                  {dayProjects.slice(0, 3).map((q) => {
                    const { primaryMockup } = resolveMockups(q.lineItems || []);
                    const opStatus = (q.operationalStatus as OperationalProjectStatus) || 'Accepted';
                    const cfg = OPERATIONAL_STATUS_CONFIG[opStatus];
                    const isSelected = q.id === selectedId;
                    return (
                      <TouchableOpacity
                        key={q.id}
                        style={[cs.calCard, isSelected && cs.calCardSelected, { borderLeftColor: cfg.bg }]}
                        onPress={() => onSelectProject(isSelected ? null : q)}
                        activeOpacity={0.8}
                      >
                        {primaryMockup
                          ? <Image source={{ uri: primaryMockup }} style={cs.calThumb} resizeMode="contain" />
                          : <View style={cs.calThumbFallback}><Text style={cs.calThumbText}>{getInitials(q.projectName)[0]}</Text></View>}
                        <Text style={cs.calCardName} numberOfLines={1}>{q.projectName}</Text>
                      </TouchableOpacity>
                    );
                  })}
                  {dayProjects.length > 3 && (
                    <Text style={cs.moreText}>+{dayProjects.length - 3} more</Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const CELL_MIN_HEIGHT = 110;

const cs = StyleSheet.create({
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: DS.spacing.xl, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.light.border },
  navBtn: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, borderColor: Colors.light.border, justifyContent: 'center', alignItems: 'center' },
  navTitle: { fontSize: 17, fontWeight: '800', color: Colors.light.text },

  weekRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.light.border },
  weekCell: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  weekLabel: { fontSize: 11, fontWeight: '700', color: Colors.light.textSecondary, textTransform: 'uppercase' },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%` as any, minHeight: CELL_MIN_HEIGHT, borderRightWidth: 1, borderBottomWidth: 1, borderColor: Colors.light.border, padding: 6 },
  cellToday: { backgroundColor: '#FFF8F4' },
  dayNum: { fontSize: 13, fontWeight: '600', color: Colors.light.text, marginBottom: 4 },
  dayNumToday: { color: Colors.light.tint, fontWeight: '800' },
  dayNumOther: { color: Colors.light.textSecondary, opacity: 0.4 },
  dayProjects: { gap: 3 },

  calCard: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F9FAFB', borderRadius: 4, borderLeftWidth: 2, borderLeftColor: '#ddd', paddingHorizontal: 4, paddingVertical: 3, overflow: 'hidden' },
  calCardSelected: { backgroundColor: '#FFF4EE', borderLeftColor: Colors.light.tint },
  calThumb: { width: 20, height: 20, borderRadius: 3, backgroundColor: '#111' },
  calThumbFallback: { width: 20, height: 20, borderRadius: 3, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' },
  calThumbText: { fontSize: 9, fontWeight: '800', color: '#fff' },
  calCardName: { flex: 1, fontSize: 10, fontWeight: '600', color: Colors.light.text },
  moreText: { fontSize: 10, color: Colors.light.textSecondary, fontWeight: '600', paddingLeft: 2 },

  miniCard: { backgroundColor: Colors.light.surface, borderRadius: 6, borderWidth: 1, borderColor: Colors.light.border, overflow: 'hidden', width: 120 },
  miniMockupWrap: { width: '100%', height: 60, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' },
  miniMockupImg: { width: '100%', height: '100%' },
  miniFallback: { justifyContent: 'center', alignItems: 'center', width: '100%', height: '100%' },
  miniFallbackText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  miniName: { fontSize: 10, fontWeight: '600', color: Colors.light.text, padding: 4, paddingBottom: 2 },
  miniStatusDot: { margin: 4, borderRadius: 3, borderWidth: 1, paddingHorizontal: 4, paddingVertical: 1 },
  miniStatusText: { fontSize: 9, fontWeight: '700' },

  mobileNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  mobileNavTitle: { fontSize: 17, fontWeight: '800', color: Colors.light.text },

  agendaCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.light.surface, borderRadius: DS.radius.lg, borderWidth: 1, borderColor: Colors.light.border, padding: 10, marginBottom: 8 },
  agendaCardSelected: { borderColor: Colors.light.tint },
  agendaDate: { width: 40, alignItems: 'center' },
  agendaDateNum: { fontSize: 20, fontWeight: '800', color: Colors.light.text },
  agendaDateDay: { fontSize: 10, fontWeight: '600', color: Colors.light.textSecondary },
  agendaMockupWrap: { width: 52, height: 52, borderRadius: 8, overflow: 'hidden', backgroundColor: '#111' },
  agendaMockup: { width: 52, height: 52 },
  agendaFallback: { width: 52, height: 52, justifyContent: 'center', alignItems: 'center' },
  agendaFallbackText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  agendaName: { fontSize: 14, fontWeight: '700', color: Colors.light.text },
  agendaOrg: { fontSize: 12, color: Colors.light.textSecondary },
  agendaStatus: { borderRadius: 4, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start' },
  agendaStatusText: { fontSize: 9, fontWeight: '700' },
});
