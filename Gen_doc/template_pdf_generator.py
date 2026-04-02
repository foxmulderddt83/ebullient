"""
Template-based PDF Generator with Variable Replacement
Supports {variable} placeholders that get replaced with Supabase data
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
from reportlab.pdfgen import canvas
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
import re
import os
import json


class TemplateEngine:
    """Handles variable replacement in templates"""
    
    @staticmethod
    def replace_variables(template_text, data):
        """
        Replace {variable} placeholders with actual values
        
        Example:
            template = "Hello {name}, your booking is {booking_id}"
            data = {"name": "Amir", "booking_id": "YL11002"}
            result = "Hello Amir, your booking is YL11002"
        """
        def replacer(match):
            key = match.group(1)
            # Support nested keys like {customer.name}
            value = TemplateEngine._get_nested_value(data, key)
            return str(value) if value is not None else match.group(0)
        
        # Replace {variable} with actual values
        return re.sub(r'\{([^}]+)\}', replacer, template_text)
    
    @staticmethod
    def _get_nested_value(data, key):
        """Get value from nested dictionary using dot notation"""
        keys = key.split('.')
        value = data
        
        for k in keys:
            if isinstance(value, dict):
                value = value.get(k)
            else:
                return None
        
        return value


class PDFTemplateGenerator:
    """Generate PDFs from templates with Supabase data"""
    
    def __init__(self, output_dir="/mnt/user-data/outputs"):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)
        self.styles = getSampleStyleSheet()
        self.template_engine = TemplateEngine()
    
    def generate_from_template(self, template_name, supabase_data, custom_template=None):
        """
        Generate PDF from template with variable replacement
        
        Args:
            template_name: 'invoice_paid', 'booking_confirmation', etc.
            supabase_data: Data from Supabase (dict)
            custom_template: Optional custom template structure
        
        Returns:
            str: Path to generated PDF
        """
        # Load template
        if custom_template:
            template = custom_template
        else:
            template = self._get_default_template(template_name)
        
        # Replace all variables in template
        processed_template = self._process_template(template, supabase_data)
        
        # Generate PDF
        filename = f"{self.output_dir}/{template_name}_{supabase_data.get('id', 'output')}.pdf"
        
        if template_name == 'invoice_paid':
            return self._generate_invoice(filename, processed_template)
        elif template_name == 'booking_confirmation':
            return self._generate_booking_confirmation(filename, processed_template)
        elif template_name == 'certificate':
            return self._generate_certificate(filename, processed_template)
        elif template_name == 'gendec':
            return self._generate_gendec(filename, processed_template)
        elif template_name == 'refund_voucher':
            return self._generate_refund_voucher(filename, processed_template)
        else:
            raise ValueError(f"Unknown template: {template_name}")
    
    def _process_template(self, template, data):
        """Replace all variables in template structure"""
        if isinstance(template, dict):
            return {k: self._process_template(v, data) for k, v in template.items()}
        elif isinstance(template, list):
            return [self._process_template(item, data) for item in template]
        elif isinstance(template, str):
            return self.template_engine.replace_variables(template, data)
        else:
            return template
    
    def _get_default_template(self, template_name):
        """Get default template structure"""
        templates = {
            'invoice_paid': {
                'title': 'INVOICE',
                'client_info': {
                    'name': '{customer_name}',
                    'mobile': '{customer_phone}',
                    'email': '{customer_email}',
                },
                'invoice_info': {
                    'invoice_no': '{invoice_id}',
                    'date': '{invoice_date}',
                    'payment_status': 'PAID'
                },
                'booking_details': {
                    'booking_id': '{booking_id}',
                    'package': '{package_name}',
                    'event_date': '{event_date}',
                    'event_time': '{event_time}',
                    'event_venue': 'Subang Skypark Terminal, Malaysia',
                    'num_flights': '{num_flights}',
                    'num_pax': '{num_passengers}'
                },
                'passengers': '{passengers}',  # Will be array
                'payment': {
                    'date': '{payment_date}',
                    'amount': '{total_amount}',
                    'method': '{payment_method}',
                    'total': '{total_amount}',
                    'received': '{total_amount}',
                    'balance': '0'
                }
            },
            
            'booking_confirmation': {
                'title': 'BOOKING CONFIRMATION',
                'subtitle': 'Your Booking Has Been Confirmed',
                'event_info': {
                    'date': '{event_date}',
                    'time': '{event_time}',
                    'venue': '{event_venue}',
                    'meeting_time': '{meeting_time}',
                    'meeting_venue': 'My News @ Subang Airport'
                },
                'booking_info': {
                    'id': '{booking_id}',
                    'package': '{package_name}',
                    'description': '{package_description}'
                },
                'passengers': '{passengers}',
                'visitors': '{visitors}',
                'addons': '{addons}',
                'special_remarks': [
                    'Original IC (Malaysian) or Passport (Non-Malaysian) required upon arrival',
                    'Weather updates 1-2 hours before flight',
                    'Decent clothes and full over footwear required'
                ]
            },
            
            'certificate': {
                'title': 'FLIGHT CERTIFICATE',
                'subtitle': 'this is to certify that',
                'customer_name': '{customer_name}',
                'customer_id': '{customer_ic}',
                'description': 'has flew an aeroplane under guidance of flight instructor\nand successfully completed',
                'company': 'ONE DAY PILOT',
                'location': 'Subang Airport, Malaysia',
                'date': '{event_date}',
                'pilot_name': '{pilot_name}',
                'pilot_signature': '{pilot_signature}'
            },
            
            'gendec': {
                'title': 'GENERAL DECLARATION',
                'subtitle': '(Outward/Inward)',
                'operator': {
                    'name': '{operator_name}',
                    'plane_registration': '{plane_registration}',
                    'time': '{flight_time}',
                    'date': '{flight_date}'
                },
                'flight_routing': {
                    'departure': 'WMSA',
                    'arrival': 'WMSA',
                    'captain': '{pilot_name}',
                    'captain_code': '{pilot_code}'
                },
                'passengers': '{passengers}'
            },
            
            'refund_voucher': {
                'title': 'PAYMENT VOUCHER',
                'customer_info': {
                    'id': '{customer_member_id}',
                    'name': '{customer_name}',
                    'ic': '{customer_ic}',
                    'contact': '{customer_phone}',
                    'email': '{customer_email}'
                },
                'voucher_info': {
                    'id': '{voucher_id}',
                    'date': '{voucher_date}',
                    'status': 'Completed',
                    'type': 'REFUND'
                },
                'booking_details': {
                    'id': '{booking_id}',
                    'date': '{flight_date}',
                    'time': '{flight_time}',
                    'invoice_id': '{invoice_id}'
                },
                'payment': {
                    'date': '{payment_date}',
                    'bank_account': '{bank_account}',
                    'amount': '{refund_amount}',
                    'description': 'Bank Transfer',
                    'remarks': '{refund_reason}'
                }
            }
        }
        
        return templates.get(template_name, {})
    
    def _generate_invoice(self, filename, template):
        """Generate invoice PDF"""
        doc = SimpleDocTemplate(filename, pagesize=A4)
        story = []
        
        # Title
        title_style = ParagraphStyle(
            'CustomTitle',
            fontSize=24,
            alignment=TA_CENTER,
            spaceAfter=30
        )
        story.append(Paragraph(template['title'], title_style))
        story.append(Spacer(1, 12))
        
        # Client info table
        client = template['client_info']
        invoice = template['invoice_info']
        
        client_data = [
            ['Attn To:', client['name'], 'Invoice No:', invoice['invoice_no']],
            ['Mobile:', client['mobile'], 'Date:', invoice['date']],
            ['Email:', client['email'], 'Payment:', invoice['payment_status']]
        ]
        
        client_table = Table(client_data, colWidths=[80, 200, 80, 120])
        client_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.red),
            ('BACKGROUND', (3, 2), (3, 2), colors.red),
            ('TEXTCOLOR', (3, 2), (3, 2), colors.white),
            ('ALIGN', (2, 0), (2, -1), 'RIGHT'),
        ]))
        story.append(client_table)
        story.append(Spacer(1, 20))
        
        # Booking details
        booking = template['booking_details']
        
        booking_text = f"""
        <b>Booking ID:</b> {booking['booking_id']}<br/>
        <b>Package:</b> {booking['package']}<br/><br/>
        
        <b>Event Date:</b> {booking['event_date']}<br/>
        <b>Event Time:</b> {booking['event_time']}<br/>
        <b>Event Venue:</b> {booking['event_venue']}<br/>
        <b>Number of Flights:</b> {booking['num_flights']}<br/>
        <b>Number of Pax:</b> {booking['num_pax']}<br/>
        """
        
        story.append(Paragraph(booking_text, self.styles['Normal']))
        story.append(Spacer(1, 20))
        
        # Passengers
        if isinstance(template['passengers'], list):
            story.append(Paragraph('<b>PASSENGER DETAILS:</b>', self.styles['Heading3']))
            for i, pax in enumerate(template['passengers'], 1):
                pax_text = f"""
                <b>({i}) {pax.get('role', 'PASSENGER')}</b><br/>
                Full Name: {pax.get('name', '')}<br/>
                IC/Passport: {pax.get('ic_passport', '')}<br/>
                Country: {pax.get('nationality', '')}<br/>
                Weight: {pax.get('weight', '')} | Height: {pax.get('height', '')}<br/>
                Gender: {pax.get('gender', '')}<br/>
                """
                story.append(Paragraph(pax_text, self.styles['Normal']))
                story.append(Spacer(1, 10))
        
        # Payment details
        payment = template['payment']
        
        payment_data = [
            ['Payment Date:', payment['date']],
            ['Payment Amount:', f"RM {payment['amount']}"],
            ['Payment Method:', payment['method']],
            ['', ''],
            ['Total Amount:', f"RM {payment['total']}"],
            ['Payment Received:', f"RM {payment['received']}"],
            ['Balance Amount:', f"RM {payment['balance']}"]
        ]
        
        payment_table = Table(payment_data, colWidths=[150, 250])
        payment_table.setStyle(TableStyle([
            ('FONTNAME', (0, 4), (0, 6), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 11),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ]))
        story.append(payment_table)
        
        doc.build(story)
        return filename
    
    def _generate_booking_confirmation(self, filename, template):
        """Generate booking confirmation PDF"""
        doc = SimpleDocTemplate(filename, pagesize=A4)
        story = []
        
        # Title
        story.append(Paragraph(template['title'], self.styles['Title']))
        story.append(Paragraph(template['subtitle'], self.styles['Heading2']))
        story.append(Spacer(1, 20))
        
        # Event info
        event = template['event_info']
        event_data = [
            ['Event Date:', event['date']],
            ['Event Time:', event['time']],
            ['Event Venue:', event['venue']],
            ['Meeting Time:', event['meeting_time']],
            ['Meeting Venue:', event['meeting_venue']],
        ]
        
        event_table = Table(event_data, colWidths=[150, 300])
        event_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 11),
        ]))
        story.append(event_table)
        story.append(Spacer(1, 20))
        
        # Booking info
        booking = template['booking_info']
        story.append(Paragraph(f"<b>Booking ID:</b> {booking['booking_id']}", self.styles['Normal']))
        story.append(Paragraph(f"<b>Package:</b> {booking['package']}", self.styles['Normal']))
        story.append(Spacer(1, 20))
        
        # Passengers
        if isinstance(template['passengers'], list):
            story.append(Paragraph('<b>Passenger Details:</b>', self.styles['Heading3']))
            for i, pax in enumerate(template['passengers'], 1):
                pax_data = [
                    [f"({i}) {pax.get('role', 'PASSENGER')}", ''],
                    ['Full Name:', pax.get('name', '')],
                    ['Nationality:', pax.get('nationality', '')],
                    ['Date of Birth:', pax.get('dob', '')],
                    ['NRIC/Passport:', pax.get('ic_passport', '')],
                    ['Height:', pax.get('height', '')],
                    ['Weight:', pax.get('weight', '')],
                    ['Gender:', pax.get('gender', '')]
                ]
                
                pax_table = Table(pax_data, colWidths=[150, 300])
                pax_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.lightgrey),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ]))
                story.append(pax_table)
                story.append(Spacer(1, 12))
        
        # Special remarks
        story.append(Paragraph('<b>Important Checklist:</b>', self.styles['Heading3']))
        for remark in template['special_remarks']:
            story.append(Paragraph(f"• {remark}", self.styles['Normal']))
        
        doc.build(story)
        return filename
    
    def _generate_certificate(self, filename, template):
        """Generate certificate PDF"""
        c = canvas.Canvas(filename, pagesize=A4)
        width, height = A4
        
        # Border
        c.setStrokeColor(colors.HexColor('#1a237e'))
        c.setLineWidth(3)
        c.rect(30, 30, width-60, height-60, stroke=1, fill=0)
        c.setLineWidth(1)
        c.rect(40, 40, width-80, height-80, stroke=1, fill=0)
        
        # Title
        c.setFont("Helvetica-Bold", 36)
        c.drawCentredString(width/2, height-100, template['title'].split()[0])  # FLIGHT
        c.drawCentredString(width/2, height-140, template['title'].split()[1])  # CERTIFICATE
        
        # Subtitle
        c.setFont("Helvetica-Oblique", 14)
        c.drawCentredString(width/2, height-180, template['subtitle'])
        
        # Name
        c.setFont("Helvetica-Bold", 24)
        c.drawCentredString(width/2, height-230, template['customer_name'].upper())
        
        # ID
        c.setFont("Helvetica", 16)
        c.drawCentredString(width/2, height-260, template['customer_id'])
        
        # Description
        c.setFont("Helvetica", 12)
        for i, line in enumerate(template['description'].split('\n')):
            c.drawCentredString(width/2, height-310-(i*20), line)
        
        # Company
        c.setFont("Helvetica-Bold", 14)
        c.drawCentredString(width/2, height-380, template['company'])
        
        # Location and date
        c.setFont("Helvetica", 12)
        c.drawCentredString(width/2, height-430, template['location'])
        c.drawCentredString(width/2, height-450, f"on {template['date']}")
        
        # Signatures
        c.setFont("Helvetica", 10)
        c.line(80, 100, 250, 100)
        c.drawCentredString(165, 80, template['pilot_name'])
        c.drawCentredString(165, 65, "PILOT")
        
        c.line(width-250, 100, width-80, 100)
        c.drawCentredString(width-165, 80, "ALICE CHIN")
        c.drawCentredString(width-165, 65, "EVENT DIRECTOR")
        c.drawCentredString(width-165, 50, "ONE DAY PILOT")
        
        c.save()
        return filename
    
    def _generate_gendec(self, filename, template):
        """Generate GenDec PDF"""
        doc = SimpleDocTemplate(filename, pagesize=A4)
        story = []
        
        # Title
        story.append(Paragraph(template['title'], self.styles['Title']))
        story.append(Paragraph(template['subtitle'], self.styles['Normal']))
        story.append(Spacer(1, 20))
        
        # Operator details
        operator = template['operator']
        op_data = [
            ['Operator:', operator['name']],
            ['Marks of Nationality and Registration:', operator['plane_registration']],
            ['Time:', operator['time']],
            ['Date:', operator['date']],
        ]
        
        op_table = Table(op_data, colWidths=[200, 300])
        story.append(op_table)
        story.append(Spacer(1, 20))
        
        # Flight routing
        routing = template['flight_routing']
        story.append(Paragraph('<b>FLIGHT ROUTING</b>', self.styles['Heading3']))
        
        routing_data = [
            ['Departure from:', routing['departure'], 'Arrival at:', routing['arrival']],
            ['Captain:', routing['captain'], '', routing['captain_code']],
        ]
        
        routing_table = Table(routing_data, colWidths=[100, 150, 100, 150])
        story.append(routing_table)
        story.append(Spacer(1, 20))
        
        # Passengers
        if isinstance(template['passengers'], list):
            story.append(Paragraph('<b>Passengers:</b>', self.styles['Heading3']))
            for pax in template['passengers']:
                story.append(Paragraph(
                    f"{pax.get('name', '')} - {pax.get('ic_passport', '')} - {pax.get('gender', '')} - {pax.get('nationality', '')}",
                    self.styles['Normal']
                ))
        
        doc.build(story)
        return filename
    
    def _generate_refund_voucher(self, filename, template):
        """Generate refund voucher PDF"""
        doc = SimpleDocTemplate(filename, pagesize=A4)
        story = []
        
        # Title
        story.append(Paragraph(template['title'], self.styles['Title']))
        story.append(Spacer(1, 20))
        
        # Customer and voucher info
        customer = template['customer_info']
        voucher = template['voucher_info']
        
        header_data = [
            ['Attention To:', customer['id'], 'Voucher ID:', voucher['id']],
            ['Name:', customer['name'], 'Date:', voucher['date']],
            ['IC:', customer['ic'], 'Status:', voucher['status']],
            ['Contact:', customer['contact'], '', ''],
            ['Email:', customer['email'], '', voucher['type']],
        ]
        
        header_table = Table(header_data, colWidths=[120, 200, 80, 120])
        header_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('BACKGROUND', (3, 4), (3, 4), colors.red),
            ('TEXTCOLOR', (3, 4), (3, 4), colors.white),
        ]))
        story.append(header_table)
        story.append(Spacer(1, 20))
        
        # Booking details
        booking = template['booking_details']
        story.append(Paragraph('<b>Refund Booking Details:</b>', self.styles['Heading3']))
        story.append(Paragraph(f"Booking ID: {booking['booking_id']}", self.styles['Normal']))
        story.append(Paragraph(f"Date: {booking['date']}", self.styles['Normal']))
        story.append(Paragraph(f"Time: {booking['time']}", self.styles['Normal']))
        story.append(Paragraph(f"Invoice ID: {booking['invoice_id']}", self.styles['Normal']))
        story.append(Spacer(1, 20))
        
        # Payment details
        payment = template['payment']
        payment_data = [
            ['Payment Date:', payment['date']],
            ['Bank Account:', payment['bank_account']],
            ['Amount:', f"RM {payment['amount']}"],
            ['Description:', payment['description']],
            ['Remarks:', payment['remarks']],
        ]
        
        payment_table = Table(payment_data, colWidths=[150, 300])
        story.append(payment_table)
        story.append(Spacer(1, 20))
        
        # Total
        total_data = [['Amount:', f"RM {payment['amount']}"]]
        total_table = Table(total_data, colWidths=[400, 100])
        total_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 14),
            ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
        ]))
        story.append(total_table)
        
        doc.build(story)
        return filename


# Example usage
if __name__ == "__main__":
    # Sample Supabase data
    supabase_data = {
        'id': 'YL11002',
        'customer_name': 'Amir Abdullah',
        'customer_phone': '+60123456789',
        'customer_email': 'amir@example.com',
        'customer_ic': '920815-10-1234',
        'invoice_id': 'INV26/0001',
        'invoice_date': '15th March 2026',
        'booking_id': 'YL11002',
        'package_name': 'A2+ Premium Package',
        'event_date': '20th March 2026',
        'event_time': '10:00 AM',
        'num_flights': '2',
        'num_passengers': '2',
        'payment_date': '15th March 2026',
        'total_amount': '2,499',
        'payment_method': 'Bank Transfer',
        'passengers': [
            {
                'role': 'Co-Pilot (One Day Pilot)',
                'name': 'Amir Abdullah',
                'ic_passport': '920815-10-1234',
                'nationality': 'Malaysian',
                'weight': '75 kg',
                'height': '175 cm',
                'gender': 'Male',
                'dob': '15th August 1992'
            },
            {
                'role': 'Passenger',
                'name': 'Sarah Ahmad',
                'ic_passport': '950212-08-5678',
                'nationality': 'Malaysian',
                'weight': '55 kg',
                'height': '160 cm',
                'gender': 'Female',
                'dob': '12th February 1995'
            }
        ]
    }
    
    generator = PDFTemplateGenerator()
    
    # Generate invoice
    pdf_path = generator.generate_from_template('invoice_paid', supabase_data)
    print(f"Generated: {pdf_path}")
