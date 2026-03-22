/**
 * Image Preloader - Preload images for better performance
 */

class ImagePreloader {
  constructor() {
    this.cache = new Map()
    this.maxCacheSize = 50 // Max cached images
  }

  /**
   * Preload images in the background
   * @param {string[]} urls - Array of image URLs to preload
   */
  async preload(urls) {
    if (!urls || urls.length === 0) return

    const promises = urls.map(url => this.loadImage(url))
    await Promise.allSettled(promises)
  }

  /**
   * Load a single image and cache it
   */
  async loadImage(url) {
    if (!url || this.cache.has(url)) {
      return this.cache.get(url)
    }

    // Convert cloud URLs
    if (url.startsWith('cloud://')) {
      try {
        const { fileList } = await wx.cloud.getTempFileURL({ fileList: [url] })
        const tempUrl = fileList[0]?.tempFileURL
        if (tempUrl) {
          this.addToCache(url, tempUrl)
          return tempUrl
        }
      } catch (e) {
        console.error('Failed to get temp URL:', e)
      }
      return url
    }

    // For http URLs, just cache the URL
    this.addToCache(url, url)
    return url
  }

  /**
   * Add to cache with LRU eviction
   */
  addToCache(key, value) {
    // Remove oldest if cache is full
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value
      this.cache.delete(firstKey)
    }

    this.cache.set(key, value)
  }

  /**
   * Get cached URL or fetch it
   */
  async get(url) {
    if (this.cache.has(url)) {
      // Move to end (most recently used)
      const value = this.cache.get(url)
      this.cache.delete(url)
      this.cache.set(url, value)
      return value
    }

    return await this.loadImage(url)
  }

  /**
   * Preload next N images from a story list
   */
  async preloadNextStories(stories, currentIndex, count = 3) {
    const urls = []

    for (let i = 1; i <= count && currentIndex + i < stories.length; i++) {
      const story = stories[currentIndex + i]
      if (story?.photoUrl) {
        urls.push(story.photoUrl)
      }
      if (story?.photoUrls) {
        urls.push(...story.photoUrls)
      }
    }

    if (urls.length > 0) {
      // Preload in background without blocking
      this.preload(urls).catch(e => console.error('Preload error:', e))
    }
  }
}

// Export singleton instance
export const imagePreloader = new ImagePreloader()

/**
 * Composable for using image preloader in components
 */
export function useImagePreloader() {
  return {
    preload: (urls) => imagePreloader.preload(urls),
    getImage: (url) => imagePreloader.get(url),
    preloadNextStories: (stories, currentIndex, count) =>
      imagePreloader.preloadNextStories(stories, currentIndex, count)
  }
}
