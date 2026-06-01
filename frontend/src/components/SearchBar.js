'use client';

import React, { useState, useEffect } from 'react';

/**
 * SearchBar component with animated focus states and loading feedback.
 * 
 * @param {Object} props
 * @param {function} props.onSearch - Callback function called when search is triggered
 * @param {boolean} [props.isLoading=false] - Whether a search is currently in progress
 * @param {string} [props.placeholder='Search for smartphones...'] - Placeholder text
 */
export default function SearchBar({ onSearch, isLoading = false, placeholder = 'Search for smartphones (e.g., iPhone 15, Galaxy S24)...' }) {
  const [query, setQuery] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim().length >= 2) {
      onSearch(query);
    }
  };

  // Debounced real-time typing search for quick matches
  useEffect(() => {
    if (query.trim().length < 2) return;
    
    const delayDebounce = setTimeout(() => {
      onSearch(query);
    }, 400); // 400ms debounce

    return () => clearTimeout(delayDebounce);
  }, [query, onSearch]);

  return (
    <div className="search-container">
      <form onSubmit={handleSubmit} id="search-form">
        <div className="search-input-wrapper">
          <span className="search-icon" aria-hidden="true">🔍</span>
          <input
            type="text"
            className="search-input"
            id="search-query-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            autoComplete="off"
            aria-label="Search smartphones"
          />
          {isLoading && (
            <div className="search-loader" id="search-spinner" role="status" aria-label="Loading"></div>
          )}
        </div>
      </form>
    </div>
  );
}
