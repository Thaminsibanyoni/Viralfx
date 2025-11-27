import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { ConfigService } from '@nestjs/config';

export interface ExchangeRate {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  rateUpdatedAt: Date;
  source: string;
}

export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
  precision: number;
  isActive: boolean;
  isPrimary: boolean;
  isFiat: boolean;
  minDeposit: number;
  minWithdrawal: number;
  dailyLimit: number;
  monthlyLimit: number;
  supportedPaymentMethods: string[];
  icon?: string;
  flag?: string;
}

@Injectable()
export class CurrencyConverterService {
  private readonly logger = new Logger(CurrencyConverterService.name);

  // Default exchange rates (would be updated from real sources)
  private readonly defaultRates: Partial<ExchangeRate> = {
    'USD_ZAR': { rate: 18.5, rateUpdatedAt: new Date(), source: 'default' },
    'EUR_ZAR': { rate: 20.2, rateUpdatedAt: new Date(), source: 'default' },
    'GBP_ZAR': { rate: 23.8, rateUpdatedAt: new Date(), source: 'default' },
    'BTC_ZAR': { rate: 450000, rateUpdatedAt: new Date(), source: 'default' },
    'ETH_ZAR': { rate: 25000, rateUpdatedAt: new Date(), source: 'default' },
    'ZAR_USD': { rate: 0.054, rateUpdatedAt: new Date(), source: 'default' },
    'ZAR_EUR': { rate: 0.050, rateUpdatedAt: new Date(), source: 'default' },
    'ZAR_GBP': { rate: 0.042, rateUpdatedAt: new Date(), source: 'default' },
    'ZAR_BTC': { rate: 0.00000222, rateUpdatedAt: new Date(), source: 'default' },
    'ZAR_ETH': { rate: 0.00004, rateUpdatedAt: new Date(), source: 'default' },
  };

  // Supported currencies
  private readonly supportedCurrencies: CurrencyInfo[] = [
    {
      code: 'ZAR',
      name: 'South African Rand',
      symbol: 'R',
      precision: 2,
      isActive: true,
      isPrimary: true,
      isFiat: true,
      minDeposit: 100,
      minWithdrawal: 100,
      dailyLimit: 50000,
      monthlyLimit: 500000,
      supportedPaymentMethods: ['PAYSTACK', 'PAYFAST', 'OZOW', 'EFT'],
      icon: '🇿🇦',
      flag: '🇿🇦'
    },
    {
      code: 'USD',
      name: 'United States Dollar',
      symbol: '$',
      precision: 2,
      isActive: true,
      isPrimary: false,
      isFiat: true,
      minDeposit: 10,
      minWithdrawal: 10,
      dailyLimit: 10000,
      monthlyLimit: 100000,
      supportedPaymentMethods: ['PAYSTACK', 'PAYFAST'],
      icon: '🇺🇸',
      flag: '🇺🇸'
    },
    {
      code: 'EUR',
      name: 'Euro',
      symbol: '€',
      precision: 2,
      isActive: true,
      isPrimary: false,
      isFiat: true,
      minDeposit: 10,
      minWithdrawal: 10,
      dailyLimit: 10000,
      monthlyLimit: 100000,
      supportedPaymentMethods: ['PAYSTACK', 'PAYFAST'],
      icon: '🇪🇺',
      flag: '🇪🇺'
    },
    {
      code: 'GBP',
      name: 'British Pound',
      symbol: '£',
      precision: 2,
      isActive: true,
      isPrimary: false,
      isFiat: true,
      minDeposit: 10,
      minWithdrawal: 10,
      dailyLimit: 10000,
      monthlyLimit: 100000,
      supportedPaymentMethods: ['PAYSTACK', 'PAYFAST'],
      icon: '🇬🇧',
      flag: '🇬🇧'
    },
    {
      code: 'BTC',
      name: 'Bitcoin',
      symbol: '₿',
      precision: 8,
      isActive: true,
      isPrimary: false,
      isFiat: false,
      minDeposit: 0.0001,
      minWithdrawal: 0.0001,
      dailyLimit: 1,
      monthlyLimit: 10,
      supportedPaymentMethods: ['PAYSTACK', 'OZOW'],
      icon: '₿',
      flag: ''
    },
    {
      code: 'ETH',
      name: 'Ethereum',
      symbol: 'Ξ',
      precision: 8,
      isActive: true,
      isPrimary: false,
      isFiat: false,
      minDeposit: 0.001,
      minWithdrawal: 0.001,
      dailyLimit: 10,
      monthlyLimit: 100,
      supportedPaymentMethods: ['PAYSTACK', 'OZOW'],
      icon: 'Ξ',
      flag: ''
    }
  ];

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {
    this.initializeExchangeRates();
  }

