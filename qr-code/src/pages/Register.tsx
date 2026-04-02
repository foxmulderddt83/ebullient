import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Upload, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { eventDetails } from "@/data/mockData";
import { RegistrationFormData } from "@/types/registration";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useSearchParams } from "react-router-dom";

const Register = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [params] = useSearchParams();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<RegistrationFormData>({
    name: "",
    email: "",
    phone: "",
    gender: "Male",
    age: 25,
    weight: 70,
    address: "",
    selectedDate: undefined,
    selectedTimeSlot: "",
    notes: "",
    document: null,
    nric_confirmed: false,
    nric_number: "",
  });

  const updateForm = <K extends keyof RegistrationFormData>(field: K, value: RegistrationFormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file type to determine limit
      const isImage = file.type.startsWith('image/');
      const limit = isImage ? 1 * 1024 * 1024 : 5 * 1024 * 1024;
      const limitLabel = isImage ? "1MB" : "5MB";

      if (file.size > limit) {
        toast({ 
          title: "File too large", 
          description: `File size exceeds the ${limitLabel} limit.`,
          variant: "destructive"
        });
        e.target.value = ''; // Reset input
        return;
      }
      updateForm("document", file);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const eid = params.get("eid") || "default";
    if (!supabase) {
      await new Promise(resolve => setTimeout(resolve, 1200));
      toast({ title: "Registration Successful! 🎉", description: "Saved locally. Supabase not configured." });
      setIsSubmitting(false);
      navigate("/event?eid=" + eid);
      return;
    }
    const payload = {
      event_id: eid,
      registration_data: {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        gender: formData.gender,
        age: formData.age,
        weight: formData.weight,
        address: formData.address,
        date: formData.selectedDate ? formData.selectedDate.toISOString().split("T")[0] : null,
        time_slot: formData.selectedTimeSlot,
        notes: formData.notes || "",
        nric_confirmed: formData.nric_confirmed,
        nric_number: formData.nric_number,
        document_name: formData.document?.name,
        document_type: formData.document?.type,
        document_size: formData.document?.size,
      },
    };
    const { error } = await supabase.from("event_registrations").insert(payload);
    if (error) {
      toast({ title: "Submission failed", description: error.message });
      setIsSubmitting(false);
      return;
    }
    toast({ title: "Registration Successful! 🎉", description: "Your registration has been saved." });
    setIsSubmitting(false);
    navigate("/event?eid=" + eid);
  };

  const canProceedStep1 = formData.selectedDate && formData.selectedTimeSlot;
  const canProceedStep2 = formData.name && formData.email && formData.phone && formData.gender && formData.age && formData.address && formData.nric_confirmed && formData.nric_number;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <button 
            onClick={() => step > 1 ? setStep(step - 1) : navigate("/event")}
            className="p-2 -ml-2 hover:bg-muted rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-semibold">Register for Event</h1>
          <div className="w-9" />
        </div>
      </header>

      {/* Progress */}
      <div className="fixed top-14 left-0 right-0 z-40 bg-background px-4 py-3">
        <div className="max-w-lg mx-auto flex gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                s <= step ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="max-w-lg mx-auto px-4 pt-28 pb-28">
        {/* Step 1: Date & Time */}
        {step === 1 && (
          <div className="animate-fade-in">
            <h2 className="text-xl font-bold mb-6">Select Date</h2>
            
            <div className="bg-card rounded-2xl border border-border p-4 mb-6 shadow-card">
              <Calendar
                mode="single"
                selected={formData.selectedDate}
                onSelect={(date) => updateForm("selectedDate", date)}
                className="w-full"
                disabled={(date) => date < new Date()}
              />
            </div>

            <h2 className="text-xl font-bold mb-4">Select Time Slot</h2>
            <div className="flex flex-wrap gap-3">
              {eventDetails.timeSlots.map((slot) => (
                <button
                  key={slot}
                  onClick={() => updateForm("selectedTimeSlot", slot)}
                  className={`px-4 py-3 rounded-xl border-2 font-medium transition-all ${
                    formData.selectedTimeSlot === slot
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  {slot}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Personal Information */}
        {step === 2 && (
          <div className="animate-fade-in space-y-5">
            <h2 className="text-xl font-bold mb-6">Personal Information</h2>
            
            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => updateForm("name", e.target.value)}
                placeholder="Enter your full name"
                className="h-12"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => updateForm("email", e.target.value)}
                placeholder="your@email.com"
                className="h-12"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number *</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => updateForm("phone", e.target.value)}
                placeholder="+1 234 567 8900"
                className="h-12"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="gender">Gender *</Label>
                <Select
                  value={formData.gender}
                  onValueChange={(value) => updateForm("gender", value as "Male" | "Female" | "Other")}
                >
                  <SelectTrigger className="h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="age">Age *</Label>
                <Input
                  id="age"
                  type="number"
                  value={formData.age}
                  onChange={(e) => updateForm("age", parseInt(e.target.value) || 0)}
                  min={1}
                  max={120}
                  className="h-12"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="weight">Weight (kg)</Label>
              <Input
                id="weight"
                type="number"
                value={formData.weight}
                onChange={(e) => updateForm("weight", parseInt(e.target.value) || 0)}
                min={1}
                max={300}
                className="h-12"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address *</Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) => updateForm("address", e.target.value)}
                placeholder="Enter your full address"
                className="min-h-[80px] resize-none"
              />
            </div>

            <div className="space-y-4 pt-2">
              <div className="flex items-start space-x-3 bg-muted/30 p-4 rounded-2xl border border-border">
                <Checkbox
                  id="nric_confirmed"
                  checked={formData.nric_confirmed}
                  onCheckedChange={(checked) => updateForm("nric_confirmed", !!checked)}
                  className="mt-1"
                />
                <div className="grid gap-1.5 leading-none">
                  <label
                    htmlFor="nric_confirmed"
                    className="text-sm font-bold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    NRIC / Passport Submission *
                  </label>
                  <p className="text-xs text-muted-foreground">
                    I agree to provide my ID details for verification purposes.
                  </p>
                </div>
              </div>
              
              {formData.nric_confirmed && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                  <Label htmlFor="nric_number" className="text-sm font-bold">ID Number *</Label>
                  <Input
                    id="nric_number"
                    value={formData.nric_number}
                    onChange={(e) => updateForm("nric_number", e.target.value)}
                    placeholder="Enter NRIC / Passport Number"
                    className="h-12"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Documents & Notes */}
        {step === 3 && (
          <div className="animate-fade-in space-y-6">
            <div>
              <h2 className="text-xl font-bold mb-2">Upload Documents</h2>
              <p className="text-muted-foreground text-sm mb-4 font-black uppercase tracking-widest italic">
                Max 1MB for Images, 5MB for PDFs. Please upload a valid ID or professional certificate.
              </p>
              
              <label className="block">
                <div className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors ${
                  formData.document ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                }`}>
                  {formData.document ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <Check className="w-6 h-6 text-primary" />
                      </div>
                      <p className="font-medium">{formData.document.name}</p>
                      <p className="text-sm text-muted-foreground">Click to change file</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
                        <Upload className="w-6 h-6 text-secondary-foreground" />
                      </div>
                      <p className="font-medium">Drag and drop your file here</p>
                      <Button variant="secondary" size="sm" className="mt-2 border-slate-200 shadow-sm">
                        Select File
                      </Button>
                    </div>
                  )}
                </div>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => updateForm("notes", e.target.value)}
                placeholder="Enter any dietary requirements or special requests..."
                className="min-h-[120px] resize-none"
              />
            </div>

            {/* Summary */}
            <div className="bg-muted/50 rounded-2xl p-4 space-y-3">
              <h3 className="font-semibold">Registration Summary</h3>
              <div className="text-sm space-y-1">
                <p><span className="text-muted-foreground">Name:</span> {formData.name}</p>
                <p><span className="text-muted-foreground">Email:</span> {formData.email}</p>
                <p><span className="text-muted-foreground">Date:</span> {formData.selectedDate?.toLocaleDateString()}</p>
                <p><span className="text-muted-foreground">Time:</span> {formData.selectedTimeSlot}</p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-lg border-t border-border p-4">
        <div className="max-w-lg mx-auto">
          {step < 3 ? (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={step === 1 ? !canProceedStep1 : !canProceedStep2}
              className="w-full gradient-primary text-primary-foreground font-semibold py-6 rounded-xl disabled:opacity-50"
            >
              Continue
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full gradient-primary text-primary-foreground font-semibold py-6 rounded-xl"
            >
              {isSubmitting ? "Submitting..." : "Submit Registration"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Register;
