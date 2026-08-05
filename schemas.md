# Supabase Database Schema Details

Generated on: 2026-06-26
Amended 2026-08-05: documented `pilots` and `ground_crew`, both gaining a `nric` column.

# Schema: PUBLIC

## Table: bookings
**Description**: Main booking records

### Security (RLS)
- **Status**: ENABLED
- **Staff/Admin**: FULL ACCESS (via `public.is_staff()`).
- **Public/Anon**: INSERT allowed (for booking creation). SELECT allowed (via `booking_id`).
- **Logic**: Strict scheduling integrity enforced. Data submission is validated via frontend and database constraints.

### Columns:
| Column | Type |
| --- | --- |
| booking_id | uuid |
| customer_id | uuid |
| booking_reference | text |
| total_amount | numeric |
| status | text |
| payment_status | text |
| payment_method | text |
| payment_gateway | text |
| flight_date | date |
| flight_time | text |
| created_at | timestamptz |
| updated_at | timestamptz |

---

## Table: user_interactions
**Description**: Website visitor interaction tracking

### Security (RLS)
- **Status**: ENABLED
- **Public/Anon**: INSERT ONLY. Allows tracking without exposing history.
- **Staff**: SELECT/DELETE. Allows analysis by administrators.

---

## Table: activity_logs
**Description**: System activity and audit logs

### Security (RLS)
- **Status**: ENABLED
- **Public/Anon**: INSERT ONLY.
- **Staff**: SELECT. Full audit trail for administrators.

---

## Table: events
**Description**: Upcoming flight events and experiences

### Security (RLS)
- **Status**: ENABLED
- **Public/Anon**: SELECT ONLY. Visible on website.
- **Staff**: FULL ACCESS. Management via admin panel.

---

## Table: pilots
**Description**: Pilot roster: profiles, contact details, licensing and currency

### Security (RLS)
- **Status**: ENABLED
- **Public/Anon**: NO ACCESS. Anon SELECT returns an empty set — personnel records are never exposed to the website.
- **Staff**: FULL ACCESS. Management via the admin panel Flight Ops section.

### Columns:
| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key |
| full_name | text | NOT NULL |
| email | text | NOT NULL |
| phone | text | NOT NULL |
| nric | text | National identity number. Nullable — existing rows predate the column |
| caam_license_no | text | |
| license_type | text | PPL / CPL / ATPL |
| license_expiry_date | date | |
| medical_expiry_date | date | |
| is_active | boolean | |
| notes | text | |
| user_id | uuid | Optional link to an auth user |
| created_at | timestamptz | |

---

## Table: ground_crew
**Description**: Ground crew roster: profiles, contact details and pass currency

### Security (RLS)
- **Status**: ENABLED
- **Public/Anon**: NO ACCESS. Anon SELECT returns an empty set — personnel records are never exposed to the website.
- **Staff**: FULL ACCESS. Management via the admin panel Flight Ops section.

### Columns:
| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key |
| full_name | text | NOT NULL |
| email | text | NOT NULL |
| phone | text | NOT NULL |
| nric | text | National identity number. Nullable — existing rows predate the column |
| crew_role | text | Dispatcher / Marshaller / Crew |
| airport_pass_expiry_date | date | |
| adp_expiry_date | date | |
| is_active | boolean | |
| notes | text | |
| user_id | uuid | Optional link to an auth user |
| created_at | timestamptz | |

---

# Security Functions (Hardened)

These functions are defined with `SECURITY DEFINER` and a secure `search_path` to prevent search path hijacking.

```sql
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE id = auth.uid() AND is_approved = true
    AND (is_staff = true OR role IN ('Administrator', 'admin', 'Engineer', 'Staff'))
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE id = auth.uid() AND is_approved = true
    AND (role IN ('Administrator', 'admin'))
  );
$$;

-- Global hardening
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_blocked_times(date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_timeslot_taken(date, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_or_create_customer(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_or_create_customer(text, text, text, date, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_payment_proof(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_admin_email_exists(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
```

*Note: For the full set of security fixes, refer to [sql_query.md](file:///c:/Games/oneday-clone-main/sql_query.md).*
