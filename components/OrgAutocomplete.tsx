import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { Building2, User, X, UserPlus, Edit3 } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useCrm } from '@/contexts/CrmContext';
import { Organization } from '@/types/crm';

interface Props {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  onSelectOrg: (org: Organization | null) => void;
  linkedOrg: Organization | null;
  placeholder?: string;
  onAddEditClient?: (text: string, existingOrg: Organization | null) => void;
}

export function OrgAutocomplete({ label = 'Person / Organization', value, onChangeText, onSelectOrg, linkedOrg, placeholder = 'Client name or company', onAddEditClient }: Props) {
  const { orgs } = useCrm();
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const suggestions = React.useMemo(() => {
    if (!focused || value.trim().length < 1) return [];
    const q = value.toLowerCase();
    return orgs
      .filter((o) =>
        o.name.toLowerCase().includes(q) ||
        o.contacts.some((c) => `${c.firstName} ${c.lastName}`.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [orgs, value, focused]);

  const showDropdown = focused && value.trim().length >= 1;

  const handleSelect = useCallback((org: Organization) => {
    onChangeText(org.name);
    onSelectOrg(org);
    setFocused(false);
    inputRef.current?.blur();
  }, [onChangeText, onSelectOrg]);

  const handleClear = useCallback(() => {
    onChangeText('');
    onSelectOrg(null);
    setFocused(false);
    setTimeout(() => { inputRef.current?.focus(); setFocused(true); }, 50);
  }, [onChangeText, onSelectOrg]);

  const handleAddEdit = useCallback(() => {
    setFocused(false);
    inputRef.current?.blur();
    onAddEditClient?.(value.trim(), linkedOrg ?? null);
  }, [onAddEditClient, value, linkedOrg]);

  const primaryContact = linkedOrg?.contacts.find((c) => c.isPrimary) || linkedOrg?.contacts[0];

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.inputRow, focused && !linkedOrg && styles.inputRowFocused, linkedOrg && styles.inputRowLinked]}>
        {linkedOrg ? (
          <View style={styles.linkedBadge}>
            <Building2 size={14} color={Colors.light.tint} />
          </View>
        ) : (
          <View style={styles.iconLeft}>
            <User size={14} color={Colors.light.textSecondary} />
          </View>
        )}
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={value}
          onChangeText={(t) => { onChangeText(t); onSelectOrg(null); }}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder={placeholder}
          placeholderTextColor={Colors.light.textSecondary}
          returnKeyType="done"
        />
        {(value.length > 0 || linkedOrg) && (
          <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
            <X size={13} color={Colors.light.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {linkedOrg && (
        <View style={styles.linkedRow}>
          <Text style={styles.linkedInfoText}>
            Linked to CRM org
            {primaryContact ? ` · ${primaryContact.firstName} ${primaryContact.lastName}` : ''}
            {primaryContact?.email ? ` · ${primaryContact.email}` : ''}
          </Text>
          {onAddEditClient && (
            <TouchableOpacity style={styles.editChip} onPress={() => onAddEditClient(value.trim(), linkedOrg)}>
              <Edit3 size={10} color={Colors.light.tint} />
              <Text style={styles.editChipText}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {showDropdown && (
        <View style={styles.dropdown}>
          <ScrollView keyboardShouldPersistTaps="always" showsVerticalScrollIndicator={false} style={{ maxHeight: 240 }}>
            {suggestions.map((org) => {
              const primary = org.contacts.find((c) => c.isPrimary) || org.contacts[0];
              return (
                <Pressable key={org.id} style={({ pressed }) => [styles.suggestion, pressed && styles.suggestionPressed]} onPress={() => handleSelect(org)}>
                  <View style={styles.suggestionAvatar}>
                    <Text style={styles.suggestionAvatarText}>{org.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={styles.suggestionInfo}>
                    <Text style={styles.suggestionName}>{org.name}</Text>
                    {primary && (
                      <Text style={styles.suggestionSub}>{primary.firstName} {primary.lastName}{primary.email ? ` · ${primary.email}` : ''}</Text>
                    )}
                    {org.type && !primary && (
                      <Text style={styles.suggestionSub}>{org.type}</Text>
                    )}
                  </View>
                  <View style={[styles.statusDot, { backgroundColor: org.status === 'Active Client' ? Colors.light.tint : org.status === 'Working' ? '#1D4ED8' : '#9CA3AF' }]} />
                </Pressable>
              );
            })}

            {onAddEditClient && (
              <Pressable
                style={({ pressed }) => [styles.addEditRow, pressed && styles.suggestionPressed]}
                onPress={handleAddEdit}
              >
                <View style={styles.addEditIcon}>
                  <UserPlus size={15} color={Colors.light.tint} />
                </View>
                <View style={styles.suggestionInfo}>
                  <Text style={styles.addEditLabel}>
                    {suggestions.length > 0
                      ? `Add / Edit Client Information`
                      : `Add "${value.trim()}" as new client`}
                  </Text>
                  {suggestions.length === 0 && (
                    <Text style={styles.suggestionSub}>Save contact info to CRM</Text>
                  )}
                </View>
              </Pressable>
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 8, zIndex: 999 },
  label: { fontSize: 11, fontWeight: '600', color: Colors.light.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.light.background,
    borderRadius: 10, borderWidth: 1.5, borderColor: Colors.light.border,
    paddingHorizontal: 10,
    minHeight: 46,
  },
  inputRowFocused: { borderColor: Colors.light.tint },
  inputRowLinked: { borderColor: Colors.light.tint, backgroundColor: `${Colors.light.tint}08` },
  iconLeft: { marginRight: 6 },
  linkedBadge: { marginRight: 6 },
  input: { flex: 1, fontSize: 15, color: Colors.light.text, paddingVertical: 10 },
  clearBtn: { padding: 4, marginLeft: 4 },
  linkedRow: { marginTop: 4, paddingHorizontal: 2, flexDirection: 'row', alignItems: 'center', gap: 8 },
  linkedInfoText: { fontSize: 11, color: Colors.light.tint, fontWeight: '500', flex: 1 },
  editChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: `${Colors.light.tint}15`,
    borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3,
  },
  editChipText: { fontSize: 11, fontWeight: '600', color: Colors.light.tint },
  dropdown: {
    position: 'absolute', top: '100%', left: 0, right: 0,
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1, borderColor: Colors.light.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12,
    elevation: 8,
    zIndex: 9999,
    marginTop: 2,
    overflow: 'hidden',
  },
  suggestion: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, gap: 10 },
  suggestionPressed: { backgroundColor: Colors.light.background },
  suggestionAvatar: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: `${Colors.light.tint}20`,
    alignItems: 'center', justifyContent: 'center',
  },
  suggestionAvatarText: { fontSize: 14, fontWeight: '700', color: Colors.light.tint },
  suggestionInfo: { flex: 1 },
  suggestionName: { fontSize: 14, fontWeight: '600', color: Colors.light.text },
  suggestionSub: { fontSize: 12, color: Colors.light.textSecondary, marginTop: 1 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  addEditRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11, gap: 10,
    borderTopWidth: 1, borderTopColor: Colors.light.border,
    backgroundColor: `${Colors.light.tint}06`,
  },
  addEditIcon: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: `${Colors.light.tint}20`,
    alignItems: 'center', justifyContent: 'center',
  },
  addEditLabel: { fontSize: 14, fontWeight: '600', color: Colors.light.tint },
});
