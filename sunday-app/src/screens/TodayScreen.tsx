import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { FONTS } from "../constants/fonts";
import { fetchApi } from "../lib/api";

const BACKGROUND = "#121212";
const CARD = "#1f1f1f";
const CARD_ALT = "#252525";
const MUTED = "#8b8b8b";
const ACCENT = "#ffffff";
const ONLINE_TAG = "#3a3a3a";
const REFRESH_INTERVAL_MS = 60_000;

type CalendarEvent = {
  id: string;
  title: string;
  location: string | null;
  start_iso: string;
  end_iso: string;
  travel_minutes: number | null;
  travel_mode: string;
  leave_by_iso: string | null;
  is_online: boolean;
  meeting_link: string | null;
  travel: Record<string, { minutes: number; text: string } | null> | null;
};

function LocationPinIcon({ size = 16, color = MUTED }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 -960 960 960" fill="none">
      <Path
        d="M480-480q33 0 56.5-23.5T560-560q0-33-23.5-56.5T480-640q-33 0-56.5 23.5T400-560q0 33 23.5 56.5T480-480Zm0 294q122-112 181-203.5T720-552q0-109-69.5-178.5T480-800q-101 0-170.5 69.5T240-552q0 71 59 162.5T480-186Zm0 106Q319-217 239.5-334.5T160-552q0-150 96.5-239T480-880q127 0 223.5 89T800-552q0 100-79.5 217.5T480-80Z"
        fill={color}
      />
    </Svg>
  );
}

function VideoCamIcon({ size = 16, color = MUTED }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 -960 960 960" fill="none">
      <Path
        d="M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h480q33 0 56.5 23.5T720-720v180l160-160v440L720-420v180q0 33-23.5 56.5T640-160H160Z"
        fill={color}
      />
    </Svg>
  );
}

