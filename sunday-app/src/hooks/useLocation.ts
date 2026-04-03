import { useEffect } from "react";
import * as Location from "expo-location";
import { postLocation } from "../api";

export function useLocation() {
  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 50, // only update after moving 50 metres
        },
        async (loc) => {
          try {
            await postLocation(
              loc.coords.latitude,
              loc.coords.longitude,
              loc.coords.accuracy
            );
          } catch {
            // Non-fatal — never block UI on location failure
          }
        }
      );
    })();

    return () => {
      subscription?.remove();
    };
  }, []);
}
