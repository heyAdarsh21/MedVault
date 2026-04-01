import type { Metadata } from "next";
import "./globals.css";
import { ReactQueryProvider } from "@/components/providers/ReactQueryProvider";

export const metadata: Metadata = {
  title: "MEDVAULT — Operations Intelligence",
  description: "Healthcare operational intelligence platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" style={{ backgroundColor: "#060b17" }}>
      <body style={{ backgroundColor: "#060b17", margin: 0, padding: 0 }}>
        <ReactQueryProvider>{children}</ReactQueryProvider>
      </body>
    </html>
  );
}