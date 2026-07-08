import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-customer-id, x-region",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const base64UrlEncode = (bytes: Uint8Array) => {
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  const base64 = btoa(binary);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const sha256Hex = async (value: string) => {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

const getBrevoConfig = async (supabase: ReturnType<typeof createClient>) => {
  const { data, error } = await supabase
    .from("email_settings_mission")
    .select("smtp_password, from_email, from_name")
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw error;
  const apiKey = data?.smtp_password || "";
  const fromEmail = data?.from_email || "";
  const fromName = data?.from_name || "OneDayPilot";

  if (!apiKey || !fromEmail) {
    throw new Error("Brevo Email Settings is not configured (API key / from email missing).");
  }

  return { apiKey, fromEmail, fromName };
};

const sendBrevoEmail = async (params: {
  apiKey: string;
  fromEmail: string;
  fromName: string;
  toEmail: string;
  subject: string;
  htmlContent: string;
}) => {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      accept: "application/json",
      "api-key": params.apiKey,
    },
    body: JSON.stringify({
      sender: { email: params.fromEmail, name: params.fromName },
      to: [{ email: params.toEmail }],
      subject: params.subject,
      htmlContent: params.htmlContent,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Brevo send failed (${res.status}): ${text}`);
  }
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
    const email = (body?.email || "").toString().trim().toLowerCase();
    const password = (body?.password || "").toString();
    const role = (body?.role || "Account").toString();
    const redirectUrl = (body?.redirectUrl || "").toString().trim();

    console.log(`Auth-Email Request - Action: ${action}, Email: ${email}`);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({ success: false, error: "Invalid email format" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!redirectUrl) {
      return new Response(JSON.stringify({ success: false, error: "Missing redirectUrl" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const brevo = await getBrevoConfig(supabase);

    if (action === "signup") {
      if (!password || password.trim().length < 6) {
        return new Response(JSON.stringify({ success: false, error: "Password must be at least 6 characters" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: created, error: createError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: false,
      });

      if (createError) {
        return new Response(JSON.stringify({ success: false, error: createError.message }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const userId = created.user?.id;
      if (!userId) {
        throw new Error("User created but id missing");
      }

      const isSuperAdmin = email === "amirul.mustapha@yahoo.com";
      await supabase.from("admin_users").upsert({
        id: userId,
        email,
        role,
        is_approved: isSuperAdmin,
        is_staff: isSuperAdmin,
      }, { onConflict: "id" });

      const token = base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)));
      const tokenHash = await sha256Hex(token);

      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const { error: tokenError } = await supabase.from("auth_email_tokens").insert({
        user_id: userId,
        email,
        token_type: "verify",
        token_hash: tokenHash,
        expires_at: expiresAt,
      });
      if (tokenError) throw tokenError;

      const link = `${redirectUrl}?verify=${encodeURIComponent(token)}`;
      const subject = "Verify your email";
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0f172a;">
          <h2 style="margin:0 0 12px 0;">Verify your email</h2>
          <p style="margin:0 0 16px 0;">Click the button below to verify your email and activate your admin account request.</p>
          <p style="margin:0 0 20px 0;">
            <a href="${link}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:12px 16px;border-radius:10px;font-weight:bold;">
              Verify Email
            </a>
          </p>
          <p style="margin:0;color:#64748b;font-size:12px;">If the button doesn’t work, open this link:</p>
          <p style="margin:6px 0 0 0;font-size:12px;word-break:break-all;"><a href="${link}">${link}</a></p>
        </div>
      `;

      await sendBrevoEmail({
        apiKey: brevo.apiKey,
        fromEmail: brevo.fromEmail,
        fromName: brevo.fromName,
        toEmail: email,
        subject,
        htmlContent,
      });

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "reset") {
      const { data: { users }, error: userError } = await supabase.auth.admin.listUsers();
      const targetUser = users?.find(u => u.email?.toLowerCase() === email);
      
      if (userError || !targetUser) {
        // Don't reveal if user exists or not for security, but log it
        console.warn(`Reset requested for unknown email or list error: ${email}`);
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const userId = targetUser.id;

      const token = base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)));
      const tokenHash = await sha256Hex(token);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

      const { error: tokenError } = await supabase.from("auth_email_tokens").insert({
        user_id: userId,
        email,
        token_type: "reset",
        token_hash: tokenHash,
        expires_at: expiresAt,
      });
      if (tokenError) throw tokenError;

      const link = `${redirectUrl}?reset=${encodeURIComponent(token)}`;
      const subject = "Reset your password";
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0f172a;">
          <h2 style="margin:0 0 12px 0;">Reset your password</h2>
          <p style="margin:0 0 16px 0;">Click the button below to set a new password for your admin account.</p>
          <p style="margin:0 0 20px 0;">
            <a href="${link}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:12px 16px;border-radius:10px;font-weight:bold;">
              Reset Password
            </a>
          </p>
          <p style="margin:0;color:#64748b;font-size:12px;">If the button doesn’t work, open this link:</p>
          <p style="margin:6px 0 0 0;font-size:12px;word-break:break-all;"><a href="${link}">${link}</a></p>
        </div>
      `;

      await sendBrevoEmail({
        apiKey: brevo.apiKey,
        fromEmail: brevo.fromEmail,
        fromName: brevo.fromName,
        toEmail: email,
        subject,
        htmlContent,
      });

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: false, error: "Invalid action" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("Auth-Email Error:", err);
    return new Response(JSON.stringify({ success: false, error: err.message || "Internal Server Error" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
