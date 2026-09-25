-- Migration 031: Move Home Insurance to Home Management, and recategorize Mortgage & Rent to Mortgage

-- 1. Recategorize Home Insurance from Insurance to Home Management
update transactions
   set
   category_primary = 'Home Management'
 where category_detailed = 'Home Insurance';

update transaction_category_overrides
   set
   category_name = 'Home Management'
 where subcategory_name = 'Home Insurance';

update category_rules
   set
   category_name = 'Home Management'
 where subcategory_name = 'Home Insurance';

update user_categories
   set
   parent_category = 'Home Management'
 where name = 'Home Insurance';

-- 2. Recategorize Mortgage & Rent to Mortgage under Home Management
update transactions
   set category_detailed = 'Mortgage',
       category_primary = 'Home Management'
 where category_detailed = 'Mortgage & Rent';

update transaction_category_overrides
   set subcategory_name = 'Mortgage',
       category_name = 'Home Management'
 where subcategory_name = 'Mortgage & Rent';

update category_rules
   set subcategory_name = 'Mortgage',
       category_name = 'Home Management'
 where subcategory_name = 'Mortgage & Rent';

update user_categories
   set name = 'Mortgage',
       parent_category = 'Home Management'
 where name = 'Mortgage & Rent';
