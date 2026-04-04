const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL ?? "").trim().replace(/\/+$/, "");
const API_TOKEN = (process.env.EXPO_PUBLIC_API_TOKEN ?? "").trim();

type TranscriptionResponse = {
  text?: string;
  detail?: string;
};

type ReactNativeUploadFile = {
  uri: string;
  name: string;
  type: string;
};

function getAudioMimeType(fileName: string) {
  if (fileName.endsWith(".wav")) {
    return "audio/wav";
  }
  if (fileName.endsWith(".mp3")) {
    return "audio/mpeg";
  }
  return "audio/m4a";
}

export async function uploadRecordingForTranscription(uri: string) {
  if (!API_BASE_URL) {
    throw new Error("EXPO_PUBLIC_API_BASE_URL is not configured.");
  }

  const fileName = uri.split("/").pop() ?? "recording.m4a";
  const formData = new FormData();
  const file: ReactNativeUploadFile = {
    uri,
    name: fileName,
    type: getAudioMimeType(fileName.toLowerCase()),
  };
  formData.append("file", file as unknown as Blob);

  const headers: Record<string, string> = {};
  if (API_TOKEN) {
    headers.authorization = `Bearer ${API_TOKEN}`;
  }

  const response = await fetch(`${API_BASE_URL}/api/transcribe`, {
    method: "POST",
    headers,
    body: formData,
  });

  const payload = (await response.json().catch(() => ({}))) as TranscriptionResponse;
  if (!response.ok) {
    throw new Error(payload.detail || `Transcription failed with status ${response.status}.`);
  }

  const text = payload.text?.trim();
  if (!text) {
    throw new Error("Backend returned an empty transcript.");
  }

  return text;
}
