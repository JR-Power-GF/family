# Offline Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable story posting while offline with automatic sync when network reconnects.

**Architecture:** Local storage queue holds pending stories. On post, check network; if offline, save to queue and show in timeline with pending badge. Sync manager auto-uploads when online. Offline banner becomes tappable to show pending list modal.

**Tech Stack:** Vue 3 Composition API, WeChat Cloud, uni-app local storage

---

## File Structure

```
utils/
├── offline.js          [MODIFY] Add getPendingStories, updateQueueItem, removeFromQueue, recoverStaleItems
├── syncManager.js      [CREATE] Sync orchestration - upload photos, create story, update status
└── image.js            [EXISTING] Compression utilities (reuse)

components/
├── StoryCard.vue       [MODIFY] Add syncStatus prop, pending/syncing/failed badge overlay
├── OfflineBanner.vue   [MODIFY] Add @click to open pending modal, emit event
└── PendingListModal.vue [CREATE] List pending items, retry, cancel

pages/
├── add-story/add-story.vue  [MODIFY] Fix MAX_PHOTOS, add offline check, queue save
├── index/index.vue          [MODIFY] Merge pending stories into timeline, trigger sync
└── story-detail/story-detail.vue [MODIFY] Handle pending story view

api/
└── index.js            [MODIFY] Add createStoryFromQueue function

App.vue                 [MODIFY] Add network status listener for auto-sync
```

---

## Task 1: Fix MAX_PHOTOS Bug in add-story.vue

**Files:**
- Modify: `pages/add-story/add-story.vue`

- [ ] **Step 1: Add MAX_PHOTOS constant and fix string template**

Find line 82-83 in `pages/add-story/add-story.vue`:
```javascript
const MAX_PHOTOS = MAX_PHOTOS
```

Replace with:
```javascript
const MAX_PHOTOS = 9  // 3×3 grid, common pattern for photo pickers
```

- [ ] **Step 2: Fix string template bugs**

Find and replace these string templates:

Line 28:
```javascript
<text class="add-count">{{ photoPaths.length }}/MAX_PHOTOS</text>
```
Replace with:
```javascript
<text class="add-count">{{ photoPaths.length }}/{{ MAX_PHOTOS }}</text>
```

Line 129-133:
```javascript
  if (photoPaths.value.length >= MAX_PHOTOS) {
    uni.showToast({
      title: '最多只能添加MAX_PHOTOS张照片',
```
Replace with:
```javascript
  if (photoPaths.value.length >= MAX_PHOTOS) {
    uni.showToast({
      title: `最多只能添加${MAX_PHOTOS}张照片`,
```

Line 337:
```javascript
  height: MAX_PHOTOS6rpx;
```
Replace with:
```javascript
  height: 86rpx;
```

- [ ] **Step 3: Commit bug fix**

```bash
git add pages/add-story/add-story.vue
git commit -m "fix(add-story): define MAX_PHOTOS constant, fix string templates"
```

---

## Task 2: Enhance utils/offline.js

**Files:**
- Modify: `utils/offline.js`

- [ ] **Step 1: Add new helper functions**

Append to end of `utils/offline.js`:

```javascript
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
```

- [ ] **Step 2: Commit offline utils**

```bash
git add utils/offline.js
git commit -m "feat(offline): add queue management helpers for pending stories"
```

---

## Task 3: Create utils/syncManager.js

**Files:**
- Create: `utils/syncManager.js`

- [ ] **Step 1: Create sync manager module**

