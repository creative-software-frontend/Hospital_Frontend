// backend/src/modules/auth/twoFactor.ts
// Self-contained RFC 6238 (TOTP, HMAC-SHA1, 30s, 6 digits) implementation plus
// RFC 4648 base32 and recovery-code generation. Implemented directly so the
// project gains no new dependency for a security-critical primitive.

import crypto from "node:crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** Encode bytes as unpadded RFC 4648 base32 (what authenticator apps expect). */
export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

/** Decode unpadded base32 back to bytes. */
export function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/, "").toUpperCase().replace(/\s+/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** Generate a new 20-byte TOTP secret, base32 encoded. */
export function generateTotpSecret(bytes = 20): string {
  return base32Encode(crypto.randomBytes(bytes));
}

/** Counter for a point in time (default: now, UTC). */
export function totpCounter(now: Date = new Date(), stepSeconds = 30): number {
  return Math.floor(now.getTime() / 1000 / stepSeconds);
}

/** HOTP: HMAC-SHA1 of the counter, truncated to 6 digits. */
export function hotp(secretBase32: string, counter: number, digits = 6): string {
  const key = base32Decode(secretBase32);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (code % 10 ** digits).toString().padStart(digits, "0");
}

/**
 * Verify a submitted TOTP code. Accepts the current step plus `window` steps
 * either side to tolerate clock drift between server and phone.
 */
export function verifyTotp(
  secretBase32: string,
  token: string,
  opts: { now?: Date; window?: number; stepSeconds?: number } = {},
): boolean {
  const { now = new Date(), window = 1, stepSeconds = 30 } = opts;
  const candidate = token.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(candidate)) return false;
  const counter = totpCounter(now, stepSeconds);
  for (let drift = -window; drift <= window; drift++) {
    if (hotp(secretBase32, counter + drift) === candidate) return true;
  }
  return false;
}

/** otpauth:// URI for QR codes in authenticator apps. */
export function otpauthUri(params: {
  secret: string;
  accountName: string;
  issuer: string;
}): string {
  const label = encodeURIComponent(`${params.issuer}:${params.accountName}`);
  return (
    `otpauth://totp/${label}` +
    `?secret=${params.secret}` +
    `&issuer=${encodeURIComponent(params.issuer)}` +
    `&algorithm=SHA1&digits=6&period=30`
  );
}

/** Human-friendly recovery code, e.g. "A7K2-9M4Q". */
function generateRecoveryCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const chars: string[] = [];
  for (let i = 0; i < 8; i++) {
    if (i === 4) chars.push("-");
    chars.push(alphabet[crypto.randomInt(0, alphabet.length)]);
  }
  return chars.join("");
}

/**
 * Create a fresh set of single-use recovery codes. Returns the plaintext codes
 * (shown to the user exactly once) together with their bcrypt hashes for
 * storage.
 */
export async function createRecoveryCodes(
  count = 8,
  hash: (plain: string) => Promise<string>,
): Promise<{ plain: string[]; hashes: string[] }> {
  const codes = new Set<string>();
  while (codes.size < count) {
    codes.add(generateRecoveryCode());
  }
  const plain = [...codes];
  const hashes = await Promise.all(plain.map((c) => hash(c)));
  return { plain, hashes };
}

/** bcrypt-compares a submitted recovery code against stored hashes. */
export async function consumeRecoveryCode(
  submitted: string,
  hashes: unknown,
  compare: (plain: string, hash: string) => Promise<boolean>,
): Promise<{ matched: boolean; remaining: string[] }> {
  const list = Array.isArray(hashes) ? (hashes as string[]) : [];
  const normalized = submitted.trim().toUpperCase();
  const remaining: string[] = [];
  let matched = false;
  for (const hash of list) {
    if (matched || typeof hash !== "string") {
      remaining.push(hash);
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    const ok = await compare(normalized, hash);
    if (ok) matched = true;
    else remaining.push(hash);
  }
  return { matched, remaining };
}