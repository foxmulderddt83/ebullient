import { SupabaseClient } from '@supabase/supabase-js';

export const logActivity = async (
  supabase: SupabaseClient | null,
  action: string,
  entityType: string,
  entityId: string | null,
  details: any = {},
  anonymousEmail: string | null = null
) => {
  if (!supabase) return;
  
  console.log(`[ACTIVITY] Logging: ${action} on ${entityType}`);
  
  try {
    let adminEmail = 'unknown';
    
    if (anonymousEmail) {
      adminEmail = anonymousEmail;
    } else {
      // Use a race to prevent getUser from hanging the whole logger
      // if the auth session is in a weird state (e.g. after tab focus loss)
      try {
        const userPromise = supabase.auth.getUser();
        const timeoutPromise = new Promise<{data: {user: null}, error: any}>((resolve) => 
          setTimeout(() => resolve({ data: { user: null }, error: 'timeout' }), 1500)
        );
        
        const result = await Promise.race([userPromise, timeoutPromise]);
        const user = result?.data?.user;

        if (!user) {
          console.warn('[ACTIVITY] Could not get user for logging (timeout or null)');
          // Fallback: try to peek at local storage session to get email without calling getUser
          try {
            const stored = localStorage.getItem('onedaypilot-auth-token');
            if (stored) {
              const session = JSON.parse(stored);
              adminEmail = session?.user?.email || 'unknown';
              console.log('[ACTIVITY] Fallback email from storage:', adminEmail);
            }
          } catch (e) {
            console.warn('[ACTIVITY] Storage fallback failed:', e);
          }
          if (adminEmail === 'unknown' && !anonymousEmail) return;
        } else {
          adminEmail = user.email || 'unknown';
        }
      } catch (e) {
        console.warn('[ACTIVITY] getUser exception:', e);
      }
    }

    console.log(`[ACTIVITY] Inserting log for: ${adminEmail}`);
    const { error } = await supabase.from('activity_logs').insert({
      admin_email: adminEmail,
      action_type: action,
      entity_type: entityType,
      entity_id: entityId,
      details: details,
      ip_address: typeof window !== 'undefined' ? window.location.hostname : 'server'
    });
    
    if (error) {
      console.error("[ACTIVITY] Insert error:", error);
    } else {
      console.log("[ACTIVITY] Successfully logged.");
    }
  } catch (err) {
    console.error("Failed to log activity:", err);
  }
};
