import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FONTS } from "../constants/fonts";
import {
  AppSettingsValues,
  fetchAppSettings,
  saveAppSettings,
} from "../lib/settings";

const BACKGROUND = "#121212";
const PANEL = "#1f1f1f";
const PANEL_ALT = "#252525";
const BORDER = "#323232";
const MUTED = "#8b8b8b";
const ACCENT = "#ffffff";

type FieldKind = "text" | "number" | "decimal" | "boolean" | "choice";

type SettingField = {
  key: string;
  label: string;
  kind: FieldKind;
  placeholder?: string;
  description?: string;
  options?: string[];
};

type SettingSection = {
  title: string;
  fields: SettingField[];
};

const SETTINGS_SECTIONS: SettingSection[] = [
  {
    title: "Calendar",
    fields: [
      {
        key: "TARGET_CALENDAR_ID",
        label: "Target calendar ID",
        placeholder: "primary",
        kind: "text",
      },
      {
        key: "TIMEZONE",
        label: "Time zone",
        placeholder: "America/Chicago",
        kind: "text",
      },
      {
        key: "TEXT_EMAIL_LINKS",
        label: "Include email links in texts",
        kind: "boolean",
      },
    ],
  },
  {
    title: "Locations",
    fields: [
      {
        key: "DEFAULT_HOME_LOCATION",
        label: "Home location",
        placeholder: "Champaign, IL",
        kind: "text",
      },
      {
        key: "DEFAULT_HOME_LATITUDE",
        label: "Home latitude",
        kind: "decimal",
      },
      {
        key: "DEFAULT_HOME_LONGITUDE",
        label: "Home longitude",
        kind: "decimal",
      },
      {
        key: "DEFAULT_WORK_LOCATION",
        label: "Work location",
        kind: "text",
      },
      {
        key: "DEFAULT_WORK_LATITUDE",
        label: "Work latitude",
        kind: "decimal",
      },
      {
        key: "DEFAULT_WORK_LONGITUDE",
        label: "Work longitude",
        kind: "decimal",
      },
    ],
  },
  {
    title: "Schedule",
    fields: [
      {
        key: "WORK_DAYS",
        label: "Work days",
        description: "Comma-separated: mon,tue,wed,thu,fri",
        kind: "text",
      },
      {
        key: "WORKDAY_START_TIME",
        label: "Workday start",
        placeholder: "09:00",
        kind: "text",
      },
      {
        key: "WORKDAY_END_TIME",
        label: "Workday end",
        placeholder: "17:00",
        kind: "text",
      },
      {
        key: "TRAVEL_TYPE",
        label: "Travel type",
        kind: "choice",
        options: ["driving", "walking", "bicycling", "transit"],
      },
      {
        key: "PREP_TIME_MINUTES",
        label: "Prep minutes",
        kind: "number",
      },
      {
        key: "ONLINE_PREP_MINUTES",
        label: "Online prep minutes",
        kind: "number",
      },
      {
        key: "POLL_INTERVAL_SECONDS",
        label: "Poll interval seconds",
        kind: "number",
      },
      {
        key: "MAX_EMAILS_PER_CYCLE",
        label: "Max emails per cycle",
        kind: "number",
      },
    ],
  },
];

function getKeyboardType(kind: FieldKind) {
  if (kind === "number") {
    return "number-pad" as const;
  }
  if (kind === "decimal") {
    return "decimal-pad" as const;
  }
  return "default" as const;
}

function getInitialSettingsState() {
  const values: AppSettingsValues = {};
  for (const section of SETTINGS_SECTIONS) {
    for (const field of section.fields) {
      values[field.key] = field.kind === "boolean" ? false : "";
    }
  }
  return values;
}

