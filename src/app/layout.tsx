import type { Metadata } from "next";
import "./global.css";

export const metadata: Metadata = {
  title: "Waymark | Quiet city walks",
  description: "Find quieter walking routes to places around your city.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