```javascript
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
 * Update timeline story status (via event bus or direct callback)
 * This is a placeholder - actual implementation uses callbacks from index.vue
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
  // Update to success state briefly
  updateTimelineStory(item.id, { syncStatus: 'success' })

  // Then remove pending flag
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

    // Update status to syncing
    updateQueueItem(item.id, { status: 'syncing' })
    updateTimelineStory(item.id, { syncStatus: 'syncing' })

    try {
      // Upload photos
      const photoUrls = await uploadQueuePhotos(item.photoFiles)

      // Create story in database
      const realStory = await storiesApi.createStoryFromQueue({
        photoUrls,
        caption: item.caption,
        authorId: item.authorId,
        authorName: item.authorName,
        authorAvatar: item.authorAvatar,
        queuedAt: item.queuedAt
      })

      // Success: remove from queue
      removeFromQueue(item.id)

      // Update timeline with real story
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

    // Reset attempts for manual retry
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
```

- [ ] **Step 2: Commit sync manager**

```bash
git add utils/syncManager.js
git commit -m "feat(sync): add sync manager for offline queue"
```

---

## Task 4: Add createStoryFromQueue to api/index.js

**Files:**
- Modify: `api/index.js`

- [ ] **Step 1: Add createStoryFromQueue function**

Find the `storiesApi` object in `api/index.js`. After the `createStory` function (around line 178), add:

```javascript
  /**
   * Create a story from offline queue (with pre-uploaded URLs)
   * Preserves original queued timestamp
   */
  async createStoryFromQueue({ photoUrls, caption, authorId, authorName, authorAvatar, queuedAt }) {
    const { _id } = await db.collection('stories').add({
      data: {
        photoUrls,
        photoUrl: photoUrls[0],
        caption,
        authorId,
        authorName,
        authorAvatar,
        createdAt: new Date(queuedAt),  // Preserve original timestamp
        syncedAt: db.serverDate()
      }
    })

    // Invalidate cache
    cacheManager.delete(CacheKeys.STORIES)

    // Return the created story
    return await this.getStory(_id, true)
  },
```

- [ ] **Step 2: Commit API addition**

```bash
git add api/index.js
git commit -m "feat(api): add createStoryFromQueue for offline sync"
```

---

## Task 5: Update App.vue with Network Listener

**Files:**
- Modify: `App.vue`

- [ ] **Step 1: Convert to script setup and add network listener**

Replace entire `App.vue` with:

```vue
<script setup>
import { cacheManager } from './utils/cache.js'
import { recoverStaleItems } from './utils/offline.js'
import { syncManager } from './utils/syncManager.js'

// App launch
onLaunch(() => {
  console.log('App Launch')

  // Initialize WeChat Cloud
  if (wx.cloud) {
    wx.cloud.init({
      env: 'cloud1-6geq4sla3d88052d',
      traceUser: true
    })
    console.log('WeChat Cloud initialized')
  }

  // Clear expired cache entries
  cacheManager.clearExpired()

  // Recover stale items (app killed during sync)
  recoverStaleItems()

  // Trigger initial sync if online
  syncManager.syncAll()
})

// Network status change listener
onShow(() => {
  console.log('App Show')
})

onHide(() => {
  console.log('App Hide')
})

// Listen for network changes globally
onLaunch(() => {
  uni.onNetworkStatusChange((res) => {
    console.log(`[Network] ${res.isConnected ? 'Connected' : 'Disconnected'}`)

    if (res.isConnected) {
      // Network restored - trigger sync
      syncManager.syncAll()
    }
  })
})
</script>

<style lang="scss">
@import './styles/tokens.scss';

/* Global styles */
page {
  background-color: $uni-bg-color-grey;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
</style>
```

Wait - `onLaunch` is called twice. Let me fix that:

```vue
<script setup>
import { cacheManager } from './utils/cache.js'
import { recoverStaleItems } from './utils/offline.js'
import { syncManager } from './utils/syncManager.js'

onLaunch(() => {
  console.log('App Launch')

  // Initialize WeChat Cloud
  if (wx.cloud) {
    wx.cloud.init({
      env: 'cloud1-6geq4sla3d88052d',
      traceUser: true
    })
    console.log('WeChat Cloud initialized')
  }

  // Clear expired cache entries
  cacheManager.clearExpired()

  // Recover stale items (app killed during sync)
  recoverStaleItems()

  // Listen for network changes
  uni.onNetworkStatusChange((res) => {
    console.log(`[Network] ${res.isConnected ? 'Connected' : 'Disconnected'}`)

    if (res.isConnected) {
      syncManager.syncAll()
    }
  })

  // Trigger initial sync if online
  syncManager.syncAll()
})

onShow(() => {
  console.log('App Show')
})

onHide(() => {
  console.log('App Hide')
})
</script>

<style lang="scss">
@import './styles/tokens.scss';

/* Global styles */
page {
  background-color: $uni-bg-color-grey;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
</style>
```

