// Global i18n configuration for ViralFX
export const I18N_CONFIG = {
  // Default settings
  defaultLanguage: 'en',
  defaultRegion: 'za',
  defaultCurrency: 'ZAR',
  defaultTimezone: 'Africa/Johannesburg',

  // Auto-detection settings
  autoDetectLanguage: true,
  autoDetectRegion: true,
  autoDetectCurrency: true,
  autoDetectTimezone: true,

  // Local storage keys
  storageKeys: {
    language: 'viralfx_language',
    region: 'viralfx_region',
    currency: 'viralfx_currency',
    timezone: 'viralfx_timezone',
    preferences: 'viralfx_preferences',
  },

  // Fallback settings
  fallbackLanguage: 'en',
  fallbackRegion: 'za',
  fallbackCurrency: 'ZAR',

  // Supported locales for number formatting
  numberFormats: {
    'en-US': { style: 'decimal', currency: 'USD' },
    'en-ZA': { style: 'decimal', currency: 'ZAR' },
    'en-GB': { style: 'decimal', currency: 'GBP' },
    'de-DE': { style: 'decimal', currency: 'EUR' },
    'fr-FR': { style: 'decimal', currency: 'EUR' },
    'es-ES': { style: 'decimal', currency: 'EUR' },
    'it-IT': { style: 'decimal', currency: 'EUR' },
    'nl-NL': { style: 'decimal', currency: 'EUR' },
    'pt-PT': { style: 'decimal', currency: 'EUR' },
    'ja-JP': { style: 'decimal', currency: 'JPY' },
    'zh-CN': { style: 'decimal', currency: 'CNY' },
    'ar-SA': { style: 'decimal', currency: 'SAR' },
    'hi-IN': { style: 'decimal', currency: 'INR' },
    'ru-RU': { style: 'decimal', currency: 'RUB' },
  },

  // Supported locales for date/time formatting
  dateTimeFormats: {
    'en-US': {
      date: 'MM/DD/YYYY',
      time: 'h:mm A',
      datetime: 'MM/DD/YYYY h:mm A',
      longDate: 'MMMM D, YYYY',
      shortDate: 'M/D/YY',
    },
    'en-ZA': {
      date: 'DD/MM/YYYY',
      time: 'HH:mm',
      datetime: 'DD/MM/YYYY HH:mm',
      longDate: 'D MMMM YYYY',
      shortDate: 'D/M/YY',
    },
    'en-GB': {
      date: 'DD/MM/YYYY',
      time: 'HH:mm',
      datetime: 'DD/MM/YYYY HH:mm',
      longDate: 'D MMMM YYYY',
      shortDate: 'D/M/YY',
    },
    'de-DE': {
      date: 'DD.MM.YYYY',
      time: 'HH:mm',
      datetime: 'DD.MM.YYYY HH:mm',
      longDate: 'D. MMMM YYYY',
      shortDate: 'D.M.YY',
    },
    'fr-FR': {
      date: 'DD/MM/YYYY',
      time: 'HH:mm',
      datetime: 'DD/MM/YYYY HH:mm',
      longDate: 'D MMMM YYYY',
      shortDate: 'D/MM/YY',
    },
    'es-ES': {
      date: 'DD/MM/YYYY',
      time: 'HH:mm',
      datetime: 'DD/MM/YYYY HH:mm',
      longDate: 'D [de] MMMM [de] YYYY',
      shortDate: 'D/M/YY',
    },
    'it-IT': {
      date: 'DD/MM/YYYY',
      time: 'HH:mm',
      datetime: 'DD/MM/YYYY HH:mm',
      longDate: 'D MMMM YYYY',
      shortDate: 'D/M/YY',
    },
    'nl-NL': {
      date: 'DD-MM-YYYY',
      time: 'HH:mm',
      datetime: 'DD-MM-YYYY HH:mm',
      longDate: 'D MMMM YYYY',
      shortDate: 'D-M-YY',
    },
    'pt-PT': {
      date: 'DD/MM/YYYY',
      time: 'HH:mm',
      datetime: 'DD/MM/YYYY HH:mm',
      longDate: 'D [de] MMMM [de] YYYY',
      shortDate: 'D/M/YY',
    },
    'ja-JP': {
      date: 'YYYY/MM/DD',
      time: 'HH:mm',
      datetime: 'YYYY/MM/DD HH:mm',
      longDate: 'YYYY年M月D日',
      shortDate: 'YYYY/M/D',
    },
    'zh-CN': {
      date: 'YYYY年MM月DD日',
      time: 'HH:mm',
      datetime: 'YYYY年MM月DD日 HH:mm',
      longDate: 'YYYY年MM月DD日',
      shortDate: 'YYYY/MM/DD',
    },
    'ar-SA': {
      date: 'DD/MM/YYYY',
      time: 'HH:mm',
      datetime: 'DD/MM/YYYY HH:mm',
      longDate: 'DD MMMM YYYY',
      shortDate: 'D/M/YY',
    },
    'hi-IN': {
      date: 'DD/MM/YYYY',
      time: 'HH:mm',
      datetime: 'DD/MM/YYYY HH:mm',
      longDate: 'D MMMM YYYY',
      shortDate: 'D/M/YY',
    },
    'ru-RU': {
      date: 'DD.MM.YYYY',
      time: 'HH:mm',
      datetime: 'DD.MM.YYYY HH:mm',
      longDate: 'D MMMM YYYY г.',
      shortDate: 'DD.MM.YY',
    },
  },

  // Currency display preferences by region
  currencyDisplay: {
    'ZAR': { symbolBefore: true, space: false, decimals: 2 },
    'USD': { symbolBefore: true, space: false, decimals: 2 },
    'EUR': { symbolBefore: false, space: true, decimals: 2 },
    'GBP': { symbolBefore: true, space: false, decimals: 2 },
    'BTC': { symbolBefore: true, space: false, decimals: 8 },
    'ETH': { symbolBefore: true, space: false, decimals: 6 },
    'JPY': { symbolBefore: true, space: false, decimals: 0 },
    'CNY': { symbolBefore: true, space: false, decimals: 2 },
    'INR': { symbolBefore: true, space: false, decimals: 2 },
    'NGN': { symbolBefore: true, space: false, decimals: 2 },
    'KES': { symbolBefore: true, space: false, decimals: 2 },
    'GHS': { symbolBefore: true, space: false, decimals: 2 },
  },

  // RTL language support
  rtlLanguages: ['ar', 'he', 'fa', 'ur'],

  // Pluralization rules (simplified)
  pluralRules: {
    'en': { one: (n: number) => n === 1, other: () => true },
    'af': { one: (n: number) => n === 1, other: () => true },
    'zu': { one: (n: number) => n === 1, other: () => true },
    'xh': { one: (n: number) => n === 1, other: () => true },
    'es': { one: (n: number) => n === 1, other: () => true },
    'fr': { one: (n: number) => n === 1, other: () => true },
    'de': { one: (n: number) => n === 1, other: () => true },
    'pt': { one: (n: number) => n === 1, other: () => true },
    'it': { one: (n: number) => n === 1, other: () => true },
    'nl': { one: (n: number) => n === 1, other: () => true },
    'zh': { other: () => true }, // Chinese doesn't have plural forms
    'ja': { other: () => true }, // Japanese doesn't have plural forms
    'ar': {
      zero: (n: number) => n === 0,
      one: (n: number) => n === 1,
      two: (n: number) => n === 2,
      few: (n: number) => n >= 3 && n <= 10,
      many: (n: number) => n >= 11,
      other: () => true
    },
    'hi': { one: (n: number) => n === 0 || n === 1, other: () => true },
    'ru': {
      one: (n: number) => n % 10 === 1 && n % 100 !== 11,
      few: (n: number) => [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100),
      many: (n: number) => n % 10 === 0 || [5, 6, 7, 8, 9].includes(n % 10) || [11, 12, 13, 14].includes(n % 100),
      other: () => true
    },
  },

  // Text direction mapping
  textDirection: {
    'ar': 'rtl',
    'he': 'rtl',
    'fa': 'rtl',
    'ur': 'rtl',
    'default': 'ltr',
  },

  // Feature availability by region
  regionalFeatures: {
    'za': {
      paymentMethods: ['eft', 'ozow', 'payfast', 'credit_card', 'crypto'],
      supportedLanguages: ['en', 'af', 'zu', 'xh'],
      currency: 'ZAR',
      phonePrefix: '+27',
      dateFormat: 'DD/MM/YYYY',
      timeFormat: '24h',
    },
    'us': {
      paymentMethods: ['ach', 'wire', 'credit_card', 'crypto'],
      supportedLanguages: ['en'],
      currency: 'USD',
      phonePrefix: '+1',
      dateFormat: 'MM/DD/YYYY',
      timeFormat: '12h',
    },
    'uk': {
      paymentMethods: ['bacs', 'fps', 'credit_card', 'crypto'],
      supportedLanguages: ['en'],
      currency: 'GBP',
      phonePrefix: '+44',
      dateFormat: 'DD/MM/YYYY',
      timeFormat: '24h',
    },
    'eu': {
      paymentMethods: ['sepa', 'sofort', 'credit_card', 'crypto'],
      supportedLanguages: ['en', 'de', 'fr', 'es', 'it', 'nl', 'pt'],
      currency: 'EUR',
      phonePrefix: '+32',
      dateFormat: 'DD/MM/YYYY',
      timeFormat: '24h',
    },
    'jp': {
      paymentMethods: ['bank_transfer', 'konbini', 'credit_card', 'crypto'],
      supportedLanguages: ['ja'],
      currency: 'JPY',
      phonePrefix: '+81',
      dateFormat: 'YYYY/MM/DD',
      timeFormat: '24h',
    },
    'cn': {
      paymentMethods: ['alipay', 'wechat_pay', 'bank_transfer', 'crypto'],
      supportedLanguages: ['zh'],
      currency: 'CNY',
      phonePrefix: '+86',
      dateFormat: 'YYYY年MM月DD日',
      timeFormat: '24h',
    },
    'in': {
      paymentMethods: ['upi', 'bank_transfer', 'credit_card', 'crypto'],
      supportedLanguages: ['en', 'hi'],
      currency: 'INR',
      phonePrefix: '+91',
      dateFormat: 'DD/MM/YYYY',
      timeFormat: '24h',
    },
    'ng': {
      paymentMethods: ['bank_transfer', 'ussd', 'credit_card', 'crypto'],
      supportedLanguages: ['en'],
      currency: 'NGN',
      phonePrefix: '+234',
      dateFormat: 'DD/MM/YYYY',
      timeFormat: '24h',
    },
  },

  // Translation loading settings
  translationLoading: {
    async: true,
    loadPath: '/i18n/locales/{{lng}}/{{ns}}.json',
    fallbackLoadPath: '/i18n/locales/en/{{ns}}.json',
  },

  // Cache settings
  cache: {
    enabled: true,
    ttl: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  },

  // API endpoints for language/region detection
  detectionAPI: {
    ipInfo: '/api/v1/geo/ip-info',
    currencyRates: '/api/v1/currency/rates',
    supportedLanguages: '/api/v1/i18n/languages',
    supportedRegions: '/api/v1/i18n/regions',
  },

  // Debug settings
  debug: {
    enabled: process.env.NODE_ENV === 'development',
    logLevel: 'info',
    showMissingTranslations: true,
    showTranslationKeys: false,
  },
};

export default I18N_CONFIG;