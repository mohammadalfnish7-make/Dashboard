import type { Metadata, Viewport } from "next";
import { Montserrat, Noto_Sans_Arabic } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const notoSansArabic = Noto_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-ar",
});

export const metadata: Metadata = {
  title: "KARAM AL ARAB · Live ops",
  description: "Warehouse, deliveries, and shipments from the live sheet.",
  icons: { icon: "/favicon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#eaf2ff",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${montserrat.className} ${notoSansArabic.variable}`}>{children}</body>
    </html>
  );
}