- [ ] **Step 2: Commit App.vue changes**

```bash
git add App.vue
git commit -m "feat(app): add network listener for auto-sync, recover stale items"
```

---

## Task 6: Update add-story.vue with Offline Queue Logic

**Files:**
- Modify: `pages/add-story/add-story.vue`

- [ ] **Step 1: Import offline utilities**

At the top of the `<script setup>` section (after line 77), add imports:

```javascript
import { ref, computed } from 'vue'
import { storiesApi } from '../../api/index.js'
import { getCompressedImage } from '../../utils/image.js'
import { isOnline, saveStoryToQueue, getPendingStories } from '../../utils/offline.js'

const MAX_PHOTOS = 9  // 3×3 grid, common pattern for photo pickers
```

- [ ] **Step 2: Modify postStory function to check network**

Replace the `postStory` function (starting around line 159) with:

```javascript
async function postStory() {
  if (!canPost.value || posting.value) return

  posting.value = true
  uploadProgress.value = 0
  uploadedCount.value = 0

  try {
    // Check if online
    const online = await isOnline()

    if (!online) {
      // OFFLINE: Save to queue
      await postOffline()
      return
    }

    // ONLINE: Normal upload flow
    await postOnline()

  } catch (error) {
    uni.hideLoading()
    console.error('Failed to post story:', error)

    let errorMsg = '发布失败，请重试'
    if (error.errMsg?.includes('network')) {
      errorMsg = '网络错误，请检查网络连接'
    } else if (error.errMsg?.includes('upload')) {
      errorMsg = '图片上传失败，请重试'
    }

    uni.showToast({
      title: errorMsg,
      icon: 'none',
      duration: 2500
    })
    uploadProgress.value = 0
  } finally {
    posting.value = false
  }
}

// Online posting flow (existing logic)
async function postOnline() {
  const totalPhotos = photoPaths.value.length

  // Compress all photos first
  const compressedPhotos = []
  for (let i = 0; i < totalPhotos; i++) {
    uploadProgress.value = Math.floor((i / totalPhotos) * 20)
    uni.showLoading({ title: `压缩图片 ${i + 1}/${totalPhotos}...`, mask: true })

    const compressed = await getCompressedImage(photoPaths.value[i], {
      maxSizeKB: 500,
      quality: 80
    })
    compressedPhotos.push({ path: compressed.path })
  }
  uni.hideLoading()

  // Upload all photos and create story
  uploadProgress.value = 20

  await storiesApi.createStory({
    photoFiles: compressedPhotos,
    caption: caption.value.trim()
  }, (progress) => {
    // Upload progress (20-100%)
    uploadProgress.value = 20 + Math.floor(progress * 0.8)
    uploadedCount.value = Math.ceil((progress / 100) * totalPhotos)
  })

  uploadProgress.value = 100
  uploadedCount.value = totalPhotos

  // Show success
  uni.showToast({
    title: '发布成功！',
    icon: 'success',
    duration: 1500
  })

  // Navigate back
  setTimeout(() => {
    uni.navigateBack()
  }, 500)
}

// Offline posting flow
async function postOffline() {
  // Get user info for story metadata
  const { result: userInfo } = await wx.cloud.callFunction({
    name: 'getUserInfo'
  }).catch(() => ({
    result: {
      openid: 'anonymous',
      nickName: '匿名用户',
      avatarUrl: ''
    }
  }))

  // Compress photos for local storage
  const compressedPhotos = []
  for (let i = 0; i < photoPaths.value.length; i++) {
    const compressed = await getCompressedImage(photoPaths.value[i], {
      maxSizeKB: 500,
      quality: 80
    })
    compressedPhotos.push({ path: compressed.path })
  }

  // Save to offline queue
  const localId = saveStoryToQueue({
    photoFiles: compressedPhotos,
    caption: caption.value.trim(),
    authorId: userInfo.openid,
    authorName: userInfo.nickName || '匿名用户',
    authorAvatar: userInfo.avatarUrl || ''
  })

  if (!localId) {
    throw new Error('Failed to save to offline queue')
  }

  // Show success toast
  uni.showToast({
    title: '已保存，联网后自动同步',
    icon: 'none',
    duration: 2000
  })

  // Navigate back (index page will show pending story)
  setTimeout(() => {
    uni.navigateBack()
  }, 500)
}
```

