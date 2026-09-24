import { act, renderHook } from '@testing-library/react';
import { usePlaidLinkFlow } from '@/features/plaid/hooks/usePlaidLinkFlow';

const plaidLinkMock = (() => {
  const open = jest.fn();
  let config: any = null;
  return {
    open,
    getConfig: () => config,
    reset: () => {
      config = null;
      open.mockReset();
    },
    setConfig: (opts: any) => {
      config = opts;
    },
  };
})();

const plaidConnectionsMock = {
  connections: [] as any[],
  loading: false,
  error: null as string | null,
  addConnection: jest.fn(),
  removeConnection: jest.fn(),
  updateConnectionSyncInfo: jest.fn(),
  setConnectionSyncInProgress: jest.fn(),
  refresh: jest.fn(),
  getConnection: jest.fn(),
};

jest.mock('react-plaid-link', () => ({
  usePlaidLink: (opts: any) => {
    plaidLinkMock.setConfig(opts);
    return { open: plaidLinkMock.open, ready: true };
  },
}));

jest.mock('@/hooks/usePlaidConnections', () => ({
  usePlaidConnections: (_options?: any) => plaidConnectionsMock,
}));

jest.mock('@/services/PlaidService', () => ({
  PlaidService: {
    getStatus: jest.fn(),
    exchangeToken: jest.fn(),
    syncTransactions: jest.fn(),
    disconnect: jest.fn(),
  },
}));

jest.mock('@/services/ApiClient', () => ({
  ApiClient: {
    post: jest.fn(),
  },
}));

const plaidServiceMock = jest.requireMock('@/services/PlaidService').PlaidService as Record<
  string,
  jest.Mock
>;
const apiClientMock = jest.requireMock('@/services/ApiClient').ApiClient as { post: jest.Mock };

