from flask import Flask, send_file, jsonify, request
from flask_cors import CORS
import os
import json
import subprocess
import tempfile
import mammoth
import img2pdf
from docx import Document
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
from supabase_pdf_service import SupabasePDFService
from template_pdf_generator import PDFTemplateGenerator
from template_pdf_generator import TemplateEngine
from supabase import create_client, Client
from dotenv import load_dotenv

import shutil
import traceback
from html_pdf_generator import HTMLPDFGenerator

load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

# Use a local temp directory for generated files
OUTPUT_DIR = os.path.join(os.getcwd(), "temp_outputs")
if not os.path.exists(OUTPUT_DIR):
    os.makedirs(OUTPUT_DIR, exist_ok=True)

# Initialize services
pdf_service = SupabasePDFService()
generator = PDFTemplateGenerator(output_dir=OUTPUT_DIR)
html_generator = HTMLPDFGenerator(output_dir=OUTPUT_DIR)

# Initialize Supabase client for storage upload
# Priority order for URL
url_candidates = [
    os.environ.get("SUPABASE_URL"),
    os.environ.get("NEXT_PUBLIC_SUPABASE_URL"),
    os.environ.get("VITE_SUPABASE_URL")
]
SUPABASE_URL = next((u for u in url_candidates if u), None)

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
SUPABASE_KEY = next((k for k in key_candidates if k), None)

# Clean quotes
if SUPABASE_URL: SUPABASE_URL = SUPABASE_URL.strip("'\"").strip()
if SUPABASE_KEY: SUPABASE_KEY = SUPABASE_KEY.strip("'\"").strip()

supabase = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        # Using the most basic initialization with the upgraded library
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        print("DEBUG: Secondary Supabase client for Storage initialized")
    except Exception as e:
        print(f"Error initializing secondary Supabase client: {e}")
else:
    print("WARNING: Missing credentials for secondary Supabase client (Storage upload will fail)")

import re
from datetime import datetime, timedelta

def evaluate_formulas(text):
    """Evaluates sum(...) formulas inside text"""
    pattern = r'sum\(([^)]+)\)'
    
    def calculate(match):
        expression = match.group(1).strip()
        
        # 1. Currency
        if "RM" in expression.upper():
            clean_expr = expression.upper().replace("RM", "").replace(" ", "").replace(",", "")
            try:
                if not re.match(r'^[\d+\-*/.]+$', clean_expr):
                    return match.group(0)
                result = eval(clean_expr, {"__builtins__": None}, {})
                return f"RM {result:g}".replace('.0', '') if result % 1 == 0 else f"RM {result:.2f}"
            except:
                return match.group(0)
                
        # 2. Time
        if ":" in expression:
            try:
                time_match = re.search(r'(\d{1,2}:\d{2}(?:\s?[aAPp][mM])?)\s*([+-])\s*(\d+(?:\.\d+)?)', expression)
                if time_match:
                    time_str = time_match.group(1)
                    operator = time_match.group(2)
                    hours_mod = float(time_match.group(3))
                    
                    time_str_clean = time_str.upper().replace(" ", "")
                    if "M" in time_str_clean:
                        dt = datetime.strptime(time_str_clean, "%I:%M%p")
                        time_format = "%I:%M %p"
                    else:
                        dt = datetime.strptime(time_str_clean, "%H:%M")
                        time_format = "%H:%M"
                        
                    if operator == '+':
                        dt += timedelta(hours=hours_mod)
                    else:
                        dt -= timedelta(hours=hours_mod)
                        
                    return dt.strftime(time_format)
            except:
                return match.group(0)
                
        # 3. Numbers
        try:
            clean_expr = expression.replace(" ", "").replace(",", "")
            if not re.match(r'^[\d+\-*/.]+$', clean_expr):
                return match.group(0)
            result = eval(clean_expr, {"__builtins__": None}, {})
            return f"{result:g}"
        except:
            return match.group(0)

    return re.sub(pattern, calculate, text, flags=re.IGNORECASE)

