export interface UserProfile {
  id: string;
  name: string;
  businessName: string;
  email: string;
  phone: string;
  avatarColor: string;
  createdAt: string;
  role: 'org_admin' | 'user';
  isAdmin?: boolean;
  adminPassword?: string;
  adminPasswordLocked?: boolean;
  googleSheetsUrl?: string;
  profilePicture?: string;
  companyLogo?: string;
  waveAccountingUrl?: string;
  waveApiKey?: string;
  vendorCatalogUrls?: string;
}

export const AVATAR_COLORS = [
  '#FF5A00',
  '#059669',
  '#3B82F6',
  '#8B5CF6',
  '#EC4899',
  '#F59E0B',
  '#EF4444',
  '#06B6D4',
] as const;

export const DEFAULT_USER: UserProfile = {
  id: 'default',
  name: 'User',
  businessName: '',
  email: '',
  phone: '',
  avatarColor: '#FF5A00',
  createdAt: new Date().toISOString(),
  role: 'org_admin',
};
