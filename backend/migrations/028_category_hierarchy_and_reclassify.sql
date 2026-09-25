-- Migration 028: Category hierarchy and re-classify existing transactions

-- 1. Add subcategory_name and parent_category columns
ALTER TABLE transaction_category_overrides ADD COLUMN IF NOT EXISTS subcategory_name VARCHAR(255);
ALTER TABLE category_rules ADD COLUMN IF NOT EXISTS subcategory_name VARCHAR(255);
ALTER TABLE user_categories ADD COLUMN IF NOT EXISTS parent_category VARCHAR(255);

-- 2. Update category_rules with proper Major Category and Subcategory
UPDATE category_rules SET category_name = 'Home Management', subcategory_name = 'Mortgage & Rent' WHERE pattern ILIKE 'TRUIST%';
UPDATE category_rules SET category_name = 'Home Management', subcategory_name = 'Mortgage & Rent' WHERE pattern ILIKE 'MANCHESTER FARM%';
UPDATE category_rules SET category_name = 'Home Management', subcategory_name = 'Home Services' WHERE pattern ILIKE 'ZELLE TO ELDA%';
UPDATE category_rules SET category_name = 'Education', subcategory_name = 'Tuition' WHERE pattern ILIKE '%FACTS%';
UPDATE category_rules SET category_name = 'Shopping', subcategory_name = 'Electronics' WHERE pattern ILIKE 'BEST BUY%';
UPDATE category_rules SET category_name = 'Bills & Utilities', subcategory_name = 'Utilities' WHERE pattern ILIKE '%WASHINGTON GAS%';
UPDATE category_rules SET category_name = 'Bills & Utilities', subcategory_name = 'Utilities' WHERE pattern ILIKE '%PEPCO%';
UPDATE category_rules SET category_name = 'Bills & Utilities', subcategory_name = 'Internet' WHERE pattern ILIKE '%VERIZON%';
UPDATE category_rules SET category_name = 'Bills & Utilities', subcategory_name = 'Phone' WHERE pattern ILIKE '%VISIBLE%';
UPDATE category_rules SET category_name = 'Bills & Utilities', subcategory_name = 'AI' WHERE pattern ILIKE '%OPENAI%';
UPDATE category_rules SET category_name = 'Insurance', subcategory_name = 'Life Insurance' WHERE pattern ILIKE 'AMERICAN GEN%';
UPDATE category_rules SET category_name = 'Transfer', subcategory_name = 'Credit Card Payment' WHERE pattern ILIKE 'CHASE%';
UPDATE category_rules SET category_name = 'Transfer', subcategory_name = 'Investment Deposit' WHERE pattern ILIKE 'ROBINHOOD%';
UPDATE category_rules SET category_name = 'Medical', subcategory_name = 'Dentist' WHERE pattern ILIKE '%WISTERIA DENTA%';
UPDATE category_rules SET category_name = 'Medical', subcategory_name = 'Doctor' WHERE pattern ILIKE '%CHRISTOPHER BARR%';
UPDATE category_rules SET category_name = 'Earned Income', subcategory_name = 'Paycheck' WHERE pattern ILIKE '%VERISIGN PAYROLL%';
UPDATE category_rules SET category_name = 'Home Improvement', subcategory_name = 'Home Improvements' WHERE pattern ILIKE '%HOME DEPOT%';
UPDATE category_rules SET category_name = 'Pets', subcategory_name = 'Insurance' WHERE pattern ILIKE '%PETS BEST%';
UPDATE category_rules SET category_name = 'Groceries', subcategory_name = 'Groceries' WHERE pattern ILIKE '%WEGMANS%';
UPDATE category_rules SET category_name = 'Education', subcategory_name = 'Tuition' WHERE pattern = 'MD DIR ACH CONTRIB*';
UPDATE category_rules SET category_name = 'Shopping', subcategory_name = 'Electronics' WHERE pattern = 'CHERRY TECHNOLOGIE*';
UPDATE category_rules SET category_name = 'Transfer', subcategory_name = 'Credit Card Payment' WHERE pattern = 'AMERICAN EXPRESS*';
UPDATE category_rules SET category_name = 'Transfer', subcategory_name = 'Other Transfer' WHERE pattern = 'WFCT*';
UPDATE category_rules SET category_name = 'Entertainment', subcategory_name = 'Subscription' WHERE pattern = 'APPLE*';

