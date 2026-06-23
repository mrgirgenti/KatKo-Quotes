// Web wrapper that renders the ONE canonical Project Document HTML inside an
// <iframe srcDoc>, so the Client Hub Order Detail shows the EXACT same artifact
// that is exported as a PDF. There is no parallel React layout — the html is the
// single source of visual truth. On native we show a graceful fallback (the client
// hub / document is a web experience).

import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { buildProjectDocumentHTML } from '@/utils/projectDocumentHtml';
import { BuildOptions, DocumentMode, DocumentSource } from '@/utils/projectDocument';

interface ProjectDocumentProps {
  source: DocumentSource;
  mode: DocumentMode;
  options?: BuildOptions;
  minHeight?: number;
}

function ProjectDocumentWeb({ html, minHeight }: { html: string; minHeight: number }) {
  const ref = React.useRef<HTMLIFrameElement | null>(null);
  const [height, setHeight] = React.useState<number>(minHeight);

  const measure = React.useCallback(() => {
    const frame = ref.current;
    if (!frame) return;
    try {
      const doc = frame.contentDocument;
      const el = doc?.documentElement;
      const body = doc?.body;
      if (el || body) {
        const h = Math.max(el?.scrollHeight ?? 0, body?.scrollHeight ?? 0);
        if (h > 0) setHeight(h + 2);
      }
    } catch {
      /* cross-origin guard — srcDoc is same-origin so this should not happen */
    }
  }, []);

  const handleLoad = React.useCallback(() => {
    measure();
    // Re-measure after images/fonts settle so the iframe height is exact.
    setTimeout(measure, 350);
    setTimeout(measure, 1200);
  }, [measure]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  return (
    <iframe
      ref={ref}
      title="Project Document"
      srcDoc={html}
      onLoad={handleLoad}
      sandbox="allow-same-origin"
      style={{
        width: '100%',
        height,
        border: 'none',
        background: '#ffffff',
        display: 'block',
        borderRadius: 12,
      }}
    />
  );
}

export default function ProjectDocument({
  source,
  mode,
  options,
  minHeight = 640,
}: ProjectDocumentProps) {
  const html = React.useMemo(
    () => buildProjectDocumentHTML(source, mode, options),
    [source, mode, options],
  );

  if (Platform.OS !== 'web') {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackText}>
          Open this order in a web browser to view the full document.
        </Text>
      </View>
    );
  }

  return <ProjectDocumentWeb html={html} minHeight={minHeight} />;
}

const styles = StyleSheet.create({
  fallback: {
    padding: 24,
    borderRadius: 12,
    backgroundColor: '#fafafa',
    borderWidth: 1,
    borderColor: '#eee',
    alignItems: 'center',
  },
  fallbackText: { color: '#666', fontSize: 14, textAlign: 'center' },
});
