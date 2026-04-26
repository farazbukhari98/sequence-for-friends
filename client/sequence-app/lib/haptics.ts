import * as Haptics from 'expo-haptics';

const isTestRuntime = (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env?.NODE_ENV === 'test';

function runHaptic(effect: () => Promise<void>) {
  if (isTestRuntime) return;
  void effect().catch(() => undefined);
}

export function hapticSelection() {
  runHaptic(() => Haptics.selectionAsync());
}

export function hapticLight() {
  runHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

export function hapticSuccess() {
  runHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

export function hapticWarning() {
  runHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}
