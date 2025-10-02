// app/layout.tsx  (oppure src/app/layout.tsx)
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Gestione Olio',
  description: 'Inventario olio (Roma / Neci)',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
