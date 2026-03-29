<template>
  <view class="notifications-page">
    <!-- Loading -->
    <view v-if="loading" class="loading-container">
      <view class="loading-item"></view>
      <view class="loading-item"></view>
      <view class="loading-item"></view>
      <view class="loading-item"></view>
      <view class="loading-item"></view>
    </view>

    <!-- Empty state -->
    <view v-else-if="notifications.length === 0" class="empty-state">
      <text class="empty-icon">🔔</text>
      <text class="empty-text">暂无消息</text>
      <text class="empty-tip">新的互动会在这里显示</text>
    </view>

    <!-- Notifications list -->
    <view v-else class="notifications-container">
      <!-- Action buttons -->
      <view class="action-bar">
        <text class="unread-count" v-if="unreadCount > 0">{{ unreadCount }} 条未读</text>
        <text class="unread-count" v-else>全部已读</text>
        <view class="action-buttons">
          <text class="action-text" @click="markAllAsRead" v-if="unreadCount > 0">全部已读</text>
          <text class="action-text danger" @click="confirmClearAll">清空</text>
        </view>
      </view>

      <scroll-view scroll-y class="notifications-scroll">
        <view class="notifications-list">
          <view
            v-for="notification in notifications"
            :key="notification._id"
            class="notification-item"
            :class="{ 'unread': !notification.isRead }"
          >
            <view class="notification-main" @click="handleNotification(notification)">
              <image
                class="notification-avatar"
                :src="notification.actorAvatar || '/static/default-avatar.svg'"
                mode="aspectFill"
                @error="() => notification.actorAvatar = ''"
              />
              <view class="notification-content">
                <view class="notification-header">
                  <text class="notification-actor">{{ notification.actorName }}</text>
                  <text class="notification-action">{{ getActionText(notification.type) }}</text>
                </view>
                <text class="notification-preview">{{ notification.preview }}</text>
                <text class="notification-time">{{ formatTime(notification.createdAt) }}</text>
              </view>
              <view v-if="!notification.isRead" class="unread-dot"></view>
            </view>
            <!-- Delete button -->
            <view class="delete-action" @click="confirmDelete(notification)">
              <text>删除</text>
            </view>
          </view>
        </view>
      </scroll-view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

// Lazy database initialization
let db = null
function getDb() {
  if (!db) db = wx.cloud.database()
  return db
}

const loading = ref(true)
const notifications = ref([])
const currentUserId = ref('')

const unreadCount = computed(() => {
  return notifications.value.filter(n => !n.isRead).length
})

onMounted(async () => {
  await loadNotifications()
})

async function loadNotifications() {
  loading.value = true

  try {
    // Get current user
    const { result: userInfo } = await wx.cloud.callFunction({
      name: 'getUserInfo'
    }).catch(() => ({ result: { openid: null } }))

    if (!userInfo.openid) {
      loading.value = false
      return
    }

    currentUserId.value = userInfo.openid

    // Get notifications for this user
    const { data: notifs } = await getDb().collection('notifications')
      .where({
        targetId: userInfo.openid
      })
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get()

    notifications.value = notifs
  } catch (error) {
    console.error('Failed to load notifications:', error)
    uni.showToast({
      title: '加载失败',
      icon: 'none'
    })
  } finally {
    loading.value = false
  }
}

async function handleNotification(notification) {
  // Mark as read
  if (!notification.isRead) {
    try {
      await getDb().collection('notifications').doc(notification._id).update({
        data: { isRead: true }
      })
      notification.isRead = true
    } catch (e) {
      console.error('Failed to mark as read:', e)
    }
  }

  // Navigate based on type
  if (notification.storyId) {
    uni.navigateTo({
      url: `/pages/story-detail/story-detail?id=${notification.storyId}`
    })
  }
}

async function markAllAsRead() {
  if (unreadCount.value === 0) return

  uni.showLoading({ title: '处理中...', mask: true })

  try {
    // Get all unread notification IDs
    const unreadIds = notifications.value
      .filter(n => !n.isRead)
      .map(n => n._id)

    // Batch update (WeChat cloud limits batch operations)
    const batchSize = 20
    for (let i = 0; i < unreadIds.length; i += batchSize) {
      const batch = unreadIds.slice(i, i + batchSize)
      await Promise.all(
        batch.map(id =>
          getDb().collection('notifications').doc(id).update({
            data: { isRead: true }
          })
        )
      )
    }

    // Update local state
    notifications.value.forEach(n => {
      n.isRead = true
    })

    uni.hideLoading()
    uni.showToast({
      title: '已全部标记为已读',
      icon: 'success'
    })
  } catch (error) {
    uni.hideLoading()
    console.error('Failed to mark all as read:', error)
    uni.showToast({
      title: '操作失败',
      icon: 'none'
    })
  }
}

function confirmDelete(notification) {
  uni.showModal({
    title: '删除通知',
    content: '确定要删除这条通知吗？',
    confirmColor: '#ff4d4f',
    success: (res) => {
      if (res.confirm) {
        deleteNotification(notification)
      }
    }
  })
}

