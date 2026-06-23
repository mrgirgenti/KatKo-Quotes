import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
} from 'react-native';
import { X, Search, Film } from 'lucide-react-native';
import MediaCard from '@/components/MediaCard';

const BRAND = '#FF5A00';

export interface PickerMediaFile {
  id: string;
  originalName: string;
  mimeType?: string | null;
  fileSize?: number;
  createdAt?: string;
}

interface MediaPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (file: PickerMediaFile) => void;
  files: PickerMediaFile[];
  loading?: boolean;
  orgId: string;
  isMobile?: boolean;
  isTablet?: boolean;
  title?: string;
}

function isImageMime(mime?: string): boolean {
  if (!mime) return false;
  return mime.startsWith('image/');
}

function getMimeLabel(mime?: string, name?: string): string {
  if (!mime && name) {
    const ext = name.split('.').pop()?.toUpperCase() || '';
    return ext || 'FILE';
  }
  if (mime?.startsWith('image/')) return (mime.split('/')[1] || 'IMG').toUpperCase().substring(0, 4);
  if (mime === 'application/pdf') return 'PDF';
  if (mime?.includes('illustrator') || (name || '').toLowerCase().endsWith('.ai')) return 'AI';
  return (mime?.split('/').pop()?.toUpperCase() || 'FILE').substring(0, 4);
}

function formatDate(iso?: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatBytes(bytes?: number | null): string {
  if (bytes == null || isNaN(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MediaPickerModal({
  visible,
  onClose,
  onSelect,
  files,
  loading = false,
  orgId,
  isMobile = false,
  isTablet = false,
  title = 'Choose from Media Bin',
}: MediaPickerModalProps) {
  const [search, setSearch] = useState('');

  const filtered = search.trim()
    ? files.filter(f => f.originalName.toLowerCase().includes(search.toLowerCase()))
    : files;

  const numCols = isMobile ? 2 : isTablet ? 3 : 4;
  const pctWidths: Record<number, string> = { 2: '48%', 3: '31.5%', 4: '23%' };
  const cardWidth = pctWidths[numCols] || '23%';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        onPress={onClose}
      >
        <Pressable
          style={{ backgroundColor: '#fff', borderRadius: 14, width: '100%', maxWidth: 680, maxHeight: '82%', overflow: 'hidden' }}
          onPress={() => {}}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827' }}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={18} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', backgroundColor: '#FAFAFA' }}>
            <Search size={13} color="#9CA3AF" />
            <TextInput
              style={{ flex: 1, fontSize: 13, color: '#111827' }}
              value={search}
              onChangeText={setSearch}
              placeholder="Search files…"
              placeholderTextColor="#9CA3AF"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <X size={12} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView contentContainerStyle={{ padding: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {loading ? (
              <ActivityIndicator color={BRAND} style={{ margin: 32, alignSelf: 'center' }} />
            ) : filtered.length === 0 ? (
              <View style={{ flex: 1, padding: 40, alignItems: 'center' }}>
                <Film size={32} color="#D1D5DB" />
                <Text style={{ fontSize: 13, color: '#9CA3AF', marginTop: 12, textAlign: 'center' }}>
                  {files.length === 0 ? 'No files in your Media Bin yet.' : 'No matching files.'}
                </Text>
              </View>
            ) : (
              filtered.map(f => (
                <MediaCard
                  key={f.id}
                  file={f}
                  style={{ width: cardWidth }}
                  thumbnail={isImageMime(f.mimeType)
                    ? <Image source={{ uri: `/api/portal/${orgId}/files/${f.id}?inline=true` }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    : <Text style={{ fontSize: 13, fontWeight: '800', color: BRAND, letterSpacing: 0.5 }}>{getMimeLabel(f.mimeType, f.originalName)}</Text>}
                  typeLabel={getMimeLabel(f.mimeType, f.originalName)}
                  dateLabel={formatDate(f.createdAt)}
                  sizeLabel={formatBytes(f.fileSize)}
                  onPress={() => onSelect(f)}
                />
              ))
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
