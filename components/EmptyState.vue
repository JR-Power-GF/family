<template>
  <view class="empty-state">
    <view class="empty-icon">
      <text class="icon">📷</text>
    </view>
    <text class="empty-title">还没有故事</text>
    <text class="empty-body">成为第一个分享家庭回忆的人吧！</text>
    <button class="cta-button" @click="emit('addStory')">
      发布第一条故事
    </button>
  </view>
</template>

<script setup>
const emit = defineEmits(['addStory'])
</script>

<style lang="scss" scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80rpx 48rpx;
}

.empty-icon {
  width: 160rpx;
  height: 160rpx;
  background-color: #f5f5f5;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 32rpx;
}

.icon {
  font-size: 80rpx;
}

.empty-title {
  font-size: 36rpx;
  font-weight: 500;
  color: $uni-text-color;
  margin-bottom: 16rpx;
}

.empty-body {
  font-size: 28rpx;
  color: #666;
  text-align: center;
  line-height: 1.6;
  margin-bottom: 48rpx;
}

.cta-button {
  background-color: $uni-color-primary;
  color: #fff;
  font-size: 32rpx;
  font-weight: 500;
  border-radius: 16rpx;
  padding: 24rpx 48rpx;
  border: none;

  &:active {
    opacity: 0.8;
  }
}
</style>