export function SettingsScreen() {
  const [settings, setSettings] = React.useState<AppSettingsValues>(getInitialSettingsState);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);
  const [warnings, setWarnings] = React.useState<string[]>([]);
  const [errors, setErrors] = React.useState<string[]>([]);

  const loadSettings = React.useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetchAppSettings();
      setSettings((current) => ({ ...current, ...response.settings }));
      setWarnings(response.warnings);
      setErrors(response.errors);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load settings.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const handleTextChange = React.useCallback((key: string, value: string) => {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));
  }, []);

  const handleToggleChange = React.useCallback((key: string, value: boolean) => {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));
  }, []);

  const handleSave = React.useCallback(async () => {
    setIsSaving(true);
    setStatusMessage(null);
    setErrorMessage(null);
    try {
      const response = await saveAppSettings(settings);
      setSettings((current) => ({ ...current, ...response.settings }));
      setWarnings(response.warnings);
      setErrors(response.errors);
      setStatusMessage("Saved to config.env");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to save settings.");
    } finally {
      setIsSaving(false);
    }
  }, [settings]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        bounces
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>
            Edit the non-secret config values Sunday uses at runtime.
          </Text>
        </View>

        {isLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color="#ffffff" />
            <Text style={styles.loadingText}>Loading settings…</Text>
          </View>
        ) : (
          <>
            {SETTINGS_SECTIONS.map((section) => (
              <View key={section.title} style={styles.section}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <View style={styles.sectionPanel}>
                  {section.fields.map((field, index) => {
                    const rawValue = settings[field.key];
                    const stringValue = typeof rawValue === "boolean" ? "" : String(rawValue ?? "");
                    const boolValue = rawValue === true;

                    return (
                      <View
                        key={field.key}
                        style={[
                          styles.fieldRow,
                          index !== section.fields.length - 1 && styles.fieldRowBorder,
                        ]}
                      >
                        <View style={styles.fieldHeader}>
                          <Text style={styles.fieldLabel}>{field.label}</Text>
                          {field.description ? (
                            <Text style={styles.fieldDescription}>{field.description}</Text>
                          ) : null}
                        </View>

                        {field.kind === "boolean" ? (
                          <Switch
                            value={boolValue}
                            onValueChange={(value) => handleToggleChange(field.key, value)}
                            trackColor={{ false: "#3a3a3a", true: "#4f4f4f" }}
                            thumbColor={boolValue ? "#ffffff" : "#d6d6d6"}
                          />
                        ) : field.kind === "choice" ? (
                          <View style={styles.choiceRow}>
                            {field.options?.map((option) => {
                              const selected = stringValue === option;
                              return (
                                <Pressable
                                  key={option}
                                  onPress={() => handleTextChange(field.key, option)}
                                  style={[
                                    styles.choiceChip,
                                    selected && styles.choiceChipSelected,
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.choiceChipText,
                                      selected && styles.choiceChipTextSelected,
                                    ]}
                                  >
                                    {option}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        ) : (
                          <TextInput
                            autoCapitalize="none"
                            autoCorrect={false}
                            keyboardType={getKeyboardType(field.kind)}
                            onChangeText={(value) => handleTextChange(field.key, value)}
                            placeholder={field.placeholder}
                            placeholderTextColor="#6f6f6f"
                            style={styles.input}
                            value={stringValue}
                          />
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>
            ))}

            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
            {statusMessage ? <Text style={styles.statusText}>{statusMessage}</Text> : null}
            {errors.map((error) => (
              <Text key={`error-${error}`} style={styles.validationText}>
                {error}
              </Text>
            ))}
            {warnings.map((warning) => (
              <Text key={`warning-${warning}`} style={styles.warningText}>
                {warning}
              </Text>
            ))}

            <Pressable
              disabled={isSaving || isLoading}
              onPress={() => void handleSave()}
              style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
            >
              <Text style={styles.saveButtonText}>
                {isSaving ? "Saving…" : "Save Settings"}
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 120,
    gap: 18,
  },
  header: {
    gap: 8,
  },
  title: {
    color: "#ffffff",
    fontSize: 28,
    fontFamily: FONTS.semibold,
  },
  subtitle: {
    color: MUTED,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: FONTS.regular,
  },
  loadingState: {
    minHeight: 260,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    color: MUTED,
    fontFamily: FONTS.medium,
    fontSize: 15,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    color: "#ffffff",
    fontFamily: FONTS.semibold,
    fontSize: 18,
  },
  sectionPanel: {
    borderRadius: 22,
    backgroundColor: PANEL,
    overflow: "hidden",
  },
  fieldRow: {
    paddingHorizontal: 16,
    paddingVertical: 15,
    backgroundColor: PANEL,
    gap: 12,
  },
  fieldRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  fieldHeader: {
    gap: 4,
  },
  fieldLabel: {
    color: "#ffffff",
    fontFamily: FONTS.medium,
    fontSize: 16,
  },
  fieldDescription: {
    color: MUTED,
    fontFamily: FONTS.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  input: {
    minHeight: 46,
    borderRadius: 14,
    paddingHorizontal: 14,
    color: "#ffffff",
    backgroundColor: PANEL_ALT,
    fontFamily: FONTS.regular,
    fontSize: 15,
  },
  choiceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  choiceChip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: PANEL_ALT,
  },
  choiceChipSelected: {
    backgroundColor: ACCENT,
  },
  choiceChipText: {
    color: "#ffffff",
    fontFamily: FONTS.medium,
    fontSize: 14,
  },
  choiceChipTextSelected: {
    color: BACKGROUND,
  },
  saveButton: {
    minHeight: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    marginTop: 6,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: BACKGROUND,
    fontFamily: FONTS.semibold,
    fontSize: 16,
  },
  statusText: {
    color: "#cfcfcf",
    fontFamily: FONTS.medium,
    fontSize: 14,
  },
  errorText: {
    color: "#ff7b72",
    fontFamily: FONTS.medium,
    fontSize: 14,
    lineHeight: 20,
  },
  validationText: {
    color: "#ff9d57",
    fontFamily: FONTS.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  warningText: {
    color: "#c9c9c9",
    fontFamily: FONTS.regular,
    fontSize: 13,
    lineHeight: 18,
  },
});
