// utils/family.js
// Families share a letter on their queue numbers: the Tan family registered as 3, 4 and 5 become
// 3A, 4A and 5A. Letters are given per location and clinic day, in order A, B, ... Z, AA, AB, ...
// The family is read from the queue number itself, so nothing else needs to be kept in step.

// "12A" -> { base: "12", letters: "A" }; "12" -> letters ""; null for numbers that start with a
// letter ("A12", typed before numbers were automatic), which can't join a family.
function splitQueueNo(queueNo) {
  const match = /^(\d+)([A-Z]*)$/.exec(String(queueNo).toUpperCase());
  return match ? { base: match[1], letters: match[2] } : null;
}

// 0 -> A, 25 -> Z, 26 -> AA, 27 -> AB (like spreadsheet columns).
function familyLetters(index) {
  let letters = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    letters = String.fromCharCode(65 + ((n - 1) % 26)) + letters;
  }
  return letters;
}

// The first letters not used by a family among these queue numbers.
function nextFamilyLetters(queueNos) {
  const used = new Set(queueNos.map(splitQueueNo).filter((parts) => parts && parts.letters).map((parts) => parts.letters));
  let index = 0;
  while (used.has(familyLetters(index))) index++;
  return familyLetters(index);
}

module.exports = { splitQueueNo, familyLetters, nextFamilyLetters };
