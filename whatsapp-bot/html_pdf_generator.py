import os
from playwright.sync_api import sync_playwright

class HTMLPDFGenerator:
    def __init__(self, output_dir):
        self.output_dir = output_dir
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)

    def generate_via_frontend(self, booking_id, doc_type, filename, passenger_id=None):
        """
        Uses Playwright to navigate to the Vercel frontend /pdf-render route,
        waits for the page to finish rendering the React component, and captures it as PDF.
        """
        frontend_url = os.environ.get("FRONTEND_URL", "https://onedaypilot.vercel.app")
        # Support localhost for testing
        if frontend_url.endswith("/"):
            frontend_url = frontend_url[:-1]
            
        render_url = f"{frontend_url}/pdf-render?booking={booking_id}&type={doc_type}"
        if passenger_id:
            render_url += f"&passenger={passenger_id}"
            
        print(f"Generating PDF via Headless Browser: {render_url}")
        
        pdf_path = os.path.join(self.output_dir, filename)
        
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True, args=['--no-sandbox', '--disable-setuid-sandbox'])
            try:
                page = browser.new_page()
                
                # Go to the render route
                page.goto(render_url, wait_until="networkidle")
                
                try:
                    # Wait for the frontend to signal it's ready (React state resolved, fonts loaded)
                    # We added window.pdfReady = true in PdfRender.tsx
                    page.wait_for_function("window.pdfReady === true", timeout=15000)
                except Exception as e:
                    print(f"Warning: Timeout waiting for pdfReady signal: {e}")
                    # Wait a bit just in case
                    page.wait_for_timeout(2000)
                
                # Check if there was an error rendering on the frontend
                error_element = page.query_selector("#pdf-error")
                if error_element:
                    error_text = error_element.inner_text()
                    raise Exception(f"Frontend Render Error: {error_text}")
                    
                # Generate the PDF
                # A4 size, print backgrounds (for colors/watermarks)
                page.pdf(
                    path=pdf_path,
                    format="A4",
                    print_background=True,
                    margin={"top": "0", "right": "0", "bottom": "0", "left": "0"}
                )
            finally:
                browser.close()
            
        return pdf_path

    def generate_from_html_string(self, html, filename):
        if not html:
            raise Exception("HTML content is empty")

        pdf_path = os.path.join(self.output_dir, filename)

        final_html = html
        if "<html" not in (final_html or "").lower():
            final_html = f"<!doctype html><html><head><meta charset='utf-8' /></head><body>{final_html}</body></html>"

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True, args=['--no-sandbox', '--disable-setuid-sandbox'])
            try:
                page = browser.new_page()
                page.set_content(final_html, wait_until="networkidle")
                page.wait_for_timeout(750)
                page.pdf(
                    path=pdf_path,
                    format="A4",
                    print_background=True,
                    margin={"top": "0", "right": "0", "bottom": "0", "left": "0"}
                )
            finally:
                browser.close()

        return pdf_path

    # Keep this method signature to avoid breaking api_with_supabase.py imports right away,
    # though we'll modify api_with_supabase.py to use generate_via_frontend directly.
    def generate_from_html(self, template_html_row, supabase_data, filename):
        html = template_html_row.get('content') if isinstance(template_html_row, dict) else None
        return self.generate_from_html_string(html or "", filename)
