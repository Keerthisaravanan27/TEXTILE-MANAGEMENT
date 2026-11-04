import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Textile ERP | Wholesale Management",
  description: "Wholesale clothing and textile business management",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
