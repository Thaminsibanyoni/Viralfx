# 🎨 **UI Kit Blueprint & Tailwind System**

The **UI kit** ensures every developer builds consistent, reusable components matching your purple/gold branding.

---

## 1. **Folder Structure**

```
frontend/src/
 ├── components/
 │   ├── ui/
 │   │   ├── Button.tsx
 │   │   ├── Input.tsx
 │   │   ├── Select.tsx
 │   │   ├── Modal.tsx
 │   │   ├── Card.tsx
 │   │   ├── Tabs.tsx
 │   │   ├── Tooltip.tsx
 │   │   ├── Table.tsx
 │   │   ├── Switch.tsx
 │   │   ├── Badge.tsx
 │   │   ├── Loader.tsx
 │   │   ├── Avatar.tsx
 │   │   └── Alert.tsx
 │   ├── charts/
 │   │   ├── SentimentChart.tsx
 │   │   ├── MomentumHeatmap.tsx
 │   │   └── ViralIndexChart.tsx
 │   ├── dashboard/
 │   │   ├── MarketCard.tsx
 │   │   ├── BrokerCard.tsx
 │   │   ├── TrendFeed.tsx
 │   │   ├── WalletSummary.tsx
 │   │   ├── NotificationsPanel.tsx
 │   │   ├── ChatPanel.tsx
 │   │   └── SidebarNav.tsx
 │   ├── layout/
 │   │   ├── MainLayout.tsx
 │   │   ├── DashboardLayout.tsx
 │   │   ├── AdminLayout.tsx
 │   │   └── AuthLayout.tsx
 │   ├── icons/
 │   └── index.ts
 ├── routes/
 │   ├── dashboard/
 │   │   ├── index.tsx
 │   │   ├── markets.tsx
 │   │   ├── brokers.tsx
 │   │   ├── topics.tsx
 │   │   ├── settings.tsx
 │   │   ├── wallet.tsx
 │   │   ├── chat.tsx
 │   │   └── analytics.tsx
 │   ├── admin/
 │   │   ├── index.tsx
 │   │   ├── moderation.tsx
 │   │   ├── brokers.tsx
 │   │   ├── trends.tsx
 │   │   └── users.tsx
 │   ├── auth/
 │   │   ├── login.tsx
 │   │   └── register.tsx
 │   ├── home.tsx
 │   └── about.tsx
 ├── styles/
 │   ├── theme.css
 │   └── tailwind.css
 ├── hooks/
 ├── utils/
 ├── types/
 └── App.tsx
```

---

## 2. **Tailwind Theme Configuration**

