import type { Metadata, Viewport } from "next";
import { Anton, Sora } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-ui",
});

export const metadata: Metadata = {
  title: "Tracinhos",
  description: "Ligue os pontos, feche os quadrados.",
  openGraph: {
    title: "Tracinhos",
    description: "Ligue os pontos, feche os quadrados.",
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tracinhos",
    description: "Ligue os pontos, feche os quadrados.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#14264f",
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${anton.variable} ${sora.variable}`}>
      <body>
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
