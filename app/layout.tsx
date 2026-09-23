import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./motion.css";

export const metadata: Metadata = {
  title: "Pluoto — My people, around me",
  description: "Friendships, arranged into a little living world in the clouds.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/pluoto-logo.png", apple: "/pluoto-logo.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#9fdcff",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
