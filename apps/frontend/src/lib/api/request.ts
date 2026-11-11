// Requests to the host laptop's API. Clinic Wi-Fi drops and stalls, so every request gives up after
// a while and failures read as messages staff can act on, never "Failed to fetch" or a JSON error.
import { useUserStore } from "@/stores/useUserStore";
import { sampleReply } from "@/lib/guide/sample";

export const REQUEST_TIMEOUT_MS = 20_000;
// A load (GET) whose connection dropped is sent once more after this; Wi-Fi blips are often brief.
export const LOAD_RETRY_DELAY_MS = 1_000;

// A request this device gave up on, or could not send: the host may or may not have received it.
export class NoAnswerError extends Error {
  name = "NoAnswerError";
}

function hasAuthorization(headers: HeadersInit | undefined): boolean {
  return headers !== undefined && new Headers(headers).has("Authorization");
}

/**
 * fetch() for the host's API, with the same arguments. It also:
 * - gives up after `timeoutMs` (default 20 s) with a NoAnswerError;
 * - sends a load (GET) once more after a dropped connection, as Wi-Fi blips are often brief (not
 *   after a timeout, nor a save: a save the host got must not be sent again without its request id).
 *   `retryOnDrop: false` turns this off for callers that retry by themselves;
 * - turns a dropped connection into a NoAnswerError with a readable message;
 * - signs this device out when a signed-in request gets 401 (sign-in expired or account disabled).
 * During the guided tour, queues and the sample patient's records are answered by the tour
 *   (lib/guide/sample.ts) instead of the host.
 * Cancelling through `signal` still rejects with the browser's AbortError, as with fetch().
 */
export async function apiFetch(url: string, init: RequestInit & { timeoutMs?: number; retryOnDrop?: boolean } = {}): Promise<Response> {
  const sample = sampleReply(url, init.method);
  if (sample) return sample;
  const { timeoutMs = REQUEST_TIMEOUT_MS, signal, retryOnDrop = true, ...options } = init;
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  if (signal?.aborted) controller.abort();
  // Kept after the answer arrives, so cancelling also stops reading its body.
  else signal?.addEventListener("abort", () => controller.abort(), { once: true });
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (response.status === 401 && hasAuthorization(options.headers)) useUserStore.getState().removeUser();
    return response;
  } catch (error) {
    if (signal?.aborted) throw error;
    const saving = (options.method ?? "GET").toUpperCase() !== "GET";
    if (!saving && !timedOut && retryOnDrop) {
      clearTimeout(timer);
      await new Promise(resolve => setTimeout(resolve, LOAD_RETRY_DELAY_MS));
      if (signal?.aborted) throw error;
      return apiFetch(url, { ...init, retryOnDrop: false });
    }
    const problem = timedOut ? "The host laptop took too long to answer" : "Couldn't reach the host laptop";
    throw new NoAnswerError(saving
      ? `${problem}, so this may not have been saved. Check the Wi-Fi and what was saved before trying again.`
      : `${problem}. Check the Wi-Fi, then try again.`);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The host's message for a failed response: its JSON `error` or `message`, a short plain-text
 * reply (such as the "Too many requests" limit), or the fallback with the status code.
 */
export async function readError(response: Response, fallback: string): Promise<string> {
  if (response.status === 413) return "This is too large for the host laptop to save.";
  const text = await response.text().catch(() => "");
  try {
    const body = JSON.parse(text);
    const message = body?.error || body?.message;
    if (typeof message === "string" && message) return message;
  } catch {
    // Not JSON: a plain-text or HTML reply.
  }
  const plain = text.trim();
  if (plain && plain.length <= 200 && !plain.startsWith("<")) return plain;
  return `${fallback} (${response.status})`;
}
