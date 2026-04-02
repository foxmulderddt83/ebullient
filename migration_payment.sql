-- Add payment columns to event_registrations
ALTER TABLE public.event_registrations
ADD COLUMN IF NOT EXISTS paid_amount numeric DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'unpaid', -- 'unpaid', 'pending', 'paid', 'failed'
ADD COLUMN IF NOT EXISTS payment_method text, -- 'CHIP', 'QR', 'manual'
ADD COLUMN IF NOT EXISTS payment_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS payment_id text,
ADD COLUMN IF NOT EXISTS payment_proof_url text,
ADD COLUMN IF NOT EXISTS payment_type text DEFAULT 'full'; -- 'full', 'deposit'

-- Add payment configuration to events table
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS payment_required boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS payment_amount numeric DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS payment_description text,
ADD COLUMN IF NOT EXISTS enable_chip_payment boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS enable_deposit boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS deposit_amount numeric DEFAULT 0.00;

-- Create storage bucket for payment proofs if it doesn't exist (handled via dashboard usually, but good to note)
-- insert into storage.buckets (id, name) values ('payment_proofs', 'payment_proofs');
