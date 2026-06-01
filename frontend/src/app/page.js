'use client';

import React, { useState, useCallback } from 'react';
import SearchBar from '../components/SearchBar';
import ProductCard from '../components/ProductCard';

export default function Home() {
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState(null);

  // Read backend API URL from env, default to local port 3001
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3006/api';

  const handleSearch = useCallback(async (query) => {
    if (!query || query.trim().length < 2) return;
    
    setIsLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const response = await fetch(`${API_URL}/search?q=${encodeURIComponent(query)}`);
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      setResults(data.results || []);
    } catch (err) {
      console.error('Search failed:', err);
      setError('Failed to connect to search service. Please make sure the backend is running.');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [API_URL]);

  return (
    <div>
      {/* Hero Section */}
      <section className="hero">
        <h1 className="hero-title">
          Find the Best <span className="text-gradient">Smartphone Deals</span>
        </h1>
        <p className="hero-subtitle">
          Compare real-time prices across Amazon India, Flipkart, and Croma instantly.
        </p>

        {/* Animated Search Bar */}
        <SearchBar onSearch={handleSearch} isLoading={isLoading} />
      </section>

      {/* Results Section */}
      <section id="search-results">
        
        {/* 1. Loading Shimmer State */}
        {isLoading && (
          <div className="products-grid">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="shimmer-card loading-shimmer" aria-hidden="true"></div>
            ))}
          </div>
        )}

        {/* 2. Error State */}
        {!isLoading && error && (
          <div className="state-container" id="search-error-state">
            <span className="state-icon">⚠️</span>
            <h2 className="state-title">Search Error</h2>
            <p className="state-desc">{error}</p>
          </div>
        )}

        {/* 3. Empty Search State (Initial landing) */}
        {!isLoading && !hasSearched && !error && (
          <div className="state-container" id="empty-state">
            <span className="state-icon">📱</span>
            <h2 className="state-title">Compare Phone Prices</h2>
            <p className="state-desc">
              Enter a model name like &quot;iPhone 15&quot; or &quot;Galaxy S24&quot; to see comparative prices.
            </p>
          </div>
        )}

        {/* 4. No Results Found State */}
        {!isLoading && hasSearched && results.length === 0 && !error && (
          <div className="state-container" id="no-results-state">
            <span className="state-icon">🔍</span>
            <h2 className="state-title">No Smartphones Found</h2>
            <p className="state-desc">
              We couldn&apos;t find any matched products. Try searching for something else like &quot;iPhone 16&quot; or &quot;OnePlus&quot;.
            </p>
          </div>
        )}

        {/* 5. Results Grid */}
        {!isLoading && results.length > 0 && (
          <div>
            <h2 style={{ fontSize: 'var(--fs-xl)', marginBottom: '1.5rem', fontWeight: 'var(--fw-semibold)' }}>
              Matching Smartphone Deals ({results.length})
            </h2>
            <div className="products-grid">
              {results.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        )}

      </section>
    </div>
  );
}