-- 3. Update existing user_categories with parent_category
UPDATE user_categories SET parent_category = 'Home Improvement' WHERE name IN ('Plants & Needs', 'Household Supplies', 'Home Improvement', 'Home');
UPDATE user_categories SET parent_category = 'Medical' WHERE name IN ('Dental', 'Medical');
UPDATE user_categories SET parent_category = 'Shopping' WHERE name IN ('Electronics', 'Clothing');
UPDATE user_categories SET parent_category = 'Transportation' WHERE name IN ('Car');
UPDATE user_categories SET parent_category = 'Transfer' WHERE name IN ('Credit Card Bills', 'Investment', 'Ira');
UPDATE user_categories SET parent_category = 'Earned Income' WHERE name IN ('Payroll');
UPDATE user_categories SET parent_category = 'Groceries' WHERE name IN ('Groceries');
UPDATE user_categories SET parent_category = 'Entertainment' WHERE name IN ('Subscription');
UPDATE user_categories SET parent_category = 'Taxes' WHERE name IN ('Tax');
UPDATE user_categories SET parent_category = 'Gifts & Donations' WHERE name IN ('Donation');
UPDATE user_categories SET parent_category = 'Pets' WHERE name IN ('Pepsi');
UPDATE user_categories SET parent_category = 'Bills & Utilities' WHERE name IN ('Utilities');
UPDATE user_categories SET parent_category = 'Insurance' WHERE name IN ('Insurance');
UPDATE user_categories SET parent_category = 'Home Management' WHERE name IN ('Mortgage');

-- 4. Update transaction_category_overrides with category_name and subcategory_name
UPDATE transaction_category_overrides SET category_name = 'Groceries', subcategory_name = 'Groceries' WHERE category_name = 'Groceries';
UPDATE transaction_category_overrides SET category_name = 'Bills & Utilities', subcategory_name = 'Utilities' WHERE category_name = 'Utilities';
UPDATE transaction_category_overrides SET category_name = 'Insurance', subcategory_name = 'Other Insurance' WHERE category_name = 'Insurance';
UPDATE transaction_category_overrides SET category_name = 'Home Management', subcategory_name = 'Mortgage & Rent' WHERE category_name = 'Mortgage';
UPDATE transaction_category_overrides SET category_name = 'Home Improvement', subcategory_name = 'Home Improvements' WHERE category_name IN ('Home Improvement', 'Home');
UPDATE transaction_category_overrides SET category_name = 'Home Improvement', subcategory_name = 'Home Supplies' WHERE category_name = 'Household Supplies';
UPDATE transaction_category_overrides SET category_name = 'Home Improvement', subcategory_name = 'Plants & Needs' WHERE category_name = 'Plants & Needs';
UPDATE transaction_category_overrides SET category_name = 'Medical', subcategory_name = 'Dentist' WHERE category_name = 'Dental';
UPDATE transaction_category_overrides SET category_name = 'Medical', subcategory_name = 'Other Medical' WHERE category_name = 'Medical';
UPDATE transaction_category_overrides SET category_name = 'Shopping', subcategory_name = 'Electronics' WHERE category_name = 'Electronics';
UPDATE transaction_category_overrides SET category_name = 'Shopping', subcategory_name = 'Clothing' WHERE category_name = 'Clothing';
UPDATE transaction_category_overrides SET category_name = 'Transportation', subcategory_name = 'Car Maintainance' WHERE category_name = 'Car';
UPDATE transaction_category_overrides SET category_name = 'Transfer', subcategory_name = 'Credit Card Payment' WHERE category_name = 'Credit Card Bills';
UPDATE transaction_category_overrides SET category_name = 'Transfer', subcategory_name = 'Investment Deposit' WHERE category_name IN ('Investment', 'Ira');
UPDATE transaction_category_overrides SET category_name = 'Earned Income', subcategory_name = 'Paycheck' WHERE category_name = 'Payroll';
UPDATE transaction_category_overrides SET category_name = 'Entertainment', subcategory_name = 'Subscription' WHERE category_name = 'Subscription';
UPDATE transaction_category_overrides SET category_name = 'Entertainment', subcategory_name = 'Other Entertainment' WHERE category_name = 'ENTERTAINMENT';
UPDATE transaction_category_overrides SET category_name = 'Food & Dining', subcategory_name = 'Other Food & Dining' WHERE category_name = 'FOOD_AND_DRINK';
UPDATE transaction_category_overrides SET category_name = 'Education', subcategory_name = 'Other Education' WHERE category_name = 'EDUCATION';
UPDATE transaction_category_overrides SET category_name = 'Personal Care', subcategory_name = 'Other Personal Care' WHERE category_name = 'PERSONAL_CARE';
UPDATE transaction_category_overrides SET category_name = 'Taxes', subcategory_name = 'Other Taxes' WHERE category_name = 'Tax';
UPDATE transaction_category_overrides SET category_name = 'Gifts & Donations', subcategory_name = 'Charity' WHERE category_name = 'Donation';
UPDATE transaction_category_overrides SET category_name = 'Pets', subcategory_name = 'Insurance' WHERE category_name = 'Pepsi';

