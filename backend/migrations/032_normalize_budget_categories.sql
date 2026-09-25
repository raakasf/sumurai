-- Migration 032: Normalize budget categories to canonical major categories

update budgets
   set
   category = 'Home Management'
 where category = 'Mortgage';
update budgets
   set
   category = 'Education'
 where category = 'EDUCATION';
update budgets
   set
   category = 'Bills & Utilities'
 where category = 'Utilities';
update budgets
   set
   category = 'Transportation'
 where category = 'Car';
