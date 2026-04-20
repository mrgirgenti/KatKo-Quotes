import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  ActivityIndicator,
  Platform,
  Image,
} from 'react-native';
import Colors from '@/constants/colors';

export interface CropModalProps {
  visible: boolean;
  imageUri: string;
  aspect: [number, number];
  title: string;
  onConfirm: (croppedUri: string) => void;
  onCancel: () => void;
}

const CONTAINER_W = 480;

function getContainerH(aspect: [number, number]) {
  return Math.round(CONTAINER_W / (aspect[0] / aspect[1]));
}

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

export function CropModal({ visible, imageUri, aspect, title, onConfirm, onCancel }: CropModalProps) {
  const [naturalW, setNaturalW] = useState(0);
  const [naturalH, setNaturalH] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [saving, setSaving] = useState(false);

  const containerH = getContainerH(aspect);
  const dragRef = useRef<{ startX: number; startY: number; startOX: number; startOY: number } | null>(null);

  const imageW = naturalW * zoom;
  const imageH = naturalH * zoom;

  const clampOffset = useCallback((ox: number, oy: number, iw: number, ih: number) => {
    // When image is larger than crop window: edges must cover the frame
    // When image is smaller than crop window: image must stay inside the frame
    const minX = Math.min(0, CONTAINER_W - iw);
    const maxX = Math.max(0, CONTAINER_W - iw);
    const minY = Math.min(0, containerH - ih);
    const maxY = Math.max(0, containerH - ih);
    return {
      x: clamp(ox, minX, maxX),
      y: clamp(oy, minY, maxY),
    };
  }, [containerH]);

  const initFromImage = useCallback((nw: number, nh: number) => {
    const scaleW = CONTAINER_W / nw;
    const scaleH = containerH / nh;
    // Start at "contain" zoom so the whole image is visible on open,
    // rather than "cover" (fill-frame) which forces cropping immediately.
    const containZoom = Math.min(scaleW, scaleH);
    const initialZoom = containZoom;
    const iw = nw * initialZoom;
    const ih = nh * initialZoom;
    const ox = (CONTAINER_W - iw) / 2;
    const oy = (containerH - ih) / 2;
    setZoom(initialZoom);
    setOffsetX(ox);
    setOffsetY(oy);
  }, [containerH]);

  useEffect(() => {
    if (!visible || !imageUri) return;
    const img = new (window as any).Image();
    img.onload = () => {
      setNaturalW(img.naturalWidth);
      setNaturalH(img.naturalHeight);
      initFromImage(img.naturalWidth, img.naturalHeight);
    };
    img.src = imageUri;
  }, [visible, imageUri]);

  const handleZoomChange = useCallback((newZoom: number) => {
    setZoom(newZoom);
    if (naturalW && naturalH) {
      const iw = naturalW * newZoom;
      const ih = naturalH * newZoom;
      const { x, y } = clampOffset(offsetX, offsetY, iw, ih);
      setOffsetX(x);
      setOffsetY(y);
    }
  }, [naturalW, naturalH, offsetX, offsetY, clampOffset]);

  const onMouseDown = useCallback((e: any) => {
    e.preventDefault();
    dragRef.current = {
      startX: e.clientX ?? e.touches?.[0]?.clientX,
      startY: e.clientY ?? e.touches?.[0]?.clientY,
      startOX: offsetX,
      startOY: offsetY,
    };
  }, [offsetX, offsetY]);

  const onMouseMove = useCallback((e: any) => {
    if (!dragRef.current) return;
    const cx = e.clientX ?? e.touches?.[0]?.clientX;
    const cy = e.clientY ?? e.touches?.[0]?.clientY;
    const dx = cx - dragRef.current.startX;
    const dy = cy - dragRef.current.startY;
    const rawX = dragRef.current.startOX + dx;
    const rawY = dragRef.current.startOY + dy;
    const { x, y } = clampOffset(rawX, rawY, imageW, imageH);
    setOffsetX(x);
    setOffsetY(y);
  }, [imageW, imageH, clampOffset]);

  const onMouseUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const handleConfirm = useCallback(async () => {
    setSaving(true);
    try {
      const cropX = -offsetX / zoom;
      const cropY = -offsetY / zoom;
      const cropW = CONTAINER_W / zoom;
      const cropH = containerH / zoom;

      const img = new (window as any).Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = rej;
        img.src = imageUri;
      });

      const canvas = document.createElement('canvas');
      canvas.width = Math.round(cropW);
      canvas.height = Math.round(cropH);
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
      const dataUrl = canvas.toDataURL('image/png');
      onConfirm(dataUrl);
    } catch (e) {
      console.error('Crop failed', e);
    } finally {
      setSaving(false);
    }
  }, [offsetX, offsetY, zoom, containerH, imageUri, onConfirm]);

  if (Platform.OS !== 'web') return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.hint}>Drag to reposition · Scroll to zoom</Text>
          </View>

          {/* Crop viewport */}
          <View
            style={[styles.cropWindow, { width: CONTAINER_W, height: containerH }]}
            // @ts-ignore — web mouse events
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onTouchStart={onMouseDown}
            onTouchMove={onMouseMove}
            onTouchEnd={onMouseUp}
          >
            {imageUri && naturalW > 0 && (
              <Image
                source={{ uri: imageUri }}
                style={{
                  position: 'absolute',
                  left: offsetX,
                  top: offsetY,
                  width: imageW,
                  height: imageH,
                }}
                resizeMode="stretch"
              />
            )}
            {/* Crop border overlay */}
            <View style={styles.cropBorder} pointerEvents="none" />
          </View>

          {/* Zoom slider */}
          <View style={styles.zoomRow}>
            <Text style={styles.zoomLabel}>Zoom</Text>
            <View style={{ flex: 1 }}>
              {/* @ts-ignore */}
              <input
                type="range"
                min={naturalW > 0 ? Math.min(CONTAINER_W / naturalW, containerH / naturalH) * 0.25 : 0.1}
                max={4}
                step={0.01}
                value={zoom}
                onChange={(e: any) => handleZoomChange(Number(e.target.value))}
                style={{ width: '100%', accentColor: Colors.light.tint, cursor: 'pointer' }}
              />
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} disabled={saving}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, saving && { opacity: 0.5 }]}
              onPress={handleConfirm}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.confirmText}>Apply Crop</Text>
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    width: CONTAINER_W,
    maxWidth: '100%' as any,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.text,
  },
  hint: {
    fontSize: 11,
    color: Colors.light.textSecondary,
  },
  cropWindow: {
    backgroundColor: '#111',
    overflow: 'hidden',
    cursor: 'grab' as any,
    position: 'relative',
    userSelect: 'none' as any,
  },
  cropBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
    borderRadius: 2,
  },
  zoomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    backgroundColor: Colors.light.background,
  },
  zoomLabel: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    width: 38,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    paddingTop: 8,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  confirmBtn: {
    flex: 2,
    paddingVertical: 11,
    borderRadius: 8,
    backgroundColor: Colors.light.tint,
    alignItems: 'center',
  },
  confirmText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
});
