import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { CheckCircle, AlertCircle, X } from 'lucide-react-native';
import Colors from '@/constants/colors';

interface ToastProps {
  visible: boolean;
  message: string;
  type?: 'success' | 'error' | 'info';
  duration?: number;
  onHide: () => void;
}

export function Toast({ visible, message, type = 'success', duration = 3000, onHide }: ToastProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      const timer = setTimeout(() => {
        hideToast();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -20,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onHide();
    });
  };

  if (!visible) return null;

  const bgColor = type === 'success' ? Colors.light.success : 
                  type === 'error' ? Colors.light.error : Colors.light.tint;

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: bgColor },
        { opacity: fadeAnim, transform: [{ translateY }] },
      ]}
    >
      <View style={styles.content}>
        {type === 'success' ? (
          <CheckCircle size={20} color="#fff" />
        ) : (
          <AlertCircle size={20} color="#fff" />
        )}
        <Text style={styles.message}>{message}</Text>
      </View>
      <TouchableOpacity onPress={hideToast} style={styles.closeBtn}>
        <X size={18} color="#fff" />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 9999,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  message: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#fff',
    flex: 1,
  },
  closeBtn: {
    padding: 4,
    marginLeft: 8,
  },
});
