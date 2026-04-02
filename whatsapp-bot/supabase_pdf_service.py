import os
from supabase import create_client, Client
from dotenv import load_dotenv

# Only load .env if it exists and we are not in Fly.io
if not os.environ.get("FLY_APP_NAME"):
    load_dotenv()

class SupabasePDFService:
    def __init__(self):
        self.missing_info = []
        # Debug: Print all environment variable keys that might be relevant
        print("DEBUG: Checking environment variables for Supabase...")
        all_keys = list(os.environ.keys())
        relevant_keys = [k for k in all_keys if "SUPABASE" in k.upper() or "VITE" in k.upper() or "NEXT" in k.upper()]
        print(f"DEBUG: Found {len(relevant_keys)} relevant env keys out of {len(all_keys)} total")
        
        # Priority order for URL
        url_candidates = {
            "SUPABASE_URL": os.environ.get("SUPABASE_URL"),
            "NEXT_PUBLIC_SUPABASE_URL": os.environ.get("NEXT_PUBLIC_SUPABASE_URL"),
            "VITE_SUPABASE_URL": os.environ.get("VITE_SUPABASE_URL")
        }
        url = next((u for u in url_candidates.values() if u), None)
        
        # Priority order for Key (Service role is best for PDF service)
        key_candidates = {
            "SUPABASE_SERVICE_ROLE_KEY": os.environ.get("SUPABASE_SERVICE_ROLE_KEY"),
            "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY": os.environ.get("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY"),
            "VITE_SUPABASE_SERVICE_ROLE_KEY": os.environ.get("VITE_SUPABASE_SERVICE_ROLE_KEY"),
            "SUPABASE_SECRET_KEY": os.environ.get("SUPABASE_SECRET_KEY"),
            "SUPABASE_KEY": os.environ.get("SUPABASE_KEY"),
            "NEXT_PUBLIC_SUPABASE_ANON_KEY": os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
            "VITE_SUPABASE_ANON_KEY": os.environ.get("VITE_SUPABASE_ANON_KEY")
        }
        key = next((k for k in key_candidates.values() if k), None)
        
        # Clean quotes and whitespace
        if url: 
            url = url.strip("'\"").strip()
            print(f"DEBUG: Using URL: {url}")
        else:
            self.missing_info.append("URL (tried: " + ", ".join(url_candidates.keys()) + ")")
        
        if key: 
            key = key.strip("'\"").strip()
            print(f"DEBUG: Using Key starting with: {key[:10]}...")
        else:
            self.missing_info.append("Key (tried: " + ", ".join(key_candidates.keys()) + ")")

        if not url or not key:
            print(f"ERROR: Supabase credentials missing! Missing: {', '.join(self.missing_info)}")
            self.supabase = None
            return

        try:
            # Using the most basic initialization with the upgraded library
            # to resolve the 'proxy' and 'ClientOptions' errors.
            self.supabase: Client = create_client(url, key)
            print("DEBUG: Supabase client created successfully")
            
            # Test connection immediately
            try:
                self.supabase.table('site_settings').select('key').limit(1).execute()
                print("✅ Supabase Connection Test Successful (Python)")
            except Exception as conn_err:
                err_msg = str(conn_err)
                print(f"❌ Supabase Connection Test Failed (Python): {err_msg}")
                self.missing_info.append(f"Connection test failed: {err_msg}")
        except Exception as e:
            err_msg = str(e)
            print(f"ERROR: Failed to initialize Supabase client: {err_msg}")
            self.missing_info.append(f"Initialization failed: {err_msg}")
            self.supabase = None

    def get_booking_data(self, booking_id):
        if not self.supabase:
            details = " | ".join(self.missing_info) if self.missing_info else "Unknown error during initialization"
            raise Exception(f"Supabase client is not initialized. Details: {details}. Please ensure secrets are set in Fly.io using 'fly secrets set'.")

        try:
            # The input might be a UUID (database ID) or a booking_reference (BK-XXXXXX).
            # We try to determine which one it is.
            is_reference = booking_id.startswith('BK-')
            
            # Fetch booking with related data
            query = self.supabase.table('bookings').select(
                '*, customers(*), booking_items(*, packages(*)), booking_passengers(*)'
            )
            
            if is_reference:
                print(f"DEBUG: Searching by booking_reference: {booking_id}")
                response = query.eq('booking_reference', booking_id).single().execute()
            else:
                print(f"DEBUG: Searching by ID (UUID): {booking_id}")
                response = query.eq('booking_id', booking_id).single().execute()
            
            return response.data
        except Exception as e:
            print(f"Error fetching booking data: {e}")
            raise

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
            'flight_time': booking.get('flight_time'),
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
            'event_time': booking.get('flight_time'),
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

    def get_template_html(self, document_type):
        """Get HTML template row from document_templates table"""
        import json
        template_row = None
        # Try to get default template first
        response = self.supabase.table('document_templates').select('*').eq('document_type', document_type).eq('is_default', True).execute()
        
        if response.data and len(response.data) > 0:
            template_row = response.data[0]
            
        if not template_row:
            # Fallback to any template for this type
            response = self.supabase.table('document_templates').select('*').eq('document_type', document_type).execute()
            if response.data and len(response.data) > 0:
                template_row = response.data[0]
            
        if not template_row and document_type == 'certificate':
            # Special case for 'certificate'
            response = self.supabase.table('document_templates').select('*').eq('document_type', 'flight certificate').eq('is_default', True).execute()
            if response.data and len(response.data) > 0:
                template_row = response.data[0]
            else:
                response = self.supabase.table('document_templates').select('*').eq('document_type', 'flight certificate').execute()
                if response.data and len(response.data) > 0:
                    template_row = response.data[0]
                
        if template_row:
            # Fetch background and margin settings from site_settings
            doc_type_for_settings = template_row.get('document_type', document_type)
            settings_key = f"template_{doc_type_for_settings}_settings"
            
            settings_response = self.supabase.table('site_settings').select('value').eq('key', settings_key).execute()
            if settings_response.data and len(settings_response.data) > 0:
                try:
                    settings_val = json.loads(settings_response.data[0]['value'])
                    template_row['background_url'] = settings_val.get('url', '')
                    template_row['background_opacity'] = settings_val.get('opacity', 0.15)
                    template_row['background_style'] = settings_val.get('style', 'center')
                    if 'pageMargins' in settings_val:
                        template_row['margin_left'] = settings_val['pageMargins'].get('left', 20)
                        template_row['margin_right'] = settings_val['pageMargins'].get('right', 20)
                        template_row['margin_top'] = settings_val['pageMargins'].get('top', 20)
                        template_row['margin_bottom'] = settings_val['pageMargins'].get('bottom', 20)
                except Exception as e:
                    print(f"DEBUG: Failed to parse template settings for {settings_key}: {e}")

            return template_row
            
        return None

    def save_generated_doc(self, booking_id, document_type, storage_path):
        """Record generated document in the database"""
        real_uuid = booking_id
        
        # If booking_id is a reference (BK-XXXX), we must find the real UUID first
        if booking_id.startswith('BK-'):
            print(f"DEBUG: Finding UUID for reference {booking_id} before saving doc")
            res = self.supabase.table('bookings').select('id').eq('booking_reference', booking_id).single().execute()
            if res.data:
                real_uuid = res.data['id']
                print(f"DEBUG: Found UUID {real_uuid} for reference {booking_id}")

        data = {
            'booking_id': real_uuid,
            'document_type': document_type,
            'file_path': storage_path,
            'generated_at': 'now()'
        }
        self.supabase.table('generated_documents').insert(data).execute()
