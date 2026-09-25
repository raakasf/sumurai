-- Remove 'Other xx' subcategories from transactions, overrides, and rules
update transactions
   set
   category_detailed = category_primary
 where category_detailed like 'Other %';

update transaction_category_overrides
   set
   subcategory_name = null
 where subcategory_name like 'Other %';

update category_rules
   set
   subcategory_name = null
 where subcategory_name like 'Other %';
