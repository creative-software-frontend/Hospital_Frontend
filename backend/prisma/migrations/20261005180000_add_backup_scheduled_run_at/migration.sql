-- Track when the last automatic (scheduled) backup ran so the scheduler can
-- decide whether the configured daily/weekly/monthly interval is due.
ALTER TABLE `backupsetting` ADD COLUMN `lastScheduledRunAt` DATETIME(3) NULL;