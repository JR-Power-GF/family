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

/**
 * Get pending stories formatted for timeline display
 * @returns {Array} Stories with isPending flag
 */
export function getPendingStories() {
  const queue = getOfflineQueue()
  return queue.map(item => ({
    _id: item.id,
    photoUrl: item.photoFiles[0]?.path || '',
    photoUrls: item.photoFiles.map(f => f.path),
    caption: item.caption,
    authorName: item.authorName,
    authorAvatar: item.authorAvatar,
    authorId: item.authorId,
    createdAt: item.queuedAt,
    isPending: true,
    syncStatus: item.status
  }))
}

/**
 * Update a specific queue item
 * @param {string} id - Queue item ID
 * @param {object} updates - Fields to update
 */
export function updateQueueItem(id, updates) {
  const queue = getOfflineQueue()
  const index = queue.findIndex(item => item.id === id)
  if (index !== -1) {
    queue[index] = { ...queue[index], ...updates }
    try {
      uni.setStorageSync(OFFLINE_QUEUE_KEY, JSON.stringify(queue))
    } catch (e) {
      console.error('Failed to update queue item:', e)
    }
  }
}

/**
 * Remove item from queue
 * @param {string} id - Queue item ID
 */
export function removeFromQueue(id) {
  const queue = getOfflineQueue()
  const filtered = queue.filter(item => item.id !== id)
  try {
    uni.setStorageSync(OFFLINE_QUEUE_KEY, JSON.stringify(filtered))
  } catch (e) {
    console.error('Failed to remove from queue:', e)
  }
}

/**
 * Recover stale items (app killed during sync)
 * Call on app launch
 */
export function recoverStaleItems() {
  const queue = getOfflineQueue()
  let hasChanges = false

  queue.forEach(item => {
    if (item.status === 'syncing') {
      // App was killed during sync, reset to pending
      item.status = 'pending'
      hasChanges = true
    }
  })

  if (hasChanges) {
    try {
      uni.setStorageSync(OFFLINE_QUEUE_KEY, JSON.stringify(queue))
    } catch (e) {
      console.error('Failed to recover stale items:', e)
    }
  }
}

/**
 * Save story to offline queue with full metadata
 * @param {object} options - Story data
 * @returns {string} Local story ID
 */
export function saveStoryToQueue({ photoFiles, caption, authorId, authorName, authorAvatar }) {
  const queue = getOfflineQueue()
  const id = `local_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`

  const newItem = {
    id,
    photoFiles: photoFiles.map(p => ({ path: p.path })),
    caption,
    authorId,
    authorName,
    authorAvatar,
    queuedAt: Date.now(),
    attempts: 0,
    lastAttemptAt: null,
    status: 'pending'
  }

  queue.push(newItem)

  try {
    uni.setStorageSync(OFFLINE_QUEUE_KEY, JSON.stringify(queue))
    return id
  } catch (e) {
    console.error('Failed to save to queue:', e)
    return null
  }
}
