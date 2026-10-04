import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';

// ==============================================================================
// ⚡ High-Performance Client Cache & Deduplication for Real-Time Instant Loading
// ==============================================================================
interface CacheEntry {
  data: any;
  timestamp: number;
}

const clientCache = new Map<string, CacheEntry>();
const inFlightRequests = new Map<string, Promise<AxiosResponse<any>>>();

const DEFAULT_CACHE_TTL_MS = 15000; // 15 seconds fast memory cache

export const clearClientCache = (pattern?: string | RegExp) => {
  if (!pattern) {
    clientCache.clear();
    return;
  }
  const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
  for (const key of clientCache.keys()) {
    if (regex.test(key)) {
      clientCache.delete(key);
    }
  }
};

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const isMentor = import.meta.env.VITE_PORTAL_TYPE === 'mentor' || 
    (typeof window !== 'undefined' && window.location.hostname.includes('mentor'));
  if (config.headers) {
    config.headers['x-portal-type'] = isMentor ? 'mentor' : 'admin';
  }
  return config;
});

axiosInstance.interceptors.response.use(
  (response) => {
    // If request was a mutation (POST, PUT, DELETE, PATCH), invalidate related client cache
    const method = (response.config.method || '').toUpperCase();
    if (method !== 'GET') {
      const url = response.config.url || '';
      if (url.includes('/students') || url.includes('/tags')) {
        clearClientCache(/students|tags/);
      } else if (url.includes('/attendance')) {
        clearClientCache(/attendance/);
      } else if (url.includes('/floors')) {
        clearClientCache(/floors/);
      } else if (url.includes('/leaves')) {
        clearClientCache(/leaves/);
      } else if (url.includes('/whatsapp')) {
        clearClientCache(/whatsapp/);
      } else if (url.includes('/security') || url.includes('/device')) {
        clearClientCache(/security|device/);
      } else {
        clearClientCache();
      }
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Wrapper for apiClient with seamless memory caching & in-flight request deduplication
const apiClient = {
  ...axiosInstance,

  get: async <T = any, R = AxiosResponse<T>>(url: string, config?: AxiosRequestConfig & { ttl?: number; skipCache?: boolean }): Promise<R> => {
    const isCacheDisabled = config?.skipCache || config?.headers?.['x-skip-cache'];
    const cacheKey = `GET:${url}:${JSON.stringify(config?.params || {})}`;
    const now = Date.now();
    const ttl = config?.ttl || DEFAULT_CACHE_TTL_MS;

    if (!isCacheDisabled) {
      const cached = clientCache.get(cacheKey);
      if (cached && now - cached.timestamp < ttl) {
        // Return cached response instantly (0ms)
        return Promise.resolve({
          data: cached.data,
          status: 200,
          statusText: 'OK (Cache)',
          headers: {},
          config: config || {}
        } as unknown as R);
      }

      // In-flight deduplication (prevents duplicate simultaneous calls)
      if (inFlightRequests.has(cacheKey)) {
        return inFlightRequests.get(cacheKey) as Promise<R>;
      }
    }

    const requestPromise = axiosInstance.get<T, R>(url, config).then((response) => {
      if (!isCacheDisabled && response.status >= 200 && response.status < 300) {
        clientCache.set(cacheKey, { data: response.data, timestamp: Date.now() });
      }
      inFlightRequests.delete(cacheKey);
      return response;
    }).catch((err) => {
      inFlightRequests.delete(cacheKey);
      throw err;
    });

    if (!isCacheDisabled) {
      inFlightRequests.set(cacheKey, requestPromise as Promise<AxiosResponse<any>>);
    }

    return requestPromise;
  },

  post: async <T = any, R = AxiosResponse<T>>(url: string, data?: any, config?: AxiosRequestConfig): Promise<R> => {
    clearClientCache();
    return axiosInstance.post<T, R>(url, data, config);
  },

  put: async <T = any, R = AxiosResponse<T>>(url: string, data?: any, config?: AxiosRequestConfig): Promise<R> => {
    clearClientCache();
    return axiosInstance.put<T, R>(url, data, config);
  },

  delete: async <T = any, R = AxiosResponse<T>>(url: string, config?: AxiosRequestConfig): Promise<R> => {
    clearClientCache();
    return axiosInstance.delete<T, R>(url, config);
  },

  patch: async <T = any, R = AxiosResponse<T>>(url: string, data?: any, config?: AxiosRequestConfig): Promise<R> => {
    clearClientCache();
    return axiosInstance.patch<T, R>(url, data, config);
  },

  defaults: axiosInstance.defaults,
  interceptors: axiosInstance.interceptors
};

export default apiClient;
