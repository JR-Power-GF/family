<template>
  <view class="story-card">
    <view class="photo-container" @click.stop="handleImageTap">
      <image
        class="story-photo"
        :src="displayPhotoUrl"
        mode="aspectFill"
        lazy-load
      />
      <!-- Multi-photo indicator -->
      <view v-if="photoCount > 1" class="photo-count-badge">
        <text>{{ photoCount }}</text>
      </view>
    </view>
    <view class="story-content" @click="handleTap">
      <text class="story-caption">{{ story.caption }}</text>
      <view class="story-meta">
        <image class="author-avatar" :src="displayAvatar" mode="aspectFill" />
        <text class="author-name">{{ story.authorName }}</text>
        <text class="story-date"> · {{ formattedDate }}</text>
      </view>
      <!-- Like and Comment counts -->
      <view class="story-actions" @click.stop>
        <view class="action-item" @click="handleLikeTap">
          <text class="action-icon">{{ hasLiked ? '❤️' : '🤍' }}</text>
          <text class="action-count">{{ story.likeCount || 0 }}</text>
        </view>
        <view class="action-item" @click="handleTap">
          <text class="action-icon">💬</text>
          <text class="action-count">{{ story.commentCount || 0 }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'
import { storiesApi } from '../api/index.js'

const props = defineProps({
  story: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['tap', 'imageTap'])

// Temporary URL for cloud file (fileID -> temp URL)
const tempPhotoUrl = ref('')
const tempAvatarUrl = ref('')
const hasLiked = ref(false)

// Photo count (check both photoUrls array and single photoUrl)
const photoCount = computed(() => {
  if (props.story.photoUrls && props.story.photoUrls.length > 0) {
    return props.story.photoUrls.length
  }
  return props.story.photoUrl ? 1 : 0
})

const displayPhotoUrl = computed(() => {
  // If it's a cloud fileID (starts with cloud://), use temp URL
  if (props.story.photoUrl?.startsWith('cloud://')) {
    return tempPhotoUrl.value || props.story.photoUrl
  }
  // Otherwise use as-is (mock data or external URL)
  return props.story.photoUrl
})

const displayAvatar = computed(() => {
  if (props.story.authorAvatar?.startsWith('cloud://')) {
    return tempAvatarUrl.value || props.story.authorAvatar
  }
  return props.story.authorAvatar
})

const formattedDate = computed(() => {
  const date = new Date(props.story.createdAt)
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
})

onMounted(async () => {
  // Convert cloud fileIDs to temporary URLs
  if (props.story.photoUrl?.startsWith('cloud://')) {
    try {
      const { fileList } = await wx.cloud.getTempFileURL({
        fileList: [props.story.photoUrl]
      })
      if (fileList[0]?.tempFileURL) {
        tempPhotoUrl.value = fileList[0].tempFileURL
      }
    } catch (e) {
      console.error('Failed to get temp photo URL:', e)
    }
  }

  if (props.story.authorAvatar?.startsWith('cloud://')) {
    try {
      const { fileList } = await wx.cloud.getTempFileURL({
        fileList: [props.story.authorAvatar]
      })
      if (fileList[0]?.tempFileURL) {
        tempAvatarUrl.value = fileList[0].tempFileURL
      }
    } catch (e) {
      console.error('Failed to get temp avatar URL:', e)
    }
  }

  // Check if user has liked this story (ignore if collection doesn't exist)
  if (props.story._id) {
    try {
      hasLiked.value = await storiesApi.hasLiked(props.story._id)
    } catch (e) {
      // Collection may not exist yet, ignore
    }
  }
})

function handleTap() {
  emit('tap', props.story)
}

function handleImageTap() {
  emit('imageTap', {
    imageUrl: displayPhotoUrl.value,
    story: props.story
  })
}

async function handleLikeTap() {
  try {
    const result = await storiesApi.likeStory(props.story._id)
    hasLiked.value = result.liked
    // Update local count optimistically
    if (result.liked) {
      props.story.likeCount = (props.story.likeCount || 0) + 1
    } else {
      props.story.likeCount = Math.max(0, (props.story.likeCount || 1) - 1)
    }
  } catch (error) {
    console.error('Failed to toggle like:', error)
    uni.showToast({
      title: '操作失败',
      icon: 'none'
    })
  }
}
</script>

<style lang="scss" scoped>
.story-card {
  background-color: $uni-bg-color;
  border-radius: 24rpx;
  margin-bottom: 32rpx;
  overflow: hidden;

  &:active {
    opacity: 0.7;
  }
}

.photo-container {
  position: relative;
  width: 100%;
}

.story-photo {
  width: 100%;
  height: 400rpx;
  background-color: #f0f0f0;
}

.photo-count-badge {
  position: absolute;
  right: 16rpx;
  bottom: 16rpx;
  background-color: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: 24rpx;
  padding: 8rpx 16rpx;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
}

.story-content {
  padding: 24rpx;
}

.story-caption {
  font-size: 36rpx;
  color: $uni-text-color;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}

.story-meta {
  display: flex;
  align-items: center;
  margin-top: 16rpx;
}

.author-avatar {
  width: 52rpx;
  height: 52rpx;
  border-radius: 50%;
  margin-right: 12rpx;
  background-color: #f0f0f0;
}

.author-name {
  font-size: 28rpx;
  color: $uni-text-color-grey;
}

.story-date {
  font-size: 28rpx;
  color: $uni-text-color-grey;
}

.story-actions {
  display: flex;
  margin-top: 16rpx;
  padding-top: 16rpx;
  border-top: 1px solid #f0f0f0;
}

.action-item {
  display: flex;
  align-items: center;
  margin-right: 32rpx;
  padding: 8rpx 16rpx;
  border-radius: 24rpx;

  &:active {
    background-color: #f5f5f5;
  }
}

.action-icon {
  font-size: 36rpx;
  margin-right: 8rpx;
}

.action-count {
  font-size: 24rpx;
  color: $uni-text-color-grey;
}
</style>
