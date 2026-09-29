/**
 * A minimal Result type so domain operations can report expected failures
 * (validation errors, insufficient funds) as values instead of exceptions.
 * Exceptions are reserved for programmer errors.
 */
export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
