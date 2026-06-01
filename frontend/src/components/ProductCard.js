import React from 'react';
import Link from 'next/link';
import PriceTag from './PriceTag';

/**
 * ProductCard component to display search results.
 * 
 * @param {Object} props
 * @param {Object} props.product - The product data object
 * @param {number} props.product.id - DB ID
 * @param {string} props.product.name - Title
 * @param {string} props.product.brand - Brand name
 * @param {string} props.product.image - Image URL
 * @param {Object} props.product.prices - Map of platform price data
 * @param {Object} props.product.lowest - Best price info {platform, price}
 */
export default function ProductCard({ product }) {
  const { id, name, brand, image, prices, lowest } = product;

  // Fallback smartphone icon SVG if no product image is available
  const imageSrc = image || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100" height="100" fill="%2364748b"><path d="M17 19H7V5h10v14zm-5 1a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm6-18H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/></svg>';

  return (
    <article className="card" id={`product-card-${id}`}>
      <Link href={`/product/${id}`} className="product-card-link" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        
        {/* Product Image */}
        <div className="product-card-img-container">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src={imageSrc} 
            alt={name} 
            className="product-card-img" 
            loading="lazy" 
          />
        </div>

        {/* Product Meta */}
        <div className="product-card-info">
          <div className="product-card-meta">
            <span className="badge badge-brand" id={`brand-${brand}`}>
              {brand}
            </span>
          </div>

          <h3 className="product-card-title" title={name}>
            {name}
          </h3>

          {/* Platform price grid */}
          <div className="product-card-prices">
            {Object.entries(prices).map(([platform, data]) => {
              if (!data) return null;
              
              const isLowest = lowest && lowest.platform === platform;
              const platformLabel = platform.charAt(0).toUpperCase() + platform.slice(1);

              return (
                <div key={platform} className="product-card-price-row">
                  <span className="product-card-platform">
                    <span className={`badge badge-platform badge-${platform}`}>
                      {platformLabel.charAt(0)}
                    </span>
                    {platformLabel}
                  </span>
                  <span className={`product-card-price ${isLowest ? 'lowest' : ''}`}>
                    ₹{parseInt(data.price, 10).toLocaleString('en-IN')}
                  </span>
                </div>
              );
            })}

            {/* Overall best price summary */}
            {lowest && (
              <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Best Price</span>
                <PriceTag value={lowest.price} isLowest={true} size="sm" />
              </div>
            )}
          </div>
        </div>

      </Link>
    </article>
  );
}
