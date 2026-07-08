import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import { AVAILABLE_VARIABLES } from "@/lib/constants";
import { toast } from "sonner";

// Dynamic imports for large PDF libraries - only loaded when PDF generation is needed
let html2canvas: typeof import('html2canvas').default | null = null;
let jsPDF: typeof import('jspdf').jsPDF | null = null;

const loadPdfLibraries = async () => {
  if (!html2canvas) {
    html2canvas = (await import('html2canvas')).default;
  }
  if (!jsPDF) {
    jsPDF = (await import('jspdf')).jsPDF;
  }
};

export interface TableData {
  id: string;
  name: string;
  rows: number;
  cols: number;
  headers: string[];
  data: string[][];
  borderColor?: string;
}

export const generateTableHtml = (table: TableData) => {
  const borderColor = table.borderColor || 'black';
  const borderWidth = '0.2px';
  
  let html = `<table class="w-full border-collapse mb-4" style="width: 100%; border-collapse: collapse; border: ${borderWidth} solid ${borderColor}; margin-bottom: 1rem;">`;
  
  // Header
  html += '<thead class="bg-gray-100" style="background-color: #f3f4f6;"><tr>';
  table.headers.forEach(header => {
    html += `<th class="px-2 py-2 text-center bg-gray-100 font-bold" style="border: ${borderWidth} solid ${borderColor}; padding: 8px; text-align: center; background-color: #f3f4f6; font-weight: bold;">${header}</th>`;
  });
  html += '</tr></thead>';
  
  // Body
  html += '<tbody>';
  table.data.forEach(row => {
    html += '<tr>';
    row.forEach(cell => {
      html += `<td class="px-2 py-2 text-center" style="border: ${borderWidth} solid ${borderColor}; padding: 8px; text-align: center;">${cell}</td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table>';
  
  return html;
};

export { AVAILABLE_VARIABLES };

export const getFlatVariables = (booking: any, passenger?: any) => {
  const vars: Record<string, string> = {};
  AVAILABLE_VARIABLES.forEach(category => {
    category.vars.forEach(v => {
      const cleanKey = v.replace(/[{}]/g, '');
      const value = getVariableValue(v, booking, passenger, { format: 'text' })?.toString() || "";
      vars[cleanKey] = value;
      // Also keep original key with braces for standard replacement
      vars[v] = value;
    });
  });
  return vars;
};

export const formatFlightTime = (time: string | null | undefined): string => {
  if (!time) return "";
  try {
    // Check if it's in HH:mm:ss format
    if (time.includes(':')) {
      const parts = time.split(':');
      if (parts.length >= 2) {
        return `${parts[0]}:${parts[1]}`;
      }
    }
    return time;
  } catch (e) {
    return time || "";
  }
};

export const autoLinkHtml = (html: string): string => {
  if (!html) return html;
  const urlRegex = /(https?:\/\/[^\s<]+)/g;
  return html.replace(urlRegex, (url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline;">${url}</a>`;
  });
};

export const getVariableValue = (variable: string, booking: any, passenger?: any, options: { format?: 'html' | 'text' } = { format: 'html' }) => {
  const isText = options.format === 'text';
  const customer = booking.customer || {};
  const items = booking.booking_items || [];
  const firstPackage = items.length > 0 && items[0].package ? items[0].package : (booking.package_details || {});
  
  // Fallback to first passenger if not explicitly provided
  const currentPassenger = passenger || (booking.booking_passengers && booking.booking_passengers.length > 0 ? booking.booking_passengers[0] : null);

  switch (variable) {
    case "{customer.id}": return (customer.id || "").toUpperCase();
    case "{customer.name}": return (customer.name || "").toUpperCase();
    case "{customer.email}": return (customer.email || "").toUpperCase();
    case "{customer.phone}": return (customer.phone || "").toUpperCase();
    case "{customer.created_at}": return customer.created_at ? format(new Date(customer.created_at), 'dd MMM yyyy') : "";
    case "{customer.updated_at}": return customer.updated_at ? format(new Date(customer.updated_at), 'dd MMM yyyy') : "";
    
    case "{booking.booking_id}": return (booking.booking_id || "").toUpperCase();
    case "{booking.customer_id}": return (booking.customer_id || "").toUpperCase();
    case "{booking.user_id}": return (booking.user_id || "").toUpperCase();
    case "{booking.booking_reference}": return (booking.booking_reference || "").toUpperCase();
    case "{booking.reference}": return (booking.booking_reference || "").toUpperCase(); // Support both
    case "{booking.date}": return booking.created_at ? format(new Date(booking.created_at), 'EEEE d MMM yyyy') : "";
    case "{booking.time}": return booking.created_at ? format(new Date(booking.created_at), 'HH:mm') : "";
    case "{booking.created_at}": return booking.created_at ? format(new Date(booking.created_at), 'EEEE d MMM yyyy HH:mm') : "";
    case "{booking.updated_at}": return booking.updated_at ? format(new Date(booking.updated_at), 'EEEE d MMM yyyy HH:mm') : "";
    case "{booking.status}": return (booking.status || "").toUpperCase();
    case "{booking.total_amount}": return booking.total_amount ? `RM ${booking.total_amount}` : "";
    case "{booking.paid_amount}": return booking.paid_amount ? `RM ${booking.paid_amount}` : "";
    case "{booking.payment_status}": return (booking.payment_status || "").toUpperCase();
    case "{booking.payment_method}": return (booking.payment_method || "").toUpperCase();
    case "{booking.payment_gateway}": return (booking.payment_gateway || "").toUpperCase();
    case "{booking.paid_at}": return booking.paid_at ? format(new Date(booking.paid_at), 'EEEE d MMM yyyy HH:mm') : "";
    case "{booking.payment_id}": return (booking.payment_id || "").toUpperCase();
    case "{booking.payment_proof_url}": return booking.payment_proof_url || "";
    case "{booking.payment_proof_urls}": {
      const urls = Array.isArray(booking.payment_proof_urls) ? booking.payment_proof_urls : [];
      return urls.filter(Boolean).join('\n');
    }
    case "{booking.payment_proof_count}": {
      const urls = Array.isArray(booking.payment_proof_urls) ? booking.payment_proof_urls : [];
      return urls.filter(Boolean).length.toString();
    }
    case "{booking.add_items_summary}": 
      if (items && items.length > 0) {
        if (isText) {
          return items.map((item: any, idx: number) => `*Item ${idx + 1}:* ${(item.package?.name || "").toUpperCase()}`).join('\n');
        }
        return items.map((item: any, idx: number) => `
          <div style="margin-bottom: 1px; border: 1px solid #6b7280; border-radius: 6px; padding: 2px; background-color: transparent;">
            <div style="font-weight: 700; font-size: 14px; margin-bottom: 1px; color: #111827; padding-bottom: 1px; line-height: 1.1;">
               Item ${idx + 1}: ${(item.package?.name || "").toUpperCase()}
            </div>
          </div>
        `).join('');
      } else if (booking.package_details) {
         const pd = booking.package_details;
         if (isText) return `*Package:* ${(pd.name || "").toUpperCase()}`;
         return `
          <div style="margin-bottom: 1px; border: 1px solid #6b7280; border-radius: 6px; padding: 2px; background-color: transparent;">
            <div style="font-weight: 700; font-size: 14px; margin-bottom: 1px; color: #111827; padding-bottom: 1px; line-height: 1.1;">
               Package: ${(pd.name || "").toUpperCase()}
            </div>
          </div>
         `;
      }
      return "";
    case "{booking.items_count}": return (Array.isArray(items) ? items.length : 0).toString();
    case "{booking.items_total_qty}": {
      const qty = (Array.isArray(items) ? items : []).reduce((acc: number, it: any) => acc + Number(it?.quantity ?? 0), 0);
      return qty.toString();
    }
    case "{booking.items_total_price}": {
      const total = (Array.isArray(items) ? items : []).reduce((acc: number, it: any) => acc + Number(it?.total_price ?? 0), 0);
      return total ? `RM ${total}` : "RM 0.00";
    }
    case "{booking.passenger_count}": {
      const pax = Array.isArray(booking.booking_passengers) ? booking.booking_passengers : [];
      return pax.length.toString();
    }
    case "{booking.payment_type}": return (booking.payment_type || "").toUpperCase();
    case "{booking.deposit_amount}": 
    case "{deposit}":
    case "{deposit_amount}": {
      const dep = booking.deposit_amount;
      const val = (dep === undefined || dep === null || dep === "" || dep === 0 || dep === "0") ? booking.total_amount : dep;
      return val ? `RM ${val}` : "";
    }
    case "{booking.discount_amount}":
    case "{discount}":
    case "{discount_amount}": return booking.discount_amount ? `RM ${booking.discount_amount}` : "RM 0.00";
    case "{booking.amount_to_pay}": {
      const dep = booking.deposit_amount;
      const val = (dep === undefined || dep === null || dep === "" || dep === 0 || dep === "0") ? booking.total_amount : dep;
      const amount = booking.payment_type === 'deposit' ? val : booking.total_amount;
      return amount ? `RM ${amount}` : "";
    }
    case "{booking.flight_date}": return booking.flight_date ? format(new Date(booking.flight_date), 'EEEE d MMM yyyy') : "";
    case "{booking.flight_time}": return (booking.flight_time || "").toUpperCase();
    case "{booking.invoice_id}": return (booking.invoice_id || "").toUpperCase();
    case "{booking.pilot_name}": return (booking.pilot_name || "").toUpperCase();
    case "{booking.aircraft_registration}": return (booking.aircraft_registration || "").toUpperCase();
    case "{booking.ground_crew_names}": return (booking.ground_crew_names || "").toUpperCase();
    case "{booking.route}": return (booking.route || "").toUpperCase();
    case "{booking.google_maps_link}": {
      const link = (booking.google_maps_link || "").trim();
      if (!link) return "";
      if (isText) return link;
      if (link.startsWith("<a")) return link;
      return `<a href="${link}" target="_blank" style="color: #2563eb; text-decoration: underline;">${link}</a>`;
    }
    case "{booking.notes}": return (booking.notes || "").toUpperCase();
    
    case "{package.id}": return (firstPackage?.id || "").toUpperCase();
    case "{package.category_id}": return (firstPackage?.category_id || "").toUpperCase();
    case "{package.name}": return (firstPackage?.name || (items.map((i:any) => i.package?.name).filter(Boolean).join(', ')) || "").toUpperCase();
    case "{package.description}": return (firstPackage?.description || "").toUpperCase();
    case "{package.price}": return firstPackage?.price ? `RM ${firstPackage.price}` : "";
    case "{package.quantity}": return items.length > 0 ? (items[0].quantity ?? "") : "";
    case "{package.image_url}": return ensureFullUrl(firstPackage?.image_url || "");
    case "{package.route}": return (firstPackage?.route || "").toUpperCase();
    case "{package.max_quantity}": return firstPackage?.max_quantity || "";
    case "{package.promotion_price}": return firstPackage?.promotion_price ? `RM ${firstPackage.promotion_price}` : "";
    case "{package.promotion_start_at}": return firstPackage?.promotion_start_at ? format(new Date(firstPackage.promotion_start_at), 'dd MMM yyyy') : "";
    case "{package.promotion_end_at}": return firstPackage?.promotion_end_at ? format(new Date(firstPackage.promotion_end_at), 'dd MMM yyyy') : "";
    case "{package.created_at}": return firstPackage?.created_at ? format(new Date(firstPackage.created_at), 'dd MMM yyyy') : "";
    case "{package.google_maps_link}": {
      const link = firstPackage?.google_maps_link || "";
      if (!link) return "";
      if (isText) return link;
      // If the link is already an HTML anchor tag, return it as is
      if (link.startsWith('<a')) return link;
      // Otherwise, wrap it in an anchor tag for auto-linking
      return `<a href="${link}" target="_blank" style="color: #2563eb; text-decoration: underline;">${link}</a>`;
    }

    case "{item.id}": return (items?.[0]?.id || "").toUpperCase();
    case "{item.package_id}": return (items?.[0]?.package_id || "").toUpperCase();
    case "{item.quantity}": return (items?.[0]?.quantity ?? "").toString();
    case "{item.unit_price}": return items?.[0]?.unit_price ? `RM ${items[0].unit_price}` : "";
    case "{item.total_price}": return items?.[0]?.total_price ? `RM ${items[0].total_price}` : "";
    
    case "{booking.items_text}":
      if (items && items.length > 0) {
        return items.map((item: any) => `- ${(item.package?.name || "").toUpperCase()} (Qty: ${item.quantity || ""}) - ${item.total_price ? `RM ${item.total_price}` : ""}`).join('\n');
      } else if (booking.package_details) {
        const pd = booking.package_details;
        return `- ${(pd.name || "").toUpperCase()} (Qty: 1) - ${booking.total_amount ? `RM ${booking.total_amount}` : ""}`;
      }
      return "";
    
    case "{add_items_amount}":
      if (items && items.length > 0) {
        if (isText) {
          return items.map((item: any, idx: number) => {
            let text = `*Item ${idx + 1}: ${(item.package?.name || "").toUpperCase()}*\n`;
            if (item.package?.description) text += `${item.package.description}\n`;
            text += `Quantity: ${item.quantity || ""} ${item.unit_price ? `× RM ${item.unit_price}` : ""}\n`;
            text += `*Total: ${item.total_price ? `RM ${item.total_price}` : ""}*`;
            return text;
          }).join('\n\n');
        }
        return items.map((item: any, idx: number) => `
          <div style="margin-bottom: 1px; border: 1px solid #6b7280; border-radius: 6px; padding: 2px; background-color: transparent;">
            <div style="font-weight: 700; font-size: 14px; margin-bottom: 1px; color: #111827; border-bottom: 1px solid #9ca3af; padding-bottom: 1px; line-height: 1.1;">
               Item ${idx + 1}: ${(item.package?.name || "").toUpperCase()}
            </div>
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div style="flex: 1; padding-right: 10px;">
                ${item.package?.description ? `<div style="font-size: 14px; color: #666; margin-bottom: 1px; line-height: 1.1;">${item.package.description}</div>` : ''}
                <div style="font-size: 14px; color: #555; line-height: 1.1;">Quantity: <span style="font-weight: 600;">${item.quantity || ""}</span> ${item.unit_price ? `× RM ${item.unit_price}` : ""}</div>
              </div>
              <div style="font-weight: bold; font-size: 14px; white-space: nowrap; line-height: 1.1;">${item.total_price ? `RM ${item.total_price}` : ""}</div>
            </div>
          </div>
        `).join('');
      } else if (booking.package_details) {
         // Fallback for legacy package_details structure
         const pd = booking.package_details;
         if (isText) {
           let text = `*Package: ${(pd.name || "").toUpperCase()}*\n`;
           if (pd.description) text += `${pd.description}\n`;
           text += `Quantity: 1 ${pd.price ? `× RM ${pd.price}` : ""}\n`;
           text += `*Total: ${pd.price ? `RM ${pd.price}` : ""}*`;
           if (pd.addons && pd.addons.length > 0) {
             text += `\nAdd-ons:\n`;
             text += pd.addons.map((addon: any) => `- ${(addon.name || "").toUpperCase()}: ${addon.price ? `+ RM ${addon.price}` : ""}`).join('\n');
           }
           return text;
         }
         let html = `
          <div style="margin-bottom: 1px; border: 1px solid #6b7280; border-radius: 6px; padding: 2px; background-color: transparent;">
            <div style="font-weight: 700; font-size: 14px; margin-bottom: 1px; color: #111827; border-bottom: 1px solid #9ca3af; padding-bottom: 1px; line-height: 1.1;">
               Package: ${(pd.name || "").toUpperCase()}
            </div>
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div style="flex: 1; padding-right: 10px;">
                ${pd.description ? `<div style="font-size: 14px; color: #666; margin-bottom: 1px; line-height: 1.1;">${pd.description}</div>` : ''}
                <div style="font-size: 14px; color: #555; line-height: 1.1;">Quantity: 1 ${pd.price ? `× RM ${pd.price}` : ""}</div>
              </div>
              <div style="font-weight: bold; font-size: 14px; white-space: nowrap; line-height: 1.1;">${pd.price ? `RM ${pd.price}` : ""}</div>
            </div>
         `;
         if (pd.addons && pd.addons.length > 0) {
            html += `<div style="border-top: 1px solid #e5e7eb; padding-top: 1px; margin-top: 1px;">
              <div style="font-size: 14px; font-weight: bold; text-transform: uppercase; color: #888; margin-bottom: 1px; line-height: 1.1;">Add-ons</div>
              ${pd.addons.map((addon: any) => `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1px; font-size: 14px; line-height: 1.1;">
                  <div style="color: #444;">${(addon.name || "").toUpperCase()}</div>
                  <div style="font-weight: bold;">${addon.price ? `+ RM ${addon.price}` : ""}</div>
                </div>
              `).join('')}
            </div>`;
         }
         html += `</div>`;
         return html;
      }
      return "";

    case "{passenger.name}": 
      // If a specific passenger is provided (e.g. for a certificate), return just their name
      if (passenger) return (passenger.name || "").toUpperCase();
      
      // If no specific passenger is provided (e.g. for an invoice), return a list of all passengers with details
      if (booking.booking_passengers && booking.booking_passengers.length > 0) {
         if (isText) {
           return booking.booking_passengers.map((p: any, idx: number) => {
             return `*Passenger ${idx + 1}: ${(p.name || "").toUpperCase()}*\nType: ${(p.type || "").toUpperCase()}\nIC/Passport: ${(p.ic_passport_number || "").toUpperCase()}\nNationality: ${(p.country_of_origin || "").toUpperCase()}\nGender: ${(p.gender || "").toUpperCase()}\nWeight: ${p.weight ? p.weight + ' kg' : "N/A"}\nHeight: ${p.height ? p.height + ' cm' : "N/A"}`;
           }).join('\n\n');
         }
         return booking.booking_passengers.map((p: any, idx: number) => `
           <div style="margin-bottom: 4px; border: 1px solid #6b7280; border-radius: 6px; padding: 6px; background-color: transparent;">
             <div style="font-weight: 700; font-size: 14px; margin-bottom: 4px; color: #111827; border-bottom: 1px solid #9ca3af; padding-bottom: 2px; line-height: 1.1;">
               Passenger ${idx + 1}: ${(p.name || "").toUpperCase()} (${(p.status || 'Passenger').toUpperCase()})
             </div>
             <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 13px; color: #374151; line-height: 1.2;">
               <div><span style="font-weight: 600; color: #6b7280;">Type:</span> <span style="text-transform: uppercase;">${(p.type || "").toUpperCase()}</span></div>
               <div><span style="font-weight: 600; color: #6b7280;">IC/Passport:</span> ${(p.ic_passport_number || "").toUpperCase()}</div>
               <div><span style="font-weight: 600; color: #6b7280;">Nationality:</span> ${(p.country_of_origin || "").toUpperCase()}</div>
               <div><span style="font-weight: 600; color: #6b7280;">Gender:</span> <span style="text-transform: uppercase;">${(p.gender || "").toUpperCase()}</span></div>
               <div><span style="font-weight: 600; color: #6b7280;">Weight:</span> ${p.weight ? p.weight + ' kg' : ""}</div>
               <div><span style="font-weight: 600; color: #6b7280;">Height:</span> ${p.height ? p.height + ' cm' : ""}</div>
             </div>
             ${(p.id_front_url || p.id_back_url) ? `
               <div style="margin-top: 6px; border-top: 1px solid #e5e7eb; padding-top: 6px;">
                 <div style="font-weight: 600; font-size: 11px; color: #6b7280; text-transform: uppercase; margin-bottom: 4px;">ID Documents</div>
                 <div style="display: flex; gap: 8px;">
                   ${p.id_front_url ? `
                     <div style="width: 120px; height: 80px; border: 1px solid #e2e8f0; border-radius: 4px; overflow: hidden;">
                       <img src="${ensureFullUrl(p.id_front_url)}" style="width: 100%; height: 100%; object-fit: cover;" />
                     </div>
                   ` : ''}
                   ${p.id_back_url ? `
                     <div style="width: 120px; height: 80px; border: 1px solid #e2e8f0; border-radius: 4px; overflow: hidden;">
                       <img src="${ensureFullUrl(p.id_back_url)}" style="width: 100%; height: 100%; object-fit: cover;" />
                     </div>
                   ` : ''}
                 </div>
               </div>
             ` : ''}
           </div>
         `).join('');
      }
      return "";
    case "{booking_passengers.name}": return (currentPassenger?.name || "").toUpperCase();
    case "{booking_passengers.ic_passport_number}": return (currentPassenger?.ic_passport_number || currentPassenger?.nric_number || "").toUpperCase();
    case "{booking_passengers.country_of_origin}": return (currentPassenger?.country_of_origin || "").toUpperCase();
    case "{booking_passengers.gender}": return (currentPassenger?.gender || "").toUpperCase();
    case "{booking_passengers.status}": return (currentPassenger?.status || "Passenger").toUpperCase();
    case "{passenger.id}": return (currentPassenger?.id || "").toUpperCase();
    case "{passenger.booking_id}": return (currentPassenger?.booking_id || booking.booking_id || "").toUpperCase();
    case "{passenger.type}": return (currentPassenger?.type || "").toUpperCase();
    case "{passenger.ic}": return (currentPassenger?.ic_passport_number || currentPassenger?.nric_number || "").toUpperCase();
    case "{passenger.ic_passport_number}": return (currentPassenger?.ic_passport_number || currentPassenger?.nric_number || "").toUpperCase();
    case "{passenger.ic_passport}": return (currentPassenger?.ic_passport_number || currentPassenger?.nric_number || "").toUpperCase();
    case "{passenger.passport}": return (currentPassenger?.ic_passport_number || currentPassenger?.nric_number || "").toUpperCase();
    case "{passenger.country}": return (currentPassenger?.country_of_origin || "").toUpperCase();
    case "{passenger.country_of_origin}": return (currentPassenger?.country_of_origin || "").toUpperCase();
    case "{passenger.weight}": return currentPassenger?.weight ? `${currentPassenger.weight} kg` : "";
    case "{passenger.height}": return currentPassenger?.height ? `${currentPassenger.height} cm` : "";
    case "{passenger.gender}": return (currentPassenger?.gender || "").toUpperCase();
    case "{passenger.status}": return (currentPassenger?.status || "Passenger").toUpperCase();
    case "{passenger.id_front_url}": return ensureFullUrl(currentPassenger?.id_front_url || "");
    case "{passenger.id_back_url}": return ensureFullUrl(currentPassenger?.id_back_url || "");
    case "{passenger.created_at}": return currentPassenger?.created_at ? format(new Date(currentPassenger.created_at), 'dd MMM yyyy HH:mm') : "";

    case "{flight.date}": return booking.flight_date ? format(new Date(booking.flight_date), 'EEEE d MMM yyyy') : "";
    case "{flight.time}": return (booking.flight_time || "").toUpperCase();
    case "{pilot.name}": return (booking.pilot_name || "").toUpperCase();
    case "{aircraft.registration}": return (booking.aircraft_registration || "").toUpperCase();

    // Legacy/Shortcuts
    case "{customer_name}": return (customer.name || "").toUpperCase();
    case "{customer_email}": return (customer.email || "").toUpperCase();
    case "{customer_phone}": return (customer.phone || "").toUpperCase();
    case "{booking_id}": return (booking.booking_reference || "").toUpperCase();
    case "{booking_reference}": return (booking.booking_reference || "").toUpperCase();
    case "{invoice_id}": return (booking.invoice_id || "").toUpperCase();
    case "{flight_date}": return booking.flight_date ? format(new Date(booking.flight_date), 'EEEE d MMM yyyy') : "";
    case "{flight_time}": return (booking.flight_time || "").toUpperCase();
    case "{minus_1hours}": return "1H";
    case "{package_name}": return (firstPackage?.name || "").toUpperCase();
    case "{total_amount}": return booking.total_amount ? `RM ${booking.total_amount}` : "";
    case "{paid_amount}": return booking.paid_amount ? `RM ${booking.paid_amount}` : "";
    case "{status}": return (booking.status || "").toUpperCase();
    case "{payment_status}": return (booking.payment_status || "").toUpperCase();
    case "{payment_method}": return (booking.payment_method || "").toUpperCase();
    case "{payment_type}": return (booking.payment_type || "").toUpperCase();
    case "{amount_to_pay}": {
      const dep = booking.deposit_amount;
      const val = (dep === undefined || dep === null || dep === "" || dep === 0 || dep === "0") ? booking.total_amount : dep;
      const amount = booking.payment_type === 'deposit' ? val : booking.total_amount;
      return amount ? `RM ${amount}` : "";
    }
    case "{booking.outstanding_balance}": {
      // Prioritize the database field if it exists, otherwise calculate it
      if (booking.outstanding_balance !== undefined && booking.outstanding_balance !== null) {
        return `RM ${booking.outstanding_balance}`;
      }
      const isFullPayment = booking.payment_type === 'full payment' || booking.payment_type === 'full';
      const balance = isFullPayment ? 0 : (booking.total_amount || 0) - (booking.deposit_amount || 0);
      return `RM ${balance}`;
    }
    case "{pilot_name}": return (booking.pilot_name || "").toUpperCase();
    case "{aircraft_registration}": return (booking.aircraft_registration || "").toUpperCase();
    case "{ground_crew_names}": return (booking.ground_crew_names || "").toUpperCase();
    case "{route}": return (booking.route || firstPackage?.route || "").toUpperCase();
    case "{google_maps_link}": {
      const link = String(booking.google_maps_link || firstPackage?.google_maps_link || "").trim();
      if (!link) return "";
      if (link.startsWith("<a")) return link;
      return `<a href="${link}" target="_blank" style="color: #2563eb; text-decoration: underline;">${link}</a>`;
    }

    // Registration Specific Variables
    case "{registration.id}": return (booking.registration_id || booking.booking_reference || "").toUpperCase();
    case "{registration.gender}": return (currentPassenger?.gender || "").toUpperCase();
    case "{registration.age}": return currentPassenger?.age || "";
    case "{registration.nric}": return (currentPassenger?.nric_number || currentPassenger?.ic_passport_number || "").toUpperCase();
    case "{registration.nric_number}": return (currentPassenger?.nric_number || currentPassenger?.ic_passport_number || "").toUpperCase();
    case "{registration.nationality}": return (currentPassenger?.country_of_origin || "").toUpperCase();
    case "{registration.weight}": return currentPassenger?.weight || "";
    case "{registration.address}": return (booking.customer?.address || "").toUpperCase();
  }
  return "";
};

export const generateAndSavePDF = async (
  bookingId: string,
  documentType: string,
  passengerId?: string,
  orientation: 'portrait' | 'landscape' = 'portrait',
  pageSize: 'A4' | 'Letter' = 'A4',
  margins: 'Normal' | 'Narrow' | 'None' = 'Normal',
  templateId?: string
) => {
  if (!supabase) throw new Error("Supabase client not initialized");

  // Lazy-load PDF libraries only when PDF generation is needed
  await loadPdfLibraries();

  try {
    // 1. Fetch data locally
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        customer:customers(*),
        booking_passengers(*),
        booking_items(
          *,
          package:packages(*)
        )
      `)
      .or(`booking_id.eq.${bookingId},booking_reference.eq.${bookingId}`)
      .single();

    if (bookingError || !booking) throw new Error("Booking not found");

    let passenger = null;
    if (passengerId) {
      const { data: pData } = await supabase
        .from('booking_passengers')
        .select('*')
        .eq('id', passengerId)
        .single();
      passenger = pData;
    }

    // 1b. Identify template type (DOCX vs HTML)
    let dbTemplate = null;
    if (templateId) {
      const { data } = await supabase.from('document_templates').select('*').eq('id', templateId).maybeSingle();
      dbTemplate = data;
    } else {
      const { data } = await supabase.from('document_templates').select('*').eq('document_type', documentType).eq('is_default', true).maybeSingle();
      dbTemplate = data;
    }

    const isDocx = !!dbTemplate?.template_settings?.original_file_path;
    const docLabel = dbTemplate?.name || documentType.replace(/_/g, ' ');
    toast.info(`Processing ${docLabel}`, {
      description: `Format: ${isDocx ? 'Microsoft Word (.docx)' : 'HTML'}`
    });

    let pdfBlob: Blob;

    if (isDocx) {
      // 2a. DOCX Path: Direct generation via backend
      const filePath = dbTemplate.template_settings.original_file_path;
      const { data: fileData, error: downloadError } = await supabase.storage.from('media').download(filePath);
      if (downloadError) throw downloadError;

      const formData = new FormData();
      formData.append('file', fileData, filePath.split('/').pop() || 'template.docx');
      formData.append('variables', JSON.stringify(getFlatVariables(booking, passenger)));

      const pdfApiUrl = import.meta.env.VITE_PDF_API_URL || 'https://oneday-whatsapp-bot.fly.dev';
      const response = await fetch(`${pdfApiUrl}/api/direct-docx-to-pdf`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Backend DOCX conversion failed: ${errorText}`);
      }
      pdfBlob = await response.blob();
    } else {
      // 2b. HTML Path: Current client-side logic
      const previewResult = await generatePDFFromData(booking, documentType, passenger, false, templateId, orientation, pageSize, margins);
      
      const container = document.createElement('div');
      container.id = 'pdf-generation-container';
      container.style.position = 'fixed';
      container.style.left = '-5000px';
      container.style.top = '0';
      container.style.zIndex = '-9999';
      container.style.backgroundColor = 'white';
      
      const widthPx = previewResult.windowW || (orientation === 'landscape' ? 1123 : 794);
      container.style.width = `${widthPx}px`;
      
      container.innerHTML = previewResult.html;
      document.body.appendChild(container);

      const blobToDataUrl = (blob: Blob) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => reject(new Error("Failed to read blob"));
          reader.onload = () => resolve(String(reader.result || ""));
          reader.readAsDataURL(blob);
        });

      const inlineUrlAsDataUrl = async (url: string): Promise<string | null> => {
        if (!url) return null;
        if (url.startsWith('data:')) return url;
        try {
          const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
          if (!response.ok) return null;
          const blob = await response.blob();
          return await blobToDataUrl(blob);
        } catch {
          return null;
        }
      };

      const inlineAllImages = async (root: HTMLElement) => {
        const images = Array.from(root.getElementsByTagName('img'));
        for (const img of images) {
          const src = img.getAttribute('src') || "";
          if (!src || src.startsWith('data:')) continue;
          img.crossOrigin = 'anonymous';
          const dataUrl = await inlineUrlAsDataUrl(src);
          if (dataUrl) img.setAttribute('src', dataUrl);
        }

        const bgEls = Array.from(root.querySelectorAll<HTMLElement>('*'));
        for (const el of bgEls) {
          const bg = el.style?.backgroundImage || "";
          if (!bg || bg === 'none') continue;
          const url = bg.match(/url\(["']?([^"')]+)["']?\)/)?.[1];
          if (!url || url.startsWith('data:')) continue;
          const dataUrl = await inlineUrlAsDataUrl(url);
          if (dataUrl) {
            el.style.backgroundImage = `url("${dataUrl}")`;
          }
        }
      };

      // CRITICAL: Wait for ALL images in the container to be fully loaded before capturing.
      // This is the main reason why images were missing in the "SEND" version.
      const waitForImages = async (root: HTMLElement) => {
        const images = Array.from(root.getElementsByTagName('img'));
        const bgElements = Array.from(root.querySelectorAll('*')).filter(el => {
          const bg = window.getComputedStyle(el).backgroundImage;
          return bg && bg !== 'none' && bg.startsWith('url');
        });

        const promises = [
          ...images.map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise(resolve => {
              img.onload = resolve;
              img.onerror = resolve;
            });
          }),
          ...bgElements.map(el => {
            const bg = window.getComputedStyle(el).backgroundImage;
            const url = bg.match(/url\(["']?([^"']+)["']?\)/)?.[1];
            if (!url) return Promise.resolve();
            return new Promise(resolve => {
              const img = new Image();
              img.onload = resolve;
              img.onerror = resolve;
              img.src = url;
            });
          })
        ];

        await Promise.all(promises);
        // Additional fixed delay for rendering engine to settle
        await new Promise(resolve => setTimeout(resolve, 1500));
      };

      await inlineAllImages(container);
      await waitForImages(container);

      const canvas = await html2canvas(container, {
        scale: 2, 
        useCORS: true,
        allowTaint: false, // Setting this to false is safer for toDataURL
        backgroundColor: '#ffffff',
        logging: false,
        width: widthPx,
        windowWidth: widthPx,
        onclone: (clonedDoc) => {
          // Ensure all images in the cloned document have crossOrigin set to anonymous
          // This allows html2canvas to capture them from external domains (Supabase)
          const images = clonedDoc.getElementsByTagName('img');
          for (let i = 0; i < images.length; i++) {
            images[i].crossOrigin = 'anonymous';
          }
        }
      });

      document.body.removeChild(container);

      const pdf = new jsPDF({
        orientation: orientation,
        unit: 'mm',
        format: pageSize.toLowerCase() as any
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      const imgWidth = pdfWidth;
      const imgHeight = (canvasHeight * imgWidth) / canvasWidth;

      let heightLeft = imgHeight;
      let position = 0;

      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pdfHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pdfHeight;
      }

      pdfBlob = pdf.output('blob');
    }
    
    // 6. Upload to Supabase Storage (Shared for both paths)
    const fileName = passengerId 
      ? `${documentType}_${bookingId}_${passengerId}.pdf`
      : `${documentType}_${bookingId}.pdf`;
      
    const storagePath = `generated-docs/${bookingId}/${fileName}`;
    
    const { error: uploadError } = await supabase.storage
      .from('media')
      .upload(storagePath, pdfBlob, {
        upsert: true,
        contentType: 'application/pdf'
      });

    if (uploadError) throw uploadError;

    // Get Public URL
    const { data: { publicUrl } } = supabase.storage
      .from('media')
      .getPublicUrl(storagePath);

    const cacheBustedUrl = publicUrl ? `${publicUrl}${publicUrl.includes('?') ? '&' : '?'}v=${Date.now()}` : publicUrl;
    return {
      publicUrl: cacheBustedUrl,
      blob: pdfBlob
    };
  } catch (error) {
    console.error("High-Fidelity PDF Generation Error:", error);
    // Final fallback to the working backend GET endpoint if client-side fails
    const pdfApiUrl = import.meta.env.VITE_PDF_API_URL || 'https://oneday-whatsapp-bot.fly.dev';
    const apiUrl = `${pdfApiUrl}/api/generate-pdf/${bookingId}/${documentType}?orientation=${orientation}&pageSize=${pageSize}`;
    const response = await fetch(apiUrl);
    const pdfBlob = await response.blob();
    return { publicUrl: apiUrl, blob: pdfBlob };
  }
};