```js
// tailwind.config.js
export default {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#4B0082', // Deep purple
          light: '#7A1FBF',
          lighter: '#9C4EDD',
          dark: '#31005A',
          darker: '#1F0039',
          50: '#F3E5F5',
          100: '#E1BEE7',
          500: '#4B0082',
          600: '#3D1B6D',
          700: '#2E0A4E',
          900: '#1F0033',
        },
        accent: {
          DEFAULT: '#FFB300', // Electric gold
          light: '#FFD54F',
          lighter: '#FFE082',
          dark: '#FF8F00',
          darker: '#FF6F00',
          50: '#FFF8E1',
          100: '#FFECB3',
          500: '#FFB300',
          600: '#FFA000',
          700: '#FF6F00',
        },
        background: {
          dark: '#0E0E10', // Near-black
          medium: '#1C1C22',
          light: '#2A2A32',
          DEFAULT: '#0E0E10',
          lightMode: {
            primary: '#FFFFFF',
            secondary: '#F5F5F5',
            tertiary: '#E8E8E8',
          }
        },
        surface: {
          primary: 'rgba(26, 26, 32, 0.8)',
          secondary: 'rgba(46, 46, 58, 0.9)',
          tertiary: 'rgba(66, 66, 82, 0.95)',
          elevated: '#2A2A32',
          overlay: 'rgba(14, 14, 16, 0.8)',
        },
        success: '#00C853', // Emerald
        warning: '#FFB300', // Gold
        danger: '#E53935', // Crimson
        info: '#00ACC1', // Cyan
        neutral: '#9E9E9A', // Gray
        trading: {
          rise: '#00C853', // Emerald green
          fall: '#E53935', // Crimson red
          neutral: '#FFB300', // Gold
          background: '#0A0A0C', // Very dark for charts
          grid: 'rgba(255, 255, 255, 0.1)',
          text: '#FFFFFF',
        }
      },
      fontFamily: {
        sans: ['Inter', 'Manrope', 'system-ui', 'sans-serif'],
        display: ['Manrope', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1' }],
        '6xl': ['3.75rem', { lineHeight: '1' }],
      },
      fontWeight: {
        'thin': '100',
        'extralight': '200',
        'light': '300',
        'normal': '400',
        'medium': '500',
        'semibold': '600',
        'bold': '700',
        'extrabold': '800',
        'black': '900',
      },
      borderRadius: {
        'xs': '0.125rem', // 2px
        'sm': '0.25rem',  // 4px
        'DEFAULT': '0.375rem', // 6px
        'md': '0.5rem',   // 8px
        'lg': '0.75rem',  // 12px
        'xl': '1rem',     // 16px
        '2xl': '1.5rem',  // 24px
        '3xl': '2rem',    // 32px
      },
      boxShadow: {
        'sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'DEFAULT': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        'md': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        'xl': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        'glow': '0 0 15px rgba(255, 179, 0, 0.25)',
        'glow-primary': '0 0 20px rgba(75, 0, 130, 0.3)',
        'glow-accent': '0 0 20px rgba(255, 179, 0, 0.3)',
        'inner': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 3s ease-in-out infinite',
        'slide-up': 'slide-up 0.3s ease-out',
        'slide-down': 'slide-down 0.3s ease-out',
        'fade-in': 'fade-in 0.3s ease-out',
        'scale-in': 'scale-in 0.2s ease-out',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 15px rgba(255, 179, 0, 0.25)' },
          '50%': { boxShadow: '0 0 25px rgba(255, 179, 0, 0.4)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'slide-down': {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      screens: {
        'xs': '475px',
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      backdropBlur: {
        'xs': '2px',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    require('@tailwindcss/aspect-ratio'),
  ],
}
```

---

## 3. **Component Design Tokens**

```css
/* styles/theme.css */
:root {
  /* Colors */
  --color-primary: 75, 0, 130;
  --color-accent: 255, 179, 0;
  --color-success: 0, 200, 83;
  --color-warning: 255, 179, 0;
  --color-danger: 229, 57, 53;
  --color-info: 0, 172, 193;

  /* Backgrounds */
  --bg-primary: 14, 14, 16;
  --bg-secondary: 28, 28, 34;
  --bg-tertiary: 42, 42, 50;

  /* Surfaces */
  --surface-primary: 26, 26, 32, 0.8;
  --surface-secondary: 46, 46, 58, 0.9;

  /* Typography */
  --font-primary: 'Inter', system-ui, sans-serif;
  --font-secondary: 'Manrope', system-ui, sans-serif;

  /* Spacing */
  --radius-base: 0.375rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;

  /* Shadows */
  --shadow-glow: 0 0 15px rgba(var(--color-accent), 0.25);
  --shadow-primary: 0 0 20px rgba(var(--color-primary), 0.3);

  /* Transitions */
  --transition-base: all 0.2s ease;
  --transition-slow: all 0.3s ease;
}

[data-theme="light"] {
  --bg-primary: 255, 255, 255;
  --bg-secondary: 245, 245, 245;
  --bg-tertiary: 232, 232, 232;
}
```

---

## 4. **Dashboard Routes Overview**

