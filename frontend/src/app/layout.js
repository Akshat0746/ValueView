import { Inter } from 'next/font/google';
import Link from 'next/link';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
});

export const metadata = {
  title: 'PriceHunt — Smart Smartphone Price Comparison',
  description: 'Compare real-time smartphone prices across Amazon, Flipkart, and Croma. Find the lowest price and save money.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.className}>
      <body>
        <nav className="navbar" id="main-nav">
          <div className="container nav-container">
            <Link href="/" className="logo" id="nav-home-link">
              <span className="logo-icon">⚡</span>
              <span className="text-gradient">PriceHunt</span>
            </Link>
            <div className="tagline">
              Compare prices across Amazon, Flipkart & Croma
            </div>
          </div>
        </nav>

        <main className="container main-content">
          {children}
        </main>

        <footer className="footer" id="main-footer">
          <div className="container">
            <p>&copy; {new Date().getFullYear()} PriceHunt. Built for real-time smartphone deal tracking.</p>
            <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Disclaimer: Product names, logos, and brands are property of their respective owners. Price data is updated periodically.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
