import type { Metadata } from "next";


export const metadata: Metadata = {
  title: "TerraCast 3D",
  description: "3D Weather and Terrain Simulation",
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
