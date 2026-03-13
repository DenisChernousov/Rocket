const BASE = '/api';

function getToken(): string | null {
  return localStorage.getItem('accessToken');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    // Try refresh
    const refreshed = await refreshTokens();
    if (refreshed) {
      return request(path, options);
    }
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    window.location.reload();
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

async function refreshTokens(): Promise<boolean> {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) return false;

  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) return false;

    const data = await res.json();
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

export const api = {
  auth: {
    register: (data: { username: string; email: string; password: string }) =>
      request<{ user: any; accessToken: string; refreshToken: string }>('/auth/register', {
        method: 'POST', body: JSON.stringify(data),
      }),
    login: (data: { login: string; password: string }) =>
      request<{ user: any; accessToken: string; refreshToken: string }>('/auth/login', {
        method: 'POST', body: JSON.stringify(data),
      }),
    me: () => request<any>('/auth/me'),
    logout: () => {
      const refreshToken = localStorage.getItem('refreshToken');
      return request('/auth/logout', {
        method: 'POST', body: JSON.stringify({ refreshToken }),
      });
    },
  },
  wallet: {
    balance: () => request<{ balance: number }>('/wallet/balance'),
    deposit: (amount: number) => request<{ balance: number }>('/wallet/deposit', {
      method: 'POST', body: JSON.stringify({ amount }),
    }),
    transactions: (page = 1) => request<any>(`/wallet/transactions?page=${page}`),
  },
  game: {
    history: () => request<any[]>('/game/history'),
    details: (id: string) => request<any>(`/game/${id}`),
    myBets: (page = 1) => request<any>(`/game/my/bets?page=${page}`),
    profile: () => request<any>('/game/my/profile'),
  },
  leaderboard: {
    get: (period: string) => request<any>(`/leaderboard?period=${period}`),
  },
  bonus: {
    dailyStatus: () => request<any>('/bonus/daily/status'),
    claimDaily: () => request<any>('/bonus/daily', { method: 'POST' }),
    redeemPromo: (code: string) => request<any>('/bonus/promo', {
      method: 'POST', body: JSON.stringify({ code }),
    }),
    referralInfo: () => request<any>('/bonus/referral'),
  },
  admin: {
    dashboard: () => request<any>('/admin/dashboard'),
    users: (page = 1, search = '') =>
      request<any>(`/admin/users?page=${page}&search=${encodeURIComponent(search)}`),
    banUser: (id: string) => request<any>(`/admin/users/${id}/ban`, { method: 'POST' }),
    unbanUser: (id: string) => request<any>(`/admin/users/${id}/unban`, { method: 'POST' }),
    muteUser: (id: string) => request<any>(`/admin/users/${id}/mute`, { method: 'POST' }),
    unmuteUser: (id: string) => request<any>(`/admin/users/${id}/unmute`, { method: 'POST' }),
    adjustBalance: (id: string, amount: number) =>
      request<any>(`/admin/users/${id}/balance`, {
        method: 'POST', body: JSON.stringify({ amount }),
      }),
    setRole: (id: string, role: string) =>
      request<any>(`/admin/users/${id}/role`, {
        method: 'POST', body: JSON.stringify({ role }),
      }),
    getPromos: () => request<any>('/admin/promos'),
    createPromo: (data: { code: string; amount: number; maxUses: number; expiresAt?: string }) =>
      request<any>('/admin/promos', {
        method: 'POST', body: JSON.stringify(data),
      }),
    deletePromo: (id: string) => request<any>(`/admin/promos/${id}`, { method: 'DELETE' }),
    getSettings: () => request<any>('/admin/settings'),
    saveSettings: (data: Record<string, any>) =>
      request<any>('/admin/settings', {
        method: 'POST', body: JSON.stringify(data),
      }),
    getFinance: (days = 14) => request<any>(`/admin/finance?days=${days}`),
  },
};
