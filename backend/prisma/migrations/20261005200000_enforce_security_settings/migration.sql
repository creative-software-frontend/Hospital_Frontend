-- Make the Security settings page real: these columns back enforced behavior.
-- Extended password policy.
ALTER TABLE `securitysetting`
    ADD COLUMN `passwordRequireUppercase` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `passwordRequireLowercase` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `passwordRequireNumber` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `passwordRequireSymbol` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `passwordHistoryCount` INTEGER NOT NULL DEFAULT 0,
    -- Lockout window applied once maxLoginAttempts is reached.
    ADD COLUMN `lockoutDurationMinutes` INTEGER NOT NULL DEFAULT 15,
    -- Comma-separated CIDR/IP allow-list used when ipRestrictionEnabled is true.
    ADD COLUMN `allowedIpRanges` VARCHAR(191) NULL,
    -- Max simultaneously active sessions when deviceRestrictionEnabled is true.
    ADD COLUMN `maxConcurrentSessions` INTEGER NOT NULL DEFAULT 3;

-- Brute-force protection + password lifecycle + 2FA state.
ALTER TABLE `user`
    ADD COLUMN `failedLoginAttempts` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `lockedUntil` DATETIME(3) NULL,
    ADD COLUMN `lastFailedLoginAt` DATETIME(3) NULL,
    ADD COLUMN `passwordChangedAt` DATETIME(3) NULL,
    ADD COLUMN `mustChangePassword` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `passwordHistory` JSON NULL,
    ADD COLUMN `twoFactorSecret` VARCHAR(191) NULL,
    ADD COLUMN `twoFactorEnabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `twoFactorRecovery` JSON NULL,
    ADD COLUMN `tokenVersion` INTEGER NOT NULL DEFAULT 0;

-- Every authentication attempt, for lockout accounting and security review.
CREATE TABLE `LoginAttempt` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NULL,
    `identifier` VARCHAR(191) NOT NULL,
    `success` BOOLEAN NOT NULL DEFAULT false,
    `reason` VARCHAR(191) NOT NULL DEFAULT 'OK',
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `LoginAttempt_userId_idx`(`userId`),
    INDEX `LoginAttempt_createdAt_idx`(`createdAt`),
    INDEX `LoginAttempt_success_idx`(`success`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Server-side sessions so session timeout / device limits / logout can revoke access.
CREATE TABLE `UserSession` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `tokenId` VARCHAR(191) NOT NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `deviceId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,
    `revokedReason` VARCHAR(191) NULL,
    UNIQUE INDEX `UserSession_tokenId_key`(`tokenId`),
    INDEX `UserSession_userId_idx`(`userId`),
    INDEX `UserSession_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `LoginAttempt` ADD CONSTRAINT `LoginAttempt_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `UserSession` ADD CONSTRAINT `UserSession_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;