import { useColorScheme } from "react-native";

const light = {
  background: "#f5f5f5",
  card: "#ffffff",
  text: "#1a1a1a",
  subtext: "#555555",
  muted: "#999999",
  pill: "#f0f0f0",
  pillText: "#333333",
  border: "#e0e0e0",
  urgent: "#e74c3c",
};

const dark = {
  background: "#111111",
  card: "#1e1e1e",
  text: "#f0f0f0",
  subtext: "#aaaaaa",
  muted: "#666666",
  pill: "#2a2a2a",
  pillText: "#dddddd",
  border: "#2e2e2e",
  urgent: "#ff6b6b",
};

export type Colors = typeof light;

export function useColors(): Colors {
  return useColorScheme() === "dark" ? dark : light;
}
