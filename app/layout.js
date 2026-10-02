import './globals.css';

export const metadata = {
  title: 'Automation Dashboard',
  description: 'Live mail and WhatsApp activity for all brands',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        {/* apply the saved theme before the first paint (no flash); light unless the viewer chose otherwise */}
        <script dangerouslySetInnerHTML={{ __html: "try{var t=localStorage.getItem('theme');if(t==='dark'||t==='auto')document.documentElement.setAttribute('data-theme',t)}catch(e){}" }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
