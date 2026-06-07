import React from 'react';
import { ListTodo } from 'lucide-react-native';
import { PlaceholderPage } from '@/components/PlaceholderPage';

export default function TasksScreen() {
  return (
    <PlaceholderPage
      title="Tasks"
      Icon={ListTodo}
      primaryActionLabel="New Task"
      metrics={[
        { label: 'Open' },
        { label: 'In Progress' },
        { label: 'Due Today' },
        { label: 'Done' },
      ]}
      searchPlaceholder="Search tasks…"
      emptyTitle="Task management coming next"
      emptyMessage="Assign, prioritize, and track internal tasks across your team so nothing falls through the cracks."
    />
  );
}
