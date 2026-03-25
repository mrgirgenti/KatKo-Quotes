import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { X, Upload, ClipboardPaste, Check, AlertCircle, ChevronDown, FileText, Users } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useCrm } from '@/contexts/CrmContext';
import { CrmStatus, ContactRole } from '@/types/crm';
import { generateId } from '@/utils/quoteCalculations';

type ImportField = 'firstName' | 'lastName' | 'fullName' | 'email' | 'phone' | 'organization' | 'role' | 'city' | 'state' | 'notes' | 'skip';

const FIELD_OPTIONS: { key: ImportField; label: string }[] = [
  { key: 'skip', label: '— Skip —' },
  { key: 'firstName', label: 'First Name' },
  { key: 'lastName', label: 'Last Name' },
  { key: 'fullName', label: 'Full Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'organization', label: 'Organization' },
  { key: 'role', label: 'Job Title / Role' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'notes', label: 'Notes' },
];

const COLUMN_HINTS: Record<string, ImportField> = {
  'first name': 'firstName', 'first': 'firstName', 'firstname': 'firstName', 'fname': 'firstName', 'given name': 'firstName',
  'last name': 'lastName', 'last': 'lastName', 'lastname': 'lastName', 'lname': 'lastName', 'surname': 'lastName', 'family name': 'lastName',
  'full name': 'fullName', 'name': 'fullName', 'contact name': 'fullName', 'contact': 'fullName',
  'email': 'email', 'email address': 'email', 'e-mail': 'email', 'mail': 'email',
  'phone': 'phone', 'phone number': 'phone', 'mobile': 'phone', 'cell': 'phone', 'telephone': 'phone', 'tel': 'phone',
  'company': 'organization', 'organization': 'organization', 'organisation': 'organization', 'church': 'organization', 'school': 'organization', 'employer': 'organization', 'business': 'organization',
  'title': 'role', 'job title': 'role', 'role': 'role', 'position': 'role', 'department': 'skip',
  'city': 'city', 'town': 'city',
  'state': 'state', 'province': 'state',
  'notes': 'notes', 'note': 'notes', 'comments': 'notes',
};

function detectDelimiter(text: string): string {
  const line = text.split('\n')[0] || '';
  const tabs = (line.match(/\t/g) || []).length;
  const commas = (line.match(/,/g) || []).length;
  const semis = (line.match(/;/g) || []).length;
  if (tabs >= commas && tabs >= semis) return '\t';
  if (semis > commas) return ';';
  return ',';
}

function parseCSV(text: string, delimiter: string): string[][] {
  const lines = text.trim().split('\n').filter((l) => l.trim());
  return lines.map((line) => {
    if (delimiter === ',') {
      const cells: string[] = [];
      let cur = '', inQ = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') { inQ = !inQ; }
        else if (ch === ',' && !inQ) { cells.push(cur.trim()); cur = ''; }
        else { cur += ch; }
      }
      cells.push(cur.trim());
      return cells;
    }
    return line.split(delimiter).map((c) => c.trim().replace(/^"|"$/g, ''));
  });
}

function autoMap(headers: string[]): ImportField[] {
  return headers.map((h) => {
    const key = h.toLowerCase().trim();
    return COLUMN_HINTS[key] || 'skip';
  });
}

interface ParsedContact {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  organization: string;
  role: string;
  city: string;
  state: string;
  notes: string;
  valid: boolean;
  warning?: string;
}

function buildContacts(rows: string[][], mapping: ImportField[]): ParsedContact[] {
  return rows.map((row) => {
    let firstName = '', lastName = '', fullName = '', email = '', phone = '', organization = '', role = '', city = '', state = '', notes = '';
    mapping.forEach((field, i) => {
      const val = (row[i] || '').trim();
      if (!val) return;
      if (field === 'firstName') firstName = val;
      else if (field === 'lastName') lastName = val;
      else if (field === 'fullName') fullName = val;
      else if (field === 'email') email = val;
      else if (field === 'phone') phone = val;
      else if (field === 'organization') organization = val;
      else if (field === 'role') role = val;
      else if (field === 'city') city = val;
      else if (field === 'state') state = val;
      else if (field === 'notes') notes = val;
    });
    if (fullName && !firstName && !lastName) {
      const parts = fullName.trim().split(/\s+/);
      firstName = parts[0] || '';
      lastName = parts.slice(1).join(' ') || '';
    }
    const valid = !!(firstName || lastName || email);
    const warning = !firstName && !lastName ? 'Missing name' : undefined;
    return { firstName, lastName, email, phone, organization, role, city, state, notes, valid, warning };
  }).filter((c) => c.valid || c.email);
}

