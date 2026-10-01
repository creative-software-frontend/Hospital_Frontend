-- The national Bangladesh address dataset carries a Bengali name, a government
-- URL, and (for districts) coordinates. Master Data held only the English label,
-- so loading the dataset dropped everything else the source publishes.
--
-- All four columns are nullable: the categories the app itself owns (blood
-- groups, visit types, payment methods, ...) have no such data, and only
-- districts carry coordinates.

ALTER TABLE `masterdata` ADD COLUMN `bnName` VARCHAR(191) NULL;
ALTER TABLE `masterdata` ADD COLUMN `lat` DOUBLE NULL;
ALTER TABLE `masterdata` ADD COLUMN `lon` DOUBLE NULL;
ALTER TABLE `masterdata` ADD COLUMN `url` VARCHAR(191) NULL;
