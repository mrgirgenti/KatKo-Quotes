export type ClientStatus = 'Active' | 'Prospect' | 'Inactive';

export interface Client {
  id: string;
  name: string;
  organization?: string;
  email?: string;
  phone?: string;
  status: ClientStatus;
  notes?: string;
  createdAt: string;
  lastOrderDate?: string;
  totalOrders: number;
  totalSpent: number;
}
