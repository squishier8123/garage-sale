import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Garage Sale — AI-Powered Local Marketplace",
    template: "%s | Garage Sale",
  },
  description:
    "AI-powered virtual garage sale. Snap a photo, get instant pricing, and sell locally. No fees until you sell.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://garagesale.app",
  ),
  openGraph: {
    type: "website",
    siteName: "Garage Sale",
    title: "Garage Sale — AI-Powered Local Marketplace",
    description:
      "Snap a photo, AI prices it, buyers find it. Sell your stuff locally with zero hassle.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Garage Sale — AI-Powered Local Marketplace",
    description:
      "Snap a photo, AI prices it, buyers find it. Sell your stuff locally with zero hassle.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
