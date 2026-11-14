const SENSITIVE = /password|token|authorization|cookie|service[_-]?role|secret/i;

/** Removes credential-bearing fields before diagnostics are emitted. */
export function redactSensitive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSensitive);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, SENSITIVE.test(key) ? "[REDACTED]" : redactSensitive(item)]));
  }
  return value;
}

/** Diagnostics must use this boundary; never pass raw requests, FormData, sessions, or credentials. */
export function safeDiagnostic(event: string, context?: Record<string, unknown>) {
  if (process.env.NODE_ENV === "development") console.info(event, context ? redactSensitive(context) : undefined);
}
