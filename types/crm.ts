export type CrmStatus = 'Cold' | 'Working' | 'Active Client' | 'Past Client';

export type ContactRole =
  | 'Primary Contact'
  | 'Decision Maker'
  | 'Coordinator'
  | 'Billing Contact'
  | 'Other';

export type ActivityType = 'call' | 'email' | 'note' | 'meeting' | 'text';

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
  userName?: string;
  userEmail?: string;
  userAvatarColor?: string;
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
  'Church / Ministry',
  'School / University',
  'Nonprofit',
  'Sports Team',
  'Business',
  'Government',
  'Individual',
  'Other',
] as const;

export const CONTACT_ROLES: ContactRole[] = [
  'Primary Contact',
  'Decision Maker',
  'Coordinator',
  'Billing Contact',
  'Other',
];

export const ACTIVITY_TYPE_CONFIG: Record<ActivityType, { label: string; color: string; icon: string }> = {
  call:    { label: 'Call',    color: '#16A34A', icon: 'phone' },
  email:   { label: 'Email',   color: '#2563EB', icon: 'mail' },
  note:    { label: 'Note',    color: '#92400E', icon: 'file-text' },
  meeting: { label: 'Meeting', color: '#7C3AED', icon: 'users' },
  text:    { label: 'Text',    color: '#0891B2', icon: 'message-square' },
};
