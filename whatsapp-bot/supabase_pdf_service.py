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

    def _format_date(self, date_str):
        if not date_str:
            return ""
        try:
            from datetime import datetime
            # Assume YYYY-MM-DD or similar
            if 'T' in date_str:
                dt = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
            else:
                dt = datetime.strptime(date_str, "%Y-%m-%d")
            return dt.strftime("%A %d %b %Y")
        except:
            return str(date_str)

    def build_flat_variables(self, booking, passenger=None):
        """
        Builds a completely flat dictionary of formatted string variables 
        exactly matching the frontend's pdfGenerator.ts logic.
        """
        customer = booking.get('customers', {}) or {}
        items = booking.get('booking_items', []) or []
        if items and len(items) > 0:
            raw_pkg = items[0].get('packages') or items[0].get('package')
            if isinstance(raw_pkg, list):
                raw_pkg = raw_pkg[0] if raw_pkg else None
            first_package = raw_pkg or {}
        else:
            raw_pkg = booking.get('packages') or booking.get('package')
            if isinstance(raw_pkg, list):
                raw_pkg = raw_pkg[0] if raw_pkg else None
            first_package = raw_pkg or {}
        
        passengers = booking.get('booking_passengers', []) or []
        current_passenger = passenger if passenger else (passengers[0] if passengers else {})

        def fmt_rm(val):
            if val is None or val == "": return ""
            try:
                return f"RM {float(val):.2f}".replace('.00', '')
            except:
                return f"RM {val}"

        total_amount = booking.get('total_amount')
        paid_amount = booking.get('paid_amount')
        deposit_amount = booking.get('deposit_amount')
        discount_amount = booking.get('discount_amount')
        
        is_dep_empty = deposit_amount in [None, "", 0, "0", 0.0]
        calc_deposit = total_amount if is_dep_empty else deposit_amount
        
        payment_type = (booking.get('payment_type') or "").lower()
        amount_to_pay = calc_deposit if payment_type == 'deposit' else total_amount
        
        is_full_payment = payment_type in ['full payment', 'full']
        db_outstanding = booking.get('outstanding_balance')
        if db_outstanding is not None:
            outstanding_balance = db_outstanding
        else:
            outstanding_balance = 0 if is_full_payment else (float(total_amount or 0) - float(deposit_amount or 0))

        vars_dict = {
            "customer.name": str(customer.get('name') or "").upper(),
            "customer.email": str(customer.get('email') or "").upper(),
            "customer.phone": str(customer.get('phone') or "").upper(),
            "customer.created_at": self._format_date(customer.get('created_at')),
            
            "booking.booking_reference": str(booking.get('booking_reference') or "").upper(),
            "booking.reference": str(booking.get('booking_reference') or "").upper(),
            "booking.date": self._format_date(booking.get('created_at')),
            "booking.time": self._format_time(booking.get('created_at')),
            "booking.status": str(booking.get('status') or "").upper(),
            "booking.total_amount": fmt_rm(total_amount),
            "booking.paid_amount": fmt_rm(paid_amount),
            "booking.payment_status": str(booking.get('payment_status') or "").upper(),
            "booking.payment_method": str(booking.get('payment_method') or "").upper(),
            "booking.payment_gateway": str(booking.get('payment_gateway') or "").upper(),
            "booking.paid_at": self._format_date(booking.get('paid_at')),
            "booking.payment_id": str(booking.get('payment_id') or "").upper(),
            "booking.payment_type": str(booking.get('payment_type') or "").upper(),
            "booking.deposit_amount": fmt_rm(calc_deposit),
            "deposit": fmt_rm(calc_deposit),
            "deposit_amount": fmt_rm(calc_deposit),
            "booking.discount_amount": fmt_rm(discount_amount) or "RM 0",
            "discount": fmt_rm(discount_amount) or "RM 0",
            "discount_amount": fmt_rm(discount_amount) or "RM 0",
            "booking.amount_to_pay": fmt_rm(amount_to_pay),
            "booking.outstanding_balance": fmt_rm(outstanding_balance),
            
            "booking.flight_date": self._format_date(booking.get('flight_date')),
            "booking.flight_time": self._format_time(booking.get('flight_time')).upper(),
            "booking.invoice_id": str(booking.get('invoice_id') or "").upper(),
            "booking.pilot_name": str(booking.get('pilot_name') or "").upper(),
            "booking.aircraft_registration": str(booking.get('aircraft_registration') or "").upper(),
            "booking.notes": str(booking.get('notes') or "").upper(),
            
            "package.name": str(first_package.get('name') or ", ".join([i.get('packages', {}).get('name') or "" for i in items if i.get('packages')]) or "").upper(),
            "package.description": str(first_package.get('description') or "").upper(),
            "package.price": fmt_rm(first_package.get('price')),
            "package.quantity": str(items[0].get('quantity', '1')) if items else "1",
            "package.route": str(first_package.get('route') or "").upper(),
            
            "minus_1hours": "1",
            
            "passenger.name": str(current_passenger.get('name') or "").upper(),
            "passenger.type": str(current_passenger.get('type') or "").upper(),
            "passenger.ic": str(current_passenger.get('ic_passport_number') or current_passenger.get('nric_number') or "").upper(),
            "passenger.ic_passport_number": str(current_passenger.get('ic_passport_number') or current_passenger.get('nric_number') or "").upper(),
            "passenger.ic_passport": str(current_passenger.get('ic_passport_number') or current_passenger.get('nric_number') or "").upper(),
            "passenger.passport": str(current_passenger.get('ic_passport_number') or current_passenger.get('nric_number') or "").upper(),
            "passenger.country": str(current_passenger.get('country_of_origin') or "").upper(),
            "passenger.country_of_origin": str(current_passenger.get('country_of_origin') or "").upper(),
            "passenger.weight": f"{current_passenger.get('weight')} kg" if current_passenger.get('weight') else "",
            "passenger.height": f"{current_passenger.get('height')} cm" if current_passenger.get('height') else "",
            "passenger.gender": str(current_passenger.get('gender') or "").upper(),
            "passenger.status": str(current_passenger.get('status') or "Passenger").upper(),
            
            "flight.date": self._format_date(booking.get('flight_date')),
            "flight.time": self._format_time(booking.get('flight_time')).upper(),
            "pilot.name": str(booking.get('pilot_name') or "").upper(),
            "aircraft.registration": str(booking.get('aircraft_registration') or "").upper(),
            
            # Legacy aliases
            "customer_name": str(customer.get('name') or "").upper(),
            "customer_email": str(customer.get('email') or "").upper(),
            "customer_phone": str(customer.get('phone') or "").upper(),
            "booking_id": str(booking.get('booking_reference') or "").upper(),
            "booking_reference": str(booking.get('booking_reference') or "").upper(),
            "invoice_id": str(booking.get('invoice_id') or "").upper(),
            "flight_date": self._format_date(booking.get('flight_date')),
            "flight_time": self._format_time(booking.get('flight_time')).upper(),
            "package_name": str(first_package.get('name') or "").upper(),
            "total_amount": fmt_rm(total_amount),
            "paid_amount": fmt_rm(paid_amount),
            "status": str(booking.get('status') or "").upper(),
            "payment_status": str(booking.get('payment_status') or "").upper(),
            "payment_method": str(booking.get('payment_method') or "").upper(),
            "payment_type": str(booking.get('payment_type') or "").upper(),
            "amount_to_pay": fmt_rm(amount_to_pay),
            "pilot_name": str(booking.get('pilot_name') or "").upper(),
            "aircraft_registration": str(booking.get('aircraft_registration') or "").upper(),
        }

        # Build list representations for passengers and items
        # If the user has {booking.items_text} in a table cell, we join with newlines.
        if items:
            def get_item_package_name(item):
                raw_pkg = item.get('packages') or item.get('package')
                if isinstance(raw_pkg, list):
                    raw_pkg = raw_pkg[0] if raw_pkg else None
                if isinstance(raw_pkg, dict):
                    return raw_pkg.get('name')
                return None

            items_text = "\n".join([
                f"- {str(get_item_package_name(i) or '').upper()} (Qty: {i.get('quantity', '')}) - {fmt_rm(i.get('total_price'))}"
                for i in items
            ])
            vars_dict["booking.items_text"] = items_text
            vars_dict["booking.add_items_summary"] = items_text
            vars_dict["add_items_amount"] = items_text
        else:
            vars_dict["booking.items_text"] = ""
            vars_dict["booking.add_items_summary"] = ""
            vars_dict["add_items_amount"] = ""
            
        # For passengers, we could format them as a newline separated string if requested
        if passengers:
            pax_texts = []
            for idx, p in enumerate(passengers):
                name = str(p.get('name') or '').upper()
                pax_type = str(p.get('type') or 'PASSENGER').upper()
                ic = str(p.get('ic_passport_number') or '').upper()
                pax_texts.append(f"{idx+1}. {name} ({pax_type}) - IC/Passport: {ic}")
            vars_dict["passengers_text"] = "\n".join(pax_texts)

        return vars_dict

    def _transform_data(self, booking):
        """Map database fields to template variables according to schemas.md"""
        customer = booking.get('customers', {}) or {}
        items = booking.get('booking_items', []) or []
        if items and len(items) > 0:
            raw_pkg = items[0].get('packages') or items[0].get('package')
            if isinstance(raw_pkg, list):
                raw_pkg = raw_pkg[0] if raw_pkg else None
            package = raw_pkg or {}
        else:
            raw_pkg = booking.get('packages') or booking.get('package')
            if isinstance(raw_pkg, list):
                raw_pkg = raw_pkg[0] if raw_pkg else None
            package = raw_pkg or {}
        # Note: In schemas.md, passengers are in booking_passengers table
        passengers = booking.get('booking_passengers', []) or []
        
        # Calculate deposit and outstanding balance logic matching Vercel
        total_amount = float(booking.get('total_amount', 0))
        paid_amount = float(booking.get('paid_amount', 0))
        deposit_amount = booking.get('deposit_amount')
        
        # Logic from Vercel: (dep === undefined || dep === null || dep === "" || dep === 0 || dep === "0") ? total_amount : dep
        is_dep_empty = deposit_amount in [None, "", 0, "0"]
        calc_deposit = total_amount if is_dep_empty else float(deposit_amount)
        
        payment_type = (booking.get('payment_type') or "").lower()
        amount_to_pay = calc_deposit if payment_type == 'deposit' else total_amount
        
        is_full_payment = payment_type in ['full payment', 'full']
        outstanding_balance = 0 if is_full_payment else (total_amount - (float(deposit_amount or 0)))
        
        # If the database has an explicit outstanding_balance, use it
        db_outstanding = booking.get('outstanding_balance')
        if db_outstanding is not None:
            final_outstanding = db_outstanding
        else:
            final_outstanding = outstanding_balance

        data = {
            # Booking Info
            'booking_id': str(booking.get('id')),
            'booking_reference': booking.get('booking_reference'),
            'total_amount': total_amount,
            'paid_amount': paid_amount,
            'status': booking.get('status'),
            'payment_status': booking.get('payment_status'),
            'payment_method': booking.get('payment_method'),
            'payment_type': booking.get('payment_type'),
            'payment_gateway': booking.get('payment_gateway'),
            'flight_date': str(booking.get('flight_date')) if booking.get('flight_date') else None,
            'flight_time': self._format_time(booking.get('flight_time')),
            'flight_slot': self._format_time(booking.get('flight_slot')) if booking.get('flight_slot') else None,
            'invoice_id': booking.get('invoice_id'),
            'pilot_name': booking.get('pilot_name'),
            'aircraft_registration': booking.get('aircraft_registration', '9M-BFF'),
            'notes': booking.get('notes'),
            'paid_at': booking.get('paid_at'),
            'payment_id': booking.get('payment_id'),
            'payment_proof_url': booking.get('payment_proof_url'),
            'add_items_summary': booking.get('add_items_summary'),
            
            # Calculated fields
            'deposit_amount': calc_deposit,
            'amount_to_pay': amount_to_pay,
            'outstanding_balance': final_outstanding,
            'discount_amount': float(booking.get('discount_amount', 0)),
            
            # Customer Info
            'customer_name': customer.get('name'),
            'customer_email': customer.get('email'),
            'customer_phone': customer.get('phone'),
            'customer_created_at': customer.get('created_at'),
            
            # Package Info
            'package_name': package.get('name') if isinstance(package, dict) else None,
            'package_description': package.get('description') if isinstance(package, dict) else None,
            'package_price': float(package.get('price', 0)) if isinstance(package, dict) and package.get('price') else 0,
            'package_image_url': package.get('image_url') if isinstance(package, dict) else None,
            'package_google_maps_link': package.get('google_maps_link') if isinstance(package, dict) else None,
            
            # Derived/Legacy variables for compatibility
            'customer_ic': '', 
            'event_date': str(booking.get('flight_date')),
            'event_time': self._format_time(booking.get('flight_time')),
            'event_venue': 'Subang Skypark Terminal, Malaysia',
            
            # Passengers
            'passengers': passengers,
            'num_passengers': len(passengers),
            
            # Direct access for items
            'booking_items': items
        }
        
        # Add nested objects for more flexible template access {customer.name}
        data['customer'] = customer
        data['booking'] = booking
        data['package'] = package if isinstance(package, dict) else {}
        data['items'] = items
        
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

    def download_file(self, file_path):
        """Download a file from Supabase media bucket"""
        if not self.supabase: return None
        try:
            # First attempt to download from media bucket
            response = self.supabase.storage.from_('media').download(file_path)
            return response
        except Exception as e:
            print(f"Error downloading file {file_path}: {e}")
            return None

    def get_template_path(self, document_type):
        """Legacy method placeholder"""
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
