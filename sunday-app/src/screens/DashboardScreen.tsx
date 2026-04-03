import React from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { EmptyState } from "../components/EmptyState";
import { ErrorBanner } from "../components/ErrorBanner";
import { EventCard } from "../components/EventCard";
import { useEvents } from "../hooks/useEvents";
import { useLocation } from "../hooks/useLocation";
import { useColors } from "../theme";
import { CalendarEvent } from "../types";

function formatDate(): string {
  return new Date().toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatLastUpdated(date: Date): string {
  return `Updated ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

export function DashboardScreen() {
  const colors = useColors();
  const isDark = useColorScheme() === "dark";
  const { events, loading, error, lastUpdated, refresh } = useEvents();
  useLocation();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>Sunday</Text>
          <Text style={[styles.date, { color: colors.muted }]}>{formatDate()}</Text>
        </View>
        {lastUpdated && (
          <Text style={[styles.updated, { color: colors.muted }]}>
            {formatLastUpdated(lastUpdated)}
          </Text>
        )}
      </View>

      {loading && events.length === 0 ? (
        <ActivityIndicator style={styles.spinner} color={colors.muted} />
      ) : (
        <FlatList<CalendarEvent>
          data={events}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <EventCard event={item} />}
          contentContainerStyle={styles.list}
          ListHeaderComponent={error ? <ErrorBanner message={error} /> : null}
          ListEmptyComponent={<EmptyState />}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={refresh}
              tintColor={colors.muted}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: { fontSize: 28, fontWeight: "700" },
  date: { fontSize: 13, marginTop: 2 },
  updated: { fontSize: 11, paddingBottom: 2 },
  spinner: { marginTop: 60 },
  list: { padding: 16 },
});
