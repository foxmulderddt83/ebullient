import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, GripVertical, ArrowUp, ArrowDown, ArrowLeft, ShieldCheck, Ticket } from "lucide-react";

interface Step {
  id: number;
  title: string;
  fields: string[];
}

interface FieldConfig {
  label: string;
  required: boolean;
}

interface FieldConfig {
  label: string;
  required: boolean;
  payment_amount?: number;
  deposit_amount?: number;
  payment_description?: string;
}

interface TemplateConfig {
  steps: Step[];
  labels: Record<string, string>;
  fieldsConfig: Record<string, FieldConfig>;
}

interface EventTemplateBuilderProps {
  initialData: string;
  onSave: (data: string) => void;
  basePrice?: number;
  promoPrice?: number;
}

const AVAILABLE_FIELDS = [
  { id: "date", label: "Date Selection", defaultRequired: true },
  { id: "timeSlot", label: "Time Slot Selection", defaultRequired: true },
  { id: "name", label: "Full Name", defaultRequired: true },
  { id: "email", label: "Email Address", defaultRequired: true },
  { id: "phone", label: "Phone Number", defaultRequired: true },
  { id: "gender", label: "Gender", defaultRequired: true },
  { id: "age", label: "Age", defaultRequired: true },
  { id: "weight", label: "Weight", defaultRequired: false },
  { id: "address", label: "Address", defaultRequired: true },
  { id: "nric", label: "NRIC Submission", defaultRequired: true },
  { id: "notes", label: "Additional Notes", defaultRequired: false },
  { id: "document", label: "Document Upload", defaultRequired: false },
  { id: "payment_required", label: "Require Payment", defaultRequired: false },
  { id: "enable_chip_payment", label: "Enable CHIP Payment", defaultRequired: false },
  { id: "enable_deposit", label: "Allow Deposit", defaultRequired: false },
];