export interface PDFGenerationResult {
  html: string;
  orientation: 'portrait' | 'landscape';
  pageSize: 'A4' | 'Letter';
  widthMm: number;
  heightMm: number;
  windowW: number;
  windowH: number;
}

export const generateAndPreviewPDF = async (
  bookingId: string | null,
  documentType: string,
  passengerId?: string,
  orientation: 'portrait' | 'landscape' = 'portrait',
  pageSize: 'A4' | 'Letter' = 'A4',
  margins: 'Normal' | 'Narrow' | 'None' | { top: number, right: number, bottom: number, left: number } = 'Normal',
  templateId?: string,
  showPageBreaks: boolean = true
): Promise<PDFGenerationResult> => {
  if (!supabase) throw new Error("Supabase client not initialized");

  let booking = null;

  // 1. Fetch Booking Data (if ID provided)
  if (bookingId) {
    const { data: bData, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        customer:customers(*),
        booking_passengers(*),
        booking_items(
          *,
          package:packages(*)
        )
      `)
      .or(`booking_id.eq.${bookingId},booking_reference.eq.${bookingId}`)
      .single();

    if (!bookingError && bData) {
      booking = bData;
    }
  }

  // Fallback to empty booking if none found or provided
  if (!booking) {
    booking = {
      booking_reference: "PREVIEW",
      created_at: new Date().toISOString(),
      customer: { name: "PREVIEW CUSTOMER" },
      booking_items: [],
      booking_passengers: []
    };
  }

  // 1b. Fetch Passenger Data if passengerId is provided
  let passenger = null;
  if (passengerId) {
    const { data: pData, error: pError } = await supabase
      .from('booking_passengers')
      .select('*')
      .eq('id', passengerId)
      .single();
      
    if (pError) console.warn("Passenger not found:", pError);
    passenger = pData;
  }

  return generatePDFFromData(booking, documentType, passenger, showPageBreaks, templateId, orientation, pageSize, margins);
};

export const generateRegistrationPDF = async (
  registrationId: string, 
  documentType: string, 
  showPageBreaks: boolean = false, 
  templateId?: string, 
  orientation: 'portrait' | 'landscape' = 'portrait',
  pageSize: 'A4' | 'Letter' = 'A4',
  margins: 'Normal' | 'Narrow' | 'None' = 'Normal'
): Promise<PDFGenerationResult> => {
  if (!supabase) throw new Error("Supabase client not initialized");

  // 1. Fetch Registration Data
  const { data: registration, error: regError } = await supabase
    .from('event_registrations')
    .select('*, event:events(*)')
    .eq('id', registrationId)
    .single();

  if (regError || !registration) {
    throw new Error("Registration not found");
  }

  // 2. Create mock booking and passenger objects
  const mockBooking = {
    registration_id: registration.id,
    customer: {
      name: registration.name || "",
      email: registration.email || "",
      phone: registration.phone || "",
      address: registration.address || "",
      nric_number: registration.nric_number || "",
      nationality: registration.nationality || ""
    },
    flight_date: registration.selected_date,
    flight_time: registration.selected_time_slot,
    booking_reference: registration.id.slice(0, 8).toUpperCase(),
    created_at: registration.created_at,
    notes: registration.notes || "",
    pilot_name: "",
    aircraft_registration: "",
    total_amount: registration.event?.payment_amount || registration.event?.price || 0,
    paid_amount: registration.paid_amount || 0,
    payment_status: registration.payment_status || 'unpaid',
    payment_method: registration.payment_method || "",
    status: registration.payment_status === 'paid' ? 'confirmed' : 'pending',
    package_details: {
      name: registration.event?.name || "Event Registration",
      price: registration.event?.payment_amount || registration.event?.price || 0,
      description: registration.event?.description || ""
    }
  };

  const mockPassenger = {
    name: registration.name || "",
    ic_passport_number: registration.nric_number || "",
    country_of_origin: registration.nationality || "",
    gender: registration.gender || "",
    weight: registration.weight || "",
    age: registration.age || "",
    height: registration.age ? `${registration.age} years` : "",
    nric_number: registration.nric_number || ""
  };

  return generatePDFFromData(mockBooking, documentType, mockPassenger, showPageBreaks, templateId, orientation, pageSize, margins);
};

const ensureFullUrl = (url: string) => {
  if (!url) return "";
  
  // 1. Handle base64 or already proxied URLs
  if (url.startsWith('data:') || url.startsWith('https://images.weserv.nl')) {
    return url;
  }

  // 2. Handle absolute URLs
  if (url.startsWith('http')) {
    const isSupabase = url.includes('supabase.co');
    const isLocal = url.includes('localhost') || url.includes('127.0.0.1');
    
    // If it's an external URL (not Supabase and not local), use CORS proxy
    if (!isSupabase && !isLocal) {
      return `https://images.weserv.nl/?url=${encodeURIComponent(url)}&default=${encodeURIComponent(url)}`;
    }
    return url;
  }
  
  // 3. Handle root-relative paths (e.g., /logo.png)
  // These are usually in the /public folder of the web app
  const commonPublicAssets = ['logo.png', 'favicon.ico', 'apple-touch-icon.png', 'og-image.jpg'];
  const isCommonAsset = commonPublicAssets.some(asset => url.endsWith(asset));
  
  if (url.startsWith('/') || isCommonAsset) {
    let path = url;
    if (!path.startsWith('/')) path = '/' + path;
    
    // Check if it's likely a storage path even without the slash
    // If it contains a folder structure like 'backgrounds/' or 'uploads/', it's probably NOT a public asset
    const isStoragePath = url.includes('/') && !url.startsWith('/');
    
    if (!isStoragePath || isCommonAsset) {
      return `${window.location.origin}${path}`;
    }
  }

  // 4. Handle internal Supabase storage paths
  let cleanPath = url.trim();
  
  // Remove leading slash if present for storage API
  if (cleanPath.startsWith('/')) cleanPath = cleanPath.substring(1);
  
  // Remove 'media/' prefix if it was accidentally included twice
  if (cleanPath.startsWith('media/')) cleanPath = cleanPath.substring(6);

  // If the path contains 'backgrounds/' or 'uploads/', it's definitely a storage path
  // We'll use the 'media' bucket
  const { data: { publicUrl } } = supabase.storage
    .from('media')
    .getPublicUrl(cleanPath);
    
  return publicUrl;
};

