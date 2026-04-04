import { useEffect } from "react";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { registerPushToken } from "../api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export function usePushNotifications() {
  useEffect(() => {
    if (Constants.appOwnership === "expo") {
      return;
    }

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
