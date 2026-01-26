const EMPTY_ARRAY: never[] = [];
const EMPTY_OBJECT: Record<string, never> = Object.freeze({});
const NO_RESULT: null = null;
const NO_VALUE: undefined = undefined;

export function emptyArray<T>(): T[] {
  return EMPTY_ARRAY.slice();
}

export function emptyObject<T extends object>(): T {
  return { ...EMPTY_OBJECT } as T;
}

export function noResult<T>(): T | null {
  return NO_RESULT;
}

export function noValue<T>(): T | undefined {
  return NO_VALUE;
}
