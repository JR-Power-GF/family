<template>
  <view class="story-card" @click="handleTap">
    <image
      class="story-photo"
      :src="displayPhotoUrl"
      mode="aspectFill"
      lazy-load
    />
    <view class="story-content">
      <text class="story-caption">{{ story.caption }}</text>
      <view class="story-meta">
        <image class="author-avatar" :src="displayAvatar" mode="aspectFill" />
        <text class="author-name">{{ story.authorName }}</text>
        <text class="story-date"> · {{ formattedDate }}</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'

const props = defineProps({
  story: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['tap'])

// Temporary URL for cloud file (fileID -> temp URL)
const tempPhotoUrl = ref('')
const tempAvatarUrl = ref('')

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
})

function handleTap() {
  emit('tap', props.story)
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

.story-photo {
  width: 100%;
  height: 400rpx;
  background-color: #f0f0f0;
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
</style>
