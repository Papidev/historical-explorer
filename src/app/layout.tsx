import type { Metadata } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import { WebAnalytics } from "./components/WebAnalytics";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const fraunces = localFont({
  src: "./components/ui/MiraLogo/Fraunces.ttf",
  variable: "--font-fraunces",
  display: "swap",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Mira",
  description: "Explore cities through history, art, and culture.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${fraunces.variable} bg-background text-foreground font-sans antialiased`}
      >
        {children}
        <WebAnalytics />
      </body>
    </html>
  );
}
