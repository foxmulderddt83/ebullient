export const DOCUMENT_TYPES = [
  { value: "invoice_paid", label: "Invoice (Paid)" },
  { value: "booking_confirmation", label: "Booking Confirmation" },
  { value: "certificate", label: "Flight Certificate" },
  { value: "gendec", label: "General Declaration (GenDec)" },
  { value: "refund_voucher", label: "Refund Voucher" }
];

export const AVAILABLE_VARIABLES = [
  { category: "Customer", vars: ["{customer.name}", "{customer.email}", "{customer.phone}", "{customer.created_at}"] },
  { category: "Booking", vars: ["{booking.booking_reference}", "{booking.reference}", "{booking.date}", "{booking.time}", "{booking.total_amount}", "{booking.paid_amount}", "{booking.deposit_amount}", "{booking.discount_amount}", "{booking.amount_to_pay}", "{booking.payment_type}", "{booking.outstanding_balance}", "{booking.status}", "{booking.payment_status}", "{booking.payment_method}", "{booking.payment_gateway}", "{booking.paid_at}", "{booking.payment_id}", "{booking.payment_proof_url}", "{booking.add_items_summary}", "{booking.flight_date}", "{booking.flight_time}", "{booking.invoice_id}", "{booking.pilot_name}", "{booking.aircraft_registration}", "{booking.notes}"] },
  { category: "Package", vars: ["{package.name}", "{package.description}", "{package.price}", "{package.quantity}", "{package.image_url}", "{package.max_quantity}", "{package.promotion_price}", "{package.promotion_start_at}", "{package.promotion_end_at}", "{package.created_at}", "{package.google_maps_link}", "{add_items_amount}", "{booking.items_text}"] },
  { category: "Passenger", vars: ["{passenger.name}", "{passenger.ic}", "{passenger.ic_passport_number}", "{passenger.type}", "{passenger.gender}", "{passenger.weight}", "{passenger.height}", "{passenger.country}", "{passenger.country_of_origin}", "{passenger.status}", "{passenger.id_front_url}", "{passenger.id_back_url}", "{passenger.created_at}", "{registration.nric_number}", "{registration.nationality}"] },
  { category: "Flight Operation", vars: ["{flight.date}", "{flight.time}", "{pilot.name}", "{aircraft.registration}"] },
  { category: "Legacy/Shortcuts", vars: ["{customer_name}", "{customer_email}", "{customer_phone}", "{booking_id}", "{booking_reference}", "{invoice_id}", "{flight_date}", "{flight_time}", "{minus_1hours}", "{package_name}", "{total_amount}", "{paid_amount}", "{deposit_amount}", "{deposit}", "{discount_amount}", "{discount}", "{amount_to_pay}", "{payment_type}", "{status}", "{payment_status}", "{pilot_name}", "{aircraft_registration}"] },
];
