import React from 'react';
import { CreditCard } from 'lucide-react-native';
import { PlaceholderPage } from '@/components/PlaceholderPage';

export default function PaymentsScreen() {
  return (
    <PlaceholderPage
      title="Payments"
      Icon={CreditCard}
      primaryActionLabel="Record Payment"
      metrics={[
        { label: 'Collected' },
        { label: 'Pending' },
        { label: 'This Month' },
        { label: 'Avg. Days to Pay' },
      ]}
      searchPlaceholder="Search payments…"
      emptyTitle="Payment tracking coming next"
      emptyMessage="Operational visibility into payments as they come in — not accounting. See what's been collected and what's still outstanding at a glance."
    />
  );
}
