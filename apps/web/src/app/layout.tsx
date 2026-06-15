import type React from 'react';
import type { Metadata } from 'next';
import './global.css';
import { Providers } from './providers';
import DashboardLayout from '@/components/dashboard-layout';
import { initMasterAdmin } from '@/lib/seed';

export const metadata: Metadata = {
  title: 'SDCP - Supplier Data Collection Portal',
  description: 'Palm oil mill supplier assessment system',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Seed the default master admin on first boot (idempotent — no-op if already exists)
  await initMasterAdmin();

  return (
    <html lang="en">
      <body className="antialiased">
        <Providers>
          <DashboardLayout>{children}</DashboardLayout>
        </Providers>
      </body>
    </html>
  );
}
