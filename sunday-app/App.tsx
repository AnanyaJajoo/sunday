import React, { useCallback } from "react";
import Constants from "expo-constants";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { usePushNotifications } from "./src/hooks/usePushNotifications";

const isExpoGo = Constants.appOwnership === "expo";

if (!isExpoGo) {
  SplashScreen.preventAutoHideAsync().catch(() => {
    // Ignore duplicate/pre-init calls in development.
  });
  SplashScreen.setOptions({
    duration: 250,
    fade: true,
  });
}

function AppContent() {
  usePushNotifications();
  return <HomeScreen />;
}

export default function App() {
  const onLayoutRootView = useCallback(() => {
    if (isExpoGo) {
      return;
    }
    SplashScreen.hideAsync().catch(() => {
      // Ignore hide failures during hot reloads.
    });
  }, []);

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
        <AppContent />
      </View>
    </SafeAreaProvider>
  );
}
