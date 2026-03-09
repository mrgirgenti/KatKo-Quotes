import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  Pressable,
} from 'react-native';
import { ChevronDown, Check } from 'lucide-react-native';
import Colors from '@/constants/colors';

interface DropdownProps {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  placeholder?: string;
}

export function Dropdown({ label, value, options, onChange, placeholder }: DropdownProps) {
  const [visible, setVisible] = useState(false);

  const handleSelect = (option: string) => {
    onChange(option);
    setVisible(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={styles.selector}
        onPress={() => setVisible(true)}
        activeOpacity={0.7}
      >
        <Text 
          style={[styles.selectorText, !value && styles.placeholder]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {value || placeholder || 'Select...'}
        </Text>
        <ChevronDown size={18} color={Colors.light.textSecondary} />
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setVisible(false)}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{label}</Text>
            </View>
            <FlatList
              data={options}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.option, value === item && styles.optionSelected]}
                  onPress={() => handleSelect(item)}
                >
                  <Text
                    style={[styles.optionText, value === item && styles.optionTextSelected]}
                  >
                    {item}
                  </Text>
                  {value === item && <Check size={18} color={Colors.light.tint} />}
                </TouchableOpacity>
              )}
              showsVerticalScrollIndicator={false}
              style={styles.list}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.text,
    marginBottom: 6,
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
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  selectorText: {
    fontSize: 15,
    color: Colors.light.text,
    flex: 1,
    minWidth: 0,
  },
  placeholder: {
    color: Colors.light.textSecondary,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    width: '100%',
    maxHeight: '70%',
    overflow: 'hidden',
  },
  modalHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.light.text,
    textAlign: 'center',
  },
  list: {
    maxHeight: 400,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  optionSelected: {
    backgroundColor: Colors.light.highlightBg,
  },
  optionText: {
    fontSize: 15,
    color: Colors.light.text,
  },
  optionTextSelected: {
    fontWeight: '600' as const,
    color: Colors.light.tint,
  },
});
