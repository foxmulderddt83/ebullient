# Complete Setup Guide - Variable-Based PDF Generation

## 🎯 Overview

This system generates PDFs with **automatic variable replacement** from your Supabase database.

**Example:**
- Template: `"Hello {customer_name}, your booking {booking_id} is confirmed!"`
- Database: `customer_name = "Amir"`, `booking_id = "YL11002"`
- Result: `"Hello Amir, your booking YL11002 is confirmed!"`

---

## 📋 Prerequisites

```bash
# Install Python packages
pip install reportlab pillow flask flask-cors supabase python-dotenv --break-system-packages

# Install Node packages (for React frontend)
npm install
```

---

## 🚀 Quick Start (5 Steps)

### Step 1: Setup Environment Variables

Create `.env` file in your project root:

```env
# .env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-or-service-key
```

### Step 2: Setup Supabase Database

Run this SQL in your Supabase SQL Editor:

```sql
-- Main bookings table
CREATE TABLE bookings (
  id TEXT PRIMARY KEY,
  customer_id UUID REFERENCES customers(id),
  invoice_id TEXT,
  pilot_id UUID,
  aircraft_registration TEXT DEFAULT '9M-BFF',
  
  -- Flight details
  flight_date DATE,
  flight_time TIME,
  num_flights INTEGER DEFAULT 1,
  venue TEXT DEFAULT 'Subang Skypark Terminal, Malaysia',
  meeting_time TIME,
  
  -- Package info  
  package_id UUID REFERENCES packages(id),
  
  -- Payment
  total_amount DECIMAL(10,2),
  payment_date DATE,
  payment_method TEXT,
  payment_status TEXT DEFAULT 'pending',
  
  -- Refund
  refund_amount DECIMAL(10,2),
  refund_reason TEXT,
  voucher_id TEXT,
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Customers table
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  ic_number TEXT,
  member_id TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Passengers table
CREATE TABLE passengers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id TEXT REFERENCES bookings(id),
  
  -- Role
  is_copilot BOOLEAN DEFAULT FALSE,
  is_visitor BOOLEAN DEFAULT FALSE,
  
  -- Personal info
  name TEXT NOT NULL,
  ic_passport TEXT,
  nationality TEXT,
  gender TEXT,
  date_of_birth DATE,
  height TEXT,
  weight TEXT,
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Packages table
CREATE TABLE packages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT,
  description TEXT,
  price DECIMAL(10,2)
);

-- Pilots table
CREATE TABLE pilots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  license_number TEXT,
  signature TEXT
);

-- Invoices table
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number TEXT UNIQUE,
  booking_id TEXT REFERENCES bookings(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Track generated PDFs
CREATE TABLE generated_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id TEXT REFERENCES bookings(id),
  document_type TEXT,
  file_path TEXT,
  generated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX idx_bookings_customer ON bookings(customer_id);
CREATE INDEX idx_passengers_booking ON passengers(booking_id);
CREATE INDEX idx_generated_docs_booking ON generated_documents(booking_id);

-- Storage Buckets Setup
-- 1. Create the bucket (Using existing 'media' bucket or creating it if missing)
-- If you are using the provided code, the bucket name is 'media'.
-- Documents will be stored under the 'booking-documents/' folder prefix.
INSERT INTO storage.buckets (id, name, public) 
VALUES ('media', 'media', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Set up policies (enable RLS on storage.objects if not already enabled)
-- Allow public read access to documents
CREATE POLICY "Public Access" ON storage.objects
  FOR SELECT USING (bucket_id = 'media');

-- Allow authenticated users to upload documents
CREATE POLICY "Authenticated Uploads" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'media' 
    AND auth.role() = 'authenticated'
  );
```

### Step 3: Insert Sample Data

