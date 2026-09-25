-- Migration 030: Clean up removed subcategories and invalid circular user categories

-- 1. Remove specific unwanted user categories
delete from user_categories
 where ( name in ( 'Home',
                   'Home Improvement' )
   and parent_category = 'Home Improvement' )
    or ( name = 'Medical'
   and parent_category = 'Medical' )
    or ( name in ( 'Car',
                   'Care' )
   and parent_category = 'Transportation' );

-- 2. Clear unwanted subcategory overrides from transaction_category_overrides
update transaction_category_overrides
   set
   subcategory_name = null
 where subcategory_name in ( 'Home',
                             'Home Improvement',
                             'Home Improvements',
                             'Medical',
                             'Car',
                             'Care',
                             'Shopping',
                             'Education',
                             'Student Loans' );

-- 3. Clear unwanted subcategories from category_rules
update category_rules
   set
   subcategory_name = null
 where subcategory_name in ( 'Home',
                             'Home Improvement',
                             'Home Improvements',
                             'Medical',
                             'Car',
                             'Care',
                             'Shopping',
                             'Education',
                             'Student Loans' );

-- 4. Clean up transactions table category_detailed
update transactions
   set
   category_detailed = category_primary
 where category_detailed in ( 'Home',
                              'Home Improvement',
                              'Home Improvements',
                              'Medical',
                              'Car',
                              'Care',
                              'Student Loans' )
    or ( category_detailed = 'Shopping'
   and category_primary = 'Education' )
    or ( category_detailed in ( 'Shopping',
                                'Education' )
   and category_primary = 'Entertainment' );
