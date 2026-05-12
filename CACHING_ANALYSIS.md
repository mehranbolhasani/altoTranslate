# Translation Caching System - Analysis & Options

## Current Flow
1. User selects text → Content script (`content.js`)
2. Content script sends message to background script (`background.js`)
3. Background script calls API (Gemini/OpenRouter/MyMemory)
4. Response sent back to content script
5. Content script displays translation

## Caching Possibilities

### Option 1: Simple Hash-Based Cache (Recommended)
**Storage:** `chrome.storage.local` (10MB recommended, 100MB max)

**Cache Key Structure:**
```
hash(text + sourceLanguage + targetLanguage + apiPreference)
```

**Pros:**
- Fast lookups (O(1) with hash)
- Persistent across extension restarts
- Can store metadata (timestamp, API used)
- Easy to implement

**Cons:**
- Storage space management needed
- Hash collisions (rare but possible)
- Need cache invalidation strategy

**Implementation:**
- Generate hash of text + languages + API preference
- Check cache before API call
- Store result with timestamp
- Implement TTL (Time To Live) expiration

---

### Option 2: In-Memory Cache (Fast but Limited)
**Storage:** JavaScript Map/Object in background script

**Pros:**
- Extremely fast (no I/O)
- No storage quota concerns
- Simple implementation

**Cons:**
- Lost on extension restart/reload
- Lost when background script unloads (service worker)
- Memory usage concerns for large texts
- Not persistent across sessions

**Best Use Case:**
- Short-term cache (same session)
- Combined with Option 1 for two-tier caching

---

### Option 3: Hybrid Approach (Best Performance)
**Storage:** In-memory cache + `chrome.storage.local` backup

**How it works:**
1. Check in-memory cache first (fastest)
2. If miss, check `chrome.storage.local` (medium speed)
3. If miss, call API and store in both caches

**Pros:**
- Best of both worlds
- Fast for repeated translations in same session
- Persistent for cross-session translations
- Can implement smart eviction

**Cons:**
- More complex implementation
- Need to sync both caches

---

## Cache Key Considerations

### What to Include in Cache Key:
1. **Text content** (normalized: trimmed, lowercase?)
2. **Source language** (important - "auto" vs specific)
3. **Target language** (critical)
4. **API preference** (optional - different APIs might give different results)

### What NOT to Include:
- Timestamp (part of cache entry, not key)
- API key (security risk, not needed)
- User ID (not applicable)

### Hash Function Options:
1. **Simple hash:** `text + sourceLang + targetLang + apiPref`
2. **SHA-256:** More robust, but slower
3. **Simple string concatenation:** Fastest, but longer keys

