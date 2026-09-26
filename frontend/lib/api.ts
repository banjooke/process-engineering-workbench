"use client";

import { createClient } from "@/lib/supabase/client";

export const WAKING_MESSAGE =
  "The engineering service is waking up. This may take up to one minute.";
// Backoff spans a full cold start even when the gateway fails immediately.
// Five 6-second attempts plus 65 seconds of backoff: at most ~95 seconds.
const GET_DELAYS = [5000, 10000, 20000, 30000];
const MUTATION_RETRY_MESSAGE =
  "The action was not automatically retried. It may have completed. Check your saved data before trying the action again.";

export type ServiceNotice = {
  key: string;
  kind: "waking" | "unreachable" | "authentication" | "api";
  message: string;
  safe: boolean;
};

const notices = new Map<symbol, ServiceNotice>();
const listeners = new Set<() => void>();
const EMPTY: ServiceNotice[] = [];
let snapshot = EMPTY;
function publish() {
  snapshot = Array.from(notices.values());
  listeners.forEach((listener) => listener());
}
export function subscribeServiceStatus(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export const getServiceStatus = () => snapshot;
export const getServerServiceStatus = () => EMPTY;
export function dismissServiceErrors() {
  for (const [id, notice] of notices) {
    if (notice.kind !== "waking") notices.delete(id);
  }
  publish();
}

function pause(ms: number, signal?: AbortSignal | null): Promise<void> {
  return new Promise((resolve, reject) => {
    signal?.throwIfAborted();
    const abort = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", abort, { once: true });
  });
}

/** GET alone is retried. Responses remain available for endpoint-specific errors. */
export async function apiFetch(input: string | URL, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  const safe = method === "GET";
  const key = `${method} ${input}`;
  const id = Symbol(key);
  const signal = init.signal;
  const setNotice = (kind: ServiceNotice["kind"], message: string) => {
    notices.set(id, { key, kind, message, safe });
    publish();
  };
  // A deliberate repeat replaces the previous failure for this request only.
  for (const [previous, notice] of notices) {
    if (notice.key === key && notice.kind !== "waking") notices.delete(previous);
  }
  publish();
  const slow = setTimeout(() => setNotice("waking", WAKING_MESSAGE), 3000);
  let keepError = false;
  try {
    for (let attempt = 0; attempt <= (safe ? GET_DELAYS.length : 0); attempt++) {
      signal?.throwIfAborted();
      const { data: { session }, error } = await createClient().auth.getSession();
      if (error) {
        keepError = true;
        const message = "Unable to verify your session. Please sign in again.";
        setNotice("authentication", message);
        throw new Error(message);
      }
      const headers = new Headers(init.headers);
      if (session?.access_token) headers.set("Authorization", `Bearer ${session.access_token}`);
      signal?.throwIfAborted();

      const controller = new AbortController();
      const abort = () => controller.abort(signal?.reason);
      signal?.addEventListener("abort", abort, { once: true });
      // A slow mutation gets longer to finish, but is never resent.
      const timeout = setTimeout(() => controller.abort(), safe ? 6000 : 90000);
      let response: Response | undefined;
      try {
        response = await fetch(input, { ...init, headers, signal: controller.signal });
      } catch (error) {
        if (signal?.aborted) throw error;
        // Network errors and our timeout both mean reachability is uncertain.
      } finally {
        clearTimeout(timeout);
        signal?.removeEventListener("abort", abort);
      }
      signal?.throwIfAborted();
      // FastAPI JSON errors (including auth-service 503s) are genuine API errors.
      const unavailable = !response || (
        [502, 503, 504].includes(response.status) &&
        !response.headers.get("content-type")?.includes("json")
      );
      if (unavailable) {
        if (safe && attempt < GET_DELAYS.length) {
          await response?.body?.cancel();
          setNotice("waking", WAKING_MESSAGE);
          await pause(GET_DELAYS[attempt], signal);
          continue;
        }
        keepError = true;
        const message = safe
          ? "The engineering service is still unreachable. Please retry loading data in a moment."
          : `The engineering service could not confirm the action. ${MUTATION_RETRY_MESSAGE}`;
        setNotice("unreachable", message);
        throw new Error(message);
      }
      if (response) {
        if (response.status === 401 || response.status === 403) {
          keepError = true;
          setNotice("authentication", response.status === 401
            ? "Your session has expired or you are signed out. Please sign in again."
            : "You do not have permission to perform this action.");
        } else if (!response.ok && response.status !== 404) {
          // 404 is handled by callers, including the saved-model fallback.
          keepError = true;
          setNotice("api", `The engineering service returned an API error (${response.status}). Review the action's error details.${safe ? "" : " The action was not automatically retried. Review your saved data and the error before retrying the action."}`);
        }
        return response;
      }
    }
    throw new Error("The engineering service is unreachable.");
  } finally {
    clearTimeout(slow);
    if (!keepError || signal?.aborted) notices.delete(id);
    publish();
  }
}
