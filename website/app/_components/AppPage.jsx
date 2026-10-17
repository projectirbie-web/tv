import { Suspense } from 'react';
import App from '../../src/App.jsx';

function PageFallback() {
  return (
    <main style={{ minHeight: '100vh', padding: '48px 24px', color: '#f5f9ff', background: '#07131f' }}>
      <p>Memuat YEGTv…</p>
    </main>
  );
}

export default function AppPage() {
  return <Suspense fallback={<PageFallback />}><App /></Suspense>;
}
