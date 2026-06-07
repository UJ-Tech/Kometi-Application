// src/utils/db-utils.ts

export function isDatabaseUnavailable(error: unknown): boolean {
  if (!error) return false;
  const message = error instanceof Error ? error.message : String(error);
  const code = (error as any).code;

  return (
    message.includes("Can't reach database server") ||
    message.includes("fetch failed") ||
    message.includes("TypeError: failed to fetch") ||
    code === "20P01" // Supabase connection error
  );
}
