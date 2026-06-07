import { StyleSheet, Platform } from 'react-native';
import Colors from './colors';

export const DS = {
  radius: {
    sm: 8,
    md: 10,
    lg: 12,
    xl: 14,
    xxl: 18,
    pill: 20,
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    section: 32,
  },

  font: {
    pageTitle:   { fontSize: 24, fontWeight: '800' as const, color: Colors.light.text },
    sectionHead: { fontSize: 16, fontWeight: '700' as const, color: Colors.light.text },
    cardTitle:   { fontSize: 15, fontWeight: '700' as const, color: Colors.light.text },
    label:       { fontSize: 11, fontWeight: '700' as const, color: Colors.light.textSecondary, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
    body:        { fontSize: 14, fontWeight: '400' as const, color: Colors.light.text },
    bodySm:      { fontSize: 13, fontWeight: '400' as const, color: Colors.light.text },
    helper:      { fontSize: 12, fontWeight: '400' as const, color: Colors.light.textSecondary },
    helperSm:    { fontSize: 11, fontWeight: '400' as const, color: Colors.light.textSecondary },
    tableHead:   { fontSize: 11, fontWeight: '700' as const, color: '#fff', textTransform: 'uppercase' as const, letterSpacing: 0.5 },
    tableCell:   { fontSize: 13, fontWeight: '400' as const, color: Colors.light.text },
    tableCellSm: { fontSize: 12, fontWeight: '400' as const, color: Colors.light.textSecondary },
    statValue:   { fontSize: 18, fontWeight: '800' as const, color: Colors.light.text },
    statLabel:   { fontSize: 10, fontWeight: '500' as const, color: Colors.light.textSecondary },
  },

  card: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },

  shadow: {
    small: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 6,
      elevation: 2,
    },
    medium: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 12,
      elevation: 8,
    },
  },
};

export const dsStyles = StyleSheet.create({
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: DS.radius.md,
    height: 40,
  },
  btnPrimaryText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#fff',
  },

  btnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: Colors.light.tint,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: DS.radius.md,
    height: 40,
    backgroundColor: Colors.light.surface,
  },
  btnSecondaryText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.tint,
  },

  btnGhost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: DS.radius.md,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.surface,
    height: 40,
  },
  btnGhostText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
  },
  btnGhostActive: {
    borderColor: Colors.light.tint,
    backgroundColor: '#FFF4EE',
  },
  btnGhostTextActive: {
    color: Colors.light.tint,
  },

  btnDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.light.error,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: DS.radius.md,
    height: 40,
  },
  btnDangerText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#fff',
  },

  btnIconSm: {
    width: 36,
    height: 36,
    borderRadius: DS.radius.sm,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },

  viewBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: DS.radius.sm,
    backgroundColor: Colors.light.tint,
    height: 30,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  viewBtnText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#fff',
  },

  searchBox: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    backgroundColor: Colors.light.background,
    borderRadius: DS.radius.md,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 9,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.light.text,
    outlineStyle: 'none' as any,
  },

  pill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: DS.radius.pill,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.background,
  },
  pillActive: {
    borderColor: Colors.light.tint,
    backgroundColor: '#FFF4EE',
  },
  pillText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.light.textSecondary,
  },
  pillTextActive: {
    color: Colors.light.tint,
    fontWeight: '700' as const,
  },
  pillCount: {
    backgroundColor: Colors.light.border,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 4,
  },
  pillCountActive: {
    backgroundColor: Colors.light.tint,
  },
  pillCountText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.light.textSecondary,
  },
  pillCountTextActive: {
    color: '#fff',
  },

  tableHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#000000',
  },
  tableHeaderText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#ffffff',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },

  sectionHeaderBar: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#000000',
  },
  sectionHeaderText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#fff',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.6,
  },

  pageHeader: {
    backgroundColor: Colors.light.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    paddingTop: Platform.OS === 'web' ? 0 : 48,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: Colors.light.text,
  },

  statsBar: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#FAFAFA',
    borderRadius: DS.radius.md,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  statItem: { flex: 1, alignItems: 'center' as const },
  statValue: { fontSize: 20, fontWeight: '800' as const, color: Colors.light.text, lineHeight: 24 },
  statLabel: { fontSize: 11, color: Colors.light.textSecondary, fontWeight: '600' as const, marginTop: 2 },
  statDivider: { width: 1, height: 28, backgroundColor: Colors.light.border },

  statusBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: DS.radius.pill,
    borderWidth: 1,
    alignSelf: 'flex-start' as const,
  },
  statusBadgeDot: { width: 6, height: 6, borderRadius: 3 },
  statusBadgeText: { fontSize: 11, fontWeight: '700' as const },

  filterPanel: {
    backgroundColor: Colors.light.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },

  inputField: {
    backgroundColor: Colors.light.background,
    borderRadius: DS.radius.md,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.light.text,
    outlineStyle: 'none' as any,
  },

  fieldLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.4,
    marginBottom: 5,
  },

  emptyState: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    gap: 10,
    padding: 40,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700' as const, color: Colors.light.text },
  emptyText: { fontSize: 14, color: Colors.light.textSecondary, textAlign: 'center' as const },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  modalCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: DS.radius.xxl,
    padding: 20,
    maxHeight: '90%' as any,
  },
  modalHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 18,
  },
  modalTitle: { fontSize: 18, fontWeight: '800' as const, color: Colors.light.text },

  saveBtn: {
    backgroundColor: Colors.light.tint,
    paddingVertical: 14,
    borderRadius: DS.radius.lg,
    alignItems: 'center' as const,
    marginTop: 16,
  },
  saveBtnDisabled: { opacity: 0.45 },
  saveBtnText: { fontSize: 15, fontWeight: '700' as const, color: '#fff' },
});
