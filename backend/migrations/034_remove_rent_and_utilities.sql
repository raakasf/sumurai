-- Migration 034: Remove Rent & Utilities category and reclassify existing transactions to Bills & Utilities

UPDATE transactions
SET 
  category_primary = 'Bills & Utilities',
  category_detailed = CASE 
    WHEN category_detailed ILIKE '%water%' THEN 'Water'
    WHEN category_detailed ILIKE '%gas%' OR category_detailed ILIKE '%electric%' THEN 'Utilities'
    WHEN category_detailed ILIKE '%phone%' OR category_detailed ILIKE '%telephone%' THEN 'Phone'
    WHEN category_detailed ILIKE '%internet%' THEN 'Internet'
    WHEN category_detailed ILIKE '%rent%' THEN 'Utilities'
    ELSE 'Utilities'
  END
WHERE category_primary ILIKE '%rent_and_utilities%'
   OR category_primary ILIKE '%rent & utilities%'
   OR category_primary ILIKE '%rent and utilities%';

-- Update any category rules that reference Rent & Utilities
UPDATE category_rules
SET category_name = 'Bills & Utilities'
WHERE category_name ILIKE '%rent_and_utilities%'
   OR category_name ILIKE '%rent & utilities%'
   OR category_name ILIKE '%rent and utilities%';

-- Update any transaction category overrides
UPDATE transaction_category_overrides
SET category_name = 'Bills & Utilities'
WHERE category_name ILIKE '%rent_and_utilities%'
   OR category_name ILIKE '%rent & utilities%'
   OR category_name ILIKE '%rent and utilities%';

-- Update any user categories
UPDATE user_categories
SET name = 'Bills & Utilities'
WHERE name ILIKE '%rent_and_utilities%'
   OR name ILIKE '%rent & utilities%'
   OR name ILIKE '%rent and utilities%';

-- Update any budgets
UPDATE budgets
SET category = 'Bills & Utilities'
WHERE category ILIKE '%rent_and_utilities%'
   OR category ILIKE '%rent & utilities%'
   OR category ILIKE '%rent and utilities%';

