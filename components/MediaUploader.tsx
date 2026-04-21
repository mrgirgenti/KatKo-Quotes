import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { Upload, X, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react-native';
import Colors from '@/constants/colors';

type Shape = 'wide' | 'square' | 'circle';
type UploadState = 'idle' | 'uploading' | 'success' | 'error';

interface MediaUploaderProps {
  currentUrl?: string | null;
  onUrlChange: (url: string | null) => void;
  orgId: string;
  label?: string;
  shape?: Shape;
  disabled?: boolean;
  accept?: string;
}

const ACCEPT = 'image/png,image/jpeg,image/svg+xml,image/gif,image/webp';

export function MediaUploader({
  currentUrl,
  onUrlChange,
  orgId,
  label,
  shape = 'wide',
  disabled = false,
  accept = ACCEPT,
}: MediaUploaderProps) {
  const fileInputRef = useRef<any>(null);
  const dropRef = useRef<any>(null);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl || null);

  useEffect(() => {
    setPreviewUrl(currentUrl || null);
    setImgError(false);
  }, [currentUrl]);

  const uploadFile = useCallback(async (file: File) => {
    setUploadState('uploading');
    setErrorMsg(null);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('orgId', orgId);
      fd.append('fileType', 'OTHER');
      fd.append('visibility', 'CLIENT_VISIBLE');
      const res = await fetch('/api/files', { method: 'POST', body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Upload failed');
      }
      const data = await res.json();
      const url = `/api/files/${data.file.id}?inline=true`;
      setPreviewUrl(url);
      onUrlChange(url);
      setUploadState('success');
      setTimeout(() => setUploadState('idle'), 2500);
    } catch (e: any) {
      setPreviewUrl(currentUrl || null);
      setErrorMsg(e.message || 'Upload failed');
      setUploadState('error');
      setTimeout(() => setUploadState('idle'), 4000);
    }
  }, [orgId, currentUrl, onUrlChange]);

  const handleFileChange = useCallback((e: any) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = '';
  }, [uploadFile]);

  const handleRemove = useCallback(() => {
    setPreviewUrl(null);
    setImgError(false);
    setUploadState('idle');
    onUrlChange(null);
  }, [onUrlChange]);

  const triggerPicker = useCallback(() => {
    if (!disabled && uploadState !== 'uploading') {
      fileInputRef.current?.click?.();
    }
  }, [disabled, uploadState]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = dropRef.current;
    if (!el) return;

    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
      setIsDragOver(true);
    };
    const onDragLeave = () => setIsDragOver(false);
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer?.files?.[0];
      if (file && !disabled && uploadState !== 'uploading') {
        uploadFile(file);
      }
    };

    el.addEventListener('dragover', onDragOver);
    el.addEventListener('dragleave', onDragLeave);
    el.addEventListener('drop', onDrop);
    return () => {
      el.removeEventListener('dragover', onDragOver);
      el.removeEventListener('dragleave', onDragLeave);
      el.removeEventListener('drop', onDrop);
    };
  }, [uploadFile, disabled, uploadState]);

  const hasImage = !!previewUrl && !imgError;
  const isUploading = uploadState === 'uploading';
  const isSuccess = uploadState === 'success';
  const isError = uploadState === 'error';

  const containerStyle = [
    styles.container,
    shape === 'wide' && styles.containerWide,
    shape === 'square' && styles.containerSquare,
    shape === 'circle' && styles.containerCircle,
    isDragOver && styles.containerDragOver,
    (disabled || isUploading) && styles.containerDisabled,
    hasImage && styles.containerHasImage,
  ];

  return (
    <View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View ref={dropRef} style={{ position: 'relative' }}>
        <TouchableOpacity
          style={containerStyle}
          onPress={triggerPicker}
          activeOpacity={0.85}
          disabled={disabled || isUploading}
        >
          {hasImage ? (
            <Image
              source={{ uri: previewUrl! }}
              style={[styles.image, shape === 'circle' && styles.imageCircle]}
              resizeMode={shape === 'wide' ? 'contain' : 'cover'}
              onError={() => setImgError(true)}
            />
          ) : (
            <View style={styles.placeholder}>
              {isUploading ? (
                <ActivityIndicator size="small" color={Colors.light.tint} />
              ) : isError ? (
                <AlertCircle size={20} color="#DC2626" />
              ) : (
                <Upload size={18} color={isDragOver ? Colors.light.tint : '#9CA3AF'} />
              )}
              <Text style={[styles.placeholderText, isError && styles.placeholderError, isDragOver && styles.placeholderDragOver]}>
                {isError
                  ? (errorMsg || 'Upload failed')
                  : isDragOver
                  ? 'Drop to upload'
                  : shape === 'wide'
                  ? 'Click or drag image here'
                  : 'Click to upload'}
              </Text>
              {!isError && !isDragOver && (
                <Text style={styles.placeholderHint}>PNG, JPG, SVG, WebP</Text>
              )}
            </View>
          )}

          {/* Uploading overlay */}
          {isUploading && hasImage && (
            <View style={styles.overlay}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.overlayText}>Uploading…</Text>
            </View>
          )}

          {/* Success flash */}
          {isSuccess && (
            <View style={[styles.overlay, styles.overlaySuccess]}>
              <CheckCircle size={16} color="#fff" />
              <Text style={styles.overlayText}>Uploaded!</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Replace / Remove buttons when image is present */}
        {hasImage && !isUploading && (
          <View style={styles.imageActions}>
            <TouchableOpacity style={styles.imageActionBtn} onPress={triggerPicker} disabled={disabled}>
              <RefreshCw size={11} color={Colors.light.tint} />
              <Text style={styles.imageActionText}>Replace</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.imageActionBtn, styles.imageActionRemove]} onPress={handleRemove} disabled={disabled}>
              <X size={11} color="#DC2626" />
              <Text style={[styles.imageActionText, { color: '#DC2626' }]}>Remove</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {Platform.OS === 'web' && (
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 6,
  },
  container: {
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    borderStyle: 'dashed' as any,
    borderRadius: 10,
    backgroundColor: '#FAFAFA',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  } as any,
  containerWide: {
    height: 88,
    width: '100%',
  },
  containerSquare: {
    height: 88,
    width: 88,
  },
  containerCircle: {
    height: 80,
    width: 80,
    borderRadius: 40,
  },
  containerDragOver: {
    borderColor: Colors.light.tint,
    backgroundColor: '#FFF7F0',
    borderStyle: 'solid' as any,
  } as any,
  containerDisabled: {
    opacity: 0.6,
  },
  containerHasImage: {
    borderStyle: 'solid' as any,
    borderColor: Colors.light.border,
    backgroundColor: '#F9FAFB',
  } as any,
  image: {
    width: '100%',
    height: '100%',
  },
  imageCircle: {
    borderRadius: 40,
  },
  placeholder: {
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
  },
  placeholderText: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    fontWeight: '500',
  },
  placeholderError: {
    color: '#DC2626',
  },
  placeholderDragOver: {
    color: Colors.light.tint,
    fontWeight: '600',
  },
  placeholderHint: {
    fontSize: 10,
    color: '#D1D5DB',
    textAlign: 'center',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    flexDirection: 'row',
  },
  overlaySuccess: {
    backgroundColor: 'rgba(22,163,74,0.75)',
  },
  overlayText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  imageActions: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  imageActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.light.tint,
    backgroundColor: Colors.light.surface,
  },
  imageActionRemove: {
    borderColor: '#DC2626',
  },
  imageActionText: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.light.tint,
  },
});