- [ ] **Step 3: Commit add-story changes**

```bash
git add pages/add-story/add-story.vue
git commit -m "feat(add-story): add offline queue support, split post flow"
```

---

## Task 7: Update StoryCard.vue with Sync Status Badge

**Files:**
- Modify: `components/StoryCard.vue`

- [ ] **Step 1: Add syncStatus prop and computed properties**

Add to props after `story` prop:

```javascript
const props = defineProps({
  story: {
    type: Object,
    required: true
  },
  syncStatus: {
    type: String,
    default: null,
    validator: (val) => [null, 'pending', 'syncing', 'failed', 'success'].includes(val)
  }
})

const emit = defineEmits(['tap', 'imageTap', 'retrySync'])
```

Add computed for status display:

```javascript
// Sync status display
const syncStatusText = computed(() => {
  switch (props.syncStatus) {
    case 'pending': return '⏳ 等待同步'
    case 'syncing': return '⟳ 同步中...'
    case 'failed': return '⚠️ 点击重试'
    case 'success': return '✓ 已同步'
    default: return null
  }
})

const isSyncing = computed(() => props.syncStatus === 'syncing')
const canRetry = computed(() => props.syncStatus === 'failed')
```

- [ ] **Step 2: Add badge overlay to template**

Inside `<view class="photo-container">`, after the `<image>` tag, add:

```vue
<!-- Sync status badge overlay -->
<view
  v-if="syncStatus"
  class="sync-badge"
  :class="syncStatus"
  @click.stop="handleSyncBadgeTap"
>
  <text>{{ syncStatusText }}</text>
</view>
```

- [ ] **Step 3: Add handleSyncBadgeTap function**

Add to script:

```javascript
function handleSyncBadgeTap() {
  if (canRetry.value) {
    emit('retrySync', props.story)
  }
}
```

- [ ] **Step 4: Add badge styles**

Add to `<style>` section:

```scss
.sync-badge {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;

  text {
    color: #fff;
    font-size: 28rpx;
    padding: 16rpx 32rpx;
    background-color: rgba(0, 0, 0, 0.6);
    border-radius: 24rpx;
  }

  &.syncing {
    animation: pulse 1.5s infinite;
  }

  &.failed {
    cursor: pointer;

    &:active {
      opacity: 0.8;
    }
  }

  &.success {
    background-color: rgba(76, 217, 100, 0.3);
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}
```

- [ ] **Step 5: Commit StoryCard changes**

```bash
git add components/StoryCard.vue
git commit -m "feat(story-card): add sync status badge overlay with retry support"
```

---

## Task 8: Update OfflineBanner.vue to be Tappable

**Files:**
- Modify: `components/OfflineBanner.vue`

- [ ] **Step 1: Add tap handler and emit**

Update the template:

