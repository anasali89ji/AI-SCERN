import { HeroSection } from "@/components/public/sections/HeroSection";
import { TrustStrip } from "@/components/public/sections/TrustStrip";
import { ProblemSection } from "@/components/public/sections/ProblemSection";
import { ModalitySection } from "@/components/public/sections/ModalitySection";
import { EngineSection } from "@/components/public/sections/EngineSection";
import { EvidenceSection } from "@/components/public/sections/EvidenceSection";
import { TrustScoreSection } from "@/components/public/sections/TrustScoreSection";
import { ContextSection } from "@/components/public/sections/ContextSection";
import { UseCasesSection } from "@/components/public/sections/UseCasesSection";
import { BatchSection } from "@/components/public/sections/BatchSection";
import { AssistantSection } from "@/components/public/sections/AssistantSection";
import { TechnologySection } from "@/components/public/sections/TechnologySection";
import { BenchmarksSection } from "@/components/public/sections/BenchmarksSection";
import { TransparencySection } from "@/components/public/sections/TransparencySection";
import { EnterpriseSection } from "@/components/public/sections/EnterpriseSection";
import { FinalCTASection } from "@/components/public/sections/FinalCTASection";

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <TrustStrip />
      <ProblemSection />
      <ModalitySection />
      <EngineSection />
      <EvidenceSection />
      <TrustScoreSection />
      <ContextSection />
      <UseCasesSection />
      <BatchSection />
      <AssistantSection />
      <TechnologySection />
      <BenchmarksSection />
      <TransparencySection />
      <EnterpriseSection />
      <FinalCTASection />
    </>
  );
}
