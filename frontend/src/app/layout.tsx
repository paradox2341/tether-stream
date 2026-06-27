import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TetherStream — Real-Time Capital Streaming on Stellar',
  description:
    'TetherStream is a production-grade Stellar Soroban dApp enabling real-time linear token vesting through on-chain capital channels with live inter-contract calls.',
  keywords: ['Stellar', 'Soroban', 'DeFi', 'vesting', 'streaming', 'blockchain', 'TTH'],
  openGraph: {
    title: 'TetherStream',
    description: 'Real-time capital streaming on Stellar Soroban',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-mono bg-ts-base text-ts-text antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
