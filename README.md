# ViralFX - Real-time Social Momentum Trading Platform

<div align="center">

![ViralFX Logo](Logo/viralfx_logo.png)

**South Africa's First Social Momentum Trading Platform**

Convert viral trends into tradable instruments using AI-powered intelligence.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![Python Version](https://img.shields.io/badge/python-%3E%3D3.9-blue)](https://www.python.org/)
[![Docker](https://img.shields.io/badge/docker-%3E%3D20.0-blue)](https://www.docker.com/)

[🚀 Quick Start](#-quick-start) • [📚 Documentation](#-documentation) • [🏗️ Architecture](#️-architecture) • [🔧 Development](#-development) • [📄 License](#-license)

</div>

## 🎯 Overview

**ViralFX** is a cutting-edge real-time trading platform that quantifies social momentum across topics (hashtags, celebrities, memes, trends) as tradable indices. Users can trade attention volatility with binary markets, range bets, and volatility derivatives - all powered by multimodal sentiment analysis, deception risk scoring, and a proprietary Viral Index.

### Key Features

- 🧠 **AI-Powered Analytics**: Real-time sentiment analysis and virality prediction
- 📈 **Social Momentum Trading**: Trade trends, hashtags, and celebrity social capital
- 🌍 **South African Focus**: ZAR-based with local payment methods
- 🔒 **Enterprise Security**: FSCA compliance, 2FA, and comprehensive audit trails
- 📱 **Modern UI**: React TypeScript with real-time WebSocket updates
- 🏛️ **VPMX Index**: Revolutionary Viral Popularity Market Index

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Python 3.9+
- Docker & Docker Compose
- PostgreSQL 15
- Redis 7

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/Thaminsibanyoni/Viralfx.git
cd Viralfx
```

2. **Set up environment variables**
```bash
# Backend environment
cp backend/.env.example backend/.env

# Frontend environment
cp frontend/.env.example frontend/.env
```

3. **Start with Docker (Recommended)**
```bash
# Start all services
docker-compose up -d

# Run database migrations
docker-compose exec backend npm run prisma:migrate

# Seed database
docker-compose exec backend npm run prisma:seed
```

4. **Access the application**
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **API Documentation**: http://localhost:3000/api/docs

## 📁 Project Structure

```
Viralfx/
├── backend/           # NestJS API server
├── frontend/          # React TypeScript web application
├── ml-services/       # Python ML services (AI/ML analysis)
├── blueprint/         # 📚 Complete documentation & architecture
├── docker-compose.yml # Development environment
└── README.md         # This file
```

## 🏗️ Architecture

### Backend (NestJS)
- ✅ RESTful API with comprehensive authentication
- ✅ WebSocket support for real-time updates
- ✅ TypeORM with PostgreSQL
- ✅ Redis for caching and job queues
- ✅ JWT authentication with 2FA
- ✅ Multi-currency system (ZAR, USD, EUR, BTC, ETH)
- ✅ FSCA-compliant payment integration

### Frontend (React)
- ✅ TypeScript with modern React patterns
- ✅ Zustand for state management
- ✅ Ant Design components with ViralFX branding
- ✅ Real-time WebSocket integration
- ✅ Multi-language support (15+ languages)
- ✅ Mobile-responsive design

### ML Services (Python)
- ✅ **Sentiment Analysis**: Real-time social media sentiment scoring
- ✅ **Virality Prediction**: Neural network models for trend forecasting
- ✅ **Deception Detection**: Advanced content authenticity analysis
- ✅ **Multi-Platform Ingestion**: Twitter, TikTok, Instagram, YouTube

## 🎯 Core Features

### 📈 VPMX (Viral Popularity Market Index)
Revolutionary 8-factor weighted index (0-1000 scale):
- Global Sentiment (20%)
- Viral Momentum (20%)
- Trend Velocity (15%)
- Mention Volume (15%)
- Engagement Quality (10%)
- Trend Stability (10%)
- Deception Risk (5%)
- Regional Weight (5%)

### 💰 Multi-Currency Trading
- **Primary Currency**: ZAR (South African Rand)
- **Supported Currencies**: USD, EUR, BTC, ETH
- **Payment Methods**: Paystack, PayFast, Ozow, EFT
- **Real-time Conversion**: Live exchange rate updates

### 🎨 User Interface
- **Settings Management**: Complete user preferences with 6 comprehensive tabs
- **Broker Dashboard**: Analytics and client management
- **Notification Center**: Real-time notification management
- **Global Internationalization**: 15+ languages, 8+ regions
- **Mobile Responsive**: Optimized for all devices

### 🔌 API Marketplace
Access ViralFX data through RESTful APIs:
- **Social Mood Index (SMI)**: Real-time social sentiment scores
- **VTS Symbol Feed**: Universal trend symbol data
- **ViralScore API**: Predictive virality metrics
- **Sentiment + Deception**: Advanced content analysis

## 📚 Documentation

Comprehensive documentation is available in the repository:

- **[📖 IMPLEMENTATION_BLUEPRINT.md](./IMPLEMENTATION_BLUEPRINT.md)** - Complete project documentation
- **[🚀 IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)** - Implementation status overview
- **[🔧 TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** - Common issues and solutions
- **[📊 SUPERADMIN_SYSTEM_BLUEPRINT.md](./SUPERADMIN_SYSTEM_BLUEPRINT.md)** - Admin system documentation
- **[🏛️ ORACLE_IMPLEMENTATION_STATUS.md](./ORACLE_IMPLEMENTATION_STATUS.md)** - Oracle system details

## 🔧 Development

### Backend Development
```bash
cd backend
npm install
npm run start:dev
```

### Frontend Development
```bash
cd frontend
npm install
npm run dev
```

### Database Management
```bash
cd backend
npx prisma migrate dev --name <migration-name>
npx prisma generate
npx prisma studio  # Database GUI
```

### Code Quality
```bash
# Backend linting
cd backend && npm run lint

# Frontend linting
cd frontend && npm run lint
```

## 🔒 Security Features

- HMAC-signed audit trails
- Deterministic market settlement
- Rate limiting and DDoS protection
- Encrypted data at rest and in transit
- Multi-factor authentication (2FA)
- FSCA compliance ready
- SOC 2 compliance ready

## 📊 Implementation Status

**✅ COMPLETE (November 2025)**

The ViralFX platform is fully implemented and production-ready with:

- ✅ Complete trading infrastructure
- ✅ VPMX (Viral Popularity Market Index) system
- ✅ Multi-currency support with ZAR focus
- ✅ AI/ML pipeline for trend intelligence
- ✅ Real-time WebSocket communication
- ✅ Advanced monitoring and performance tracking
- ✅ FSCA-compliant payment integrations
- ✅ Modern React/TypeScript frontend
- ✅ Comprehensive admin dashboard

## 🌍 Deployment

### Development (Docker Compose)
```bash
docker-compose up -d
```

### Production
See [IMPLEMENTATION_BLUEPRINT.md](./IMPLEMENTATION_BLUEPRINT.md) for detailed deployment instructions.

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- 📧 Email: support@viralfx.com
- 📖 Documentation: See `blueprint/` folder
- 🐛 Issues: [Create GitHub issue](https://github.com/Thaminsibanyoni/Viralfx/issues)

---

<div align="center">

**Built with ❤️ by the ViralFX Team**

*Where Social Momentum Becomes Tradable Intelligence* 🚀

</div>