```vue
<template>
  <view v-if="!isOnline" class="offline-banner" @click="handleTap">
    <text class="offline-icon">⚠️</text>
    <text class="offline-text">离线中 — 联网后故事会自动同步</text>
    <text v-if="queueCount > 0" class="queue-count">({{ queueCount }}条待同步)</text>
    <text v-if="queueCount > 0" class="tap-hint">点击查看</text>
  </view>
</template>
```

Add emit:

```javascript
const emit = defineEmits(['tap'])

function handleTap() {
  emit('tap', { queueCount: queueCount.value })
}
```

- [ ] **Step 2: Add tap hint styles**

Add to styles:

```scss
.offline-banner {
  background-color: #fff3cd;
  padding: 20rpx 32rpx;
  display: flex;
  align-items: center;

  &:active {
    background-color: #ffe69c;
  }
}

.tap-hint {
  margin-left: auto;
  font-size: 24rpx;
  color: #856404;
  opacity: 0.8;
}
```

- [ ] **Step 3: Commit OfflineBanner changes**

```bash
git add components/OfflineBanner.vue
git commit -m "feat(offline-banner): make tappable, emit tap event for pending modal"
```

---

## Task 9: Create PendingListModal.vue

**Files:**
- Create: `components/PendingListModal.vue`

- [ ] **Step 1: Create the modal component**

```vue
<template>
  <view v-if="visible" class="modal-overlay" @click="handleOverlayTap">
    <view class="modal-content" @click.stop>
      <!-- Header -->
      <view class="modal-header">
        <text class="modal-title">待同步 ({{ pendingItems.length }})</text>
        <view class="close-btn" @click="handleClose">
          <text>×</text>
        </view>
      </view>

      <!-- List -->
      <scroll-view scroll-y class="modal-body">
        <view v-if="pendingItems.length === 0" class="empty-state">
          <text class="empty-text">没有待同步的故事</text>
        </view>

        <view
          v-for="item in pendingItems"
          :key="item.id"
          class="pending-item"
        >
          <image
            class="item-thumb"
            :src="item.photoFiles[0]?.path || '/static/default-photo.svg'"
            mode="aspectFill"
          />
          <view class="item-info">
            <text class="item-caption">{{ item.caption }}</text>
            <text class="item-status" :class="item.status">
              {{ statusText(item.status) }}
            </text>
          </view>
          <view class="item-actions">
            <view
              v-if="item.status === 'failed'"
              class="retry-btn"
              @click="handleRetry(item)"
            >
              <text>重试</text>
            </view>
            <view
              class="cancel-btn"
              @click="handleCancel(item)"
            >
              <text>取消</text>
            </view>
          </view>
        </view>
      </scroll-view>
    </view>
  </view>
</template>

<script setup>
import { ref, watch } from 'vue'
import { getOfflineQueue, removeFromQueue } from '../utils/offline.js'
import { syncManager } from '../utils/syncManager.js'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'update:visible', 'retry', 'cancel'])

const pendingItems = ref([])

// Load pending items when modal opens
watch(() => props.visible, (newVal) => {
  if (newVal) {
    loadPendingItems()
  }
})

function loadPendingItems() {
  pendingItems.value = getOfflineQueue()
}

function statusText(status) {
  switch (status) {
    case 'pending': return '⏳ 等待同步'
    case 'syncing': return '⟳ 同步中...'
    case 'failed': return '⚠️ 上传失败'
    default: return status
  }
}

function handleOverlayTap() {
  handleClose()
}

function handleClose() {
  emit('close')
  emit('update:visible', false)
}

async function handleRetry(item) {
  await syncManager.retryItem(item.id)
  loadPendingItems()
  emit('retry', item)
}

function handleCancel(item) {
  uni.showModal({
    title: '取消同步',
    content: '确定要取消这条故事的同步吗？',
    confirmColor: '#ff4d4f',
    success: (res) => {
      if (res.confirm) {
        removeFromQueue(item.id)
        loadPendingItems()
        emit('cancel', item)
      }
    }
  })
}
</script>

<style lang="scss" scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-end;
  z-index: 1000;
}

.modal-content {
  width: 100%;
  max-height: 70vh;
  background-color: #fff;
  border-radius: 32rpx 32rpx 0 0;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 32rpx;
  border-bottom: 1px solid #f0f0f0;
}

.modal-title {
  font-size: 36rpx;
  font-weight: 600;
  color: $uni-text-color;
}

.close-btn {
  width: 64rpx;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48rpx;
  color: $uni-text-color-grey;

  &:active {
    opacity: 0.7;
  }
}

.modal-body {
  flex: 1;
  padding: 24rpx;
  max-height: 60vh;
}

.empty-state {
  display: flex;
  justify-content: center;
  padding: 80rpx 0;
}

.empty-text {
  font-size: 28rpx;
  color: $uni-text-color-grey;
}

.pending-item {
  display: flex;
  align-items: center;
  padding: 24rpx;
  background-color: #f9f9f9;
  border-radius: 16rpx;
  margin-bottom: 16rpx;
}

.item-thumb {
  width: 100rpx;
  height: 100rpx;
  border-radius: 12rpx;
  background-color: #e0e0e0;
  flex-shrink: 0;
}

.item-info {
  flex: 1;
  padding: 0 24rpx;
  min-width: 0;
}

.item-caption {
  font-size: 28rpx;
  color: $uni-text-color;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-bottom: 8rpx;
}

.item-status {
  font-size: 24rpx;

  &.pending {
    color: #856404;
  }

  &.syncing {
    color: $uni-color-primary;
  }

  &.failed {
    color: #ff4d4f;
  }
}

.item-actions {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  flex-shrink: 0;
}

.retry-btn,
.cancel-btn {
  padding: 12rpx 24rpx;
  border-radius: 8rpx;
  font-size: 24rpx;

  &:active {
    opacity: 0.8;
  }
}

.retry-btn {
  background-color: $uni-color-primary;
  color: #fff;
}

.cancel-btn {
  background-color: #f0f0f0;
  color: $uni-text-color-grey;
}
</style>
```