export const EventTemplateBuilder = ({ initialData, onSave, basePrice, promoPrice }: EventTemplateBuilderProps) => {
  const [config, setConfig] = useState<TemplateConfig>({
    steps: [],
    labels: {},
    fieldsConfig: AVAILABLE_FIELDS.reduce((acc, field) => ({
      ...acc,
      [field.id]: { label: field.label, required: field.defaultRequired }
    }), {})
  });

  // Sync external prices to payment_amount
  useEffect(() => {
    if (basePrice !== undefined || promoPrice !== undefined) {
      setConfig(prev => {
        const pReq = prev.fieldsConfig['payment_required'];
        if (pReq) {
          const newAmount = (promoPrice && promoPrice > 0) ? promoPrice : (basePrice || 0);
          if (pReq.payment_amount !== newAmount) {
            const newConfig = {
              ...prev,
              fieldsConfig: {
                ...prev.fieldsConfig,
                'payment_required': {
                  ...pReq,
                  payment_amount: newAmount
                }
              }
            };
            onSave(JSON.stringify(newConfig));
            return newConfig;
          }
        }
        return prev;
      });
    }
  }, [basePrice, promoPrice, onSave]);

  useEffect(() => {
    try {
      if (initialData) {
        const parsed = JSON.parse(initialData);
        setConfig({
          steps: parsed.steps || [],
          labels: parsed.labels || {},
          fieldsConfig: parsed.fieldsConfig || AVAILABLE_FIELDS.reduce((acc, field) => ({
            ...acc,
            [field.id]: { label: field.label, required: field.defaultRequired }
          }), {})
        });
      } else {
        // Reset to default if initialData is empty (e.g. creating new profile)
        setConfig({
          steps: [],
          labels: {},
          fieldsConfig: AVAILABLE_FIELDS.reduce((acc, field) => ({
            ...acc,
            [field.id]: { label: field.label, required: field.defaultRequired }
          }), {})
        });
      }
    } catch (e) {
      console.error("Failed to parse template JSON", e);
    }
  }, [initialData]);

  const updateConfig = (newConfig: TemplateConfig) => {
    setConfig(newConfig);
    onSave(JSON.stringify(newConfig));
  };

  const addStep = () => {
    const newId = Math.max(0, ...config.steps.map(s => s.id)) + 1;
    updateConfig({
      ...config,
      steps: [...config.steps, { id: newId, title: "New Step", fields: [] }]
    });
  };

  const removeStep = (index: number) => {
    const newSteps = [...config.steps];
    newSteps.splice(index, 1);
    updateConfig({ ...config, steps: newSteps });
  };

  const moveStep = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === config.steps.length - 1) return;
    
    const newSteps = [...config.steps];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newSteps[index], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[index]];
    updateConfig({ ...config, steps: newSteps });
  };

  const updateStep = (index: number, field: keyof Step, value: string | string[]) => {
    const newSteps = [...config.steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    updateConfig({ ...config, steps: newSteps });
  };

  const toggleField = (stepIndex: number, fieldId: string) => {
    const step = config.steps[stepIndex];
    const newFields = step.fields.includes(fieldId)
      ? step.fields.filter(f => f !== fieldId)
      : [...step.fields, fieldId];
    updateStep(stepIndex, "fields", newFields);
  };

  const updateLabel = (key: string, value: string) => {
    updateConfig({
      ...config,
      labels: { ...config.labels, [key]: value }
    });
  };

  const updateMultipleFieldConfigs = (updates: Record<string, Partial<FieldConfig>>) => {
    setConfig(prev => {
      const newFieldsConfig = { ...prev.fieldsConfig };
      Object.keys(updates).forEach(fieldId => {
        newFieldsConfig[fieldId] = { ...newFieldsConfig[fieldId], ...updates[fieldId] };
      });
      const newConfig = { ...prev, fieldsConfig: newFieldsConfig };
      onSave(JSON.stringify(newConfig));
      return newConfig;
    });
  };

  const updateFieldConfig = (fieldId: string, updates: Partial<FieldConfig>) => {
    setConfig(prev => {
      const newConfig = {
        ...prev,
        fieldsConfig: {
          ...prev.fieldsConfig,
          [fieldId]: { ...prev.fieldsConfig[fieldId], ...updates }
        }
      };
      onSave(JSON.stringify(newConfig));
      return newConfig;
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <Tabs defaultValue="editor" className="w-full lg:hidden">
        <TabsList className="grid w-full grid-cols-2 mb-6 border border-black p-1 h-11 bg-white/50 backdrop-blur-md rounded-xl shadow-xl shadow-primary/5">
          <TabsTrigger value="editor" className="data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-lg rounded-xl flex items-center justify-center gap-2 font-black text-[11px] sm:text-xs uppercase tracking-widest transition-all h-11">Editor</TabsTrigger>
          <TabsTrigger value="preview" className="data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-lg rounded-xl flex items-center justify-center gap-2 font-black text-[11px] sm:text-xs uppercase tracking-widest transition-all h-11">Live Preview</TabsTrigger>
        </TabsList>
        <TabsContent value="editor" className="mt-4 space-y-4">
          <EditorSection 
            config={config} 
            moveStep={moveStep} 
            updateStep={updateStep} 
            removeStep={removeStep} 
            toggleField={toggleField} 
            addStep={addStep} 
            updateLabel={updateLabel}
            updateFieldConfig={updateFieldConfig}
            updateMultipleFieldConfigs={updateMultipleFieldConfigs}
            basePrice={basePrice}
            promoPrice={promoPrice}
          />
        </TabsContent>
        <TabsContent value="preview" className="mt-4">
          <PreviewSection config={config} />
        </TabsContent>
      </Tabs>

      <div className="hidden lg:grid lg:grid-cols-2 gap-6 h-[700px]">
        <div className="flex flex-col gap-4 h-full overflow-hidden">
          <EditorSection 
            config={config} 
            moveStep={moveStep} 
            updateStep={updateStep} 
            removeStep={removeStep} 
            toggleField={toggleField} 
            addStep={addStep} 
            updateLabel={updateLabel}
            updateFieldConfig={updateFieldConfig}
            updateMultipleFieldConfigs={updateMultipleFieldConfigs}
            basePrice={basePrice}
            promoPrice={promoPrice}
          />
        </div>
        <div className="border border-black rounded-xl bg-slate-50 dark:bg-slate-900 overflow-hidden flex flex-col h-full">
          <PreviewSection config={config} />
        </div>
      </div>
    </div>
  );
};

interface SectionProps {
  config: TemplateConfig;
  moveStep: (index: number, direction: 'up' | 'down') => void;
  updateStep: (index: number, field: keyof Step, value: string | string[]) => void;
  removeStep: (index: number) => void;
  toggleField: (stepIndex: number, fieldId: string) => void;
  addStep: () => void;
  updateLabel: (key: string, value: string) => void;
  updateFieldConfig: (fieldId: string, updates: Partial<FieldConfig>) => void;
  updateMultipleFieldConfigs: (updates: Record<string, Partial<FieldConfig>>) => void;
  basePrice?: number;
  promoPrice?: number;
}

const EditorSection = ({ 
  config, 
  moveStep, 
  updateStep, 
  removeStep, 
  toggleField, 
  addStep, 
  updateLabel, 
  updateFieldConfig,
  updateMultipleFieldConfigs,
  basePrice,
  promoPrice
}: SectionProps) => (
  <Tabs defaultValue="structure" className="flex-1 flex flex-col overflow-hidden">
    <TabsList className="w-full justify-start overflow-x-auto bg-slate-100/50 p-1.5 rounded-xl border border-black h-11 shrink-0">
      <TabsTrigger value="structure" className="rounded-xl px-4 py-2 text-[11px] sm:text-xs font-bold uppercase tracking-wider data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all h-full">Steps & Fields</TabsTrigger>
      <TabsTrigger value="labels" className="rounded-xl px-4 py-2 text-[11px] sm:text-xs font-bold uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-md transition-all h-full">Labels & Config</TabsTrigger>
    </TabsList>
    
    <TabsContent value="structure" className="flex-1 lg:overflow-y-auto pr-0 lg:pr-2 space-y-5 mt-4 pb-6">
      {config.steps.map((step, index) => (
        <Card key={step.id} className="relative group border-black shadow-sm rounded-[2.5rem] overflow-hidden hover:shadow-md transition-all duration-300">
          <CardHeader className="p-6 flex flex-row items-center gap-3 bg-slate-50/80 border-b border-black">
            <div className="flex flex-row md:flex-col gap-1.5 shrink-0">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-12 w-12 md:h-10 md:w-10 bg-white border border-black rounded-2xl hover:text-primary hover:bg-primary/5 shadow-sm" 
                onClick={() => moveStep(index, 'up')} 
                disabled={index === 0}
              >
                <ArrowUp className="h-5 w-5 md:h-4 md:w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-12 w-12 md:h-10 md:w-10 bg-white border border-black rounded-2xl hover:text-primary hover:bg-primary/5 shadow-sm" 
                onClick={() => moveStep(index, 'down')} 
                disabled={index === config.steps.length - 1}
              >
                <ArrowDown className="h-5 w-5 md:h-4 md:w-4" />
              </Button>
            </div>
            <div className="flex-1 space-y-1.5">
              <label className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-900 ml-1">Step {index + 1} Title</label>
              <Input 
                value={step.title} 
                onChange={(e) => updateStep(index, "title", e.target.value)}
                className="h-16 sm:h-14 text-sm border-black rounded-2xl focus:ring-2 focus:ring-primary bg-white"
                placeholder="e.g. Personal Details"
              />
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => removeStep(index)} 
              className="h-14 w-14 md:h-12 md:w-12 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-2xl shrink-0"
            >
              <Trash2 className="h-6 w-6 md:h-5 md:w-5" />
            </Button>
          </CardHeader>
          <CardContent className="p-6 pt-6">
            <label className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-900 mb-4 block ml-1">Included Fields</label>
            <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 gap-4">
              {AVAILABLE_FIELDS.map(field => (
                <div 
                  key={field.id} 
                  className={`flex items-center space-x-3 p-4 rounded-2xl transition-all cursor-pointer ${step.fields.includes(field.id) ? 'bg-primary/5/50 shadow-sm' : 'bg-white hover:bg-slate-50'}`}
                  onClick={() => toggleField(index, field.id)}
                >
                  <Checkbox 
                      id={`step-${step.id}-${field.id}`} 
                      checked={step.fields.includes(field.id)}
                      onCheckedChange={() => toggleField(index, field.id)}
                      className="h-6 w-6 border-black data-[state=checked]:bg-primary data-[state=checked]:border-primary rounded-md"
                      onClick={(e) => e.stopPropagation()}
                    />
                  <label 
                    htmlFor={`step-${step.id}-${field.id}`}
                    className={`text-[11px] sm:text-xs leading-none cursor-pointer flex-1 font-bold ${step.fields.includes(field.id) ? 'text-primary/90' : 'text-slate-900'}`}
                  >
                    {config.fieldsConfig[field.id]?.label || field.label}
                  </label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      
      <Button 
        onClick={addStep} 
        variant="outline" 
        className="w-full border-2 border-dashed border-primary/20 bg-primary/5/30 text-primary hover:bg-primary/10 hover:border-primary/30 h-16 sm:h-14 rounded-2xl font-bold transition-all shadow-sm"
      >
        <Plus className="h-5 w-5 mr-2" /> Add Registration Step
      </Button>
    </TabsContent>

    <TabsContent value="labels" className="flex-1 lg:overflow-y-auto space-y-6 mt-4 pr-0 lg:pr-2 pb-6">
      <Card className="border-black rounded-[2.5rem] overflow-hidden shadow-sm">
        <CardHeader className="p-6 bg-slate-50/80 border-b border-black">
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 bg-primary rounded-full" />
            <CardTitle className="text-base sm:text-lg font-bold uppercase tracking-wider text-slate-950">Button Labels</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 p-6">
          <div className="space-y-1.5">
            <Label className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-900 ml-1">Continue Button</Label>
            <Input 
              value={config.labels.continue_button || ""} 
              onChange={(e) => updateLabel("continue_button", e.target.value)}
              placeholder="Next Step"
              className="h-16 sm:h-14 border-black rounded-2xl focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-900 ml-1">Submit Button</Label>
            <Input 
              value={config.labels.submit_button || ""} 
              onChange={(e) => updateLabel("submit_button", e.target.value)}
              placeholder="Submit Registration"
              className="h-16 sm:h-14 border-black rounded-2xl focus:ring-2 focus:ring-primary"
            />
          </div>
        </CardContent>
      </Card>
      
      <Card className="border-black rounded-[2.5rem] overflow-hidden shadow-sm">
        <CardHeader className="p-6 bg-slate-50/80 border-b border-black">
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 bg-primary rounded-full" />
            <CardTitle className="text-base sm:text-lg font-bold uppercase tracking-wider text-slate-950">Field Settings</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 p-6">
          {AVAILABLE_FIELDS.map(field => (
            <div key={field.id} className="space-y-5 p-5 rounded-[2rem] bg-primary/5/30 transition-all hover:bg-primary/5/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-xl">
                    <GripVertical className="w-4 h-4 text-primary" />
                  </div>
                  <Label className="font-bold text-slate-900 text-[11px] sm:text-xs">{field.label}</Label>
                </div>
                <div 
                  className={`flex items-center gap-3 px-4 py-2 bg-white rounded-2xl shadow-sm ${
                    (config.fieldsConfig['enable_chip_payment']?.required && (field.id === 'email' || field.id === 'phone')) ||
                    (!config.fieldsConfig['enable_chip_payment']?.required && (field.id === 'payment_required' || field.id === 'enable_deposit'))
                      ? 'opacity-50 cursor-not-allowed'
                      : 'cursor-pointer'
                  }`}
                  onClick={() => {
                    const isChipEnabled = config.fieldsConfig['enable_chip_payment']?.required;
                    
                    // Disable email/phone toggle if chip is enabled
                    if (isChipEnabled && (field.id === 'email' || field.id === 'phone')) {
                      return;
                    }

                    // Disable payment_required/enable_deposit toggle if chip is disabled
                    if (!isChipEnabled && (field.id === 'payment_required' || field.id === 'enable_deposit')) {
                      return;
                    }

                    const newRequired = !config.fieldsConfig[field.id]?.required;
                    
                    if (field.id === 'enable_chip_payment') {
                      if (newRequired) {
                        // Enabling CHIP: auto-enable email and phone
                        updateMultipleFieldConfigs({
                          'enable_chip_payment': { required: true },
                          'email': { required: true },
                          'phone': { required: true }
                        });
                      } else {
                        // Disabling CHIP: also disable payment_required and enable_deposit
                        updateMultipleFieldConfigs({
                          'enable_chip_payment': { required: false },
                          'payment_required': { required: false },
                          'enable_deposit': { required: false },
                          'email': { required: config.fieldsConfig['email']?.required || false },
                          'phone': { required: config.fieldsConfig['phone']?.required || false }
                        });
                      }
                    } else {
                      updateFieldConfig(field.id, { required: newRequired });
                    }
                  }}
                >
                  <Checkbox 
                    id={`req-${field.id}`}
                    checked={config.fieldsConfig[field.id]?.required}
                    disabled={
                      (config.fieldsConfig['enable_chip_payment']?.required && (field.id === 'email' || field.id === 'phone')) ||
                      (!config.fieldsConfig['enable_chip_payment']?.required && (field.id === 'payment_required' || field.id === 'enable_deposit'))
                    }
                    onCheckedChange={() => {
                      // Handled by parent div onClick for better mobile touch target
                    }}
                    className="h-6 w-6 border-black data-[state=checked]:bg-primary data-[state=checked]:border-primary rounded-md"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <Label htmlFor={`req-${field.id}`} className="text-[11px] sm:text-xs font-bold cursor-pointer text-primary">REQUIRED</Label>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] sm:text-xs uppercase font-bold text-slate-900 ml-1">Display Label</Label>
                <Input 
                  value={config.fieldsConfig[field.id]?.label || ""}
                  onChange={(e) => updateFieldConfig(field.id, { label: e.target.value })}
                  placeholder={field.label}
                  className="h-16 sm:h-14 text-sm border-black rounded-2xl focus-visible:ring-primary bg-white"
                />
              </div>

              {field.id === 'payment_required' && config.fieldsConfig[field.id]?.required && (
                <div className="space-y-4 pt-4 border-t border-black/10">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] sm:text-xs uppercase font-bold text-slate-900 ml-1">Full Amount (MYR) - Linked to Event Price</Label>
                    <Input 
                      type="number"
                      value={config.fieldsConfig[field.id]?.payment_amount || ""}
                      onChange={(e) => updateFieldConfig(field.id, { payment_amount: parseFloat(e.target.value) || 0 })}
                      placeholder="0.00"
                      disabled={basePrice !== undefined || promoPrice !== undefined}
                      className="h-14 text-sm border-black rounded-2xl focus-visible:ring-primary bg-slate-100/50 cursor-not-allowed text-slate-500"
                    />
                    <p className="text-[10px] text-slate-500 ml-1 mt-1 font-medium">This amount automatically syncs with the Base Price / Promo Price set above.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] sm:text-xs uppercase font-bold text-slate-900 ml-1">Deposit Amount (MYR)</Label>
                    <Input 
                      type="number"
                      value={config.fieldsConfig[field.id]?.deposit_amount || ""}
                      onChange={(e) => updateFieldConfig(field.id, { deposit_amount: parseFloat(e.target.value) || 0 })}
                      placeholder="0.00"
                      className="h-14 text-sm border-black rounded-2xl focus-visible:ring-primary bg-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] sm:text-xs uppercase font-bold text-slate-900 ml-1">Payment Description</Label>
                    <Input 
                      value={config.fieldsConfig[field.id]?.payment_description || ""}
                      onChange={(e) => updateFieldConfig(field.id, { payment_description: e.target.value })}
                      placeholder="e.g. Deposit for event..."
                      className="h-14 text-sm border-black rounded-2xl focus-visible:ring-primary bg-white"
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </TabsContent>

  </Tabs>
);

const PreviewSection = ({ config }: { config: TemplateConfig }) => {
  const [currentStep, setCurrentStep] = useState(0);

  // Reset to first step if config changes
  useEffect(() => {
    setCurrentStep(0);
  }, [config.steps.length]);

  return (
    <div className="flex flex-col h-full">
      <div className="bg-slate-200 dark:bg-slate-800 p-2 text-center text-[11px] sm:text-xs font-mono text-muted-foreground border-b shrink-0 flex justify-between items-center px-4">
        <span>Mobile Preview Simulation</span>
        {config.steps.length > 1 && (
          <span className="text-[10px] bg-slate-300 dark:bg-slate-700 px-2 py-0.5 rounded-full">
            Step {currentStep + 1} of {config.steps.length}
          </span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-2 md:p-4 bg-slate-100/50 dark:bg-slate-950/50">
        <div className="max-w-[320px] sm:max-w-[375px] mx-auto bg-background min-h-[500px] shadow-lg rounded-2xl overflow-hidden border border-black flex flex-col my-4">
          {/* Mock Header */}
          <div className="h-14 border-b flex items-center px-4 justify-between bg-background/80 backdrop-blur shrink-0">
             <button 
               onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
               className={`w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors ${currentStep === 0 ? 'invisible' : ''}`}
             >
               <ArrowLeft className="w-4 h-4" />
             </button>
             <span className="font-semibold text-xs sm:text-sm truncate px-2">
               {config.steps[currentStep]?.title || "Event Registration"}
             </span>
             <div className="w-8" />
          </div>
          
          {/* Mock Progress */}
          <div className="px-4 py-2 flex gap-1 shrink-0">
            {config.steps.map((_, i) => (
              <div key={i} className={`h-1 flex-1 rounded-full ${i <= currentStep ? 'bg-primary' : 'bg-muted'}`} />
            ))}
          </div>

          {/* Mock Content */}
          <div className="p-4 space-y-4 flex-1 overflow-y-auto">
            {config.steps.length > 0 ? (
              <>
                <h2 className="text-base sm:text-lg font-bold">{config.steps[currentStep].title}</h2>
                <div className="space-y-3">
                  {config.steps[currentStep].fields.map(fieldId => {
                    const fieldDef = AVAILABLE_FIELDS.find(f => f.id === fieldId);
                    const fieldConfig = config.fieldsConfig[fieldId];
                    if (!fieldDef || !fieldConfig) return null;
                    
                    if (fieldId === 'date') return (
                      <div key={fieldId} className="space-y-1">
                        <Label className="text-[11px] sm:text-xs font-bold">{fieldConfig.label} {fieldConfig.required && '*'}</Label>
                        <div className="h-24 bg-muted/20 rounded-lg border border-dashed border-muted flex items-center justify-center text-muted-foreground text-[10px]">Calendar Component</div>
                      </div>
                    );
                    
                    if (fieldId === 'timeSlot') return (
                      <div key={fieldId} className="space-y-1">
                        <Label className="text-[11px] sm:text-xs font-bold">{fieldConfig.label} {fieldConfig.required && '*'}</Label>
                        <div className="grid grid-cols-2 gap-2">
                          {[1,2].map(i => <div key={i} className="h-10 bg-muted/20 rounded border border-dashed border-muted" />)}
                        </div>
                      </div>
                    );

                    if (fieldId === 'document') return (
                      <div key={fieldId} className="space-y-1">
                        <Label className="text-[11px] sm:text-xs font-bold">{fieldConfig.label} {fieldConfig.required && '*'}</Label>
                        <div className="h-32 bg-primary/5/50 rounded-lg border-2 border-dashed border-primary/20 flex items-center justify-center text-primary text-[10px] flex-col gap-2 transition-colors">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <Plus className="w-4 h-4" />
                          </div>
                          <span className="font-semibold">Upload Area</span>
                        </div>
                      </div>
                    );

                    if (fieldId === 'payment_required') return (
                      <div key={fieldId} className="space-y-1">
                        <Label className="text-[11px] sm:text-xs font-bold">{fieldConfig.label} {fieldConfig.required && '*'}</Label>
                        <div className="p-4 bg-primary/5/50 rounded-lg border-2 border-dashed border-primary/20 flex items-center justify-center text-primary text-[10px] flex-col gap-2 transition-colors">
                          <div className="flex flex-col items-center gap-1">
                            <span className="font-bold">Total: RM {fieldConfig.payment_amount?.toFixed(2) || '0.00'}</span>
                            {fieldConfig.deposit_amount ? (
                              <span className="text-[9px] opacity-70">Deposit: RM {fieldConfig.deposit_amount.toFixed(2)}</span>
                            ) : null}
                          </div>
                          {config.fieldsConfig['enable_chip_payment']?.required && (
                            <div className="flex items-center gap-1 text-[8px] opacity-60 mt-1">
                              <ShieldCheck className="w-2.5 h-2.5" />
                              <span>CHIP Payment Enabled</span>
                            </div>
                          )}
                          {config.fieldsConfig['enable_deposit']?.required && (
                            <div className="flex items-center gap-1 text-[8px] opacity-60">
                              <Ticket className="w-2.5 h-2.5" />
                              <span>Deposit Option Enabled</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );

                    if (fieldId === 'enable_chip_payment') return (
                      <div key={fieldId} className="space-y-2 p-3 bg-blue-50/50 rounded-xl border border-blue-100 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                          <ShieldCheck className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-[10px] font-bold text-blue-900 uppercase">{fieldConfig.label}</p>
                          <p className="text-[8px] text-blue-700">Online payment enabled via CHIP</p>
                        </div>
                      </div>
                    );

                    if (fieldId === 'enable_deposit') return (
                      <div key={fieldId} className="space-y-2 p-3 bg-amber-50/50 rounded-xl border border-amber-100 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                          <Ticket className="w-4 h-4 text-amber-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-[10px] font-bold text-amber-900 uppercase">{fieldConfig.label}</p>
                          <p className="text-[8px] text-amber-700">Deposit payment option available</p>
                        </div>
                      </div>
                    );

                    return (
                      <div key={fieldId} className="space-y-1">
                        <Label className="text-[11px] sm:text-xs font-bold">{fieldConfig.label} {fieldConfig.required && '*'}</Label>
                        <Input disabled placeholder={`Enter ${fieldConfig.label.toLowerCase()}...`} className="h-9 text-xs" />
                      </div>
                    );
                  })}

                  {/* Automatic Payment Summary if enabled but not in any step, show on last step */}
                  {currentStep === config.steps.length - 1 && 
                   config.fieldsConfig['payment_required']?.required && 
                   !config.steps.some(s => s.fields.includes('payment_required')) && (
                    <div className="mt-6 pt-4 border-t border-dashed border-primary/20">
                      <Label className="text-[11px] sm:text-xs font-bold text-primary mb-2 block uppercase tracking-wider">Payment Summary (Automatic)</Label>
                      <div className="p-4 bg-primary/5 rounded-xl border border-primary/10 flex items-center justify-center text-primary text-[10px] flex-col gap-2">
                        <div className="flex flex-col items-center gap-1">
                          <span className="font-bold">Total: RM {config.fieldsConfig['payment_required'].payment_amount?.toFixed(2) || '0.00'}</span>
                          {config.fieldsConfig['payment_required'].deposit_amount ? (
                            <span className="text-[9px] opacity-70">Deposit: RM {config.fieldsConfig['payment_required'].deposit_amount.toFixed(2)}</span>
                          ) : null}
                        </div>
                        {config.fieldsConfig['enable_chip_payment']?.required && (
                          <div className="flex items-center gap-1 text-[8px] opacity-60">
                            <ShieldCheck className="w-2.5 h-2.5" />
                            <span>CHIP Payment Enabled</span>
                          </div>
                        )}
                        {config.fieldsConfig['enable_deposit']?.required && (
                          <div className="flex items-center gap-1 text-[8px] opacity-60">
                            <Ticket className="w-2.5 h-2.5" />
                            <span>Deposit Option Enabled</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center text-slate-900 py-10 text-sm">No steps configured</div>
            )}
          </div>

          {/* Mock Footer */}
          <div className="p-4 border-t bg-background/80 backdrop-blur shrink-0">
            <Button 
              className="w-full bg-primary hover:bg-primary/90 text-white text-sm h-11 rounded-xl"
              onClick={() => {
                if (currentStep < config.steps.length - 1) {
                  setCurrentStep(currentStep + 1);
                }
              }}
            >
              {currentStep < config.steps.length - 1 
                ? (config.labels.continue_button || "Continue") 
                : (config.labels.submit_button || "Submit Registration")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};


