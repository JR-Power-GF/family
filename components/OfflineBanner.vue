<template>
  <view v-if="!isOnline" class="offline-banner" @click="handleTap">
    <text class="offline-icon">⚠️</text>
    <text class="offline-text">离线中 — 联网后故事会自动同步</text>
    <text v-if="queueCount > 0" class="queue-count">({{ queueCount }}条待同步)</text>
    <text v-if="queueCount > 0" class="tap-hint">点击查看</text>
  </view>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { getOfflineQueue } from '../utils/offline.js'

const emit = defineEmits(['tap'])

const isOnline = ref(true)
const queueCount = ref(0)
let networkCallbackId = null

function handleTap() {
  emit('tap', { queueCount: queueCount.value })
}

function updateOnlineStatus() {
  // Check network status
  uni.getNetworkType({
    success: (res) => {
      isOnline.value = res.networkType !== 'none'
    },
    fail: () => {
      isOnline.value = false
    }
  })

  // Update queue count
  const queue = getOfflineQueue()
  queueCount.value = queue.length
}

function handleNetworkChange(res) {
  isOnline.value = res.isConnected

  // Refresh queue count when coming online
  if (res.isConnected) {
    const queue = getOfflineQueue()
    queueCount.value = queue.length
  }
}

onMounted(() => {
  updateOnlineStatus()

  // Listen for network changes
  networkCallbackId = uni.onNetworkStatusChange?.(handleNetworkChange)
})

onUnmounted(() => {
  // Clean up network listener
  if (networkCallbackId) {
    uni.offNetworkStatusChange?.(networkCallbackId)
  }
})

defineExpose({ isOnline, queueCount, updateOnlineStatus })
</script>

<style lang="scss" scoped>
.offline-banner {
  background-color: #fff3cd;
  padding: 20rpx 32rpx;
  display: flex;
  align-items: center;

  &:active {
    background-color: #ffe69c;
  }
}

.offline-icon {
  margin-right: 12rpx;
}

.offline-text {
  font-size: 26rpx;
  color: #856404;
}

.queue-count {
  font-size: 24rpx;
  color: #856404;
  margin-left: 8rpx;
  opacity: 0.8;
}

.tap-hint {
  margin-left: auto;
  font-size: 24rpx;
  color: #856404;
  opacity: 0.8;
}
</style>
