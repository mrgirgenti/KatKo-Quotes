import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Colors from '@/constants/colors';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmText = 'Yes',
  cancelText = 'No',
  confirmDestructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onCancel}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <View style={styles.dialog}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.message}>{message}</Text>
            <View style={styles.buttons}>
              <TouchableOpacity style={[styles.btn, styles.cancelBtn]} onPress={onCancel}>
                <Text style={styles.cancelBtnText}>{cancelText}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, confirmDestructive ? styles.destructiveBtn : styles.confirmBtn]}
                onPress={onConfirm}
              >
                <Text style={confirmDestructive ? styles.destructiveBtnText : styles.confirmBtnText}>
                  {confirmText}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  dialog: {
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    padding: 24,
    width: 320,
    maxWidth: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    lineHeight: 20,
    marginBottom: 24,
  },
  buttons: {
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelBtn: {
    borderWidth: 1.5,
    borderColor: Colors.light.border,
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  confirmBtn: {
    backgroundColor: Colors.light.tint,
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#fff',
  },
  destructiveBtn: {
    backgroundColor: '#EF4444',
  },
  destructiveBtnText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#fff',
  },
});
