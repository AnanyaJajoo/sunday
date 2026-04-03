import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColorScheme } from "react-native";

interface Props {
  message: string;
}

export function ErrorBanner({ message }: Props) {
  const isDark = useColorScheme() === "dark";
  return (
    <View style={[styles.banner, isDark && styles.bannerDark]}>
      <Text style={[styles.text, isDark && styles.textDark]}>⚠️ {message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: "#fff3cd", borderRadius: 8, padding: 12, marginBottom: 12 },
  bannerDark: { backgroundColor: "#3a2e00" },
  text: { fontSize: 13, color: "#856404" },
  textDark: { color: "#ffd84d" },
});
