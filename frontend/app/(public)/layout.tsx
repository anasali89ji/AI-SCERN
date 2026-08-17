import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "../globals.css";
import { SiteHeader } from "@/components/public/SiteHeader";
import { SiteFooter } from "@/components/public/SiteFooter";
import { AnimationPreferenceProvider } from "@/components/AnimationPreferenceContext";

const inter = Inter({ subsets: ["latin"], variable: "--font-geist-sans", display: "swap" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

export const metadata: Metadata = {
  title: "AISCERN — Verify What's Real | Digital Trust Platform",
  description: "AI-powered verification for text, images, audio, video and digital content. Multimodal digital-content verification platform for enterprises, educators, journalists, and security teams.",
  keywords: ["AI detection", "deepfake detection", "content verification", "digital trust", "media forensics"],
  openGraph: {
    title: "AISCERN — Verify What's Real",
    description: "Digital trust and verification platform for multimodal content authenticity.",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "AISCERN — Verify What's Real",
    description: "Digital trust and verification platform.",
  },
  robots: { index: true, follow: true },
};

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable} dark`}>
      <body className="min-h-screen bg-aiscern-bg-primary text-aiscern-text-primary font-sans antialiased">
        <AnimationPreferenceProvider>
          <div className="relative flex min-h-screen flex-col">
            <div className="fixed inset-0 grid-bg pointer-events-none opacity-50" />
            <SiteHeader />
            <main className="flex-1 relative">{children}</main>
            <SiteFooter />
          </div>
        </AnimationPreferenceProvider>
      </body>
    </html>
  );
}
