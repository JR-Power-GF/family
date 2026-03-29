<template>
  <view v-if="visible" class="modal-overlay" @click="handleOverlayTap">
    <view class="modal-content" @click.stop>
      <!-- Header -->
      <view class="modal-header">
        <text class="modal-title">待同步 ({{ pendingItems.length }})</text>
        <view class="close-btn" @click="handleClose">
          <text>×</text>
        </view>
      </view>

      <!-- List -->
      <scroll-view scroll-y class="modal-body">
        <view v-if="pendingItems.length === 0" class="empty-state">
          <text class="empty-text">没有待同步的故事</text>
        </view>

        <view
          v-for="item in pendingItems"
          :key="item.id"
          class="pending-item"
        >
          <image
            class="item-thumb"
            :src="item.photoFiles[0]?.path || '/static/default-photo.svg'"
            mode="aspectFill"
          />
          <view class="item-info">
            <text class="item-caption">{{ item.caption }}</text>
            <text class="item-status" :class="item.status">
              {{ statusText(item.status) }}
            </text>
          </view>
          <view class="item-actions">
            <view
              v-if="item.status === 'failed'"
              class="retry-btn"
              @click="handleRetry(item)"
            >
              <text>重试</text>
            </view>
            <view
              class="cancel-btn"
              @click="handleCancel(item)"
            >
              <text>取消</text>
            </view>
          </view>
        </view>
      </scroll-view>
    </view>
  </view>
</template>

<script setup>
import { ref, watch } from 'vue'
import { getOfflineQueue, removeFromQueue } from '../utils/offline.js'
import { syncManager } from '../utils/syncManager.js'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'update:visible', 'retry', 'cancel'])

const pendingItems = ref([])

// Load pending items when modal opens
watch(() => props.visible, (newVal) => {
  if (newVal) {
    loadPendingItems()
  }
})

function loadPendingItems() {
  pendingItems.value = getOfflineQueue()
}

function statusText(status) {
  switch (status) {
    case 'pending': return '⏳ 等待同步'
    case 'syncing': return '⟳ 同步中...'
    case 'failed': return '⚠️ 上传失败'
    default: return status
  }
}

function handleOverlayTap() {
  handleClose()
}

function handleClose() {
  emit('close')
  emit('update:visible', false)
}

async function handleRetry(item) {
  await syncManager.retryItem(item.id)
  loadPendingItems()
  emit('retry', item)
}

function handleCancel(item) {
  uni.showModal({
    title: '取消同步',
    content: '确定要取消这条故事的同步吗？',
    confirmColor: '#ff4d4f',
    success: (res) => {
      if (res.confirm) {
        removeFromQueue(item.id)
        loadPendingItems()
        emit('cancel', item)
      }
    }
  })
}
</script>

<style lang="scss" scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-end;
  z-index: 1000;
}

.modal-content {
  width: 100%;
  max-height: 70vh;
  background-color: #fff;
  border-radius: 32rpx 32rpx 0 0;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 32rpx;
  border-bottom: 1px solid #f0f0f0;
}

.modal-title {
  font-size: 36rpx;
  font-weight: 600;
  color: $uni-text-color;
}

.close-btn {
  width: 64rpx;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48rpx;
  color: $uni-text-color-grey;

  &:active {
    opacity: 0.7;
  }
}

.modal-body {
  flex: 1;
  padding: 24rpx;
  max-height: 60vh;
}

.empty-state {
  display: flex;
  justify-content: center;
  padding: 80rpx 0;
}

.empty-text {
  font-size: 28rpx;
  color: $uni-text-color-grey;
}

.pending-item {
  display: flex;
  align-items: center;
  padding: 24rpx;
  background-color: #f9f9f9;
  border-radius: 16rpx;
  margin-bottom: 16rpx;
}

.item-thumb {
  width: 100rpx;
  height: 100rpx;
  border-radius: 12rpx;
  background-color: #e0e0e0;
  flex-shrink: 0;
}

.item-info {
  flex: 1;
  padding: 0 24rpx;
  min-width: 0;
}

.item-caption {
  font-size: 28rpx;
  color: $uni-text-color;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-bottom: 8rpx;
}

.item-status {
  font-size: 24rpx;

  &.pending {
    color: #856404;
  }

  &.syncing {
    color: $uni-color-primary;
  }

  &.failed {
    color: #ff4d4f;
  }
}

.item-actions {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  flex-shrink: 0;
}

.retry-btn,
.cancel-btn {
  padding: 12rpx 24rpx;
  border-radius: 8rpx;
  font-size: 24rpx;

  &:active {
    opacity: 0.8;
  }
}

.retry-btn {
  background-color: $uni-color-primary;
  color: #fff;
}

.cancel-btn {
  background-color: #f0f0f0;
  color: $uni-text-color-grey;
}
</style>