```sql
-- Insert sample customer
INSERT INTO customers (id, name, email, phone, ic_number, member_id)
VALUES (
  '123e4567-e89b-12d3-a456-426614174000',
  'Amir Abdullah',
  'amir@example.com',
  '+60123456789',
  '920815-10-1234',
  'M001'
);

-- Insert sample package
INSERT INTO packages (id, name, code, description, price)
VALUES (
  '123e4567-e89b-12d3-a456-426614174001',
  'Premium A2+ Package',
  'A2+',
  '1 Co-Pilot + 1 Passenger',
  2499.00
);

-- Insert sample pilot
INSERT INTO pilots (id, name, license_number)
VALUES (
  '123e4567-e89b-12d3-a456-426614174002',
  'CAPT HASSAN',
  'CPL-12345'
);

-- Insert sample booking
INSERT INTO bookings (
  id, customer_id, package_id, pilot_id,
  flight_date, flight_time, invoice_id,
  total_amount, payment_status
)
VALUES (
  'YL11002',
  '123e4567-e89b-12d3-a456-426614174000',
  '123e4567-e89b-12d3-a456-426614174001',
  '123e4567-e89b-12d3-a456-426614174002',
  '2026-03-20',
  '10:00:00',
  'INV26/0001',
  2499.00,
  'paid'
);

-- Insert passengers
INSERT INTO passengers (booking_id, is_copilot, name, ic_passport, nationality, gender, date_of_birth, height, weight)
VALUES 
(
  'YL11002',
  TRUE,
  'Amir Abdullah',
  '920815-10-1234',
  'Malaysian',
  'Male',
  '1992-08-15',
  '175 cm',
  '75 kg'
),
(
  'YL11002',
  FALSE,
  'Sarah Ahmad',
  '950212-08-5678',
  'Malaysian',
  'Female',
  '1995-02-12',
  '160 cm',
  '55 kg'
);

-- Insert invoice
INSERT INTO invoices (invoice_number, booking_id)
VALUES ('INV26/0001', 'YL11002');
```

### Step 4: Start Backend API

```bash
# Run the Flask API
python api_with_supabase.py
```

API will be available at `http://localhost:5000`

### Step 5: Use in React Frontend

```jsx
import BookingPDFGenerator from './components/BookingPDFGenerator';

function BookingPage() {
  return (
    <div>
      <h1>Booking Management</h1>
      
      {/* Just pass the booking ID - it handles everything else! */}
      <BookingPDFGenerator bookingId="YL11002" />
    </div>
  );
}
```

---

## 🔧 How Variable Replacement Works

### 1. Define Variables in Templates

Templates use `{variable_name}` placeholders:

```python
template = {
    'customer_name': '{customer_name}',
    'booking_id': '{booking_id}',
    'total_amount': '{total_amount}',
    'event_date': '{event_date}'
}
```

### 2. Fetch Data from Supabase

The system automatically fetches data:

```python
booking_data = supabase.table('bookings').select('''
    *,
    customers (*),
    packages (*),
    passengers (*)
''').eq('id', 'YL11002').single()
```

### 3. Map Database Columns to Variables

In `supabase_pdf_service.py`, the `_transform_booking_data()` function maps database columns to template variables:

```python
def _transform_booking_data(self, booking, passengers, pilot):
    return {
        'customer_name': booking['customers']['name'],  # {customer_name}
        'booking_id': booking['booking_id'],                     # {booking_id}
        'total_amount': booking['total_amount'],         # {total_amount}
        # ... more mappings
    }
```

### 4. Replace Variables

The template engine replaces all `{variables}`:

```python
# Template: "Hello {customer_name}"
# Data: {"customer_name": "Amir"}
# Result: "Hello Amir"
```

---

## 📝 Available Template Variables

Here are all the variables you can use in your templates:

### Customer Info
- `{customer_name}` - Full customer name
- `{customer_email}` - Email address
- `{customer_phone}` - Phone number
- `{customer_ic}` - IC/Passport number
- `{customer_member_id}` - Member ID

### Booking Info
- `{booking_id}` - Booking ID
- `{event_date}` - Formatted flight date
- `{event_time}` - Flight time
- `{event_venue}` - Event venue
- `{meeting_time}` - Meeting time
- `{num_flights}` - Number of flights
- `{num_passengers}` - Number of passengers

