import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AdminGes",
  description: "Inventario, ventas, cuotas, personal y herramientas",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