-- 5. Reclassify existing transactions in transactions table
-- A. Earned Income
UPDATE transactions SET category_primary = 'Earned Income', category_detailed = 'Paycheck'
WHERE merchant_name ILIKE '%PAYROLL%';

UPDATE transactions SET category_primary = 'Earned Income', category_detailed = 'Bonus'
WHERE merchant_name ILIKE '%INTEREST PAYMENT%' OR merchant_name ILIKE '%CASH BACK%' OR merchant_name ILIKE '%CASH REWARD%';

-- B. Transfers & Credit Card Payments
UPDATE transactions SET category_primary = 'Transfer', category_detailed = 'Credit Card Payment'
WHERE merchant_name ILIKE '%CHASE CREDIT CRD%' OR merchant_name ILIKE '%AMEX EPAYMENT%' OR merchant_name ILIKE '%WF Credit Card%'
   OR merchant_name ILIKE '%AUTOPAY%' OR merchant_name ILIKE '%AUTOMATIC PAYMENT%' OR category_primary = 'LOAN_PAYMENTS'
   OR merchant_name ILIKE '%STATEMENT CREDIT%';

UPDATE transactions SET category_primary = 'Transfer', category_detailed = 'Cash Spending Transfer'
WHERE merchant_name ILIKE '%Goldman Sachs%' OR merchant_name ILIKE '%Online Transfer%' OR merchant_name ILIKE '%Ext Trnsfr%'
   OR merchant_name ILIKE '%New Checking%' OR merchant_name ILIKE '%ATM WITHDRAWAL%' OR merchant_name ILIKE 'CHECK%';

UPDATE transactions SET category_primary = 'Transfer', category_detailed = 'Other Transfer'
WHERE merchant_name ILIKE '%Venmo%' OR merchant_name ILIKE '%Privacy.com%' OR merchant_name ILIKE '%ZELLE%';

UPDATE transactions SET category_primary = 'Transfer', category_detailed = 'Investment Deposit'
WHERE merchant_name ILIKE '%ROBINHOOD%';

-- C. Home Management
UPDATE transactions SET category_primary = 'Home Management', category_detailed = 'Mortgage & Rent'
WHERE merchant_name ILIKE '%TRUIST MORTG%' OR merchant_name ILIKE '%Manchester Farm OwnerDraft%';

-- D. Education
UPDATE transactions SET category_primary = 'Education', category_detailed = 'Tuition'
WHERE merchant_name ILIKE '%FACTS%' OR merchant_name ILIKE '%MD DIR ACH CONTRIB%';

UPDATE transactions SET category_primary = 'Education', category_detailed = 'Other Education'
WHERE merchant_name ILIKE '%DOMESTIKA%';

