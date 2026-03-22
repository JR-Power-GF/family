<template>
  <view class="timeline-page">
    <!-- Custom Navigation Bar -->
    <CustomNavBar title="温暖一大家" />
    <view class="navbar-placeholder" :style="{ height: navBarHeight + 'px' }"></view>

    <!-- Quick Access Buttons -->
    <view class="quick-access">
      <view class="quick-btn" @click="goToProfile">
        <text class="quick-icon">👤</text>
        <text class="quick-text">我的</text>
      </view>
      <view class="quick-btn" @click="goToFamily">
        <text class="quick-icon">👨‍👩‍👧‍👦</text>
        <text class="quick-text">家庭</text>
      </view>
      <view class="quick-btn" @click="goToNotifications">
        <text class="quick-icon">🔔</text>
        <text class="quick-text">消息</text>
        <view v-if="unreadCount > 0" class="unread-badge">{{ unreadCount > 99 ? '99+' : unreadCount }}</view>
      </view>
    </view>

    <OfflineBanner />

    <!-- Loading state -->
    <LoadingSkeleton v-if="loading" :count="3" />

    <!-- Empty state -->
    <EmptyState
      v-else-if="!loading && monthlyGroups.length === 0"
      @add-story="goToAddStory"
    />

    <!-- Timeline content -->
    <scroll-view
      v-else
      scroll-y
      class="timeline-scroll"
      refresher-enabled
      :refresher-triggered="refreshing"
      refresher-default-style="none"
      refresher-background="#F8F8F8"
      @refresherrefresh="onRefresh"
      @scrolltolower="loadMore"
    >
      <!-- Custom refresh animation -->
      <view class="refresh-container" slot="refresher">
        <view class="refresh-icon" :class="{ 'refreshing': refreshing }">
          <text>🔄</text>
        </view>
        <text class="refresh-text">{{ refreshing ? '刷新中...' : '下拉刷新' }}</text>
      </view>

      <view class="timeline-content">
        <template v-for="group in monthlyGroups" :key="group.key">
          <MonthHeader :label="group.label" />
          <StoryCard
            v-for="(story, index) in group.stories"
            :key="story._id"
            :story="story"
            @tap="goToDetail"
            @image-tap="openImageViewer"
            :data-index="index"
          />
        </template>

        <!-- Loading more indicator -->
        <view v-if="loadingMore" class="loading-more">
          <text>加载中...</text>
        </view>

        <!-- No more data indicator -->
        <view v-else-if="!hasMore && stories.length > 0" class="no-more">
          <text>没有更多了</text>
        </view>
      </view>
    </scroll-view>

    <!-- FAB -->
    <view class="fab" @click="goToAddStory">
      <text class="fab-icon">+</text>
    </view>

    <!-- Image Viewer -->
    <ImageViewer
      :visible="showImageViewer"
      :images="viewerImages"
      :current="viewerIndex"
      @close="closeImageViewer"
    />
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { storiesApi, groupByMonth } from '../../api/index.js'

const loading = ref(true)
const refreshing = ref(false)
const loadingMore = ref(false)
const stories = ref([])
const monthlyGroups = ref([])
const hasMore = ref(true)
const navBarHeight = ref(88)
const pageSize = 10
const unreadCount = ref(0)
let currentSkip = 0

// Image viewer state
const showImageViewer = ref(false)
const viewerIndex = ref(0)
const viewerImages = ref([])

// Create a flat list of all image URLs
const allImageUrls = computed(() => {
  const urls = []
  monthlyGroups.value.forEach(group => {
    group.stories.forEach(story => {
      if (story.photoUrl) {
        urls.push(story.photoUrl)
      }
    })
  })
  return urls
})

onMounted(async () => {
  // Get status bar height
  const systemInfo = uni.getSystemInfoSync()
  navBarHeight.value = (systemInfo.statusBarHeight || 44) + 44

  await loadStories()
  await loadUnreadCount()
})

// Refresh when returning to this page
onShow(async () => {
  // Always refresh to get latest data (forceRefresh bypasses cache)
  await loadStories(true)
  await loadUnreadCount()
})

