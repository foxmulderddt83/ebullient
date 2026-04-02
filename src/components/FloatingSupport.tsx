import { useState, useEffect } from "react";
import { MessageCircle, X, ChevronDown, ChevronUp, Phone, HelpCircle, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { AnimatePresence, motion } from "framer-motion";
import { useLocation } from "react-router-dom";

const FAQ_ITEMS = [
  {
    question: "What is One Day Pilot?",
    answer: "One Day Pilot program is special design for people who want to enjoy a once in a life-time experience by flying an aircraft by doing it a hand on experience. You will act as a co-pilot and fly the aircraft yourself with an experience pilot beside you when you are in the air. You will have a ground briefing by pilot before take-off, to understand the command, what to do and don't when in the air. Pilot will explain about the aircraft and how he will transfer the flight control to you and vice-versa. The take-off and landing will be control by pilot to ensure safety for your experience. For Malaysian citizen, you must bring NRIC to the airport, for Non-Malaysian, you must bring passport to the airport for immigration/custom security check. Without this document, you are unable to go into airport restricted zone to enjoy this experience. It might be someone dream who wish to fly an aircraft or it's your dream. Now, this is the opportunity for you to sign up the One Day Pilot flight experience or with your firnds or buy it as a Gift Vouchers to someone special to make their dream come true with you as well. Whether you enjoy a One Day Pilot Flight Experience or decide to continue your training to become a fully-qualified pilot, you will gain a great sense of achievement."
  },
  {
    question: "Is there an age limit?",
    answer: "We have no upper age limit. So long as you are fit and agile, e.g. that you can get in and out of a family car without assistance, then you will be able to fly with us. However, please be aware that participants on the One Day Pilot program must be 18 years of age or older. Passenger can be minimum 4 years old above. In some case, our pilot require a medical report for age above 60 year old."
  },
  {
    question: "Is there a height restriction?",
    answer: "Yes! To fly in any of the aircraft or Helicopters, you need to be a minimum of 5' tall and not taller than 6'4\"."
  },
  {
    question: "Is there a weight restriction?",
    answer: "Yes! The aircraft can habdle maximim 230kg for 3 passenger at once (1 co-pilot + 2 passengers). Participants should notify OneDayPilot prior to booking the flight date if overall passenger is over this weight limits."
  },
  {
    question: "Is One Day Pilot Safe?",
    answer: "Yes, if you know what you're doing and understand the ground briefing by pilot of what to do and don't. Ask questions if you do not understand."
  },
  {
    question: "If I only have 1 person, can I still book the package?",
    answer: "Yes! You may. All flight require minimum 1 person as co-pilot to book this package. Passenger is an optional after co-pilot."
  },
  {
    question: "Can I bring passengers along during my flight?",
    answer: "Yes! If you are flying the aircraft, the Cessna aircraft has Two (2) seats at the back to serve as passenger seat. It will be a grear idea for you to bring along your friends or family members to observe your flight experience or helping you to take photo and video during the flight."
  },
  {
    question: "Can I bring a camera along?",
    answer: "Yes! Flying a airplane is an amazing experience, so please feel free to bring along a camera. You can also bring along your friends or family members to help you take photo and video during the flight."
  },
  {
    question: "How do I book my flight?",
    answer: "You just need to send in a booking form or an email to book, you can find the booking form on top of every page Top Left corner. Else If you have received a Gift Voucher for a flight experience with OneDayPilot, you will need to email us to arrange a mutually convenient date and time for your flight. Please email to us and stated your Gift Voucher Number, Expiry Date, Name, Contact Number, Date and Time of your flight booking."
  },
  {
    question: "How long is my voucher valid for?",
    answer: "All vouchers are valid for 6 months unless special cases. Vouchers may be extended for a period of two more months at an additional cost of RM50 payable prior to the voucher expiry date."
  },
  {
    question: "Can I upgrade my voucher?",
    answer: "Yes you can! If you would like to add extra time to your voucher or add in passenger, all you have to do is let us know when you contact us to arrange your flight experience. You can then pay the additional cost incurred when you upgrade it."
  },
  {
    question: "Can I transfer my voucher?",
    answer: "Yes your voucher is transferable! You can change the name on the voucher and transfer it to another person, but you must notify OneDayPilot at least 48 hours before the flight with full detail of the new co-pilot and passenger."
  },
  {
    question: "Can I book more flight experiences or extend the duration of my flights?",
    answer: "You certainly can! If you enjoy your experience in a helicopter, then why not continue your experience in Fix Wing Aircraft experience."
  },
  {
    question: "What should I wear?",
    answer: "Casual & Smart: Trousers, long jeans, T-shirt,. Sport Shoes. You are chartering an aircraft as co-pilot not a normal air bus passenger."
  },
  {
    question: "What happens if there is bad weather?",
    answer: "Lightning: In the event of a locally severe lightning storm, flight may stop or wait for rain stop. Flight may be delayed if a storm is occuring at the airport / fly zone. All flight will be approved by the Control Tower and it's out of pilot and OneDayPilot control and knowledge. If the rain keep continue and flight may be cancelled or postpone to a later date. In the case of a flight cancellation, guests are offered the option to reschedule or receive a full refund. In this case, you are allow to extend the booking to maximum 3 months from the date of your booking."
  },
  {
    question: "What forms of payment do you accept?",
    answer: "We accept CDM or Bank Online payment prior to your flight date. Credit and Debit cards are done in the Molpay via our website."
  },
  {
    question: "What does the package rate cover?",
    answer: "Brief theory of flight, aircraft introduction, rules of the air and radiotelephony before the flight. 30 or 60 minutes flight time depend on your booking. You will have hand on flight experience beside take-off and landing."
  }
];

export const FloatingSupport = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState("601156736410"); // Default from questions.md
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(() => {
    const saved = localStorage.getItem("starwars-audio-muted");
    return saved === "true";
  });
  const [isSpeakerVisible, setIsSpeakerVisible] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleSectionVisibility = (event: any) => {
      setIsSpeakerVisible(event.detail);
    };

    window.addEventListener("starwars-section-visible", handleSectionVisibility);
    return () => {
      window.removeEventListener("starwars-section-visible", handleSectionVisibility);
    };
  }, []);

  useEffect(() => {
    const fetchSettings = async () => {
      if (!supabase) return;
      const { data } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'contact_phone')
        .maybeSingle();
      
      if (data?.value) {
        setWhatsappNumber(data.value);
      }
    };
    fetchSettings();
  }, []);

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  const toggleAudio = () => {
    const newState = !isAudioMuted;
    setIsAudioMuted(newState);
    localStorage.setItem("starwars-audio-muted", String(newState));
    // Dispatch custom event for StarWarsSection
    window.dispatchEvent(new CustomEvent("starwars-mute-toggle", { detail: newState }));
  };

  if (location.pathname !== "/") return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="bg-white rounded-2xl shadow-2xl border border-black w-[350px] overflow-hidden mb-2"
          >
            <div className="bg-primary p-4 text-primary-foreground flex justify-between items-center">
              <div className="font-bold flex items-center gap-2">
                <HelpCircle className="w-5 h-5" />
                <span>Quick Support</span>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-primary-foreground hover:bg-primary/80 h-8 w-8"
                onClick={() => setIsOpen(false)}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="max-h-[400px] overflow-y-auto custom-scrollbar p-2 bg-slate-50">
              <div className="space-y-2 p-2">
                {FAQ_ITEMS.map((item, index) => (
                  <div key={index} className="bg-white rounded-lg border border-black shadow-sm overflow-hidden">
                    <button
                      onClick={() => toggleFaq(index)}
                      className="w-full flex items-center justify-between p-3 text-left text-sm font-medium hover:bg-slate-50 transition-colors"
                    >
                      <span>{item.question}</span>
                      {openFaqIndex === index ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </button>
                    <AnimatePresence>
                      {openFaqIndex === index && (
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: "auto" }}
                          exit={{ height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="p-3 pt-0 text-xs text-muted-foreground border-t bg-slate-50/50 leading-relaxed">
                            {item.answer}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-white border-t">
              <a 
                href={`https://wa.me/${whatsappNumber.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold py-3 px-4 rounded-lg transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
              >
                <MessageCircle className="w-5 h-5" />
                Talk to Agent
              </a>
              <p className="text-xs text-center text-muted-foreground mt-2">
                Replies typically in few minutes
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-3">
        {/* Speaker Mute/Unmute Toggle - only visible when StarWarsSection is in view */}
        <AnimatePresence>
          {isSpeakerVisible && (
            <motion.div
              initial={{ opacity: 0, x: 20, scale: 0.8 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.8 }}
              transition={{ duration: 0.3 }}
            >
              <Button
                onClick={toggleAudio}
                variant="outline"
                size="icon"
                className={`rounded-full h-7 w-7 border-2 transition-all duration-300 shadow-lg ${
                  isAudioMuted 
                    ? "bg-slate-100 border-slate-300 text-slate-400" 
                    : "bg-primary/10 border-primary text-primary animate-pulse"
                }`}
                title={isAudioMuted ? "Unmute Sound" : "Mute Sound"}
              >
                {isAudioMuted ? (
                  <VolumeX className="w-3 h-3" />
                ) : (
                  <Volume2 className="w-3 h-3" />
                )}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* WhatsApp Support Toggle */}
        <Button
          onClick={() => setIsOpen(!isOpen)}
          size="lg"
          className={`rounded-full h-12 w-12 transition-all duration-300 relative group border ${
            isOpen 
              ? "bg-red-500 hover:bg-red-600 rotate-90 border-black shadow-[0_0_20px_rgba(239,68,68,0.5),0_0_40px_rgba(239,68,68,0.2)]" 
              : "bg-[#25D366] hover:bg-[#20bd5a] hover:scale-110 border-black shadow-[0_0_20px_rgba(37,211,102,0.5),0_0_40px_rgba(37,211,102,0.2)]"
          }`}
        >
          {isOpen ? (
            <X className="w-5 h-5 text-white" />
          ) : (
            <>
              <MessageCircle className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-white border-2 border-[#25D366]"></span>
              </span>
              <span className="absolute inset-0 rounded-full border-2 border-white/30 animate-pulse pointer-events-none" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
