<template>
  <view class="month-header">
    <text class="month-label">{{ label }}</text>
    <view class="divider"></view>
  </view>
</template>

<script setup>
defineProps({
  label: {
    type: String,
    required: true
  }
})
</script>

<style lang="scss" scoped>
.month-header {
  height: 96rpx;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 0 32rpx;
}

.month-label {
  font-size: 40rpx;
  font-weight: 600;
  color: $uni-text-color;
  line-height: 1.4;
}

.divider {
  height: 1px;
  background-color: #eee;
  margin-top: 16rpx;
}
</style>
