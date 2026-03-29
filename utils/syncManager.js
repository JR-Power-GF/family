// utils/syncManager.js
// Sync orchestration for offline queue

import {
  getOfflineQueue,
  updateQueueItem,
  removeFromQueue
} from './offline.js'
import { getCompressedImage } from './image.js'
import { storiesApi } from '../api/index.js'

/**
 * Upload photos from queue item to cloud storage
 * @param {Array} photoFiles - Array of { path: string }
 * @returns {Promise<string[]>} Array of cloud fileIDs
 */
async function uploadQueuePhotos(photoFiles) {
  const uploadedUrls = []

  for (const photo of photoFiles) {
    // Compress (reuse existing logic)
    const compressed = await getCompressedImage(photo.path, {
      maxSizeKB: 500,
      quality: 80
    })

    // Upload to cloud
    const ext = compressed.ext || 'jpg'
    const cloudPath = `stories/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`

    const { fileID } = await wx.cloud.uploadFile({
      cloudPath,
      filePath: compressed.path
    })

    uploadedUrls.push(fileID)
  }

  return uploadedUrls
}

/**
 * Update timeline story status (via callback from index.vue)
 */
let timelineUpdateCallback = null

export function setTimelineUpdateCallback(callback) {
  timelineUpdateCallback = callback
}

function updateTimelineStory(id, updates) {
  if (timelineUpdateCallback) {
    timelineUpdateCallback(id, updates)
  }
}

/**
 * Show sync success feedback
 */
function showSyncSuccess(item) {
  updateTimelineStory(item.id, { syncStatus: 'success' })

  setTimeout(() => {
    updateTimelineStory(item.id, { isPending: false, syncStatus: null })
  }, 1500)

  uni.showToast({
    title: '故事已同步',
    icon: 'success'
  })
}

/**
 * Show sync failed feedback
 */
function showSyncFailed(item) {
  uni.showToast({
    title: `"${item.caption.slice(0, 15)}..." 同步失败`,
    icon: 'none',
    duration: 3000
  })

  updateTimelineStory(item.id, { syncStatus: 'failed' })
}

/**
 * Sync manager singleton
 */
export const syncManager = {
  isSyncing: false,

  /**
   * Sync all pending items
   */
  async syncAll() {
    if (this.isSyncing) {
      console.log('[SyncManager] Already syncing, skipping')
      return
    }

    const online = await this.checkOnline()
    if (!online) {
      console.log('[SyncManager] Offline, skipping sync')
      return
    }

    this.isSyncing = true
    console.log('[SyncManager] Starting sync')

    const queue = getOfflineQueue()
    console.log(`[SyncManager] Queue has ${queue.length} items`)

    for (const item of queue) {
      // Skip items that have failed 3+ times
      if (item.status === 'failed' && item.attempts >= 3) {
        console.log(`[SyncManager] Skipping failed item ${item.id}`)
        continue
      }

      await this.syncItem(item)
    }

    this.isSyncing = false
    console.log('[SyncManager] Sync complete')
  },

  /**
   * Sync a single item
   */
  async syncItem(item) {
    console.log(`[SyncManager] Syncing item ${item.id}`)

    updateQueueItem(item.id, { status: 'syncing' })
    updateTimelineStory(item.id, { syncStatus: 'syncing' })

    try {
      const photoUrls = await uploadQueuePhotos(item.photoFiles)

      const realStory = await storiesApi.createStoryFromQueue({
        photoUrls,
        caption: item.caption,
        authorId: item.authorId,
        authorName: item.authorName,
        authorAvatar: item.authorAvatar,
        queuedAt: item.queuedAt
      })

      removeFromQueue(item.id)

      if (timelineUpdateCallback) {
        timelineUpdateCallback(item.id, {
          replaceWithReal: true,
          realStory
        })
      }

      showSyncSuccess(item)
      console.log(`[SyncManager] Item ${item.id} synced successfully`)

    } catch (error) {
      console.error(`[SyncManager] Failed to sync ${item.id}:`, error)

      const newAttempts = item.attempts + 1
      const status = newAttempts >= 3 ? 'failed' : 'pending'

      updateQueueItem(item.id, {
        attempts: newAttempts,
        status,
        lastAttemptAt: Date.now()
      })

      updateTimelineStory(item.id, { syncStatus: status })

      if (status === 'failed') {
        showSyncFailed(item)
      }
    }
  },

  /**
   * Retry a specific failed item
   */
  async retryItem(id) {
    const queue = getOfflineQueue()
    const item = queue.find(i => i.id === id)

    if (!item) {
      console.error(`[SyncManager] Item ${id} not found`)
      return
    }

    updateQueueItem(id, { attempts: 0, status: 'pending' })
    item.attempts = 0
    item.status = 'pending'

    await this.syncItem(item)
  },

  /**
   * Check if device is online
   */
  async checkOnline() {
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
}

export default syncManager
