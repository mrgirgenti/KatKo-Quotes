import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  Pressable,
  TextInput,
} from 'react-native';
import { ChevronDown, Check, Edit2 } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { applyTitleCaseOnSpace } from '@/utils/textFormatting';

interface ComboBoxProps {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  placeholder?: string;
  autoTitleCase?: boolean;
}

export function ComboBox({ label, value, options, onChange, placeholder, autoTitleCase }: ComboBoxProps) {
  const [visible, setVisible] = useState(false);
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const previousCustomValueRef = useRef('');

  const handleSelect = (option: string) => {
    onChange(option);
    setVisible(false);
    setIsCustomMode(false);
  };

  const handleCustomSubmit = () => {
    if (customValue.trim()) {
      onChange(customValue.trim());
    }
    setVisible(false);
    setIsCustomMode(false);
    setCustomValue('');
    previousCustomValueRef.current = '';
  };

  const handleCustomValueChange = (text: string) => {
    if (autoTitleCase) {
      const formattedText = applyTitleCaseOnSpace(text, previousCustomValueRef.current);
      previousCustomValueRef.current = formattedText;
      setCustomValue(formattedText);
    } else {
      previousCustomValueRef.current = text;
      setCustomValue(text);
    }
  };

  const handleOpenCustom = () => {
    setIsCustomMode(true);
    setCustomValue(value && !options.includes(value) ? value : '');
  };

  const handleClose = () => {
    setVisible(false);
    setIsCustomMode(false);
    setCustomValue('');
    previousCustomValueRef.current = '';
  };

  const isCustomValue = value && !options.includes(value);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={styles.selector}
        onPress={() => setVisible(true)}
        activeOpacity={0.7}
      >
        <Text
          style={[styles.selectorText, !value && styles.placeholder, isCustomValue && styles.customValueText]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {value || placeholder || 'Select...'}
        </Text>
        <ChevronDown size={16} color={Colors.light.textSecondary} />
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={handleClose}
      >
        <Pressable style={styles.overlay} onPress={handleClose}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{label}</Text>
            </View>

            {isCustomMode ? (
              <View style={styles.customInputContainer}>
                <Text style={styles.customInputLabel}>Enter custom value:</Text>
                <TextInput
                  style={styles.customInput}
                  value={customValue}
                  onChangeText={handleCustomValueChange}
                  placeholder="Type value..."
                  placeholderTextColor={Colors.light.textSecondary}
                  autoFocus
                  onSubmitEditing={handleCustomSubmit}
                />
                <View style={styles.customInputActions}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => setIsCustomMode(false)}
                  >
                    <Text style={styles.cancelButtonText}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.confirmButton, !customValue.trim() && styles.confirmButtonDisabled]}
                    onPress={handleCustomSubmit}
                    disabled={!customValue.trim()}
                  >
                    <Text style={styles.confirmButtonText}>Confirm</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.customOption}
                  onPress={handleOpenCustom}
                >
                  <Edit2 size={13} color={Colors.light.tint} />
                  <Text style={styles.customOptionText}>Enter custom value...</Text>
                </TouchableOpacity>
                <FlatList
                  data={options}
                  keyExtractor={(item) => item}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[styles.option, value === item && styles.optionSelected]}
                      onPress={() => handleSelect(item)}
                    >
                      <Text style={[styles.optionText, value === item && styles.optionTextSelected]}>
                        {item}
                      </Text>
                      {value === item && <Check size={14} color={Colors.light.tint} />}
                    </TouchableOpacity>
                  )}
                  showsVerticalScrollIndicator={false}
                  style={styles.list}
                />
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 10,
  },
  label: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.light.text,
    marginBottom: 5,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.light.background,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  selectorText: {
    fontSize: 13,
    color: Colors.light.text,
    flex: 1,
    minWidth: 0,
  },
  placeholder: {
    color: Colors.light.textSecondary,
  },
  customValueText: {
    color: Colors.light.tint,
    fontWeight: '500' as const,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  modalContent: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    width: '100%',
    maxWidth: 340,
    maxHeight: '60%',
    overflow: 'hidden',
  },
  modalHeader: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.light.text,
    textAlign: 'center',
  },
  customOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    backgroundColor: Colors.light.highlightBg,
    gap: 8,
  },
  customOptionText: {
    fontSize: 13,
    color: Colors.light.tint,
    fontWeight: '500' as const,
  },
  list: {
    maxHeight: 240,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  optionSelected: {
    backgroundColor: Colors.light.highlightBg,
  },
  optionText: {
    fontSize: 13,
    color: Colors.light.text,
  },
  optionTextSelected: {
    fontWeight: '600' as const,
    color: Colors.light.tint,
  },
  customInputContainer: {
    padding: 14,
  },
  customInputLabel: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginBottom: 10,
  },
  customInput: {
    backgroundColor: Colors.light.background,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.light.text,
  },
  customInputActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: Colors.light.tint,
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: Colors.light.border,
  },
  confirmButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#fff',
  },
});