type Step = 'input' | 'mapping' | 'preview' | 'done';
type InputTab = 'paste' | 'file';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function ContactImportModal({ visible, onClose }: Props) {
  const { bulkImportOrgs } = useCrm();
  const [step, setStep] = useState<Step>('input');
  const [inputTab, setInputTab] = useState<InputTab>('paste');
  const [rawText, setRawText] = useState('');
  const [rows, setRows] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ImportField[]>([]);
  const [parsed, setParsed] = useState<ParsedContact[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<any>(null);

  const reset = useCallback(() => {
    setStep('input');
    setInputTab('paste');
    setRawText('');
    setRows([]);
    setHeaders([]);
    setMapping([]);
    setParsed([]);
    setDropdownOpen(null);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const parsePaste = useCallback(() => {
    if (!rawText.trim()) return;
    const delim = detectDelimiter(rawText);
    const allRows = parseCSV(rawText, delim);
    if (allRows.length < 2) {
      Alert.alert('Not enough data', 'Please paste at least one header row and one data row.');
      return;
    }
    const hdr = allRows[0];
    const dataRows = allRows.slice(1).filter((r) => r.some((c) => c.trim()));
    setHeaders(hdr);
    setRows(dataRows);
    setMapping(autoMap(hdr));
    setStep('mapping');
  }, [rawText]);

  const handleFileUpload = useCallback((e: any) => {
    const file = e.target?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (!text) return;
      const delim = detectDelimiter(text);
      const allRows = parseCSV(text, delim);
      if (allRows.length < 2) return;
      const hdr = allRows[0];
      const dataRows = allRows.slice(1).filter((r) => r.some((c) => c.trim()));
      setHeaders(hdr);
      setRows(dataRows);
      setMapping(autoMap(hdr));
      setStep('mapping');
    };
    reader.readAsText(file);
  }, []);

  const applyMapping = useCallback(() => {
    const contacts = buildContacts(rows, mapping);
    if (contacts.length === 0) {
      Alert.alert('No valid contacts', 'Could not find any contacts with a name or email. Check your column mapping.');
      return;
    }
    setParsed(contacts);
    setStep('preview');
  }, [rows, mapping]);

  const handleImport = useCallback(() => {
    setImporting(true);
    try {
      const toImport = parsed.filter((c) => c.valid !== false);
      const now = new Date().toISOString();
      const orgsToAdd = toImport.map((c) => ({
        id: generateId(),
        name: c.organization || `${c.firstName} ${c.lastName}`.trim(),
        type: undefined,
        city: c.city || undefined,
        state: c.state || undefined,
        status: 'Cold' as CrmStatus,
        createdAt: now,
        departments: [],
        contacts: [{
          id: generateId(),
          organizationId: '',
          createdAt: now,
          firstName: c.firstName || (c.email ? c.email.split('@')[0] : 'Unknown'),
          lastName: c.lastName,
          role: (c.role || 'Primary Contact') as ContactRole,
          email: c.email || undefined,
          phone: c.phone || undefined,
          notes: c.notes || undefined,
          isPrimary: true,
        }],
        activityLog: [],
        campaigns: [],
      }));
      orgsToAdd.forEach((o) => {
        o.contacts = o.contacts.map((c) => ({ ...c, organizationId: o.id }));
      });
      bulkImportOrgs(orgsToAdd as any);
      setStep('done');
    } finally {
      setImporting(false);
    }
  }, [parsed, bulkImportOrgs]);

  const validCount = parsed.filter((c) => c.valid).length;
  const warnCount = parsed.filter((c) => c.warning).length;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={styles.overlay} onPress={handleClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Users size={18} color={Colors.light.tint} />
              <Text style={styles.headerTitle}>
                {step === 'input' ? 'Import Contacts' : step === 'mapping' ? 'Map Columns' : step === 'preview' ? 'Preview Import' : 'Import Complete'}
              </Text>
            </View>
            <TouchableOpacity onPress={handleClose}><X size={22} color={Colors.light.textSecondary} /></TouchableOpacity>
          </View>

          {/* Step indicator */}
          <View style={styles.stepRow}>
            {(['input', 'mapping', 'preview'] as Step[]).map((s, i) => (
              <React.Fragment key={s}>
                <View style={[styles.stepDot, (step === s || (step === 'done' && i < 3)) && styles.stepDotActive]}>
                  <Text style={[styles.stepDotText, (step === s || step === 'done') && styles.stepDotTextActive]}>{i + 1}</Text>
                </View>
                {i < 2 && <View style={[styles.stepLine, step !== 'input' && i === 0 && styles.stepLineActive, step === 'preview' && i === 1 && styles.stepLineActive, step === 'done' && styles.stepLineActive]} />}
              </React.Fragment>
            ))}
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>

            {/* STEP 1: INPUT */}
            {step === 'input' && (
              <View>
                <View style={styles.tabToggle}>
                  <TouchableOpacity style={[styles.toggleBtn, inputTab === 'paste' && styles.toggleBtnActive]} onPress={() => setInputTab('paste')}>
                    <ClipboardPaste size={14} color={inputTab === 'paste' ? Colors.light.tint : Colors.light.textSecondary} />
                    <Text style={[styles.toggleBtnText, inputTab === 'paste' && styles.toggleBtnTextActive]}>Paste Text</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.toggleBtn, inputTab === 'file' && styles.toggleBtnActive]} onPress={() => setInputTab('file')}>
                    <Upload size={14} color={inputTab === 'file' ? Colors.light.tint : Colors.light.textSecondary} />
                    <Text style={[styles.toggleBtnText, inputTab === 'file' && styles.toggleBtnTextActive]}>CSV / Excel File</Text>
                  </TouchableOpacity>
                </View>

                {inputTab === 'paste' && (
                  <View>
                    <Text style={styles.hint}>Copy data from Excel, Google Sheets, or any spreadsheet and paste it below. Include a header row with column names like "First Name", "Last Name", "Email", etc.</Text>
                    <TextInput
                      style={styles.pasteArea}
                      value={rawText}
                      onChangeText={setRawText}
                      placeholder="Paste your spreadsheet data here…&#10;&#10;Example:&#10;First Name&#9;Last Name&#9;Email&#9;Phone&#9;Organization&#10;John&#9;Smith&#9;john@example.com&#9;555-1234&#9;Grace Community"
                      placeholderTextColor={Colors.light.textSecondary}
                      multiline
                      numberOfLines={10}
                      textAlignVertical="top"
                      autoCorrect={false}
                    />
                    <TouchableOpacity style={[styles.primaryBtn, !rawText.trim() && styles.primaryBtnDisabled]} onPress={parsePaste} disabled={!rawText.trim()}>
                      <Text style={styles.primaryBtnText}>Parse Data →</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {inputTab === 'file' && (
                  <View>
                    <Text style={styles.hint}>Upload a CSV or Excel file. For Excel (.xlsx), please save as CSV first (File → Save As → CSV).</Text>
                    {Platform.OS === 'web' ? (
                      <Pressable
                        style={styles.dropZone}
                        onPress={() => { (document as any).getElementById('crm-csv-input')?.click(); }}
                      >
                        <Upload size={28} color={Colors.light.tint} />
                        <Text style={styles.dropZoneText}>Click to select a CSV file</Text>
                        <Text style={styles.dropZoneSub}>Supports .csv and .txt files</Text>
                        <input
                          id="crm-csv-input"
                          type="file"
                          accept=".csv,.txt"
                          style={{ display: 'none' }}
                          onChange={handleFileUpload}
                        />
                      </Pressable>
                    ) : (
                      <View style={styles.dropZone}>
                        <FileText size={28} color={Colors.light.textSecondary} />
                        <Text style={styles.dropZoneText}>File upload is available on web.</Text>
                        <Text style={styles.dropZoneSub}>Please use the Paste Text option on mobile.</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* STEP 2: MAPPING */}
            {step === 'mapping' && (
              <View>
                <Text style={styles.hint}>We auto-detected {rows.length} contact row{rows.length !== 1 ? 's' : ''}. Review and adjust the column assignments below.</Text>
                <View style={styles.mappingTable}>
                  {headers.map((h, i) => {
                    const sample = rows.slice(0, 3).map((r) => r[i] || '').filter(Boolean).join(', ');
                    const fieldLabel = FIELD_OPTIONS.find((f) => f.key === mapping[i])?.label || '— Skip —';
                    return (
                      <View key={i} style={styles.mappingRow}>
                        <View style={styles.mappingColInfo}>
                          <Text style={styles.mappingColName}>{h}</Text>
                          {sample ? <Text style={styles.mappingSample} numberOfLines={1}>{sample}</Text> : null}
                        </View>
                        <View style={styles.mappingArrow}>
                          <Text style={styles.mappingArrowText}>→</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.mappingFieldBtn}
                          onPress={() => setDropdownOpen(dropdownOpen === i ? null : i)}
                        >
                          <Text style={[styles.mappingFieldBtnText, mapping[i] === 'skip' && styles.mappingFieldSkip]}>{fieldLabel}</Text>
                          <ChevronDown size={12} color={Colors.light.textSecondary} />
                        </TouchableOpacity>
                        {dropdownOpen === i && (
                          <View style={styles.fieldDropdown}>
                            {FIELD_OPTIONS.map((f) => (
                              <TouchableOpacity
                                key={f.key}
                                style={[styles.fieldDropdownItem, mapping[i] === f.key && styles.fieldDropdownItemActive]}
                                onPress={() => {
                                  const m = [...mapping];
                                  m[i] = f.key;
                                  setMapping(m);
                                  setDropdownOpen(null);
                                }}
                              >
                                <Text style={[styles.fieldDropdownText, mapping[i] === f.key && styles.fieldDropdownTextActive]}>{f.label}</Text>
                                {mapping[i] === f.key && <Check size={12} color={Colors.light.tint} />}
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
                <View style={styles.btnRow}>
                  <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStep('input')}>
                    <Text style={styles.secondaryBtnText}>← Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.primaryBtn} onPress={applyMapping}>
                    <Text style={styles.primaryBtnText}>Preview Contacts →</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* STEP 3: PREVIEW */}
            {step === 'preview' && (
              <View>
                <View style={styles.previewStats}>
                  <View style={styles.previewStat}>
                    <Text style={styles.previewStatVal}>{parsed.length}</Text>
                    <Text style={styles.previewStatLabel}>Total</Text>
                  </View>
                  <View style={[styles.previewStat, { borderColor: Colors.light.success }]}>
                    <Text style={[styles.previewStatVal, { color: Colors.light.success }]}>{validCount}</Text>
                    <Text style={styles.previewStatLabel}>Ready</Text>
                  </View>
                  {warnCount > 0 && (
                    <View style={[styles.previewStat, { borderColor: '#F59E0B' }]}>
                      <Text style={[styles.previewStatVal, { color: '#F59E0B' }]}>{warnCount}</Text>
                      <Text style={styles.previewStatLabel}>Warnings</Text>
                    </View>
                  )}
                </View>

                {parsed.map((c, i) => (
                  <View key={i} style={[styles.previewRow, c.warning && styles.previewRowWarn]}>
                    <View style={styles.previewAvatar}>
                      <Text style={styles.previewAvatarText}>{(c.firstName || c.email || '?').charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={styles.previewInfo}>
                      <Text style={styles.previewName}>{[c.firstName, c.lastName].filter(Boolean).join(' ') || '(no name)'}</Text>
                      <Text style={styles.previewDetails} numberOfLines={1}>
                        {[c.organization, c.email, c.phone].filter(Boolean).join(' · ')}
                      </Text>
                      {c.warning && (
                        <View style={styles.warnRow}>
                          <AlertCircle size={11} color="#F59E0B" />
                          <Text style={styles.warnText}>{c.warning}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))}

                <View style={styles.btnRow}>
                  <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStep('mapping')}>
                    <Text style={styles.secondaryBtnText}>← Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.primaryBtn, importing && styles.primaryBtnDisabled]} onPress={handleImport} disabled={importing}>
                    <Text style={styles.primaryBtnText}>{importing ? 'Importing…' : `Import ${validCount} Contact${validCount !== 1 ? 's' : ''}`}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* DONE */}
            {step === 'done' && (
              <View style={styles.doneContainer}>
                <View style={styles.doneIcon}>
                  <Check size={32} color="#fff" />
                </View>
                <Text style={styles.doneTitle}>Import Complete!</Text>
                <Text style={styles.doneSub}>{validCount} contact{validCount !== 1 ? 's' : ''} have been added to your Contacts database.</Text>
                <TouchableOpacity style={styles.primaryBtn} onPress={handleClose}>
                  <Text style={styles.primaryBtnText}>Done</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: Colors.light.surface, borderRadius: 20,
    width: '100%', maxWidth: 640, maxHeight: '90%',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25, shadowRadius: 24, elevation: 16,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.light.border },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.light.text },

  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, paddingHorizontal: 40, gap: 0 },
  stepDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.light.border, alignItems: 'center', justifyContent: 'center' },
  stepDotActive: { backgroundColor: Colors.light.tint },
  stepDotText: { fontSize: 13, fontWeight: '700', color: Colors.light.textSecondary },
  stepDotTextActive: { color: '#fff' },
  stepLine: { flex: 1, height: 2, backgroundColor: Colors.light.border, marginHorizontal: 4 },
  stepLineActive: { backgroundColor: Colors.light.tint },

  body: { paddingHorizontal: 20, paddingBottom: 24 },

  tabToggle: { flexDirection: 'row', backgroundColor: Colors.light.background, borderRadius: 10, padding: 4, marginBottom: 16, gap: 4 },
  toggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 8 },
  toggleBtnActive: { backgroundColor: Colors.light.surface, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 },
  toggleBtnText: { fontSize: 13, fontWeight: '600', color: Colors.light.textSecondary },
  toggleBtnTextActive: { color: Colors.light.tint },

  hint: { fontSize: 13, color: Colors.light.textSecondary, lineHeight: 19, marginBottom: 14 },

  pasteArea: {
    backgroundColor: Colors.light.background, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.light.border,
    padding: 14, fontSize: 13, color: Colors.light.text,
    minHeight: 180, fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
    marginBottom: 16,
  },

  dropZone: {
    borderWidth: 2, borderColor: Colors.light.border, borderStyle: 'dashed',
    borderRadius: 14, padding: 32,
    alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: Colors.light.background, marginBottom: 16,
  },
  dropZoneText: { fontSize: 15, fontWeight: '600', color: Colors.light.text },
  dropZoneSub: { fontSize: 12, color: Colors.light.textSecondary },

  mappingTable: { gap: 0, marginBottom: 16 },
  mappingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.light.border, gap: 8, position: 'relative' },
  mappingColInfo: { flex: 1, minWidth: 80 },
  mappingColName: { fontSize: 13, fontWeight: '600', color: Colors.light.text },
  mappingSample: { fontSize: 11, color: Colors.light.textSecondary, marginTop: 1 },
  mappingArrow: { paddingHorizontal: 4 },
  mappingArrowText: { fontSize: 14, color: Colors.light.textSecondary },
  mappingFieldBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.light.background, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: Colors.light.border,
  },
  mappingFieldBtnText: { fontSize: 12, fontWeight: '600', color: Colors.light.text, flex: 1 },
  mappingFieldSkip: { color: Colors.light.textSecondary, fontWeight: '400' },
  fieldDropdown: {
    position: 'absolute', right: 0, top: '100%', zIndex: 9999,
    backgroundColor: Colors.light.surface, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.light.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10,
    width: 180, overflow: 'hidden',
  },
  fieldDropdownItem: { paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fieldDropdownItemActive: { backgroundColor: `${Colors.light.tint}12` },
  fieldDropdownText: { fontSize: 13, color: Colors.light.text },
  fieldDropdownTextActive: { color: Colors.light.tint, fontWeight: '600' },

  previewStats: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  previewStat: {
    flex: 1, alignItems: 'center', paddingVertical: 12,
    backgroundColor: Colors.light.background, borderRadius: 10,
    borderWidth: 1.5, borderColor: Colors.light.border,
  },
  previewStatVal: { fontSize: 22, fontWeight: '800', color: Colors.light.text },
  previewStatLabel: { fontSize: 11, color: Colors.light.textSecondary, marginTop: 2 },

  previewRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.light.border,
  },
  previewRowWarn: { backgroundColor: '#FFFBEB', borderRadius: 8, paddingHorizontal: 8, marginHorizontal: -8 },
  previewAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: `${Colors.light.tint}20`, alignItems: 'center', justifyContent: 'center',
  },
  previewAvatarText: { fontSize: 15, fontWeight: '700', color: Colors.light.tint },
  previewInfo: { flex: 1 },
  previewName: { fontSize: 14, fontWeight: '600', color: Colors.light.text },
  previewDetails: { fontSize: 12, color: Colors.light.textSecondary, marginTop: 1 },
  warnRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  warnText: { fontSize: 11, color: '#F59E0B' },

  btnRow: { flexDirection: 'row', gap: 10, marginTop: 20, marginBottom: 8 },

  primaryBtn: { flex: 2, backgroundColor: Colors.light.tint, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  secondaryBtn: { flex: 1, borderRadius: 10, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5, borderColor: Colors.light.border },
  secondaryBtnText: { fontSize: 15, fontWeight: '600', color: Colors.light.textSecondary },

  doneContainer: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  doneIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.light.success, alignItems: 'center', justifyContent: 'center' },
  doneTitle: { fontSize: 22, fontWeight: '800', color: Colors.light.text },
  doneSub: { fontSize: 15, color: Colors.light.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 8 },
});