describe('usePlaidLinkFlow', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    window.sessionStorage.clear();
    plaidConnectionsMock.connections = [];
    plaidConnectionsMock.loading = false;
    plaidConnectionsMock.error = null;
    plaidConnectionsMock.addConnection.mockReset();
    plaidConnectionsMock.removeConnection.mockReset();
    plaidConnectionsMock.updateConnectionSyncInfo.mockReset();
    plaidConnectionsMock.setConnectionSyncInProgress.mockReset();
    plaidConnectionsMock.refresh.mockReset();
    plaidConnectionsMock.getConnection.mockReset();
    plaidLinkMock.reset();
    Object.values(plaidServiceMock).forEach((fn) => {
      fn.mockReset();
    });
    apiClientMock.post.mockReset();
  });

  it('exchanges token and refreshes status on success', async () => {
    const onError = jest.fn();
    plaidConnectionsMock.refresh.mockResolvedValue([]);
    apiClientMock.post.mockResolvedValueOnce({ link_token: 'token-123' });
    plaidServiceMock.exchangeToken.mockResolvedValueOnce({ access_token: 'access' } as any);
    plaidServiceMock.getStatus.mockResolvedValueOnce({
      connected: true,
      institution_name: 'Test Bank',
      connection_id: 'conn-1',
    } as any);

    const { result } = renderHook(() => usePlaidLinkFlow({ onError }));

    await act(async () => {
      await result.current.connect();
    });

    expect(apiClientMock.post).toHaveBeenCalledWith('/plaid/link-token', expect.any(Object));
    expect(plaidLinkMock.open).toHaveBeenCalled();

    const config = plaidLinkMock.getConfig();
    await act(async () => {
      await config.onSuccess('public-token');
    });

    expect(plaidServiceMock.exchangeToken).toHaveBeenCalledWith('public-token');
    expect(plaidConnectionsMock.refresh).toHaveBeenCalled();
    expect(result.current.toast).toBe('Bank connected successfully!');
    expect(onError).toHaveBeenCalled();
    expect(onError.mock.calls.every((call) => call[0] === null)).toBe(true);
  });

  it('refreshes linked accounts when the initial transaction sync fails', async () => {
    const connection = {
      connectionId: 'conn-1',
      id: 'conn-1',
      institutionName: 'Test Bank',
      lastSyncAt: null,
      transactionCount: 0,
      accountCount: 0,
      syncInProgress: false,
      isConnected: true,
      accounts: [],
    };
    plaidConnectionsMock.refresh
      .mockResolvedValueOnce([connection])
      .mockResolvedValueOnce([connection]);
    plaidServiceMock.exchangeToken.mockResolvedValueOnce({ access_token: 'access' } as any);
    plaidServiceMock.syncTransactions.mockRejectedValueOnce(new Error('sync unavailable'));

    renderHook(() => usePlaidLinkFlow());

    const config = plaidLinkMock.getConfig();
    await act(async () => {
      await config.onSuccess('public-token');
    });

    expect(plaidServiceMock.syncTransactions).toHaveBeenCalledWith('conn-1');
    expect(plaidConnectionsMock.refresh).toHaveBeenCalledTimes(2);
  });

  it('provides syncOne, syncAll, and disconnect helpers', async () => {
    const onError = jest.fn();
    plaidConnectionsMock.connections = [
      {
        connectionId: 'bank-1',
        id: 'bank-1',
        institutionName: 'Bank One',
        lastSyncAt: null,
        transactionCount: 0,
        accountCount: 0,
        syncInProgress: false,
        isConnected: true,
        accounts: [],
      },
    ];
    plaidConnectionsMock.getConnection.mockReturnValue(plaidConnectionsMock.connections[0]);
    plaidServiceMock.syncTransactions.mockResolvedValue({
      transactions: [{ id: 't-1' }],
      metadata: {
        transaction_count: 1,
        account_count: 1,
        sync_timestamp: '2024-01-01T00:00:00Z',
      },
    } as any);
    plaidServiceMock.disconnect.mockResolvedValue({ success: true } as any);

    const { result } = renderHook(() => usePlaidLinkFlow({ onError }));

    await act(async () => {
      await result.current.syncOne('bank-1');
    });

    expect(plaidServiceMock.syncTransactions).toHaveBeenCalledWith('bank-1');
    expect(plaidConnectionsMock.refresh).toHaveBeenCalled();
    expect(result.current.toast).toContain('Synced 1 new transactions from Bank One');

    await act(async () => {
      await result.current.syncAll();
    });

    expect(result.current.syncingAll).toBe(false);
    expect(plaidServiceMock.syncTransactions).toHaveBeenCalledTimes(2);

    await act(async () => {
      await result.current.disconnect('bank-1');
    });

    expect(plaidServiceMock.disconnect).toHaveBeenCalledWith('bank-1');
    expect(plaidConnectionsMock.refresh).toHaveBeenCalled();
    expect(result.current.toast).toBe('Bank One disconnected successfully');
    expect(onError).toHaveBeenCalled();
    expect(onError.mock.calls.every((call) => call[0] === null)).toBe(true);
  });

  it('reports errors via onError', async () => {
    const onError = jest.fn();
    apiClientMock.post.mockRejectedValueOnce(new Error('bad request'));

    const { result } = renderHook(() => usePlaidLinkFlow({ onError }));

    await act(async () => {
      await result.current.connect().catch(() => {});
    });

    expect(onError).toHaveBeenCalledWith('Failed to start bank connection: bad request');
    expect(result.current.error).toBe('Failed to start bank connection: bad request');
  });

  it('reports an incomplete institution connection when Plaid Link exits cleanly', async () => {
    const onError = jest.fn();

    renderHook(() => usePlaidLinkFlow({ onError }));

    const config = plaidLinkMock.getConfig();
    act(() => {
      config.onExit(null, {
        institution: { name: 'Wells Fargo', institution_id: 'ins_4' },
        status: 'requires_oauth',
        link_session_id: 'session-1',
        request_id: 'request-1',
      });
    });

    expect(onError).toHaveBeenCalledWith(expect.stringContaining('Wells Fargo was not connected'));
  });

  it('resumes Plaid Link after an OAuth redirect with the original link token', () => {
    (window.sessionStorage.getItem as jest.Mock).mockReturnValueOnce('oauth-link-token');
    window.history.replaceState(null, '', '/?oauth_state_id=oauth-state');

    renderHook(() => usePlaidLinkFlow());

    const config = plaidLinkMock.getConfig();
    expect(config.token).toBe('oauth-link-token');
    expect(config.receivedRedirectUri).toBe(window.location.href);
    expect(plaidLinkMock.open).toHaveBeenCalled();
  });
});

