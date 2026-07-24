import type { Metadata } from "next";
import "./globals.css";

const title = "SKU Pulse | Product Mix Visibility";
const description =
  "SKU-level recommendation acceptance, whitespace opportunity, regional penetration, and processed invoice sell-in visibility.";
const siteUrl =
  process.env.URL ??
  process.env.DEPLOY_PRIME_URL ??
  "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  openGraph: {
    title,
    description,
    type: "website",
    url: "/",
    images: [
      {
        url: "/og.png",
        width: 1660,
        height: 948,
        alt: "SKU Pulse product mix intelligence dashboard",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