async function loadStories(forceRefresh = false) {
  loading.value = true
  currentSkip = 0
  hasMore.value = true
  try {
    const result = await storiesApi.getStories({ limit: pageSize, skip: 0, forceRefresh })
    stories.value = result.stories
    monthlyGroups.value = groupByMonth(result.stories)
    hasMore.value = result.hasMore
    currentSkip = result.stories.length
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

async function onRefresh() {
  refreshing.value = true
  await loadStories(true)
  refreshing.value = false
}

async function loadMore() {
  if (loadingMore.value || !hasMore.value) return

  loadingMore.value = true
  try {
    const result = await storiesApi.getStories({ limit: pageSize, skip: currentSkip })
    stories.value = [...stories.value, ...result.stories]
    monthlyGroups.value = groupByMonth(stories.value)
    hasMore.value = result.hasMore
    currentSkip += result.stories.length
  } catch (error) {
    console.error('Failed to load more stories:', error)
    uni.showToast({
      title: '加载失败',
      icon: 'none'
    })
  } finally {
    loadingMore.value = false
  }
}

function goToAddStory() {
  uni.navigateTo({
    url: '/pages/add-story/add-story'
  })
}

function goToDetail(story) {
  uni.navigateTo({
    url: `/pages/story-detail/story-detail?id=${story._id}`
  })
}

function goToProfile() {
  uni.navigateTo({
    url: '/pages/profile/profile'
  })
}

function goToFamily() {
  uni.navigateTo({
    url: '/pages/family/family'
  })
}

function goToNotifications() {
  uni.navigateTo({
    url: '/pages/notifications/notifications'
  })
}

// Load unread notification count
async function loadUnreadCount() {
  try {
    const { result: userInfo } = await wx.cloud.callFunction({
      name: 'getUserInfo'
    }).catch(() => ({ result: { openid: null } }))

    if (!userInfo.openid) return

    const db = wx.cloud.database()
    const { total } = await db.collection('notifications')
      .where({
        targetId: userInfo.openid,
        isRead: false
      })
      .count()

    unreadCount.value = total
  } catch (error) {
    console.error('Failed to load unread count:', error)
  }
}

async function openImageViewer(event) {
  const { imageUrl, story } = event

  // Find the index of this image in all stories
  let flatIndex = 0
  for (const group of monthlyGroups.value) {
    for (const s of group.stories) {
      if (s._id === story._id) {
        break
      }
      if (s.photoUrl) {
        flatIndex++
      }
    }
    if (group.stories.find(s => s._id === story._id)) {
      break
    }
  }

  // Convert cloud URLs to temp URLs for viewing
  const tempUrls = []
  for (const url of allImageUrls.value) {
    if (url.startsWith('cloud://')) {
      try {
        const { fileList } = await wx.cloud.getTempFileURL({ fileList: [url] })
        tempUrls.push(fileList[0]?.tempFileURL || url)
      } catch (e) {
        tempUrls.push(url)
      }
    } else {
      tempUrls.push(url)
    }
  }

  viewerImages.value = tempUrls
  viewerIndex.value = flatIndex
  showImageViewer.value = true
}

function closeImageViewer() {
  showImageViewer.value = false
}
</script>

<style lang="scss" scoped>
.timeline-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.navbar-placeholder {
  flex-shrink: 0;
}

.quick-access {
  display: flex;
  justify-content: flex-end;
  padding: 16rpx 32rpx;
  gap: 24rpx;
}

.quick-btn {
  display: flex;
  align-items: center;
  background-color: #fff;
  padding: 16rpx 24rpx;
  border-radius: 24rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.05);
  position: relative;

  &:active {
    opacity: 0.8;
    transform: scale(0.98);
  }
}

.quick-icon {
  font-size: 32rpx;
  margin-right: 8rpx;
}

.quick-text {
  font-size: 26rpx;
  color: $uni-text-color;
}

.unread-badge {
  position: absolute;
  top: -8rpx;
  right: -8rpx;
  background-color: #ff4d4f;
  color: #fff;
  font-size: 20rpx;
  min-width: 32rpx;
  height: 32rpx;
  line-height: 32rpx;
  text-align: center;
  border-radius: 16rpx;
  padding: 0 8rpx;
}

.timeline-scroll {
  flex: 1;
}

.refresh-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32rpx 0;
  background-color: #F8F8F8;
}

.refresh-icon {
  font-size: 48rpx;
  margin-bottom: 8rpx;

  &.refreshing {
    animation: rotate 1s linear infinite;
  }
}

.refresh-text {
  font-size: 24rpx;
  color: $uni-text-color-grey;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.timeline-content {
  padding: 16rpx 32rpx 120rpx;
}

.fab {
  position: fixed;
  right: 32rpx;
  bottom: 48rpx;
  width: 112rpx;
  height: 112rpx;
  background-color: $uni-color-primary;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4rpx 16rpx rgba(0, 122, 255, 0.3);

  &:active {
    opacity: 0.8;
    transform: scale(0.95);
  }
}

.fab-icon {
  color: #fff;
  font-size: 56rpx;
  font-weight: 300;
}

.loading-more,
.no-more {
  padding: 32rpx 0;
  text-align: center;
  color: $uni-text-color-grey;
  font-size: 26rpx;
}
</style>
