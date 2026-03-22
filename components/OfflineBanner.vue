<template>
  <view v-if="!isOnline" class="offline-banner">
    <text class="offline-icon">⚠️</text>
    <text class="offline-text">离线中 — 联网后故事会自动同步</text>
  </view>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const isOnline = ref(true)

function updateOnlineStatus() {
  isOnline.value = uni.getNetworkType
    ? true // In mini-program, assume online for mock
    : navigator.onLine
}

onMounted(() => {
  updateOnlineStatus()
  // For real app, would listen to network changes
})

defineExpose({ isOnline })
</script>

<style lang="scss" scoped>
.offline-banner {
  background-color: #fff3cd;
  padding: 20rpx 32rpx;
  display: flex;
  align-items: center;
}

.offline-icon {
  margin-right: 12rpx;
}

.offline-text {
  font-size: 26rpx;
  color: #856404;
}
</style>
