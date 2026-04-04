import React, { useCallback, useRef } from "react";
import Constants from "expo-constants";
import { Animated, Platform, Pressable, StatusBar, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useVideoPlayer, VideoView } from "expo-video";

const BACKGROUND = "#000000";
const ORB_VIDEO_URL =
  "https://www.apple.com/105/media/us/siri/2018/ee7c4c16_aae5_4678_9cdd_7ca813baf929/films/siri_orb_large.mp4";

function NativeSettingsButton() {
  if (Platform.OS !== "ios" || Constants.appOwnership === "expo") {
    return null;
  }

  const { Host, Button } = require("@expo/ui/swift-ui") as typeof import("@expo/ui/swift-ui");
  const {
    buttonStyle,
    controlSize,
    labelStyle,
  } = require("@expo/ui/swift-ui/modifiers") as typeof import("@expo/ui/swift-ui/modifiers");

  return (
    <View style={styles.topBar}>
      <Host matchContents colorScheme="dark">
        <Button
          label="Settings"
          systemImage="gear"
          onPress={() => {}}
          modifiers={[labelStyle("iconOnly"), controlSize("large"), buttonStyle("glass")]}
        />
      </Host>
    </View>
  );
}

export function HomeScreen() {
  const orbScale = useRef(new Animated.Value(1)).current;

  const player = useVideoPlayer(ORB_VIDEO_URL, (videoPlayer) => {
    videoPlayer.loop = true;
    videoPlayer.muted = true;
    videoPlayer.play();
  });

  const animateOrb = useCallback(() => {
    orbScale.stopAnimation();
    orbScale.setValue(1);

    Animated.spring(orbScale, {
      toValue: 1.055,
      velocity: 4.2,
      tension: 340,
      friction: 11,
      overshootClamping: false,
      restDisplacementThreshold: 0.001,
      restSpeedThreshold: 0.001,
      useNativeDriver: true,
    }).start(() => {
      orbScale.setValue(1);
    });
  }, [orbScale]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>
        <NativeSettingsButton />

        <Pressable onPress={animateOrb} style={styles.pressable} hitSlop={24}>
          <Animated.View
            style={[
              styles.orbFrame,
              {
                transform: [{ scale: orbScale }],
              },
            ]}
          >
            <VideoView
              player={player}
              nativeControls={false}
              fullscreenOptions={{ enable: false }}
              allowsPictureInPicture={false}
              contentFit="cover"
              style={styles.orbVideo}
            />
          </Animated.View>
        </Pressable>
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
  },
  topBar: {
    position: "absolute",
    top: 10,
    right: 16,
    zIndex: 10,
  },
  pressable: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  orbFrame: {
    width: 170,
    height: 170,
    borderRadius: 85,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#6bb7ff",
    shadowOpacity: 0.22,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
  },
  orbVideo: {
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: "transparent",
  },
});
