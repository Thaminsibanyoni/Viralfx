# ViralFX Platform Troubleshooting Guide

This guide addresses common issues that may arise during development and runtime of the ViralFX platform.

## 🚨 White Page on Frontend

### Symptom
- Frontend shows blank white page at http://localhost:5173/
- Browser console shows errors related to API initialization
- Error boundaries are triggered during app startup

### Root Cause
The backend is not running due to Prisma client being out of sync with the schema. When schema changes are made but `prisma generate` is not run, the backend fails to compile and start.

### Solution

#### Immediate Fix
1. **Regenerate Prisma Client**
   ```bash
   cd backend
   npm run prisma:generate
   ```

2. **Start Backend**
   ```bash
   npm run start:dev
   ```

3. **Verify Backend is Running**
   ```bash
   curl http://localhost:3000/health
   # Expected: {"status":"ok","timestamp":"..."}
   ```

4. **Refresh Frontend**
   - Open http://localhost:5173/ in browser
   - Check that the ViralFX application loads properly

#### Verification Steps
- Check backend logs for "Nest application successfully started on port 3000"
- Verify frontend console shows successful API calls
- Confirm no ErrorBoundary triggers on initial load

### Prevention
- Always run `npm run prisma:generate` after modifying `prisma/schema.prisma`
- Use the `prestart:dev` script (auto-generates Prisma client)
- Check backend startup logs for Prisma connection success

---

## 🔧 Prisma Schema Errors

### Common Errors
1. **Duplicate Fields**: `Error validating model "User": Ambiguous relation detected`
2. **Missing Types**: `ApiUsageRecord` not found (should be `ApiUsage`)
3. **Relation Mismatches**: Opposite relation fields missing

### Validation Commands
```bash
# Validate schema syntax
npm run prisma:validate

# Check for common issues
npm run prisma:generate --preview-feature
```

### Resolution Process
1. Fix schema syntax errors in `prisma/schema.prisma`
2. Run `npm run prisma:generate` to regenerate client
3. Run `npm run build` to check TypeScript compilation
4. Start backend to verify all issues resolved

---

## 🏗️ Backend Compilation Failures

### TypeScript Errors
```bash
# Check TypeScript compilation
npm run build

# Watch mode for continuous checking
npm run start:dev -- --inspect
```

### Common Issues
1. **Import Path Errors**: Verify all entity imports use correct paths
2. **Prisma Client Mismatch**: Ensure client is regenerated after schema changes
3. **Missing Dependencies**: Install missing packages with `npm install`

### Debugging Steps
1. Check compilation output for specific error messages
2. Verify `tsconfig.json` paths are correct
3. Ensure all `@prisma/client` types are up to date
4. Check environment variables in `.env` file

---

## 🌐 Frontend API Connection Issues

### Backend Not Reachable
```bash
# Test backend health
curl http://localhost:3000/health

# Test specific API endpoint
curl http://localhost:3000/api/v1/users/profile
```

### CORS Configuration
Verify CORS settings in `backend/src/main.ts`:
```typescript
app.enableCors({
  origin: ['http://localhost:5173'],
  credentials: true,
});
```

### Network Error Debugging
1. **Browser Console**: Check for network errors (ERR_CONNECTION_REFUSED)
2. **Network Tab**: Verify API requests are being made to correct URL
3. **Backend Logs**: Look for request logs showing incoming connections

---

## 🗄️ Database Connection Issues

### PostgreSQL Not Running
```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Start PostgreSQL if needed
docker-compose up -d postgres
```

### Connection String Verification
Check `.env` file:
```bash
DATABASE_URL=postgresql://username:password@localhost:5432/database_name
```

### Database Migration Issues
```bash
# Reset database (DESTRUCTIVE)
npm run prisma:migrate:reset

# Apply pending migrations
npm run prisma:migrate:deploy

# View migration status
npm run prisma:migrate:status
```

### Connection Testing
```bash
# Test database connection
npm run prisma:db:seed

# Open Prisma Studio to browse data
npm run prisma:studio
```

---

## 🔄 Development Workflow Recovery

### Complete Reset Procedure
1. **Backend Recovery**
   ```bash
   cd backend
   rm -rf node_modules
   npm install
   npm run prisma:generate
   npm run start:dev
   ```

2. **Frontend Recovery**
   ```bash
   cd frontend
   rm -rf node_modules
   npm install
   npm run dev
   ```

3. **Database Recovery**
   ```bash
   cd backend
   docker-compose down
   docker-compose up -d postgres
   npm run prisma:migrate:reset
   npm run prisma:db:seed
   ```

### Environment Sanity Check
```bash
# Verify all required services are running
docker-compose ps

# Check environment variables
cat backend/.env

# Test database connection
npm run prisma:db:pull
```

---

## 📊 Performance Issues

### Slow API Response Times
1. Check database query performance
2. Verify Redis is running for caching
3. Monitor memory usage in both frontend and backend

### Frontend Build Issues
```bash
# Clear build cache
rm -rf frontend/dist
rm -rf frontend/node_modules/.cache

# Rebuild
cd frontend
npm run build
```

---

## 🚨 Emergency Procedures

### Complete System Restart
```bash
# Stop all services
docker-compose down
pkill -f "npm run start:dev"
pkill -f "npm run dev"

# Restart in correct order
docker-compose up -d postgres
sleep 10
cd backend && npm run start:dev &
sleep 15
cd frontend && npm run dev &
```

### Backup and Restore
```bash
# Backup database
docker-compose exec postgres pg_dump viralfx > backup.sql

# Restore database
docker-compose exec -T postgres psql viralfx < backup.sql
```

---

## 📞 Getting Help

### Log Collection
When reporting issues, include:
1. Backend logs: `logs/backend.log`
2. Frontend console errors
3. Database connection status
4. Environment variables (without sensitive data)

### Useful Commands
```bash
# Check all logs
docker-compose logs

# Monitor real-time logs
docker-compose logs -f

# Check system resources
htop
df -h
docker stats
```

---

**Pro Tip**: Most white page issues are resolved by simply running `cd backend && npm run prisma:generate && npm run start:dev` and then refreshing the frontend.