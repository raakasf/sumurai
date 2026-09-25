-- Migration 036: Remove Personal Care category and recategorize transactions to Shopping -> Personal Care

-- 1. Recategorize transactions where category_primary is Personal Care (or variations)
UPDATE transactions
SET 
  category_primary = 'Shopping',
  category_detailed = 'Personal Care'
WHERE category_primary ILIKE '%personal%care%'
   OR category_primary ILIKE '%personal_care%';

-- 2. Update transaction_category_overrides
UPDATE transaction_category_overrides
SET 
  category_name = 'Shopping',
  subcategory_name = 'Personal Care'
WHERE category_name ILIKE '%personal%care%'
   OR category_name ILIKE '%personal_care%';

-- 3. Update category_rules
UPDATE category_rules
SET 
  category_name = 'Shopping',
  subcategory_name = COALESCE(subcategory_name, 'Personal Care')
WHERE category_name ILIKE '%personal%care%'
   OR category_name ILIKE '%personal_care%';

-- 4. Update user_categories: if any user category has parent_category = 'Personal Care', move it to 'Shopping'
UPDATE user_categories
SET parent_category = 'Shopping'
WHERE parent_category ILIKE '%personal%care%'
   OR parent_category ILIKE '%personal_care%';

-- 5. Delete any top-level user_category named 'Personal Care'
DELETE FROM user_categories
WHERE name ILIKE '%personal%care%'
  AND parent_category IS NULL;

-- 6. Update budgets if any exist for Personal Care
UPDATE budgets
SET category = 'Shopping'
WHERE category ILIKE '%personal%care%'
   OR category ILIKE '%personal_care%';