**Recommendation:** Use simple hash for speed (we're not dealing with security here)

---

## Cache Entry Structure

```javascript
{
  hash: "abc123...",
  translatedText: "Translated text here",
  sourceLanguage: "en",
  targetLanguage: "fa",
  api: "gemini",
  timestamp: 1234567890,
  textLength: 42
}
```

---

## Cache Management Strategies

### 1. Time-Based Expiration (TTL)
- Cache entries expire after X days/hours
- Default: 7 days (translations don't change often)
- User-configurable in settings

### 2. Size-Based Eviction (LRU - Least Recently Used)
- When cache approaches limit (e.g., 8MB of 10MB)
- Remove oldest/least used entries
- Keep most recent translations

### 3. Text Length Limits
- Don't cache very long texts (>1000 chars?) to save space
- Or cache with size limits per entry

### 4. Manual Cache Clear
- Option in settings to clear cache
- Useful if translations seem stale

---

## Storage Quota Considerations

**Chrome Storage Limits:**
- `chrome.storage.local`: 10MB recommended, 100MB max
- `chrome.storage.sync`: 100KB max (too small for cache)

**Estimate:**
- Average translation entry: ~500 bytes (text + metadata)
- 10MB = ~20,000 cached translations
- With LRU eviction, this should be plenty

**Storage Calculation:**
```
Entry size = text length + translated length + metadata (~100 bytes)
Example: "Hello" (5) + "سلام" (4) + metadata (100) = ~109 bytes
```

---

## Implementation Location

### Where to Implement Cache:
**Background Script (`background.js`)** - Best choice
- Centralized location
- Persists across page reloads
- Can use `chrome.storage.local`
- Single source of truth

### Cache Check Flow:
```
handleTranslation() {
  1. Generate cache key (hash)
  2. Check in-memory cache → return if found
  3. Check chrome.storage.local → return if found, load to memory
  4. Call API
  5. Store in both caches
  6. Return result
}
```

---

## Edge Cases & Considerations

### 1. Different APIs, Same Text
**Question:** Should "Hello" → "سلام" be cached per API or shared?

**Options:**
- **Per-API cache:** More accurate, different APIs might translate differently
- **Shared cache:** More space-efficient, assumes similar quality

**Recommendation:** Include API preference in cache key for accuracy

### 2. Auto-Detection
**Issue:** "auto" source language might detect differently each time

**Solution:** 
- Cache with detected language after first translation
- Or cache with "auto" and accept potential differences

### 3. Cache Invalidation
**When to invalidate:**
- User changes API preference
- User changes language settings (maybe)
- Manual clear
- TTL expiration

### 4. Privacy Concerns
**Considerations:**
- Translations stored locally (good for privacy)
- User might want to clear sensitive translations
- Add "Clear Cache" option in settings

---

## Performance Impact

### Expected Improvements:
- **First translation:** No change (API call still needed)
- **Cached translation:** ~1-5ms (vs 500-2000ms API call)
- **99%+ speed improvement for cached translations**

### Overhead:
- Hash generation: ~0.1-1ms
- Storage lookup: ~1-5ms
- Storage write: ~5-10ms (async, doesn't block)

**Net Result:** Significant speed improvement for repeated translations

---

## User Experience Enhancements

### 1. Visual Indicator
- Show "⚡ Cached" badge on cached translations
- Or show instant translation (no loading spinner)

### 2. Cache Statistics
- Show cache hit rate in settings
- Show cache size
- Show number of cached translations

### 3. Smart Caching
- Pre-cache common phrases?
- Cache on page load for common translations?

---

## Recommended Implementation Plan

### Phase 1: Basic Cache (MVP)
1. Implement hash-based cache key
2. Use `chrome.storage.local` for persistence
3. Check cache before API call
4. Store result after API call
5. Simple TTL (7 days)

### Phase 2: Optimization
1. Add in-memory cache layer
2. Implement LRU eviction
3. Add cache size monitoring
4. Add "Clear Cache" option

### Phase 3: Advanced Features
1. Cache statistics
2. User-configurable TTL
3. Per-API vs shared cache option
4. Cache hit rate tracking

---

## Code Structure Preview

```javascript
// Cache utilities
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_CACHE_SIZE = 8 * 1024 * 1024; // 8MB

function generateCacheKey(text, sourceLang, targetLang, apiPref) {
  return `${text}|${sourceLang}|${targetLang}|${apiPref}`;
}

async function getCachedTranslation(key) {
  // Check in-memory cache
  // Check chrome.storage.local
  // Return if found and not expired
}

async function setCachedTranslation(key, result) {
  // Store in-memory cache
  // Store in chrome.storage.local
  // Check size and evict if needed
}
```

---

## Questions to Decide

1. **TTL Duration:** 7 days? 30 days? User-configurable?
2. **Cache per API:** Yes (more accurate) or No (more efficient)?
3. **Text length limit:** Cache all texts or limit to <1000 chars?
4. **In-memory cache:** Implement from start or add later?
5. **Cache statistics:** Show to user or just for debugging?

---

## Recommendation Summary

**Best Approach:** Hybrid (Option 3)
- In-memory cache for session speed
- `chrome.storage.local` for persistence
- Hash-based keys with API preference included
- 7-day TTL with LRU eviction
- Text length limit: 5000 chars (same as API limit)
- Per-API caching for accuracy

**Implementation Priority:**
1. Start with simple `chrome.storage.local` cache
2. Add in-memory layer for performance
3. Add management features (clear, stats) later

