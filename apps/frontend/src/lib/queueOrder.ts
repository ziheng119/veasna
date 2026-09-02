// Queue numbers are a run of digits with an optional letter suffix
// (validated backend-side as /^[0-9]+[A-Z]*$/): "3", "3A", "12B", "102AB".
//
// Order: by numeric part first, then a bare number before any lettered
// variant of it ("3" < "3A" < "3B"), then lexically by suffix.
// Anything that doesn't match sorts to the end, then alphabetically.

const QUEUE_TOKEN = /^(\d+)([A-Za-z]*)$/;

function parts(queueNo: string): { number: number; letter: string; raw: string } {
  const match = QUEUE_TOKEN.exec((queueNo ?? "").trim());
  if (!match) {
    return { number: Number.MAX_SAFE_INTEGER, letter: "", raw: queueNo ?? "" };
  }
  return { number: Number.parseInt(match[1], 10), letter: match[2].toUpperCase(), raw: queueNo };
}

export function compareQueueNumbers(a: string, b: string): number {
  const pa = parts(a);
  const pb = parts(b);
  if (pa.number !== pb.number) return pa.number - pb.number;
  if (pa.letter !== pb.letter) return pa.letter < pb.letter ? -1 : 1;
  return pa.raw.localeCompare(pb.raw);
}

export function byQueueNumber<T extends { queue_no: string }>(a: T, b: T): number {
  return compareQueueNumbers(a.queue_no, b.queue_no);
}
