import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { Client } from '@/types/client';
import { generateId } from '@/utils/quoteCalculations';

const CLIENTS_STORAGE_KEY = 'printshop_clients';

async function loadClients(): Promise<Client[]> {
  try {
    const stored = await AsyncStorage.getItem(CLIENTS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

async function saveClients(clients: Client[]): Promise<Client[]> {
  try {
    await AsyncStorage.setItem(CLIENTS_STORAGE_KEY, JSON.stringify(clients));
    return clients;
  } catch (error) {
    throw error;
  }
}

export const [ClientsProvider, useClients] = createContextHook(() => {
  const queryClient = useQueryClient();

  const clientsQuery = useQuery({
    queryKey: ['clients'],
    queryFn: loadClients,
  });

  const addClientMutation = useMutation({
    mutationFn: async (newClient: Omit<Client, 'id' | 'createdAt'>) => {
      const current = clientsQuery.data || [];
      const client: Client = {
        ...newClient,
        id: generateId(),
        createdAt: new Date().toISOString(),
      };
      return saveClients([client, ...current]);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['clients'], data);
    },
  });

  const updateClientMutation = useMutation({
    mutationFn: async (updatedClient: Client) => {
      const current = clientsQuery.data || [];
      const updated = current.map((c) => (c.id === updatedClient.id ? updatedClient : c));
      return saveClients(updated);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['clients'], data);
    },
  });

  const deleteClientMutation = useMutation({
    mutationFn: async (clientId: string) => {
      const current = clientsQuery.data || [];
      return saveClients(current.filter((c) => c.id !== clientId));
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['clients'], data);
    },
  });

  return {
    clients: clientsQuery.data || [],
    isLoading: clientsQuery.isLoading,
    addClient: addClientMutation.mutate,
    updateClient: updateClientMutation.mutate,
    deleteClient: deleteClientMutation.mutate,
    isAdding: addClientMutation.isPending,
  };
});
