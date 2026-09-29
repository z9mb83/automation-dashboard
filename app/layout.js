import './globals.css';

export const metadata = {
  title: 'Automation Dashboard',
  description: 'Live mail and WhatsApp activity for all brands',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
