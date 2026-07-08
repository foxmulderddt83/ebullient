import { useState, useEffect } from "react";
import { MessageCircle, X, ChevronDown, ChevronUp, Phone, HelpCircle, Volume2, VolumeX, Plane } from "lucide-react";
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
  const [whatsappNumber, setWhatsappNumber] = useState("601156736410");
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
    return () => window.removeEventListener("starwars-section-visible", handleSectionVisibility);
  }, []);

  useEffect(() => {
    const fetchSettings = async () => {
      if (!supabase) return;
      const { data } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'contact_phone')
        .maybeSingle();
      if (data?.value) setWhatsappNumber(data.value);
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
    window.dispatchEvent(new CustomEvent("starwars-mute-toggle", { detail: newState }));
  };

  if (location.pathname !== "/") return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="bg-white rounded-3xl shadow-[0_24px_60px_-12px_rgba(15,23,42,0.2)] border border-slate-200 w-[320px] max-w-[calc(100vw-2rem)] overflow-hidden mb-2"
          >
            {/* Header */}
            <div
              className="relative p-5 text-white overflow-hidden"
              style={{ background: 'linear-gradient(135deg, #CC1F1F 0%, #A11818 100%)' }}
            >
              {/* Decorative wave */}
              <div className="absolute inset-0 opacity-20" style={{
                background: 'radial-gradient(circle at top right, rgba(255,255,255,0.3) 0%, transparent 60%)'
              }} />
              <div className="relative flex justify-between items-start">
                <div>
                  <span className="text-[9px] tracking-[0.32em] uppercase opacity-80 block mb-1" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                    Help Desk · 24/7
                  </span>
                  <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.5rem', letterSpacing: '0.03em' }}>
                    Quick Support
                  </h3>
                </div>
                <button
                  className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 transition-colors flex items-center justify-center"
                  onClick={() => setIsOpen(false)}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* FAQ list */}
            <div className="max-h-[420px] overflow-y-auto custom-scrollbar bg-slate-50/40">
              <div className="p-3 space-y-2">
                {FAQ_ITEMS.map((item, index) => (
                  <div
                    key={index}
                    className="bg-white rounded-xl border border-slate-200/80 overflow-hidden transition-colors hover:border-[#CC1F1F]/20"
                  >
                    <button
                      onClick={() => toggleFaq(index)}
                      className="w-full flex items-center justify-between gap-3 p-3.5 text-left text-[13px] font-semibold text-slate-800 hover:bg-slate-50/60 transition-colors"
                      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                    >
                      <span className="flex items-center gap-3 flex-1 min-w-0">
                        <span className="text-[9px] font-mono text-slate-400 shrink-0">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <span className="line-clamp-2">{item.question}</span>
                      </span>
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center transition-all shrink-0 ${openFaqIndex === index ? 'bg-[#CC1F1F] text-white' : 'bg-slate-100 text-slate-500'}`}>
                        {openFaqIndex === index ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                      </span>
                    </button>
                    <AnimatePresence initial={false}>
                      {openFaqIndex === index && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4 pt-1 text-[12px] text-slate-600 leading-relaxed border-t border-dashed border-slate-200" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                            {item.answer}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer CTA */}
            <div className="p-4 bg-white border-t border-slate-200">
              <a
                href={`https://wa.me/${whatsappNumber.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-[#25D366] hover:bg-[#1eb558] text-white font-bold py-3 px-4 rounded-full transition-all shadow-[0_6px_20px_-4px_rgba(37,211,102,0.45)] hover:shadow-[0_8px_24px_-4px_rgba(37,211,102,0.6)] hover:-translate-y-0.5 text-[12px] tracking-[0.18em] uppercase"
                style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
              >
                <MessageCircle className="w-4 h-4" />
                Chat Live Agent
              </a>
              <p className="text-[10px] text-center text-slate-400 mt-2.5 tracking-[0.15em] uppercase font-medium" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                Avg reply · Few minutes
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-3">
        {/* Speaker toggle */}
        <AnimatePresence>
          {isSpeakerVisible && (
            <motion.div
              initial={{ opacity: 0, x: 20, scale: 0.8 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.8 }}
              transition={{ duration: 0.25 }}
            >
              <button
                onClick={toggleAudio}
                aria-label={isAudioMuted ? "Unmute Sound" : "Mute Sound"}
                title={isAudioMuted ? "Unmute Sound" : "Mute Sound"}
                className={`rounded-full h-8 w-8 md:h-9 md:w-9 transition-all duration-300 shadow-lg flex items-center justify-center ${isAudioMuted
                    ? "bg-white border border-slate-200 text-slate-400 hover:text-slate-600"
                    : "bg-white border border-[#CC1F1F]/40 text-[#CC1F1F] shadow-[0_6px_16px_-4px_rgba(204,31,31,0.4)]"
                  }`}
              >
                {isAudioMuted ? <VolumeX className="w-3 h-3 md:w-3.5 md:h-3.5" /> : <Volume2 className="w-3 h-3 md:w-3.5 md:h-3.5" />}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main FAB */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(!isOpen)}
          aria-label={isOpen ? "Close Support" : "Open Support"}
          className={`relative rounded-full h-11 w-11 md:h-14 md:w-14 transition-all duration-400 group overflow-hidden ${isOpen
              ? "bg-slate-900"
              : "bg-[#25D366]"
            }`}
          style={{
            boxShadow: isOpen
              ? '0 8px 32px -8px rgba(15,23,42,0.4), inset 0 1px 0 rgba(255,255,255,0.15)'
              : '0 8px 32px -8px rgba(37,211,102,0.55), inset 0 1px 0 rgba(255,255,255,0.25)',
          }}
        >
          <AnimatePresence mode="wait">
            {isOpen ? (
              <motion.div
                key="close"
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <X className="w-4 h-4 md:w-5 md:h-5 text-white" />
              </motion.div>
            ) : (
              <motion.div
                key="open"
                initial={{ rotate: 90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: -90, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <MessageCircle className="w-5 h-5 md:w-6 md:h-6 text-white" />
              </motion.div>
            )}
          </AnimatePresence>
          {!isOpen && (
            <>
              <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white/80" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-white border-2 border-[#25D366]" />
              </span>
              <span className="absolute inset-0 rounded-full ring-2 ring-white/30 animate-pulse pointer-events-none" />
            </>
          )}
        </motion.button>
      </div>
    </div>
  );
};
