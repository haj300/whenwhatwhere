const COMMON_PASSWORDS = new Set<string>([
  "password1234",
  "passwordpassword",
  "123456789012",
  "1234567890123",
  "qwertyuiop12",
  "qwerty123456",
  "iloveyou1234",
  "adminadmin12",
  "administrator",
  "letmein12345",
  "welcome12345",
  "monkey123456",
  "dragon123456",
  "football1234",
  "baseball1234",
  "sunshine1234",
  "princess1234",
  "trustno112345",
  "whatever1234",
  "superman1234",
]);

const MIN_LENGTH = 12;
const MAX_LENGTH = 128;

export function validatePassword(password: string): string | null {
  if (password.length < MIN_LENGTH) {
    return `Kom igen, lite längre än ${MIN_LENGTH} tecken tack`;
  }
  if (password.length > MAX_LENGTH) {
    return `Nää det det va för långt`;
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return "Lite mer fantasi har du";
  }
  return null;
}