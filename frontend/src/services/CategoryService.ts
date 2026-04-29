import type { CategoryRule, UserCategory } from '../types/api';
import { ApiClient } from './ApiClient';

export class CategoryService {
  static async getCategories(): Promise<UserCategory[]> {
    const result = await ApiClient.get<UserCategory[]>('/categories');
    return Array.isArray(result) ? result : [];
  }

  static async createCategory(name: string): Promise<UserCategory> {
    return ApiClient.post<UserCategory>('/categories', { name });
  }

  static async deleteCategory(id: string): Promise<void> {
    await ApiClient.delete(`/categories/${id}`);
  }

  static async setTransactionCategory(
    transactionId: string,
    categoryName: string
  ): Promise<void> {
    await ApiClient.put(`/transactions/${transactionId}/category`, {
      category_name: categoryName,
    });
  }

  static async removeTransactionCategory(transactionId: string): Promise<void> {
    await ApiClient.delete(`/transactions/${transactionId}/category`);
  }

  static async getRules(): Promise<CategoryRule[]> {
    const result = await ApiClient.get<CategoryRule[]>('/category-rules');
    return Array.isArray(result) ? result : [];
  }

  static async createRule(pattern: string, categoryName: string): Promise<CategoryRule> {
    return ApiClient.post<CategoryRule>('/category-rules', {
      pattern,
      category_name: categoryName,
    });
  }

  static async updateRule(
    id: string,
    patch: { pattern?: string; category_name?: string }
  ): Promise<CategoryRule> {
    return ApiClient.put<CategoryRule>(`/category-rules/${id}`, patch);
  }

  static async deleteRule(id: string): Promise<void> {
    await ApiClient.delete(`/category-rules/${id}`);
  }
}