### Package Info
- `{package_name}` - Package name
- `{package_type}` - Package code
- `{package_description}` - Package description

### Payment Info
- `{invoice_id}` - Invoice number
- `{invoice_date}` - Invoice date
- `{total_amount}` - Total amount
- `{payment_date}` - Payment date
- `{payment_method}` - Payment method
- `{payment_status}` - Payment status

### Pilot Info
- `{pilot_name}` - Pilot name
- `{pilot_code}` - License number
- `{operator_name}` - Operator company
- `{plane_registration}` - Aircraft registration

### Arrays (for loops in templates)
- `{passengers}` - Array of passenger objects
- `{visitors}` - Array of visitors
- `{addons}` - Array of add-ons

---

## 🎨 Customizing Templates

### Option 1: Modify Default Templates

Edit `template_pdf_generator.py`:

```python
def _get_default_template(self, template_name):
    templates = {
        'invoice_paid': {
            'title': 'INVOICE',
            'customer_name': '{customer_name}',  # Add more variables
            'custom_field': '{your_database_column}',
            # ...
        }
    }
```

### Option 2: Add Custom Template Variables

In `supabase_pdf_service.py`, add your mappings:

```python
def _transform_booking_data(self, booking, passengers, pilot):
    return {
        # ... existing mappings
        
        # Add your custom mappings
        'company_name': booking.get('company_name', ''),
        'special_notes': booking.get('special_notes', ''),
        'discount_percentage': booking.get('discount', '0'),
    }
```

### Option 3: Create New Document Template

```python
# In template_pdf_generator.py
def _get_default_template(self, template_name):
    templates = {
        # ... existing templates
        
        'custom_receipt': {
            'title': 'RECEIPT',
            'receipt_number': '{receipt_number}',
            'customer': '{customer_name}',
            'amount': '{total_amount}',
            'date': '{payment_date}'
        }
    }
```

---

## 🔌 API Endpoints

### 1. Generate PDF from Booking ID

```bash
GET /api/generate-pdf/{booking_id}/{document_type}

# Example
GET /api/generate-pdf/YL11002/invoice_paid
```

Returns: PDF file download

### 2. Generate All Documents

```bash
GET /api/generate-all-pdfs/{booking_id}

# Example
GET /api/generate-all-pdfs/YL11002
```

Returns: JSON with paths to all generated PDFs

### 3. Get Booking Data (Preview)

```bash
GET /api/booking-data/{booking_id}

# Example
GET /api/booking-data/YL11002
```

Returns: JSON with all data that will be used for variable replacement

### 4. Custom Data (No Supabase)

```bash
POST /api/generate-pdf-custom

Body:
{
  "document_type": "invoice_paid",
  "data": {
    "customer_name": "Amir",
    "booking_id": "TEST001",
    "total_amount": "1,500"
  }
}
```

Returns: PDF file with custom data

---

## 🧪 Testing

### Test API Endpoints

```bash
# Test health check
curl http://localhost:5000/health

# Get booking data
curl http://localhost:5000/api/booking-data/YL11002

# Generate invoice
curl http://localhost:5000/api/generate-pdf/YL11002/invoice_paid --output invoice.pdf
```

### Test Variable Replacement

```python
from template_pdf_generator import TemplateEngine

engine = TemplateEngine()

template = "Hello {name}, your booking {id} on {date} is confirmed!"
data = {
    "name": "Amir",
    "id": "YL11002",
    "date": "20th March 2026"
}

result = engine.replace_variables(template, data)
print(result)
# Output: "Hello Amir, your booking YL11002 on 20th March 2026 is confirmed!"
```

---

## 📊 Database Column to Variable Mapping

