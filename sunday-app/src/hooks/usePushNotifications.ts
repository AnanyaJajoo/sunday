import { useEffect } from "react";
import * as Notifications from "expo-notifications";
import { registerPushToken } from "../api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export function usePushNotifications() {
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== "granted") return;
        const { data: token } = await Notifications.getExpoPushTokenAsync();
        await registerPushToken(token);
      } catch {
        // Non-fatal — push not supported in Expo Go (SDK 53+), works in dev builds
      }
    })();
  }, []);
}
