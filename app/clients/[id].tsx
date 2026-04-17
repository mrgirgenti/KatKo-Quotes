import { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function LegacyClientRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/(tabs)/clients' as any);
  }, []);
  return null;
}
