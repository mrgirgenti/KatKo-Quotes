import React, { useRef, useState, useCallback, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { Camera } from 'lucide-react-native';

const INITIAL_COLORS = ['#FF5A00', '#7C3AED', '#0284C7', '#16A34A', '#DB2777'];

function colorForName(name: string): string {
  if (!name) return INITIAL_COLORS[0];
  return INITIAL_COLORS[name.charCodeAt(0) % INITIAL_COLORS.length];
}

interface OrgLogoUploaderProps {
  orgId: string;
  orgName: string;
  currentLogoUrl?: string | null;
  onLogoChange: (url: string | null) => void;
  size?: number;
}

export function OrgLogoUploader({ orgId, orgName, currentLogoUrl, onLogoChange, size = 80 }: OrgLogoUploaderProps) {
  const fileInputRef = useRef<any>(null);
  const [uploading, setUploading] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentLogoUrl ?? null);

  useEffect(() => {
    setPreviewUrl(currentLogoUrl ?? null);
    setImgError(false);
  }, [currentLogoUrl]);

  const handleUpload = useCallback(async (file: File) => {
    setUploading(true);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setImgError(false);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('orgId', orgId);
      fd.append('fileType', 'OTHER');
      fd.append('visibility', 'CLIENT_VISIBLE');
      const res = await fetch('/api/files', { method: 'POST', body: fd });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      const url = `/api/files/${data.file.id}?inline=true`;
      setPreviewUrl(url);
      onLogoChange(url);
    } catch {
      setPreviewUrl(currentLogoUrl ?? null);
    } finally {
      setUploading(false);
    }
  }, [orgId, currentLogoUrl, onLogoChange]);

  const handleFileChange = useCallback((e: any) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    e.target.value = '';
  }, [handleUpload]);

  const handleRemove = useCallback(() => {
    setPreviewUrl(null);
    setImgError(false);
    onLogoChange(null);
  }, [onLogoChange]);

  const borderRadius = Math.max(8, size * 0.15);
  const hasLogo = !!previewUrl && !imgError;
  const initial = (orgName?.[0] ?? '?').toUpperCase();
  const bg = colorForName(orgName);

  return (
    <View style={styles.wrapper}>
      <View style={{ position: 'relative', width: size, height: size }}>
        <TouchableOpacity
          style={[styles.avatarBtn, { width: size, height: size, borderRadius }, hasLogo && styles.avatarBtnTransparent]}
          onPress={() => !uploading && fileInputRef.current?.click?.()}
          activeOpacity={0.85}
          disabled={uploading}
        >
          {hasLogo ? (
            <Image
              source={{ uri: previewUrl! }}
              style={{ width: size, height: size, borderRadius, backgroundColor: 'transparent' }}
              resizeMode="contain"
              onError={() => setImgError(true)}
            />
          ) : (
            <View style={[styles.initial, { width: size, height: size, borderRadius, backgroundColor: bg }]}>
              <Text style={[styles.initialText, { fontSize: size * 0.38 }]}>{initial}</Text>
            </View>
          )}
          {uploading && (
            <View style={[styles.overlay, { borderRadius }]}>
              <ActivityIndicator size="small" color="#fff" />
            </View>
          )}
        </TouchableOpacity>

        {!uploading && (
          <TouchableOpacity
            style={styles.cameraBadge}
            onPress={() => fileInputRef.current?.click?.()}
          >
            <Camera size={11} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity onPress={() => fileInputRef.current?.click?.()} disabled={uploading}>
          <Text style={styles.changeText}>{hasLogo ? 'Change' : 'Upload Logo'}</Text>
        </TouchableOpacity>
        {hasLogo && !uploading && (
          <>
            <Text style={styles.actionDivider}>·</Text>
            <TouchableOpacity onPress={handleRemove}>
              <Text style={styles.removeText}>Remove</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {Platform.OS === 'web' && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,image/gif,image/webp"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    gap: 6,
  },
  avatarBtn: {
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
  },
  avatarBtnTransparent: {
    backgroundColor: 'transparent',
  },
  initial: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  initialText: {
    color: '#fff',
    fontWeight: '700',
  },
  overlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraBadge: {
    position: 'absolute' as const,
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#1F2937',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  changeText: {
    fontSize: 12,
    color: '#FF5A00',
    fontWeight: '500',
  },
  actionDivider: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  removeText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '500',
  },
});
