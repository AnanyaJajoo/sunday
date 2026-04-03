import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "../theme";

export function EmptyState() {
  const colors = useColors();
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>📭</Text>
      <Text style={[styles.text, { color: colors.muted }]}>Nothing coming up</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", paddingVertical: 60 },
  emoji: { fontSize: 40, marginBottom: 12 },
  text: { fontSize: 16 },
});
