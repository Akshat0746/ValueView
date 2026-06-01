'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import ComparisonTable from '../../../components/ComparisonTable';
import PriceTag from '../../../components/PriceTag';

/**
 * Product detail & comparison page.
 * Fetches specific product matching information, platform pricing, and history.
 */
export default function ProductDetailPage({ params }) {
  // Unwrap parameters safely using React.use() for Next.js 15+ compatibility
  const resolvedParams = use(params);
  const productId = resolvedParams.id;

  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3006/api';

  useEffect(() => {
    if (!productId) return;

    const fetchProductDetails = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_URL}/product/${productId}`);
        
        if (response.status === 404) {
          throw new Error('Product not found in our database.');
        }
        
        if (!response.ok) {
          throw new Error(`Failed to load product details (${response.status})`);
        }

        const json = await response.json();
        setData(json.product);
      } catch (err) {
        console.error('Failed to load product details:', err);
        setError(err.message || 'An unexpected error occurred.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProductDetails();
  }, [productId, API_URL]);

  // Loading State
  if (isLoading) {
    return (
      <div className="state-container">
        <div className="search-loader" style={{ width: '3rem', height: '3rem', borderWidth: '3px' }} role="status"></div>
        <p style={{ marginTop: '1.5rem', color: 'var(--text-secondary)' }}>Gathering real-time comparisons...</p>
      </div>
    );
  }

  // Error State
  if (error || !data) {
    return (
      <div className="state-container">
        <span className="state-icon">❌</span>
        <h2 className="state-title">Unable to Load Product</h2>
        <p className="state-desc" style={{ marginBottom: '2rem' }}>{error || 'Product information is missing.'}</p>
        <Link href="/" className="btn btn-primary">
          Back to Home Search
        </Link>
      </div>
    );
  }

  const { name, brand, model, image, prices, lowest, history } = data;
  const imageSrc = image || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="150" height="150" fill="%2364748b"><path d="M17 19H7V5h10v14zm-5 1a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm6-18H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/></svg>';

  // Format historical date
  const formatHistoryDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div>
      {/* Back navigation link */}
      <Link href="/" style={{ color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2rem', fontSize: 'var(--fs-sm)' }}>
        ← Back to Search
      </Link>

      <div className="product-detail-layout">
        
        {/* Product Gallery Sidebar */}
        <aside className="product-gallery">
          <div className="product-detail-img-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={imageSrc} 
              alt={name} 
              className="product-detail-img" 
            />
          </div>
        </aside>

        {/* Product Details Section */}
        <section className="product-info-panel">
          
          <div className="product-header-tag">
            <span className="badge badge-brand">{brand}</span>
            {model && <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)' }}>Model: {model}</span>}
          </div>

          <h1 className="product-detail-name">{name}</h1>

          {/* Pricing Overview Row */}
          {lowest ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem', background: 'rgba(16, 185, 129, 0.05)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16, 185, 129, 0.15)', marginBottom: '2.5rem' }}>
              <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>Best current deal:</span>
              <PriceTag value={lowest.price} isLowest={true} size="lg" />
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
                on {lowest.platform.charAt(0).toUpperCase() + lowest.platform.slice(1)}
              </span>
            </div>
          ) : (
            <div style={{ padding: '1.5rem', background: 'rgba(244, 63, 94, 0.05)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(244, 63, 94, 0.15)', marginBottom: '2.5rem', color: 'var(--accent-rose)' }}>
              Out of stock on all platforms.
            </div>
          )}

          {/* Platform Pricing Table */}
          <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-semibold)', marginBottom: '1rem' }}>Compare Platforms</h2>
          <ComparisonTable prices={prices} lowest={lowest} />

          {/* Price History Timeline */}
          {history && history.length > 0 && (
            <div className="price-history-section">
              <h2 className="price-history-title">Price Refresh History (Last 30 Days)</h2>
              <div className="price-history-list">
                {history.map((record) => {
                  const platLabel = record.platform.charAt(0).toUpperCase() + record.platform.slice(1);
                  return (
                    <div key={`${record.platform}-${record.scrapedAt}`} className="price-history-item">
                      <div className="price-history-meta">
                        <span className={`badge badge-platform badge-${record.platform}`} style={{ padding: '0.15rem 0.35rem', fontSize: '0.6rem' }}>
                          {platLabel.charAt(0)}
                        </span>
                        <span>{platLabel} refresh</span>
                        <span className="price-history-date">
                          ({formatHistoryDate(record.scrapedAt)})
                        </span>
                      </div>
                      <strong style={{ color: lowest && lowest.platform === record.platform && lowest.price === record.price ? 'var(--accent-emerald)' : 'var(--text-primary)' }}>
                        ₹{parseInt(record.price, 10).toLocaleString('en-IN')}
                      </strong>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </section>
      </div>
    </div>
  );
}
