import { supportedCurrencies, supportedRegions } from '../i18n';

export interface CurrencyFormatOptions {
  currency?: string;
  locale?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  showSymbol?: boolean;
  compact?: boolean;
}

export interface RegionFormatOptions {
  region?: string;
  dateFormat?: string;
  timeFormat?: string;
  timezone?: string;
}

export class CurrencyFormatter {
  private static defaultRegion = supportedRegions[0]; // South Africa

  /**
   * Format currency amount with proper symbol and formatting
   */
  static format(
    amount: number,
    options: CurrencyFormatOptions = {}
  ): string {
    const {currency = 'ZAR', locale = 'en-ZA', minimumFractionDigits = 2, maximumFractionDigits = 2, showSymbol = true, compact = false, } = options;

    const currencyInfo = supportedCurrencies.find(c => c.code === currency);
    const _regionInfo = this.getRegionInfo(locale);

    if (compact && Math.abs(amount) >= 1000) {
      const compactAmount = this.getCompactAmount(amount);
      const formattedAmount = new Intl.NumberFormat(locale, {
        minimumFractionDigits: compactAmount.shouldShowDecimals ? minimumFractionDigits : 0,
        maximumFractionDigits: compactAmount.shouldShowDecimals ? maximumFractionDigits : 0,
      }).format(compactAmount.value);

      if (showSymbol && currencyInfo) {
        return `${currencyInfo.symbol}${formattedAmount}${compactAmount.suffix}`;
      }
      return `${formattedAmount}${compactAmount.suffix}`;
    }

    const formattedAmount = new Intl.NumberFormat(locale, {
      minimumFractionDigits,
      maximumFractionDigits,
    }).format(Math.abs(amount));

    const prefix = amount < 0 ? '-' : '';
    const symbol = showSymbol && currencyInfo ? currencyInfo.symbol : '';

    // Handle symbol placement based on currency
    if (['ZAR', 'USD', 'CAD', 'AUD', 'NZD', 'NGN', 'KES', 'GHS'].includes(currency)) {
      return `${prefix}${symbol}${formattedAmount}`;
    } else if (['EUR', 'GBP', 'CHF'].includes(currency)) {
      return `${prefix}${formattedAmount} ${symbol}`;
    } else {
      // For crypto and others
      return `${prefix}${symbol}${formattedAmount}`;
    }
  }

  /**
   * Convert amount between different currencies
   */
  static async convert(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    rates?: Record<string, number>
  ): Promise<number> {
    if (fromCurrency === toCurrency) return amount;

    if (!rates) {
      // In a real app, fetch from API
      rates = await this.getExchangeRates();
    }

    const fromRate = rates[fromCurrency] || 1;
    const toRate = rates[toCurrency] || 1;

    return (amount / fromRate) * toRate;
  }

  /**
   * Format percentage change
   */
  static formatPercentage(
    value: number,
    options: { decimals?: number; showSign?: boolean } = {}
  ): string {
    const {decimals = 2, showSign = true} = options;
    const sign = showSign && value > 0 ? '+' : '';
    return `${sign}${value.toFixed(decimals)}%`;
  }

  /**
   * Format large numbers in K, M, B, T format
   */
  static formatCompact(
    value: number,
    options: { decimals?: number; showSymbol?: boolean } = {}
  ): string {
    const {decimals = 1, showSymbol = false} = options;
    const absValue = Math.abs(value);

    if (absValue >= 1e12) {
      const formatted = (value / 1e12).toFixed(decimals);
      return showSymbol ? `${formatted}T` : formatted;
    } else if (absValue >= 1e9) {
      const formatted = (value / 1e9).toFixed(decimals);
      return showSymbol ? `${formatted}B` : formatted;
    } else if (absValue >= 1e6) {
      const formatted = (value / 1e6).toFixed(decimals);
      return showSymbol ? `${formatted}M` : formatted;
    } else if (absValue >= 1e3) {
      const formatted = (value / 1e3).toFixed(decimals);
      return showSymbol ? `${formatted}K` : formatted;
    }

    return value.toFixed(decimals);
  }

  /**
   * Get currency information
   */
  static getCurrencyInfo(currencyCode: string) {
    return supportedCurrencies.find(c => c.code === currencyCode);
  }

  /**
   * Get region information
   */
  static getRegionInfo(localeOrRegion?: string) {
    if (!localeOrRegion) return this.defaultRegion;

    // Try to find by region code first
    let region = supportedRegions.find(r => r.code === localeOrRegion);

    // If not found, try to extract from locale
    if (!region) {
      const localeCode = localeOrRegion.split('-')[1]?.toLowerCase();
      region = supportedRegions.find(r => r.code === localeCode);
    }

    return region || this.defaultRegion;
  }

