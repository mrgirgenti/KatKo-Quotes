import type { Quote, OperationalProjectStatus, ProjectPriority, ServiceStyle, DeliveryMethod } from '@/types/quote';
import { PRIORITY_RANK, DEFAULT_PRIORITY } from '@/types/quote';

// ---------------------------------------------------------------------------
// Board model: the 10 operational statuses are bucketed into 4 board columns.
// Moving a card to a column writes the column's canonical operational status.
// ---------------------------------------------------------------------------

export type BoardColumnKey = 'Ready for Production' | 'In Production' | 'On Hold' | 'Completed';

export interface BoardColumnDef {
  key: BoardColumnKey;
  title: string;
  /** Operational statuses that fall into this column. */
  statuses: OperationalProjectStatus[];
  /** Status applied when a card is dropped into this column. */
  canonicalStatus: OperationalProjectStatus;
  accent: string;
}

export const BOARD_COLUMNS: BoardColumnDef[] = [
  {
    key: 'Ready for Production',
    title: 'Ready for Production',
    statuses: ['Accepted', 'Awaiting Artwork', 'Artwork Approval', 'Awaiting Payment', 'Ready for Production'],
    canonicalStatus: 'Ready for Production',
    accent: '#2563EB',
  },
  {
    key: 'In Production',
    title: 'In Production',
    statuses: ['In Production'],
    canonicalStatus: 'In Production',
    accent: '#FF5A00',
  },
  {
    key: 'On Hold',
    title: 'On Hold',
    statuses: ['On Hold'],
    canonicalStatus: 'On Hold',
    accent: '#DC2626',
  },
  {
    key: 'Completed',
    title: 'Completed',
    statuses: ['Completed', 'Delivered', 'Closed'],
    canonicalStatus: 'Completed',
    accent: '#16A34A',
  },
];

const STATUS_TO_COLUMN: Record<string, BoardColumnKey> = BOARD_COLUMNS.reduce((acc, col) => {
  col.statuses.forEach((s) => { acc[s] = col.key; });
  return acc;
}, {} as Record<string, BoardColumnKey>);

export function columnForStatus(status: string | null | undefined): BoardColumnKey | null {
  if (!status) return null;
  return STATUS_TO_COLUMN[status] ?? null;
}

// ---------------------------------------------------------------------------
// Priority helpers
// ---------------------------------------------------------------------------

export function priorityOf(q: Quote): ProjectPriority {
  return (q.priority as ProjectPriority) || DEFAULT_PRIORITY;
}

/** Rush is a paid service level, tracked separately from priority. */
export function isRush(q: Quote): boolean {
  return q.rush === true;
}

// ---------------------------------------------------------------------------
// Service type — a project can have line items of different service styles.
// ---------------------------------------------------------------------------

export function serviceTypesOf(q: Quote): ServiceStyle[] {
  const set = new Set<ServiceStyle>();
  (q.lineItems || []).forEach((li) => { if (li.serviceStyle) set.add(li.serviceStyle); });
  return Array.from(set);
}

export function serviceTypeLabel(q: Quote): string {
  const types = serviceTypesOf(q);
  if (types.length === 0) return '—';
  if (types.length === 1) return types[0];
  return `${types[0]} +${types.length - 1}`;
}

// ---------------------------------------------------------------------------
// Date parsing — orders store human dates like "Jun 16, 2026" or ISO strings.
// ---------------------------------------------------------------------------

