import React from 'react';
import { Settings as SettingsIcon } from 'lucide-react-native';
import { PlaceholderPage } from '@/components/PlaceholderPage';

export default function SettingsScreen() {
  return (
    <PlaceholderPage
      title="Settings"
      Icon={SettingsIcon}
      searchPlaceholder="Search settings…"
      emptyTitle="Settings coming next"
      emptyMessage="Manage workspace preferences, team access, integrations, and branding for Katalyst Ko here."
    />
  );
}
