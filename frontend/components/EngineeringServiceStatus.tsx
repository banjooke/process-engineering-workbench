"use client";

import { useSyncExternalStore } from "react";
import {
  dismissServiceErrors, getServerServiceStatus, getServiceStatus,
  subscribeServiceStatus,
} from "@/lib/api";

export default function EngineeringServiceStatus({ onRetryLoads }: { onRetryLoads: () => void }) {
  const notices = useSyncExternalStore(subscribeServiceStatus, getServiceStatus, getServerServiceStatus);
  if (!notices.length) return null;
  const waking = notices.some((notice) => notice.kind === "waking");
  const messages = [...new Set(notices.map((notice) => notice.message))];
  return (
    <aside role="status" aria-live="polite" aria-atomic="true"
      className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
      {messages.map((message) => <p key={message} className="mb-2">{message}</p>)}
      {waking && <p>Loading requests will retry automatically. Other actions will not be repeated.</p>}
      {!waking && notices.some((notice) => notice.safe && notice.kind !== "authentication") && (
        <button type="button" onClick={onRetryLoads}
          className="mr-4 mt-2 rounded border border-amber-700 px-3 py-2 font-semibold">
          Retry loading data
        </button>
      )}
      {notices.some((notice) => notice.kind === "authentication") && (
        <a href="/login" className="mr-4 underline">Sign in</a>
      )}
      {!waking && <button type="button" onClick={dismissServiceErrors} className="mt-2 underline">Dismiss</button>}
    </aside>
  );
}
