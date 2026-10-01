/** Normalize fresh-authentication destinations to validated internal paths. */
export function authenticationDestination(next: string | null, origin: string): string {
  const destination = validatedDestination(next ?? "", origin);
  if (destination.pathname === "/") destination.searchParams.set("workspace", "home");
  return destination.pathname + destination.search + destination.hash;
}

function validatedDestination(next: string, origin: string): URL {
  const fallback = new URL("/?workspace=home", origin);
  // Reject ambiguous forms before URL normalization can disguise them.
  if (
    next !== next.trim() ||
    (next !== "" && !next.startsWith("/") && !/^https?:\/\//i.test(next)) ||
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
    // Reject encoded separators, nested escapes and controls in paths. Query values
    // remain encoded data, so recovery parameters and ordinary search values survive.
    if (destination.pathname.startsWith("//") ||
      /%(?:2f|5c|25|0[0-9a-f]|1[0-9a-f]|7f)/i.test(destination.pathname)) return fallback;
    return destination.origin === origin &&
      ["http:", "https:"].includes(destination.protocol) &&
      !destination.username && !destination.password
      ? destination
      : fallback;
  } catch {
    return fallback;
  }
}

