import { Platform, ToastAndroid } from 'react-native';

export function toast(message: string): void {
  if (Platform.OS === 'android') ToastAndroid.show(message, ToastAndroid.SHORT);
}
