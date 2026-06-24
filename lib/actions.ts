import { pool } from '@/lib/pool';

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

export const ACTION_DEFAULT_PRIORITY: Record<ActionType, ActionPriority> = {
  NEW_QUOTE_SUBMISSION: 'HIGH',
  QUOTE_MISSING_INFORMATION: 'NORMAL',
  QUOTE_RETURNED_FOR_REVISION: 'HIGH',
  QUOTE_REVISION_REQUEST: 'HIGH',
  ARTWORK_UPLOADED: 'NORMAL',
  CUSTOMER_COMMENT: 'NORMAL',
  MISSING_ARTWORK: 'HIGH',
  MOCKUP_APPROVAL_REQUIRED: 'NORMAL',
  PRODUCTION_ISSUE_REPORTED: 'CRITICAL',
  QUOTE_DELIVERY_FAILED: 'HIGH',
  INVOICE_DELIVERY_FAILED: 'HIGH',
  EMAIL_BOUNCE: 'NORMAL',
  PAYMENT_LINK_FAILED: 'HIGH',
  PDF_GENERATION_FAILED: 'NORMAL',
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

export async function createAction(params: {
  type: ActionType;
  title: string;
  description?: string | null;
  organizationId?: string | null;
  projectId?: string | null;
  priority?: ActionPriority;
  metadata?: Record<string, any>;
}): Promise<void> {
  try {
    const priority = params.priority ?? ACTION_DEFAULT_PRIORITY[params.type];
    await pool.query(
      `INSERT INTO "ActionItem" (
        id, type, priority, status, "organizationId", "projectId",
        title, description, metadata, "createdAt"
      ) VALUES (
        gen_random_uuid()::text, $1, $2, 'NEW', $3, $4, $5, $6, $7::jsonb, NOW()
      )`,
      [
        params.type,
        priority,
        params.organizationId ?? null,
        params.projectId ?? null,
        params.title,
        params.description ?? null,
        params.metadata ? JSON.stringify(params.metadata) : null,
      ]
    );
  } catch (err) {
    console.error('[createAction] Failed to create action:', err);
  }
}