  /**
   * Convert amount from one currency to another
   */
  async convert(
    amount: number,
    fromCurrency: string,
    toCurrency: string
  ): Promise<{
    amount: number;
    convertedAmount: number;
    rate: number;
    fromCurrency: string;
    toCurrency: string;
    rateUpdatedAt: Date;
    confidence: number;
  }> {
    try {
      if (fromCurrency === toCurrency) {
        return {
          amount,
          convertedAmount: amount,
          rate: 1,
          fromCurrency,
          toCurrency,
          rateUpdatedAt: new Date(),
          confidence: 1.0
        };
      }

      const exchangeRate = await this.getExchangeRate(fromCurrency, toCurrency);

      if (!exchangeRate) {
        throw new Error(`No exchange rate available for ${fromCurrency} to ${toCurrency}`);
      }

      const convertedAmount = amount * exchangeRate.rate;

      return {
        amount,
        convertedAmount,
        rate: exchangeRate.rate,
        fromCurrency,
        toCurrency,
        rateUpdatedAt: exchangeRate.rateUpdatedAt,
        confidence: this.calculateConfidence(exchangeRate.rateUpdatedAt)
      };

    } catch (error) {
      this.logger.error(`Currency conversion error: ${fromCurrency} to ${toCurrency}`, error);
      throw error;
    }
  }

