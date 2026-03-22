<template>
  <view class="custom-navbar" :style="{ paddingTop: statusBarHeight + 'px' }">
    <view class="navbar-content">
      <text class="navbar-title">{{ title }}</text>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const props = defineProps({
  title: {
    type: String,
    default: '温暖一大家'
  }
})

const statusBarHeight = ref(44)

onMounted(() => {
  // Get system info for status bar height
  const systemInfo = uni.getSystemInfoSync()
  statusBarHeight.value = systemInfo.statusBarHeight || 44
})
</script>

<style lang="scss" scoped>
.custom-navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 999;
  background-color: $uni-bg-color-grey;
}

.navbar-content {
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 32rpx;
}

.navbar-title {
  font-size: 40rpx;
  font-weight: 600;
  color: $uni-text-color;
  letter-spacing: 2rpx;
}
</style>
