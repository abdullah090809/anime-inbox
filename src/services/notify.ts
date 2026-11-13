import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

let ready = false;

export function initNotifications(): void {
  if (ready) return;
  ready = true;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () =>
        ({
          shouldShowAlert: true,
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: false,
          shouldSetBadge: false,
        }) as any,
    });
  } catch {
    // notifications are optional
  }
}

async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync('inbox', {
      name: 'Ready to review',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  } catch {
    // ignore
  }
}

// Called when the person turns the setting on - the screen explains why first.
export async function requestNotifyPermission(): Promise<boolean> {
  try {
    await ensureChannel();
    const cur = await Notifications.getPermissionsAsync();
    if (cur.granted) return true;
    const asked = await Notifications.requestPermissionsAsync();
    return !!asked.granted;
  } catch {
    return false;
  }
}

export async function notifyReady(count: number): Promise<void> {
  try {
    const cur = await Notifications.getPermissionsAsync();
    if (!cur.granted) return;
    await ensureChannel();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Anime Inbox',
        body: count === 1 ? '1 screenshot is ready to review' : count + ' screenshots are ready to review',
      },
      trigger: Platform.OS === 'android' ? ({ channelId: 'inbox' } as any) : null,
    });
  } catch {
    // never let a notification problem break processing
  }
}
