import { Stack } from 'expo-router';

export default function MainLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="home" />
      <Stack.Screen name="create-room" />
      <Stack.Screen name="join-room" />
      <Stack.Screen name="solo-practice" />
      <Stack.Screen name="friends" />
      <Stack.Screen name="friend-profile" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="game-history" />
      <Stack.Screen name="detailed-stats" />
    </Stack>
  );
}