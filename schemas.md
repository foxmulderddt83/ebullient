# Supabase Database Schema Details

Generated on: 2026-04-01T22:42:53.951Z

# Schema: PUBLIC

## Table: registrations
**Description**: Event registration data

### Columns: (No data found to infer structure)

---

## Table: events
**Description**: Specific event instances

### Columns (Detected):
| Column | Type |
| --- | --- |
| id | string |
| name | string |
| event_date | string |
| event_time | string |
| is_active | boolean |
| created_at | string |
| location | string |
| event_id | nullable |
| start_time | string |
| end_time | string |
| created_by | nullable |
| event_description | string |
| event_program | nullable |
| event_image_url | string |
| price | number |
| promotion_price | number |
| event_profile_id | string |
| promotion_start_at | nullable |
| promotion_end_at | nullable |
| is_live | boolean |
| event_registration_template | string |
| event_time_slots | string |
| event_schedule | string |
| payment_required | boolean |
| payment_amount | number |
| payment_description | string |
| enable_chip_payment | boolean |
| enable_deposit | boolean |
| deposit_amount | number |

---

## Table: event_profiles
**Description**: Reusable event templates

### Columns (Detected):
| Column | Type |
| --- | --- |
| id | string |
| name | string |
| event_title | string |
| event_location | string |
| event_price | string |
| event_promotion_price | string |
| event_description | string |
| event_hero_image | string |
| event_registration_template | string |
| event_time_slots | string |
| event_schedule | string |
| created_by | string |
| created_at | string |
| default_start_time | string |
| default_end_time | string |
| is_live | boolean |

---

## Table: document_templates
**Description**: PDF/Word templates

### Columns (Detected):
| Column | Type |
| --- | --- |
| id | string |
| name | string |
| document_type | string |
| content | string |
| is_default | boolean |
| created_at | string |

---

## Table: activity_logs
**Description**: Admin audit trail

### Columns (Detected):
| Column | Type |
| --- | --- |
| id | string |
| admin_email | string |
| action_type | string |
| entity_type | string |
| entity_id | string |
| details | object |
| ip_address | string |
| created_at | string |

---

## Table: app_settings
**Description**: Global app config

### Columns: (No data found to infer structure)

---

## Table: business_hours
**Description**: Operating hours

### Columns: (No data found to infer structure)

---

## Table: email_configs
**Description**: SMTP and email settings

### Columns: (No data found to infer structure)

---

## Table: notification_logs
**Description**: Notification history

### Columns: (No data found to infer structure)

---

## Table: whatsapp_configs
**Description**: WhatsApp credentials

### Columns: (No data found to infer structure)

---

# Schema: AUTH

## Table: users
**Description**: User accounts and authentication

### Columns: (No data found to infer structure)

---

## Table: identities
**Description**: External provider identities (Google, etc.)

### Columns: (No data found to infer structure)

---

## Table: sessions
**Description**: Active user sessions

### Columns: (No data found to infer structure)

---

# Schema: STORAGE

## Table: buckets
**Description**: Storage containers (media, docs, etc.)

### Columns: (No data found to infer structure)

---

## Table: objects
**Description**: Metadata for uploaded files

### Columns: (No data found to infer structure)

---

