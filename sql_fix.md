[
  {
    "name": "function_search_path_mutable",
    "title": "Function Search Path Mutable",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects functions where the search_path parameter is not set.",
    "detail": "Function \\`public.submit_payment_proof\\` has a role mutable search_path",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable",
    "metadata": {
      "name": "submit_payment_proof",
      "type": "function",
      "schema": "public"
    },
    "cache_key": "function_search_path_mutable_public_submit_payment_proof_687010f4873809e7828da0050ade7f8e"
  },
  {
    "name": "rls_policy_always_true",
    "title": "RLS Policy Always True",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects RLS policies that use overly permissive expressions like \\`USING (true)\\` or \\`WITH CHECK (true)\\` for UPDATE, DELETE, or INSERT operations. SELECT policies with \\`USING (true)\\` are intentionally excluded as this pattern is often used deliberately for public read access.",
    "detail": "Table `public.booking_items` has an RLS policy `Allow public insert booking_items` for `INSERT` that allows unrestricted access (WITH CHECK clause is always true). This effectively bypasses row-level security for -.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0024_permissive_rls_policy",
    "metadata": {
      "name": "booking_items",
      "qual": null,
      "type": "table",
      "roles": [
        "-"
      ],
      "schema": "public",
      "command": "INSERT",
      "with_check": "true",
      "policy_name": "Allow public insert booking_items",
      "permissive_using": false,
      "permissive_with_check": true
    },
    "cache_key": "rls_policy_always_true_public_booking_items_Allow public insert booking_items"
  },
  {
    "name": "rls_policy_always_true",
    "title": "RLS Policy Always True",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects RLS policies that use overly permissive expressions like \\`USING (true)\\` or \\`WITH CHECK (true)\\` for UPDATE, DELETE, or INSERT operations. SELECT policies with \\`USING (true)\\` are intentionally excluded as this pattern is often used deliberately for public read access.",
    "detail": "Table `public.booking_passengers` has an RLS policy `Allow public insert booking_passengers` for `INSERT` that allows unrestricted access (WITH CHECK clause is always true). This effectively bypasses row-level security for -.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0024_permissive_rls_policy",
    "metadata": {
      "name": "booking_passengers",
      "qual": null,
      "type": "table",
      "roles": [
        "-"
      ],
      "schema": "public",
      "command": "INSERT",
      "with_check": "true",
      "policy_name": "Allow public insert booking_passengers",
      "permissive_using": false,
      "permissive_with_check": true
    },
    "cache_key": "rls_policy_always_true_public_booking_passengers_Allow public insert booking_passengers"
  },
  {
    "name": "rls_policy_always_true",
    "title": "RLS Policy Always True",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects RLS policies that use overly permissive expressions like \\`USING (true)\\` or \\`WITH CHECK (true)\\` for UPDATE, DELETE, or INSERT operations. SELECT policies with \\`USING (true)\\` are intentionally excluded as this pattern is often used deliberately for public read access.",
    "detail": "Table `public.bookings` has an RLS policy `Allow public insert` for `INSERT` that allows unrestricted access (WITH CHECK clause is always true). This effectively bypasses row-level security for -.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0024_permissive_rls_policy",
    "metadata": {
      "name": "bookings",
      "qual": null,
      "type": "table",
      "roles": [
        "-"
      ],
      "schema": "public",
      "command": "INSERT",
      "with_check": "true",
      "policy_name": "Allow public insert",
      "permissive_using": false,
      "permissive_with_check": true
    },
    "cache_key": "rls_policy_always_true_public_bookings_Allow public insert"
  },
  {
    "name": "rls_policy_always_true",
    "title": "RLS Policy Always True",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects RLS policies that use overly permissive expressions like \\`USING (true)\\` or \\`WITH CHECK (true)\\` for UPDATE, DELETE, or INSERT operations. SELECT policies with \\`USING (true)\\` are intentionally excluded as this pattern is often used deliberately for public read access.",
    "detail": "Table `public.bookings` has an RLS policy `Allow public insert bookings` for `INSERT` that allows unrestricted access (WITH CHECK clause is always true). This effectively bypasses row-level security for -.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0024_permissive_rls_policy",
    "metadata": {
      "name": "bookings",
      "qual": null,
      "type": "table",
      "roles": [
        "-"
      ],
      "schema": "public",
      "command": "INSERT",
      "with_check": "true",
      "policy_name": "Allow public insert bookings",
      "permissive_using": false,
      "permissive_with_check": true
    },
    "cache_key": "rls_policy_always_true_public_bookings_Allow public insert bookings"
  },
  {
    "name": "rls_policy_always_true",
    "title": "RLS Policy Always True",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects RLS policies that use overly permissive expressions like \\`USING (true)\\` or \\`WITH CHECK (true)\\` for UPDATE, DELETE, or INSERT operations. SELECT policies with \\`USING (true)\\` are intentionally excluded as this pattern is often used deliberately for public read access.",
    "detail": "Table `public.bookings` has an RLS policy `Allow public update` for `UPDATE` that allows unrestricted access (both USING and WITH CHECK are always true). This effectively bypasses row-level security for -.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0024_permissive_rls_policy",
    "metadata": {
      "name": "bookings",
      "qual": "true",
      "type": "table",
      "roles": [
        "-"
      ],
      "schema": "public",
      "command": "UPDATE",
      "with_check": null,
      "policy_name": "Allow public update",
      "permissive_using": true,
      "permissive_with_check": true
    },
    "cache_key": "rls_policy_always_true_public_bookings_Allow public update"
  },
  {
    "name": "rls_policy_always_true",
    "title": "RLS Policy Always True",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects RLS policies that use overly permissive expressions like \\`USING (true)\\` or \\`WITH CHECK (true)\\` for UPDATE, DELETE, or INSERT operations. SELECT policies with \\`USING (true)\\` are intentionally excluded as this pattern is often used deliberately for public read access.",
    "detail": "Table `public.bookings` has an RLS policy `Allow public update bookings` for `UPDATE` that allows unrestricted access (both USING and WITH CHECK are always true). This effectively bypasses row-level security for -.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0024_permissive_rls_policy",
    "metadata": {
      "name": "bookings",
      "qual": "true",
      "type": "table",
      "roles": [
        "-"
      ],
      "schema": "public",
      "command": "UPDATE",
      "with_check": null,
      "policy_name": "Allow public update bookings",
      "permissive_using": true,
      "permissive_with_check": true
    },
    "cache_key": "rls_policy_always_true_public_bookings_Allow public update bookings"
  },
  {
    "name": "rls_policy_always_true",
    "title": "RLS Policy Always True",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects RLS policies that use overly permissive expressions like \\`USING (true)\\` or \\`WITH CHECK (true)\\` for UPDATE, DELETE, or INSERT operations. SELECT policies with \\`USING (true)\\` are intentionally excluded as this pattern is often used deliberately for public read access.",
    "detail": "Table `public.generated_documents` has an RLS policy `Enable insert for all` for `INSERT` that allows unrestricted access (WITH CHECK clause is always true). This effectively bypasses row-level security for -.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0024_permissive_rls_policy",
    "metadata": {
      "name": "generated_documents",
      "qual": null,
      "type": "table",
      "roles": [
        "-"
      ],
      "schema": "public",
      "command": "INSERT",
      "with_check": "true",
      "policy_name": "Enable insert for all",
      "permissive_using": false,
      "permissive_with_check": true
    },
    "cache_key": "rls_policy_always_true_public_generated_documents_Enable insert for all"
  },
  {
    "name": "rls_policy_always_true",
    "title": "RLS Policy Always True",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Detects RLS policies that use overly permissive expressions like \\`USING (true)\\` or \\`WITH CHECK (true)\\` for UPDATE, DELETE, or INSERT operations. SELECT policies with \\`USING (true)\\` are intentionally excluded as this pattern is often used deliberately for public read access.",
    "detail": "Table `public.notification_queue` has an RLS policy `Allow anonymous and authenticated inserts to notification_queue` for `INSERT` that allows unrestricted access (WITH CHECK clause is always true). This effectively bypasses row-level security for anon, authenticated.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0024_permissive_rls_policy",
    "metadata": {
      "name": "notification_queue",
      "qual": null,
      "type": "table",
      "roles": [
        "anon",
        "authenticated"
      ],
      "schema": "public",
      "command": "INSERT",
      "with_check": "true",
      "policy_name": "Allow anonymous and authenticated inserts to notification_queue",
      "permissive_using": false,
      "permissive_with_check": true
    },
    "cache_key": "rls_policy_always_true_public_notification_queue_Allow anonymous and authenticated inserts to notification_queue"
  },
  {
    "name": "auth_leaked_password_protection",
    "title": "Leaked Password Protection Disabled",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "SECURITY"
    ],
    "description": "Leaked password protection is currently disabled.",
    "detail": "Supabase Auth prevents the use of compromised passwords by checking against HaveIBeenPwned.org. Enable this feature to enhance security.",
    "cache_key": "auth_leaked_password_protection",
    "remediation": "https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection",
    "metadata": {
      "type": "auth",
      "entity": "Auth"
    }
  }
]