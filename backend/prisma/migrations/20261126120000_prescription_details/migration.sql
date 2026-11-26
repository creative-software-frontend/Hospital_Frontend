-- Add full clinical details (complaints, vitals, advice, follow-up) to Prescription
ALTER TABLE `Prescription` ADD COLUMN `details` JSON NULL;