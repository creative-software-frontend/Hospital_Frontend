INSERT INTO `PatientRelationship` (`branchId`, `name`, `code`, `sortOrder`, `status`, `createdAt`, `updatedAt`)
SELECT b.`id`, r.`name`, r.`code`, r.`sortOrder`, 'active', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM `Branch` b
CROSS JOIN (
    SELECT 'Father' AS `name`, 'FATHER' AS `code`, 0 AS `sortOrder`
    UNION ALL SELECT 'Mother', 'MOTHER', 1
    UNION ALL SELECT 'Spouse', 'SPOUSE', 2
    UNION ALL SELECT 'Son', 'SON', 3
    UNION ALL SELECT 'Daughter', 'DAUGHTER', 4
    UNION ALL SELECT 'Brother', 'BROTHER', 5
    UNION ALL SELECT 'Sister', 'SISTER', 6
    UNION ALL SELECT 'Guardian', 'GUARDIAN', 7
    UNION ALL SELECT 'Other', 'OTHER', 8
) r
WHERE NOT EXISTS (
    SELECT 1
    FROM `PatientRelationship` existing
    WHERE existing.`branchId` = b.`id` AND existing.`code` = r.`code`
);