- [ ] **Step 2: Commit PendingListModal**

```bash
git add components/PendingListModal.vue
git commit -m "feat(pending-modal): create modal for managing pending sync items"
```

---

## Task 10: Update index.vue to Merge Pending Stories

**Files:**
- Modify: `pages/index/index.vue`

- [ ] **Step 1: Import pending story utilities**

Add to imports:

```javascript
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { storiesApi, groupByMonth } from '../../api/index.js'
import { getPendingStories } from '../../utils/offline.js'
import { syncManager, setTimelineUpdateCallback } from '../../utils/syncManager.js'
```

- [ ] **Step 2: Add pending modal state**

Add after existing refs:

```javascript
// Pending modal state
const showPendingModal = ref(false)
```

- [ ] **Step 3: Update loadStories to merge pending items**

Replace `loadStories` function with:

```javascript
async function loadStories(forceRefresh = false) {
  loading.value = true
  currentSkip = 0
  hasMore.value = true

  try {
    // 1. Get pending stories from queue
    const pendingStories = getPendingStories()

    // 2. Get server stories
    const result = await storiesApi.getStories({ limit: pageSize, skip: 0, forceRefresh })
    stories.value = result.stories
    hasMore.value = result.hasMore
    currentSkip = result.stories.length

    // 3. Merge: pending first, then server stories (exclude local IDs)
    const serverStoryIds = new Set(result.stories.map(s => s._id))
    const combinedStories = [
      ...pendingStories.filter(s => !serverStoryIds.has(s._id)),
      ...result.stories
    ]

    monthlyGroups.value = groupByMonth(combinedStories)

    // 4. Trigger background sync
    syncManager.syncAll()

  } catch (error) {
    console.error('Failed to load stories:', error)
    uni.showToast({
      title: '加载失败，请检查网络',
      icon: 'none',
      duration: 2000
    })
  } finally {
    loading.value = false
  }
}
```

