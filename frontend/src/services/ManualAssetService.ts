import type { Account, ManualAssetRequest } from '../types/api';
import { ApiClient } from './ApiClient';

export class ManualAssetService {
  static async create(input: ManualAssetRequest): Promise<Account> {
    return ApiClient.post<Account>('/manual-assets', input);
  }

  static async update(id: string, input: ManualAssetRequest): Promise<Account> {
    return ApiClient.put<Account>(`/manual-assets/${id}`, input);
  }

  static async delete(id: string): Promise<void> {
    await ApiClient.delete(`/manual-assets/${id}`);
  }
}
