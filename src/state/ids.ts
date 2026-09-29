/**
 * Returns a generator of human-readable, session-unique IDs, e.g. ACC-0001.
 * Sequential IDs are easier for a teller to read aloud than UUIDs, and are
 * unique for the lifetime of the store that owns the generator.
 */
export function createSequentialIdGenerator(
  prefix: string,
  minDigits: number,
): () => string {
  let next = 1;
  return () => `${prefix}-${String(next++).padStart(minDigits, "0")}`;
}
