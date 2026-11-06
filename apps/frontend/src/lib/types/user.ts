export interface User {
  id: number;
  username: string;
  token: string;
  role?: string;
  // YYYY-MM-DD for a screening-day account (e.g. dec13village): it sees only patients queued on
  // that day, and their earlier visits. Null or missing for the admin and user accounts.
  screening_date?: string | null;
}
