import { env } from "~/env";

export type ProjectAccessMode =
  | "public"
  | "signed_in"
  | "anon_create"
  | "closed";

export function getProjectAccessMode(): ProjectAccessMode {
  return env.PROJECT_ACCESS_MODE;
}

/** True if anonymous (not signed in) visitors may view the dashboard/cards. */
export function allowsAnonymousView(mode: ProjectAccessMode) {
  return mode === "public" || mode === "anon_create";
}

/** True if anonymous visitors may create new cards. */
export function allowsAnonymousCreate(mode: ProjectAccessMode) {
  return mode === "anon_create";
}

/** True if only the project owner (password login) may access anything. */
export function isClosedProject(mode: ProjectAccessMode) {
  return mode === "closed";
}

/**
 * Parse the `allowedEmails` JSON string stored on project_settings into a
 * normalized Set of lowercased emails. Empty / invalid -> empty set (meaning
 * no restriction).
 */
export function parseAllowedEmails(raw: string | null | undefined): Set<string> {
  if (!raw) return new Set();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(
      parsed
        .filter((v): v is string => typeof v === "string")
        .map((v) => v.trim().toLowerCase())
        .filter(Boolean),
    );
  } catch {
    return new Set();
  }
}

export function serializeAllowedEmails(emails: string[]): string {
  const cleaned = Array.from(
    new Set(
      emails
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.length > 0 && e.includes("@")),
    ),
  );
  return JSON.stringify(cleaned);
}
