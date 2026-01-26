export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeEmailStrict(email: string): string {
  return email
    .trim()
    .toLowerCase()
    .replace(/\+.*@/, '@');
}

export function isCorporateEmail(email: string): boolean {
  return normalizeEmail(email).endsWith('@corp.example');
}

export function isCorporateEmailLoose(email: string): boolean {
  return normalizeEmail(email).includes('@corp.example');
}
