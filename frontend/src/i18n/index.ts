import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import en from './locales/en.json';
import af from './locales/af.json';
import zu from './locales/zu.json';
import xh from './locales/xh.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import pt from './locales/pt.json';
import it from './locales/it.json';
import nl from './locales/nl.json';
import zh from './locales/zh.json';
import ja from './locales/ja.json';
import ar from './locales/ar.json';
import hi from './locales/hi.json';
import ru from './locales/ru.json';

export const _supportedLanguages = [
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    flag: '🇺🇸',
    rtl: false,
    region: 'global'
  },
  {
    code: 'af',
    name: 'Afrikaans',
    nativeName: 'Afrikaans',
    flag: '🇿🇦',
    rtl: false,
    region: 'za'
  },
  {
    code: 'zu',
    name: 'Zulu',
    nativeName: 'isiZulu',
    flag: '🇿🇦',
    rtl: false,
    region: 'za'
  },
  {
    code: 'xh',
    name: 'Xhosa',
    nativeName: 'isiXhosa',
    flag: '🇿🇦',
    rtl: false,
    region: 'za'
  },
  {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    flag: '🇪🇸',
    rtl: false,
    region: 'global'
  },
  {
    code: 'fr',
    name: 'French',
    nativeName: 'Français',
    flag: '🇫🇷',
    rtl: false,
    region: 'global'
  },
  {
    code: 'de',
    name: 'German',
    nativeName: 'Deutsch',
    flag: '🇩🇪',
    rtl: false,
    region: 'global'
  },
  {
    code: 'pt',
    name: 'Portuguese',
    nativeName: 'Português',
    flag: '🇵🇹',
    rtl: false,
    region: 'global'
  },
  {
    code: 'it',
    name: 'Italian',
    nativeName: 'Italiano',
    flag: '🇮🇹',
    rtl: false,
    region: 'global'
  },
  {
    code: 'nl',
    name: 'Dutch',
    nativeName: 'Nederlands',
    flag: '🇳🇱',
    rtl: false,
    region: 'global'
  },
  {
    code: 'zh',
    name: 'Chinese (Simplified)',
    nativeName: '中文',
    flag: '🇨🇳',
    rtl: false,
    region: 'global'
  },
  {
    code: 'ja',
    name: 'Japanese',
    nativeName: '日本語',
    flag: '🇯🇵',
    rtl: false,
    region: 'global'
  },
  {
    code: 'ar',
    name: 'Arabic',
    nativeName: 'العربية',
    flag: '🇸🇦',
    rtl: true,
    region: 'global'
  },
  {
    code: 'hi',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    flag: '🇮🇳',
    rtl: false,
    region: 'global'
  },
  {
    code: 'ru',
    name: 'Russian',
    nativeName: 'Русский',
    flag: '🇷🇺',
    rtl: false,
    region: 'global'
  },
];

export const _supportedCurrencies = [
  { code: 'ZAR', symbol: 'R', name: 'South African Rand', country: 'South Africa' },
  { code: 'USD', symbol: '$', name: 'US Dollar', country: 'United States' },
  { code: 'EUR', symbol: '€', name: 'Euro', country: 'European Union' },
  { code: 'GBP', symbol: '£', name: 'British Pound', country: 'United Kingdom' },
  { code: 'BTC', symbol: '₿', name: 'Bitcoin', country: 'Global' },
  { code: 'ETH', symbol: 'Ξ', name: 'Ethereum', country: 'Global' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', country: 'Japan' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', country: 'China' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', country: 'India' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', country: 'Australia' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', country: 'Canada' },
  { code: 'CHF', symbol: 'Fr', name: 'Swiss Franc', country: 'Switzerland' },
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira', country: 'Nigeria' },
  { code: 'KES', symbol: 'Ksh', name: 'Kenyan Shilling', country: 'Kenya' },
  { code: 'GHS', symbol: 'GH₵', name: 'Ghanaian Cedi', country: 'Ghana' },
];

export const _supportedRegions = [
  {
    code: 'za',
    name: 'South Africa',
    currency: 'ZAR',
    languages: ['en', 'af', 'zu', 'xh'],
    timezone: 'Africa/Johannesburg',
    dateformat: 'DD/MM/YYYY',
    timeformat: 'HH:mm',
    phonePrefix: '+27',
    flag: '🇿🇦'
  },
  {
    code: 'us',
    name: 'United States',
    currency: 'USD',
    languages: ['en'],
    timezone: 'America/New_York',
    dateformat: 'MM/DD/YYYY',
    timeformat: 'h:mm A',
    phonePrefix: '+1',
    flag: '🇺🇸'
  },
  {
    code: 'uk',
    name: 'United Kingdom',
    currency: 'GBP',
    languages: ['en'],
    timezone: 'Europe/London',
    dateformat: 'DD/MM/YYYY',
    timeformat: 'HH:mm',
    phonePrefix: '+44',
    flag: '🇬🇧'
  },
  {
    code: 'eu',
    name: 'European Union',
    currency: 'EUR',
    languages: ['en', 'de', 'fr', 'es', 'it', 'nl', 'pt'],
    timezone: 'Europe/Paris',
    dateformat: 'DD/MM/YYYY',
    timeformat: 'HH:mm',
    phonePrefix: '+32',
    flag: '🇪🇺'
  },
  {
    code: 'jp',
    name: 'Japan',
    currency: 'JPY',
    languages: ['ja'],
    timezone: 'Asia/Tokyo',
    dateformat: 'YYYY/MM/DD',
    timeformat: 'HH:mm',
    phonePrefix: '+81',
    flag: '🇯🇵'
  },
  {
    code: 'cn',
    name: 'China',
    currency: 'CNY',
    languages: ['zh'],
    timezone: 'Asia/Shanghai',
    dateformat: 'YYYY/MM/DD',
    timeformat: 'HH:mm',
    phonePrefix: '+86',
    flag: '🇨🇳'
  },
  {
    code: 'in',
    name: 'India',
    currency: 'INR',
    languages: ['en', 'hi'],
    timezone: 'Asia/Kolkata',
    dateformat: 'DD/MM/YYYY',
    timeformat: 'HH:mm',
    phonePrefix: '+91',
    flag: '🇮🇳'
  },
  {
    code: 'ng',
    name: 'Nigeria',
    currency: 'NGN',
    languages: ['en'],
    timezone: 'Africa/Lagos',
    dateformat: 'DD/MM/YYYY',
    timeformat: 'HH:mm',
    phonePrefix: '+234',
    flag: '🇳🇬'
  },
];

const resources = {
  en: { translation: en },
  af: { translation: af },
  zu: { translation: zu },
  xh: { translation: xh },
  es: { translation: es },
  fr: { translation: fr },
  de: { translation: de },
  pt: { translation: pt },
  it: { translation: it },
  nl: { translation: nl },
  zh: { translation: zh },
  ja: { translation: ja },
  ar: { translation: ar },
  hi: { translation: hi },
  ru: { translation: ru },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    debug: process.env.NODE_ENV === 'development',

    interpolation: {
      escapeValue: false,
    },

    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'viralfx_language',
    },

    react: {
      useSuspense: false,
    },
  });

// Re-export with original names for compatibility
export const supportedLanguages = _supportedLanguages;
export const supportedCurrencies = _supportedCurrencies;
export const supportedRegions = _supportedRegions;

export default i18n;