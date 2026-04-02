export interface Registration {
  id: string;
  name: string;
  email: string;
  phone: string;
  gender: "Male" | "Female" | "Other";
  age: number;
  weight: number;
  address: string;
  selectedDate: string;
  selectedTimeSlot: string;
  notes?: string;
  documentName?: string;
  documentType?: string;
  documentSize?: number;
  nric_number?: string;
  nric_confirmed?: boolean;
  registeredAt: string;
  checkedInAt?: string | null;
}

export interface RegistrationFormData {
  name: string;
  email: string;
  phone: string;
  gender: "Male" | "Female" | "Other";
  age: number;
  weight: number;
  address: string;
  selectedDate: Date | undefined;
  selectedTimeSlot: string;
  notes: string;
  document: File | null;
  nric_confirmed: boolean;
  nric_number: string;
}
