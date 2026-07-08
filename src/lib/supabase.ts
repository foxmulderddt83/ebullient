import { createClient, type SupabaseClient, type Session } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const SESSION_REFRESHED_EVENT = 'oneday:session-refreshed';

let supabaseClient: SupabaseClient | null = null;
let refreshInFlight: Promise<Session | null> | null = null;
let lastVisibilityRefreshAt = 0;

const notifySessionRefreshed = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SESSION_REFRESHED_EVENT));
};

const isJwtAuthError = (status: number, body: string) => {
  if (status !== 401) return false;
  const lower = body.toLowerCase();
  return (
    lower.includes('jwt') ||
    lower.includes('pgrst301') ||
    lower.includes('invalid claim') ||
    lower.includes('expired')
  );
};

// Safe wrapper for fetch that retries AbortError once and enforces a global timeout.
// Browser tabs that lose focus often abort in-flight fetches or hang them indefinitely.
// This ensures that NO network request can hang the entire UI for more than 10 seconds.
const safeBaseFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const fetchWithTimeout = async (url: RequestInfo | URL, options?: RequestInit, timeoutMs = 10000): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.warn(`[FETCH] Request to ${url.toString().substring(0, 100)} timed out after ${timeoutMs}ms`);
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  };

  try {
    return await fetchWithTimeout(input, init);
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.warn(`[FETCH] Retrying aborted request to ${input.toString().substring(0, 100)}...`);
      try {
        // One-time retry for aborted requests (often happens during tab switch)
        return await fetchWithTimeout(input, init, 15000);
      } catch (retryError: any) {
        console.error(`[FETCH] Retry failed for ${input.toString().substring(0, 100)}:`, retryError.message);
        // Return a synthetic 408 Request Timeout so the Supabase client handles it
        return new Response(null, { status: 408, statusText: 'Request Timeout' });
      }
    }
    throw error;
  }
};

const createSupabaseFetch = (anonKey: string): typeof fetch => {
  return async (input, init) => {
    const url = typeof input === 'string' ? input : (input as any).url;
    
    try {
      const response = await safeBaseFetch(input, init);
      if (!supabaseClient) return response;

      if (!url.includes('supabase.co') && !url.includes('supabase.in')) return response;
      
      if (url.includes('/auth/v1/logout')) {
        console.log('[FETCH] Detected logout request, returning response...');
        return response;
      }
      
      if (url.includes('/auth/v1/token')) return response;

      // Avoid cloning the body twice for the JWT retry path
      let body = '';
      try {
        body = await response.clone().text();
      } catch {
        body = '';
      }

      if (!isJwtAuthError(response.status, body)) return response;

      const session = await ensureFreshSession(true);
      if (!session) return response;

      const headers = new Headers(init?.headers);
      headers.set('Authorization', `Bearer ${session.access_token}`);
      if (!headers.has('apikey')) {
        headers.set('apikey', anonKey);
      }

      return safeBaseFetch(input, { ...init, headers });
    } catch (error: any) {
      // Surface non-fatal AbortErrors gracefully (UI shouldn't crash)
      if (error?.name === 'AbortError') {
        console.warn('Supabase fetch aborted (handled):', typeof input === 'string' ? input : (input as any)?.url);
        return new Response(JSON.stringify({ aborted: true }), {
          status: 408,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      throw error;
    }
  };
};

export async function ensureFreshSession(force = false): Promise<Session | null> {
  if (!supabaseClient) return null;
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const refreshProcess = (async () => {
        // Use a local variable to store the session we might return as fallback
        let sessionToReturn: Session | null = null;

        try {
          const { data: { session: current } } = await supabaseClient!.auth.getSession();
          sessionToReturn = current;

          if (!current) return null;

          const expiresAtMs = (current.expires_at ?? 0) * 1000;
          const expiringSoon = !expiresAtMs || expiresAtMs - Date.now() < 60_000; // Only refresh if < 1 min left

          if (force || expiringSoon) {
            try {
              const { data, error } = await supabaseClient!.auth.refreshSession();
              if (!error && data.session) {
                return data.session;
              }
            } catch (refreshErr) {
              // Ignore refresh errors, rely on fallback below
            }
          }

          return sessionToReturn;
        } catch (err) {
          return sessionToReturn;
        }
      })();

      const timeoutPromise = new Promise<Session | null>((resolve) => 
        setTimeout(async () => {
          // Fallback: try to get the session from local storage directly
          try {
            const storageKey = 'onedaypilot-auth-token';
            const stored = localStorage.getItem(storageKey);
            if (stored) {
              const parsed = JSON.parse(stored);
              if (parsed && typeof parsed === 'object') {
                resolve(parsed as Session);
                return;
              }
            }
          } catch (e) {}
          resolve(null);
        }, 3000) // Even faster timeout (3s)
      );

      return await Promise.race([refreshProcess, timeoutPromise]);
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

const createNewClient = () => {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  
  // Suppress the "Multiple GoTrueClient instances detected" warning from Supabase.
  // We intentionally create fresh instances to recover from background tab deadlocks.
  const originalWarn = console.warn;
  console.warn = (...args: any[]) => {
    if (typeof args[0] === 'string' && args[0].includes('Multiple GoTrueClient instances detected')) {
      return;
    }
    originalWarn(...args);
  };

  try {
    const client = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { 'x-client-info': 'onedaypilot-web' },
        fetch: createSupabaseFetch(supabaseAnonKey),
      },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: window.localStorage,
        storageKey: 'onedaypilot-auth-token',
        flowType: 'pkce',
        lock: async (_name, _acquireTimeout, fn) => await fn(),
      },
    });
    return client;
  } finally {
    // Restore original console.warn immediately after creation
    console.warn = originalWarn;
  }
};

const setupVisibilityRefresh = () => {
  if (typeof document === 'undefined') return;

  const handleAppVisible = () => {
    if (document.visibilityState !== 'visible') return;

    const now = Date.now();
    if (now - lastVisibilityRefreshAt < 10000) return;
    lastVisibilityRefreshAt = now;

    // Reset the client instance to clear any internal library deadlocks
    supabaseClient = createNewClient();
    
    try {
      window.dispatchEvent(new CustomEvent('oneday:app-visible'));
    } catch (e) {
      console.warn('[VISIBILITY] Failed to dispatch oneday:app-visible', e);
    }
  };

  document.addEventListener('visibilitychange', handleAppVisible);
  window.addEventListener('focus', handleAppVisible);
};

// Initial creation
supabaseClient = createNewClient();
if (supabaseClient) setupVisibilityRefresh();

// Export a proxy that always uses the current supabaseClient instance
export const supabase = new Proxy({} as SupabaseClient, {
  get: (_target, prop: keyof SupabaseClient) => {
    if (!supabaseClient) {
      supabaseClient = createNewClient();
    }
    return supabaseClient ? supabaseClient[prop] : undefined;
  }
});

if (!supabase) {
  console.warn('Supabase URL or Anon Key is missing. Check environment variables.');
}