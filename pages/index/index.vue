<template>
  <view class="timeline-page">
    <!-- Custom Navigation Bar -->
    <CustomNavBar title="温暖一大家" />
    <view class="navbar-placeholder" :style="{ height: navBarHeight + 'px' }"></view>

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
      @refresherrefresh="onRefresh"
      @scrolltolower="loadMore"
    >
      <view class="timeline-content">
        <template v-for="group in monthlyGroups" :key="group.key">
          <MonthHeader :label="group.label" />
          <StoryCard
            v-for="story in group.stories"
            :key="story._id"
            :story="story"
            @tap="goToDetail"
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
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
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
let currentSkip = 0

onMounted(async () => {
  // Get status bar height
  const systemInfo = uni.getSystemInfoSync()
  navBarHeight.value = (systemInfo.statusBarHeight || 44) + 44

  await loadStories()
})

// Refresh when returning from add-story page
onShow(async () => {
  if (stories.value.length > 0) {
    await loadStories()
  }
})

async function loadStories() {
  loading.value = true
  currentSkip = 0
  hasMore.value = true
  try {
    const result = await storiesApi.getStories({ limit: pageSize, skip: 0 })
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
  await loadStories()
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

.timeline-scroll {
  flex: 1;
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
