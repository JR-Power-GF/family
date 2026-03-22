<template>
  <view class="skeleton-list">
    <view v-for="i in count" :key="i" class="skeleton-card">
      <view class="skeleton-photo"></view>
      <view class="skeleton-content">
        <view class="skeleton-line skeleton-line-long"></view>
        <view class="skeleton-line skeleton-line-medium"></view>
        <view class="skeleton-meta"></view>
      </view>
    </view>
  </view>
</template>

<script setup>
defineProps({
  count: {
    type: Number,
    default: 3
  }
})
</script>

<style lang="scss" scoped>
.skeleton-list {
  padding: 0 32rpx;
}

.skeleton-card {
  background-color: $uni-bg-color;
  border-radius: 24rpx;
  margin-bottom: 32rpx;
  overflow: hidden;
}

.skeleton-photo {
  width: 100%;
  height: 400rpx;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

.skeleton-content {
  padding: 24rpx;
}

.skeleton-line {
  height: 28rpx;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4rpx;
  margin-bottom: 12rpx;

  &.skeleton-line-long {
    width: 100%;
  }

  &.skeleton-line-medium {
    width: 70%;
  }
}

.skeleton-meta {
  height: 48rpx;
  width: 200rpx;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4rpx;
  margin-top: 16rpx;
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
</style>
