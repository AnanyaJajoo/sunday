import React from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FONTS } from "../constants/fonts";

const BACKGROUND = "#121212";
const PANEL = "#1f1f1f";
const PANEL_ALT = "#252525";
const BORDER = "#323232";
const TEXT = "#ffffff";
const MUTED = "#8b8b8b";

type OptionPickerModalProps = {
  visible: boolean;
  title: string;
  options: string[];
  value?: string;
  searchPlaceholder?: string;
  onClose: () => void;
  onSelect: (option: string) => void;
};

export function OptionPickerModal({
  visible,
  title,
  options,
  value,
  searchPlaceholder = "Search options",
  onClose,
  onSelect,
}: OptionPickerModalProps) {
  const [query, setQuery] = React.useState("");

  React.useEffect(() => {
    if (visible) {
      setQuery("");
    }
  }, [visible]);

  const filteredOptions = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return options;
    }
    return options.filter((option) => option.toLowerCase().includes(normalizedQuery));
  }, [options, query]);

  return (
    <Modal
      animationType="slide"
      presentationStyle="pageSheet"
      transparent={false}
      visible={visible}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.headerButton}>
            <Text style={styles.headerButtonText}>Close</Text>
          </Pressable>
          <Text style={styles.headerTitle}>{title}</Text>
          <View style={styles.headerButtonSpacer} />
        </View>

        <View style={styles.searchWrap}>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setQuery}
            placeholder={searchPlaceholder}
            placeholderTextColor="#6f6f6f"
            style={styles.searchInput}
            value={query}
          />
        </View>

        <ScrollView
          bounces
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {filteredOptions.map((option) => {
            const selected = option === value;
            return (
              <Pressable
                key={option}
                onPress={() => onSelect(option)}
                style={[styles.optionRow, selected && styles.optionRowSelected]}
              >
                <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                  {option}
                </Text>
              </Pressable>
            );
          })}

          {!filteredOptions.length ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No matching options.</Text>
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 16,
    gap: 12,
  },
  headerButton: {
    minWidth: 72,
    paddingVertical: 10,
  },
  headerButtonSpacer: {
    minWidth: 72,
  },
  headerButtonText: {
    color: MUTED,
    fontSize: 15,
    fontFamily: FONTS.medium,
  },
  headerTitle: {
    flex: 1,
    color: TEXT,
    textAlign: "center",
    fontSize: 18,
    fontFamily: FONTS.semibold,
  },
  searchWrap: {
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  searchInput: {
    minHeight: 46,
    borderRadius: 14,
    paddingHorizontal: 14,
    color: TEXT,
    backgroundColor: PANEL_ALT,
    fontFamily: FONTS.regular,
    fontSize: 15,
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 32,
    gap: 10,
  },
  optionRow: {
    borderRadius: 18,
    backgroundColor: PANEL,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  optionRowSelected: {
    backgroundColor: TEXT,
    borderColor: TEXT,
  },
  optionText: {
    color: TEXT,
    fontSize: 15,
    fontFamily: FONTS.medium,
  },
  optionTextSelected: {
    color: BACKGROUND,
  },
  emptyState: {
    paddingTop: 28,
    alignItems: "center",
  },
  emptyText: {
    color: MUTED,
    fontSize: 14,
    fontFamily: FONTS.regular,
  },
});