def process_docx_to_locked_pdf(input_path, variables, final_pdf_path, tmp_dir):
    """
    Core logic to replace variables in a DOCX and generate an image-locked PDF.
    Optimized for speed and file size using JPEG compression and 150 DPI.
    """
    # If it's a legacy .doc, convert to .docx first so we can edit it
    if input_path.lower().endswith('.doc'):
        subprocess.run(
            ['libreoffice', '--headless', '--convert-to', 'docx', '--outdir', tmp_dir, input_path],
            check=True, timeout=30, env={**os.environ, 'HOME': '/tmp'}
        )
        input_path = os.path.join(tmp_dir, os.path.splitext(os.path.basename(input_path))[0] + ".docx")

    # 1. Variable Replacement using python-docx
    doc = Document(input_path)
    
    def replace_text_robust(paragraphs, variables):
        """Robustly replace placeholders while strictly preserving formatting"""
        for paragraph in paragraphs:
            # 1. Replace variables
            for key, value in variables.items():
                placeholder = f'{{{key}}}'
                if placeholder in paragraph.text:
                    # 1. Attempt run-level replacement (preserves bold/italic/font)
                    for run in paragraph.runs:
                        if placeholder in run.text:
                            run.text = run.text.replace(placeholder, str(value))
                    
                    # 2. If placeholder still exists, it's split across runs.
                    if placeholder in paragraph.text:
                        full_text = paragraph.text.replace(placeholder, str(value))
                        if paragraph.runs:
                            paragraph.runs[0].text = full_text
                            for i in range(1, len(paragraph.runs)):
                                paragraph.runs[i].text = ""

            # 2. Evaluate formulas
            if re.search(r'sum\([^)]+\)', paragraph.text, flags=re.IGNORECASE):
                new_text = evaluate_formulas(paragraph.text)
                if new_text != paragraph.text:
                    if paragraph.runs:
                        paragraph.runs[0].text = new_text
                        for i in range(1, len(paragraph.runs)):
                            paragraph.runs[i].text = ""

    # Process paragraphs in body
    replace_text_robust(doc.paragraphs, variables)
    
    # Process paragraphs in tables
    for table in doc.tables:
        tbl = table._tbl
        tblPr = tbl.tblPr
        tblpPr = tblPr.find(qn('w:tblpPr'))
        if tblpPr is not None:
            tblPr.remove(tblpPr)

        try:
            table.autofit = False 
        except: pass

        for row in table.rows:
            for cell in row.cells:
                replace_text_robust(cell.paragraphs, variables)
    
    # Process headers/footers
    for section in doc.sections:
        replace_text_robust(section.header.paragraphs, variables)
        replace_text_robust(section.footer.paragraphs, variables)

    # Save modified docx
    modified_docx_path = os.path.join(tmp_dir, f"modified_{os.path.basename(input_path)}")
    doc.save(modified_docx_path)
    
    # 2. Convert modified DOCX to PDF using LibreOffice
    subprocess.run(
        [
            'libreoffice', '--headless', '--invisible', '--norestore',
            '--convert-to', 'pdf',
            '--outdir', tmp_dir,
            modified_docx_path
        ],
        capture_output=True,
        text=True,
        timeout=60,
        env={**os.environ, 'HOME': '/tmp'}
    )
    
    base_name = os.path.splitext(os.path.basename(modified_docx_path))[0]
    intermediate_pdf_path = os.path.join(tmp_dir, f"{base_name}.pdf")
    
    if not os.path.exists(intermediate_pdf_path):
        raise Exception('PDF generation failed after LibreOffice conversion')

    # 3. IMPLEMENT IMAGE-LOCKED METHOD (Screenshot Method)
    # Optimized: Use JPEG instead of PNG, and 150 DPI instead of 300 DPI for faster generation and smaller file size
    print("🔒 Locking layout using Image-Based PDF method (Optimized JPEG, 150 DPI)...")
    image_prefix = os.path.join(tmp_dir, "page")
    
    subprocess.run(
        [
            'pdftoppm', '-jpeg', '-r', '150',
            intermediate_pdf_path, image_prefix
        ],
        check=True
    )
    
    page_images = sorted([
        os.path.join(tmp_dir, f) for f in os.listdir(tmp_dir) 
        if f.startswith("page-") and f.endswith(".jpg")
    ])
    
    if not page_images:
        raise Exception('Failed to generate page images for locking')

    with open(final_pdf_path, "wb") as f:
        f.write(img2pdf.convert(page_images))
    
    return final_pdf_path

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "ok", "message": "PDF Generation Service is running"})

