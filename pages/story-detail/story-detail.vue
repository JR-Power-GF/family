<template>
  <view class="detail-page">
    <!-- Loading -->
    <view v-if="loading" class="loading-area">
      <text>加载中...</text>
    </view>

    <!-- Story content -->
    <view v-else-if="story" class="story-content">
      <!-- Full photo -->
      <image
        :src="displayPhotoUrl"
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
          <image :src="displayAvatar" class="author-avatar" mode="aspectFill" />
          <text class="author-name">{{ story.authorName }}</text>
        </view>
        <text class="story-date">{{ formattedDate }}</text>
      </view>
    </view>

    <!-- Not found -->
    <view v-else class="not-found">
      <text>故事不存在</text>
      <button class="back-btn" @click="goBack">返回</button>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { storiesApi } from '../../api/index.js'

const story = ref(null)
const loading = ref(true)
const tempPhotoUrl = ref('')
const tempAvatarUrl = ref('')

const displayPhotoUrl = computed(() => {
  if (story.value?.photoUrl?.startsWith('cloud://')) {
    return tempPhotoUrl.value || story.value.photoUrl
  }
  return story.value?.photoUrl || ''
})

const displayAvatar = computed(() => {
  if (story.value?.authorAvatar?.startsWith('cloud://')) {
    return tempAvatarUrl.value || story.value.authorAvatar
  }
  return story.value?.authorAvatar || ''
})

const formattedDate = computed(() => {
  if (!story.value) return ''
  const date = new Date(story.value.createdAt)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
})

onMounted(async () => {
  // Get story ID from query params
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  const storyId = currentPage.options?.id

  if (!storyId) {
    loading.value = false
    return
  }

  try {
    story.value = await storiesApi.getStory(storyId)

    // Convert cloud fileIDs to temporary URLs
    if (story.value) {
      await convertCloudUrls()
    }
  } catch (error) {
    console.error('Failed to load story:', error)
    story.value = null
  } finally {
    loading.value = false
  }
})

async function convertCloudUrls() {
  const fileIds = []

  if (story.value.photoUrl?.startsWith('cloud://')) {
    fileIds.push(story.value.photoUrl)
  }
  if (story.value.authorAvatar?.startsWith('cloud://')) {
    fileIds.push(story.value.authorAvatar)
  }

  if (fileIds.length === 0) return

  try {
    const { fileList } = await wx.cloud.getTempFileURL({ fileList: fileIds })

    fileList.forEach(file => {
      if (file.tempFileURL) {
        if (file.fileID === story.value.photoUrl) {
          tempPhotoUrl.value = file.tempFileURL
        } else if (file.fileID === story.value.authorAvatar) {
          tempAvatarUrl.value = file.tempFileURL
        }
      }
    })
  } catch (e) {
    console.error('Failed to get temp URLs:', e)
  }
}

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
