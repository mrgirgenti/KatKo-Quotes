import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Pressable,
} from 'react-native';
import {
  MoreVertical,
  Upload,
  Download,
  FileDown,
  RotateCcw,
  Copy,
  RefreshCw,
} from 'lucide-react-native';
import OverlayMenu from '@/components/OverlayMenu';
import Colors from '@/constants/colors';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ImportMode = 'append' | 'replace' | 'skip';

export interface LibraryImportPreview {
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
  errors: string[];
  rows: any[];
}

interface LibraryManagementMenuProps {
  libraryName: string;
  /** When importing XLSX, read this sheet name. Falls back to first sheet. */
  xlsxSheetName?: string;
  variant?: 'dark' | 'light';
  /** Called when user picks a CSV or XLSX file (converted to CSV). Parse and validate; return preview. */
  onParseImport: (content: string, format: 'csv' | 'json') => LibraryImportPreview;
  onConfirmImport: (rows: any[], mode: ImportMode) => Promise<void>;
  getExportData: (format: 'csv' | 'json') => string;
  getTemplateData: () => string;
}

// ── Download helper ───────────────────────────────────────────────────────────

function triggerDownload(filename: string, content: string, mimeType: string) {
  if (typeof document === 'undefined') return;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ── XLSX parsing ──────────────────────────────────────────────────────────────

async function xlsxSheetToCsv(buffer: ArrayBuffer, sheetName?: string): Promise<string> {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(buffer, { type: 'array' });
  let targetSheet = wb.Sheets[wb.SheetNames[0]];
  if (sheetName) {
    const found = Object.keys(wb.Sheets).find(
      (k) => k.trim().toLowerCase() === sheetName.trim().toLowerCase(),
    );
    if (found) targetSheet = wb.Sheets[found];
  }
  if (!targetSheet) return '';
  return XLSX.utils.sheet_to_csv(targetSheet);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LibraryManagementMenu({
  libraryName,
  xlsxSheetName,
  variant = 'dark',
  onParseImport,
  onConfirmImport,
  getExportData,
  getTemplateData,
}: LibraryManagementMenuProps) {
  const [preview, setPreview] = useState<LibraryImportPreview | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>('append');
  const [importing, setImporting] = useState(false);
  const [xlsxParsing, setXlsxParsing] = useState(false);

  const slug = slugify(libraryName);
  const iconColor = variant === 'dark' ? '#fff' : Colors.light.textSecondary;

  function pickCsv() {
    if (typeof document === 'undefined') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,text/csv';
    input.onchange = (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const content = ev.target?.result as string;
        if (!content) return;
        const result = onParseImport(content, 'csv');
        setPreview(result);
        setImportMode('append');
      };
      reader.readAsText(file);
    };
    input.click();
  }

  function pickXlsx() {
    if (typeof document === 'undefined') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    input.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setXlsxParsing(true);
      try {
        const buffer = await file.arrayBuffer();
        const csv = await xlsxSheetToCsv(buffer, xlsxSheetName);
        if (!csv) {
          setPreview({ validCount: 0, invalidCount: 0, duplicateCount: 0, errors: ['Could not read sheet. Check the file or sheet name.'], rows: [] });
          setImportMode('append');
          return;
        }
        const result = onParseImport(csv, 'csv');
        setPreview(result);
        setImportMode('append');
      } catch (err: any) {
        setPreview({ validCount: 0, invalidCount: 0, duplicateCount: 0, errors: [`XLSX parse error: ${err?.message ?? 'unknown'}`], rows: [] });
        setImportMode('append');
      } finally {
        setXlsxParsing(false);
      }
    };
    input.click();
  }

  function handleExport(format: 'csv' | 'json') {
    const content = getExportData(format);
    const ext = format === 'csv' ? 'csv' : 'json';
    const mime = format === 'csv' ? 'text/csv' : 'application/json';
    triggerDownload(`${slug}-export.${ext}`, content, mime);
  }

  function handleDownloadTemplate() {
    const content = getTemplateData();
    triggerDownload(`${slug}-import-template.csv`, content, 'text/csv');
  }

  async function handleConfirmImport() {
    if (!preview) return;
    setImporting(true);
    try {
      await onConfirmImport(preview.rows, importMode);
      setPreview(null);
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
      <OverlayMenu
        menuWidth={228}
        align="right"
        trigger={({ open }) => (
          <TouchableOpacity
            onPress={open}
            style={mm.trigger}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {xlsxParsing ? (
              <ActivityIndicator size="small" color={iconColor} />
            ) : (
              <MoreVertical size={17} color={iconColor} />
            )}
          </TouchableOpacity>
        )}
      >
        {({ close }) => (
          <>
            <Text style={mm.sectionLabel}>Import</Text>

            <TouchableOpacity
              style={mm.item}
              onPress={() => { close(); pickCsv(); }}
              activeOpacity={0.7}
            >
              <Upload size={13} color={Colors.light.tint} />
              <Text style={mm.itemText}>Import CSV…</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={mm.item}
              onPress={() => { close(); pickXlsx(); }}
              activeOpacity={0.7}
            >
              <Upload size={13} color={Colors.light.tint} />
              <Text style={mm.itemText}>Import XLSX…</Text>
            </TouchableOpacity>

            <View style={mm.divider} />
            <Text style={mm.sectionLabel}>Export</Text>

            <TouchableOpacity
              style={mm.item}
              onPress={() => { close(); handleExport('csv'); }}
              activeOpacity={0.7}
            >
              <Download size={13} color={Colors.light.tint} />
              <Text style={mm.itemText}>Export CSV</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={mm.item}
              onPress={() => { close(); handleExport('json'); }}
              activeOpacity={0.7}
            >
              <Download size={13} color={Colors.light.tint} />
              <Text style={mm.itemText}>Export JSON</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={mm.item}
              onPress={() => { close(); handleDownloadTemplate(); }}
              activeOpacity={0.7}
            >
              <FileDown size={13} color={Colors.light.textSecondary} />
              <Text style={mm.itemText}>Download CSV Template</Text>
            </TouchableOpacity>

            <View style={mm.divider} />
            <Text style={mm.sectionLabel}>Advanced</Text>

            <View style={[mm.item, mm.itemDisabled]}>
              <RotateCcw size={13} color={Colors.light.textSecondary} />
              <Text style={[mm.itemText, mm.itemTextDisabled]}>Restore Factory Defaults</Text>
              <Text style={mm.comingSoon}>Soon</Text>
            </View>

            <View style={[mm.item, mm.itemDisabled]}>
              <Copy size={13} color={Colors.light.textSecondary} />
              <Text style={[mm.itemText, mm.itemTextDisabled]}>Duplicate Library</Text>
              <Text style={mm.comingSoon}>Soon</Text>
            </View>

            <View style={[mm.item, mm.itemDisabled]}>
              <RefreshCw size={13} color={Colors.light.textSecondary} />
              <Text style={[mm.itemText, mm.itemTextDisabled]}>Reset Library</Text>
              <Text style={mm.comingSoon}>Soon</Text>
            </View>
          </>
        )}
      </OverlayMenu>

      {/* ── Import Preview Modal ─────────────────────────────────────────────── */}
      {preview !== null && (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => { if (!importing) setPreview(null); }}
        >
          <Pressable
            style={imp.backdrop}
            onPress={() => { if (!importing) setPreview(null); }}
          >
            <Pressable style={imp.panel} onPress={(e) => e.stopPropagation()}>
              <View style={imp.header}>
                <Text style={imp.title}>Import {libraryName}</Text>
              </View>

              <ScrollView
                style={imp.scroll}
                contentContainerStyle={imp.scrollContent}
                keyboardShouldPersistTaps="handled"
              >
                {/* Summary counts */}
                <View style={imp.summaryRow}>
                  <View style={imp.summaryItem}>
                    <Text style={[imp.summaryCount, { color: '#16A34A' }]}>{preview.validCount}</Text>
                    <Text style={imp.summaryLabel}>Valid</Text>
                  </View>
                  <View style={imp.summaryItem}>
                    <Text style={[imp.summaryCount, { color: preview.duplicateCount > 0 ? '#D97706' : Colors.light.textSecondary }]}>
                      {preview.duplicateCount}
                    </Text>
                    <Text style={imp.summaryLabel}>Duplicates</Text>
                  </View>
                  <View style={imp.summaryItem}>
                    <Text style={[imp.summaryCount, { color: preview.invalidCount > 0 ? Colors.light.error : Colors.light.textSecondary }]}>
                      {preview.invalidCount}
                    </Text>
                    <Text style={imp.summaryLabel}>Invalid</Text>
                  </View>
                </View>

                {/* Validation errors */}
                {preview.errors.length > 0 && (
                  <View style={imp.errorBox}>
                    <Text style={imp.errorTitle}>Validation Issues</Text>
                    {preview.errors.map((e, i) => (
                      <Text key={i} style={imp.errorItem}>• {e}</Text>
                    ))}
                  </View>
                )}

                {/* Import mode */}
                {preview.validCount > 0 && (
                  <>
                    <Text style={imp.modeHeading}>Import Mode</Text>
                    {(
                      [
                        { value: 'append' as const, label: 'Append', hint: 'Add all valid rows as new entries' },
                        { value: 'replace' as const, label: 'Replace Existing', hint: 'Update matching names; add the rest' },
                        { value: 'skip' as const, label: 'Skip Duplicates', hint: 'Ignore matching names; add the rest' },
                      ]
                    ).map((opt) => (
                      <TouchableOpacity
                        key={opt.value}
                        style={[imp.modeOption, importMode === opt.value && imp.modeOptionActive]}
                        onPress={() => setImportMode(opt.value)}
                        activeOpacity={0.7}
                      >
                        <View style={[imp.radio, importMode === opt.value && imp.radioActive]} />
                        <View style={{ flex: 1 }}>
                          <Text style={[imp.modeLabel, importMode === opt.value && imp.modeLabelActive]}>{opt.label}</Text>
                          <Text style={imp.modeHint}>{opt.hint}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}

                    {importMode === 'replace' && preview.duplicateCount > 0 && (
                      <View style={imp.warningBox}>
                        <Text style={imp.warningText}>
                          ⚠ This will overwrite {preview.duplicateCount} existing record{preview.duplicateCount !== 1 ? 's' : ''}. This cannot be undone.
                        </Text>
                      </View>
                    )}
                  </>
                )}

                {preview.validCount === 0 && preview.invalidCount === 0 && preview.errors.length === 0 && (
                  <Text style={imp.emptyNote}>No rows found in this file.</Text>
                )}
              </ScrollView>

              <View style={imp.footer}>
                <TouchableOpacity
                  style={imp.cancelBtn}
                  onPress={() => setPreview(null)}
                  disabled={importing}
                  activeOpacity={0.7}
                >
                  <Text style={imp.cancelText}>Cancel</Text>
                </TouchableOpacity>

                {preview.validCount > 0 && (
                  <TouchableOpacity
                    style={[imp.importBtn, importing && imp.importBtnDisabled]}
                    onPress={handleConfirmImport}
                    disabled={importing}
                    activeOpacity={0.85}
                  >
                    {importing ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={imp.importBtnText}>
                        Import {preview.validCount} Record{preview.validCount !== 1 ? 's' : ''}
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const mm = StyleSheet.create({
  trigger: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
  sectionLabel: { fontSize: 9, fontWeight: '700', color: Colors.light.textSecondary, letterSpacing: 0.6, textTransform: 'uppercase', paddingHorizontal: 14, paddingTop: 8, paddingBottom: 4 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 14, paddingVertical: 9 },
  itemText: { fontSize: 13, color: Colors.light.text, flex: 1 },
  itemDisabled: { opacity: 0.45 },
  itemTextDisabled: { color: Colors.light.textSecondary },
  comingSoon: { fontSize: 9, fontWeight: '700', color: Colors.light.textSecondary, backgroundColor: Colors.light.background, borderWidth: 1, borderColor: Colors.light.border, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2, letterSpacing: 0.3, textTransform: 'uppercase' },
  divider: { height: 1, backgroundColor: Colors.light.border, marginVertical: 4, marginHorizontal: 10 },
});

const imp = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  panel: { width: 460, maxWidth: '92%', maxHeight: '80%', backgroundColor: '#fff', borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 24, elevation: 10, overflow: 'hidden' },
  header: { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.light.border },
  title: { fontSize: 16, fontWeight: '700', color: Colors.light.text },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 12 },
  summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  summaryItem: { flex: 1, alignItems: 'center', paddingVertical: 12, borderWidth: 1, borderColor: Colors.light.border, borderRadius: 8, backgroundColor: Colors.light.background },
  summaryCount: { fontSize: 24, fontWeight: '700' },
  summaryLabel: { fontSize: 11, color: Colors.light.textSecondary, marginTop: 2, fontWeight: '500' },
  errorBox: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 8, padding: 12, marginBottom: 16 },
  errorTitle: { fontSize: 12, fontWeight: '700', color: '#991B1B', marginBottom: 6 },
  errorItem: { fontSize: 12, color: '#7F1D1D', lineHeight: 18 },
  modeHeading: { fontSize: 12, fontWeight: '700', color: Colors.light.textSecondary, letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 8 },
  modeOption: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: Colors.light.border, borderRadius: 8, marginBottom: 6, backgroundColor: Colors.light.background },
  modeOptionActive: { borderColor: Colors.light.tint, backgroundColor: '#FFF7ED' },
  radio: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: Colors.light.border },
  radioActive: { borderColor: Colors.light.tint, backgroundColor: Colors.light.tint },
  modeLabel: { fontSize: 13, fontWeight: '600', color: Colors.light.text },
  modeLabelActive: { color: Colors.light.tint },
  modeHint: { fontSize: 11, color: Colors.light.textSecondary, marginTop: 1 },
  warningBox: { backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 8, padding: 12, marginTop: 8 },
  warningText: { fontSize: 12, color: '#92400E', lineHeight: 17 },
  emptyNote: { fontSize: 13, color: Colors.light.textSecondary, textAlign: 'center', paddingVertical: 20 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: Colors.light.border, backgroundColor: Colors.light.background },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 8, borderWidth: 1, borderColor: Colors.light.border },
  cancelText: { fontSize: 13, fontWeight: '600', color: Colors.light.text },
  importBtn: { paddingHorizontal: 20, paddingVertical: 9, borderRadius: 8, backgroundColor: Colors.light.tint, minWidth: 80, alignItems: 'center' },
  importBtnDisabled: { opacity: 0.6 },
  importBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
});
