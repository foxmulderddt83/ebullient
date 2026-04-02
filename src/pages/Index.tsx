import { useNavigate, useLocation } from "react-router-dom";
import { Header } from "@/components/Header";
import { HeroCarousel } from "@/components/HeroCarousel";
import { StarWarsSection } from "@/components/StarWarsSection";
import { ExperienceSection } from "@/components/ExperienceSection";
import { BookingWizard } from "@/components/BookingWizard";
import { ServicesSection } from "@/components/ServicesSection";
import { AdventureSection } from "@/components/AdventureSection";
import { FeaturesSection } from "@/components/FeaturesSection";
import { Footer } from "@/components/Footer";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { motion } from "framer-motion";

const Index = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const isSharedLink = params.has("sharePackageId");

  if (isSharedLink) {
    return (
      <motion.div 
        initial={{ opacity: 0, backgroundColor: "#000" }}
        animate={{ opacity: 1, backgroundColor: "transparent" }}
        transition={{ duration: 1.0, ease: "easeInOut" }}
        className="min-h-screen bg-slate-50 pt-10"
      >
        <div id="booking" className="max-w-7xl mx-auto px-4">
          <BookingWizard />
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, backgroundColor: "#000" }}
      animate={{ opacity: 1, backgroundColor: "transparent" }}
      transition={{ duration: 2.5, ease: "easeInOut" }}
      className="min-h-screen"
    >
      <Header />
      <main>
        <HeroCarousel />
        <StarWarsSection />
        <ScrollReveal>
          <AdventureSection />
        </ScrollReveal>
        <div id="experience">
          <ScrollReveal>
            <ExperienceSection />
          </ScrollReveal>
        </div>
        <div id="booking">
          <ScrollReveal>
            <BookingWizard />
          </ScrollReveal>
        </div>
        <div id="services">
          <ScrollReveal>
            <ServicesSection />
          </ScrollReveal>
        </div>
        <ScrollReveal>
          <FeaturesSection />
        </ScrollReveal>
      </main>
      <Footer />
    </motion.div>
  );
};

export default Index;