export const generatePDFFromData = async (
  booking: any, 
  documentType: string, 
  passenger?: any, 
  showPageBreaks: boolean = false, 
  templateId?: string, 
  orientation: 'portrait' | 'landscape' = 'portrait',
  pageSize: 'A4' | 'Letter' = 'A4',
  margins: 'Normal' | 'Narrow' | 'None' | { top: number, right: number, bottom: number, left: number } = 'Normal'
): Promise<PDFGenerationResult> => {
  if (!supabase) throw new Error("Supabase client not initialized");

  let templateHtml = "";
  let bgSettings = { 
    url: "", 
    opacity: 0.15, 
    style: "center", 
    position: { x: 50, y: 50 },
    topBanner: "",
    topBannerOpacity: 1.0,
    bottomBanner: "",
    bottomBannerOpacity: 1.0
  };
  let pageMargins = { left: 15, right: 15, top: 15, bottom: 15 };

  // 1. Try to fetch from document_templates table first (Modern Editor)
  let dbTemplate = null;
  let dbError = null;

  if (templateId) {
    const { data, error } = await supabase
      .from('document_templates')
      .select('*')
      .eq('id', templateId)
      .maybeSingle();
    dbTemplate = data;
    dbError = error;
  } else {
    // MUST depend on this table where is_default=true based on document type
    const { data, error } = await supabase
      .from('document_templates')
      .select('*')
      .eq('document_type', documentType)
      .eq('is_default', true)
      .maybeSingle();
    dbTemplate = data;
    dbError = error;
  }

  // Fallback 1: Any template for this specific document type if no default is set
  if (!dbTemplate) {
    const { data: anyForType } = await supabase
      .from('document_templates')
      .select('*')
      .eq('document_type', documentType)
      .limit(1)
      .maybeSingle();
    if (anyForType) {
      dbTemplate = anyForType;
    }
  }

  // Fallback 2: Handle "certificate" -> "flight certificate" mapping if needed
  if (!dbTemplate && documentType === 'certificate') {
    const { data: certTemplate } = await supabase
      .from('document_templates')
      .select('*')
      .eq('document_type', 'flight certificate')
      .eq('is_default', true)
      .maybeSingle();
    dbTemplate = certTemplate;
    
    if (!dbTemplate) {
      const { data: anyCert } = await supabase
        .from('document_templates')
        .select('*')
        .eq('document_type', 'flight certificate')
        .limit(1)
        .maybeSingle();
      dbTemplate = anyCert;
    }
  }

  if (!dbError && dbTemplate) {
    templateHtml = dbTemplate.content;
    
    // Clean up template content: if it's wrapped in .page-a4, extract the inner content
    // to avoid double containers and double margins
    if (templateHtml.includes('class="page-a4"') || templateHtml.includes("class='page-a4'")) {
      const match = templateHtml.match(/<div[^>]*class=['"]page-a4['"][^>]*>([\s\S]*)<\/div>/i);
      if (match && match[1]) {
        templateHtml = match[1];
      }
    }

    // Check if it's a legacy document_templates entry (where content is a path)
    if (templateHtml && templateHtml.endsWith('.html') && !templateHtml.includes('<')) {
      const trimmedPath = templateHtml.trim();
      const { data: templateData, error: templateError } = await supabase.storage
        .from('media')
        .download(trimmedPath);
        
      if (!templateError && templateData) {
        templateHtml = await templateData.text();
        
        // Also try to load associated tables JSON for this storage-based template
        const jsonPath = trimmedPath.replace('.html', '.json');
        try {
          const { data: jsonData, error: jsonError } = await supabase.storage
            .from('media')
            .download(jsonPath);

          if (!jsonError && jsonData) {
            const jsonText = await jsonData.text();
            const tables: TableData[] = JSON.parse(jsonText);
            if (Array.isArray(tables)) {
              tables.forEach(table => {
                const tableHtml = generateTableHtml(table);
                templateHtml = templateHtml.replace(new RegExp(`{table.${table.id}}`, 'g'), tableHtml);
              });
            }
          }
        } catch (e) {
          console.warn("Table JSON not found for PDF:", e);
        }
      }
    }
    
    // Prefer per-template settings stored on the row; fall back to global site_settings
    const ts = (dbTemplate as any).template_settings;
    
    // Fix relative image paths in template content
    const supabaseUrl = 'https://kjukdoqkunuifiorcdpz.supabase.co/storage/v1/object/public/media';
    templateHtml = templateHtml.replace(/src=["']BG\/([^"']+)["']/g, (match, filename) => {
      return `src="${supabaseUrl}/backgrounds/${filename}"`;
    });
    // Also handle cases where it might be /BG/ or just a filename that we know is in BG
    templateHtml = templateHtml.replace(/src=["']\/BG\/([^"']+)["']/g, (match, filename) => {
      return `src="${supabaseUrl}/backgrounds/${filename}"`;
    });
    // Fix CSS background-image paths
    templateHtml = templateHtml.replace(/url\(["']?BG\/([^"'\)]+)["']?\)/g, (match, filename) => {
      return `url('${supabaseUrl}/backgrounds/${filename}')`;
    });
    templateHtml = templateHtml.replace(/url\(["']?\/BG\/([^"'\)]+)["']?\)/g, (match, filename) => {
      return `url('${supabaseUrl}/backgrounds/${filename}')`;
    });

    // Remove problematic images that are known to cause CORS or 400 errors
    templateHtml = templateHtml.replace(/<img[^>]*src=["'][^"']*(vumbnail\.com|banner_top_invoice_paid_1779148917870\.jpg)[^"']*["'][^>]*>/gi, '');
    
    // Also remove them from background-image styles
    templateHtml = templateHtml.replace(/background-image:\s*url\(["']?[^"']*(vumbnail\.com|banner_top_invoice_paid_1779148917870\.jpg)[^"']*["']?\)/gi, 'background-image: none');

    if (ts) {
      bgSettings = {
        url: ensureFullUrl(ts.backgroundImage ?? ""),
        opacity: ts.backgroundOpacity !== undefined ? ts.backgroundOpacity : 0.15,
        style: ts.backgroundStyle ?? "center",
        position: ts.backgroundPosition ?? { x: 50, y: 50 },
        topBanner: ensureFullUrl(ts.topBanner ?? ""),
        topBannerOpacity: ts.topBannerOpacity ?? 1.0,
        bottomBanner: ensureFullUrl(ts.bottomBanner ?? ""),
        bottomBannerOpacity: ts.bottomBannerOpacity ?? 1.0
      };
      if (ts.pageMargins) pageMargins = ts.pageMargins;
    } else {
      // Fall back to global site_settings for templates saved before per-template settings existed
      const settingsKey = dbTemplate.document_type === 'flight certificate'
        ? `template_flight certificate_settings`
        : `template_${documentType}_settings`;

      const { data: settingsData } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', settingsKey)
        .maybeSingle();

      if (settingsData) {
        try {
          const parsed = JSON.parse(settingsData.value);
          bgSettings = {
            url: ensureFullUrl(parsed.url || ""),
            opacity: parsed.opacity !== undefined ? parsed.opacity : 0.15,
            style: parsed.style || "center",
            position: parsed.position || { x: 50, y: 50 },
            topBanner: ensureFullUrl(parsed.topBanner || ""),
            topBannerOpacity: parsed.topBannerOpacity !== undefined ? parsed.topBannerOpacity : 1.0,
            bottomBanner: ensureFullUrl(parsed.bottomBanner || ""),
            bottomBannerOpacity: parsed.bottomBannerOpacity !== undefined ? parsed.bottomBannerOpacity : 1.0
          };
          if (parsed.pageMargins) pageMargins = parsed.pageMargins;
        } catch (e) {
          console.error("Error parsing template settings:", e);
        }
      }
    }
  }

  // 2. Legacy Fallback (ONLY if modern template not found)
  if (!templateHtml) {
    let { data: settingData, error: settingError } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', `template_${documentType}`)
      .maybeSingle();

    // Fallback for certificate -> flight certificate
    if (!settingData && documentType === 'certificate') {
      const { data: legacySettingData } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'template_flight certificate')
        .maybeSingle();
      if (legacySettingData) {
        settingData = legacySettingData;
      }
    }

    if (settingError) throw settingError;
    
    if (settingData && settingData.value) {
      const templatePath = settingData.value;
      const isLegacyFlightCert = documentType === 'certificate' && !settingData.value.includes('certificate') && settingData.value.includes('flight');

      // 2b. Fetch Template Settings (Background & Margins)
      const settingsKey = isLegacyFlightCert 
        ? `template_flight certificate_settings` 
        : `template_${documentType}_settings`;

      const { data: settingsData, error: settingsError } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', settingsKey)
        .maybeSingle();

      if (!settingsError && settingsData) {
        try {
          const parsed = JSON.parse(settingsData.value);
          bgSettings = {
            url: ensureFullUrl(parsed.url || ""),
            opacity: parsed.opacity !== undefined ? parsed.opacity : 0.15,
            style: parsed.style || "center",
            position: parsed.position || { x: 50, y: 50 },
            topBanner: ensureFullUrl(parsed.topBanner || ""),
            topBannerOpacity: parsed.topBannerOpacity !== undefined ? parsed.topBannerOpacity : 1.0,
            bottomBanner: ensureFullUrl(parsed.bottomBanner || ""),
            bottomBannerOpacity: parsed.bottomBannerOpacity !== undefined ? parsed.bottomBannerOpacity : 1.0
          };
          if (parsed.pageMargins) {
            pageMargins = parsed.pageMargins;
          }
        } catch (e) {
          console.error("Error parsing template settings:", e);
        }
      }

      // 3. Download Legacy Template Content
      const trimmedPath = templatePath.trim();
      const { data: templateData, error: templateError } = await supabase.storage
        .from('media')
        .download(trimmedPath);
        
      if (templateError) {
        console.error("Storage download error:", templateError);
        // Don't crash, use a fallback empty template with a warning
        templateHtml = `
          <div style="padding: 50px; text-align: center; border: 2px dashed #ccc; margin: 20px; border-radius: 10px;">
            <h2 style="color: #666;">Document Template Not Found</h2>
            <p style="color: #999;">Could not load the template file: <strong>${trimmedPath}</strong></p>
            <p style="color: #999;">Please go to <strong>Template Doc</strong> and set a default template.</p>
            <div style="margin-top: 20px; color: #aaa; font-size: 12px;">Error: ${templateError.message}</div>
          </div>
        `;
      } else {
        templateHtml = await templateData.text();
      }

      // 3b. Load and Replace Tables (Legacy Only)
      if (trimmedPath.endsWith('.html')) {
        const jsonPath = trimmedPath.replace('.html', '.json');
        try {
            const { data: jsonData, error: jsonError } = await supabase.storage
              .from('media')
              .download(jsonPath);

            if (!jsonError && jsonData) {
              const jsonText = await jsonData.text();
              const tables: TableData[] = JSON.parse(jsonText);
              if (Array.isArray(tables)) {
                  tables.forEach(table => {
                    const tableHtml = generateTableHtml(table);
                    templateHtml = templateHtml.replace(new RegExp(`{table.${table.id}}`, 'g'), tableHtml);
                  });
              }
            }
        } catch (e) {
            console.warn("Table JSON not found for PDF:", e);
        }
      }
    } else {
      // If no modern template AND no legacy setting, throw error
      throw new Error(`Template not configured for: ${documentType}. Please go to Admin > Templates to configure it.`);
    }
  }

  const templateHtmlFinal = templateHtml;

  // 4. Replace Variables
  const replaceAllVariables = (text: string) => {
    let result = text;
    
    // First, process sum(...) formulas
    result = result.replace(/sum\((.*?)\)/g, (match, expression) => {
      try {
        let evalExpr = expression.replace(/<[^>]*>?/gm, '').trim();
        let isTimeCalc = false;
        let hasCurrency = false;

        evalExpr = evalExpr.replace(/\{[^}]+\}/g, (varMatch) => {
           const val = getVariableValue(varMatch, booking, passenger);
           const valStr = val ? val.toString().trim() : "0";
           
           if (/^RM\s*/i.test(valStr)) hasCurrency = true;
           
           let cleanVal = valStr.replace(/^RM\s*/i, '').trim();
           if (cleanVal === "") cleanVal = "0";
           
           if (cleanVal.includes(':') || /^\d+h$/.test(cleanVal)) {
             isTimeCalc = true;
             if (cleanVal.includes(':')) {
                const timeMatch = cleanVal.match(/(\d+):(\d+)\s*(am|pm)?/i);
                if (timeMatch) {
                  let h = parseInt(timeMatch[1]);
                  const m = parseInt(timeMatch[2]);
                  const period = timeMatch[3]?.toLowerCase();
                  if (period === 'pm' && h < 12) h += 12;
                  if (period === 'am' && h === 12) h = 0;
                  return (h * 60 + m).toString();
                }
             } else if (/^\d+h$/.test(cleanVal)) {
                return (parseInt(cleanVal) * 60).toString();
             }
           }
           return cleanVal;
        });
        
        if (!/^[\d+\-*/().\s]+$/.test(evalExpr)) return match;
        
        const evalResult = new Function(`return ${evalExpr}`)();
        
        if (isTimeCalc && typeof evalResult === 'number') {
           let mins = Math.round(evalResult) % 1440;
           if (mins < 0) mins += 1440;
           const h = Math.floor(mins / 60);
           const m = mins % 60;
           const period = h >= 12 ? 'pm' : 'am';
           const displayH = h % 12 === 0 ? 12 : h % 12;
           return `${displayH}:${m.toString().padStart(2, '0')}${period}`;
        }

        if (typeof evalResult === 'number') {
           const formatted = evalResult % 1 !== 0 ? evalResult.toFixed(2) : evalResult.toString();
           return hasCurrency ? `RM ${formatted}` : formatted;
        }
        return evalResult;
      } catch (e) {
        return match;
      }
    });

    const imageUrlVars = new Set([
      "{passenger.id_front_url}",
      "{passenger.id_back_url}",
      "{package.image_url}",
      "{booking.payment_proof_url}"
    ]);

    // Then, replace standard variables
    AVAILABLE_VARIABLES.forEach(category => {
      category.vars.forEach(v => {
        const val = getVariableValue(v, booking, passenger);
        const valStr = val !== null && val !== undefined ? val.toString() : "";
        
        // Use a more robust replacement that handles special characters
        const escapedVar = v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (imageUrlVars.has(v) && valStr && (valStr.startsWith('http') || valStr.startsWith('data:'))) {
          result = result.replace(new RegExp(`src=["']${escapedVar}["']`, 'g'), `src="${valStr}"`);
          result = result.replace(new RegExp(`url\\(['"]?${escapedVar}['"]?\\)`, 'g'), `url("${valStr}")`);
          const imgTag = `<img src="${valStr}" style="display: inline-block; max-width: 80%; max-height: 480px; width: auto; height: auto; object-fit: contain; border-radius: 6px; border: 1px solid #ddd; margin: 5px 1%; vertical-align: top;" alt="Image" />`;
          result = result.replace(new RegExp(escapedVar, 'g'), imgTag);
          return;
        }

        result = result.replace(new RegExp(escapedVar, 'g'), valStr);
      });
    });

    result = result.replace(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi, (match, src) => {
      const fullUrl = ensureFullUrl(src);
      return match.replace(src, fullUrl);
    });

    result = result.replace(/url\(['"]?([^'"]+)['"]?\)/gi, (match, url) => {
      const fullUrl = ensureFullUrl(url);
      return `url("${fullUrl}")`;
    });

    return result;
  };

  const processedHtml = replaceAllVariables(templateHtmlFinal);

  // 4. Final settings application
  // Override template-specific margins if user explicitly chose a preset or provided custom margins
  if (margins === 'Narrow') {
    pageMargins = { left: 10, right: 10, top: 10, bottom: 10 };
  } else if (margins === 'None') {
    pageMargins = { left: 0, right: 0, top: 0, bottom: 0 };
  } else if (typeof margins === 'object') {
    pageMargins = margins;
  }

  const isLandscape = orientation === 'landscape';
  const isA4 = pageSize === 'A4';
  const widthMmVal = isLandscape ? (isA4 ? 297 : 279.4) : (isA4 ? 210 : 215.9);
  const heightMmVal = isLandscape ? (isA4 ? 210 : 215.9) : (isA4 ? 297 : 279.4);
  
  // Visual page height for the preview (shorter than actual to provide safety margin)
  const visualHeightMm = heightMmVal - 32; 

  const widthMm = `${widthMmVal}mm`;
  const heightMm = `${heightMmVal}mm`;
  const windowW = isLandscape ? (isA4 ? 1122.5 : 1056) : (isA4 ? 793.7 : 816);
  const windowH = isLandscape ? (isA4 ? 793.7 : 816) : (isA4 ? 1122.5 : 1056);

  const pageBreakStyles = showPageBreaks ? `
      /* Visual page break indicator overlay */
      .pdf-container::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-image: repeating-linear-gradient(
          to bottom,
          transparent 0,
          transparent calc(${heightMm} - 25mm),
          #525659 calc(${heightMm} - 25mm),
          #525659 calc(${heightMm} - 25mm + 20px)
        );
        pointer-events: none;
        z-index: 9999;
      }
      /* Add visual "PAGE BREAK" labels in the gaps */
      .pdf-container::after {
        content: 'PAGE BREAK';
        position: absolute;
        top: calc(${heightMm} - 25mm);
        left: 50%;
        transform: translateX(-50%);
        height: 20px;
        display: flex;
        align-items: center;
        color: #fff;
        font-size: 10px;
        font-weight: bold;
        letter-spacing: 3px;
        pointer-events: none;
        z-index: 10000;
        text-shadow: 0 1px 2px rgba(0,0,0,0.5);
      }
  ` : '';

  const publicViewStyles = !showPageBreaks ? `
      html, body {
        width: 100%;
        max-width: 100%;
        overflow-x: hidden;
        margin: 0;
        padding: 0;
      }
      body {
        display: block;
        min-height: auto;
      }
      .pdf-container {
        width: 100%;
        max-width: 100%;
        min-height: auto;
        height: auto;
        margin: 0;
        padding: 0;
      }
      .pdf-content {
        min-height: auto !important;
        margin: 0;
        padding: 0;
      }
      .pdf-content > *:first-child {
        margin-top: 0 !important;
      }
      .pdf-content p:first-child,
      .pdf-content .page-a4:first-child,
      .pdf-content .ql-editor:first-child {
        margin-top: 0 !important;
        padding-top: 0 !important;
      }
      .page-a4 {
        margin-top: 0 !important;
        padding-top: 0 !important;
      }
      @media (min-width: 768px) {
        html, body {
          margin: 0 !important;
          padding: 0 !important;
        }
        .pdf-container {
          width: 100%;
          max-width: none;
          margin-top: 0 !important;
          padding-top: 0 !important;
        }
        .pdf-content {
          margin-top: 0 !important;
          padding-top: 0 !important;
        }
        .pdf-content img:first-child,
        .pdf-content table:first-child,
        .pdf-content h1:first-child,
        .pdf-content h2:first-child,
        .pdf-content h3:first-child {
          margin-top: 0 !important;
        }
      }
      @media (max-width: 767px) {
        .pdf-container {
          width: 100%;
          max-width: 100vw;
          min-height: auto;
          height: auto;
          margin: 0;
          padding: 0;
        }
        table {
          display: block;
          width: 100% !important;
          max-width: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }
        th, td {
          padding: 4px;
          font-size: clamp(11px, 3.2vw, 14px);
        }
        img {
          width: auto !important;
          max-width: 100% !important;
          height: auto !important;
        }
      }
  ` : '';

  const pdfStyles = `
    <style>
      body {
        margin: 0;
        padding: 0;
        background-color: ${showPageBreaks ? '#525659' : 'white'};
        display: ${showPageBreaks ? 'flex' : 'block'};
        flex-direction: column;
        align-items: ${showPageBreaks ? 'center' : 'stretch'};
        font-family: Arial, sans-serif;
      }
      .pdf-container {
        width: ${showPageBreaks ? widthMm : '100%'};
        min-height: ${showPageBreaks ? heightMm : 'auto'};
        padding: ${showPageBreaks
          ? `${pageMargins.top}mm ${pageMargins.right}mm ${pageMargins.bottom}mm ${pageMargins.left}mm`
          : '0'};
        background: white;
        box-sizing: border-box;
        position: relative;
        font-family: Arial, sans-serif;
        color: #333;
        line-height: 1.5;
        text-align: left;
        margin: ${showPageBreaks ? '10px auto' : '0'};
        box-shadow: ${showPageBreaks ? '0 0 20px rgba(0,0,0,0.4)' : 'none'};
        overflow: visible;
        overflow-wrap: break-word;
        word-wrap: break-word;
      }
      ${pageBreakStyles}
      ${publicViewStyles}
      .pdf-container * {
        box-sizing: border-box;
        max-width: 100%;
      }
      .bg-layer, .top-banner-layer, .bottom-banner-layer {
        position: absolute;
        left: 0;
        width: 100%;
        pointer-events: none;
        z-index: 0;
      }
      .pdf-content {
        position: relative !important;
        z-index: 1;
        width: 100% !important;
        min-height: ${showPageBreaks ? 'inherit' : 'auto'} !important;
        margin: ${showPageBreaks ? 'unset' : '0'};
        padding: ${showPageBreaks ? 'unset' : '0'};
      }
      span[style*="background-color"] {
        padding-bottom: 3px;
        padding-top: 1px;
        box-decoration-break: clone;
        -webkit-box-decoration-break: clone;
        line-height: 1.6;
      }
      /* Thin borders for tables */
      table, th, td {
        border: 0.2px solid #ddd !important;
        border-collapse: collapse;
      }
      th, td {
        padding: 8px;
      }
      
      /* Alignment Styles */
      .ql-align-center { text-align: center; }
      .ql-align-right { text-align: right; }
      .ql-align-justify { text-align: justify; }

      /* Image Alignment & Spacing */
      .ql-align-center img { display: block; margin: 0 auto; }
      .ql-align-right img { display: block; margin-left: auto; margin-right: 0; }
      img { max-width: 100%; height: auto; }
      
      /* Paragraph Spacing */
      p {
        margin-bottom: 0.5em;
        min-height: 1em;
        ${!showPageBreaks ? 'margin-top: 0;' : ''}
      }
      
      /* Preserve Whitespace */
      .ql-editor { white-space: pre-wrap; }

      ${!showPageBreaks ? `
      @media (min-width: 768px) {
        .pdf-container,
        .pdf-content,
        .pdf-content > *:first-child,
        .page-a4 {
          margin-top: 0 !important;
          padding-top: 0 !important;
        }
      }
      ` : ''}

      @media print {
        body { background-color: white; }
        .pdf-container {
          box-shadow: none !important;
          margin: 0 !important;
          width: ${widthMm} !important;
          max-width: ${widthMm} !important;
          min-height: ${heightMm} !important;
          padding: ${pageMargins.top}mm ${pageMargins.right}mm ${pageMargins.bottom}mm ${pageMargins.left}mm !important;
        }
        .pdf-container::before, .pdf-container::after {
          display: none !important;
        }
      }
    </style>
  `;

  // 5. Generate PDF
  let bgStyleCss = "";
  if (bgSettings.url) {
    switch (bgSettings.style) {
      case "stretch":
        bgStyleCss = `background-size: 100% 100%; background-position: center; background-repeat: no-repeat;`;
        break;
      case "tile":
        bgStyleCss = `background-size: auto; background-position: top left; background-repeat: repeat;`;
        break;
      case "center":
      default:
        bgStyleCss = `background-size: contain; background-position: ${bgSettings.position.x}% ${bgSettings.position.y}%; background-repeat: no-repeat;`;
        break;
    }
  }

  const backgroundHtml = bgSettings.url ? `
    <div class="bg-layer" style="
      top: 0;
      height: 100%;
      background-image: url('${bgSettings.url}');
      opacity: ${bgSettings.opacity};
      ${bgStyleCss}
    "></div>
  ` : "";

  const topBannerHtml = bgSettings.topBanner ? `
    <div class="top-banner-layer" style="
      top: 0;
      height: 100%;
      background-image: url('${bgSettings.topBanner}');
      background-size: 100% auto;
      background-position: top;
      background-repeat: no-repeat;
      opacity: ${bgSettings.topBannerOpacity};
    "></div>
  ` : "";

  const bottomBannerHtml = bgSettings.bottomBanner ? `
    <div class="bottom-banner-layer" style="
      top: 0;
      height: 100%;
      background-image: url('${bgSettings.bottomBanner}');
      background-size: 100% auto;
      background-position: bottom;
      background-repeat: no-repeat;
      opacity: ${bgSettings.bottomBannerOpacity};
    "></div>
  ` : "";

  const fullHtml = pdfStyles + `
    <div class="pdf-container">
      ${backgroundHtml}
      ${topBannerHtml}
      ${bottomBannerHtml}
      <div class="pdf-content">
        ${processedHtml}
      </div>
    </div>
  `;
  
  // Use a unique name
  const fileName = `${documentType}_${booking.booking_reference}_${Date.now()}.pdf`;

  // 5b. Prepare element for rendering (Required for both preview and PDF to ensure styles/images are processed)
  const element = document.createElement('div');
  element.innerHTML = fullHtml;
  element.style.width = widthMm;
  element.style.minHeight = heightMm;
  element.style.padding = '0';
  element.style.margin = '0';
  element.style.backgroundColor = 'white';
  
  // Create a container to manage visibility and layout
  const container = document.createElement('div');
  container.id = 'pdf-render-container';
  
  // Always keep it hidden from the user as requested
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = widthMm;
  container.appendChild(element);
  
  document.body.appendChild(container);
  
  // Wait for images to load more reliably
  const images = element.getElementsByTagName('img');
  const imagePromises = Array.from(images).map(img => {
    if (img.complete) return Promise.resolve();
    return new Promise(resolve => {
      img.onload = resolve;
      img.onerror = resolve; 
    });
  });
  
  // Small delay to ensure styles and images are fully processed
  const displayWait = 1000;
  
  await Promise.all([
    ...imagePromises,
    new Promise(resolve => setTimeout(resolve, displayWait)) 
  ]);

  // Return the HTML structure for preview
  const htmlResult = element.innerHTML;
  
  // Cleanup
  if (document.body.contains(container)) {
    document.body.removeChild(container);
  }

  return { 
    html: htmlResult,
    orientation: isLandscape ? 'landscape' : 'portrait',
    pageSize: isA4 ? 'A4' : 'Letter',
    widthMm: parseInt(widthMm.replace('mm', '')),
    heightMm: parseInt(heightMm.replace('mm', '')),
    windowW: windowW,
    windowH: windowH
  };
};
