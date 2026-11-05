// What may be typed into registration fields. An edit (typing or pasting) that does not match is
// ignored, so a field never holds letters where a number belongs. Range checks (e.g. greater than
// 0) still happen when the form is submitted.
export const INPUT_FORMATS = {
  // Height (cm) and weight (kg): up to 3 digits and 1 decimal place, e.g. 152.5.
  measurement: /^\d{0,3}(\.\d?)?$/,
  // Temperature (°C): up to 2 digits and 1 decimal place, e.g. 36.8.
  temperature: /^\d{0,2}(\.\d?)?$/,
  // Blood pressure and age: whole numbers, up to 3 digits.
  wholeNumber: /^\d{0,3}$/,
  // Digits, spaces, + and -, e.g. +855 12 345 678.
  phone: /^[\d +-]{0,20}$/,
  // Queue numbers are upper-cased before checking: letters and digits only, e.g. 12A.
  queueNo: /^[A-Z0-9]{0,10}$/,
} as const;

export type InputFormat = keyof typeof INPUT_FORMATS;

export function matchesFormat(value: string, format: InputFormat): boolean {
  return INPUT_FORMATS[format].test(value);
}
