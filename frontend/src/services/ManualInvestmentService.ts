import type { Account, ManualInvestmentRequest } from '../types/api';
import { ApiClient } from './ApiClient';

export class ManualInvestmentService {
  static async create(input: ManualInvestmentRequest): Promise<Account> {
    return ApiClient.post<Account>('/manual-investments', input);
  }

  static async update(id: string, input: ManualInvestmentRequest): Promise<Account> {
    return ApiClient.put<Account>(`/manual-investments/${id}`, input);
  }

  static async delete(id: string): Promise<void> {
    await ApiClient.delete(`/manual-investments/${id}`);
  }
}
