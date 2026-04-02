import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { supabase } from "@/lib/supabase";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function generateBookingReference(flightDate?: string | Date): Promise<string> {
  const dateObj = flightDate ? new Date(flightDate) : new Date();
  
  // Use UTC to avoid timezone shifts
  const year = dateObj.getUTCFullYear().toString().slice(-2);
  const month = (dateObj.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = dateObj.getUTCDate().toString().padStart(2, '0');
  const dateStr = `${year}${month}${day}`;
  
  let query = supabase.from('bookings').select('*', { count: 'exact', head: true });
  
  if (flightDate) {
    // flight_date in DB is a 'date' type, so we query using 'YYYY-MM-DD'
    const fullYear = dateObj.getUTCFullYear();
    const formattedDate = `${fullYear}-${month}-${day}`;
    query = query.eq('flight_date', formattedDate);
  } else {
    // If no flightDate, fallback to counting bookings created today
    const startOfDay = new Date(Date.UTC(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate())).toISOString();
    query = query.gte('created_at', startOfDay);
  }

  const { count, error } = await query;

  if (error) {
    console.error("Error generating booking reference:", error);
    // Fallback if query fails
    return `BK-${dateStr}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
  }

  const runningNumber = (count || 0) + 1;
  return `BK-${dateStr}-${runningNumber.toString().padStart(3, '0')}`;
}
