import { Alert } from 'react-native';

/** Standard destructive confirmation used before structural deletes. */
export function confirmDelete(title: string, message: string, onConfirm: () => void): void {
  Alert.alert(title, message, [
    { text: 'Renunță', style: 'cancel' },
    { text: 'Șterge', style: 'destructive', onPress: onConfirm },
  ]);
}