- [ ] **Step 4: Set up timeline update callback**

Add in `onMounted`:

```javascript
onMounted(async () => {
  // Get status bar height
  const systemInfo = uni.getSystemInfoSync()
  navBarHeight.value = (systemInfo.statusBarHeight || 44) + 44

  // Set up callback for sync manager to update timeline
  setTimelineUpdateCallback((localId, updates) => {
    if (updates.replaceWithReal && updates.realStory) {
      // Replace local pending story with real one
      stories.value = stories.value.map(s =>
        s._id === localId ? updates.realStory : s
      )
      monthlyGroups.value = groupByMonth(stories.value)
    } else {
      // Update pending story status
      stories.value = stories.value.map(s =>
        s._id === localId ? { ...s, ...updates } : s
      )
      monthlyGroups.value = groupByMonth(stories.value)
    }
  })

  await loadStories()
  await loadUnreadCount()
})
```

- [ ] **Step 5: Add pending modal handlers**

Add after existing handlers:

```javascript
// Pending modal handlers
function handlePendingModalTap() {
  showPendingModal.value = true
}

function handlePendingModalClose() {
  showPendingModal.value = false
  // Reload to refresh pending status
  loadStories(true)
}

function handleRetrySync(story) {
  // The modal handles retry, just refresh after
  loadStories(true)
}

function handleCancelSync(story) {
  // The modal handles cancel, just refresh after
  loadStories(true)
}
```

- [ ] **Step 6: Update OfflineBanner in template**

Find `<OfflineBanner />` and replace with:

```vue
<OfflineBanner @tap="handlePendingModalTap" />
```

- [ ] **Step 7: Add StoryCard syncStatus and events**

Find the `<StoryCard>` component and update:

```vue
<StoryCard
  v-for="(story, index) in group.stories"
  :key="story._id"
  :story="story"
  :sync-status="story.syncStatus || null"
  @tap="goToDetail"
  @image-tap="openImageViewer"
  @retry-sync="handleRetrySync"
/>
```

- [ ] **Step 8: Add PendingListModal to template**

Add at the end of the template, after ImageViewer:

```vue
<!-- Pending List Modal -->
<PendingListModal
  v-model:visible="showPendingModal"
  @close="handlePendingModalClose"
  @retry="handleRetrySync"
  @cancel="handleCancelSync"
/>
```

- [ ] **Step 9: Commit index.vue changes**

```bash
git add pages/index/index.vue
git commit -m "feat(timeline): merge pending stories, add pending modal trigger"
```

---

## Task 11: Update story-detail.vue for Pending Stories

**Files:**
- Modify: `pages/story-detail/story-detail.vue`

- [ ] **Step 1: Handle pending story detail view**

In the `loadStoryData` function, add check for local ID:

```javascript
async function loadStoryData() {
  if (!storyId.value) {
    loading.value = false
    return
  }

  // Check if this is a local pending story
  if (storyId.value.startsWith('local_')) {
    await loadPendingStory()
    return
  }

  // ... existing server story loading logic
}

async function loadPendingStory() {
  try {
    const { getOfflineQueue } = await import('../../utils/offline.js')
    const queue = getOfflineQueue()
    const item = queue.find(i => i.id === storyId.value)

    if (!item) {
      story.value = null
      loading.value = false
      return
    }

    // Convert to story format
    story.value = {
      _id: item.id,
      photoUrls: item.photoFiles.map(f => f.path),
      photoUrl: item.photoFiles[0]?.path,
      caption: item.caption,
      authorName: item.authorName,
      authorAvatar: item.authorAvatar,
      authorId: item.authorId,
      createdAt: item.queuedAt,
      isPending: true,
      syncStatus: item.status
    }

    tempPhotoUrls.value = item.photoFiles.map(f => f.path)
    isOwner.value = true
    loading.value = false
  } catch (error) {
    console.error('Failed to load pending story:', error)
    story.value = null
    loading.value = false
  }
}
```

