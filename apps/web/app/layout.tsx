import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NearFind',
  description: 'Discover trusted nearby services, routes, roadside help, and community updates.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
