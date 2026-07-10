import { LandingTopbar, LandingFooter } from "./_landing/chrome";
import { Hero } from "./_landing/hero";
import { FeatureSections } from "./_landing/features";
import { PricingSection } from "./_landing/pricing";
import { FaqSection } from "./_landing/faq";

/**
 * Öffentliche Landingpage (Marketing-Onepager im Heimspiel-Design):
 * Topbar → Hero → Funktionen (Küren-Studio zuerst) → Preise → FAQ → Footer.
 * Das Portal selbst beginnt nach dem Login auf /dashboard.
 */
export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-canvas">
      <LandingTopbar />
      <main id="inhalt">
        <Hero />
        <FeatureSections />
        <PricingSection />
        <FaqSection />
      </main>
      <LandingFooter />
    </div>
  );
}
