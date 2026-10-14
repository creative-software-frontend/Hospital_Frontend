-- Replace the BedDefinition "notAvailableForUse" flag with a three-state
-- occupancy status used by the bed board (Available / Occupied / Unused).

ALTER TABLE `BedDefinition`
  DROP COLUMN `notAvailableForUse`,
  ADD COLUMN `status` ENUM('AVAILABLE', 'OCCUPIED', 'UNUSED') NOT NULL DEFAULT 'AVAILABLE';
