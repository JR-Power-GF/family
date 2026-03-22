<template>
  <view class="detail-page">
    <!-- Loading -->
    <view v-if="loading" class="loading-area">
      <text>Loading...</text>
    </view>

    <!-- Story content -->
    <view v-else-if="story" class="story-content">
      <!-- Full photo -->
      <image
        :src="story.photoUrl"
        mode="widthFix"
        class="full-photo"
        lazy-load
      />

      <!-- Caption -->
      <view class="caption-section">
        <text class="full-caption">{{ story.caption }}</text>
      </view>

      <!-- Meta info -->
      <view class="meta-section">
        <view class="meta-divider"></view>
        <view class="author-row">
          <image :src="story.authorAvatar" class="author-avatar" mode="aspectFill" />
          <text class="author-name">{{ story.authorName }}</text>
        </view>
        <text class="story-date">{{ formattedDate }}</text>
      </view>
    </view>

    <!-- Not found -->
    <view v-else class="not-found">
      <text>Story not found</text>
      <button class="back-btn" @click="goBack">Go Back</button>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { mockStories } from '../../data/mockStories.js'

const story = ref(null)
const loading = ref(true)

const formattedDate = computed(() => {
  if (!story.value) return ''
  const date = new Date(story.value.createdAt)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
})

onMounted(() => {
  // Get story ID from query params
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  const storyId = currentPage.options?.id

  // Simulate loading
  setTimeout(() => {
    story.value = mockStories.find(s => s.id === storyId) || null
    loading.value = false
  }, 300)
})

function goBack() {
  uni.navigateBack()
}
</script>

<style lang="scss" scoped>
.detail-page {
  min-height: 100vh;
  background-color: $uni-bg-color;
}

.loading-area {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  color: $uni-text-color-grey;
}

.full-photo {
  width: 100%;
  background-color: #f0f0f0;
}

.caption-section {
  padding: 32rpx;
}

.full-caption {
  font-size: 34rpx;
  color: $uni-text-color;
  line-height: 1.6;
}

.meta-section {
  padding: 0 32rpx 32rpx;
}

.meta-divider {
  height: 1px;
  background-color: #eee;
  margin-bottom: 24rpx;
}

.author-row {
  display: flex;
  align-items: center;
  margin-bottom: 12rpx;
}

.author-avatar {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  margin-right: 16rpx;
  background-color: #f0f0f0;
}

.author-name {
  font-size: 28rpx;
  color: $uni-text-color;
  font-weight: 500;
}

.story-date {
  font-size: 26rpx;
  color: $uni-text-color-grey;
}

.not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  color: $uni-text-color-grey;
}

.back-btn {
  margin-top: 32rpx;
  background-color: $uni-color-primary;
  color: #fff;
  font-size: 28rpx;
  border-radius: 12rpx;
  padding: 20rpx 40rpx;
}
</style>
