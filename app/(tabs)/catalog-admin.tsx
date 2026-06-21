import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import OverlayMenu from '@/components/OverlayMenu';
import {
  Package,
  Plus,
  Pencil,
  MoreVertical,
  X,
  ChevronDown,
  Search,
  EyeOff,
  Eye,
  Check,
  Minus,
  SlidersHorizontal,
  FileDown,
  FileUp,
  ClipboardList,
  DollarSign,
  ArrowUpDown,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import { apiFetch } from '@/lib/apiFetch';
import { CATEGORY_TREE, GENDER_OPTIONS } from '@/lib/templateMapping';

const BRAND = Colors.light.tint;
const TEXT = Colors.light.text;
const TEXT_LIGHT = Colors.light.textSecondary;
const BORDER = Colors.light.border;
const SURFACE = Colors.light.surface;
const BG = Colors.light.background;

type SortField = 'style' | 'brand' | 'name' | 'category' | 'vendors' | 'cost' | 'status';
type SortDir = 'asc' | 'desc';

const EMPTY_FORM = {
  styleNumber: '',
  brand:       '',
  vendor:      '',
  name:        '',
  category:    'Apparel',
  subcategory: '',
  productType: '',
  gender:      '',
};

interface Product {
  id: string;
  styleNumber: string;
  brand: string;
  vendor: string;
  name: string;
  category: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  subcategory?: string | null;
  productType?: string | null;
  gender?: string | null;
  vendorCount?: number;
  preferredVendorName?: string | null;
  defaultBlankCost?: number | string | null;
  lastCostUpdatedAt?: string | null;
  colorCount?: number;
  assetCount?: number;
  placementCount?: number;
  templateId?: string | null;
}

// ── Checkbox ──────────────────────────────────────────────────────────────────
function Checkbox({ checked, indeterminate, onToggle }: {
  checked: boolean; indeterminate?: boolean; onToggle: () => void;
}) {
  const filled = checked || !!indeterminate;
  return (
    <TouchableOpacity onPress={onToggle} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <View style={{
        width: 17, height: 17, borderRadius: 4,
        borderWidth: 1.5,
        borderColor: filled ? BRAND : BORDER,
        backgroundColor: filled ? BRAND : '#fff',
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
      }}>
        {checked && !indeterminate && <Check size={10} color="#fff" strokeWidth={3} />}
        {!!indeterminate && <Minus size={10} color="#fff" strokeWidth={3} />}
      </View>
    </TouchableOpacity>
  );
}

// ── BulkAssignModal ───────────────────────────────────────────────────────────
function BulkAssignModal({ visible, field, onSave, onClose }: {
  visible: boolean;
  field: 'category' | 'subcategory' | 'productType' | null;
  onSave: (value: string) => Promise<void>;
  onClose: () => void;
}) {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const categories = Object.keys(CATEGORY_TREE);

  useEffect(() => {
    if (visible) { setValue(''); setError(''); setSaving(false); }
  }, [visible, field]);

  const label =
    field === 'category' ? 'Category' :
    field === 'subcategory' ? 'Subcategory' :
    field === 'productType' ? 'Product Type' : '';

  const handleSave = async () => {
    if (!value.trim()) { setError(`${label} is required.`); return; }
    setError('');
    setSaving(true);
    try {
      await onSave(value.trim());
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to assign.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={fm.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[fm.sheet, { width: 400 }]} onPress={() => {}}>
          <View style={fm.header}>
            <Text style={fm.title}>Assign {label}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={20} color={TEXT_LIGHT} />
            </TouchableOpacity>
          </View>
          <View style={[fm.body, { paddingBottom: 20 }]}>
            {!!error && <View style={fm.errorBox}><Text style={fm.errorText}>{error}</Text></View>}
            <Text style={fm.label}>{label}</Text>
            {field === 'category' ? (
              <View style={[fm.dropdown, { marginBottom: 0, maxHeight: 260 }]}>
                <ScrollView showsVerticalScrollIndicator={false}>
                  {categories.map(cat => (
                    <TouchableOpacity
                      key={cat}
                      style={[fm.dropOption, value === cat && fm.dropOptionActive]}
                      onPress={() => setValue(cat)}
                    >
                      <Text style={[fm.dropOptionText, value === cat && fm.dropOptionTextActive]}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            ) : (
              <TextInput
                style={fm.input}
                value={value}
                onChangeText={setValue}
                placeholder={`Enter ${label.toLowerCase()}…`}
                placeholderTextColor="#9CA3AF"
                autoFocus
              />
            )}
            <View style={{ flexDirection: 'row' as const, justifyContent: 'flex-end' as const, gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={[fm.btnCancel, { flex: 0, paddingHorizontal: 16 }]} onPress={onClose}>
                <Text style={fm.btnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[fm.btnSave, { flex: 0, paddingHorizontal: 20 }, saving && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={fm.btnSaveText}>Apply to Selected</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ── BulkCostModal ─────────────────────────────────────────────────────────────
function BulkCostModal({ visible, mode, onSave, onClose }: {
  visible: boolean;
  mode: 'set' | 'increase' | 'decrease' | null;
  onSave: (value: string) => Promise<void>;
  onClose: () => void;
}) {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) { setValue(''); setError(''); setSaving(false); }
  }, [visible, mode]);

  const title = mode === 'set' ? 'Set Cost' : mode === 'increase' ? 'Increase Cost' : 'Decrease Cost';
  const label = mode === 'set' ? 'Blank Cost ($)' : mode === 'increase' ? 'Increase By (%)' : 'Decrease By (%)';
  const placeholder = mode === 'set' ? 'e.g. 3.50' : 'e.g. 10';

  const handleSave = async () => {
    const num = parseFloat(value.trim());
    if (isNaN(num) || num < 0) { setError('Enter a valid positive number.'); return; }
    if ((mode === 'increase' || mode === 'decrease') && num > 100) { setError('Percentage must be between 0 and 100.'); return; }
    setError('');
    setSaving(true);
    try {
      await onSave(value.trim());
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to update costs.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={fm.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[fm.sheet, { width: 360 }]} onPress={() => {}}>
          <View style={fm.header}>
            <Text style={fm.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={20} color={TEXT_LIGHT} />
            </TouchableOpacity>
          </View>
          <View style={[fm.body, { paddingBottom: 20 }]}>
            {!!error && <View style={fm.errorBox}><Text style={fm.errorText}>{error}</Text></View>}
            <Text style={fm.label}>{label}</Text>
            <TextInput
              style={fm.input}
              value={value}
              onChangeText={setValue}
              placeholder={placeholder}
              placeholderTextColor="#9CA3AF"
              keyboardType="decimal-pad"
              autoFocus
              onSubmitEditing={handleSave}
            />
            <View style={{ flexDirection: 'row' as const, justifyContent: 'flex-end' as const, gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={[fm.btnCancel, { flex: 0, paddingHorizontal: 16 }]} onPress={onClose}>
                <Text style={fm.btnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[fm.btnSave, { flex: 0, paddingHorizontal: 20 }, saving && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={fm.btnSaveText}>Apply to Selected</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ── BulkVendorModal ───────────────────────────────────────────────────────────
function BulkVendorModal({ visible, mode, onSave, onClose }: {
  visible: boolean;
  mode: 'assign' | 'preferred' | null;
  onSave: (vendorId: string) => Promise<void>;
  onClose: () => void;
}) {
  const [vendors, setVendors] = useState<{ id: string; name: string }[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      setSelectedId('');
      setError('');
      setSaving(false);
      setLoading(true);
      apiFetch('/api/vendors')
        .then((data: any) => setVendors((data.vendors || []).filter((v: any) => v.isActive !== false)))
        .catch(() => setError('Failed to load vendors.'))
        .finally(() => setLoading(false));
    }
  }, [visible]);

  const title = mode === 'assign' ? 'Assign Vendor' : 'Set Preferred Vendor';

  const handleSave = async () => {
    if (!selectedId) { setError('Select a vendor.'); return; }
    setError('');
    setSaving(true);
    try {
      await onSave(selectedId);
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to update vendors.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={fm.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[fm.sheet, { width: 400 }]} onPress={() => {}}>
          <View style={fm.header}>
            <Text style={fm.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={20} color={TEXT_LIGHT} />
            </TouchableOpacity>
          </View>
          <View style={[fm.body, { paddingBottom: 20 }]}>
            {!!error && <View style={fm.errorBox}><Text style={fm.errorText}>{error}</Text></View>}
            {loading ? (
              <ActivityIndicator color={BRAND} size="small" style={{ marginVertical: 20 }} />
            ) : (
              <>
                <Text style={fm.label}>Vendor</Text>
                <View style={[fm.dropdown, { marginBottom: 0, maxHeight: 260 }]}>
                  <ScrollView showsVerticalScrollIndicator={false}>
                    {vendors.map(v => (
                      <TouchableOpacity
                        key={v.id}
                        style={[fm.dropOption, selectedId === v.id && fm.dropOptionActive]}
                        onPress={() => setSelectedId(v.id)}
                      >
                        <Text style={[fm.dropOptionText, selectedId === v.id && fm.dropOptionTextActive]}>{v.name}</Text>
                      </TouchableOpacity>
                    ))}
                    {vendors.length === 0 && (
                      <View style={{ padding: 14 }}>
                        <Text style={{ fontSize: 14, color: TEXT_LIGHT }}>No vendors found. Add vendors first.</Text>
                      </View>
                    )}
                  </ScrollView>
                </View>
              </>
            )}
            <View style={{ flexDirection: 'row' as const, justifyContent: 'flex-end' as const, gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={[fm.btnCancel, { flex: 0, paddingHorizontal: 16 }]} onPress={onClose}>
                <Text style={fm.btnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[fm.btnSave, { flex: 0, paddingHorizontal: 20 }, (saving || loading) && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={saving || loading}
              >
                {saving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={fm.btnSaveText}>Apply to Selected</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ── BulkTemplateModal ─────────────────────────────────────────────────────────
function BulkTemplateModal({ visible, onSave, onClose }: {
  visible: boolean;
  onSave: (templateId: string) => Promise<void>;
  onClose: () => void;
}) {
  const [templates, setTemplates] = useState<{ id: string; key: string; name: string }[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      setSelectedId('');
      setError('');
      setSaving(false);
      setLoading(true);
      apiFetch('/api/products/placement-templates')
        .then((data: any) => setTemplates(data.templates || []))
        .catch(() => setError('Failed to load templates.'))
        .finally(() => setLoading(false));
    }
  }, [visible]);

  const handleSave = async () => {
    if (!selectedId) { setError('Select a template.'); return; }
    setError('');
    setSaving(true);
    try {
      await onSave(selectedId);
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to assign template.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={fm.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[fm.sheet, { width: 400 }]} onPress={() => {}}>
          <View style={fm.header}>
            <Text style={fm.title}>Assign Template</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={20} color={TEXT_LIGHT} />
            </TouchableOpacity>
          </View>
          <View style={[fm.body, { paddingBottom: 20 }]}>
            {!!error && <View style={fm.errorBox}><Text style={fm.errorText}>{error}</Text></View>}
            {loading ? (
              <ActivityIndicator color={BRAND} size="small" style={{ marginVertical: 20 }} />
            ) : (
              <>
                <Text style={fm.label}>Placement Template</Text>
                <View style={[fm.dropdown, { marginBottom: 0, maxHeight: 260 }]}>
                  <ScrollView showsVerticalScrollIndicator={false}>
                    {templates.map(t => (
                      <TouchableOpacity
                        key={t.id}
                        style={[fm.dropOption, selectedId === t.id && fm.dropOptionActive]}
                        onPress={() => setSelectedId(t.id)}
                      >
                        <Text style={[fm.dropOptionText, selectedId === t.id && fm.dropOptionTextActive]}>
                          {t.name || t.key}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    {templates.length === 0 && (
                      <View style={{ padding: 14 }}>
                        <Text style={{ fontSize: 14, color: TEXT_LIGHT }}>No templates available.</Text>
                      </View>
                    )}
                  </ScrollView>
                </View>
              </>
            )}
            <View style={{ flexDirection: 'row' as const, justifyContent: 'flex-end' as const, gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={[fm.btnCancel, { flex: 0, paddingHorizontal: 16 }]} onPress={onClose}>
                <Text style={fm.btnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[fm.btnSave, { flex: 0, paddingHorizontal: 20 }, (saving || loading) && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={saving || loading}
              >
                {saving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={fm.btnSaveText}>Apply to Selected</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ── ProductFormModal ──────────────────────────────────────────────────────────
function ProductFormModal({
  visible,
  initial,
  onSave,
  onClose,
}: {
  visible: boolean;
  initial: Product | null;
  onSave: (form: typeof EMPTY_FORM) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [openDrop, setOpenDrop] = useState<'cat' | 'sub' | 'type' | 'gen' | null>(null);

  const subcategories = Object.keys(CATEGORY_TREE[form.category] ?? {});
  const productTypes  = CATEGORY_TREE[form.category]?.[form.subcategory] ?? [];
  const TOP_CATS      = Object.keys(CATEGORY_TREE);

  useEffect(() => {
    if (visible) {
      setForm(
        initial
          ? {
              styleNumber: initial.styleNumber,
              brand:       initial.brand,
              vendor:      initial.vendor,
              name:        initial.name,
              category:    initial.category    || 'Apparel',
              subcategory: initial.subcategory || '',
              productType: initial.productType || '',
              gender:      initial.gender      || '',
            }
          : { ...EMPTY_FORM },
      );
      setError('');
      setSaving(false);
      setOpenDrop(null);
    }
  }, [visible, initial]);

  const upd = <K extends keyof typeof EMPTY_FORM>(k: K, v: (typeof EMPTY_FORM)[K]) =>
    setForm(f => ({ ...f, [k]: v }));
  const setCategory    = (v: string) => { setForm(f => ({ ...f, category: v, subcategory: '', productType: '' })); setOpenDrop(null); };
  const setSubcategory = (v: string) => { setForm(f => ({ ...f, subcategory: v, productType: '' })); setOpenDrop(null); };

  const handleSave = async () => {
    if (!form.styleNumber.trim()) { setError('Style number is required.'); return; }
    if (!form.brand.trim())       { setError('Brand is required.'); return; }
    if (!form.vendor.trim())      { setError('Manufacturer is required.'); return; }
    if (!form.name.trim())        { setError('Product name is required.'); return; }
    setError('');
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to save product.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={fm.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={fm.sheet} onPress={() => setOpenDrop(null)}>
          <View style={fm.header}>
            <Text style={fm.title}>{initial ? 'Edit Product' : 'New Product'}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={20} color={TEXT_LIGHT} />
            </TouchableOpacity>
          </View>

          <ScrollView style={fm.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {!!error && (
              <View style={fm.errorBox}><Text style={fm.errorText}>{error}</Text></View>
            )}

            <Text style={fm.label}>Style # <Text style={{ color: BRAND }}>*</Text></Text>
            <TextInput style={fm.input} value={form.styleNumber} onChangeText={v => upd('styleNumber', v)}
              placeholder="e.g. NL6210" placeholderTextColor="#9CA3AF" autoCapitalize="characters" />

            <Text style={fm.label}>Brand <Text style={{ color: BRAND }}>*</Text></Text>
            <TextInput style={fm.input} value={form.brand} onChangeText={v => upd('brand', v)}
              placeholder="e.g. Next Level" placeholderTextColor="#9CA3AF" />

            <Text style={fm.label}>
              Manufacturer <Text style={{ color: BRAND }}>*</Text>
              {'  '}<Text style={{ fontSize: 11, color: TEXT_LIGHT, fontWeight: '400' }}>apparel maker, not distributor</Text>
            </Text>
            <TextInput style={fm.input} value={form.vendor} onChangeText={v => upd('vendor', v)}
              placeholder="e.g. Next Level Apparel" placeholderTextColor="#9CA3AF" />

            <Text style={fm.label}>Product Name <Text style={{ color: BRAND }}>*</Text></Text>
            <TextInput style={fm.input} value={form.name} onChangeText={v => upd('name', v)}
              placeholder="e.g. CVC Crew Tee" placeholderTextColor="#9CA3AF" />

            {/* Category */}
            <Text style={fm.label}>Category</Text>
            <TouchableOpacity style={fm.select} onPress={() => setOpenDrop(d => d === 'cat' ? null : 'cat')}>
              <Text style={fm.selectText}>{form.category || 'Select…'}</Text>
              <ChevronDown size={16} color={TEXT_LIGHT} />
            </TouchableOpacity>
            {openDrop === 'cat' && (
              <View style={fm.dropdown}>
                {TOP_CATS.map(cat => (
                  <TouchableOpacity key={cat} style={[fm.dropOption, form.category === cat && fm.dropOptionActive]}
                    onPress={() => setCategory(cat)}>
                    <Text style={[fm.dropOptionText, form.category === cat && fm.dropOptionTextActive]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Subcategory */}
            {subcategories.length > 0 && (
              <>
                <Text style={fm.label}>Subcategory</Text>
                <TouchableOpacity style={fm.select} onPress={() => setOpenDrop(d => d === 'sub' ? null : 'sub')}>
                  <Text style={[fm.selectText, !form.subcategory && { color: '#9CA3AF' }]}>
                    {form.subcategory || 'Select…'}
                  </Text>
                  <ChevronDown size={16} color={TEXT_LIGHT} />
                </TouchableOpacity>
                {openDrop === 'sub' && (
                  <View style={fm.dropdown}>
                    <TouchableOpacity style={fm.dropOption} onPress={() => setSubcategory('')}>
                      <Text style={[fm.dropOptionText, !form.subcategory && { color: BRAND, fontWeight: '600' }]}>— None —</Text>
                    </TouchableOpacity>
                    {subcategories.map(sub => (
                      <TouchableOpacity key={sub} style={[fm.dropOption, form.subcategory === sub && fm.dropOptionActive]}
                        onPress={() => setSubcategory(sub)}>
                        <Text style={[fm.dropOptionText, form.subcategory === sub && fm.dropOptionTextActive]}>{sub}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            )}

            {/* Product Type */}
            {productTypes.length > 0 && (
              <>
                <Text style={fm.label}>Product Type</Text>
                <TouchableOpacity style={fm.select} onPress={() => setOpenDrop(d => d === 'type' ? null : 'type')}>
                  <Text style={[fm.selectText, !form.productType && { color: '#9CA3AF' }]}>
                    {form.productType || 'Select…'}
                  </Text>
                  <ChevronDown size={16} color={TEXT_LIGHT} />
                </TouchableOpacity>
                {openDrop === 'type' && (
                  <View style={fm.dropdown}>
                    <TouchableOpacity style={fm.dropOption} onPress={() => { upd('productType', ''); setOpenDrop(null); }}>
                      <Text style={[fm.dropOptionText, !form.productType && { color: BRAND, fontWeight: '600' }]}>— None —</Text>
                    </TouchableOpacity>
                    {productTypes.map(pt => (
                      <TouchableOpacity key={pt} style={[fm.dropOption, form.productType === pt && fm.dropOptionActive]}
                        onPress={() => { upd('productType', pt); setOpenDrop(null); }}>
                        <Text style={[fm.dropOptionText, form.productType === pt && fm.dropOptionTextActive]}>{pt}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            )}

            {/* Gender */}
            <Text style={fm.label}>Gender</Text>
            <TouchableOpacity style={fm.select} onPress={() => setOpenDrop(d => d === 'gen' ? null : 'gen')}>
              <Text style={[fm.selectText, !form.gender && { color: '#9CA3AF' }]}>
                {form.gender || 'Select…'}
              </Text>
              <ChevronDown size={16} color={TEXT_LIGHT} />
            </TouchableOpacity>
            {openDrop === 'gen' && (
              <View style={fm.dropdown}>
                <TouchableOpacity style={fm.dropOption} onPress={() => { upd('gender', ''); setOpenDrop(null); }}>
                  <Text style={[fm.dropOptionText, !form.gender && { color: BRAND, fontWeight: '600' }]}>— None —</Text>
                </TouchableOpacity>
                {GENDER_OPTIONS.map(g => (
                  <TouchableOpacity key={g} style={[fm.dropOption, form.gender === g && fm.dropOptionActive]}
                    onPress={() => { upd('gender', g); setOpenDrop(null); }}>
                    <Text style={[fm.dropOptionText, form.gender === g && fm.dropOptionTextActive]}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={{ height: 24 }} />
          </ScrollView>

          <View style={fm.footer}>
            <TouchableOpacity style={fm.btnCancel} onPress={onClose}>
              <Text style={fm.btnCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[fm.btnSave, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
              {saving
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={fm.btnSaveText}>Save Product</Text>}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function CatalogAdminScreen() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('active');
  const [filterCat, setFilterCat] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [assignModal, setAssignModal] = useState<'category' | 'subcategory' | 'productType' | null>(null);

  const [bulkResolving, setBulkResolving] = useState(false);

  const [costEdits, setCostEdits] = useState<Map<string, string>>(new Map());
  const [costSaving, setCostSaving] = useState<Set<string>>(new Set());
  const [costSaved, setCostSaved] = useState<Set<string>>(new Set());
  const [costEditAll, setCostEditAll] = useState(false);

  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const [bulkCostModal, setBulkCostModal] = useState<'set' | 'increase' | 'decrease' | null>(null);
  const [bulkVendorModal, setBulkVendorModal] = useState<'assign' | 'preferred' | null>(null);
  const [bulkTemplateModal, setBulkTemplateModal] = useState(false);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/api/products?active=false');
      setProducts(data.products || []);
    } catch (e) {
      console.error('[CatalogAdmin] load error', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const filtered = useMemo(() => {
    const base = products.filter(p => {
      if (filterStatus === 'active' && !p.isActive) return false;
      if (filterStatus === 'inactive' && p.isActive) return false;
      if (filterCat && p.category !== filterCat) return false;
      const q = search.toLowerCase();
      if (!q) return true;
      return (
        p.styleNumber.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.vendor.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q)
      );
    });
    return [...base].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'style')    cmp = (a.styleNumber || '').localeCompare(b.styleNumber || '');
      else if (sortField === 'brand')    cmp = (a.brand || '').localeCompare(b.brand || '');
      else if (sortField === 'name')     cmp = (a.name || '').localeCompare(b.name || '');
      else if (sortField === 'category') cmp = (a.category || '').localeCompare(b.category || '');
      else if (sortField === 'vendors')  cmp = (a.vendorCount ?? 0) - (b.vendorCount ?? 0);
      else if (sortField === 'cost')     cmp = (a.defaultBlankCost ?? -Infinity) - (b.defaultBlankCost ?? -Infinity);
      else if (sortField === 'status')   cmp = (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [products, filterStatus, filterCat, search, sortField, sortDir]);

  const activeCount  = products.filter(p => p.isActive).length;
  const filterCount  = (filterStatus !== 'active' ? 1 : 0) + (filterCat ? 1 : 0);
  const someSelected = filtered.some(p => selectedIds.has(p.id));
  const pageAllSelected = filtered.length > 0 && filtered.every(p => selectedIds.has(p.id));

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleTogglePageSelection = () => {
    const pageIds = filtered.map(p => p.id);
    if (pageAllSelected) {
      setSelectedIds(prev => { const next = new Set(prev); pageIds.forEach(id => next.delete(id)); return next; });
    } else {
      setSelectedIds(prev => { const next = new Set(prev); pageIds.forEach(id => next.add(id)); return next; });
    }
  };


  const handleSave = async (form: typeof EMPTY_FORM) => {
    if (editing) {
      await apiFetch(`/api/products/${editing.id}`, { method: 'PATCH', body: JSON.stringify(form) });
    } else {
      await apiFetch('/api/products', { method: 'POST', body: JSON.stringify(form) });
    }
    await loadProducts();
  };

  const handleToggleActive = async (product: Product) => {
    try {
      await apiFetch(`/api/products/${product.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !product.isActive }),
      });
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, isActive: !p.isActive } : p));
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update product');
    }
  };

  const handleBulkActivate = async () => {
    const ids = [...selectedIds];
    try {
      await apiFetch('/api/products/bulk', { method: 'POST', body: JSON.stringify({ action: 'activate', ids }) });
      setProducts(prev => prev.map(p => ids.includes(p.id) ? { ...p, isActive: true } : p));
      setSelectedIds(new Set());
    } catch (e: any) { Alert.alert('Error', e.message || 'Failed to activate'); }
  };

  const handleBulkDeactivate = async () => {
    const ids = [...selectedIds];
    try {
      await apiFetch('/api/products/bulk', { method: 'POST', body: JSON.stringify({ action: 'deactivate', ids }) });
      setProducts(prev => prev.map(p => ids.includes(p.id) ? { ...p, isActive: false } : p));
      setSelectedIds(new Set());
    } catch (e: any) { Alert.alert('Error', e.message || 'Failed to deactivate'); }
  };

  const handleBulkDelete = () => {
    const n = selectedIds.size;
    Alert.alert(
      'Delete Products',
      `Permanently delete ${n} product${n !== 1 ? 's' : ''}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            const ids = [...selectedIds];
            try {
              await apiFetch('/api/products/bulk', { method: 'POST', body: JSON.stringify({ action: 'delete', ids }) });
              setProducts(prev => prev.filter(p => !ids.includes(p.id)));
              setSelectedIds(new Set());
            } catch (e: any) { Alert.alert('Error', e.message || 'Failed to delete'); }
          },
        },
      ],
    );
  };

  const handleBulkAssign = async (value: string) => {
    if (!assignModal) return;
    const ids = [...selectedIds];
    const actionMap: Record<string, string> = {
      category: 'assign-category',
      subcategory: 'assign-subcategory',
      productType: 'assign-product-type',
    };
    await apiFetch('/api/products/bulk', {
      method: 'POST',
      body: JSON.stringify({ action: actionMap[assignModal], ids, value }),
    });
    setProducts(prev => prev.map(p => ids.includes(p.id) ? { ...p, [assignModal]: value } : p));
    setSelectedIds(new Set());
  };

  const handleBulkResolve = async () => {
    setBulkResolving(true);
    try {
      const data = await apiFetch('/api/products/bulk-resolve-templates', { method: 'POST' });
      const { resolved, unresolved, skipped } = data as { resolved: number; unresolved: number; skipped: number };
      Alert.alert(
        'Auto-Resolve Complete',
        `Templates assigned: ${resolved}\nNeeds manual: ${unresolved}\nAlready set: ${skipped}`,
      );
      if (resolved > 0) await loadProducts();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to auto-resolve templates');
    } finally {
      setBulkResolving(false);
    }
  };

  const enterCostEdit = (id: string, current: number | string | null) => {
    const val = current != null ? parseFloat(String(current)).toFixed(2) : '';
    setCostEdits(prev => new Map(prev).set(id, val));
  };

  const handleEnterCostEditAll = () => setCostEditAll(true);
  const handleExitCostEditAll = () => {
    setCostEditAll(false);
    setCostEdits(new Map());
  };

  const toggleSort = useCallback((field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  }, [sortField]);

  const saveCostEdit = async (id: string) => {
    const raw = costEdits.get(id);
    if (raw === undefined) return;
    setCostEdits(prev => { const next = new Map(prev); next.delete(id); return next; });
    const trimmed = raw.trim();
    const num = trimmed === '' ? null : parseFloat(trimmed);
    if (num !== null && (isNaN(num) || num < 0)) return;
    setCostSaving(prev => new Set(prev).add(id));
    try {
      await apiFetch(`/api/products/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ defaultBlankCost: num }),
      });
      setProducts(prev => prev.map(p => p.id === id ? { ...p, defaultBlankCost: num } : p));
      setCostSaved(prev => new Set(prev).add(id));
      setTimeout(() => setCostSaved(prev => { const s = new Set(prev); s.delete(id); return s; }), 2000);
    } catch {
      // silently discard — cost cell will revert to original value
    } finally {
      setCostSaving(prev => { const s = new Set(prev); s.delete(id); return s; });
    }
  };

  const handleBulkCost = async (mode: 'set' | 'increase' | 'decrease', value: string) => {
    const ids = [...selectedIds];
    const action = mode === 'set' ? 'set-cost' : 'adjust-cost-pct';
    const val = mode === 'decrease' ? String(-parseFloat(value)) : value;
    try {
      await apiFetch('/api/products/bulk', {
        method: 'POST',
        body: JSON.stringify({ action, ids, value: val }),
      });
      await loadProducts();
      setSelectedIds(new Set());
    } catch (e: any) { Alert.alert('Error', e.message || 'Failed to update costs'); }
  };

  const handleBulkClearCost = () => {
    const n = selectedIds.size;
    Alert.alert(
      'Clear Costs',
      `Remove cost from ${n} product${n !== 1 ? 's' : ''}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear', style: 'destructive',
          onPress: async () => {
            const ids = [...selectedIds];
            try {
              await apiFetch('/api/products/bulk', {
                method: 'POST',
                body: JSON.stringify({ action: 'clear-cost', ids }),
              });
              setProducts(prev => prev.map(p => ids.includes(p.id) ? { ...p, defaultBlankCost: null, lastCostUpdatedAt: null } : p));
              setSelectedIds(new Set());
            } catch (e: any) { Alert.alert('Error', e.message || 'Failed to clear costs'); }
          },
        },
      ],
    );
  };

  const handleBulkAssignVendor = async (vendorId: string) => {
    const ids = [...selectedIds];
    try {
      await apiFetch('/api/products/bulk', {
        method: 'POST',
        body: JSON.stringify({ action: 'assign-source', ids, vendorId }),
      });
      await loadProducts();
      setSelectedIds(new Set());
    } catch (e: any) { Alert.alert('Error', e.message || 'Failed to assign vendor'); }
  };

  const handleBulkSetPreferredVendor = async (vendorId: string) => {
    const ids = [...selectedIds];
    try {
      await apiFetch('/api/products/bulk', {
        method: 'POST',
        body: JSON.stringify({ action: 'set-preferred-source', ids, vendorId }),
      });
      await loadProducts();
      setSelectedIds(new Set());
    } catch (e: any) { Alert.alert('Error', e.message || 'Failed to set preferred vendor'); }
  };

  const handleBulkAssignTemplate = async (templateId: string) => {
    const ids = [...selectedIds];
    try {
      await apiFetch('/api/products/bulk', {
        method: 'POST',
        body: JSON.stringify({ action: 'assign-template', ids, value: templateId }),
      });
      setProducts(prev => prev.map(p => ids.includes(p.id) ? { ...p, templateId } : p));
      setSelectedIds(new Set());
    } catch (e: any) { Alert.alert('Error', e.message || 'Failed to assign template'); }
  };

  const handleExportCSV = () => {
    if (Platform.OS !== 'web') { Alert.alert('Export', 'CSV export is available on web.'); return; }
    const rows = [
      ['Style #', 'Brand', 'Manufacturer', 'Product Name', 'Category', 'Subcategory', 'Product Type', 'Gender', 'Default Cost', 'Status'],
      ...filtered.map(p => [
        p.styleNumber, p.brand, p.vendor, p.name, p.category,
        p.subcategory ?? '', p.productType ?? '', p.gender ?? '',
        p.defaultBlankCost != null ? String(p.defaultBlankCost) : '',
        p.isActive ? 'Active' : 'Inactive',
      ]),
    ];
    const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = (document as any).createElement('a');
    a.href = url; a.download = 'products.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const SortBtn = ({ field, label }: { field: SortField; label: string }) => (
    <TouchableOpacity style={s.sortBtn} onPress={() => toggleSort(field)}>
      <Text style={[s.sortBtnText, sortField === field && s.sortBtnTextActive]}>{label}</Text>
      <ArrowUpDown size={11} color={sortField === field ? BRAND : 'rgba(255,255,255,0.35)'} />
    </TouchableOpacity>
  );

  return (
    <View style={s.screen}>

      {/* Page header */}
      <View style={s.pageHeader}>
        <View style={s.pageHeaderLeft}>
          <Package size={22} color={BRAND} />
          <Text style={s.pageTitle}>Products</Text>
          {!loading && (
            <View style={s.countBadge}>
              <Text style={s.countText}>{activeCount}</Text>
            </View>
          )}
        </View>
        <View style={s.headerActions}>
          {/* Actions dropdown */}
          <OverlayMenu menuWidth={210} align="right"
            trigger={({ open }) => (
              <TouchableOpacity style={s.outlineBtn} onPress={open}>
                <Text style={s.outlineBtnText}>Actions</Text>
                <ChevronDown size={12} color={TEXT_LIGHT} />
              </TouchableOpacity>
            )}
          >
            {({ close }) => (
              <>
                <TouchableOpacity style={s.floatItem} onPress={() => { close(); handleEnterCostEditAll(); }}>
                  <DollarSign size={15} color={TEXT_LIGHT} />
                  <Text style={s.floatItemText}>Edit Costs</Text>
                </TouchableOpacity>
                <View style={s.floatDivider} />
                <TouchableOpacity style={s.floatItem} onPress={() => { close(); router.push('/catalog-audit' as any); }}>
                  <ClipboardList size={15} color={TEXT_LIGHT} />
                  <Text style={s.floatItemText}>Product Audit</Text>
                </TouchableOpacity>
                <View style={s.floatDivider} />
                <TouchableOpacity style={s.floatItem} onPress={() => { close(); handleExportCSV(); }}>
                  <FileDown size={15} color={TEXT_LIGHT} />
                  <Text style={s.floatItemText}>Export CSV</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.floatItem} onPress={() => { close(); Alert.alert('Import CSV', 'CSV import coming soon.'); }}>
                  <FileUp size={15} color={TEXT_LIGHT} />
                  <Text style={s.floatItemText}>Import CSV</Text>
                </TouchableOpacity>
                <View style={s.floatDivider} />
                <TouchableOpacity style={s.floatItem} onPress={() => { close(); handleBulkResolve(); }} disabled={bulkResolving}>
                  <Text style={[s.floatItemText, { color: TEXT_LIGHT }]}>
                    {bulkResolving ? 'Resolving…' : 'Auto-resolve Templates'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </OverlayMenu>

          <TouchableOpacity
            style={s.addBtn}
            onPress={() => { setEditing(null); setModalVisible(true); }}
          >
            <Plus size={15} color="#fff" />
            <Text style={s.addBtnText}>New Product</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Toolbar row: search + filters */}
      <View style={s.toolbarRow}>
        <View style={s.searchBox}>
          <Search size={15} color={TEXT_LIGHT} />
          <TextInput
            style={s.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search style #, brand, or name…"
            placeholderTextColor="#9CA3AF"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={14} color={TEXT_LIGHT} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[s.filterBtn, filterCount > 0 && s.filterBtnActive]}
          onPress={() => setShowFilters(f => !f)}
        >
          <SlidersHorizontal size={15} color={filterCount > 0 ? BRAND : TEXT_LIGHT} />
          <Text style={[s.filterBtnText, filterCount > 0 && { color: BRAND }]}>
            Filters{filterCount > 0 ? ` (${filterCount})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Filter panel */}
      {showFilters && (
        <View style={s.filterPanel}>
          <View style={s.filterGroup}>
            <Text style={s.filterGroupLabel}>Status</Text>
            <View style={s.pillRow}>
              {(['active', 'inactive', 'all'] as const).map(st => (
                <TouchableOpacity
                  key={st}
                  style={[s.pill, filterStatus === st && s.pillActive]}
                  onPress={() => setFilterStatus(st)}
                >
                  <Text style={[s.pillText, filterStatus === st && s.pillTextActive]}>
                    {st === 'all' ? 'All' : st === 'active' ? 'Active' : 'Inactive'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={s.filterGroup}>
            <Text style={s.filterGroupLabel}>Category</Text>
            <View style={s.pillRow}>
              <TouchableOpacity style={[s.pill, !filterCat && s.pillActive]} onPress={() => setFilterCat('')}>
                <Text style={[s.pillText, !filterCat && s.pillTextActive]}>All</Text>
              </TouchableOpacity>
              {Object.keys(CATEGORY_TREE).map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[s.pill, filterCat === cat && s.pillActive]}
                  onPress={() => setFilterCat(c => c === cat ? '' : cat)}
                >
                  <Text style={[s.pillText, filterCat === cat && s.pillTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* Bulk selection bar */}
      {selectedIds.size > 0 && (
        <View style={s.selectionBar}>
          <Text style={s.selectionText}>{selectedIds.size} selected</Text>
          {selectedIds.size < filtered.length && (
            <TouchableOpacity onPress={() => setSelectedIds(new Set(filtered.map(p => p.id)))}>
              <Text style={s.selectionLink}>Select all {filtered.length}</Text>
            </TouchableOpacity>
          )}
          <View style={s.selDivider} />
          <TouchableOpacity style={s.selBtn} onPress={handleBulkActivate}>
            <Text style={s.selBtnText}>Activate</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.selBtn} onPress={handleBulkDeactivate}>
            <Text style={s.selBtnText}>Deactivate</Text>
          </TouchableOpacity>
          <OverlayMenu menuWidth={200} align="left"
            trigger={({ open }) => (
              <TouchableOpacity style={s.selBtn} onPress={open}>
                <Text style={s.selBtnText}>Assign</Text>
                <ChevronDown size={12} color={BRAND} />
              </TouchableOpacity>
            )}
          >
            {({ close }) => (
              <>
                <TouchableOpacity style={s.floatItem} onPress={() => { close(); setAssignModal('category'); }}>
                  <Text style={s.floatItemText}>Category</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.floatItem} onPress={() => { close(); setAssignModal('subcategory'); }}>
                  <Text style={s.floatItemText}>Subcategory</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.floatItem} onPress={() => { close(); setAssignModal('productType'); }}>
                  <Text style={s.floatItemText}>Product Type</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.floatItem} onPress={() => { close(); setBulkTemplateModal(true); }}>
                  <Text style={s.floatItemText}>Template</Text>
                </TouchableOpacity>
                <View style={s.floatDivider} />
                <TouchableOpacity style={s.floatItem} onPress={() => { close(); setBulkVendorModal('assign'); }}>
                  <Text style={s.floatItemText}>Assign Vendor</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.floatItem} onPress={() => { close(); setBulkVendorModal('preferred'); }}>
                  <Text style={s.floatItemText}>Set Preferred Vendor</Text>
                </TouchableOpacity>
              </>
            )}
          </OverlayMenu>
          <OverlayMenu menuWidth={180} align="left"
            trigger={({ open }) => (
              <TouchableOpacity style={s.selBtn} onPress={open}>
                <DollarSign size={12} color={BRAND} />
                <Text style={s.selBtnText}>Cost</Text>
                <ChevronDown size={12} color={BRAND} />
              </TouchableOpacity>
            )}
          >
            {({ close }) => (
              <>
                <TouchableOpacity style={s.floatItem} onPress={() => { close(); setBulkCostModal('set'); }}>
                  <Text style={s.floatItemText}>Set Cost</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.floatItem} onPress={() => { close(); setBulkCostModal('increase'); }}>
                  <Text style={s.floatItemText}>Increase %</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.floatItem} onPress={() => { close(); setBulkCostModal('decrease'); }}>
                  <Text style={s.floatItemText}>Decrease %</Text>
                </TouchableOpacity>
                <View style={s.floatDivider} />
                <TouchableOpacity style={s.floatItem} onPress={() => { close(); handleBulkClearCost(); }}>
                  <Text style={[s.floatItemText, { color: '#DC2626' }]}>Clear Cost</Text>
                </TouchableOpacity>
              </>
            )}
          </OverlayMenu>
          <TouchableOpacity style={[s.selBtn, { borderColor: '#FECACA' }]} onPress={handleBulkDelete}>
            <Text style={[s.selBtnText, { color: '#DC2626' }]}>Delete</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setSelectedIds(new Set())} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <X size={16} color={TEXT_LIGHT} />
          </TouchableOpacity>
        </View>
      )}

      {/* Cost edit mode banner */}
      {costEditAll && (
        <View style={s.costEditBar}>
          <DollarSign size={14} color="#92400E" />
          <Text style={s.costEditBarText}>Cost editing — double-click any cost to edit, or tap a cell directly</Text>
          <TouchableOpacity style={s.costEditDoneBtn} onPress={handleExitCostEditAll}>
            <Text style={s.costEditDoneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Table header */}
      <View style={s.tableHeader}>
        <View style={s.cCheck}>
          <Checkbox
            checked={pageAllSelected}
            indeterminate={someSelected && !pageAllSelected}
            onToggle={handleTogglePageSelection}
          />
        </View>
        <View style={s.cStyle}><SortBtn field="style" label="Style #" /></View>
        <View style={s.cBrand}><SortBtn field="brand" label="Brand" /></View>
        <View style={s.cName}><SortBtn field="name" label="Product" /></View>
        <View style={s.cCat}><SortBtn field="category" label="Category" /></View>
        <View style={s.cVendor}><SortBtn field="vendors" label="Vendors" /></View>
        <View style={s.cCost}><SortBtn field="cost" label="Cost" /></View>
        <View style={s.cStatus}><SortBtn field="status" label="Status" /></View>
        <View style={s.cActions} />
      </View>

      {/* Body */}
      {loading ? (
        <View style={s.loadingBox}>
          <ActivityIndicator color={BRAND} size="large" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={s.emptyBox}>
          <Package size={36} color={BORDER} />
          <Text style={s.emptyTitle}>
            {search || filterCount > 0 ? 'No products match your filters.' : 'No products yet.'}
          </Text>
          {!search && filterCount === 0 && (
            <Text style={s.emptySubtitle}>Add your first product to get started.</Text>
          )}
        </View>
      ) : (
        <ScrollView style={s.list} showsVerticalScrollIndicator={false}>
          {filtered.map(product => (
            <TouchableOpacity
              key={product.id}
              style={[s.row, selectedIds.has(product.id) && s.rowSelected]}
              onPress={costEditAll ? undefined : () => router.push(`/product/${product.id}` as any)}
              activeOpacity={0.75}
            >
              <View style={s.cCheck}>
                <Checkbox checked={selectedIds.has(product.id)} onToggle={() => toggleSelect(product.id)} />
              </View>
              <Text style={[s.td, s.cStyle, s.tdBold]} numberOfLines={1}>
                {product.styleNumber}
              </Text>
              <Text style={[s.td, s.cBrand]} numberOfLines={1}>
                {product.brand}
              </Text>
              <Text style={[s.td, s.cName]} numberOfLines={1}>
                {product.name}
              </Text>
              <View style={s.cCat}>
                <Text style={s.td} numberOfLines={1}>
                  {product.subcategory || product.category || '—'}
                </Text>
                {!!product.productType && (
                  <Text style={s.tdSub} numberOfLines={1}>{product.productType}</Text>
                )}
              </View>
              <View style={s.cVendor}>
                <Text style={s.td} numberOfLines={1}>
                  {product.preferredVendorName ?? '—'}
                </Text>
                {(product.vendorCount ?? 0) > 0 && (
                  <Text style={s.tdSub} numberOfLines={1}>
                    {product.vendorCount} {product.vendorCount === 1 ? 'vendor' : 'vendors'}
                  </Text>
                )}
              </View>
              <View
                style={s.cCost}
                {...(Platform.OS === 'web' && (costEdits.has(product.id) || costEditAll) ? {
                  onClick: (e: any) => e.stopPropagation(),
                } as any : {})}
              >
                {(costEdits.has(product.id) || costEditAll) ? (
                  <TextInput
                    style={s.costInput}
                    value={costEdits.has(product.id)
                      ? (costEdits.get(product.id) ?? '')
                      : (product.defaultBlankCost != null ? parseFloat(String(product.defaultBlankCost)).toFixed(2) : '')}
                    onChangeText={v => setCostEdits(prev => new Map(prev).set(product.id, v))}
                    onBlur={() => saveCostEdit(product.id)}
                    onSubmitEditing={() => saveCostEdit(product.id)}
                    keyboardType="decimal-pad"
                    autoFocus={costEdits.has(product.id) && !costEditAll}
                    selectTextOnFocus
                    placeholder="0.00"
                    placeholderTextColor="#D1D5DB"
                  />
                ) : costSaving.has(product.id) ? (
                  <ActivityIndicator size="small" color={BRAND} />
                ) : costSaved.has(product.id) ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <Check size={11} color="#059669" />
                    <Text style={[s.costCell, { color: '#059669' }]}>
                      ${parseFloat(String(product.defaultBlankCost ?? 0)).toFixed(2)}
                    </Text>
                  </View>
                ) : (
                  <View
                    {...(Platform.OS === 'web' ? {
                      onDoubleClick: (e: any) => {
                        e.stopPropagation();
                        enterCostEdit(product.id, product.defaultBlankCost);
                      },
                    } as any : {})}
                  >
                    {product.defaultBlankCost != null ? (
                      <Text style={s.costCell} numberOfLines={1}>
                        ${parseFloat(String(product.defaultBlankCost)).toFixed(2)}
                      </Text>
                    ) : (
                      <Text style={s.costCellMissing}>—</Text>
                    )}
                  </View>
                )}
              </View>
              <View style={s.cStatus}>
                <View style={[s.badge, product.isActive ? s.badgeActive : s.badgeInactive]}>
                  <Text style={[s.badgeText, product.isActive ? s.badgeTextActive : s.badgeTextInactive]}>
                    {product.isActive ? 'Active' : 'Inactive'}
                  </Text>
                </View>
              </View>

              {/* Row menu */}
              <View style={s.cActions}>
                <OverlayMenu menuWidth={160} align="right"
                  trigger={({ open }) => (
                    <TouchableOpacity
                      style={s.menuBtn}
                      onPress={e => { e.stopPropagation?.(); open(); }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <MoreVertical size={16} color={TEXT_LIGHT} />
                    </TouchableOpacity>
                  )}
                >
                  {({ close }) => (
                    <>
                      <TouchableOpacity style={s.menuItem} onPress={() => { close(); setEditing(product); setModalVisible(true); }}>
                        <Pencil size={15} color={TEXT_LIGHT} />
                        <Text style={s.menuItemText}>Edit</Text>
                      </TouchableOpacity>
                      <View style={s.menuDivider} />
                      <TouchableOpacity style={s.menuItem} onPress={() => { close(); handleToggleActive(product); }}>
                        {product.isActive ? <EyeOff size={15} color="#DC2626" /> : <Eye size={15} color="#059669" />}
                        <Text style={[s.menuItemText, { color: product.isActive ? '#DC2626' : '#059669' }]}>
                          {product.isActive ? 'Disable' : 'Enable'}
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}
                </OverlayMenu>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}



      <ProductFormModal
        visible={modalVisible}
        initial={editing}
        onSave={handleSave}
        onClose={() => setModalVisible(false)}
      />

      <BulkAssignModal
        visible={!!assignModal}
        field={assignModal}
        onSave={handleBulkAssign}
        onClose={() => setAssignModal(null)}
      />

      <BulkCostModal
        visible={!!bulkCostModal}
        mode={bulkCostModal}
        onSave={async (value) => { await handleBulkCost(bulkCostModal!, value); }}
        onClose={() => setBulkCostModal(null)}
      />

      <BulkVendorModal
        visible={!!bulkVendorModal}
        mode={bulkVendorModal}
        onSave={async (vendorId) => {
          if (bulkVendorModal === 'assign') await handleBulkAssignVendor(vendorId);
          else await handleBulkSetPreferredVendor(vendorId);
        }}
        onClose={() => setBulkVendorModal(null)}
      />

      <BulkTemplateModal
        visible={bulkTemplateModal}
        onSave={handleBulkAssignTemplate}
        onClose={() => setBulkTemplateModal(false)}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },

  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    backgroundColor: SURFACE,
  },
  pageHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pageTitle: { fontSize: 20, fontWeight: '700', color: TEXT },
  countBadge: { backgroundColor: '#EFF6FF', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  countText: { fontSize: 12, fontWeight: '600', color: BRAND },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  outlineBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderColor: BORDER, borderRadius: 8,
    paddingVertical: 7, paddingHorizontal: 11,
    backgroundColor: SURFACE,
  },
  outlineBtnText: { fontSize: 13, color: TEXT_LIGHT, fontWeight: '500' },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: BRAND, borderRadius: 8,
    paddingVertical: 8, paddingHorizontal: 14,
  },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  floatingMenu: {
    position: 'absolute' as any,
    backgroundColor: SURFACE,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    zIndex: 200,
    overflow: 'hidden' as any,
  },
  floatItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10 },
  floatItemText: { fontSize: 14, color: TEXT },
  floatDivider: { height: 1, backgroundColor: BORDER, marginHorizontal: 14 },

  toolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: SURFACE,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    gap: 10,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 8,
    maxWidth: 480,
  },
  searchInput: { flex: 1, fontSize: 14, color: TEXT, outlineStyle: 'none' as any },
  filterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderColor: BORDER, borderRadius: 8,
    paddingVertical: 7, paddingHorizontal: 11,
    backgroundColor: SURFACE,
  },
  filterBtnActive: { borderColor: BRAND, backgroundColor: '#EFF6FF' },
  filterBtnText: { fontSize: 13, color: TEXT_LIGHT, fontWeight: '500' },

  filterPanel: {
    backgroundColor: SURFACE,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 10,
  },
  filterGroup: { gap: 6 },
  filterGroupLabel: { fontSize: 11, fontWeight: '600', color: TEXT_LIGHT, textTransform: 'uppercase', letterSpacing: 0.4 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: {
    paddingVertical: 4, paddingHorizontal: 12,
    borderRadius: 20, borderWidth: 1, borderColor: BORDER,
    backgroundColor: BG,
  },
  pillActive: { borderColor: BRAND, backgroundColor: '#EFF6FF' },
  pillText: { fontSize: 13, color: TEXT_LIGHT },
  pillTextActive: { color: BRAND, fontWeight: '600' },

  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#EFF6FF',
    borderBottomWidth: 1,
    borderBottomColor: '#BFDBFE',
  },
  selectionText: { fontSize: 13, fontWeight: '600', color: BRAND },
  selectionLink: { fontSize: 13, color: BRAND, textDecorationLine: 'underline' },
  selDivider: { width: 1, height: 18, backgroundColor: '#BFDBFE' },
  selBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: BRAND, borderRadius: 6,
    paddingVertical: 5, paddingHorizontal: 10,
    backgroundColor: SURFACE,
  },
  selBtnText: { fontSize: 13, color: BRAND, fontWeight: '500' },

  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#000000',
  },
  sortBtn: { flexDirection: 'row' as any, alignItems: 'center' as any, gap: 4 },
  sortBtnText: { fontSize: 11, fontWeight: '700' as any, color: '#ffffff', textTransform: 'uppercase' as any, letterSpacing: 0.5 },
  sortBtnTextActive: { color: BRAND },

  list: { flex: 1 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 13,
    backgroundColor: SURFACE,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  rowSelected: { backgroundColor: '#F0F9FF' },
  td: { fontSize: 14, color: TEXT },
  tdBold: { fontWeight: '600' },
  tdSub: { fontSize: 11, color: TEXT_LIGHT, marginTop: 1 },

  cCheck:  { width: 30, marginRight: 8 },
  cStyle:  { width: 96, marginRight: 16 },
  cBrand:  { width: 120, marginRight: 16 },
  cName:   { flex: 1, minWidth: 140, marginRight: 16 },
  cCat:    { width: 120, marginRight: 16, justifyContent: 'center' as any },
  cVendor: { width: 140, marginRight: 16, justifyContent: 'center' as any },
  cCost:   { width: 80, marginRight: 12, justifyContent: 'center' as any },
  cStatus: { width: 80, marginRight: 8 },
  cActions: { width: 44, alignItems: 'center', position: 'relative' as any },

  costCell: { fontSize: 13, fontWeight: '600', color: TEXT },
  costCellMissing: { fontSize: 13, color: '#D1D5DB', borderBottomWidth: 1, borderBottomColor: '#D1D5DB', borderStyle: 'dashed' as any },

  costEditBar: {
    flexDirection: 'row' as any, alignItems: 'center' as any, gap: 8,
    paddingHorizontal: 20, paddingVertical: 10,
    backgroundColor: '#FFFBEB',
    borderBottomWidth: 1, borderBottomColor: '#FDE68A',
  },
  costEditBarText: { flex: 1, fontSize: 13, color: '#92400E' },
  costEditDoneBtn: {
    borderRadius: 6, paddingVertical: 5, paddingHorizontal: 14,
    backgroundColor: '#D97706',
  },
  costEditDoneBtnText: { fontSize: 13, fontWeight: '600' as any, color: '#fff' },
  costInput: {
    fontSize: 13, fontWeight: '600', color: TEXT,
    borderWidth: 1, borderColor: BRAND, borderRadius: 4,
    paddingHorizontal: 5, paddingVertical: 2,
    outlineStyle: 'none' as any, width: 68,
  },

  badge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  badgeActive:     { backgroundColor: '#D1FAE5' },
  badgeInactive:   { backgroundColor: '#F3F4F6' },
  badgeText:       { fontSize: 11, fontWeight: '600' },
  badgeTextActive: { color: '#059669' },
  badgeTextInactive: { color: '#6B7280' },

  menuBtn: { padding: 4 },
  menu: {
    position: 'absolute' as any,
    top: 28, right: 0,
    backgroundColor: SURFACE,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    zIndex: 100,
    minWidth: 160,
    overflow: 'hidden' as any,
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10 },
  menuItemText: { fontSize: 14, color: TEXT },
  menuDivider: { height: 1, backgroundColor: BORDER, marginHorizontal: 14 },

  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyBox:   { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 60 },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: TEXT_LIGHT },
  emptySubtitle: { fontSize: 13, color: TEXT_LIGHT },
});

const fm = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheet: {
    backgroundColor: SURFACE,
    borderRadius: 12,
    width: 480,
    maxWidth: '90%' as any,
    maxHeight: '85%' as any,
    overflow: 'hidden' as any,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  title: { fontSize: 17, fontWeight: '700', color: TEXT },
  body: { paddingHorizontal: 20, paddingTop: 16 },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 6,
    padding: 10,
    marginBottom: 12,
  },
  errorText: { fontSize: 13, color: '#DC2626' },
  label: { fontSize: 13, fontWeight: '600', color: TEXT_LIGHT, marginBottom: 6, marginTop: 14 },
  input: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: TEXT,
    backgroundColor: BG,
    outlineStyle: 'none' as any,
    marginBottom: 0,
  },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: BG,
  },
  selectText: { fontSize: 14, color: TEXT },
  dropdown: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    backgroundColor: SURFACE,
    marginTop: 4,
    overflow: 'hidden' as any,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
    zIndex: 10,
  },
  dropOption: { paddingHorizontal: 14, paddingVertical: 10 },
  dropOptionActive: { backgroundColor: '#EFF6FF' },
  dropOptionText: { fontSize: 14, color: TEXT },
  dropOptionTextActive: { color: BRAND, fontWeight: '600' },
  footer: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  btnCancel: {
    flex: 1,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  btnCancelText: { fontSize: 14, fontWeight: '600', color: TEXT_LIGHT },
  btnSave: {
    flex: 2,
    backgroundColor: BRAND,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  btnSaveText: { fontSize: 14, fontWeight: '600', color: '#fff' },
});
