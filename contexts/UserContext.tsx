import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect } from 'react';
import { UserProfile, DEFAULT_USER, AVATAR_COLORS } from '@/types/user';

const USERS_STORAGE_KEY = 'printshop_users';
const CURRENT_USER_KEY = 'printshop_current_user';

type StoredUser = Omit<UserProfile, 'role'> & {
  role?: 'org_admin' | 'user';
  isAdmin?: boolean;
};

function migrateUsers(stored: StoredUser[]): UserProfile[] {
  const anyHasLegacyAdmin = stored.some((u) => u.isAdmin === true);
  return stored.map((u, index): UserProfile => {
    if (u.role === 'org_admin' || u.role === 'user') {
      return { ...u, role: u.role };
    }
    let role: 'org_admin' | 'user';
    if (u.isAdmin === true) {
      role = 'org_admin';
    } else if (!anyHasLegacyAdmin && index === 0) {
      role = 'org_admin';
    } else {
      role = 'user';
    }
    return { ...u, role };
  });
}

async function loadUsers(): Promise<UserProfile[]> {
  try {
    const stored = await AsyncStorage.getItem(USERS_STORAGE_KEY);
    if (!stored) return [];
    const parsed: StoredUser[] = JSON.parse(stored);
    const migrated = migrateUsers(parsed);
    const needsMigration = parsed.some((u) => !u.role);
    if (needsMigration) {
      await AsyncStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(migrated));
    }
    return migrated;
  } catch (error) {
    console.log('Error loading users:', error);
    return [];
  }
}

async function saveUsers(users: UserProfile[]): Promise<UserProfile[]> {
  try {
    await AsyncStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    return users;
  } catch (error) {
    console.log('Error saving users:', error);
    throw error;
  }
}

async function loadCurrentUserId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(CURRENT_USER_KEY);
  } catch (error) {
    console.log('Error loading current user:', error);
    return null;
  }
}

async function saveCurrentUserId(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(CURRENT_USER_KEY, userId);
  } catch (error) {
    console.log('Error saving current user:', error);
  }
}

function generateUserId(): string {
  return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export const [UserProvider, useUser] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: loadUsers,
  });

  useEffect(() => {
    loadCurrentUserId().then((id) => {
      setCurrentUserId(id);
      setIsInitialized(true);
    });
  }, []);

  useEffect(() => {
    if (isInitialized && usersQuery.data && usersQuery.data.length === 0) {
      const defaultUser: UserProfile = {
        ...DEFAULT_USER,
        id: generateUserId(),
        role: 'org_admin',
        createdAt: new Date().toISOString(),
      };
      addUserMutation.mutate(defaultUser);
      setCurrentUserId(defaultUser.id);
      saveCurrentUserId(defaultUser.id);
    } else if (isInitialized && usersQuery.data && usersQuery.data.length > 0 && !currentUserId) {
      setCurrentUserId(usersQuery.data[0].id);
      saveCurrentUserId(usersQuery.data[0].id);
    }
  }, [isInitialized, usersQuery.data]);

  const currentUser = usersQuery.data?.find((u) => u.id === currentUserId) || null;

  const orgAdmin = usersQuery.data?.find((u) => u.role === 'org_admin') || null;

  const isOrgAdmin = () => currentUser?.role === 'org_admin';

  const addUserMutation = useMutation({
    mutationFn: async (newUser: UserProfile) => {
      const current = usersQuery.data || [];
      const updated = [...current, newUser];
      return saveUsers(updated);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['users'], data);
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async (updatedUser: UserProfile) => {
      const current = usersQuery.data || [];
      const updated = current.map((u) => (u.id === updatedUser.id ? updatedUser : u));
      return saveUsers(updated);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['users'], data);
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const current = usersQuery.data || [];
      const updated = current.filter((u) => u.id !== userId);
      return saveUsers(updated);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['users'], data);
    },
  });

  const switchUser = async (userId: string) => {
    setCurrentUserId(userId);
    await saveCurrentUserId(userId);
  };

  const createUser = async (
    name: string,
    email?: string,
    role: 'org_admin' | 'user' = 'user'
  ) => {
    const newUser: UserProfile = {
      id: generateUserId(),
      name,
      businessName: '',
      email: email || '',
      phone: '',
      avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
      createdAt: new Date().toISOString(),
      role,
    };
    addUserMutation.mutate(newUser);
    return newUser;
  };

  return {
    users: usersQuery.data || [],
    currentUser,
    currentUserId,
    orgAdmin,
    isLoading: usersQuery.isLoading || !isInitialized,
    isOrgAdmin,
    switchUser,
    createUser,
    updateUser: updateUserMutation.mutate,
    deleteUser: deleteUserMutation.mutate,
    isUpdating: updateUserMutation.isPending,
  };
});
