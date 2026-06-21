export default function formatDate(isoDate: string | null): string {
  if (!isoDate) return "N/A";
  return isoDate.split('T')[0];
}