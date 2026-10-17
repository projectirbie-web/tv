import App from '../../../src/App.jsx';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const name = String(slug || 'channel').replace(/-/g, ' ');
  return {
    title: `${name.replace(/\b\w/g, (letter) => letter.toUpperCase())} | YEGTv`,
    description: `Detail channel ${name} dan tautan untuk membuka siarannya di YEGTv.`,
  };
}

export default function ChannelDetailPage() { return <App />; }
