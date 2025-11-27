# Ingest System Verification Fixes - Implementation Summary

This document summarizes the comprehensive fixes implemented to address the verification comments for the ingest system connectors.

## 1. Facebook Connector - Removed Deprecated /search Endpoint Dependency

### Problem
- Facebook connector relied on deprecated `/search?type=page` endpoint for page discovery
- Dynamic page searching exposed the system to API changes, rate limits, and privacy restrictions
- Maintained deprecated dependency despite curated SA pages list

### Solution Implemented
1. **Hardcoded South African News Page IDs**
   - Replaced dynamic search with static mapping of verified Page IDs
   - Added 10 major SA news pages: News24, SABC News, eNCA, TimesLIVE, IOL, Cape Times, Mail & Guardian, Sunday Times, Carte Blanche, Power 987

2. **Page-Specific Access Tokens**
   - Implemented support for dedicated Page Access Tokens
   - Added fallback to app token with warnings
   - Stored page tokens from environment variables for enhanced reliability

3. **Redis-based Page Validation**
   - Added validation caching with 7-day TTL
   - Implemented `fetchPagePosts()` method with proper pagination support
   - Enhanced error handling and logging

4. **Pagination and Watermark Support**
   - Implemented per-page watermarks for incremental collection
   - Added cursor-based pagination with `after` parameter
   - Proper error resilience with retry logic

### Files Modified
- `src/modules/ingest/connectors/facebook.connector.ts`
- `backend/.env.example` (added page token configurations)

## 2. Pagination and Incremental Updates Across All Platforms

### Problem
- Only Twitter had `since_id` for incremental updates
- Instagram/TikTok/YouTube/Facebook lacked pagination/cursors
- Fixed windows caused duplicates and missed items
- No checkpointing for collection resilience

### Solution Implemented

#### Base Connector Enhancements
1. **Enhanced Checkpoint System**
   - `getCheckpoint()` / `setCheckpoint()` for arbitrary key-value storage
   - `getPageToken()` / `setPageToken()` for pagination cursor management
   - `getWatermark()` / `setWatermark()` for incremental timestamp tracking
   - Support for key-specific watermarks (e.g., per-page, per-hashtag)

#### Platform-Specific Implementations

**YouTube Connector**
- Added `pageToken` pagination for search and trending videos
- Implemented `publishedAfter` parameter for incremental collection
- Redis-based duplicate detection before API calls
- Proper quota management with pagination limits

**Instagram Connector**
- Added `after` cursor pagination for hashtag and user media
- Per-hashtag watermark tracking
- Carousel album handling improvements
- Fixed views metric to only apply to videos

**TikTok Connector**
- Implemented `cursor` advancement for hashtag and search
- Proper `has_more` flag handling
- Incremental collection with create_time filtering
- Enhanced error handling with collection error tracking

**Facebook Connector**
- Per-page cursor pagination with `paging.cursors.after`
- Page-specific watermarks for incremental updates
- Proper checkpointing for collection resilience

### Configuration Added
- `INGEST_MAX_PAGES` environment variable (default: 3) to limit pagination depth

### Files Modified
- `src/modules/ingest/connectors/base.connector.ts`
- `src/modules/ingest/connectors/youtube.connector.ts`
- `src/modules/ingest/connectors/instagram.connector.ts`
- `src/modules/ingest/connectors/tiktok.connector.ts`
- `src/modules/ingest/connectors/facebook.connector.ts`

## 3. Twitter Video Media Extraction and Metrics Mapping

### Problem
- Twitter videos used non-existent `.url` field for media
- `impression_count` defaulted to `undefined` causing NaN in calculations
- Inconsistent metrics fallbacks across platforms
- No validation of metrics values

### Solution Implemented

#### Video Media URL Extraction
1. **Proper Variant Selection**
   - For videos: Select highest bitrate MP4 variant
   - For GIFs: Select smallest MP4 variant
   - Added comprehensive logging for missing variants
   - Fallback handling for videos without variants

2. **Enhanced API Request**
   - Added `variants` field to Twitter API media request
   - Proper thumbnail extraction from `preview_image_url`

#### Metrics Standardization
1. **Consistent Fallbacks**
   - Changed `impression_count || undefined` to `impression_count || 0`
   - Standardized all metrics to use 0 as fallback
   - Prevents NaN values in engagement calculations

2. **Metrics Validation**
   - Added `validateMetrics()` method to BaseConnector
   - Enhanced `validateContent()` in processor to check metrics
   - Type checking and NaN prevention for all metric fields

3. **Platform-Specific Fixes**
   - Instagram: Views only applied to VIDEO media type
   - Facebook: Proper reactions mapping from `reactions.data` array
   - All platforms: Consistent 0 fallbacks for optional metrics

### Files Modified
- `src/modules/ingest/connectors/twitter.connector.ts`
- `src/modules/ingest/connectors/base.connector.ts`
- `src/modules/ingest/connectors/instagram.connector.ts`
- `src/modules/ingest/connectors/facebook.connector.ts`
- `src/modules/ingest/processors/ingest.processor.ts`

## 4. Additional Improvements

### Error Handling and Monitoring
- Enhanced collection error tracking with `addCollectionError()`
- Proper logging for pagination failures and token issues
- Rate limit respect across all platforms

### Performance Optimizations
- Redis-based duplicate detection before expensive API calls
- Batch processing for existence checks
- Efficient pagination with configurable limits

### Configuration Documentation
- Updated `.env.example` with all new configuration options
- Added comments for Facebook page tokens and pagination settings
- Documented rate limiting and collection parameters

## Testing Recommendations

1. **Facebook Connector**
   - Test with page-specific tokens for reliable access
   - Verify pagination works with multiple pages
   - Check watermark advancement across runs

2. **Pagination Testing**
   - Run collection twice to verify no duplicates
   - Test with content that spans multiple pages
   - Verify checkpoint recovery after failures

3. **Twitter Video Testing**
   - Test with tweets containing videos and GIFs
   - Verify media URLs are valid and accessible
   - Check engagement calculations don't produce NaN

4. **Metrics Validation**
   - Test with content missing optional fields
   - Verify all metrics are valid numbers
   - Check engagement score calculations

## Migration Notes

1. **Environment Variables**
   - Add Facebook page tokens to your environment
   - Set `INGEST_MAX_PAGES` to control pagination depth
   - Verify all platform tokens are valid

2. **Redis Keys**
   - Existing checkpoints will be upgraded automatically
   - New key structure: `ingest:checkpoint:{platform}:{key}`
   - Watermark keys: `ingest:checkpoint:{platform}:watermark:{source}`

3. **Collection Behavior**
   - First run after upgrade may fetch more content due to watermark initialization
   - Subsequent runs will be incremental and more efficient
   - Monitor collection logs for pagination activity

These fixes provide a robust, deprecation-proof ingest system with proper pagination, incremental updates, and reliable media extraction across all supported platforms.