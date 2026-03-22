import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Walk the City Without Melting · Bengaluru",
  description:
    "Find the coolest walking routes in Bengaluru using tree canopy, parks, lakes, and satellite heat data.",
  openGraph: {
    title: "Walk the City Without Melting",
    description: "Cool walking routes through Bengaluru's greenest streets.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full w-full overflow-hidden">{children}</body>
    </html>
  );
}
