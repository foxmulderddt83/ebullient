import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import html2pdf from 'html2pdf.js';
import { AVAILABLE_VARIABLES } from "@/lib/constants";

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

export const getVariableValue = (variable: string, booking: any, passenger?: any) => {
  const customer = booking.customer || {};
  const items = booking.booking_items || [];
  const firstPackage = items.length > 0 && items[0].package ? items[0].package : (booking.package_details || {});
  
  // Fallback to first passenger if not explicitly provided
  const currentPassenger = passenger || (booking.booking_passengers && booking.booking_passengers.length > 0 ? booking.booking_passengers[0] : null);

  switch (variable) {
    case "{customer.name}": return (customer.name || "").toUpperCase();
    case "{customer.email}": return (customer.email || "").toUpperCase();
    case "{customer.phone}": return (customer.phone || "").toUpperCase();
    case "{customer.created_at}": return customer.created_at ? format(new Date(customer.created_at), 'dd MMM yyyy') : "";
    
    case "{booking.booking_reference}": return (booking.booking_reference || "").toUpperCase();
    case "{booking.reference}": return (booking.booking_reference || "").toUpperCase(); // Support both
    case "{booking.date}": return booking.created_at ? format(new Date(booking.created_at), 'EEEE d MMM yyyy') : "";
    case "{booking.time}": return booking.created_at ? format(new Date(booking.created_at), 'HH:mm') : "";
    case "{booking.status}": return (booking.status || "").toUpperCase();
    case "{booking.total_amount}": return booking.total_amount ? `RM ${booking.total_amount}` : "";
    case "{booking.paid_amount}": return booking.paid_amount ? `RM ${booking.paid_amount}` : "";
    case "{booking.payment_status}": return (booking.payment_status || "").toUpperCase();
    case "{booking.payment_method}": return (booking.payment_method || "").toUpperCase();
    case "{booking.payment_gateway}": return (booking.payment_gateway || "").toUpperCase();
    case "{booking.paid_at}": return booking.paid_at ? format(new Date(booking.paid_at), 'EEEE d MMM yyyy HH:mm') : "";
    case "{booking.payment_id}": return (booking.payment_id || "").toUpperCase();
    case "{booking.payment_proof_url}": return booking.payment_proof_url || "";
    case "{booking.add_items_summary}": 
      if (items && items.length > 0) {
        return items.map((item: any, idx: number) => `
          <div style="margin-bottom: 1px; border: 1px solid #6b7280; border-radius: 6px; padding: 2px; background-color: transparent;">
            <div style="font-weight: 700; font-size: 14px; margin-bottom: 1px; color: #111827; padding-bottom: 1px; line-height: 1.1;">
               Item ${idx + 1}: ${(item.package?.name || "").toUpperCase()}
            </div>
          </div>
        `).join('');
      } else if (booking.package_details) {
         const pd = booking.package_details;
         return `
          <div style="margin-bottom: 1px; border: 1px solid #6b7280; border-radius: 6px; padding: 2px; background-color: transparent;">
            <div style="font-weight: 700; font-size: 14px; margin-bottom: 1px; color: #111827; padding-bottom: 1px; line-height: 1.1;">
               Package: ${(pd.name || "").toUpperCase()}
            </div>
          </div>
         `;
      }
      return "";
    case "{booking.payment_type}": return (booking.payment_type || "").toUpperCase();
    case "{booking.deposit_amount}": {
      const dep = booking.deposit_amount;
      const val = (dep === undefined || dep === null || dep === "" || dep === 0 || dep === "0") ? booking.total_amount : dep;
      return val ? `RM ${val}` : "";
    }
    case "{booking.discount_amount}": return booking.discount_amount ? `RM ${booking.discount_amount}` : "RM 0.00";
    case "{deposit}": {
      const dep = booking.deposit_amount;
      const val = (dep === undefined || dep === null || dep === "" || dep === 0 || dep === "0") ? booking.total_amount : dep;
      return val ? `RM ${val}` : "";
    }
    case "{discount}": return booking.discount_amount ? `RM ${booking.discount_amount}` : "RM 0.00";
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
    case "{booking.notes}": return (booking.notes || "").toUpperCase();
    
    case "{package.name}": return (firstPackage?.name || (items.map((i:any) => i.package?.name).filter(Boolean).join(', ')) || "").toUpperCase();
    case "{package.description}": return (firstPackage?.description || "").toUpperCase();
    case "{package.price}": return firstPackage?.price ? `RM ${firstPackage.price}` : "";
    case "{package.quantity}": return items.length > 0 ? (items[0].quantity ?? "") : "";
    case "{package.image_url}": return firstPackage?.image_url || "";
    case "{package.max_quantity}": return firstPackage?.max_quantity || "";
    case "{package.promotion_price}": return firstPackage?.promotion_price ? `RM ${firstPackage.promotion_price}` : "";
    case "{package.promotion_start_at}": return firstPackage?.promotion_start_at ? format(new Date(firstPackage.promotion_start_at), 'dd MMM yyyy') : "";
    case "{package.promotion_end_at}": return firstPackage?.promotion_end_at ? format(new Date(firstPackage.promotion_end_at), 'dd MMM yyyy') : "";
    case "{package.created_at}": return firstPackage?.created_at ? format(new Date(firstPackage.created_at), 'dd MMM yyyy') : "";
    case "{package.google_maps_link}": {
      const link = firstPackage?.google_maps_link || "";
      if (!link) return "";
      // If the link is already an HTML anchor tag, return it as is
      if (link.startsWith('<a')) return link;
      // Otherwise, wrap it in an anchor tag for auto-linking
      return `<a href="${link}" target="_blank" style="color: #2563eb; text-decoration: underline;">${link}</a>`;
    }
    
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
                       <img src="${p.id_front_url}" style="width: 100%; height: 100%; object-fit: cover;" />
                     </div>
                   ` : ''}
                   ${p.id_back_url ? `
                     <div style="width: 120px; height: 80px; border: 1px solid #e2e8f0; border-radius: 4px; overflow: hidden;">
                       <img src="${p.id_back_url}" style="width: 100%; height: 100%; object-fit: cover;" />
                     </div>
                   ` : ''}
                 </div>
               </div>
             ` : ''}
           </div>
         `).join('');
      }
      return "";
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
    case "{passenger.id_front_url}": return currentPassenger?.id_front_url || "";
    case "{passenger.id_back_url}": return currentPassenger?.id_back_url || "";
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
    case "{deposit}": {
      const dep = booking.deposit_amount;
      const val = (dep === undefined || dep === null || dep === "" || dep === 0 || dep === "0") ? booking.total_amount : dep;
      return val ? `RM ${val}` : "";
    }
    case "{discount}": return booking.discount_amount ? `RM ${booking.discount_amount}` : "RM 0.00";
    case "{deposit_amount}": {
      const dep = booking.deposit_amount;
      const val = (dep === undefined || dep === null || dep === "" || dep === 0 || dep === "0") ? booking.total_amount : dep;
      return val ? `RM ${val}` : "";
    }
    case "{discount_amount}": return booking.discount_amount ? `RM ${booking.discount_amount}` : "RM 0.00";
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
  orientation: 'portrait' | 'landscape' = 'landscape',
  pageSize: 'A4' | 'Letter' = 'A4',
  margins: 'Normal' | 'Narrow' | 'None' = 'Normal'
) => {
  if (!supabase) throw new Error("Supabase client not initialized");

  // 1. Fetch Booking Data
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

  if (bookingError || !booking) {
    throw new Error("Booking not found");
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

  return generatePDFFromData(booking, documentType, passenger, false, undefined, orientation, pageSize, margins);
};

export const generateAndPreviewPDF = async (
  bookingId: string, 
  documentType: string, 
  passengerId?: string, 
  orientation: 'portrait' | 'landscape' = 'landscape',
  pageSize: 'A4' | 'Letter' = 'A4',
  margins: 'Normal' | 'Narrow' | 'None' = 'Normal'
) => {
  if (!supabase) throw new Error("Supabase client not initialized");

  // 1. Fetch Booking Data
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

  if (bookingError || !booking) {
    throw new Error("Booking not found");
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

  return generatePDFFromData(booking, documentType, passenger, true, undefined, orientation, pageSize, margins);
};

export const generateRegistrationPDF = async (
  registrationId: string, 
  documentType: string, 
  isPreview: boolean = false, 
  templateId?: string, 
  orientation: 'portrait' | 'landscape' = 'landscape',
  pageSize: 'A4' | 'Letter' = 'A4',
  margins: 'Normal' | 'Narrow' | 'None' = 'Normal'
) => {
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

  return generatePDFFromData(mockBooking, documentType, mockPassenger, isPreview, templateId, orientation, pageSize, margins);
};

export const generatePDFFromData = async (
  booking: any, 
  documentType: string, 
  passenger?: any, 
  isPreview: boolean = false, 
  templateId?: string, 
  orientation: 'portrait' | 'landscape' = 'landscape',
  pageSize: 'A4' | 'Letter' = 'A4',
  margins: 'Normal' | 'Narrow' | 'None' = 'Normal'
) => {
  if (!supabase) throw new Error("Supabase client not initialized");

  let templateHtml = "";
  let bgSettings = { url: "", opacity: 0.15, style: "center" };
  let pageMargins = { left: 20, right: 20, top: 20, bottom: 20 };

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
    
    // Fetch settings from site_settings for this template
    // If it's a legacy template, it might be stored under the old key
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
          url: parsed.url || "",
          opacity: parsed.opacity !== undefined ? parsed.opacity : 0.15,
          style: parsed.style || "center"
        };
        if (parsed.pageMargins) {
          pageMargins = parsed.pageMargins;
        }
      } catch (e) {
        console.error("Error parsing template settings:", e);
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
            url: parsed.url || "",
            opacity: parsed.opacity !== undefined ? parsed.opacity : 0.15,
            style: parsed.style || "center"
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

  // 4. Replace Variables
  // 4a. Process Formulas (sum(...))
  // Supports: sum({total.paid} - {deposit})
  // Supports Time Arithmetic: sum({booking.flight_time} - {minus_1hours})
  templateHtml = templateHtml.replace(/sum\((.*?)\)/g, (match, expression) => {
    try {
      // 1. Strip HTML tags from the expression and replace variables
      let evalExpr = expression.replace(/<[^>]*>?/gm, '').trim();
      let isTimeCalc = false;
      let hasCurrency = false;

      // Find all {variable} patterns
      evalExpr = evalExpr.replace(/\{[^}]+\}/g, (varMatch) => {
         const val = getVariableValue(varMatch, booking, passenger);
         const valStr = val ? val.toString().trim() : "0";
         
         if (/^RM\s*/i.test(valStr)) {
            hasCurrency = true;
         }
         
         // Remove "RM " prefix if present for numeric calculations
         let cleanVal = valStr.replace(/^RM\s*/i, '').trim();
         if (cleanVal === "") cleanVal = "0";
         
         // Check if it's a time string (HH:mm, HH:mmam/pm) or a relative time (1h)
         if (cleanVal.includes(':') || /^\d+h$/.test(cleanVal)) {
           isTimeCalc = true;
           // Convert to minutes
           if (cleanVal.includes(':')) {
              // Handle HH:mm and HH:mmAM/PM
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
              // Handle 1h, 2h, etc.
              return (parseInt(cleanVal) * 60).toString();
           }
         }
         return cleanVal;
      });
      
      // 2. Sanitize: allow digits, ., +, -, *, /, (, ), and spaces
      if (!/^[\d+\-*/().\s]+$/.test(evalExpr)) {
        console.warn("Invalid characters in formula:", evalExpr);
        return match;
      }
      
      // 3. Evaluate safely
      const result = new Function(`return ${evalExpr}`)();
      
      // 4. Return formatted result
      if (isTimeCalc && typeof result === 'number') {
         // Convert back to time (HH:mm)
         // Handle overflow/underflow (e.g. 00:00 - 1h -> 23:00)
         let mins = Math.round(result) % 1440;
         if (mins < 0) mins += 1440;
         const h = Math.floor(mins / 60);
         const m = mins % 60;
         
         // Return in standard AM/PM format
         const period = h >= 12 ? 'pm' : 'am';
         const displayH = h % 12 === 0 ? 12 : h % 12;
         return `${displayH}:${m.toString().padStart(2, '0')}${period}`;
      }

      if (typeof result === 'number') {
         const formatted = result % 1 !== 0 ? result.toFixed(2) : result.toString();
         return hasCurrency ? `RM ${formatted}` : formatted;
      }
      return result;
    } catch (e) {
      console.error("Formula error:", e);
      return match;
    }
  });

  // 4. Final settings application
  // Override template-specific margins if user explicitly chose Narrow or None
  if (margins === 'Narrow') {
    pageMargins = { left: 10, right: 10, top: 10, bottom: 10 };
  } else if (margins === 'None') {
    pageMargins = { left: 0, right: 0, top: 0, bottom: 0 };
  }

  // 4b. Standard variable replacement
  AVAILABLE_VARIABLES.forEach(category => {
    category.vars.forEach(variable => {
      const value = getVariableValue(variable, booking, passenger);
      // Global replace
      templateHtml = templateHtml.replace(new RegExp(variable.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
    });
  });

  const isLandscape = orientation === 'landscape';
  const isA4 = pageSize === 'A4';
  const widthMm = isLandscape ? (isA4 ? '297mm' : '279.4mm') : (isA4 ? '210mm' : '215.9mm');
  const heightMm = isLandscape ? (isA4 ? '210mm' : '215.9mm') : (isA4 ? '297mm' : '279.4mm');
  const windowW = isLandscape ? (isA4 ? 1122.5 : 1056) : (isA4 ? 793.7 : 816);

  const pdfStyles = `
    <style>
      .pdf-container {
        width: ${widthMm};
        min-height: ${heightMm};
        padding: ${pageMargins.top}mm ${pageMargins.right}mm ${pageMargins.bottom}mm ${pageMargins.left}mm;
        background: white;
        box-sizing: border-box;
        position: relative;
        overflow: hidden;
        font-family: Arial, sans-serif;
        color: #333;
        line-height: 1.5;
        text-align: left;
      }
      .pdf-container * {
        box-sizing: border-box;
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
      p { margin-bottom: 0.5em; min-height: 1em; }
      
      /* Preserve Whitespace */
      .ql-editor { white-space: pre-wrap; }

      /* Visual page break indicator for PDF */
      .page-break {
        page-break-after: always;
        height: 0;
        margin: 0;
        padding: 0;
        border: none;
      }
    </style>
  `;

  // 5. Generate PDF
  let bgStyleCss = "";
  if (bgSettings.url) {
    switch (bgSettings.style) {
      case "stretch":
        bgStyleCss = `
          background-size: 100% 100%;
          background-position: center;
          background-repeat: no-repeat;
        `;
        break;
      case "tile":
        bgStyleCss = `
          background-size: auto;
          background-position: top left;
          background-repeat: repeat;
        `;
        break;
      case "center": // Center (Contain)
      default:
        bgStyleCss = `
          background-size: contain;
          background-position: center;
          background-repeat: no-repeat;
        `;
        break;
    }
  }

  const backgroundHtml = bgSettings.url ? `
    <div style="
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-image: url('${bgSettings.url}');
      opacity: ${bgSettings.opacity};
      z-index: 0;
      pointer-events: none;
      ${bgStyleCss}
    "></div>
  ` : "";

  const fullHtml = pdfStyles + `
    <div class="pdf-container">
      ${backgroundHtml}
      <div style="position: relative; z-index: 1;">
        ${templateHtml}
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

  // If it's just a preview, return the HTML structure
  if (isPreview) {
    const htmlResult = element.innerHTML;
    document.body.removeChild(container);
    return { html: htmlResult };
  }

  const opt = {
    margin:       0,
    filename:     fileName,
    image:        { type: 'jpeg' as const, quality: 0.98 },
    html2canvas:  { 
      scale: 2, 
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: true,
      allowTaint: true,
      scrollY: 0,
      windowWidth: windowW, 
    },
    jsPDF:        { 
      unit: 'mm' as const, 
      format: pageSize.toLowerCase() as any, 
      orientation: orientation as 'portrait' | 'landscape' 
    }
  };

  try {
    // Reset scroll before capture to avoid blank spots
    container.scrollTop = 0;
    
    // Generate PDF using the already rendered element
    const pdfBlob = await (html2pdf()
      .from(element)
      .set(opt)
      .toPdf() as any)
      .output('blob');
    
    // Remove temporary element immediately after capture
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }

    // 6. Upload to Storage
    const storagePath = `generated-docs/${fileName}`;
    const { error: uploadError } = await supabase.storage
      .from('media')
      .upload(storagePath, pdfBlob, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (uploadError) throw uploadError;

    // 7. Save record to DB
    const { data: savedDoc, error: saveError } = await supabase
      .from('generated_documents')
      .insert({
        booking_id: booking.booking_id,
        document_type: documentType,
        file_path: storagePath,
        generated_at: new Date().toISOString(),
        template_metadata: passenger ? { passenger_id: passenger.id, passenger_name: passenger.name } : {}
      })
      .select()
      .single();

    if (saveError) throw saveError;

    // Get Public URL
    const { data: { publicUrl } } = supabase.storage
      .from('media')
      .getPublicUrl(storagePath);

    return {
      ...savedDoc,
      publicUrl,
      blob: pdfBlob
    };
  } catch (error) {
    console.error("PDF Generation/Upload Error:", error);
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
    throw error;
  }
};
