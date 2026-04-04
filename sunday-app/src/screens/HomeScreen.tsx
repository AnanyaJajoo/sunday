import React from "react";
import {
  Pressable,
  StatusBar,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const BACKGROUND = "#121212";

type HomeScreenProps = {
  onBackgroundPress?: () => void;
};

export function HomeScreen({ onBackgroundPress }: HomeScreenProps) {
  const handleBackgroundPress = React.useCallback(() => {
    onBackgroundPress?.();
  }, [onBackgroundPress]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleBackgroundPress} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },
  container: {
    flex: 1,
    backgroundColor: BACKGROUND,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
});
