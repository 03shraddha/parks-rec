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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@400;500;700;800&family=Zen+Kaku+Gothic+New:wght@400;500;700;900&family=Space+Mono:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="h-full w-full overflow-hidden">{children}</body>
    </html>
  );
}
