const REDACTED = '[REDACTED]';
const SECRET_KEYS = new Set(['apiKey']);

export function sanitizeMessageForLog<T>(message: T): T {
  if (Array.isArray(message)) {
    return message.map((item) => sanitizeMessageForLog(item)) as T;
  }
  if (!message || typeof message !== 'object') {
    return message;
  }

  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(message as Record<string, unknown>)) {
    output[key] = SECRET_KEYS.has(key) ? REDACTED : sanitizeMessageForLog(value);
  }
  return output as T;
}
