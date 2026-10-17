import '../src/styles.css';

export const metadata = {
  title: 'YEGTv — Your Everyday Guide TV',
  description: 'Jelajahi katalog TV, simpan channel favorit, dan buka siaran langsung dari satu tempat.',
  applicationName: 'YEGTv',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