async function deleteNotification(notification) {
  try {
    await getDb().collection('notifications').doc(notification._id).remove()

    // Remove from local list
    notifications.value = notifications.value.filter(n => n._id !== notification._id)

    uni.showToast({
      title: '已删除',
      icon: 'success'
    })
  } catch (error) {
    console.error('Failed to delete notification:', error)
    uni.showToast({
      title: '删除失败',
      icon: 'none'
    })
  }
}

function confirmClearAll() {
  if (notifications.value.length === 0) return

  uni.showModal({
    title: '清空通知',
    content: '确定要清空所有通知吗？此操作不可恢复。',
    confirmColor: '#ff4d4f',
    success: (res) => {
      if (res.confirm) {
        clearAllNotifications()
      }
    }
  })
}

async function clearAllNotifications() {
  uni.showLoading({ title: '清空中...', mask: true })

  try {
    // Get all notification IDs
    const allIds = notifications.value.map(n => n._id)

    // Batch delete (WeChat cloud limits batch operations)
    const batchSize = 20
    for (let i = 0; i < allIds.length; i += batchSize) {
      const batch = allIds.slice(i, i + batchSize)
      await Promise.all(
        batch.map(id =>
          getDb().collection('notifications').doc(id).remove()
        )
      )
    }

    // Clear local list
    notifications.value = []

    uni.hideLoading()
    uni.showToast({
      title: '已清空',
      icon: 'success'
    })
  } catch (error) {
    uni.hideLoading()
    console.error('Failed to clear notifications:', error)
    uni.showToast({
      title: '清空失败',
      icon: 'none'
    })
  }
}

function getActionText(type) {
  const actions = {
    'like': '赞了你的故事',
    'comment': '评论了你的故事',
    'reply': '回复了你的评论',
    'mention': '在评论中@了你'
  }
  return actions[type] || '与你互动'
}

function formatTime(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now - date

  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`

  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}
</script>

<style lang="scss" scoped>
.notifications-page {
  min-height: 100vh;
  background-color: $uni-bg-color-grey;
}

/* Loading skeleton styles */
.loading-container {
  padding: 24rpx;
}

.loading-item {
  display: flex;
  align-items: flex-start;
  padding: 24rpx;
  background-color: #fff;
  border-radius: 16rpx;
  margin-bottom: 16rpx;
}

.loading-item::before {
  content: '';
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
  margin-right: 20rpx;
  flex-shrink: 0;
}

.loading-item::after {
  content: '';
  flex: 1;
  height: 80rpx;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
  border-radius: 8rpx;
}

@keyframes skeleton-loading {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
}

.empty-icon {
  font-size: 120rpx;
  margin-bottom: 32rpx;
}

.empty-text {
  font-size: 36rpx;
  color: $uni-text-color;
  margin-bottom: 16rpx;
}

.empty-tip {
  font-size: 28rpx;
  color: $uni-text-color-grey;
}

.notifications-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.action-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx 32rpx;
  background-color: #fff;
  border-bottom: 1px solid #f0f0f0;
}

.unread-count {
  font-size: 26rpx;
  color: $uni-text-color-grey;
}

.action-buttons {
  display: flex;
  gap: 24rpx;
}

.action-text {
  font-size: 26rpx;
  color: $uni-color-primary;

  &.danger {
    color: #ff4d4f;
  }

  &:active {
    opacity: 0.7;
  }
}

.notifications-scroll {
  flex: 1;
}

.notifications-list {
  padding: 24rpx;
}

.notification-item {
  display: flex;
  align-items: stretch;
  background-color: #fff;
  border-radius: 16rpx;
  margin-bottom: 16rpx;
  overflow: hidden;

  &.unread {
    background-color: #f0f7ff;
  }
}

.notification-main {
  display: flex;
  align-items: flex-start;
  padding: 24rpx;
  flex: 1;
  position: relative;

  &:active {
    opacity: 0.8;
  }
}

.notification-avatar {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  margin-right: 20rpx;
  flex-shrink: 0;
}

.notification-content {
  flex: 1;
  min-width: 0;
}

.notification-header {
  display: flex;
  align-items: center;
  margin-bottom: 8rpx;
}

.notification-actor {
  font-size: 30rpx;
  color: $uni-text-color;
  font-weight: 500;
  margin-right: 8rpx;
}

.notification-action {
  font-size: 28rpx;
  color: $uni-text-color-grey;
}

.notification-preview {
  font-size: 26rpx;
  color: $uni-text-color;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-bottom: 8rpx;
}

.notification-time {
  font-size: 24rpx;
  color: $uni-text-color-grey;
}

.unread-dot {
  position: absolute;
  top: 24rpx;
  right: 24rpx;
  width: 16rpx;
  height: 16rpx;
  background-color: $uni-color-primary;
  border-radius: 50%;
}

.delete-action {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 32rpx;
  background-color: #ff4d4f;
  color: #fff;
  font-size: 26rpx;

  &:active {
    opacity: 0.8;
  }
}
</style>
