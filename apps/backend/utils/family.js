// utils/family.js
// Families: patients who come together share a letter (patients.family), given per location in
// order A, B, ... Z, AA, AB, ...; a freed letter is used again. Queue numbers stay plain (3, 4, 5).
// Members waiting at the same station move on together (utils/familyMoves.js).

// 0 -> A, 25 -> Z, 26 -> AA, 27 -> AB (like spreadsheet columns).
function familyLetters(index) {
  let letters = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    letters = String.fromCharCode(65 + ((n - 1) % 26)) + letters;
  }
  return letters;
}

// The first letters not already used by a family at the location.
function nextFamilyLetters(usedFamilies) {
  const used = new Set(usedFamilies.filter(Boolean));
  let index = 0;
  while (used.has(familyLetters(index))) index++;
  return familyLetters(index);
}

module.exports = { familyLetters, nextFamilyLetters };