describe('usePlaidLinkFlow with OpenTelemetry Instrumentation', () => {
  beforeEach(() => {
    plaidConnectionsMock.connections = [];
    plaidConnectionsMock.loading = false;
    plaidConnectionsMock.error = null;
    plaidConnectionsMock.addConnection.mockReset();
    plaidConnectionsMock.removeConnection.mockReset();
    plaidConnectionsMock.updateConnectionSyncInfo.mockReset();
    plaidConnectionsMock.setConnectionSyncInProgress.mockReset();
    plaidConnectionsMock.refresh.mockReset();
    plaidConnectionsMock.getConnection.mockReset();
    plaidLinkMock.reset();
    Object.values(plaidServiceMock).forEach((fn) => {
      fn.mockReset();
    });
    apiClientMock.post.mockReset();
  });

  it('should wrap connect callback with instrumentation', async () => {
    const onError = jest.fn();
    apiClientMock.post.mockResolvedValueOnce({ link_token: 'token-123' });

    const { result } = renderHook(() => usePlaidLinkFlow({ onError }));

    await act(async () => {
      await result.current.connect();
    });

    expect(apiClientMock.post).toHaveBeenCalled();
    expect(plaidLinkMock.open).toHaveBeenCalled();
  });

  it('should wrap onSuccess callback with instrumentation', async () => {
    const onError = jest.fn();
    plaidConnectionsMock.refresh.mockResolvedValue([]);
    apiClientMock.post.mockResolvedValueOnce({ link_token: 'token-123' });
    plaidServiceMock.exchangeToken.mockResolvedValueOnce({ access_token: 'access' } as any);

    const { result } = renderHook(() => usePlaidLinkFlow({ onError }));

    await act(async () => {
      await result.current.connect();
    });

    const config = plaidLinkMock.getConfig();
    await act(async () => {
      await config.onSuccess('public-token');
    });

    expect(plaidServiceMock.exchangeToken).toHaveBeenCalledWith('public-token');
    expect(plaidConnectionsMock.refresh).toHaveBeenCalled();
  });

  it('should wrap syncOne callback with instrumentation', async () => {
    const onError = jest.fn();
    plaidConnectionsMock.connections = [
      {
        connectionId: 'bank-1',
        id: 'bank-1',
        institutionName: 'Bank One',
        lastSyncAt: null,
        transactionCount: 0,
        accountCount: 0,
        syncInProgress: false,
        isConnected: true,
        accounts: [],
      },
    ];
    plaidConnectionsMock.getConnection.mockReturnValue(plaidConnectionsMock.connections[0]);
    plaidServiceMock.syncTransactions.mockResolvedValue({
      transactions: [{ id: 't-1' }],
    } as any);

    const { result } = renderHook(() => usePlaidLinkFlow({ onError }));

    await act(async () => {
      await result.current.syncOne('bank-1');
    });

    expect(plaidServiceMock.syncTransactions).toHaveBeenCalledWith('bank-1');
    expect(plaidConnectionsMock.refresh).toHaveBeenCalled();
  });

  it('should wrap syncAll callback with instrumentation', async () => {
    const onError = jest.fn();
    plaidConnectionsMock.connections = [
      {
        connectionId: 'bank-1',
        id: 'bank-1',
        institutionName: 'Bank One',
        lastSyncAt: null,
        transactionCount: 0,
        accountCount: 0,
        syncInProgress: false,
        isConnected: true,
        accounts: [],
      },
    ];
    plaidConnectionsMock.getConnection.mockReturnValue(plaidConnectionsMock.connections[0]);
    plaidServiceMock.syncTransactions.mockResolvedValue({
      transactions: [],
    } as any);
    plaidConnectionsMock.refresh.mockResolvedValue([]);

    const { result } = renderHook(() => usePlaidLinkFlow({ onError }));

    await act(async () => {
      await result.current.syncAll();
    });

    expect(result.current.syncingAll).toBe(false);
  });

  it('should wrap disconnect callback with instrumentation', async () => {
    const onError = jest.fn();
    plaidConnectionsMock.connections = [
      {
        connectionId: 'bank-1',
        id: 'bank-1',
        institutionName: 'Bank One',
        lastSyncAt: null,
        transactionCount: 0,
        accountCount: 0,
        syncInProgress: false,
        isConnected: true,
        accounts: [],
      },
    ];
    plaidConnectionsMock.getConnection.mockReturnValue(plaidConnectionsMock.connections[0]);
    plaidServiceMock.disconnect.mockResolvedValue({ success: true } as any);
    plaidConnectionsMock.refresh.mockResolvedValue([]);

    const { result } = renderHook(() => usePlaidLinkFlow({ onError }));

    await act(async () => {
      await result.current.disconnect('bank-1');
    });

    expect(plaidServiceMock.disconnect).toHaveBeenCalledWith('bank-1');
    expect(plaidConnectionsMock.refresh).toHaveBeenCalled();
  });
});
