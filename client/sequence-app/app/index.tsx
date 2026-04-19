import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '@/stores/authStore';
import { colors } from '@/theme';

export default function Index() {
  const { user, sessionToken, isLoading, needsUsername } = useAuthStore();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!sessionToken || !user) {
    return <Redirect href="/(auth)/login" />;
  }

  if (needsUsername) {
    return <Redirect href="/(auth)/onboarding" />;
  }

  return <Redirect href="/(main)/home" />;
}