export type ActionType =
  | 'NEW_QUOTE_SUBMISSION'
  | 'QUOTE_MISSING_INFORMATION'
  | 'QUOTE_RETURNED_FOR_REVISION'
  | 'QUOTE_REVISION_REQUEST'
  | 'ARTWORK_UPLOADED'
  | 'CUSTOMER_COMMENT'
  | 'MISSING_ARTWORK'
  | 'MOCKUP_APPROVAL_REQUIRED'
  | 'PRODUCTION_ISSUE_REPORTED'
  | 'QUOTE_DELIVERY_FAILED'
  | 'INVOICE_DELIVERY_FAILED'
  | 'EMAIL_BOUNCE'
  | 'PAYMENT_LINK_FAILED'
  | 'PDF_GENERATION_FAILED';

export type ActionStatus = 'NEW' | 'VIEWED' | 'RESOLVED';
export type ActionPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
export type ActionCategory = 'NEEDS_REVIEW' | 'CUSTOMER_REQUESTS' | 'PRODUCTION_ISSUES' | 'SYSTEM_ALERTS';

export const ACTION_CATEGORY: Record<ActionType, ActionCategory> = {
  NEW_QUOTE_SUBMISSION: 'NEEDS_REVIEW',
  QUOTE_MISSING_INFORMATION: 'NEEDS_REVIEW',
  QUOTE_RETURNED_FOR_REVISION: 'NEEDS_REVIEW',
  QUOTE_REVISION_REQUEST: 'CUSTOMER_REQUESTS',
  ARTWORK_UPLOADED: 'CUSTOMER_REQUESTS',
  CUSTOMER_COMMENT: 'CUSTOMER_REQUESTS',
  MISSING_ARTWORK: 'PRODUCTION_ISSUES',
  MOCKUP_APPROVAL_REQUIRED: 'PRODUCTION_ISSUES',
  PRODUCTION_ISSUE_REPORTED: 'PRODUCTION_ISSUES',
  QUOTE_DELIVERY_FAILED: 'SYSTEM_ALERTS',
  INVOICE_DELIVERY_FAILED: 'SYSTEM_ALERTS',
  EMAIL_BOUNCE: 'SYSTEM_ALERTS',
  PAYMENT_LINK_FAILED: 'SYSTEM_ALERTS',
  PDF_GENERATION_FAILED: 'SYSTEM_ALERTS',
};

export const ACTION_TYPE_LABEL: Record<ActionType, string> = {
  NEW_QUOTE_SUBMISSION: 'New Quote Submission',
  QUOTE_MISSING_INFORMATION: 'Missing Information',
  QUOTE_RETURNED_FOR_REVISION: 'Returned for Revision',
  QUOTE_REVISION_REQUEST: 'Revision Request',
  ARTWORK_UPLOADED: 'Artwork Uploaded',
  CUSTOMER_COMMENT: 'Customer Comment',
  MISSING_ARTWORK: 'Missing Artwork',
  MOCKUP_APPROVAL_REQUIRED: 'Mockup Approval Required',
  PRODUCTION_ISSUE_REPORTED: 'Production Issue',
  QUOTE_DELIVERY_FAILED: 'Quote Delivery Failed',
  INVOICE_DELIVERY_FAILED: 'Invoice Delivery Failed',
  EMAIL_BOUNCE: 'Email Bounced',
  PAYMENT_LINK_FAILED: 'Payment Link Failed',
  PDF_GENERATION_FAILED: 'PDF Generation Failed',
};

export const ACTION_CATEGORY_LABEL: Record<ActionCategory, string> = {
  NEEDS_REVIEW: 'Needs Review',
  CUSTOMER_REQUESTS: 'Customer Requests',
  PRODUCTION_ISSUES: 'Production Issues',
  SYSTEM_ALERTS: 'System Alerts',
};

export const PRIORITY_CONFIG: Record<ActionPriority, { label: string; color: string; bg: string }> = {
  CRITICAL: { label: 'Critical', color: '#DC2626', bg: '#FEF2F2' },
  HIGH:     { label: 'High',     color: '#EA580C', bg: '#FFF7ED' },
  NORMAL:   { label: 'Normal',   color: '#2563EB', bg: '#EFF6FF' },
  LOW:      { label: 'Low',      color: '#6B7280', bg: '#F3F4F6' },
};

export const CATEGORY_CONFIG: Record<ActionCategory, { color: string; bg: string }> = {
  NEEDS_REVIEW:      { color: '#D97706', bg: '#FFFBEB' },
  CUSTOMER_REQUESTS: { color: '#2563EB', bg: '#EFF6FF' },
  PRODUCTION_ISSUES: { color: '#DC2626', bg: '#FEF2F2' },
  SYSTEM_ALERTS:     { color: '#7C3AED', bg: '#F5F3FF' },
};

export interface ActionItem {
  id: string;
  type: ActionType;
  priority: ActionPriority;
  status: ActionStatus;
  organizationId: string | null;
  projectId: string | null;
  title: string;
  description: string | null;
  metadata: Record<string, any> | null;
  createdAt: string;
  resolvedAt: string | null;
  viewedAt: string | null;
}

export interface ActionItemWithContext extends ActionItem {
  projectTitle?: string | null;
  projectNumber?: string | null;
  organizationName?: string | null;
}