| Supabase Column | Template Variable | Example Value |
|----------------|------------------|---------------|
| `customers.name` | `{customer_name}` | "Amir Abdullah" |
| `customers.email` | `{customer_email}` | "amir@example.com" |
| `bookings.id` | `{booking_id}` | "YL11002" |
| `bookings.flight_date` | `{event_date}` | "20th March 2026" |
| `bookings.total_amount` | `{total_amount}` | "2,499" |
| `packages.name` | `{package_name}` | "A2+ Premium" |
| `pilots.name` | `{pilot_name}` | "CAPT HASSAN" |

---

## 🎯 Common Use Cases

### 1. Generate Invoice When Booking is Paid

```python
# In your booking payment handler
def on_payment_received(booking_id):
    service = SupabasePDFService(SUPABASE_URL, SUPABASE_KEY)
    
    # Generate invoice
    invoice_pdf = service.generate_pdf_for_booking(
        booking_id=booking_id,
        document_type='invoice_paid'
    )
    
    # Email to customer
    send_email(customer_email, invoice_pdf)
```

### 2. Auto-Generate All Documents on Booking Confirmation

```python
def on_booking_confirmed(booking_id):
    service = SupabasePDFService(SUPABASE_URL, SUPABASE_KEY)
    
    # Generate all documents
    docs = service.generate_all_documents_for_booking(booking_id)
    
    # Email package to customer
    send_email_with_attachments(customer_email, docs.values())
```

### 3. Generate Certificate After Flight

```python
def on_flight_completed(booking_id):
    service = SupabasePDFService(SUPABASE_URL, SUPABASE_KEY)
    
    # Generate certificate for each passenger
    booking_data = service.fetch_booking_data(booking_id)
    
    for passenger in booking_data['passengers']:
        cert = service.pdf_generator.generate_from_template(
            'certificate',
            {
                **booking_data,
                'customer_name': passenger['name'],
                'customer_id': passenger['ic_passport']
            }
        )
```

---

## 🐛 Troubleshooting

### Issue: Variables Not Replaced

**Problem:** PDF shows `{customer_name}` instead of "Amir"

**Solution:**
1. Check variable name matches exactly (case-sensitive)
2. Verify data is in Supabase
3. Check `_transform_booking_data()` mapping

```python
# Add debug logging
print("Template:", template)
print("Data:", booking_data)
```

### Issue: Supabase Connection Error

**Problem:** "Could not connect to Supabase"

**Solution:**
1. Check `.env` file has correct URL and key
2. Verify Supabase API is accessible
3. Check RLS policies allow reading data

### Issue: PDF Generation Fails

**Problem:** "Error generating PDF"

**Solution:**
1. Check all required fields have data
2. Handle missing data gracefully:

```python
'customer_name': booking.get('customers', {}).get('name', 'N/A')
```

---

## 🚀 Deployment

### Deploy on Fly.io

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Login
flyctl auth login

# Deploy
flyctl launch
flyctl deploy
```

### Environment Variables on Fly.io

```bash
flyctl secrets set SUPABASE_URL=https://your-project.supabase.co
flyctl secrets set SUPABASE_KEY=your-key
```

---

## 📚 Next Steps

1. ✅ Test with sample booking
2. ✅ Customize templates for your brand
3. ✅ Add more template variables as needed
4. ✅ Integrate with email service
5. ✅ Set up automated document generation
6. ✅ Add custom document types

---

## 💡 Pro Tips

1. **Use Nested Variables:**
```python
data = {
    'customer': {
        'name': 'Amir',
        'email': 'amir@example.com'
    }
}
# Template: {customer.name} = "Amir"
```

2. **Default Values:**
```python
'{customer_name}' with data {} = '{customer_name}'  # Not replaced
# Handle this in transform function:
'customer_name': customer.get('name', 'Guest')
```

3. **Date Formatting:**
```python
def _format_date(self, date):
    # Customize date format
    return date.strftime('%d/%m/%Y')  # DD/MM/YYYY
```

---

## 🎉 That's It!

Your PDF generation system is ready! All `{variables}` will automatically be replaced with data from your Supabase database.

**Questions?** Check the code comments or the API response for debugging info.
