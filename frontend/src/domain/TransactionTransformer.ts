import type { Transaction, TransactionCategory, TransactionLocation } from '../types/api';

export interface BackendTransaction {
  id: string;
  account_id?: string;
  date: string;
  merchant_name?: string;
  amount: number;
  category_primary?: string;
  category_detailed?: string;
  category_confidence?: string;
  account_name: string;
  account_type: string;
  account_mask?: string;
  running_balance?: number;
  location?: TransactionLocation;
  custom_category?: string;
  rule_category?: string;
}

export class TransactionTransformer {
  static backendToFrontend(bt: BackendTransaction): Transaction {
    const category: TransactionCategory = {
      // Priority: explicit override > rule match > provider category
      primary: bt.custom_category ?? bt.rule_category ?? bt.category_primary ?? 'OTHER',
    };

    if (bt.category_detailed) {
      category.detailed = bt.category_detailed;
    }
    if (bt.category_confidence) {
      category.confidence_level = bt.category_confidence;
    }

    return {
      id: bt.id,
      account_id: bt.account_id,
      date: bt.date,
      name: bt.merchant_name || 'Unknown',
      merchant: bt.merchant_name,
      amount: bt.amount,
      category,
      account_name: bt.account_name,
      account_type: bt.account_type,
      account_mask: bt.account_mask,
      running_balance: bt.running_balance,
      location: bt.location,
      custom_category: bt.custom_category,
      rule_category: bt.rule_category,
    };
  }
}
