import { Stack } from 'expo-router';

export default function GameLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="lobby" />
      <Stack.Screen name="game" />
      <Stack.Screen name="results" />
    </Stack>
  );
}