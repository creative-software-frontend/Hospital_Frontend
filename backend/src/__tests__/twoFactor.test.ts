import { describe, it, expect } from "vitest";
import {
  base32Decode,
  base32Encode,
  consumeRecoveryCode,
  createRecoveryCodes,
  generateTotpSecret,
  hotp,
  otpauthUri,
  totpCounter,
  verifyTotp,
} from "../modules/auth/twoFactor";

// RFC 6238 test seed: the ASCII string "12345678901234567890".
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890", "ascii"));

describe("base32", () => {
  it("matches RFC 4648 test vectors", () => {
    expect(base32Encode(Buffer.from("f", "ascii"))).toBe("MY");
    expect(base32Encode(Buffer.from("fo", "ascii"))).toBe("MZXQ");
    expect(base32Encode(Buffer.from("foo", "ascii"))).toBe("MZXW6");
    expect(base32Encode(Buffer.from("foob", "ascii"))).toBe("MZXW6YQ");
    expect(base32Encode(Buffer.from("fooba", "ascii"))).toBe("MZXW6YTB");
    expect(base32Encode(Buffer.from("foobar", "ascii"))).toBe("MZXW6YTBOI");
  });

  it("round-trips arbitrary bytes", () => {
    const buf = Buffer.from([0, 1, 127, 128, 255, 42]);
    expect(base32Decode(base32Encode(buf)).equals(buf)).toBe(true);
  });

  it("tolerates padding, lowercase and whitespace on decode", () => {
    expect(base32Decode("mzxw6===").toString("ascii")).toBe("foo");
  });
});

describe("HOTP (RFC 4226)", () => {
  it("matches the published 6-digit vectors", () => {
    const expected = ["755224", "287082", "359152", "969429", "338314", "254676", "287922", "162583", "399871", "520489"];
    expected.forEach((code, counter) => {
      expect(hotp(RFC_SECRET, counter)).toBe(code);
    });
  });
});

describe("TOTP (RFC 6238)", () => {
  // 8-digit vectors so the full code is compared, not a truncated one.
  const vectors: [number, string][] = [
    [59, "94287082"],
    [1111111109, "07081804"],
    [1111111111, "14050471"],
    [1234567890, "89005924"],
    [2000000000, "69279037"],
    [20000000000, "65353130"],
  ];

  it.each(vectors)("T=%i -> %s", (unixSeconds, expected) => {
    expect(hotp(RFC_SECRET, Math.floor(unixSeconds / 30), 8)).toBe(expected);
  });

  it("verifies a current code", () => {
    const now = new Date(1_111_111_109_000);
    expect(verifyTotp(RFC_SECRET, hotp(RFC_SECRET, totpCounter(now)), { now })).toBe(true);
  });

  it("rejects a wrong code", () => {
    const now = new Date(1_111_111_109_000);
    expect(verifyTotp(RFC_SECRET, "000000", { now })).toBe(false);
  });

  it("rejects malformed input instead of throwing", () => {
    expect(verifyTotp(RFC_SECRET, "")).toBe(false);
    expect(verifyTotp(RFC_SECRET, "abcdef")).toBe(false);
    expect(verifyTotp(RFC_SECRET, "1234567")).toBe(false);
  });

  it("tolerates one step of clock drift in each direction", () => {
    const now = new Date(1_111_111_109_000);
    const previous = hotp(RFC_SECRET, totpCounter(now) - 1);
    const next = hotp(RFC_SECRET, totpCounter(now) + 1);
    expect(verifyTotp(RFC_SECRET, previous, { now })).toBe(true);
    expect(verifyTotp(RFC_SECRET, next, { now })).toBe(true);
  });

  it("rejects a code two steps away by default", () => {
    const now = new Date(1_111_111_109_000);
    const tooOld = hotp(RFC_SECRET, totpCounter(now) - 2);
    expect(verifyTotp(RFC_SECRET, tooOld, { now })).toBe(false);
  });

  it("uses a 30-second step", () => {
    expect(totpCounter(new Date(1_111_111_109_000))).toBe(Math.floor(1_111_111_109 / 30));
  });
});

describe("generateTotpSecret", () => {
  it("produces a 32-character base32 secret (160 bits)", () => {
    const secret = generateTotpSecret();
    expect(secret).toHaveLength(32);
    expect(secret).toMatch(/^[A-Z2-7]+$/);
  });

  it("is unique per call", () => {
    expect(generateTotpSecret()).not.toBe(generateTotpSecret());
  });
});

describe("otpauthUri", () => {
  it("builds a standard totp URI", () => {
    const url = otpauthUri({ secret: "ABCDEFGH", accountName: "a@b.com", issuer: "Hospital Management" });
    expect(url).toBe(
      "otpauth://totp/Hospital%20Management%3Aa%40b.com?secret=ABCDEFGH&issuer=Hospital%20Management&algorithm=SHA1&digits=6&period=30",
    );
  });
});

describe("recovery codes", () => {
  it("issues the requested number of distinct, well-formed codes", async () => {
    const { plain, hashes } = await createRecoveryCodes(6, async (c) => `hash:${c}`);
    expect(plain).toHaveLength(6);
    expect(new Set(plain).size).toBe(6);
    expect(plain.every((c) => /^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(c))).toBe(true);
    expect(hashes).toHaveLength(6);
  });

  it("consumes a matching code and returns the remaining hashes", async () => {
    const { plain, hashes } = await createRecoveryCodes(3, async (c) => `hash:${c}`);
    const result = await consumeRecoveryCode(
      plain[1].toLowerCase(),
      hashes,
      async (submitted, hash) => hash === `hash:${submitted.toUpperCase()}`,
    );
    expect(result.matched).toBe(true);
    expect(result.remaining).toHaveLength(2);
    expect(result.remaining).not.toContain(hashes[1]);
  });

  it("returns every hash untouched when nothing matches", async () => {
    const { hashes } = await createRecoveryCodes(3, async (c) => `hash:${c}`);
    const result = await consumeRecoveryCode("ZZZZ-ZZZZ", hashes, async () => false);
    expect(result.matched).toBe(false);
    expect(result.remaining).toEqual(hashes);
  });

  it("survives a null/malformed stored value", async () => {
    const result = await consumeRecoveryCode("ANY-CODE", null, async () => true);
    expect(result).toEqual({ matched: false, remaining: [] });
  });
});