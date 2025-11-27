import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Input, AutoComplete, Spin, Empty, Typography } from 'antd';
import { SearchOutlined, LoadingOutlined } from '@ant-design/icons';
import { debounce } from 'lodash';
import { useWebSocket } from '../../hooks/useWebSocket';

const {Text} = Typography;

interface SearchProps {
  placeholder?: string;
  onSearch?: (value: string) => void;
  onSelect?: (value: string, option: any) => void;
  size?: 'small' | 'middle' | 'large';
  allowClear?: boolean;
  style?: React.CSSProperties;
  className?: string;
  type?: 'trends' | 'users' | 'orders' | 'all';
  showRecentSearches?: boolean;
}

interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  type: 'trend' | 'user' | 'order';
  category?: string;
  symbol?: string;
  price?: number;
  change?: number;
  icon?: string;
}

const Search: React.FC<SearchProps> = ({
  placeholder = 'Search trends, users, or orders...',
  onSearch,
  onSelect,
  size = 'middle',
  allowClear = true,
  style,
  className,
  type = 'all',
  showRecentSearches = true
}) => {
  const [searchValue, setSearchValue] = useState('');
  const [options, setOptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<any>(null);

  // Mock search function (would connect to actual API)
  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setOptions(recentSearches.map(term => ({
        value: term,
        label: (
          <div className="recent-search-item">
            <SearchOutlined style={{ marginRight: 8, color: '#999' }} />
            <Text type="secondary">{term}</Text>
          </div>
        )
      })));
      return;
    }

    setLoading(true);
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 300));

      // Mock search results
      const mockResults: SearchResult[] = [];

      if (type === 'all' || type === 'trends') {
        mockResults.push(
          {
            id: 'trend_1',
            title: '#ViralDanceChallenge',
            subtitle: 'Trending on TikTok',
            type: 'trend',
            category: 'Entertainment',
            symbol: 'VIRAL/SA_ENT_001',
            price: 125.50,
            change: 15.3,
            icon: '📱'
          },
          {
            id: 'trend_2',
            title: 'Springbok Victory',
            subtitle: 'Sports Trend',
            type: 'trend',
            category: 'Sports',
            symbol: 'VIRAL/SA_SPORT_001',
            price: 89.25,
            change: -5.2,
            icon: '🏉'
          }
        );
      }

      if (type === 'all' || type === 'users') {
        mockResults.push(
          {
            id: 'user_1',
            title: 'John Trader',
            subtitle: ' johntader@viralfx.com',
            type: 'user',
            icon: '👤'
          }
        );
      }

      if (type === 'all' || type === 'orders') {
        mockResults.push(
          {
            id: 'order_1',
            title: 'Order #ORD001',
            subtitle: 'Buy VIRAL/SA_ENT_001 - 1000 units',
            type: 'order',
            icon: '📋'
          }
        );
      }

      const filteredResults = mockResults.filter(result =>
        result.title.toLowerCase().includes(query.toLowerCase()) ||
        result.subtitle?.toLowerCase().includes(query.toLowerCase()) ||
        result.symbol?.toLowerCase().includes(query.toLowerCase())
      );

      const searchOptions = filteredResults.map(result => ({
        value: result.id,
        label: (
          <div className="search-result-item" style={{ padding: '8px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {result.icon && <span style={{ marginRight: 8, fontSize: '16px' }}>{result.icon}</span>}
                <div>
                  <div style={{ fontWeight: 500 }}>{result.title}</div>
                  {result.subtitle && (
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {result.subtitle}
                    </Text>
                  )}
                </div>
              </div>
              {result.type === 'trend' && result.price && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 500 }}>
                    R{result.price.toFixed(2)}
                  </div>
                  <Text
                    type={result.change! >= 0 ? 'success' : 'danger'}
                    style={{ fontSize: '12px' }}
                  >
                    {result.change! >= 0 ? '+' : ''}{result.change.toFixed(1)}%
                  </Text>
                </div>
              )}
            </div>
            {result.category && (
              <div style={{ marginTop: 4 }}>
                <Text type="secondary" style={{ fontSize: '11px' }}>
                  {result.category}
                </Text>
              </div>
            )}
          </div>
        )
      }));

      setOptions(searchOptions);

    } catch (error) {
      console.error('Search error:', error);
      setOptions([{
        value: 'error',
        label: <Text type="danger">Error performing search. Please try again.</Text>
      }]);
    } finally {
      setLoading(false);
    }
  }, [type, recentSearches]);

  // Debounced search function
  const debouncedSearch = useCallback(debounce(performSearch, 300), [performSearch]);

  useEffect(() => {
    // Load recent searches from localStorage
    const saved = localStorage.getItem('viralfx_recent_searches');
    if (saved) {
      setRecentSearches(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    debouncedSearch(searchValue);
    return () => {
      debouncedSearch.cancel();
    };
  }, [searchValue, debouncedSearch]);

  const handleSearch = (value: string) => {
    setSearchValue(value);

    // Add to recent searches
    if (value.trim() && !recentSearches.includes(value)) {
      const newRecentSearches = [value, ...recentSearches.slice(0, 9)]; // Keep top 10
      setRecentSearches(newRecentSearches);
      localStorage.setItem('viralfx_recent_searches', JSON.stringify(newRecentSearches));
    }

    onSearch?.(value);
  };

  const handleSelect = (value: string, option: any) => {
    // If it's a recent search, use the search term
    if (typeof option?.label?.props?.children?.[1]?.props?.children === 'string') {
      const searchTerm = option.label.props.children[1].props.children;
      setSearchValue(searchTerm);
      onSearch?.(searchTerm);
    } else {
      onSelect?.(value, option);
    }
    setSearchValue(''); // Clear input after selection
  };

  const suffixIcon = loading ? (
    <LoadingOutlined style={{ color: '#999' }} />
  ) : (
    <SearchOutlined style={{ color: '#999' }} />
  );

  return (
    <div className={`viralfx-search ${className || ''}`} style={style}>
      <AutoComplete
        ref={inputRef}
        value={searchValue}
        onChange={setSearchValue}
        onSearch={handleSearch}
        onSelect={handleSelect}
        options={options}
        notFoundContent={
          loading ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <Spin size="small" />
            </div>
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="No results found"
              style={{ margin: '20px 0' }}
            />
          )
        }
        allowClear={allowClear}
        size={size}
        style={{ width: '100%' }}
        placeholder={placeholder}
        suffixIcon={suffixIcon}
        filterOption={false} // Important for custom search
        defaultActiveFirstOption={false}
      />
    </div>
  );
};

export default Search;