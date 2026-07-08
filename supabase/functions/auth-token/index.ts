import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-customer-id, x-region",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const sha256Hex = async (value: string) => {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl =
      Deno.env.get("SUPABASE_URL") ||
      Deno.env.get("EDGE_SUPABASE_URL") ||
      "";
    const serviceRoleKey =
      Deno.env.get("SERVICE_ROLE_KEY") ||
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
      "";
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            "Missing Edge Function secrets. Set SERVICE_ROLE_KEY (Supabase service_role key). SUPABASE_URL is provided automatically by Supabase; if not, set EDGE_SUPABASE_URL.",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const action = (body?.action || "").toString();
    const token = (body?.token || "").toString();

    if (!token) {
      return new Response(JSON.stringify({ success: false, error: "Missing token" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tokenHash = await sha256Hex(token);

    const { data: row, error: tokenError } = await supabase
      .from("auth_email_tokens")
      .select("*")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (tokenError) throw tokenError;
    if (!row) {
      return new Response(JSON.stringify({ success: false, error: "Invalid or expired token" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (row.used_at) {
      return new Response(JSON.stringify({ success: false, error: "Token already used" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
      return new Response(JSON.stringify({ success: false, error: "Token expired" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "verify") {
      if (row.token_type !== "verify") {
        return new Response(JSON.stringify({ success: false, error: "Invalid token type" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: updateUserError } = await supabase.auth.admin.updateUserById(row.user_id, {
        email_confirm: true,
      });
      if (updateUserError) throw updateUserError;

      const { error: markError } = await supabase
        .from("auth_email_tokens")
        .update({ used_at: new Date().toISOString() })
        .eq("id", row.id);
      if (markError) throw markError;

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "set_password") {
      if (row.token_type !== "reset") {
        return new Response(JSON.stringify({ success: false, error: "Invalid token type" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const newPassword = (body?.newPassword || "").toString();
      if (!newPassword || newPassword.trim().length < 6) {
        return new Response(JSON.stringify({ success: false, error: "Password must be at least 6 characters" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: updateUserError } = await supabase.auth.admin.updateUserById(row.user_id, {
        password: newPassword,
      });
      if (updateUserError) throw updateUserError;

      const { error: markError } = await supabase
        .from("auth_email_tokens")
        .update({ used_at: new Date().toISOString() })
        .eq("id", row.id);
      if (markError) throw markError;

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: false, error: "Invalid action" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Auth-Token Error:", error);
    return new Response(JSON.stringify({ success: false, error: error?.message || "Unknown error" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
