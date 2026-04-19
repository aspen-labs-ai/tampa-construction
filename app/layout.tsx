import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Tampa Under Construction',
  description: 'Interactive map of active construction projects in Tampa, FL',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
