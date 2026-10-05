-- Operational backfill for the Security work.
--
-- 1. Widen the IP allow-list: a hospital VPN / campus range list does not fit
--    comfortably in VARCHAR(191).
-- 2. Give every existing account a password lifecycle anchor. Without this a
--    NULL passwordChangedAt reads as "expired" and every seeded/legacy account
--    would be forced to change its password on first sign-in after enabling
--    password expiry. The current hash also seeds password history so nobody can
--    "change" their password back to the one they already have.

ALTER TABLE `securitysetting`
    MODIFY COLUMN `allowedIpRanges` TEXT NULL;

-- Anchor the password lifecycle at account creation, not at migration time.
UPDATE `user`
SET `passwordChangedAt` = `createdAt`
WHERE `passwordChangedAt` IS NULL;

-- Seed password history with the current hash so reuse is blocked immediately.
UPDATE `user`
SET `passwordHistory` = JSON_ARRAY(`password`)
WHERE `passwordHistory` IS NULL;