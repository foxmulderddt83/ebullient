from flask import Flask, send_file, jsonify, request
from flask_cors import CORS
import os
import json
from supabase_pdf_service import SupabasePDFService
from template_pdf_generator import PDFTemplateGenerator
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

# Initialize services
pdf_service = SupabasePDFService()
# Use a local temp directory for generated files
OUTPUT_DIR = os.path.join(os.getcwd(), "temp_outputs")
generator = PDFTemplateGenerator(output_dir=OUTPUT_DIR)

# Initialize Supabase client for storage upload
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "ok", "message": "PDF Generation Service is running"})

@app.route('/api/generate-pdf/<booking_id>/<doc_type>', methods=['GET'])
def generate_pdf(booking_id, doc_type):
    try:
        # 1. Fetch data from Supabase
        data = pdf_service.get_booking_data(booking_id)
        if not data:
            return jsonify({"error": f"Booking {booking_id} not found"}), 404

        # 2. Check for custom template
        custom_template_json = None
        template_storage_path = pdf_service.get_template_path(doc_type)
        
        if template_storage_path:
            template_content = pdf_service.download_template(template_storage_path)
            if template_content:
                try:
                    custom_template_json = json.loads(template_content)
                except json.JSONDecodeError:
                    # If not JSON, maybe it's just text or HTML (not yet supported by current generator)
                    print(f"Warning: Template at {template_storage_path} is not valid JSON")

        # 3. Generate PDF
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
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route('/api/generate-all-pdfs/<booking_id>', methods=['GET'])
def generate_all_pdfs(booking_id):
    try:
        doc_types = ['invoice_paid', 'booking_confirmation', 'gendec', 'certificate', 'refund_voucher']
        results = []
        
        for doc_type in doc_types:
            # We don't return files here, just generate and upload
            # A more robust version would use a background task
            try:
                # Reuse logic from generate_pdf but don't return send_file
                data = pdf_service.get_booking_data(booking_id)
                template_storage_path = pdf_service.get_template_path(doc_type)
                custom_template_json = None
                
                if template_storage_path:
                    template_content = pdf_service.download_template(template_storage_path)
                    if template_content:
                        try:
                            custom_template_json = json.loads(template_content)
                        except: pass

                pdf_path = generator.generate_from_template(doc_type, data, custom_template_json)
                
                if os.path.exists(pdf_path):
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
