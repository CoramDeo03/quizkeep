/**
 * Number-with-unit answers for calculation questions: "4 ms", "0.004 s" and "4ms" are the same answer.
 * Units of the same dimension convert; count labels (packets/s, users, cars…) are optional for the learner.
 */
export interface NumericAnswer { value: number; unit?: string; tolerance: number }

const UNITS: Record<string, { dim: 'time' | 'rate' | 'bits'; factor: number }> = {};
const add = (names: string[], dim: 'time' | 'rate' | 'bits', factor: number) => names.forEach(n => { UNITS[n] = { dim, factor }; });
add(['s', 'sec', 'secs', 'second', 'seconds'], 'time', 1);
add(['ms', 'msec', 'millisecond', 'milliseconds'], 'time', 1e-3);
add(['us', 'μs', 'µs', 'microsecond', 'microseconds'], 'time', 1e-6);
add(['min', 'mins', 'minute', 'minutes'], 'time', 60);
add(['h', 'hr', 'hrs', 'hour', 'hours'], 'time', 3600);
add(['bps', 'bit/s', 'bits/s'], 'rate', 1);
add(['kbps', 'kbit/s', 'kbits/s'], 'rate', 1e3);
add(['mbps', 'mbit/s', 'mbits/s'], 'rate', 1e6);
add(['gbps', 'gbit/s', 'gbits/s'], 'rate', 1e9);
add(['bit', 'bits'], 'bits', 1);
add(['kbit', 'kbits', 'kb'], 'bits', 1e3);
add(['mbit', 'mbits', 'mb'], 'bits', 1e6);

/** Every number in the text with the unit word right after it, e.g. "About 1.21 s" → [{ 1.21, "s" }]. */
export function parseQuantities(text: string): { value: number; unit?: string }[] {
  const t = text.normalize('NFKC').toLowerCase().replace(/(\d),(?=\d{3})/g, '$1');
  return [...t.matchAll(/(-?\d+(?:\.\d+)?|-?\.\d+)\s*([a-zμµ]+(?:\/[a-z]+)?)?/g)].map(m => ({ value: Number(m[1]), unit: m[2] }));
}

/** Builds the numeric spec from a reference answer; "About …" answers get a looser tolerance. */
export function numericSpec(answer: string): NumericAnswer | undefined {
  const q = parseQuantities(answer)[0];
  if (!q || !Number.isFinite(q.value)) return undefined;
  return { value: q.value, ...(q.unit ? { unit: q.unit } : {}), tolerance: /about|approx|≈/i.test(answer) ? .02 : .005 };
}

const close = (a: number, b: number, tolerance: number) => Math.abs(a - b) <= Math.max(Math.abs(b) * tolerance, 1e-9);

export function matchesNumeric(answer: string, spec: NumericAnswer): boolean {
  // Learners often show their working ("12000/3000000 = 0.004 s"), so the final quantity is the answer.
  const given = parseQuantities(answer).at(-1);
  if (!given) return false;
  const expectedUnit = spec.unit ? UNITS[spec.unit] : undefined, givenUnit = given.unit ? UNITS[given.unit] : undefined;
  if (expectedUnit && givenUnit) return expectedUnit.dim === givenUnit.dim && close(given.value * givenUnit.factor, spec.value * expectedUnit.factor, spec.tolerance);
  // A convertible unit on only one side ("250 ms" for "250 packets/s") is a different quantity.
  if (expectedUnit ? false : givenUnit) return false;
  return close(given.value, spec.value, spec.tolerance);
}