| Route                  | Purpose                                   | Component Path                |
| ---------------------- | ----------------------------------------- | ----------------------------- |
| `/dashboard`           | Overview cards + trending topics feed     | `dashboard/index.tsx`         |
| `/dashboard/markets`   | Live market chart & sentiment overlay     | `dashboard/markets.tsx`       |
| `/dashboard/brokers`   | Broker list + connect option              | `dashboard/brokers.tsx`       |
| `/dashboard/topics`    | Trending SA stories with filters          | `dashboard/topics.tsx`        |
| `/dashboard/wallet`    | Balance, deposits, Paystack/PayFast       | `dashboard/wallet.tsx`        |
| `/dashboard/chat`      | Real-time messaging                       | `dashboard/chat.tsx`          |
| `/dashboard/settings`  | Profile, 2FA, notifications               | `dashboard/settings.tsx`      |
| `/dashboard/analytics` | Historical viral index, prediction charts | `dashboard/analytics.tsx`    |
| `/admin`               | Admin overview                            | `admin/index.tsx`             |
| `/admin/trends`        | Moderation of topics                      | `admin/trends.tsx`            |
| `/admin/brokers`       | Broker approval                           | `admin/brokers.tsx`           |
| `/admin/users`         | User KYC                                  | `admin/users.tsx`             |
| `/admin/moderation`    | Filter settings                           | `admin/moderation.tsx`        |

---

## 5. **Core UI Components**

### Button Component
```tsx
// components/ui/Button.tsx
import { clsx } from 'clsx';
import { forwardRef } from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  loading?: boolean;
  icon?: React.ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  className,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  disabled,
  ...props
}, ref) => {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

  const variants = {
    primary: 'bg-gradient-to-r from-primary-500 to-accent-500 text-white hover:from-primary-600 hover:to-accent-600 focus:ring-primary-500 shadow-glow',
    secondary: 'bg-surface-primary text-white border border-gray-600 hover:bg-surface-secondary focus:ring-primary-500',
    accent: 'bg-accent-500 text-white hover:bg-accent-600 focus:ring-accent-500 shadow-glow',
    outline: 'border-2 border-primary-500 text-primary-500 hover:bg-primary-500 hover:text-white focus:ring-primary-500',
    ghost: 'text-gray-300 hover:text-white hover:bg-surface-primary focus:ring-primary-500',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
    xl: 'px-8 py-4 text-xl',
  };

  return (
    <button
      className={clsx(
        baseClasses,
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled || loading}
      ref={ref}
      {...props}
    >
      {loading && (
        <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent mr-2" />
      )}
      {icon && !loading && (
        <span className="mr-2">{icon}</span>
      )}
      {children}
    </button>
  );
});

Button.displayName = 'Button';
export default Button;
```

### Card Component
```tsx
// components/ui/Card.tsx
import { clsx } from 'clsx';
import { forwardRef } from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'glass';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const Card = forwardRef<HTMLDivElement, CardProps>(({
  className,
  variant = 'default',
  padding = 'md',
  children,
  ...props
}, ref) => {
  const baseClasses = 'rounded-xl transition-all duration-200';

  const variants = {
    default: 'bg-surface-primary border border-gray-700',
    elevated: 'bg-surface-primary border border-gray-600 shadow-lg',
    glass: 'bg-surface-primary backdrop-blur-md border border-gray-600/50 shadow-xl',
  };

  const paddings = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  return (
    <div
      className={clsx(
        baseClasses,
        variants[variant],
        paddings[padding],
        className
      )}
      ref={ref}
      {...props}
    >
      {children}
    </div>
  );
});

Card.displayName = 'Card';
export default Card;
```

### Input Component
```tsx
// components/ui/Input.tsx
import { clsx } from 'clsx';
import { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'filled';
}

const Input = forwardRef<HTMLInputElement, InputProps>(({
  className,
  label,
  error,
  icon,
  variant = 'default',
  ...props
}, ref) => {
  const inputClasses = clsx(
    'w-full px-4 py-2 rounded-lg border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2',
    {
      'bg-surface-primary border-gray-600 text-white placeholder-gray-400 focus:border-primary-500 focus:ring-primary-500': variant === 'default',
      'bg-background-medium border-transparent text-white placeholder-gray-500 focus:border-primary-500 focus:ring-primary-500': variant === 'filled',
      'border-danger-500 focus:border-danger-500 focus:ring-danger-500': error,
      'pl-10': icon,
    },
    className
  );

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-300 mb-2">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
            {icon}
          </div>
        )}
        <input
          className={inputClasses}
          ref={ref}
          {...props}
        />
      </div>
      {error && (
        <p className="mt-1 text-sm text-danger-500">{error}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';
export default Input;
```

