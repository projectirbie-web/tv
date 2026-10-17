import { Suspense } from 'react';
import App from '../src/App.jsx';
import '../src/styles.css';

export const metadata = {
  title: 'YEGTv — Your Everyday Guide TV',
  description: 'Jelajahi katalog TV, simpan channel favorit, dan buka siaran langsung dari satu tempat.',
  applicationName: 'YEGTv',
};

function AppFallback() {
  return <main className="app-fallback"><p>Menyiapkan YEGTv…</p></main>;
}

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>
        <Suspense fallback={<AppFallback />}><App /></Suspense>
        {children}
      </body>
    </html>
  );
}