- [ ] **Step 2: Hide edit/delete for pending stories**

Find the action section template and update:

```vue
<!-- Action buttons - only for synced stories -->
<view v-if="isOwner && !isEditing && !story?.isPending" class="action-section">
  <button class="action-btn edit-btn" @click="startEdit">
    <text>编辑</text>
  </button>
  <button class="action-btn delete-btn" @click="confirmDelete">
    <text>删除</text>
  </button>
</view>

<!-- Pending story info -->
<view v-if="story?.isPending" class="pending-notice">
  <text class="pending-icon">⏳</text>
  <text class="pending-text">
    {{ story.syncStatus === 'failed' ? '同步失败，请返回首页重试' : '故事正在同步中...' }}
  </text>
</view>
```

- [ ] **Step 3: Add pending notice styles**

Add to styles:

```scss
.pending-notice {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32rpx;
  background-color: #fff3cd;
  border-radius: 16rpx;
  margin: 0 32rpx 32rpx;
}

.pending-icon {
  font-size: 36rpx;
  margin-right: 16rpx;
}

.pending-text {
  font-size: 28rpx;
  color: #856404;
}
```

- [ ] **Step 4: Commit story-detail changes**

```bash
git add pages/story-detail/story-detail.vue
git commit -m "feat(story-detail): handle pending story view with sync status notice"
```

---

## Task 12: Integration Testing

**Files:**
- Test: Manual testing in WeChat DevTools

- [ ] **Step 1: Test offline posting**

1. In DevTools, set network to "Offline"
2. Open app, tap + to add story
3. Select photo, enter caption, tap Post
4. Expected: Toast "已保存，联网后自动同步", navigate back
5. Expected: Story appears in timeline with "⏳ 等待同步" badge
6. Expected: Offline banner shows "(1条待同步)"

- [ ] **Step 2: Test auto-sync**

1. Set network back to "Online"
2. Expected: Sync starts automatically
3. Expected: Badge changes to "⟳ 同步中..."
4. Expected: On success, badge shows "✓ 已同步", then disappears
5. Expected: Story now has real server ID

- [ ] **Step 3: Test manual retry**

1. Set network to "Offline"
2. Post a story
3. Set network to "Online" but with slow/failing upload (can mock in DevTools)
4. Expected: After 3 failures, badge shows "⚠️ 点击重试"
5. Tap the badge
6. Expected: Retry triggers

- [ ] **Step 4: Test pending modal**

1. Have pending stories in queue
2. Tap the offline banner
3. Expected: Modal shows list of pending items
4. Tap retry on failed item
5. Tap cancel on an item
6. Expected: Item removed from queue

- [ ] **Step 5: Test story detail for pending**

1. Tap on a pending story in timeline
2. Expected: Detail page shows local photo
3. Expected: Shows "⏳ 故事正在同步中..." notice
4. Expected: No edit/delete buttons

- [ ] **Step 6: Test app restart recovery**

1. Have a story with status "syncing" in queue
2. Force close the app
3. Reopen the app
4. Expected: Status reset to "pending"
5. Expected: Sync triggers again

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "test(offline): verify offline queue end-to-end flow"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Fix MAX_PHOTOS bug | `add-story.vue` |
| 2 | Enhance offline.js | `utils/offline.js` |
| 3 | Create sync manager | `utils/syncManager.js` |
| 4 | Add createStoryFromQueue API | `api/index.js` |
| 5 | Add network listener | `App.vue` |
| 6 | Add offline posting | `add-story.vue` |
| 7 | Add sync badge | `StoryCard.vue` |
| 8 | Make banner tappable | `OfflineBanner.vue` |
| 9 | Create pending modal | `PendingListModal.vue` |
| 10 | Merge pending in timeline | `index.vue` |
| 11 | Handle pending detail | `story-detail.vue` |
| 12 | Integration testing | Manual |

**Estimated effort:** 1-2 days
