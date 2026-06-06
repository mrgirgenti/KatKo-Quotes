export type CrmStatus = 'Cold' | 'Working' | 'Active Client' | 'Past Client';

export type ContactRole =
  | 'Primary Contact'
  | 'Decision Maker'
  | 'Coordinator'
  | 'Billing Contact'
  | 'Other';

export type ActivityType =
  // Manual CRM log entries
  | 'call' | 'email' | 'note' | 'meeting' | 'text'
  // Client portal events
  | 'client_intake' | 'client_cancel'
  // Quote lifecycle
  | 'quote_created' | 'quote_sent' | 'quote_approved'
  // Financial
  | 'invoice_sent' | 'payment_received'
  // Production
  | 'in_production' | 'completed'
  // Account / access
  | 'hub_enabled' | 'member_added' | 'member_removed'
  | 'hub_invite_sent' | 'hub_user_disabled' | 'hub_user_enabled'
  // Contact changes
  | 'contact_added' | 'contact_updated';

export type CampaignStepType = 'call' | 'email' | 'text' | 'other';
export type CampaignStepStatus = 'pending' | 'sent' | 'received' | 'responded' | 'skipped';

export interface ActivityEntry {
  id: string;
  type: ActivityType;
  date: string;
  subject?: string;
  body: string;
  contactId?: string;
  contactName?: string;
  createdAt: string;
}

export interface CampaignStep {
  id: string;
  stepNumber: number;
  type: CampaignStepType;
  label: string;
  scheduledDate?: string;
  completedDate?: string;
  status: CampaignStepStatus;
  notes?: string;
}

export interface CampaignAssignment {
  id: string;
  templateId?: string;
  templateName: string;
  startedDate: string;
  steps: CampaignStep[];
}

export interface Department {
  id: string;
  name: string;
  description?: string;
}

export interface Contact {
  id: string;
  organizationId?: string;
  departmentId?: string;
  firstName: string;
  lastName: string;
  role?: ContactRole;
  email?: string;
  phone?: string;
  notes?: string;
  isPrimary?: boolean;
  linkedUserId?: string;
  createdAt: string;
}

export type MembershipRole = 'ORG_ADMIN' | 'MEMBER' | 'BILLING_CONTACT' | 'APPROVER';

export interface OrgMembership {
  id: string;
  organizationId: string;
  userId: string;
  role: MembershipRole;
  isPrimaryContact: boolean;
  canManageUsers: boolean;
  canSubmitProjects: boolean;
  canViewProjects: boolean;
  canViewInvoices: boolean;
  canPayInvoices: boolean;
  canApproveQuotes: boolean;
  createdAt: string;
  inviteSentAt?: string | null;
  userName?: string;
  userEmail?: string;
  userAvatarColor?: string;
  userType?: 'INTERNAL' | 'CLIENT';
  userStatus?: 'INVITED' | 'ACTIVE' | 'DISABLED';
  hasPassword?: boolean;
}

export interface Organization {
  id: string;
  name: string;
  type?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  website?: string;
  status: CrmStatus;
  notes?: string;
  hubEnabled?: boolean;
  logoUrl?: string;
  internalLogoUrl?: string;
  departments: Department[];
  contacts: Contact[];
  activityLog: ActivityEntry[];
  campaigns: CampaignAssignment[];
  createdAt: string;
  convertedToActiveDate?: string;
}

export interface CampaignTemplate {
  id: string;
  name: string;
  description?: string;
  steps: {
    stepNumber: number;
    type: CampaignStepType;
    label: string;
    dayOffset?: number;
  }[];
  createdAt: string;
}

export const CRM_STATUS_CONFIG: Record<CrmStatus, { label: string; color: string; bg: string; border: string; dot: string }> = {
  'Cold':         { label: 'Cold',         color: '#6B7280', bg: '#F3F4F6', border: '#D1D5DB', dot: '#9CA3AF' },
  'Working':      { label: 'Working',      color: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE', dot: '#3B82F6' },
  'Active Client':{ label: 'Active Client',color: '#FFFFFF', bg: '#FF5A00', border: '#FF5A00', dot: '#FF5A00' },
  'Past Client':  { label: 'Past Client',  color: '#374151', bg: '#E5E7EB', border: '#9CA3AF', dot: '#6B7280' },
};

export const ORG_TYPES = [
  'Business',
  'Church / Ministry',
  'Government',
  'Individual',
  'Nonprofit',
  'Other',
  'School / University',
  'Sports Team',
] as const;

export const CONTACT_ROLES: ContactRole[] = [
  'Primary Contact',
  'Decision Maker',
  'Coordinator',
  'Billing Contact',
  'Other',
];

export const ACTIVITY_TYPE_CONFIG: Record<ActivityType, { label: string; color: string; icon: string; isSystem?: boolean }> = {
  // Manual CRM entries
  call:            { label: 'Call',             color: '#16A34A', icon: 'phone-call' },
  email:           { label: 'Email',            color: '#2563EB', icon: 'mail' },
  note:            { label: 'Note',             color: '#92400E', icon: 'file-text' },
  meeting:         { label: 'Meeting',          color: '#7C3AED', icon: 'users' },
  text:            { label: 'Text',             color: '#0891B2', icon: 'message-square' },
  // Client portal events
  client_intake:   { label: 'Client Submitted', color: '#FF5A00', icon: 'inbox',         isSystem: true },
  client_cancel:   { label: 'Client Cancelled', color: '#DC2626', icon: 'x-circle',      isSystem: true },
  // Quote lifecycle
  quote_created:   { label: 'Quote Created',    color: '#2563EB', icon: 'file-text',     isSystem: true },
  quote_sent:      { label: 'Quote Sent',       color: '#7C3AED', icon: 'send',          isSystem: true },
  quote_approved:  { label: 'Quote Approved',   color: '#16A34A', icon: 'check-circle',  isSystem: true },
  // Financial
  invoice_sent:    { label: 'Invoice Sent',     color: '#9333EA', icon: 'file-text',     isSystem: true },
  payment_received:{ label: 'Payment Received', color: '#16A34A', icon: 'dollar-sign',   isSystem: true },
  // Production
  in_production:   { label: 'In Production',    color: '#FF5A00', icon: 'package',       isSystem: true },
  completed:       { label: 'Completed',        color: '#16A34A', icon: 'check-circle',  isSystem: true },
  // Account / access
  hub_enabled:        { label: 'Hub Enabled',        color: '#0891B2', icon: 'shield',     isSystem: true },
  member_added:       { label: 'Member Added',       color: '#4B5563', icon: 'user',       isSystem: true },
  member_removed:     { label: 'Member Removed',     color: '#9CA3AF', icon: 'user',       isSystem: true },
  hub_invite_sent:    { label: 'Hub Invite Sent',    color: '#6366F1', icon: 'mail',       isSystem: true },
  hub_user_disabled:  { label: 'Hub User Disabled',  color: '#DC2626', icon: 'user',       isSystem: true },
  hub_user_enabled:   { label: 'Hub User Enabled',   color: '#16A34A', icon: 'user',       isSystem: true },
  // Contact changes
  contact_added:   { label: 'Contact Added',    color: '#2563EB', icon: 'user',          isSystem: true },
  contact_updated: { label: 'Contact Updated',  color: '#6B7280', icon: 'user',          isSystem: true },
};
