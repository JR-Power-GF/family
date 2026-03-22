/**
 * Cache Manager - Multi-layer caching strategy
 *
 * Layers:
 * 1. Memory cache (fastest, session-scoped)
 * 2. Local storage cache (persistent across sessions)
 */

class CacheManager {
  constructor() {
    this.memoryCache = new Map()
    this.defaultTTL = 5 * 60 * 1000 // 5 minutes default TTL
    this.storagePrefix = 'family_cache_'
  }

  /**
   * Get from cache (checks memory first, then storage)
   * @param {string} key - Cache key
   * @returns {any|null} - Cached value or null
   */
  get(key) {
    // Check memory cache first
    const memEntry = this.memoryCache.get(key)
    if (memEntry && !this.isExpired(memEntry)) {
      // Move to end for LRU
      this.memoryCache.delete(key)
      this.memoryCache.set(key, memEntry)
      return memEntry.value
    }

    // Check local storage
    try {
      const storageKey = this.storagePrefix + key
      const stored = uni.getStorageSync(storageKey)
      if (stored) {
        const entry = JSON.parse(stored)
        if (!this.isExpired(entry)) {
          // Promote to memory cache
          this.memoryCache.set(key, entry)
          return entry.value
        } else {
          // Remove expired entry
          uni.removeStorageSync(storageKey)
        }
      }
    } catch (e) {
      console.error('Cache read error:', e)
    }

    return null
  }

  /**
   * Set cache value
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in ms (optional)
   */
  set(key, value, ttl = this.defaultTTL) {
    const entry = {
      value,
      expiresAt: Date.now() + ttl,
      cachedAt: Date.now()
    }

    // Set in memory cache
    this.memoryCache.set(key, entry)

    // Limit memory cache size
    if (this.memoryCache.size > 100) {
      const firstKey = this.memoryCache.keys().next().value
      this.memoryCache.delete(firstKey)
    }

    // Set in local storage
    try {
      const storageKey = this.storagePrefix + key
      uni.setStorageSync(storageKey, JSON.stringify(entry))
    } catch (e) {
      console.error('Cache write error:', e)
    }
  }

  /**
   * Check if cache entry is expired
   */
  isExpired(entry) {
    return entry.expiresAt && Date.now() > entry.expiresAt
  }

  /**
   * Delete from cache
   * @param {string} key - Cache key
   */
  delete(key) {
    this.memoryCache.delete(key)
    try {
      uni.removeStorageSync(this.storagePrefix + key)
    } catch (e) {
      // Ignore
    }
  }

  /**
   * Clear all cache
   */
  clear() {
    this.memoryCache.clear()
    try {
      const keys = uni.getStorageInfoSync().keys
      keys.forEach(key => {
        if (key.startsWith(this.storagePrefix)) {
          uni.removeStorageSync(key)
        }
      })
    } catch (e) {
      console.error('Cache clear error:', e)
    }
  }

  /**
   * Clear expired entries
   */
  clearExpired() {
    // Clear expired memory cache
    for (const [key, entry] of this.memoryCache.entries()) {
      if (this.isExpired(entry)) {
        this.memoryCache.delete(key)
      }
    }

    // Clear expired storage cache
    try {
      const keys = uni.getStorageInfoSync().keys
      keys.forEach(key => {
        if (key.startsWith(this.storagePrefix)) {
          try {
            const stored = uni.getStorageSync(key)
            if (stored) {
              const entry = JSON.parse(stored)
              if (this.isExpired(entry)) {
                uni.removeStorageSync(key)
              }
            }
          } catch (e) {
            // Invalid entry, remove it
            uni.removeStorageSync(key)
          }
        }
      })
    } catch (e) {
      console.error('Clear expired error:', e)
    }
  }

  /**
   * Get or fetch - returns cached value or fetches and caches
   * @param {string} key - Cache key
   * @param {Function} fetcher - Async function to fetch data if not cached
   * @param {number} ttl - Time to live in ms
   */
  async getOrFetch(key, fetcher, ttl = this.defaultTTL) {
    const cached = this.get(key)
    if (cached !== null) {
      return cached
    }

    const value = await fetcher()
    this.set(key, value, ttl)
    return value
  }
}

// Singleton instance
export const cacheManager = new CacheManager()

/**
 * Cache keys constants
 */
export const CacheKeys = {
  STORIES: 'stories_list',
  STORY: (id) => `story_${id}`,
  FAMILY_MEMBERS: 'family_members',
  USER_PROFILE: 'user_profile',
  COMMENTS: (storyId) => `comments_${storyId}`,
  LIKES: (storyId) => `likes_${storyId}`
}

/**
 * TTL constants
 */
export const CacheTTL = {
  SHORT: 1 * 60 * 1000,     // 1 minute
  MEDIUM: 5 * 60 * 1000,    // 5 minutes
  LONG: 30 * 60 * 1000,     // 30 minutes
  VERY_LONG: 24 * 60 * 60 * 1000 // 24 hours
}

/**
 * Composable for using cache in components
 */
export function useCache() {
  return {
    get: (key) => cacheManager.get(key),
    set: (key, value, ttl) => cacheManager.set(key, value, ttl),
    delete: (key) => cacheManager.delete(key),
    clear: () => cacheManager.clear(),
    clearExpired: () => cacheManager.clearExpired(),
    getOrFetch: (key, fetcher, ttl) => cacheManager.getOrFetch(key, fetcher, ttl)
  }
}
