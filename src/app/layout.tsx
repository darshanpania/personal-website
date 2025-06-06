// app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from '@/components/Header'; // Import Header component

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Darshan Pania | Director of Engineering",
  description: "Director of Engineering with 12+ years of experience in Mobile SDK development, gaming, and LiveOps",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={`${inter.className} antialiased`}>
        <Header />
        {children}
      </body>
    </html>
  );
}