export function parseProjectDate(str: string | null | undefined): Date | null {
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

/** Short "Jun 12" (month + day, no year) for compact board cards. */
export function formatMonthDay(str: string | null | undefined): string {
  const d = parseProjectDate(str);
  if (!d) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ---------------------------------------------------------------------------
// Filtering + sorting shared by Board and Queue
// ---------------------------------------------------------------------------

export type DueRangePreset = 'all' | 'overdue' | 'today' | 'week' | 'month';

export const DUE_RANGE_OPTIONS: { key: DueRangePreset; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'today', label: 'Due Today' },
  { key: 'week', label: 'Next 7 Days' },
  { key: 'month', label: 'Next 30 Days' },
];

export interface ProductionFilters {
  search: string;
  status: 'all' | OperationalProjectStatus;
  priority: 'all' | ProjectPriority;
  assignee: 'all' | 'unassigned' | string; // user id
  serviceType: 'all' | ServiceStyle;
  delivery: 'all' | DeliveryMethod;
  due: DueRangePreset;
  rush: boolean; // true = rush orders only
}

export const EMPTY_FILTERS: ProductionFilters = {
  search: '',
  status: 'all',
  priority: 'all',
  assignee: 'all',
  serviceType: 'all',
  delivery: 'all',
  due: 'all',
  rush: false,
};

function matchesDueRange(q: Quote, preset: DueRangePreset): boolean {
  if (preset === 'all') return true;
  const d = parseProjectDate(q.inHandsDate);
  if (!d) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(d);
  due.setHours(0, 0, 0, 0);
  const dayMs = 86400000;
  const diffDays = Math.round((due.getTime() - today.getTime()) / dayMs);
  switch (preset) {
    case 'overdue': return diffDays < 0;
    case 'today': return diffDays === 0;
    case 'week': return diffDays >= 0 && diffDays <= 7;
    case 'month': return diffDays >= 0 && diffDays <= 30;
    default: return true;
  }
}

export function filterProjects(projects: Quote[], filters: ProductionFilters): Quote[] {
  let list = projects;

  if (filters.status !== 'all') {
    list = list.filter((q) => q.operationalStatus === filters.status);
  }
  if (filters.priority !== 'all') {
    list = list.filter((q) => priorityOf(q) === filters.priority);
  }
  if (filters.assignee !== 'all') {
    if (filters.assignee === 'unassigned') {
      list = list.filter((q) => !q.assignedToUserId);
    } else {
      list = list.filter((q) => q.assignedToUserId === filters.assignee);
    }
  }
  if (filters.serviceType !== 'all') {
    list = list.filter((q) => serviceTypesOf(q).includes(filters.serviceType as ServiceStyle));
  }
  if (filters.delivery !== 'all') {
    list = list.filter((q) => q.deliveryMethod === filters.delivery);
  }
  if (filters.due !== 'all') {
    list = list.filter((q) => matchesDueRange(q, filters.due));
  }
  if (filters.rush) {
    list = list.filter((q) => isRush(q));
  }
  if (filters.search.trim()) {
    const term = filters.search.toLowerCase();
    list = list.filter((q) =>
      (q.personOrganization || '').toLowerCase().includes(term) ||
      (q.projectName || '').toLowerCase().includes(term) ||
      (q.projectNumber || '').toLowerCase().includes(term) ||
      (q.invoiceNumber || '').toLowerCase().includes(term),
    );
  }
  return list;
}

export type SortField = 'priority' | 'dueDate' | 'orderDate' | 'client' | 'project' | 'status';
export type SortDir = 'asc' | 'desc';

export function sortProjects(projects: Quote[], field: SortField, dir: SortDir): Quote[] {
  const sign = dir === 'asc' ? 1 : -1;
  const copy = [...projects];
  copy.sort((a, b) => {
    let cmp = 0;
    switch (field) {
      case 'priority':
        cmp = PRIORITY_RANK[priorityOf(a)] - PRIORITY_RANK[priorityOf(b)];
        break;
      case 'dueDate': {
        const da = parseProjectDate(a.inHandsDate)?.getTime() ?? Infinity;
        const db = parseProjectDate(b.inHandsDate)?.getTime() ?? Infinity;
        cmp = da - db;
        break;
      }
      case 'orderDate': {
        const da = parseProjectDate(a.orderDate)?.getTime() ?? Infinity;
        const db = parseProjectDate(b.orderDate)?.getTime() ?? Infinity;
        cmp = da - db;
        break;
      }
      case 'client':
        cmp = (a.personOrganization || '').localeCompare(b.personOrganization || '');
        break;
      case 'project':
        cmp = (a.projectName || '').localeCompare(b.projectName || '');
        break;
      case 'status':
        cmp = (a.operationalStatus || '').localeCompare(b.operationalStatus || '');
        break;
    }
    // Stable tie-break: priority, then nearest due date.
    if (cmp === 0) {
      cmp = PRIORITY_RANK[priorityOf(a)] - PRIORITY_RANK[priorityOf(b)];
    }
    if (cmp === 0) {
      const da = parseProjectDate(a.inHandsDate)?.getTime() ?? Infinity;
      const db = parseProjectDate(b.inHandsDate)?.getTime() ?? Infinity;
      cmp = da - db;
    }
    return cmp * sign;
  });
  return copy;
}

/**
 * Default board ordering within a column: rush projects first (paid service
 * level), then priority, then nearest due date.
 */
export function sortForBoard(projects: Quote[]): Quote[] {
  const copy = [...projects];
  copy.sort((a, b) => {
    const rushA = isRush(a) ? 0 : 1;
    const rushB = isRush(b) ? 0 : 1;
    if (rushA !== rushB) return rushA - rushB;
    const pri = PRIORITY_RANK[priorityOf(a)] - PRIORITY_RANK[priorityOf(b)];
    if (pri !== 0) return pri;
    const da = parseProjectDate(a.inHandsDate)?.getTime() ?? Infinity;
    const db = parseProjectDate(b.inHandsDate)?.getTime() ?? Infinity;
    return da - db;
  });
  return copy;
}

// ---------------------------------------------------------------------------
// Built-in saved views — operational presets always available in the dropdown.
// "My Projects" resolves the assignee to the current user at build time.
// ---------------------------------------------------------------------------

export interface BuiltInView {
  id: string;
  name: string;
  builtIn: true;
  view: 'board' | 'queue';
  filters: ProductionFilters;
  sortField: SortField;
  sortDir: SortDir;
}

function viewFilters(patch: Partial<ProductionFilters>): ProductionFilters {
  return { ...EMPTY_FILTERS, ...patch };
}

export function buildDefaultViews(currentUserId: string | null): BuiltInView[] {
  const base = (id: string, name: string, filters: ProductionFilters, view: 'board' | 'queue' = 'board'): BuiltInView => ({
    id: `builtin_${id}`,
    name,
    builtIn: true,
    view,
    filters,
    sortField: 'priority',
    sortDir: 'asc',
  });
  return [
    base('all', 'All Production', viewFilters({})),
    base('mine', 'My Projects', viewFilters({ assignee: currentUserId || 'unassigned' })),
    base('rush', 'Rush Orders', viewFilters({ rush: true })),
    base('due_week', 'Due This Week', viewFilters({ due: 'week' })),
    base('in_production', 'In Production', viewFilters({ status: 'In Production' })),
    base('on_hold', 'On Hold', viewFilters({ status: 'On Hold' })),
    base('embroidery', 'Embroidery Queue', viewFilters({ serviceType: 'Embroidery' }), 'queue'),
    base('dtf', 'DTF Queue', viewFilters({ serviceType: 'DTF Transfers' }), 'queue'),
  ];
}

export function totalPieces(q: Quote): number {
  return (q.lineItems || []).reduce((sum, item) => {
    const sizes = item.sizes || {};
    return sum + Object.values(sizes).reduce((s: number, v: any) => s + (Number(v) || 0), 0);
  }, 0);
}
