# 💳 ViralFX Payment Gateway Setup Guide

## 📋 Overview

This guide explains how to configure payment gateways (PayFast and PayStack) for the ViralFX platform, enabling users to deposit funds into their wallets.

---

## 💰 **Minimum Deposit Amount: R1000**

The platform has been configured with a **minimum deposit of R1000** to ensure users have sufficient funds for active trading. This amount is enforced at both the backend and frontend levels.

### Where it's enforced:
- **Backend:** `DepositDto` validation and `DepositService` logic
- **Frontend:** DepositPage form validation

---

## 🇿🇦 **PayFast Setup (South Africa)**

PayFast is South Africa's leading payment gateway and is **recommended** for ZAR deposits.

### 1. Create PayFast Account

1. Visit: https://www.payfast.co.za/merchant/sign-up
2. Register as a merchant
3. Complete your business profile
4. Verify your email and bank account

### 2. Get Your Credentials

After registration, you'll receive:
- **Merchant ID** (e.g., `10000100`)
- **Merchant Key** (e.g., `yourf8key`)
- **Passphrase** (set in your PayFast dashboard)

### 3. Configure in `.env`

Update your `backend/.env` file:

```bash
# PayFast Configuration
PAYFAST_MERCHANT_ID=10000100
PAYFAST_MERCHANT_KEY=yourf8key
PAYFAST_PASSPHRASE=your_secure_passphrase
PAYFAST_TEST_MODE=true  # Set to false for production
```

### 4. Configure Callback URLs

In your PayFast dashboard, set these webhook URLs:

**For Development (Sandbox):**
```
Return URL: http://localhost:3000/api/v1/wallet/deposit/return
Cancel URL: http://localhost:3000/api/v1/wallet/deposit/cancel
Notify URL: http://localhost:3000/api/v1/payments/webhook/payfast
```

**For Production:**
```
Return URL: https://yourdomain.com/api/v1/wallet/deposit/return
Cancel URL: https://yourdomain.com/api/v1/wallet/deposit/cancel
Notify URL: https://yourdomain.com/api/v1/payments/webhook/payfast
```

### 5. Test Mode

PayFast provides a sandbox environment:
- **Sandbox URL:** https://sandbox.payfast.co.za
- **Test Credit Card:** Use test cards provided in PayFast docs
- **Test EFT:** Simulated EFT in sandbox

### Switch to Production:

```bash
PAYFAST_TEST_MODE=false
```

---

## 🌍 **PayStack Setup (Pan-African)**

PayStack supports multiple African countries including South Africa, Nigeria, Ghana, Kenya.

### 1. Create PayStack Account

1. Visit: https://paystack.co/
2. Click "Get Started"
3. Sign up as a business
4. Complete business verification

### 2. Get Your API Keys

After registration:
1. Go to **Settings** → **API Keys**
2. You'll see:
   - **Public Key** (for frontend)
   - **Secret Key** (for backend)

### 3. Configure in `.env`

Update your `backend/.env` file:

```bash
# PayStack Configuration
PAYSTACK_PUBLIC_KEY=pk_test_xxxxxxxxxxxx
PAYSTACK_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxx
PAYSTACK_BASE_URL=https://api.paystack.co
```

### 4. Configure Webhook

In PayStack dashboard:
1. Go to **Settings** → **Webhooks**
2. Add URL: `https://yourdomain.com/api/v1/payments/webhook/paystack`

### 5. Test Mode

PayStack provides test mode automatically with test keys:
- Test keys start with `pk_test_` and `sk_test_`
- Live keys start with `pk_live_` and `sk_live_`

### Switch to Production:

Replace test keys with live keys:
```bash
PAYSTACK_PUBLIC_KEY=pk_live_xxxxxxxxxxxxxxxx
PAYSTACK_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxx
```

---

## 🔧 **Backend Configuration**

### Wallet Deposit Flow

1. **User initiates deposit** via `POST /api/v1/wallet/deposit`
2. **Backend validates**:
   - Minimum amount (R1000)
   - Currency support
   - User authentication
3. **Create transaction** with status `PENDING`
4. **Process payment** through selected gateway
5. **Return checkout URL** to frontend
6. **Redirect user** to payment gateway
7. **Gateway processes** payment
8. **Webhook callback** from gateway
9. **Update transaction** status to `COMPLETED`
10. **Credit wallet** balance
11. **Notify user** of successful deposit

### API Endpoints

**Initiate Deposit:**
```bash
POST /api/v1/wallet/deposit
Authorization: Bearer {token}

{
  "amount": 1000,
  "currency": "ZAR",
  "gateway": "payfast"
}
```

**Response:**
```json
{
  "success": true,
  "transactionId": "tx_1234567890",
  "checkoutUrl": "https://www.payfast.co.za/eng/process?...",
  "reference": "PF_1234567890",
  "estimatedProcessingTime": "Instant"
}
```

---

## 🎨 **Frontend Integration**

### Deposit Page Location

