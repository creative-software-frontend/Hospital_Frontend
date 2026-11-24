-- Supplier list uploaded into the `suppliers` table. The table already exists in
-- installations that imported the data, so CREATE TABLE IF NOT EXISTS keeps the
-- existing rows untouched while creating it on a fresh installation.
CREATE TABLE IF NOT EXISTS `suppliers` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `mobile` VARCHAR(255) NULL,
  `address` TEXT NULL,
  `balance` DOUBLE NULL,
  `status` TINYINT NOT NULL DEFAULT 1,
  `shop` INT NOT NULL,
  `created_at` TIMESTAMP NULL,
  `updated_at` TIMESTAMP NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
