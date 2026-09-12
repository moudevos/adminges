import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AdminGes",
  description: "Gestión comercial, inventario, cuotas y analítica",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