```
frontend/src/pages/wallet/DepositPage.tsx
```

### Features

1. **Amount Selection**
   - Quick select buttons (R1000, R2500, R5000, etc.)
   - Custom amount input (min R1000)
   - Currency selection (ZAR default)

2. **Gateway Selection**
   - PayFast (Recommended)
   - PayStack
   - Ozow

3. **Security UI**
   - Secure payment badges
   - Payment gateway info
   - Minimum deposit notice
   - Help & support links

### Usage

Add to your routing:

```typescript
import DepositPage from './pages/wallet/DepositPage';

<Route path="/wallet/deposit" element={<DepositPage />} />
```

---

## ✅ **Testing Checklist**

### PayFast Testing

- [ ] Create PayFast sandbox account
- [ ] Configure sandbox credentials in `.env`
- [ ] Test minimum deposit (R1000)
- [ ] Test larger amount (R5000)
- [ ] Test declined payment
- [ ] Verify webhook receives notification
- [ ] Check wallet balance updated
- [ ] Test cancellation flow
- [ ] Verify transaction history

### PayStack Testing

- [ ] Create PayStack test account
- [ ] Configure test keys in `.env`
- [ ] Test minimum deposit (R1000)
- [ ] Test larger amount (R5000)
- [ ] Test card payment
- [ ] Verify webhook receives notification
- [ ] Check wallet balance updated
- [ ] Test failed payment
- [ ] Verify transaction history

### Integration Testing

- [ ] Test end-to-end deposit flow
- [ ] Verify minimum amount enforcement
- [ ] Test both gateways
- [ ] Verify wallet crediting
- [ ] Check email notifications
- [ ] Test concurrent deposits
- [ ] Verify transaction duplicates prevention

---

## 🐛 **Troubleshooting**

### Common Issues

#### 1. "Minimum deposit R1000" Error

**Solution:**
- Ensure deposit amount ≥ 1000
- Check both frontend validation and backend validation

#### 2. "Invalid webhook signature"

**Solution:**
- Verify passphrase in PayFast settings
- Check webhook URL matches exactly
- Ensure PAYFAST_PASSPHRASE matches dashboard

#### 3. "Payment gateway not responding"

**Solution:**
- Check API keys are correct
- Verify test mode is enabled
- Check network connectivity
- Review gateway logs

#### 4. "Wallet not credited after payment"

**Solution:**
- Check webhook logs in backend
- Verify transaction status in database
- Manually verify payment with gateway
- Check wallet service errors

#### 5. PayFast "Invalid Merchant"

**Solution:**
- Verify merchant ID and key
- Check test mode matches environment
- Ensure account is active

#### 6. PayStack "Invalid Secret Key"

**Solution:**
- Verify secret key matches dashboard
- Check for extra spaces in `.env`
- Ensure using test keys for test mode

---

## 📊 **Monitoring & Logs**

### Backend Logs

View deposit logs:
```bash
tail -f backend/logs/backend.log | grep -i "deposit"
```

### Key Log Messages

```
[DepositService] Initiating deposit of R1000 ZAR via payfast for user 123
[PaymentGatewayService] Processing payment through payfast
[DepositService] Deposit initiated successfully. Transaction ID: tx_123
[WebhookController] Received payfast webhook for reference PF_123
[LedgerService] Crediting wallet: R1000 to wallet_456
[DepositService] Deposit completed. Wallet balance updated
```

---

## 🔒 **Security Best Practices**

1. **Never commit** real API keys to git
2. **Use environment variables** for all credentials
3. **Enable test mode** during development
4. **Verify webhook signatures** from gateways
5. **Use HTTPS** in production
6. **Implement rate limiting** on deposit endpoints
7. **Log all transactions** for audit
8. **Monitor for fraud** patterns

---

## 💡 **Minimum Deposit Rationale**

**Why R1000?**

1. **Trading Viability:** Ensures users can make meaningful trades
2. **Fee Efficiency:** Minimizes impact of transaction fees
3. **Platform Sustainability:** Covers operational costs
4. **User Commitment:** Indicates serious traders
5. **Risk Management:** Reduces small transaction overhead

---

## 📞 **Support**

### Gateway Support

- **PayFast:** https://www.payfast.co.za/support
- **PayStack:** https://support.paystack.co/

### ViralFX Support

- Email: support@viralfx.co.za
- Phone: +27 XX XXX XXXX
- Live Chat: Available on platform

---

## ✨ **Next Steps**

1. ✅ Set up PayFast sandbox account
2. ✅ Set up PayStack test account
3. ✅ Configure credentials in `.env`
4. ✅ Test deposit flow with R1000
5. ✅ Verify wallet crediting
6. ✅ Test production mode
7. ✅ Monitor first live transactions
8. ✅ Set up alerts for failed payments

---

**Generated:** January 11, 2026
**Platform:** ViralFX Trading Platform
**Version:** 1.0.0
**Status:** ✅ Ready for Payment Integration

---

*Happy Trading! 💰*
