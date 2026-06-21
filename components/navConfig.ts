import {
  LayoutDashboard,
  Building2,
  Users,
  FileText,
  FolderKanban,
  Factory,
  Receipt,
  CreditCard,
  Globe,
  Store,
  ListTodo,
  BarChart3,
  BookOpen,
  Settings,
  Package,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

export interface NavItem {
  label: string;
  icon: LucideIcon;
  href: string;
  disabled?: boolean;
  soon?: boolean;
}

export interface NavGroup {
  collapsible?: boolean;
  drawerLabel?: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    items: [{ label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' }],
  },
  {
    items: [
      { label: 'Organizations', icon: Building2, href: '/clients' },
      { label: 'Contacts', icon: Users, href: '/clients?view=contacts' },
    ],
  },
  {
    items: [
      { label: 'Quotes', icon: FileText, href: '/sales' },
      { label: 'Projects', icon: FolderKanban, href: '/projects' },
      { label: 'Production', icon: Factory, href: '/production' },
    ],
  },
  {
    items: [
      { label: 'Invoices', icon: Receipt, href: '/invoices' },
      { label: 'Payments', icon: CreditCard, href: '/payments' },
    ],
  },
  {
    items: [
      { label: 'Client Hubs', icon: Globe, href: '/client-hubs' },
      { label: 'Web Stores', icon: Store, href: '#', disabled: true, soon: true },
    ],
  },
  {
    collapsible: true,
    drawerLabel: 'System',
    items: [
      { label: 'Tasks', icon: ListTodo, href: '/tasks' },
      { label: 'Reports', icon: BarChart3, href: '/reports' },
      { label: 'Catalogs', icon: BookOpen, href: '/catalogs' },
      { label: 'Products', icon: Package, href: '/catalog-admin' },
      { label: 'Settings', icon: Settings, href: '/settings' },
    ],
  },
];

export const SYSTEM_HREFS = ['/tasks', '/reports', '/catalogs', '/catalog-admin', '/settings'];

export function baseHref(href: string): string {
  return href.split('?')[0];
}

function viewOf(href: string): string | null {
  const q = href.split('?')[1];
  if (!q) return null;
  const m = q.match(/view=([^&]+)/);
  return m ? m[1] : null;
}

/**
 * Determines whether a nav item should be highlighted as active.
 * Handles the /clients split between Organizations (no view) and Contacts (?view=contacts).
 */
export function isItemActive(
  href: string,
  pathname: string,
  currentView: string | null,
): boolean {
  const base = baseHref(href);
  if (base === '#') return false;
  if (base === '/') return pathname === '/' || pathname === '/index';
  if (!pathname.startsWith(base)) return false;
  if (base === '/clients') {
    return (viewOf(href) || null) === (currentView || null);
  }
  return true;
}
