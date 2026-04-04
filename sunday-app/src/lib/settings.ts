const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL ?? "").trim().replace(/\/+$/, "");
const API_TOKEN = (process.env.EXPO_PUBLIC_API_TOKEN ?? "").trim();

export type AppSettingsValues = Record<string, string | boolean>;

export type AppSettingsResponse = {
  settings: AppSettingsValues;
  errors: string[];
  warnings: string[];
};

function buildHeaders() {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (API_TOKEN) {
    headers.authorization = `Bearer ${API_TOKEN}`;
  }
  return headers;
}

async function parseResponse(response: Response): Promise<AppSettingsResponse> {
  const payload = (await response.json().catch(() => ({}))) as Partial<AppSettingsResponse> & {
    detail?: string;
  };
  if (!response.ok) {
    throw new Error(payload.detail || `Request failed with status ${response.status}.`);
  }
  return {
    settings: payload.settings ?? {},
    errors: payload.errors ?? [],
    warnings: payload.warnings ?? [],
  };
}

export async function fetchAppSettings(): Promise<AppSettingsResponse> {
  if (!API_BASE_URL) {
    throw new Error("EXPO_PUBLIC_API_BASE_URL is not configured.");
  }

  const response = await fetch(`${API_BASE_URL}/api/settings`, {
    method: "GET",
    headers: buildHeaders(),
  });

  return parseResponse(response);
}

export async function saveAppSettings(settings: AppSettingsValues): Promise<AppSettingsResponse> {
  if (!API_BASE_URL) {
    throw new Error("EXPO_PUBLIC_API_BASE_URL is not configured.");
  }

  const response = await fetch(`${API_BASE_URL}/api/settings`, {
    method: "PUT",
    headers: buildHeaders(),
    body: JSON.stringify({ settings }),
  });

  return parseResponse(response);
}