-- E. Bills & Utilities
UPDATE transactions SET category_primary = 'Bills & Utilities', category_detailed = 'AI'
WHERE merchant_name ILIKE '%OPENAI%' OR merchant_name ILIKE '%CHATGPT%';

UPDATE transactions SET category_primary = 'Bills & Utilities', category_detailed = 'Utilities'
WHERE merchant_name ILIKE '%WASHINGTON GAS%' OR merchant_name ILIKE '%PEPCO%';

UPDATE transactions SET category_primary = 'Bills & Utilities', category_detailed = 'Internet'
WHERE merchant_name ILIKE '%VERIZON%';

UPDATE transactions SET category_primary = 'Bills & Utilities', category_detailed = 'Phone'
WHERE merchant_name ILIKE '%VISIBLE%';

UPDATE transactions SET category_primary = 'Bills & Utilities', category_detailed = 'Other Bills & Utilities'
WHERE category_primary = 'BANK_FEES';

-- F. Groceries
UPDATE transactions SET category_primary = 'Groceries', category_detailed = 'Groceries'
WHERE merchant_name ILIKE '%WEGMANS%' OR merchant_name ILIKE '%GIANT FOOD%' OR merchant_name ILIKE '%INDIA BAZAAR%'
   OR merchant_name ILIKE '%Costco%' OR merchant_name ILIKE '%Walmart%'
   OR category_detailed = 'FOOD_AND_DRINK_GROCERIES';

-- G. Food & Dining
UPDATE transactions SET category_primary = 'Food & Dining', category_detailed = 'Alcohol & Bars'
WHERE merchant_name ILIKE '%MUDDY BRANCH%';

UPDATE transactions SET category_primary = 'Food & Dining', category_detailed = 'Coffee Shops'
WHERE merchant_name ILIKE '%STARBUCKS%' OR category_detailed = 'FOOD_AND_DRINK_COFFEE_SHOPS';

UPDATE transactions SET category_primary = 'Food & Dining', category_detailed = 'Fast Food'
WHERE category_detailed = 'FOOD_AND_DRINK_FAST_FOOD';

UPDATE transactions SET category_primary = 'Food & Dining', category_detailed = 'Restaurants'
WHERE category_detailed = 'FOOD_AND_DRINK_RESTAURANTS' OR merchant_name ILIKE 'TST*%' OR merchant_name ILIKE '%SHAWARMA%';

UPDATE transactions SET category_primary = 'Food & Dining', category_detailed = 'Other Food & Dining'
WHERE category_primary = 'FOOD_AND_DRINK' AND category_primary != 'Groceries';

-- H. Home Improvement
UPDATE transactions SET category_primary = 'Home Improvement', category_detailed = 'Home Improvements'
WHERE merchant_name ILIKE '%Home Depot%' OR category_primary = 'HOME_IMPROVEMENT';

-- I. Medical
UPDATE transactions SET category_primary = 'Medical', category_detailed = 'Dentist'
WHERE merchant_name ILIKE '%WISTERIA DENTA%';

UPDATE transactions SET category_primary = 'Medical', category_detailed = 'Doctor'
WHERE merchant_name ILIKE '%CHRISTOPHER BARR%' OR merchant_name ILIKE '%CLARKSBURG%' OR category_detailed = 'MEDICAL_PRIMARY_CARE';

UPDATE transactions SET category_primary = 'Medical', category_detailed = 'Eyecare'
WHERE merchant_name ILIKE '%WARBY PARKER%';

UPDATE transactions SET category_primary = 'Medical', category_detailed = 'Pharmacy'
WHERE merchant_name ILIKE '%CVS%' OR merchant_name ILIKE '%Walgreens%' OR category_detailed = 'MEDICAL_PHARMACIES_AND_SUPPLEMENTS';

UPDATE transactions SET category_primary = 'Medical', category_detailed = 'Other Medical'
WHERE category_primary = 'MEDICAL' AND category_detailed NOT IN ('Dentist', 'Doctor', 'Eyecare', 'Pharmacy');

-- J. Pets
UPDATE transactions SET category_primary = 'Pets', category_detailed = 'Insurance'
WHERE merchant_name ILIKE '%PETS BEST%';

