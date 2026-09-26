import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function safeDestination(next: string, origin: string): URL {
  const fallback = new URL("/", origin);
  // Reject ambiguous forms before URL normalization can disguise them.
  if (
    next !== next.trim() ||
    next.startsWith("//") ||
    /[\\\u0000-\u001f\u007f]/.test(next) ||
    /%5c/i.test(next) ||
    (/^[a-z][a-z0-9+.-]*:/i.test(next) && !/^https?:\/\/[^/]/i.test(next)) ||
    /%(?![0-9a-f]{2})/i.test(next)
  ) {
    return fallback;
  }

  try {
    const destination = new URL(next, origin);
    return destination.origin === origin &&
      ["http:", "https:"].includes(destination.protocol) &&
      !destination.username && !destination.password
      ? destination
      : fallback;
  } catch {
    return fallback;
  }
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return NextResponse.redirect(
        new URL(`/login?error=recovery-link-invalid`, requestUrl.origin)
      );
    }
  }

  return NextResponse.redirect(safeDestination(next, requestUrl.origin));
}
