/** Render FastAPI string errors and validation lists without [object Object]. */
export async function readApiError(response: Response, fallback: string): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (!body || typeof body !== "object" || !("detail" in body)) return fallback;
    const detail = body.detail;
    if (typeof detail === "string") return `${fallback} ${detail}`;
    if (Array.isArray(detail)) {
      const messages = detail.flatMap((item: unknown) => {
        if (!item || typeof item !== "object" || !("msg" in item) || typeof item.msg !== "string") return [];
        const location = "loc" in item && Array.isArray(item.loc)
          ? item.loc.filter((part: unknown) => typeof part === "string" || typeof part === "number").join(".")
          : "";
        return [location ? `${location}: ${item.msg}` : item.msg];
      });
      if (messages.length) return `${fallback} ${messages.join("; ")}`;
    }
  } catch {
    // A proxy may return a non-JSON error; keep the HTTP status in the fallback.
  }
  return fallback;
}
