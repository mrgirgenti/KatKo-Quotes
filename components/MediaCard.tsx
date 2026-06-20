import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Download, Trash2, Edit2, Check, X } from 'lucide-react-native';

const BRAND = '#FF5A00';
const TEXT = '#1A1210';
const TEXT_LIGHT = '#9CA3AF';

export interface MediaCardFile {
  id: string;
  originalName: string;
}

export interface MediaCardProps {
  file: MediaCardFile;
  /** Endpoint-agnostic thumbnail node (e.g. <Image .../>, <AuthedImage .../>, or a type label). */
  thumbnail: React.ReactNode;
  /** Orange file-type badge text (e.g. "PNG"). */
  typeLabel: string;
  /** Formatted upload date (e.g. "Jun 20, 2026"). */
  dateLabel?: string;
  /** Formatted file size (e.g. "1.2 MB"). */
  sizeLabel?: string;
  /** Width / margin overrides for grid layout. */
  style?: any;

  /** Overlay actions — omit (e.g. in a picker) to hide. */
  onDownload?: () => void;
  onDelete?: () => void;

  /** Inline rename — omit to hide the pencil. */
  renamable?: boolean;
  isRenaming?: boolean;
  renameValue?: string;
  onRenameChange?: (text: string) => void;
  onRenameStart?: () => void;
  onRenameSubmit?: () => void;
  onRenameCancel?: () => void;

  /** Selection mode (picker) — makes the whole card pressable. */
  onPress?: () => void;
}

export default function MediaCard({
  file,
  thumbnail,
  typeLabel,
  dateLabel,
  sizeLabel,
  style,
  onDownload,
  onDelete,
  renamable = false,
  isRenaming = false,
  renameValue = '',
  onRenameChange,
  onRenameStart,
  onRenameSubmit,
  onRenameCancel,
  onPress,
}: MediaCardProps) {
  const metaLine = [dateLabel, typeLabel, sizeLabel].filter(Boolean).join(' · ');

  const body = (
    <>
      <View style={styles.thumb}>
        {thumbnail}
        {(onDownload || onDelete) && (
          <View style={styles.thumbActions}>
            {onDownload && (
              <TouchableOpacity
                style={styles.thumbBtn}
                onPress={onDownload}
                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              >
                <Download size={13} color="#fff" />
              </TouchableOpacity>
            )}
            {onDelete && (
              <TouchableOpacity
                style={[styles.thumbBtn, styles.thumbBtnDelete]}
                onPress={onDelete}
                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              >
                <Trash2 size={13} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      <View style={styles.meta}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{typeLabel}</Text>
        </View>

        {isRenaming ? (
          <View style={styles.renameRow}>
            <TextInput
              value={renameValue}
              onChangeText={onRenameChange}
              style={styles.renameInput}
              autoFocus
              selectTextOnFocus
              onSubmitEditing={onRenameSubmit}
              onBlur={onRenameSubmit}
            />
            <TouchableOpacity onPress={onRenameSubmit} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Check size={12} color="#16A34A" />
            </TouchableOpacity>
            <TouchableOpacity onPress={onRenameCancel} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <X size={12} color="#DC2626" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={2}>{file.originalName}</Text>
            {renamable && onRenameStart && (
              <TouchableOpacity
                onPress={onRenameStart}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                style={{ paddingTop: 1 }}
              >
                <Edit2 size={11} color={TEXT_LIGHT} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {metaLine ? <Text style={styles.metaLine} numberOfLines={1}>{metaLine}</Text> : null}
      </View>
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity style={[styles.card, style]} onPress={onPress} activeOpacity={0.75}>
        {body}
      </TouchableOpacity>
    );
  }
  return <View style={[styles.card, style]}>{body}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  thumb: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#F3F4F6',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbActions: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    flexDirection: 'row',
    gap: 4,
  },
  thumbBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbBtnDelete: {
    backgroundColor: 'rgba(220,38,38,0.85)',
  },
  meta: {
    padding: 8,
    gap: 3,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFF1E8',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 1,
  },
  badgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: BRAND,
    letterSpacing: 0.5,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 3,
  },
  name: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: TEXT,
    lineHeight: 15,
  },
  renameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  renameInput: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: TEXT,
    borderBottomWidth: 1,
    borderBottomColor: BRAND,
    paddingVertical: 0,
  },
  metaLine: {
    fontSize: 10,
    color: TEXT_LIGHT,
  },
});