  /**
   * Get exchange rate between two currencies
   */
  async getExchangeRate(
    fromCurrency: string,
    toCurrency: string
  ): Promise<ExchangeRate | null> {
    try {
      const cacheKey = `exchange-rate:${fromCurrency}_${toCurrency}`;

      // Try to get from cache first
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        return {
          ...parsed,
          rateUpdatedAt: new Date(parsed.rateUpdatedAt)
        };
      }

      // Try reverse rate (toCurrency to fromCurrency, then invert)
      const reverseCacheKey = `exchange-rate:${toCurrency}_${fromCurrency}`;
      const reverseCached = await this.redis.get(reverseCacheKey);

      if (reverseCached) {
        const parsed = JSON.parse(reverseCached);
        return {
          fromCurrency,
          toCurrency,
          rate: 1 / parsed.rate,
          rateUpdatedAt: new Date(parsed.rateUpdatedAt),
          source: parsed.source
        };
      }

      // Get direct rate via ZAR as base currency
      const fromToZar = await this.getRateViaZar(fromCurrency);
      const toToZar = await this.getRateViaZar(toCurrency);

      if (!fromToZar || !toToZar) {
        return null;
      }

      const rate = toToZar.rate / fromToZar.rate;
      const exchangeRate: ExchangeRate = {
        fromCurrency,
        toCurrency,
        rate,
        rateUpdatedAt: new Date(),
        source: 'zar_base'
      };

      // Cache the rate for 5 minutes
      await this.redis.setex(cacheKey, 300, JSON.stringify({
        ...exchangeRate,
        rateUpdatedAt: exchangeRate.rateUpdatedAt.toISOString()
      }));

      return exchangeRate;

    } catch (error) {
      this.logger.error(`Failed to get exchange rate: ${fromCurrency} to ${toCurrency}`, error);
      return null;
    }
  }

  /**
   * Get all supported currencies
   */
  async getSupportedCurrencies(): Promise<CurrencyInfo[]> {
    return this.supportedCurrencies.filter(currency => currency.isActive);
  }

  /**
   * Get currency information by code
   */
  async getCurrencyInfo(currencyCode: string): Promise<CurrencyInfo | null> {
    const currency = this.supportedCurrencies.find(c => c.code === currencyCode);
    return currency || null;
  }

  /**
   * Get primary currency (ZAR)
   */
  getPrimaryCurrency(): CurrencyInfo {
    return this.supportedCurrencies.find(currency => currency.isPrimary)!;
  }

  /**
   * Convert all balances to a target currency
   */
  async convertAllBalances(
    balances: { currency: string; amount: number }[],
    targetCurrency: string = 'ZAR'
  ): Promise<{ currency: string; originalAmount: number; convertedAmount: number }[]> {
    const convertedBalances = [];

    for (const balance of balances) {
      try {
        const conversion = await this.convert(balance.amount, balance.currency, targetCurrency);
        convertedBalances.push({
          currency: balance.currency,
          originalAmount: balance.amount,
          convertedAmount: conversion.convertedAmount
        });
      } catch (error) {
        this.logger.warn(`Failed to convert ${balance.amount} ${balance.currency} to ${targetCurrency}:`, error);
        convertedBalances.push({
          currency: balance.currency,
          originalAmount: balance.amount,
          convertedAmount: 0
        });
      }
    }

    return convertedBalances;
  }

  /**
   * Get real-time exchange rates from external sources
   */
  async updateExchangeRates(): Promise<void> {
    try {
      this.logger.log('Updating exchange rates from external sources...');

      // For now, use default rates. In production, this would call actual exchange rate APIs
      const externalSources = [
        this.fetchFromCentralBanks,
        this.fetchFromCryptoExchanges,
        this.fetchFromFXProviders
      ];

      // Try each source until successful
      for (const fetchFunction of externalSources) {
        try {
          const rates = await fetchFunction();
          await this.updateRatesInCache(rates);
          this.logger.log(`Successfully updated ${Object.keys(rates).length} exchange rates`);
          break;
        } catch (error) {
          this.logger.warn(`Failed to fetch rates from ${fetchFunction.name}, trying next source...`);
        }
      }

    } catch (error) {
      this.logger.error('Failed to update exchange rates:', error);
    }
  }

  /**
   * Calculate portfolio value in ZAR
   */
  async calculatePortfolioValue(
    balances: { currency: string; amount: number }[]
  ): Promise<{
    totalValueZAR: number;
    currencyBreakdown: { currency: string; amount: number; valueZAR: number }[];
  }> {
    try {
      const convertedBalances = await this.convertAllBalances(balances, 'ZAR');

      const totalValueZAR = convertedBalances.reduce((sum, balance) => sum + balance.convertedAmount, 0);

      const currencyBreakdown = convertedBalances.map(balance => ({
        currency: balance.currency,
        amount: balance.originalAmount,
        valueZAR: balance.convertedAmount
      }));

      return {
        totalValueZAR,
        currencyBreakdown
      };

    } catch (error) {
      this.logger.error('Failed to calculate portfolio value:', error);
      throw error;
    }
  }

  /**
   * Validate if an amount meets minimum/maximum requirements for a currency
   */
  validateAmount(
    amount: number,
    currency: string,
    operation: 'DEPOSIT' | 'WITHDRAWAL'
  ): { isValid: boolean; reason?: string; limit?: number } {
    const currencyInfo = this.getSupportedCurrencies().find(c => c.code === currency);
    if (!currencyInfo) {
      return { isValid: false, reason: 'Currency not supported' };
    }

    const limit = operation === 'DEPOSIT' ? currencyInfo.minDeposit : currencyInfo.minWithdrawal;

    if (amount < limit) {
      return {
        isValid: false,
        reason: `Minimum ${operation.toLowerCase()} amount is ${currencyInfo.symbol}${limit}`,
        limit
      };
    }

    return { isValid: true };
  }

  /**
   * Get exchange rate via ZAR as base currency
   */
  private async getRateViaZar(currency: string): Promise<ExchangeRate | null> {
    if (currency === 'ZAR') {
      return {
        fromCurrency: 'ZAR',
        toCurrency: 'ZAR',
        rate: 1,
        rateUpdatedAt: new Date(),
        source: 'zar_base'
      };
    }

    const cacheKey = `exchange-rate:${currency}_ZAR`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      const parsed = JSON.parse(cached);
      return {
        ...parsed,
        rateUpdatedAt: new Date(parsed.rateUpdatedAt)
      };
    }

    const defaultRate = this.defaultRates[`${currency}_ZAR`];
    if (defaultRate) {
      await this.redis.setex(cacheKey, 300, JSON.stringify({
        ...defaultRate,
        rateUpdatedAt: defaultRate.rateUpdatedAt.toISOString()
      }));
      return {
        fromCurrency: currency,
        toCurrency: 'ZAR',
        rate: defaultRate.rate,
        rateUpdatedAt: defaultRate.rateUpdatedAt,
        source: 'default'
      };
    }

    return null;
  }

  /**
   * Initialize exchange rates in cache
   */
  private async initializeExchangeRates(): Promise<void> {
    try {
      this.logger.log('Initializing exchange rates in cache...');

      for (const [key, rate] of Object.entries(this.defaultRates)) {
        const cacheKey = `exchange-rate:${key}`;
        await this.redis.setex(cacheKey, 3600, JSON.stringify({
          ...rate,
          rateUpdatedAt: rate.rateUpdatedAt.toISOString()
        }));
      }

      this.logger.log('Exchange rates initialized successfully');

    } catch (error) {
      this.logger.error('Failed to initialize exchange rates:', error);
    }
  }

  /**
   * Update rates in cache
   */
  private async updateRatesInCache(rates: Partial<ExchangeRate>): Promise<void> {
    try {
      for (const [key, rate] of Object.entries(rates)) {
        const cacheKey = `exchange-rate:${key}`;
        await this.redis.setex(cacheKey, 300, JSON.stringify({
          ...rate,
          rateUpdatedAt: rate.rateUpdatedAt.toISOString()
        }));
      }
    } catch (error) {
      this.logger.error('Failed to update rates in cache:', error);
    }
  }

  /**
   * Calculate confidence score based on age of exchange rate
   */
  private calculateConfidence(rateUpdatedAt: Date): number {
    const now = new Date();
    const ageInMinutes = (now.getTime() - rateUpdatedAt.getTime()) / (1000 * 60);

    // Rate confidence decreases over time
    const maxAgeMinutes = 60; // 1 hour
    const confidence = Math.max(0.1, 1 - (ageInMinutes / maxAgeMinutes));

    return Math.round(confidence * 100) / 100;
  }

  /**
   * Fetch exchange rates from South African central banks
   */
  private async fetchFromCentralBanks(): Promise<Partial<ExchangeRate>> {
    // In production, this would call actual SARB API
    const rates: Partial<ExchangeRate> = {
      'USD_ZAR': { rate: 18.5, rateUpdatedAt: new Date(), source: 'sarb' },
      'EUR_ZAR': { rate: 20.2, rateUpdatedAt: new Date(), source: 'sarb' },
      'GBP_ZAR': { rate: 23.8, rateUpdatedAt: new Date(), source: 'sarb' }
    };

    return rates;
  }

  /**
   * Fetch exchange rates from cryptocurrency exchanges
   */
  private async fetchFromCryptoExchanges(): Promise<Partial<ExchangeRate>> {
    // In production, this would aggregate rates from multiple crypto exchanges
    const btcRate = await this.aggregateBTCRate();
    const ethRate = await this.aggregateETHRate();

    const rates: Partial<ExchangeRate> = {
      'BTC_ZAR': { rate: btcRate, rateUpdatedAt: new Date(), source: 'crypto' },
      'ETH_ZAR': { rate: ethRate, rateUpdatedAt: new Date(), source: 'crypto' },
      'BTC_USD': { rate: btcRate / 18.5, rateUpdatedAt: new Date(), source: 'crypto' },
      'ETH_USD': { rate: ethRate / 18.5, rateUpdatedAt: new Date(), source: 'crypto' }
    };

    return rates;
  }

  /**
   * Fetch exchange rates from FX providers
   */
  private async fetchFromFXProviders(): Promise<Partial<ExchangeRate>> {
    // In production, this would call multiple FX API providers
    const rates: Partial<ExchangeRate> = {
      'USD_ZAR': { rate: 18.5, rateUpdatedAt: new Date(), source: 'fx_provider' },
      'EUR_ZAR': { rate: 20.2, rateUpdatedAt: new Date(), source: 'fx_provider' },
      'GBP_ZAR': { rate: 23.8, rateUpdatedAt: new Date(), source: 'fx_provider' }
    };

    return rates;
  }

  /**
   * Aggregate BTC price from multiple exchanges
   */
  private async aggregateBTCRate(): Promise<number> {
    // Mock implementation - would fetch from multiple exchanges
    const exchanges = [
      { name: 'binance', price: 450000, volume: 1000 },
      { name: 'coinbase', price: 452000, volume: 800 },
      { name: 'kraken', price: 449500, volume: 600 }
    ];

    // Volume-weighted average
    const totalVolume = exchanges.reduce((sum, exchange) => sum + exchange.volume, 0);
    const weightedPrice = exchanges.reduce((sum, exchange) => sum + (exchange.price * exchange.volume), 0) / totalVolume;

    return weightedPrice;
  }

  /**
   * Aggregate ETH price from multiple exchanges
   */
  private async aggregateETHRate(): Promise<number> {
    // Mock implementation - would fetch from multiple exchanges
    const exchanges = [
      { name: 'binance', price: 25000, volume: 800 },
      { name: 'coinbase', price: 25100, volume: 600 },
      { name: 'kraken', price: 24900, volume: 400 }
    ];

    // Volume-weighted average
    const totalVolume = exchanges.reduce((sum, exchange) => sum + exchange.volume, 0);
    const weightedPrice = exchanges.reduce((sum, exchange) => sum + (exchange.price * exchange.volume), 0) / totalVolume;

    return weightedPrice;
  }
}