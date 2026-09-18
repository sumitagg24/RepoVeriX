import type { Metadata } from "next";
import { Navbar } from "@/components/marketing/navbar";
import { Hero } from "@/components/marketing/hero";
import { Integrations, Pillars } from "@/components/marketing/sections";
import { AgentFlow, Faq, FinalCta, Footer, HowItWorks } from "@/components/marketing/blocks";
import { Pricing } from "@/components/marketing/pricing";

export const metadata: Metadata = {
  title: "RepoVeriX — Secure everything you ship, with proof",
};

export default function HomePage() {
  return (
    <div className="animate-page min-h-screen bg-background">
      <Navbar />
      <main>
        <Hero />
        <Pillars />
        <AgentFlow />
        <HowItWorks />
        <Integrations />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
