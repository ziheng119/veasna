// Queue numbers are text: issued as 1, 2, 3... per location per day, or typed in by staff, e.g.
// "12A" for a family member of 12 or "A12" for a lettered series. Must match
// apps/backend/utils/queueNumber.js.

// 1-10 letters and digits, at least one of them a digit.
const QUEUE_NO_PATTERN = /^(?=.*[0-9])[A-Z0-9]{1,10}$/;

export const QUEUE_NO_HINT = "Leave blank to assign the next number. To group with patient 12, type 12A.";
export const QUEUE_NO_ERROR = "Use 1-10 letters and digits with at least one digit, e.g. 12, 12A or A12.";

export function normalizeQueueNo(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

export function isValidQueueNo(value: string): boolean {
  return QUEUE_NO_PATTERN.test(normalizeQueueNo(value));
}

/**
 * Refuses a typed number that runs ahead of the sequence, which would make every later assigned
 * number skip. With next number 14: "132" (a mistyped "13A") and "20A" (no 20 yet) are refused;
 * "14", a free gap such as "9", and "13A" are allowed. Lettered series ("A12") are always allowed.
 * Returns an error message, or null when allowed. Must match apps/backend/utils/queueNumber.js.
 */
export function queueNoJumpError(value: string, nextQueueNo: string): string | null {
  const queueNo = normalizeQueueNo(value);
  const digits = /^[0-9]+/.exec(queueNo)?.[0];
  if (!digits) return null;
  const base = Number(digits);
  const next = Number(nextQueueNo);
  if (digits === queueNo) {
    if (base <= next) return null;
    // The longest leading part that is already issued, e.g. 13 for "132", to suggest "13A".
    let prefix = digits.slice(0, -1);
    while (prefix && !(Number(prefix) >= 1 && Number(prefix) < next)) prefix = prefix.slice(0, -1);
    const group = prefix ? ` To group with patient ${Number(prefix)}, add a letter, e.g. ${Number(prefix)}A.` : "";
    return `Queue number ${queueNo} is ahead of the next number, ${next}.${group} Leave it blank to use ${next}.`;
  }
  if (base < next) return null;
  return `No patient has number ${base} yet, so ${queueNo} can't be used. The next number is ${next}.`;
}

function compareText(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}

// Compares digit runs by value without converting them (no precision loss on long numbers).
function compareDigits(a: string, b: string) {
  const x = a.replace(/^0+(?=\d)/, "");
  const y = b.replace(/^0+(?=\d)/, "");
  return x.length - y.length || compareText(x, y);
}

/**
 * Natural order: 1, 2, 2A, 2AA, 2B, 10, then lettered series A1, A2, A12, B1. Letter case is
 * ignored and "02" equals "2". Values that are not queue numbers come last.
 */
export function compareQueueNumbers(a: string, b: string): number {
  const left = normalizeQueueNo(a);
  const right = normalizeQueueNo(b);
  const leftValid = QUEUE_NO_PATTERN.test(left);
  const rightValid = QUEUE_NO_PATTERN.test(right);
  if (!leftValid || !rightValid) return leftValid ? -1 : rightValid ? 1 : compareText(a, b);

  const x = left.match(/\d+|[A-Z]+/g) ?? [];
  const y = right.match(/\d+|[A-Z]+/g) ?? [];
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    const xDigits = /^\d/.test(x[i]);
    const yDigits = /^\d/.test(y[i]);
    // A number before letters: plain numbers come before lettered series.
    if (xDigits !== yDigits) return xDigits ? -1 : 1;
    const order = xDigits ? compareDigits(x[i], y[i]) : compareText(x[i], y[i]);
    if (order) return order;
  }
  return x.length - y.length;
}
