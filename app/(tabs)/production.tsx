import React from 'react';
import { Factory } from 'lucide-react-native';
import { PlaceholderPage } from '@/components/PlaceholderPage';

export default function ProductionScreen() {
  return (
    <PlaceholderPage
      title="Production"
      Icon={Factory}
      primaryActionLabel="New Run"
      metrics={[
        { label: 'In Queue' },
        { label: 'In Production' },
        { label: 'Ready' },
        { label: 'Completed' },
      ]}
      searchPlaceholder="Search production jobs…"
      emptyTitle="Production workflow coming next"
      emptyMessage="Track jobs through your print production stages — screen printing, embroidery, fulfillment and more — all in one operational queue."
    />
  );
}
