import React from 'react';
import PriceTag from './PriceTag';

/**
 * ComparisonTable component for side-by-side platform price comparison.
 * 
 * @param {Object} props
 * @param {Object} props.prices - Price data object per platform
 * @param {Object} props.lowest - Lowest price object {platform, price}
 */
export default function ComparisonTable({ prices, lowest }) {
  const platforms = ['amazon', 'flipkart', 'croma', 'reliance', 'vijaysales'];
  const platformLabels = {
    amazon: 'Amazon',
    flipkart: 'Flipkart',
    croma: 'Croma',
    reliance: 'Reliance Digital',
    vijaysales: 'Vijay Sales',
  };

  // Format date helper: "28 May 2026, 07:45 PM"
  const formatDate = (dateStr) => {
    if (!dateStr) return 'Unknown';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <div className="comparison-table-wrapper">
      <table className="comparison-table" id="comparison-table">
        <thead>
          <tr>
            <th>Store</th>
            <th>Availability</th>
            <th>Last Scraped</th>
            <th>Price</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {platforms.map((platform) => {
            const data = prices[platform];
            const isLowest = lowest && lowest.platform === platform;
            const platformLabel = platformLabels[platform] || platform.charAt(0).toUpperCase() + platform.slice(1);
            
            if (!data) {
              return (
                <tr key={platform}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span className={`badge badge-platform badge-${platform}`} style={{ opacity: 0.5 }}>
                        {platformLabel.charAt(0)}
                      </span>
                      <strong style={{ opacity: 0.5 }}>{platformLabel}</strong>
                    </div>
                  </td>
                  <td>
                    <span style={{ color: 'var(--text-muted)' }}>Out of Stock / Unavailable</span>
                  </td>
                  <td>—</td>
                  <td>—</td>
                  <td>
                    <button className="btn btn-secondary" disabled style={{ opacity: 0.5, cursor: 'not-allowed' }}>
                      Out of Stock
                    </button>
                  </td>
                </tr>
              );
            }

            return (
              <tr key={platform} className={isLowest ? 'lowest-price-row' : ''}>
                <td className={isLowest ? 'lowest-price-cell' : ''}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span className={`badge badge-platform badge-${platform}`}>
                      {platformLabel.charAt(0)}
                    </span>
                    <strong>{platformLabel}</strong>
                  </div>
                </td>
                <td className={isLowest ? 'lowest-price-cell' : ''}>
                  <span style={{ color: data.inStock ? 'var(--accent-emerald)' : 'var(--accent-rose)', fontWeight: 'var(--fw-medium)' }}>
                    {data.inStock ? 'In Stock' : 'Out of Stock'}
                  </span>
                </td>
                <td className={isLowest ? 'lowest-price-cell' : ''}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {formatDate(data.scrapedAt)}
                  </span>
                </td>
                <td className={isLowest ? 'lowest-price-cell' : ''}>
                  <PriceTag value={data.price} isLowest={isLowest} size="md" />
                </td>
                <td className={isLowest ? 'lowest-price-cell' : ''}>
                  <a 
                    href={data.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className={`btn ${isLowest ? 'btn-primary' : 'btn-secondary'}`}
                    id={`btn-visit-${platform}`}
                  >
                    Go to Store ↗
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