  /**
   * Format date according to region preferences
   */
  static formatDate(
    date: Date | string | number,
    options: RegionFormatOptions & { format?: 'short' | 'medium' | 'long' } = {}
  ): string {
    const {region, format = 'medium'} = options;
    const regionInfo = this.getRegionInfo(region);

    const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;

    const formatOptions: Intl.DateTimeFormatOptions = {
      timeZone: options.timezone || regionInfo.timezone,
    };

    switch (format) {
      case 'short':
        formatOptions.day = '2-digit';
        formatOptions.month = '2-digit';
        formatOptions.year = '2-digit';
        break;
      case 'medium':
        formatOptions.day = '2-digit';
        formatOptions.month = 'short';
        formatOptions.year = 'numeric';
        break;
      case 'long':
        formatOptions.day = 'numeric';
        formatOptions.month = 'long';
        formatOptions.year = 'numeric';
        break;
    }

    return new Intl.DateTimeFormat('en-ZA', formatOptions).format(dateObj);
  }

  /**
   * Format time according to region preferences
   */
  static formatTime(
    date: Date | string | number,
    options: RegionFormatOptions = {}
  ): string {
    const {region} = options;
    const regionInfo = this.getRegionInfo(region);

    const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;

    return new Intl.DateTimeFormat('en-ZA', {
      timeZone: options.timezone || regionInfo.timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: regionInfo.timeformat.includes('h:mm A'),
    }).format(dateObj);
  }

  /**
   * Format date and time according to region preferences
   */
  static formatDateTime(
    date: Date | string | number,
    options: RegionFormatOptions & { format?: 'short' | 'medium' | 'long' } = {}
  ): string {
    const formattedDate = this.formatDate(date, options);
    const formattedTime = this.formatTime(date, options);
    return `${formattedDate} ${formattedTime}`;
  }

  /**
   * Get compact amount representation
   */
  private static getCompactAmount(amount: number): {
    value: number;
    suffix: string;
    shouldShowDecimals: boolean;
  } {
    const absAmount = Math.abs(amount);

    if (absAmount >= 1e12) {
      return {
        value: amount / 1e12,
        suffix: 'T',
        shouldShowDecimals: absAmount < 1e13,
      };
    } else if (absAmount >= 1e9) {
      return {
        value: amount / 1e9,
        suffix: 'B',
        shouldShowDecimals: absAmount < 1e10,
      };
    } else if (absAmount >= 1e6) {
      return {
        value: amount / 1e6,
        suffix: 'M',
        shouldShowDecimals: absAmount < 1e7,
      };
    } else if (absAmount >= 1e3) {
      return {
        value: amount / 1e3,
        suffix: 'K',
        shouldShowDecimals: absAmount < 1e4,
      };
    }

    return {
      value: amount,
      suffix: '',
      shouldShowDecimals: true,
    };
  }

  /**
   * Get exchange rates (mock implementation)
   */
  private static async getExchangeRates(): Promise<Record<string, number>> {
    // In a real app, this would fetch from a currency API
    return {
      ZAR: 1,
      USD: 0.055,
      EUR: 0.051,
      GBP: 0.044,
      BTC: 0.0000013,
      ETH: 0.000019,
      JPY: 8.1,
      CNY: 0.40,
      INR: 4.5,
      AUD: 0.083,
      CAD: 0.075,
      CHF: 0.053,
      NGN: 24.5,
      KES: 8.1,
      GHS: 0.61,
    };
  }
}

/**
 * React hook for currency formatting
 */
export const _useCurrencyFormatter = (defaultCurrency?: string) => {
  const formatCurrency = (amount: number, options?: Omit<CurrencyFormatOptions, 'currency'>) => {
    return CurrencyFormatter.format(amount, {
      ...options,
      currency: options?.currency || defaultCurrency || 'ZAR',
    });
  };

  const formatDate = (date: Date | string | number, options?: RegionFormatOptions) => {
    return CurrencyFormatter.formatDate(date, options);
  };

  const formatTime = (date: Date | string | number, options?: RegionFormatOptions) => {
    return CurrencyFormatter.formatTime(date, options);
  };

  const formatDateTime = (date: Date | string | number, options?: RegionFormatOptions) => {
    return CurrencyFormatter.formatDateTime(date, options);
  };

  return {
    formatCurrency,
    formatDate,
    formatTime,
    formatDateTime,
    convert: CurrencyFormatter.convert,
    formatPercentage: CurrencyFormatter.formatPercentage,
    formatCompact: CurrencyFormatter.formatCompact,
    getCurrencyInfo: CurrencyFormatter.getCurrencyInfo,
    getRegionInfo: CurrencyFormatter.getRegionInfo,
  };
};

export default CurrencyFormatter;

// Re-export with original name for compatibility
export const useCurrencyFormatter = _useCurrencyFormatter;