---

## 6. **Dashboard Components**

### TrendFeed Component
```tsx
// components/dashboard/TrendFeed.tsx
import { SparklesIcon, TrendingUpIcon, FireIcon } from '@heroicons/react/24/outline';
import { clsx } from 'clsx';

interface Trend {
  id: string;
  title: string;
  summary: string;
  viralityScore: number;
  velocity: number;
  platforms: string[];
  region: string;
  createdAt: string;
}

interface TrendFeedProps {
  trends: Trend[];
  className?: string;
}

export default function TrendFeed({ trends, className }: TrendFeedProps) {
  return (
    <div className={clsx('bg-surface-primary rounded-xl p-6 shadow-lg border border-gray-700', className)}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="flex items-center gap-2 text-xl font-semibold text-white">
          <SparklesIcon className="h-6 w-6 text-accent-500" />
          Trending in South Africa
        </h2>
        <span className="text-sm text-gray-400">
          {trends.length} active trends
        </span>
      </div>

      <div className="space-y-4">
        {trends.map((trend, index) => (
          <div
            key={trend.id}
            className={clsx(
              'p-4 rounded-lg border transition-all duration-200 hover:bg-surface-secondary cursor-pointer',
              index === 0 && 'border-accent-500/30 bg-surface-secondary/50',
              'border-gray-700'
            )}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <h3 className="text-white font-medium text-lg mb-1 line-clamp-2">
                  {trend.title}
                </h3>
                <p className="text-gray-400 text-sm line-clamp-2">
                  {trend.summary}
                </p>
              </div>
              <div className="ml-4 flex flex-col items-end gap-2">
                <div className="flex items-center gap-1">
                  {trend.viralityScore > 80 ? (
                    <FireIcon className="h-4 w-4 text-success-500" />
                  ) : (
                    <TrendingUpIcon className="h-4 w-4 text-accent-500" />
                  )}
                  <span
                    className={clsx(
                      'text-sm font-bold',
                      trend.viralityScore > 80 ? 'text-success-500' : 'text-accent-500'
                    )}
                  >
                    {trend.viralityScore.toFixed(1)}
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  {trend.region}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-gray-500">
              <div className="flex items-center gap-4">
                <span>Velocity: {trend.velocity.toFixed(1)}</span>
                <span>{trend.platforms.join(', ')}</span>
              </div>
              <span>
                {new Date(trend.createdAt).toLocaleTimeString()}
              </span>
            </div>
          </div>
        ))}
      </div>

      {trends.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          <SparklesIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No trending topics at the moment</p>
        </div>
      )}
    </div>
  );
}
```

