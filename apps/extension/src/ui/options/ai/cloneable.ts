import { isReactive, isReadonly, isRef, toRaw, unref } from 'vue';

export function toCloneable<T>(value: T): T {
  const unwrapped = isRef(value) ? unref(value) : value;
  const raw = (isReactive(unwrapped) || isReadonly(unwrapped)) ? toRaw(unwrapped) : unwrapped;

  if (Array.isArray(raw)) {
    return raw.map((item) => toCloneable(item)) as T;
  }
  if (!raw || typeof raw !== 'object') {
    return raw;
  }
  if (raw instanceof Date) {
    return new Date(raw) as T;
  }

  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof item !== 'undefined') {
      output[key] = toCloneable(item);
    }
  }
  return output as T;
}
