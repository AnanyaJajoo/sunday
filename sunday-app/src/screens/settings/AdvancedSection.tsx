import React from "react";
import {
  Animated,
  LayoutAnimation,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { FONTS } from "../../constants/fonts";

const PANEL = "#1f1f1f";
const MUTED = "#8b8b8b";
const BORDER = "#323232";

function ChevronIcon({ size = 18, color = "#8b8b8b" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 -960 960 960" fill="none">
      <Path d="M480-345 240-585l56-56 184 184 184-184 56 56-240 240Z" fill={color} />
    </Svg>
  );
}

type AdvancedSectionProps = {
  children: React.ReactNode;
};

export function AdvancedSection({ children }: AdvancedSectionProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const chevronRotation = React.useRef(new Animated.Value(0)).current;

  const toggle = React.useCallback(() => {
    LayoutAnimation.configureNext({
      duration: 260,
      create: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
      update: {
        type: LayoutAnimation.Types.easeInEaseOut,
      },
      delete: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
    });

    const nextExpanded = !isExpanded;
    setIsExpanded(nextExpanded);

    Animated.spring(chevronRotation, {
      toValue: nextExpanded ? 1 : 0,
      speed: 18,
      bounciness: 6,
      useNativeDriver: true,
    }).start();
  }, [chevronRotation, isExpanded]);

  const chevronStyle = React.useMemo(
    () => ({
      transform: [
        {
          rotate: chevronRotation.interpolate({
            inputRange: [0, 1],
            outputRange: ["-90deg", "0deg"],
          }),
        },
      ],
    }),
    [chevronRotation],
  );

  return (
    <View style={styles.container}>
      <Pressable onPress={toggle} style={styles.header}>
        <Text style={styles.headerText}>Advanced</Text>
        <Animated.View style={chevronStyle}>
          <ChevronIcon />
        </Animated.View>
      </Pressable>
      {isExpanded ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

type AdvancedSubSectionProps = {
  title: string;
  children: React.ReactNode;
  isLast?: boolean;
};

export function AdvancedSubSection({ title, children, isLast }: AdvancedSubSectionProps) {
  return (
    <View style={[styles.subSection, !isLast && styles.subSectionBorder]}>
      <Text style={styles.subSectionTitle}>{title}</Text>
      <View style={styles.subSectionPanel}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 0,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    paddingVertical: 10,
  },
  headerText: {
    color: MUTED,
    fontFamily: FONTS.semibold,
    fontSize: 16,
    letterSpacing: 0.3,
  },
  body: {
    gap: 22,
    paddingTop: 4,
  },
  subSection: {
    gap: 10,
  },
  subSectionBorder: {
    paddingBottom: 22,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  subSectionTitle: {
    color: MUTED,
    fontFamily: FONTS.medium,
    fontSize: 14,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  subSectionPanel: {
    borderRadius: 22,
    backgroundColor: PANEL,
    overflow: "hidden",
  },
});