### MarketCard Component
```tsx
// components/dashboard/MarketCard.tsx
import { ClockIcon, TrendingUpIcon, TrendingDownIcon } from '@heroicons/react/24/outline';
import { clsx } from 'clsx';

interface MarketCardProps {
  market: {
    id: string;
    question: string;
    status: 'OPEN' | 'CLOSED' | 'SETTLED';
    oddsYes: number;
    oddsNo: number;
    volume: number;
    closesAt: string;
    category: string;
  };
  className?: string;
}

export default function MarketCard({ market, className }: MarketCardProps) {
  const isClosingSoon = new Date(market.closesAt).getTime() - Date.now() < 3600000; // 1 hour

  return (
    <div className={clsx('bg-surface-primary rounded-xl p-6 border border-gray-700 hover:border-primary-500/50 transition-all duration-200', className)}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-accent-500/20 text-accent-500 mb-2">
            {market.category}
          </span>
          <h3 className="text-white font-medium text-lg mb-2">
            {market.question}
          </h3>
        </div>
        <div className={clsx(
          'px-3 py-1 rounded-full text-xs font-medium',
          market.status === 'OPEN' ? 'bg-success-500/20 text-success-500' :
          market.status === 'CLOSED' ? 'bg-warning-500/20 text-warning-500' :
          'bg-neutral-500/20 text-neutral-500'
        )}>
          {market.status}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="text-center p-3 rounded-lg bg-background-medium border border-gray-700">
          <div className="flex items-center justify-center gap-1 mb-1">
            <TrendingUpIcon className="h-4 w-4 text-success-500" />
            <span className="text-xs text-gray-400">YES</span>
          </div>
          <div className="text-lg font-bold text-success-500">
            {market.oddsYes.toFixed(2)}
          </div>
        </div>
        <div className="text-center p-3 rounded-lg bg-background-medium border border-gray-700">
          <div className="flex items-center justify-center gap-1 mb-1">
            <TrendingDownIcon className="h-4 w-4 text-danger-500" />
            <span className="text-xs text-gray-400">NO</span>
          </div>
          <div className="text-lg font-bold text-danger-500">
            {market.oddsNo.toFixed(2)}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-400">
        <div className="flex items-center gap-1">
          <ClockIcon className="h-4 w-4" />
          <span className={clsx(isClosingSoon && 'text-warning-500')}>
            {isClosingSoon ? 'Closes soon' : `Closes ${new Date(market.closesAt).toLocaleDateString()}`}
          </span>
        </div>
        <span>Volume: ${market.volume.toLocaleString()}</span>
      </div>
    </div>
  );
}
```

---

## 7. **Layout Components**

### DashboardLayout
```tsx
// components/layout/DashboardLayout.tsx
import { Outlet } from 'react-router-dom';
import SidebarNav from '../dashboard/SidebarNav';
import NotificationsPanel from '../dashboard/NotificationsPanel';
import ChatPanel from '../dashboard/ChatPanel';

export default function DashboardLayout() {
  return (
    <div className="min-h-screen bg-background-dark">
      <div className="flex">
        {/* Sidebar */}
        <SidebarNav />

        {/* Main Content */}
        <div className="flex-1 flex">
          <div className="flex-1 p-6">
            <Outlet />
          </div>

          {/* Side Panels */}
          <div className="w-80 space-y-4 p-4">
            <NotificationsPanel />
            <ChatPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
```

### SidebarNav
```tsx
// components/dashboard/SidebarNav.tsx
import {
  HomeIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
  ChatBubbleLeftRightIcon,
  Cog6ToothIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { NavLink, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';

const navigation = [
  { name: 'Overview', href: '/dashboard', icon: HomeIcon },
  { name: 'Markets', href: '/dashboard/markets', icon: ChartBarIcon },
  { name: 'Topics', href: '/dashboard/topics', icon: SparklesIcon },
  { name: 'Brokers', href: '/dashboard/brokers', icon: UserGroupIcon },
  { name: 'Wallet', href: '/dashboard/wallet', icon: CurrencyDollarIcon },
  { name: 'Chat', href: '/dashboard/chat', icon: ChatBubbleLeftRightIcon },
  { name: 'Settings', href: '/dashboard/settings', icon: Cog6ToothIcon },
];

export default function SidebarNav() {
  const location = useLocation();

  return (
    <div className="w-64 bg-surface-primary border-r border-gray-700 min-h-screen">
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-r from-primary-500 to-accent-500 rounded-lg flex items-center justify-center">
              <SparklesIcon className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">ViralFX</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <NavLink
                key={item.name}
                to={item.href}
                className={clsx(
                  'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-primary-500 text-white shadow-glow'
                    : 'text-gray-300 hover:text-white hover:bg-surface-secondary'
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </NavLink>
            );
          })}
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-gray-700">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-secondary">
            <div className="w-8 h-8 bg-accent-500 rounded-full flex items-center justify-center">
              <span className="text-sm font-bold text-background-dark">JD</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">John Doe</p>
              <p className="text-xs text-gray-400 truncate">Premium Trader</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## 8. **Chart Components**

### SentimentChart
```tsx
// components/charts/SentimentChart.tsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface SentimentData {
  time: string;
  sentiment: number;
  volume: number;
}

