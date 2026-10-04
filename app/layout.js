import Script from 'next/script';
import './globals.css';

export const metadata = {
  title: 'Collaborative Notebook — Realtime Multi-Device Digital Canvas',
  description: 'A digital notebook with handwriting, drawing, text, multi-device PC + tablet pairing, and realtime collaboration.'
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <Script src="https://accounts.google.com/gsi/client" strategy="lazyOnload" />
      </head>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased overflow-hidden">
        {children}
      </body>
    </html>
  );
}
