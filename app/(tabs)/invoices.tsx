import React from 'react';
import { Receipt } from 'lucide-react-native';
import { PlaceholderPage } from '@/components/PlaceholderPage';

export default function InvoicesScreen() {
  return (
    <PlaceholderPage
      title="Invoices"
      Icon={Receipt}
      primaryActionLabel="Sync with Wave"
      metrics={[
        { label: 'Outstanding' },
        { label: 'Paid' },
        { label: 'Overdue' },
        { label: 'Total' },
      ]}
      searchPlaceholder="Search invoices…"
      emptyTitle="Wave invoice integration coming next"
      emptyMessage="Wave remains your source of truth for invoicing. This page will surface Wave invoice status — sent, viewed, paid and overdue — without replacing your accounting."
    />
  );
}
