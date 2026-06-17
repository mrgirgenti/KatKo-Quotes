import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { UserProfile, DEFAULT_USER, AVATAR_COLORS } from '@/types/user';
import { getClerkToken } from '@/lib/clerkToken';

// Fetch the verified DB user for the current Clerk session. This is the bridge
// that makes the client's identity/role reflect the real authenticated account
// (the DB remains the source of truth for roles).
async function loadClerkDbUser(): Promise<UserProfile | null> {
  const token = await getClerkToken();
  if (!token) return null;
  try {
    const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const u = await res.json();
    return {
      id: u.id,
      name: u.name || u.email || 'User',
      businessName: '',
      email: u.email || '',
      phone: '',
      avatarColor: AVATAR_COLORS[0],
      createdAt: new Date().toISOString(),
      role: u.role === 'org_admin' ? 'org_admin' : 'user',
    };
  } catch {
    return null;
  }
}

async function syncUserToDB(user: UserProfile): Promise<void> {
  try {
    const token = await getClerkToken();
    await fetch('/api/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(user),
    });
  } catch {
    // fire-and-forget — never block the UI
  }
}

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
  const { isSignedIn } = useAuth();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const syncedCountRef = useRef(0);

  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: loadUsers,
  });

  // Bridge: when signed in with Clerk, the verified DB user (with its DB-backed
  // role) is the authoritative identity for the client UI. The DB remains the
  // source of truth for roles — this just reflects it client-side.
  const clerkUserQuery = useQuery({
    queryKey: ['clerk-db-user', !!isSignedIn],
    queryFn: loadClerkDbUser,
    enabled: !!isSignedIn,
    staleTime: 5 * 60 * 1000,
  });
  const clerkUser = clerkUserQuery.data ?? null;

  useEffect(() => {
    loadCurrentUserId().then((id) => {
      setCurrentUserId(id);
      setIsInitialized(true);
    });
  }, []);

  // Sync all users to PostgreSQL on boot (fire-and-forget, keeps DB FK-ready)
  useEffect(() => {
    if (!isInitialized || !usersQuery.data?.length) return;
    const currentCount = usersQuery.data.length;
    if (syncedCountRef.current === currentCount) return;
    syncedCountRef.current = currentCount;
    Promise.all(usersQuery.data.map(syncUserToDB));
  }, [isInitialized, usersQuery.data?.length]);

  useEffect(() => {
    // When authenticated via Clerk, the verified DB user drives identity — never
    // synthesize a local org_admin (that would be an unauthenticated phantom).
    if (isSignedIn) return;
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
  }, [isInitialized, usersQuery.data, isSignedIn]);

  const localCurrentUser = usersQuery.data?.find((u) => u.id === currentUserId) || null;
  // Clerk identity (when present) wins over the legacy local AsyncStorage user.
  const currentUser = clerkUser ?? localCurrentUser;
  const effectiveCurrentUserId = clerkUser?.id ?? currentUserId;

  const baseUsers = usersQuery.data || [];
  const users =
    clerkUser && !baseUsers.some((u) => u.id === clerkUser.id)
      ? [clerkUser, ...baseUsers]
      : baseUsers;

  const orgAdmin = users.find((u) => u.role === 'org_admin') || null;

  const isOrgAdmin = () => currentUser?.role === 'org_admin';

  const addUserMutation = useMutation({
    mutationFn: async (newUser: UserProfile) => {
      const current = usersQuery.data || [];
      const updated = [...current, newUser];
      syncUserToDB(newUser);
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
      syncUserToDB(updatedUser);
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
    users,
    currentUser,
    currentUserId: effectiveCurrentUserId,
    orgAdmin,
    isLoading: usersQuery.isLoading || !isInitialized || (!!isSignedIn && clerkUserQuery.isLoading),
    isOrgAdmin,
    switchUser,
    createUser,
    updateUser: updateUserMutation.mutate,
    deleteUser: deleteUserMutation.mutate,
    isUpdating: updateUserMutation.isPending,
  };
});
