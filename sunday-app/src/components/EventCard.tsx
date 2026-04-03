import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "../theme";
import { CalendarEvent, TravelModeInfo } from "../types";
import { CountdownTimer } from "./CountdownTimer";

interface Props {
  event: CalendarEvent;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatTimeRange(startIso: string, endIso: string): string {
  return `${formatTime(startIso)} – ${formatTime(endIso)}`;
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

interface TravelPillProps {
  icon: string;
  info: TravelModeInfo | null;
}

function TravelPill({ icon, info }: TravelPillProps) {
  const colors = useColors();
  return (
    <View style={[styles.pill, { backgroundColor: colors.pill }]}>
      <Text style={styles.pillIcon}>{icon}</Text>
      <Text style={[styles.pillText, { color: colors.pillText }]}>
        {info ? formatMinutes(info.minutes) : "—"}
      </Text>
    </View>
  );
}

export function EventCard({ event }: Props) {
  const colors = useColors();
  const isLeaveUrgent =
    event.leave_by_iso != null &&
    new Date(event.leave_by_iso).getTime() - Date.now() < 30 * 60 * 1000;

  return (
    <View style={[
      styles.card,
      { backgroundColor: colors.card },
      isLeaveUrgent && { borderLeftWidth: 3, borderLeftColor: colors.urgent },
    ]}>
      <Text style={[styles.title, { color: colors.text }]}>{event.title}</Text>
      <Text style={[styles.time, { color: colors.subtext }]}>
        {formatTimeRange(event.start_iso, event.end_iso)}
      </Text>

      {event.location != null && (
        <Text style={[styles.detail, { color: colors.subtext }]}>📍 {event.location}</Text>
      )}

      {event.is_online && event.meeting_link != null && (
        <Text style={[styles.detail, { color: colors.subtext }]}>🔗 Online meeting</Text>
      )}

      {event.travel != null && (
        <View style={styles.travelRow}>
          <TravelPill icon="🚗" info={event.travel.driving} />
          <TravelPill icon="🚌" info={event.travel.transit} />
          <TravelPill icon="🚶" info={event.travel.walking} />
        </View>
      )}

      {event.leave_by_iso != null && (
        <View style={[styles.leaveRow, { borderTopColor: colors.border }]}>
          <Text style={[styles.leaveBy, { color: colors.text }]}>
            leave by {formatTime(event.leave_by_iso)}
          </Text>
          <CountdownTimer targetIso={event.leave_by_iso} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  title: { fontSize: 16, fontWeight: "600", marginBottom: 4 },
  time: { fontSize: 14, marginBottom: 6 },
  detail: { fontSize: 13, marginBottom: 4 },
  travelRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 4,
  },
  pillIcon: { fontSize: 13 },
  pillText: { fontSize: 13, fontWeight: "500" },
  leaveRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  leaveBy: { fontSize: 13, fontWeight: "600" },
});
