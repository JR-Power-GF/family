// utils/offline.js
// Offline support utilities

const OFFLINE_QUEUE_KEY = 'offline_story_queue'

/**
 * Check if device is online
 */
export function isOnline() {
  return new Promise((resolve) => {
    uni.getNetworkType({
      success: (res) => {
        resolve(res.networkType !== 'none')
      },
      fail: () => {
        resolve(false)
      }
    })
  })
}

/**
 * Save story to offline queue
 */
export function saveToOfflineQueue(story) {
  const queue = getOfflineQueue()
  queue.push({
    ...story,
    queuedAt: Date.now()
  })
  try {
    uni.setStorageSync(OFFLINE_QUEUE_KEY, JSON.stringify(queue))
    return true
  } catch (e) {
    console.error('Failed to save offline queue:', e)
    return false
  }
}

/**
 * Get offline queue
 */
export function getOfflineQueue() {
  try {
    const data = uni.getStorageSync(OFFLINE_QUEUE_KEY)
    return data ? JSON.parse(data) : []
  } catch (e) {
    return []
  }
}

/**
 * Clear offline queue
 */
export function clearOfflineQueue() {
  try {
    uni.removeStorageSync(OFFLINE_QUEUE_KEY)
  } catch (e) {
    console.error('Failed to clear offline queue:', e)
  }
}

/**
 * Sync offline stories when online
 * @param {Function} uploadFn - Function to upload a story
 */
export async function syncOfflineStories(uploadFn) {
  const isOnlineNow = await isOnline()

  if (!isOnlineNow) {
    return { synced: 0, failed: 0 }
  }

  const queue = getOfflineQueue()

  if (queue.length === 0) {
    return { synced: 0, failed: 0 }
  }

  let synced = 0
  let failed = 0
  const remaining = []

  for (const story of queue) {
    try {
      await uploadFn(story)
      synced++
    } catch (e) {
      console.error('Failed to sync story:', e)
      failed++
      remaining.push(story)
    }
  }

  // Update queue with remaining items
  if (remaining.length > 0) {
    uni.setStorageSync(OFFLINE_QUEUE_KEY, JSON.stringify(remaining))
  } else {
    clearOfflineQueue()
  }

  return { synced, failed }
}
