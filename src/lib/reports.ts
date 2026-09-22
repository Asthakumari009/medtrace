import * as Crypto from "expo-crypto";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";

import { API_URL, fetchWithTimeout } from "./http";
import { recognizeOnDevice } from "./ocr";
import { supabase } from "./supabase";

export interface PickedFile {
  uri: string;
  mime: string;
  ext: string;
  fileType: "pdf" | "image";
  size?: number;
}

const EXT_BY_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
};

function toPicked(uri: string, mime: string, size?: number): PickedFile {
  if (size !== undefined && size > 20 * 1024 * 1024)
    throw new Error("Choose a report smaller than 20 MB.");
  const ext = EXT_BY_MIME[mime] ?? "jpg";
  return {
    uri,
    mime,
    ext,
    size,
    fileType: mime === "application/pdf" ? "pdf" : "image",
  };
}

export async function pickFromCamera(): Promise<PickedFile | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return null;
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ["images"],
    quality: 0.85,
  });
  const asset = result.canceled ? undefined : result.assets[0];
  if (asset === undefined) return null;
  return toPicked(asset.uri, asset.mimeType ?? "image/jpeg", asset.fileSize);
}

export async function pickFromLibrary(): Promise<PickedFile | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.85,
  });
  const asset = result.canceled ? undefined : result.assets[0];
  if (asset === undefined) return null;
  return toPicked(asset.uri, asset.mimeType ?? "image/jpeg", asset.fileSize);
}

export async function pickDocument(): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/heic",
    ],
    copyToCacheDirectory: true,
    multiple: false,
  });
  const asset = result.canceled ? undefined : result.assets[0];
  if (asset === undefined) return null;
  return toPicked(asset.uri, asset.mimeType ?? "application/pdf", asset.size);
}

const BASE64_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/=+$/, "");
  const output = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let offset = 0;
  let buffer = 0;
  let bits = 0;
  for (const char of clean) {
    const index = BASE64_CHARS.indexOf(char);
    if (index === -1) continue;
    buffer = (buffer << 6) | index;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output[offset++] = (buffer >> bits) & 0xff;
    }
  }
  return output.subarray(0, offset);
}

/**
 * Upload a picked file to the private bucket under <uid>/<reportId>.<ext>,
 * insert the reports row, and kick off extraction. Returns the report id.
 */
export async function uploadReport(file: PickedFile): Promise<string> {
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (session === null) throw new Error("Not signed in");

  const reportId = Crypto.randomUUID();
  const path = `${session.user.id}/${reportId}.${file.ext}`;

  // Browser picker URLs cannot be read with Expo's native filesystem API.
  const bytes =
    Platform.OS === "web"
      ? new Uint8Array(await (await fetch(file.uri)).arrayBuffer())
      : base64ToBytes(
          await FileSystem.readAsStringAsync(file.uri, {
            encoding: FileSystem.EncodingType.Base64,
          }),
        );
  if (bytes.byteLength === 0 || bytes.byteLength > 20 * 1024 * 1024)
    throw new Error("Choose a non-empty report smaller than 20 MB.");

  const { error: uploadError } = await supabase.storage
    .from("reports")
    .upload(path, bytes.buffer as ArrayBuffer, { contentType: file.mime });
  if (uploadError !== null) throw new Error(uploadError.message);

  const { error: insertError } = await supabase.from("reports").insert({
    id: reportId,
    user_id: session.user.id,
    file_path: path,
    file_type: file.fileType,
  });
  if (insertError !== null) {
    // Avoid leaving an orphaned medical file after a failed database insert.
    await supabase.storage.from("reports").remove([path]);
    throw new Error(insertError.message);
  }

  return reportId;
}

/**
 * Ask the FastAPI service to extract a report. Throws if unreachable.
 *
 * With `text`, the service structures that text and never touches storage —
 * this is the on-device path. Without it, the service downloads the uploaded
 * file and reads the document itself.
 */
export async function requestExtraction(
  reportId: string,
  text?: string,
): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token === undefined) throw new Error("Not signed in");

  // Extraction reads the file and runs a long Gemini call; give it room.
  const response = await fetchWithTimeout(
    `${API_URL}/extract`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(
        text === undefined
          ? { report_id: reportId }
          : { report_id: reportId, text },
      ),
    },
    120_000,
  );
  if (!response.ok) {
    throw new Error(`Extraction request failed (${response.status})`);
  }
}

export type ExtractionSource = "on_device_ocr" | "cloud";

export interface AddedReport {
  reportId: string;
  source: ExtractionSource;
}

/**
 * Insert a report row for text that was read on this device. No file is
 * uploaded, so file_path stays null — the photo never leaves the phone.
 */
async function insertTextOnlyReport(fileType: PickedFile["fileType"]): Promise<string> {
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (session === null) throw new Error("Not signed in");

  const reportId = Crypto.randomUUID();
  const { error } = await supabase.from("reports").insert({
    id: reportId,
    user_id: session.user.id,
    file_path: null,
    file_type: fileType,
    extraction_source: "on_device_ocr",
  });
  if (error !== null) throw new Error(error.message);
  return reportId;
}

/**
 * Add a report, preferring the on-device path.
 *
 * Images are read by ML Kit first; when the read is usable only the text is
 * sent and nothing is uploaded. PDFs, poor reads, and builds without the
 * native module fall back to uploading the file for cloud extraction.
 */
export async function addReport(file: PickedFile): Promise<AddedReport> {
  if (file.fileType === "image") {
    const text = await recognizeOnDevice(file.uri);
    if (text !== null) {
      const reportId = await insertTextOnlyReport(file.fileType);
      await requestExtraction(reportId, text);
      return { reportId, source: "on_device_ocr" };
    }
  }
  const reportId = await uploadReport(file);
  await requestExtraction(reportId);
  return { reportId, source: "cloud" };
}