function formatEventTime(isoString: string) {
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatLeaveBy(isoString: string) {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMins = Math.round(diffMs / 60_000);

  if (diffMins < 0) return "Should have left";
  if (diffMins === 0) return "Leave now";
  if (diffMins <= 60) return `Leave in ${diffMins} min`;
  return `Leave at ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

function isEventSoon(startIso: string) {
  const diffMs = new Date(startIso).getTime() - Date.now();
  return diffMs > 0 && diffMs <= 60 * 60_000; // within 1 hour
}

function isEventNow(startIso: string, endIso: string) {
  const now = Date.now();
  return new Date(startIso).getTime() <= now && new Date(endIso).getTime() > now;
}

function EventCard({ event }: { event: CalendarEvent }) {
  const soon = isEventSoon(event.start_iso);
  const now = isEventNow(event.start_iso, event.end_iso);
  const travelMode = event.travel_mode || "driving";
  const travelInfo = event.travel?.[ travelMode ];

  return (
    <View style={[styles.card, now && styles.cardNow]}>
      <View style={styles.cardHeader}>
        <View style={styles.timeColumn}>
          <Text style={[styles.timeText, (soon || now) && styles.timeTextHighlight]}>
            {formatEventTime(event.start_iso)}
          </Text>
          <Text style={styles.timeDash}>–</Text>
          <Text style={styles.timeTextEnd}>{formatEventTime(event.end_iso)}</Text>
        </View>
        <View style={styles.cardBody}>
          <Text numberOfLines={2} style={styles.eventTitle}>{event.title}</Text>

          {event.is_online ? (
            <View style={styles.tagRow}>
              <View style={styles.onlineTag}>
                <VideoCamIcon size={13} color={MUTED} />
                <Text style={styles.tagText}>Online</Text>
              </View>
            </View>
          ) : event.location ? (
            <View style={styles.locationRow}>
              <LocationPinIcon size={14} />
              <Text numberOfLines={1} style={styles.locationText}>{event.location}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Travel / leave-by info */}
      {!event.is_online && (event.leave_by_iso || travelInfo) ? (
        <View style={styles.travelRow}>
          {event.leave_by_iso ? (
            <Text style={[styles.leaveByText, soon && styles.leaveByTextUrgent]}>
              {formatLeaveBy(event.leave_by_iso)}
            </Text>
          ) : null}
          {travelInfo ? (
            <Text style={styles.travelText}>{travelInfo.text}</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export function TodayScreen() {
  const insets = useSafeAreaInsets();
  const headerTopInset = insets.top + 8;
  const [events, setEvents] = React.useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadEvents = React.useCallback(async () => {
    try {
      const response = await fetchApi("/api/events", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      }, { timeoutMs: 15_000 });

      if (!response.ok) {
        throw new Error(`Server error (${response.status})`);
      }

      const data = await response.json();
      setEvents(data.events ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load events");
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadEvents();
    const interval = setInterval(() => void loadEvents(), REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadEvents]);

  const now = new Date();
  const greeting =
    now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening";

  return (
    <SafeAreaView edges={[]} style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        contentContainerStyle={events.length ? styles.listContent : styles.emptyContent}
        showsVerticalScrollIndicator={false}
        bounces
        alwaysBounceVertical
        contentInsetAdjustmentBehavior="never"
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <View style={[styles.header, { paddingTop: headerTopInset }]}>
            <Text style={styles.title}>Today</Text>
            <Text style={styles.greeting}>{greeting}</Text>
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.centerState}>
              <ActivityIndicator color={ACCENT} />
              <Text style={styles.stateText}>Loading schedule...</Text>
            </View>
          ) : error ? (
            <View style={styles.centerState}>
              <Text style={styles.stateText}>{error}</Text>
              <Pressable onPress={() => { setIsLoading(true); void loadEvents(); }} style={styles.retryButton}>
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.centerState}>
              <Text style={styles.emptyTitle}>Nothing scheduled</Text>
              <Text style={styles.stateText}>Your upcoming events will appear here.</Text>
            </View>
          )
        }
        renderItem={({ item }) => <EventCard event={item} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: 120,
  },
  emptyContent: {
    flexGrow: 1,
    paddingBottom: 120,
  },
  header: {
    paddingHorizontal: 18,
    paddingBottom: 18,
  },
  title: {
    color: ACCENT,
    fontSize: 28,
    fontFamily: FONTS.semibold,
  },
  greeting: {
    color: MUTED,
    fontSize: 15,
    fontFamily: FONTS.regular,
    marginTop: 4,
  },
  separator: {
    height: 10,
  },
  card: {
    marginHorizontal: 18,
    borderRadius: 18,
    backgroundColor: CARD,
    padding: 16,
    gap: 10,
  },
  cardNow: {
    borderLeftWidth: 3,
    borderLeftColor: ACCENT,
  },
  cardHeader: {
    flexDirection: "row",
    gap: 14,
  },
  timeColumn: {
    width: 58,
    alignItems: "flex-end",
    paddingTop: 1,
  },
  timeText: {
    color: ACCENT,
    fontSize: 15,
    fontFamily: FONTS.semibold,
  },
  timeTextHighlight: {
    color: "#ffffff",
  },
  timeDash: {
    color: MUTED,
    fontSize: 12,
    fontFamily: FONTS.regular,
    marginVertical: -2,
  },
  timeTextEnd: {
    color: MUTED,
    fontSize: 13,
    fontFamily: FONTS.regular,
  },
  cardBody: {
    flex: 1,
    gap: 6,
  },
  eventTitle: {
    color: ACCENT,
    fontSize: 16,
    lineHeight: 22,
    fontFamily: FONTS.medium,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  locationText: {
    flex: 1,
    color: MUTED,
    fontSize: 13,
    fontFamily: FONTS.regular,
  },
  tagRow: {
    flexDirection: "row",
    gap: 6,
  },
  onlineTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: ONLINE_TAG,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: {
    color: MUTED,
    fontSize: 12,
    fontFamily: FONTS.medium,
  },
  travelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#2a2a2a",
    marginTop: 2,
  },
  leaveByText: {
    color: "#b8b8b8",
    fontSize: 13,
    fontFamily: FONTS.semibold,
  },
  leaveByTextUrgent: {
    color: "#eb4034",
  },
  travelText: {
    color: MUTED,
    fontSize: 13,
    fontFamily: FONTS.regular,
  },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    gap: 10,
  },
  emptyTitle: {
    color: ACCENT,
    fontSize: 22,
    fontFamily: FONTS.semibold,
  },
  stateText: {
    color: MUTED,
    fontSize: 15,
    fontFamily: FONTS.regular,
    textAlign: "center",
    maxWidth: 260,
  },
  retryButton: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: CARD_ALT,
  },
  retryText: {
    color: ACCENT,
    fontSize: 15,
    fontFamily: FONTS.medium,
  },
});
