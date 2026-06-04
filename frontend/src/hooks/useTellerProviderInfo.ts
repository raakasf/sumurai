import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiClient } from '../services/ApiClient';
import type { FinancialProvider } from '../types/api';
import type { TellerEnvironment } from './useTellerConnect';

export interface TellerProviderCatalogue {
  available_providers: FinancialProvider[];
  default_provider: FinancialProvider;
  user_provider?: FinancialProvider;
  teller_application_id?: string;
  teller_environment?: string;
}

export interface TellerProviderSelectionResult {
  user_provider: FinancialProvider;
}

export interface TellerProviderGateway {
  fetchInfo: () => Promise<TellerProviderCatalogue>;
  selectProvider: (provider: FinancialProvider) => Promise<TellerProviderSelectionResult>;
}

const apiGateway: TellerProviderGateway = {
  async fetchInfo() {
    return ApiClient.get<TellerProviderCatalogue>('/providers/info');
  },
  async selectProvider(provider) {
    return ApiClient.post<TellerProviderSelectionResult>('/providers/select', { provider });
  },
};

export interface UseTellerProviderInfoOptions {
  gateway?: TellerProviderGateway;
}

export interface TellerProviderInfoState {
  loading: boolean;
  error: string | null;
  availableProviders: FinancialProvider[];
  selectedProvider: FinancialProvider | null;
  defaultProvider: FinancialProvider | null;
  userProvider: FinancialProvider | null;
  tellerApplicationId: string | null;
  tellerEnvironment: TellerEnvironment;
  refresh: () => Promise<void>;
  chooseProvider: (provider: FinancialProvider) => Promise<void>;
}

const emptyProviders: FinancialProvider[] = [];

const normalizeProvider = (provider?: string | null): FinancialProvider | null => {
  const normalized = provider?.trim().toLowerCase();
  return normalized === 'plaid' || normalized === 'teller' ? normalized : null;
};

const normalizeCatalogue = (catalogue: TellerProviderCatalogue): TellerProviderCatalogue => ({
  ...catalogue,
  available_providers: catalogue.available_providers
    .map((provider) => normalizeProvider(provider))
    .filter((provider): provider is FinancialProvider => provider !== null),
  default_provider: normalizeProvider(catalogue.default_provider) ?? 'plaid',
  user_provider: normalizeProvider(catalogue.user_provider) ?? undefined,
});

export function useTellerProviderInfo(
  options: UseTellerProviderInfoOptions = {}
): TellerProviderInfoState {
  const gateway = options.gateway ?? apiGateway;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [catalogue, setCatalogue] = useState<TellerProviderCatalogue | null>(null);

  const selectedProvider = useMemo<FinancialProvider | null>(() => {
    if (!catalogue) {
      return null;
    }
    return catalogue.user_provider ?? catalogue.default_provider ?? null;
  }, [catalogue]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const info = await gateway.fetchInfo();
      console.log('useTellerProviderInfo - received from API:', info);
      setCatalogue(normalizeCatalogue(info));
    } catch (err) {
      console.warn('Failed to fetch provider information', err);
      setError('Unable to load provider information');
      setCatalogue(null);
    } finally {
      setLoading(false);
    }
  }, [gateway]);

  const chooseProvider = useCallback(
    async (provider: FinancialProvider) => {
      try {
        const selectedProvider = normalizeProvider(provider) ?? provider;
        const result = await gateway.selectProvider(selectedProvider);
        const userProvider = normalizeProvider(result.user_provider) ?? selectedProvider;
        setCatalogue((prev) => {
          if (!prev) {
            return {
              available_providers: [userProvider],
              default_provider: userProvider,
              user_provider: userProvider,
            };
          }
          return {
            ...prev,
            user_provider: userProvider,
          };
        });
      } catch (err) {
        console.warn('Failed to select provider', err);
        setError('Unable to select provider right now');
        throw err;
      }
    },
    [gateway]
  );

  useEffect(() => {
    load();
  }, [load]);

  const environment = catalogue?.teller_environment;
  const tellerEnvironment: TellerEnvironment =
    environment === 'sandbox' || environment === 'production' ? environment : 'development';

  return {
    loading,
    error,
    availableProviders: catalogue?.available_providers ?? emptyProviders,
    selectedProvider,
    defaultProvider: catalogue?.default_provider ?? null,
    userProvider: catalogue?.user_provider ?? null,
    tellerApplicationId: catalogue?.teller_application_id ?? null,
    tellerEnvironment,
    refresh: load,
    chooseProvider,
  };
}
