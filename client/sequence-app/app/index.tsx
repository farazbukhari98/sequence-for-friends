import { Redirect } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { AuthLoadingScreen, getEntryRedirectPath } from '@/lib/authRouting';
import { useShallow } from 'zustand/react/shallow';

export default function Index() {
  const authState = useAuthStore(useShallow((state) => ({
    user: state.user,
    sessionToken: state.sessionToken,
    isLoading: state.isLoading,
    needsUsername: state.needsUsername,
    tempToken: state.tempToken,
  })));
  const redirectPath = getEntryRedirectPath(authState);

  if (!redirectPath) {
    return <AuthLoadingScreen />;
  }

  return <Redirect href={redirectPath} />;
}
