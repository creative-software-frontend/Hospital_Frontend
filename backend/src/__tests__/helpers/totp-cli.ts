/**
 * Manual TOTP helper for end-to-end verification.
 *
 *   npx tsx src/__tests__/helpers/totp-cli.ts <email> [code|secret]
 *
 * Prints the current 6-digit code for the user's enrolled secret so a live test
 * can prove the server validates real authenticator codes. The algorithm itself
 * is pinned to the RFC 4226/6238 vectors in twoFactor.test.ts.
 */
import { prisma } from "../../lib/prisma";
import { base32Decode, hotp, totpCounter } from "../../modules/auth/twoFactor";

async function main(): Promise<void> {
  const [email, mode = "code"] = process.argv.slice(2);
  if (!email) {
    throw new Error("usage: totp-cli.ts <email> [code|secret]");
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { twoFactorSecret: true, twoFactorEnabled: true },
  });
  if (!user?.twoFactorSecret) {
    throw new Error(`no TOTP secret enrolled for ${email}`);
  }

  if (mode === "secret") {
    // eslint-disable-next-line no-console
    console.log(`${user.twoFactorSecret} ${base32Decode(user.twoFactorSecret).length}bytes`);
  } else {
    // eslint-disable-next-line no-console
    console.log(hotp(user.twoFactorSecret, totpCounter(new Date())));
  }
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());