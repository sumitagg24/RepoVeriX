import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { SITE_URL } from "@/lib/site";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "RepoVeriX — Evidence-grounded repo audits & verified fixes",
    template: "%s — RepoVeriX",
  },
  description:
    "Audit whole repositories, get findings backed by explicit evidence chains, and ship patches verified in an isolated Docker sandbox. The LLM proposes; evidence and execution verify.",
  applicationName: "RepoVeriX",
  openGraph: {
    type: "website",
    siteName: "RepoVeriX",
    title: "RepoVeriX — Secure everything you ship, with proof",
    description:
      "Evidence-grounded repository auditing and verified automated repair. No noisy alerts. Every fix certified by running your tests.",
  },
  twitter: {
    card: "summary_large_image",
    title: "RepoVeriX — Secure everything you ship, with proof",
    description:
      "Find real risks. See the evidence. Ship sandbox-verified fixes.",
  },
};

const themeScript = `(function(){try{var t=localStorage.getItem('rvx-theme');if(!t){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.classList.toggle('dark',t==='dark')}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.className} ${inter.variable} ${mono.variable} antialiased`}
      >
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
