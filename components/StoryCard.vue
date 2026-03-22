<template>
  <view class="story-card" @click="handleTap">
    <image
      class="story-photo"
      :src="story.photoUrl"
      mode="aspectFill"
      lazy-load
    />
    <view class="story-content">
      <text class="story-caption">{{ story.caption }}</text>
      <view class="story-meta">
        <image class="author-avatar" :src="story.authorAvatar" mode="aspectFill" />
        <text class="author-name">{{ story.authorName }}</text>
        <text class="story-date"> · {{ formattedDate }}</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  story: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['tap'])

const formattedDate = computed(() => {
  const date = new Date(props.story.createdAt)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
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
  font-size: 32rpx;
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
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  margin-right: 12rpx;
  background-color: #f0f0f0;
}

.author-name {
  font-size: 24rpx;
  color: $uni-text-color-grey;
}

.story-date {
  font-size: 24rpx;
  color: $uni-text-color-grey;
}
</style>
