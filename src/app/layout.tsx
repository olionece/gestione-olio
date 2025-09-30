import './globals.css';

export const metadata = { title: 'Gestione Olio' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body className="min-h-screen bg-gradient-to-b from-amber-50 to-white text-stone-800 antialiased">
        <div className="max-w-6xl mx-auto p-6">{children}</div>
      </body>
    </html>
  );
}
