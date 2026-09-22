import { API_URL, fetchWithTimeout } from "./http";
import { supabase } from "./supabase";
export interface ShareGrant {
  id: string;
  share_url: string;
  expires_at: string;
  report_count: number;
  recipient_label: string;
}
export interface ShareHistory extends Omit<ShareGrant, "share_url"> {
  created_at: string;
  opened_at: string | null;
  revoked_at: string | null;
  legacy: boolean;
}
export interface ShareOptions {
  report_ids: string[];
  recipient_label: string;
  duration_minutes: number;
}
async function request<T>(path: string, body?: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sign in to manage access.");
  const response = await fetchWithTimeout(
    `${API_URL}${path}`,
    {
      method: body === undefined ? "GET" : "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    20_000,
  );
  if (!response.ok)
    throw new Error(
      `Access request failed (${response.status}). Please try again.`,
    );
  return response.json() as Promise<T>;
}
export const createShare = (options: ShareOptions) =>
  request<ShareGrant>("/share", options);
export const listShares = () => request<{ shares: ShareHistory[] }>("/shares");
/** Server-time revocation includes opened grants. Only resolve after acknowledgement. */
export const revokeShares = (shareId?: string) =>
  request<{ revoked: number; acknowledged_at: string }>(
    "/share/revoke",
    shareId ? { share_id: shareId } : {},
  );
