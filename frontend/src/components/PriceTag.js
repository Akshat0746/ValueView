import React from 'react';

/**
 * PriceTag component to format and display prices in INR.
 * 
 * @param {Object} props
 * @param {number} props.value - Numeric price value
 * @param {boolean} [props.isLowest=false] - Whether this is the lowest price among platforms
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Typography size of the tag
 */
export default function PriceTag({ value, isLowest = false, size = 'md' }) {
  if (value === null || value === undefined || isNaN(value)) {
    return <span style={{ color: 'var(--text-muted)' }}>Not Available</span>;
  }

  // Format price to Indian standard: e.g. ₹58,999
  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  });

  const formattedPrice = formatter.format(value);

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
      <span 
        className={`price-tag price-tag-${size} ${isLowest ? 'price-tag-lowest' : ''}`}
        id={`price-tag-${value}`}
      >
        {formattedPrice}
      </span>
      {isLowest && (
        <span className="badge badge-lowest" id={`badge-best-price`}>
          Best Deal
        </span>
      )}
    </div>
  );
}
