import { SupabaseClient } from '@supabase/supabase-js';

export const logActivity = async (
  supabase: SupabaseClient | null,
  action: string,
  entityType: string,
  entityId: string | null,
  details: any = {}
) => {
  if (!supabase) return;
  
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Fetch admin email if needed, or just use user.email
    const adminEmail = user.email || 'unknown';

    await supabase.from('activity_logs').insert({
      admin_email: adminEmail,
      action_type: action,
      entity_type: entityType,
      entity_id: entityId,
      details: details,
      ip_address: window.location.hostname
    });
  } catch (err) {
    console.error("Failed to log activity:", err);
  }
};