@app.route('/api/direct-docx-to-pdf', methods=['POST'])
def direct_docx_to_pdf():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    variables_json = request.form.get('variables', '{}')
    
    try:
        variables = json.loads(variables_json)
        
        # Centralized Logic: If booking_id or booking_reference is provided, 
        # re-fetch and re-format variables on the backend to ensure plain-text 
        # compatibility for DOCX (avoiding frontend HTML formatting).
        booking_ref = variables.get('booking.booking_reference') or variables.get('booking_reference') or variables.get('booking_id')
        if booking_ref:
            print(f"Refetching and re-formatting variables for {booking_ref} to ensure DOCX compatibility")
            data = pdf_service.get_booking_data(booking_ref)
            if data:
                # Build fresh flat variables using the backend's plain-text engine
                backend_vars = pdf_service.build_flat_variables(data)
                # Merge: Backend variables take priority for DOCX formatting, 
                # but keep any custom frontend variables that might not be in the backend engine.
                variables = {**variables, **backend_vars}

    except Exception as e:
        print(f"Warning: Failed to re-format variables: {e}")
        # Continue with original variables if re-formatting fails
        try:
            variables = json.loads(variables_json)
        except:
            return jsonify({'error': 'Invalid variables JSON'}), 400

    try:
        with tempfile.TemporaryDirectory() as tmp_dir:
            input_path = os.path.join(tmp_dir, file.filename)
            file.save(input_path)
            
            final_pdf_path = os.path.join(tmp_dir, "locked_output.pdf")
            process_docx_to_locked_pdf(input_path, variables, final_pdf_path, tmp_dir)
            
            # 4. Save and return final locked PDF
            final_pdf_name = f"direct_{os.path.splitext(file.filename)[0]}.pdf"
            final_storage_path = os.path.join(OUTPUT_DIR, final_pdf_name)
            os.makedirs(OUTPUT_DIR, exist_ok=True)
            import shutil
            shutil.copy(final_pdf_path, final_storage_path)
            return send_file(final_storage_path, as_attachment=True)

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/convert-docx', methods=['POST'])
def convert_docx():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']
    if not file.filename:
        return jsonify({'error': 'Empty filename'}), 400

    ext = file.filename.rsplit('.', 1)[-1].lower()
    if ext not in ['doc', 'docx']:
        return jsonify({'error': 'Only .doc and .docx files are supported'}), 400

    try:
        with tempfile.TemporaryDirectory() as tmp_dir:
            input_path = os.path.join(tmp_dir, file.filename)
            file.save(input_path)

            # High-fidelity conversion using LibreOffice (preferred)
            # This requires LibreOffice to be installed in the Docker container
            try:
                # Run LibreOffice headless to convert DOCX → HTML
                result = subprocess.run(
                    [
                        'libreoffice', '--headless',
                        '--convert-to', 'html',
                        '--outdir', tmp_dir,
                        input_path
                    ],
                    capture_output=True,
                    text=True,
                    timeout=60,
                    env={**os.environ, 'HOME': '/tmp'}
                )

                if result.returncode == 0:
                    # Locate generated HTML file
                    base_name = os.path.splitext(file.filename)[0]
                    html_path = os.path.join(tmp_dir, f"{base_name}.html")
                    
                    if not os.path.exists(html_path):
                        # Fallback: find any .html in tmp_dir
                        for fname in os.listdir(tmp_dir):
                            if fname.endswith('.html'):
                                html_path = os.path.join(tmp_dir, fname)
                                break

                    if os.path.exists(html_path):
                        with open(html_path, 'r', encoding='utf-8', errors='replace') as f:
                            html_content = f.read()
                        return jsonify({'html': html_content, 'success': True})
            except Exception as lo_err:
                print(f"LibreOffice conversion failed, falling back to mammoth: {lo_err}")

            # Fallback to Mammoth (lighter weight, no external deps, but lower fidelity)
            with open(input_path, "rb") as docx_file:
                result = mammoth.convert_to_html(docx_file)
                html_content = result.value
                return jsonify({'html': html_content, 'success': True})

    except subprocess.TimeoutExpired:
        return jsonify({'error': 'Conversion timed out (60s limit)'}), 504
    except Exception as e:
        print(f"convert-docx error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/generate-pdf/<booking_id>/<doc_type>', methods=['GET'])
def generate_pdf(booking_id, doc_type):
    passenger_id = request.args.get('passengerId')
    try:
        # 1. Fetch data from Supabase
        data = pdf_service.get_booking_data(booking_id)
        if not data:
            return jsonify({"error": f"Booking {booking_id} not found"}), 404

        # Transform data for variables
        variables = pdf_service._transform_data(data)

        # 2. Try to get HTML template from database (new way)
        html_template = pdf_service.get_template_html(doc_type)
        
        pdf_path = None
        
        if html_template:
            # Check if there is an original_file_path in template_settings (Direct DOCX to PDF)
            settings = html_template.get('template_settings')
            original_file_path = None
            if settings:
                if isinstance(settings, str):
                    try:
                        settings = json.loads(settings)
                    except:
                        settings = {}
                original_file_path = settings.get('original_file_path')

            if original_file_path:
                print(f"Using High-Fidelity Direct DOCX to PDF for {doc_type}")
                # Download original DOCX from Supabase
                file_bytes = pdf_service.download_file(original_file_path)
                if file_bytes:
                    with tempfile.TemporaryDirectory() as tmp_dir:
                        # Save downloaded bytes to temp file
                        ext = os.path.splitext(original_file_path)[1]
                        if not ext: ext = ".docx"
                        input_path = os.path.join(tmp_dir, f"template{ext}")
                        with open(input_path, 'wb') as f:
                            f.write(file_bytes)
                        
                        # Get flattened, perfectly formatted variables matching the frontend
                        passenger_data = None
                        if passenger_id:
                            passengers = data.get('booking_passengers', [])
                            for p in passengers:
                                if str(p.get('id')) == str(passenger_id):
                                    passenger_data = p
                                    break
                        
                        flat_vars = pdf_service.build_flat_variables(data, passenger_data)

                        # Generate PDF
                        filename = f"{doc_type}_{booking_id}_{passenger_id}.pdf" if passenger_id else f"{doc_type}_{booking_id}.pdf"
                        tmp_pdf_path = os.path.join(tmp_dir, "locked_output.pdf")
                        process_docx_to_locked_pdf(input_path, flat_vars, tmp_pdf_path, tmp_dir)

                        
                        # Copy to output dir
                        pdf_path = os.path.join(OUTPUT_DIR, filename)
                        shutil.copy(tmp_pdf_path, pdf_path)
                else:
                    print(f"Failed to download original_file_path: {original_file_path}")

            if not pdf_path:
                template_content = html_template.get('content')
                if template_content and isinstance(template_content, str) and template_content.strip().endswith('.html') and '<' not in template_content:
                    file_bytes = pdf_service.download_file(template_content.strip())
                    if file_bytes:
                        try:
                            template_content = file_bytes.decode('utf-8')
                        except Exception:
                            template_content = file_bytes.decode('utf-8', errors='replace')

                if not template_content:
                    raise Exception(f"Template content is empty for {doc_type}")

                match = re.search(r"<div[^>]*class=['\"]page-a4['\"][^>]*>([\s\S]*)</div>\s*$", template_content, flags=re.IGNORECASE)
                if match and match.group(1):
                    template_content = match.group(1)

                passenger_data = None
                if passenger_id:
                    passengers = data.get('booking_passengers', []) or []
                    for p in passengers:
                        if str(p.get('id')) == str(passenger_id):
                            passenger_data = p
                            break

                render_data = variables
                if passenger_data:
                    render_data = {**variables, "passenger": passenger_data, "current_passenger": passenger_data}
                rendered_html = TemplateEngine.replace_variables(template_content, render_data)

                filename = f"{doc_type}_{booking_id}_{passenger_id}.pdf" if passenger_id else f"{doc_type}_{booking_id}.pdf"
                pdf_path = html_generator.generate_from_html_string(rendered_html, filename)
        else:
            # Legacy ReportLab path
            print(f"Falling back to legacy ReportLab template for {doc_type}")
            custom_template_json = None
            template_storage_path = pdf_service.get_template_path(doc_type)
            
            if template_storage_path:
                template_content = pdf_service.download_file(template_storage_path)
                if template_content:
                    try:
                        custom_template_json = json.loads(template_content)
                    except Exception as e:
                        print(f"Warning: Template at {template_storage_path} is not valid JSON")

            # Generate PDF
            pdf_path = generator.generate_from_template(
                template_name=doc_type,
                supabase_data=data,
                custom_template=custom_template_json
            )

        # 4. Upload to Supabase Storage (optional, but good for history)
        if os.path.exists(pdf_path):
            filename = os.path.basename(pdf_path)
            storage_path = f"generated-docs/{booking_id}/{filename}"
            
            with open(pdf_path, 'rb') as f:
                supabase.storage.from_('media').upload(
                    path=storage_path,
                    file=f,
                    file_options={"content-type": "application/pdf", "x-upsert": "true"}
                )
            
            # 5. Record in database
            pdf_service.save_generated_doc(booking_id, doc_type, storage_path)

            # 6. Return file to user
            return send_file(pdf_path, as_attachment=True)
        else:
            return jsonify({"error": "Failed to generate PDF file"}), 500

    except Exception as e:
        print(f"Error: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route('/api/generate-all-pdfs/<booking_id>', methods=['GET'])
def generate_all_pdfs(booking_id):
    try:
        doc_types = ['invoice_paid', 'booking_confirmation', 'gendec', 'certificate', 'refund_voucher']
        results = []
        
        for doc_type in doc_types:
            try:
                data = pdf_service.get_booking_data(booking_id)
                variables = pdf_service._transform_data(data)
                html_template = pdf_service.get_template_html(doc_type)
                
                pdf_path = None
                if html_template:
                    settings = html_template.get('template_settings')
                    original_file_path = None
                    if settings:
                        if isinstance(settings, str):
                            try:
                                settings = json.loads(settings)
                            except:
                                settings = {}
                        original_file_path = settings.get('original_file_path')

                    if original_file_path:
                        print(f"Using High-Fidelity Direct DOCX to PDF for {doc_type}")
                        file_bytes = pdf_service.download_file(original_file_path)
                        if file_bytes:
                            with tempfile.TemporaryDirectory() as tmp_dir:
                                ext = os.path.splitext(original_file_path)[1]
                                if not ext: ext = ".docx"
                                input_path = os.path.join(tmp_dir, f"template{ext}")
                                with open(input_path, 'wb') as f:
                                    f.write(file_bytes)
                                
                                flat_vars = pdf_service.build_flat_variables(data)

                                filename = f"{doc_type}_{booking_id}.pdf"
                                tmp_pdf_path = os.path.join(tmp_dir, "locked_output.pdf")
                                process_docx_to_locked_pdf(input_path, flat_vars, tmp_pdf_path, tmp_dir)
                                
                                pdf_path = os.path.join(OUTPUT_DIR, filename)
                                shutil.copy(tmp_pdf_path, pdf_path)
                    
                    if not pdf_path:
                        template_content = html_template.get('content')
                        if template_content and isinstance(template_content, str) and template_content.strip().endswith('.html') and '<' not in template_content:
                            file_bytes = pdf_service.download_file(template_content.strip())
                            if file_bytes:
                                try:
                                    template_content = file_bytes.decode('utf-8')
                                except Exception:
                                    template_content = file_bytes.decode('utf-8', errors='replace')

                        if not template_content:
                            raise Exception(f"Template content is empty for {doc_type}")

                        match = re.search(r"<div[^>]*class=['\"]page-a4['\"][^>]*>([\s\S]*)</div>\s*$", template_content, flags=re.IGNORECASE)
                        if match and match.group(1):
                            template_content = match.group(1)

                        rendered_html = TemplateEngine.replace_variables(template_content, variables)
                        pdf_path = html_generator.generate_from_html_string(rendered_html, f"{doc_type}_{booking_id}.pdf")
                else:
                    template_storage_path = pdf_service.get_template_path(doc_type)
                    custom_template_json = None
                    
                    if template_storage_path:
                        template_content = pdf_service.download_file(template_storage_path)
                        if template_content:
                            try:
                                custom_template_json = json.loads(template_content)
                            except: pass

                    pdf_path = generator.generate_from_template(doc_type, data, custom_template_json)
                
                if pdf_path and os.path.exists(pdf_path):
                    filename = os.path.basename(pdf_path)
                    storage_path = f"generated-docs/{booking_id}/{filename}"
                    with open(pdf_path, 'rb') as f:
                        supabase.storage.from_('media').upload(storage_path, f, {"content-type": "application/pdf", "x-upsert": "true"})
                    pdf_service.save_generated_doc(booking_id, doc_type, storage_path)
                    results.append(doc_type)
            except Exception as inner_e:
                print(f"Failed to generate {doc_type}: {str(inner_e)}")

        return jsonify({"success": True, "generated": results})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/generated-documents/<booking_id>', methods=['GET'])
def get_generated_documents(booking_id):
    try:
        response = supabase.table('generated_documents').select('*').eq('booking_id', booking_id).execute()
        return jsonify({"success": True, "documents": response.data})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
