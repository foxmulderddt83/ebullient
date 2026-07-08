import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

class SupabasePDFService:
    def __init__(self):
        # Priority order for URL
        url_candidates = [
            os.environ.get("SUPABASE_URL"),
            os.environ.get("NEXT_PUBLIC_SUPABASE_URL"),
            os.environ.get("VITE_SUPABASE_URL")
        ]
        url = next((u for u in url_candidates if u), None)

        # Priority order for Key
        key_candidates = [
            os.environ.get("SUPABASE_SERVICE_ROLE_KEY"),
            os.environ.get("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY"),
            os.environ.get("VITE_SUPABASE_SERVICE_ROLE_KEY"),
            os.environ.get("SUPABASE_SECRET_KEY"),
            os.environ.get("SUPABASE_KEY"),
            os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
            os.environ.get("VITE_SUPABASE_ANON_KEY")
        ]
        key = next((k for k in key_candidates if k), None)

        # Clean quotes
        if url: url = url.strip("'\"").strip()
        if key: key = key.strip("'\"").strip()

        if not url or not key:
            print("WARNING: SUPABASE_URL and SUPABASE_KEY not found in environment")
            # We don't raise here, maybe we'll get it from somewhere else or it's not needed for health check
            # But let's keep it for safety in actual generation
        
        try:
            self.supabase: Client = create_client(url, key)
        except Exception as e:
            print(f"Error initializing Supabase client in SupabasePDFService: {e}")
            self.supabase = None

    def get_booking_data(self, booking_id):
        """Fetch complete booking data for PDF generation"""
        # Fetch booking with related data (using correct table names from schemas.md)
        response = self.supabase.table('bookings').select('*, customers(*), packages(*), booking_passengers(*)').eq('booking_id', booking_id).single().execute()
        
        if not response.data:
            return None
            
        booking = response.data
        
        # Transform data into a flat dictionary for template replacement
        return self._transform_data(booking)

    def _format_time(self, time_str):
        if not time_str:
            return "TBD"
        time_str = str(time_str)
        if 'am' in time_str.lower() or 'pm' in time_str.lower():
            return time_str.upper()
        try:
            if ':' not in time_str:
                return time_str.upper()
            parts = time_str.split(':')
            h = int(parts[0])
            m = parts[1] if len(parts) > 1 else '00'
            m = m[:2]
            ampm = 'PM' if h >= 12 else 'AM'
            h12 = h % 12
            if h12 == 0: h12 = 12
            return f"{h12}:{m.zfill(2)} {ampm}"
        except:
            return time_str.upper()

    def _transform_data(self, booking):
        """Map database fields to template variables according to schemas.md"""
        customer = booking.get('customers', {})
        package = booking.get('packages', {})
        # Note: In schemas.md, passengers are in booking_passengers table
        passengers = booking.get('booking_passengers', [])
        
        data = {
            # Booking Info
            'booking_id': str(booking.get('id')),
            'booking_reference': booking.get('booking_reference'),
            'total_amount': float(booking.get('total_amount', 0)),
            'paid_amount': float(booking.get('paid_amount', 0)),
            'status': booking.get('status'),
            'payment_status': booking.get('payment_status'),
            'payment_method': booking.get('payment_method'),
            'flight_date': str(booking.get('flight_date')) if booking.get('flight_date') else None,
            'flight_time': self._format_time(booking.get('flight_time')),
            'invoice_id': booking.get('invoice_id'),
            'pilot_name': booking.get('pilot_name'),
            'aircraft_registration': booking.get('aircraft_registration', '9M-BFF'),
            'notes': booking.get('notes'),
            
            # Customer Info
            'customer_name': customer.get('name'),
            'customer_email': customer.get('email'),
            'customer_phone': customer.get('phone'),
            
            # Package Info
            'package_name': package.get('name'),
            'package_description': package.get('description'),
            'package_price': float(package.get('price', 0)) if package.get('price') else 0,
            
            # Derived/Legacy variables for compatibility
            'customer_ic': '', # Not in schemas.md customers table, but might be in notes or elsewhere
            'event_date': str(booking.get('flight_date')),
            'event_time': self._format_time(booking.get('flight_time')),
            'event_venue': 'Subang Skypark Terminal, Malaysia',
            
            # Passengers
            'passengers': passengers,
            'num_passengers': len(passengers),
        }
        
        # Add nested objects for more flexible template access {customer.name}
        data['customer'] = customer
        data['booking'] = booking
        data['package'] = package
        
        return data

    def get_template_path(self, document_type):
        """Get custom template path from site_settings if it exists"""
        response = self.supabase.table('site_settings').select('value').eq('key', f'template_{document_type}').execute()
        
        if response.data and len(response.data) > 0:
            return response.data[0]['value']
        return None

    def download_template(self, storage_path):
        """Download template from Supabase Storage"""
        try:
            # Assuming 'media' bucket
            res = self.supabase.storage.from_('media').download(storage_path)
            return res.decode('utf-8')
        except Exception as e:
            print(f"Error downloading template: {e}")
            return None

    def save_generated_doc(self, booking_id, document_type, storage_path):
        """Record generated document in the database"""
        data = {
            'booking_id': booking_id,
            'document_type': document_type,
            'file_path': storage_path,
            'generated_at': 'now()'
        }
        self.supabase.table('generated_documents').insert(data).execute()