UPDATE transactions SET category_primary = 'Pets', category_detailed = 'Boarding'
WHERE merchant_name ILIKE '%ROVER.COM%';

-- K. Transportation
UPDATE transactions SET category_primary = 'Transportation', category_detailed = 'Car Registration'
WHERE merchant_name ILIKE '%MVA %';

UPDATE transactions SET category_primary = 'Transportation', category_detailed = 'Gas'
WHERE merchant_name ILIKE '%Shell%' OR merchant_name ILIKE '%Sunoco%' OR merchant_name ILIKE '%Exxon%'
   OR merchant_name ILIKE '%LIBERTY%' OR merchant_name ILIKE '%ROYAL FARMS%' OR category_detailed = 'TRANSPORTATION_GAS';

UPDATE transactions SET category_primary = 'Transportation', category_detailed = 'Other Transportation'
WHERE category_primary = 'TRANSPORTATION' AND category_detailed NOT IN ('Gas', 'Car Registration');

-- L. Entertainment
UPDATE transactions SET category_primary = 'Entertainment', category_detailed = 'Movies & DVDs'
WHERE merchant_name ILIKE '%DISNEY%' OR merchant_name ILIKE '%Netflix%' OR merchant_name ILIKE '%AMC %'
   OR category_detailed = 'ENTERTAINMENT_TV_AND_MOVIES';

UPDATE transactions SET category_primary = 'Entertainment', category_detailed = 'Other Entertainment'
WHERE category_primary = 'ENTERTAINMENT' AND category_detailed NOT IN ('Movies & DVDs');

-- M. Insurance
UPDATE transactions SET category_primary = 'Insurance', category_detailed = 'Life Insurance'
WHERE merchant_name ILIKE '%AMERICAN GEN LIF%';

-- N. Gifts & Donations
UPDATE transactions SET category_primary = 'Gifts & Donations', category_detailed = 'Gifts'
WHERE merchant_name ILIKE '%GIFTORY%' OR category_detailed = 'GENERAL_MERCHANDISE_GIFTS_AND_NOVELTIES';

-- O. Childcare
UPDATE transactions SET category_primary = 'Childcare', category_detailed = 'Kids Activities'
WHERE merchant_name ILIKE '%ACTIVEMONTGOMERY%';

-- P. Shopping
UPDATE transactions SET category_primary = 'Shopping', category_detailed = 'Electronics'
WHERE merchant_name ILIKE '%Best Buy%' OR merchant_name ILIKE '%Woot%' OR merchant_name ILIKE '%Cherry Technolo%'
   OR category_detailed = 'GENERAL_MERCHANDISE_ELECTRONICS';

UPDATE transactions SET category_primary = 'Shopping', category_detailed = 'Books'
WHERE merchant_name ILIKE '%Audible%' OR merchant_name ILIKE '%Kindle%'
   OR category_detailed = 'GENERAL_MERCHANDISE_BOOKSTORES_AND_NEWSSTANDS';

UPDATE transactions SET category_primary = 'Shopping', category_detailed = 'Hobbies'
WHERE merchant_name ILIKE '%Michaels%';

UPDATE transactions SET category_primary = 'Shopping', category_detailed = 'Other Shopping'
WHERE merchant_name ILIKE '%Amazon%' OR merchant_name ILIKE '%AMAZON%' OR merchant_name ILIKE '%eBay%'
   OR category_primary = 'GENERAL_MERCHANDISE';

-- Q. Catch-all for any remaining raw Plaid/Teller categories
UPDATE transactions SET category_primary = 'Transportation', category_detailed = 'Other Transportation'
WHERE category_primary = 'GENERAL_SERVICES';

UPDATE transactions SET category_primary = 'Transfer', category_detailed = 'Cash Spending Transfer'
WHERE category_primary IN ('TRANSFER_IN', 'TRANSFER_OUT');

UPDATE transactions SET category_primary = 'Bills & Utilities', category_detailed = 'Other Bills & Utilities'
WHERE category_primary = 'OTHER' OR category_primary = 'Uncategorized';
