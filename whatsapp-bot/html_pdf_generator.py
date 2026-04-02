import os
import re
from datetime import datetime
from weasyprint import HTML, CSS
from weasyprint.text.fonts import FontConfiguration

class HTMLPDFGenerator:
    def __init__(self, output_dir):
        self.output_dir = output_dir
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)

    def _format_date(self, date_str, format_str='%d %b %Y'):
        if not date_str: return ''
        try:
            # Handle ISO formats
            dt = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
            return dt.strftime(format_str)
        except:
            return date_str

    def _replace_variables(self, template_html, booking):
        """Replace placeholders based on frontend logic"""
        customer = booking.get('customers', {})
        items = booking.get('booking_items', [])
        first_package = items[0].get('packages', {}) if items else {}
        passengers = booking.get('booking_passengers', [])
        passenger = passengers[0] if passengers else {}
        
        replacements = {
            "{customer.name}": customer.get('name') or "",
            "{customer.email}": customer.get('email') or "",
            "{customer.phone}": customer.get('phone') or "",
            "{customer.created_at}": self._format_date(customer.get('created_at')),
            
            "{booking.booking_reference}": booking.get('booking_reference') or "",
            "{booking.reference}": booking.get('booking_reference') or "",
            "{booking.date}": self._format_date(booking.get('created_at'), '%A %d %b %Y'),
            "{booking.time}": self._format_date(booking.get('created_at'), '%H:%M'),
            "{booking.status}": booking.get('status') or "",
            "{booking.total_amount}": f"RM {booking.get('total_amount')}" if booking.get('total_amount') else "",
            "{booking.paid_amount}": f"RM {booking.get('paid_amount')}" if booking.get('paid_amount') else "",
            "{booking.payment_status}": booking.get('payment_status') or "",
            "{booking.payment_method}": booking.get('payment_method') or "",
            "{booking.payment_gateway}": booking.get('payment_gateway') or "",
            "{booking.paid_at}": self._format_date(booking.get('paid_at'), '%A %d %b %Y %H:%M'),
            "{booking.payment_id}": booking.get('payment_id') or "",
            "{booking.payment_proof_url}": booking.get('payment_proof_url') or "",
            "{booking.add_items_summary}": booking.get('add_items_summary') or "",
            "{booking.payment_type}": booking.get('payment_type') or "",
            "{booking.deposit_amount}": f"RM {booking.get('deposit_amount')}" if booking.get('deposit_amount') else "",
            "{booking.amount_to_pay}": f"RM {booking.get('deposit_amount') if booking.get('payment_type') == 'deposit' else booking.get('total_amount')}",
            "{booking.outstanding_balance}": f"RM {float(booking.get('total_amount') or 0) - float(booking.get('paid_amount') or 0)}" if (float(booking.get('total_amount') or 0) - float(booking.get('paid_amount') or 0)) > 0 else "",
            "{booking.flight_date}": self._format_date(booking.get('flight_date'), '%A %d %b %Y'),
            "{booking.flight_time}": booking.get('flight_time') or "",
            "{booking.invoice_id}": booking.get('invoice_id') or "",
            "{booking.pilot_name}": booking.get('pilot_name') or "",
            "{booking.aircraft_registration}": booking.get('aircraft_registration') or "",
            "{booking.notes}": booking.get('notes') or "",
            
            "{package.name}": first_package.get('name') or "",
            "{package.description}": first_package.get('description') or "",
            "{package.price}": f"RM {first_package.get('price')}" if first_package.get('price') else "",
            "{package.quantity}": str(items[0].get('quantity')) if items else "",
            "{package.image_url}": first_package.get('image_url') or "",
            "{package.max_quantity}": str(first_package.get('max_quantity')) if first_package.get('max_quantity') else "",
            "{package.promotion_price}": f"RM {first_package.get('promotion_price')}" if first_package.get('promotion_price') else "",
            "{package.promotion_start_at}": self._format_date(first_package.get('promotion_start_at')),
            "{package.promotion_end_at}": self._format_date(first_package.get('promotion_end_at')),
            "{package.created_at}": self._format_date(first_package.get('created_at')),
            "{package.google_maps_link}": first_package.get('google_maps_link') or "",
            
            "{passenger.name}": passenger.get('name') or "",
            "{passenger.ic}": passenger.get('ic_passport_number') or passenger.get('nric_number') or "",
            "{passenger.ic_passport_number}": passenger.get('ic_passport_number') or passenger.get('nric_number') or "",
            "{passenger.type}": passenger.get('type') or "",
            "{passenger.status}": passenger.get('status') or "Passenger",
            "{passenger.country}": passenger.get('country_of_origin') or "",
            "{passenger.country_of_origin}": passenger.get('country_of_origin') or "",
            "{passenger.gender}": passenger.get('gender') or "",
            "{passenger.weight}": str(passenger.get('weight')) + " kg" if passenger.get('weight') else "",
            "{passenger.height}": str(passenger.get('height')) + " cm" if passenger.get('height') else "",
            "{passenger.dob}": self._format_date(passenger.get('dob')),
            "{passenger.id_front_url}": passenger.get('id_front_url') or "",
            "{passenger.id_back_url}": passenger.get('id_back_url') or "",
            "{passenger.created_at}": self._format_date(passenger.get('created_at'), '%d %b %Y %H:%M'),
            
            "{flight.date}": self._format_date(booking.get('flight_date'), '%A %d %b %Y'),
            "{flight.time}": booking.get('flight_time') or "",
            "{pilot.name}": booking.get('pilot_name') or "",
            "{aircraft.registration}": booking.get('aircraft_registration') or "",
            
            "{registration.nric_number}": passenger.get('nric_number') or passenger.get('ic_passport_number') or "",
            "{registration.nationality}": passenger.get('country_of_origin') or "",
            
            # Legacy/Shortcuts
            "{customer_name}": customer.get('name') or "",
            "{customer_email}": customer.get('email') or "",
            "{customer_phone}": customer.get('phone') or "",
            "{booking_id}": booking.get('id') or "",
            "{booking_reference}": booking.get('booking_reference') or "",
            "{invoice_id}": booking.get('invoice_id') or "",
            "{flight_date}": self._format_date(booking.get('flight_date'), '%A %d %b %Y'),
            "{flight_time}": booking.get('flight_time') or "",
            "{package_name}": first_package.get('name') or "",
            "{total_amount}": f"RM {booking.get('total_amount')}" if booking.get('total_amount') else "",
            "{paid_amount}": f"RM {booking.get('paid_amount')}" if booking.get('paid_amount') else "",
            "{deposit_amount}": f"RM {booking.get('deposit_amount')}" if booking.get('deposit_amount') else "",
            "{amount_to_pay}": f"RM {booking.get('deposit_amount') if booking.get('payment_type') == 'deposit' else booking.get('total_amount')}",
            "{payment_type}": booking.get('payment_type') or "",
            "{status}": booking.get('status') or "",
            "{payment_status}": booking.get('payment_status') or "",
            "{pilot_name}": booking.get('pilot_name') or "",
            "{aircraft_registration}": booking.get('aircraft_registration') or "",
        }
        
        # Add items list text
        items_text = ""
        if items:
            items_list = []
            for item in items:
                pkg_name = item.get('packages', {}).get('name', '')
                qty = item.get('quantity', '')
                total = f"RM {item.get('total_price')}" if item.get('total_price') else ""
                items_list.append(f"- {pkg_name} (Qty: {qty}) - {total}")
            items_text = "\n".join(items_list)
        replacements["{booking.items_text}"] = items_text

        # Add add_items_amount HTML
        add_items_html = ""
        if items:
            for idx, item in enumerate(items):
                pkg = item.get('packages', {})
                add_items_html += f"""
                <div style="margin-bottom: 1px; border: 1px solid #6b7280; border-radius: 6px; padding: 2px; background-color: transparent;">
                    <div style="font-weight: 700; font-size: 14px; margin-bottom: 1px; color: #111827; border-bottom: 1px solid #9ca3af; padding-bottom: 1px; line-height: 1.1;">
                        Item {idx + 1}: {pkg.get('name', '')}
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div style="flex: 1; padding-right: 10px;">
                            <div style="font-size: 14px; color: #666; margin-bottom: 1px; line-height: 1.1;">{pkg.get('description', '')}</div>
                            <div style="font-size: 14px; color: #555; line-height: 1.1;">Quantity: <span style="font-weight: 600;">{item.get('quantity', '')}</span> × RM {item.get('unit_price', '')}</div>
                        </div>
                        <div style="font-weight: bold; font-size: 14px; white-space: nowrap; line-height: 1.1;">RM {item.get('total_price', '')}</div>
                    </div>
                </div>
                """
        replacements["{add_items_amount}"] = add_items_html

        # Replace all exact matches
        for key, value in replacements.items():
            if value is None:
                value = ""
            template_html = template_html.replace(key, str(value))
            
        return template_html

    def generate_from_html(self, template_html_row, supabase_data, filename="output.pdf"):
        content = template_html_row.get('content', '')
        
        # 1. Replace variables
        html_content = self._replace_variables(content, supabase_data)
        
        # 2. Extract background and margin settings
        bg_url = template_html_row.get('background_url', '')
        bg_opacity = template_html_row.get('background_opacity', 0.15)
        bg_style = template_html_row.get('background_style', 'center')
        margin_left = template_html_row.get('margin_left', 20)
        margin_right = template_html_row.get('margin_right', 20)
        margin_top = template_html_row.get('margin_top', 20)
        margin_bottom = template_html_row.get('margin_bottom', 20)
        
        bg_size = "contain"
        bg_repeat = "no-repeat"
        bg_position = "center"
        
        if bg_style == "stretch":
            bg_size = "100% 100%"
        elif bg_style == "tile":
            bg_size = "auto"
            bg_repeat = "repeat"
            bg_position = "top left"

        pdf_styles = f"""
        <style>
            @page {{
                size: A4;
                margin: {margin_top}mm {margin_right}mm {margin_bottom}mm {margin_left}mm;
            }}
            
            body {{
                font-family: Arial, sans-serif;
                color: #333;
                line-height: 1.5;
                font-size: 14px;
                margin: 0;
                padding: 0;
            }}
            
            /* WeasyPrint specific background handling */
            @page {{
                @background {{
                    content: {f"url('{bg_url}')" if bg_url else "none"};
                    background-size: {bg_size};
                    background-position: {bg_position};
                    background-repeat: {bg_repeat};
                    opacity: {bg_opacity};
                }}
            }}
            
            table, th, td {{
                border: 0.2px solid #ddd;
                border-collapse: collapse;
            }}
            th, td {{
                padding: 8px;
            }}
            
            .ql-align-center {{ text-align: center; }}
            .ql-align-right {{ text-align: right; }}
            .ql-align-justify {{ text-align: justify; }}
            
            .ql-align-center img {{ display: block; margin: 0 auto; }}
            .ql-align-right img {{ display: block; margin-left: auto; margin-right: 0; }}
            img {{ max-width: 100%; height: auto; }}
            
            p {{ margin-bottom: 0.5em; min-height: 1em; }}
            .ql-editor {{ white-space: pre-wrap; }}
            
            .page-break {{
                page-break-after: always;
            }}
        </style>
        """
        
        full_html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            {pdf_styles}
        </head>
        <body>
            <div class="content-layer">
                {html_content}
            </div>
        </body>
        </html>
        """
        
        output_path = os.path.join(self.output_dir, filename)
        
        font_config = FontConfiguration()
        html = HTML(string=full_html)
        html.write_pdf(output_path, font_config=font_config)
        
        return output_path