interface SentimentChartProps {
  data: SentimentData[];
  className?: string;
}

export default function SentimentChart({ data, className }: SentimentChartProps) {
  return (
    <div className={clsx('bg-surface-primary rounded-xl p-6 border border-gray-700', className)}>
      <h3 className="text-lg font-semibold text-white mb-4">Sentiment Analysis</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="time"
            stroke="#9CA3AF"
            tick={{ fill: '#9CA3AF', fontSize: 12 }}
          />
          <YAxis
            stroke="#9CA3AF"
            tick={{ fill: '#9CA3AF', fontSize: 12 }}
            domain={[-1, 1]}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1C1C22',
              border: '1px solid #374151',
              borderRadius: '8px',
              color: '#F3F4F6',
            }}
            labelStyle={{ color: '#9CA3AF' }}
          />
          <Line
            type="monotone"
            dataKey="sentiment"
            stroke="#10B981"
            strokeWidth={2}
            dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

---

## 9. **Styling Guidelines**

### Design Principles
* **Avoid TradingView palette** (dark navy + turquoise)
* **Prefer purple/gold contrasts** with minimal white space
* **Dark backgrounds** with high-contrast text
* **Animated chart highlights** (subtle pulses, not blinks)
* **Depth and shadows** for buttons and modals
* **Clean iconography** using Lucide or Heroicons with stroke-only style

### Accessibility
* Dark & light theme toggle
* Keyboard-navigable components
- ARIA labels and descriptions
* Focus indicators
- Screen reader support
- Color contrast ratios > 4.5:1

### Localization Support
```typescript
// types/localization.ts
export interface LocalizedText {
  en: string;
  af?: string;
  zu?: string;
  xh?: string;
}

export const useTranslation = () => {
  const [locale, setLocale] = useState<'en' | 'af' | 'zu' | 'xh'>('en');

  const t = (key: string): string => {
    // Implementation for translation lookup
    return key;
  };

  return { t, locale, setLocale };
};
```

### Responsive Design
```css
/* Mobile-first approach */
/* xs: 475px */
/* sm: 640px */
/* md: 768px */
/* lg: 1024px */
/* xl: 1280px */
/* 2xl: 1536px */

/* Example mobile adjustments */
@media (max-width: 768px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
  }

  .sidebar-nav {
    transform: translateX(-100%);
    position: fixed;
    z-index: 50;
  }

  .sidebar-nav.open {
    transform: translateX(0);
  }
}
```

---

## 10. **Component Library Setup**

### Package.json additions
```json
{
  "dependencies": {
    "@headlessui/react": "^1.7.17",
    "@heroicons/react": "^2.0.18",
    "clsx": "^2.0.0",
    "tailwind-merge": "^1.14.0",
    "framer-motion": "^10.16.4",
    "recharts": "^2.8.0",
    "react-hot-toast": "^2.4.1",
    "lucide-react": "^0.294.0"
  },
  "devDependencies": {
    "@tailwindcss/forms": "^0.5.7",
    "@tailwindcss/typography": "^0.5.10",
    "@tailwindcss/aspect-ratio": "^0.4.2",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.31",
    "tailwindcss": "^3.3.5"
  }
}
```

### Utility Functions
```typescript
// utils/cn.ts
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// utils/format.ts
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
  }).format(amount);
};

export const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('en-ZA').format(num);
};

export const formatPercentage = (value: number): string => {
  return `${(value * 100).toFixed(1)}%`;
};
```

---

## ✅ **Next Steps for Implementation**

1. **Set up Tailwind CSS** with the provided configuration
2. **Create the UI component library** with the core components
3. **Implement the dashboard layout** with navigation and routing
4. **Build the chart components** using Recharts
5. **Add responsive design** for mobile devices
6. **Implement theme switching** (dark/light modes)
7. **Add localization support** for SA languages
8. **Create component documentation** with Storybook or similar

This UI kit blueprint provides a comprehensive foundation for building a consistent, accessible, and visually appealing ViralFX interface that stands out from traditional trading platforms.