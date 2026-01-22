const API_URL = "http://localhost:8000/api";
const TOKEN_STORAGE_KEY = "infantmonitor_access_token";

type TokenResponse = { access_token: string; token_type: string };
type UserResponse = { id: number; username: string; full_name?: string | null; created_at: string };

type ApiValidationError = {
  detail?: Array<{
    type?: string;
    loc?: Array<string | number>;
    msg?: string;
    ctx?: Record<string, unknown>;
    input?: unknown;
  }> | string;
};

const formatRegisterError = (raw: unknown) => {
  const data = raw as ApiValidationError;
  const detail = data?.detail;

  if (!detail) return '注册失败，请稍后重试';
  if (typeof detail === 'string') return detail;
  if (!Array.isArray(detail)) return '注册失败，请检查输入';

  const messages = detail.map((e) => {
    const field = Array.isArray(e.loc) ? String(e.loc[e.loc.length - 1] ?? '') : '';
    if (field === 'username' && e.type === 'string_pattern_mismatch') return '用户名可包含中文/字母/数字/下划线，且不能包含空格或特殊符号';
    if (field === 'username' && e.type === 'string_too_short') return '用户名至少 2 个字符';
    if (field === 'username' && e.type === 'string_too_long') return '用户名最长 32 个字符';
    if (field === 'password' && e.type === 'string_too_short') return '密码至少 8 位';
    if (field === 'password' && e.type === 'string_too_long') return '密码最长 128 位';
    return e.msg || '注册失败，请检查输入';
  });

  return Array.from(new Set(messages)).join('；');
};

export const api = {
  login: async (username: string, password: string): Promise<TokenResponse> => {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);
    
    const response = await fetch(`${API_URL}/auth/token`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) throw new Error('Login failed');
    const data = (await response.json()) as TokenResponse;
    localStorage.setItem(TOKEN_STORAGE_KEY, data.access_token);
    return data;
  },

  register: async (username: string, password: string, fullName?: string): Promise<UserResponse> => {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        password,
        full_name: fullName ?? null,
      }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(async () => {
        const text = await response.text().catch(() => '');
        return { detail: text };
      });
      throw new Error(formatRegisterError(payload));
    }
    return response.json();
  },

  logout: async () => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    await fetch(`${API_URL}/auth/logout`, { method: 'POST' }).catch(() => undefined);
  },

  getStoredToken: (): string | null => {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  },

  me: async (token: string): Promise<UserResponse> => {
    const response = await fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.status === 401) {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      throw new Error('Unauthorized');
    }
    if (!response.ok) throw new Error('Failed to fetch user');
    return response.json();
  },

  getHistory: async (token: string) => {
    const response = await fetch(`${API_URL}/history/`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.status === 401) {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      throw new Error('Unauthorized');
    }
    if (!response.ok) throw new Error('Failed to fetch history');
    return response.json();
  },

  saveRecord: async (
    token: string,
    record: {
      date: string;
      startTime: string;
      endTime: string;
      avgBpm: number;
      signalQuality: string;
    }
  ) => {
    const body = JSON.stringify({
        date: record.date,
        start_time: record.startTime,
        end_time: record.endTime,
        avg_bpm: record.avgBpm,
        signal_quality: record.signalQuality,
    });

    const response = await fetch(`${API_URL}/history/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: body
    });

    if (response.status === 401) {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      throw new Error('Unauthorized');
    }
    if (!response.ok) throw new Error('Failed to save record');
    return response.json();
  }
};
