<template>
  <view class="add-story-page">
    <!-- Photo area -->
    <view class="photo-area" @click="choosePhotoSource">
      <image
        v-if="photoPath"
        :src="photoPath"
        mode="aspectFill"
        class="photo-preview"
      />
      <view v-else class="photo-placeholder">
        <text class="placeholder-icon">📷</text>
        <text class="placeholder-text">点击添加照片</text>
      </view>
    </view>

    <!-- Source buttons -->
    <view class="source-buttons">
      <button class="source-btn" @click="chooseFromAlbum">
        <text class="btn-icon">📷</text>
        <text class="btn-label">相册</text>
      </button>
      <button class="source-btn" @click="takePhoto">
        <text class="btn-icon">📸</text>
        <text class="btn-label">拍照</text>
      </button>
    </view>

    <!-- Caption input -->
    <view class="caption-area">
      <textarea
        v-model="caption"
        class="caption-input"
        placeholder="写下你的故事..."
        :maxlength="500"
        auto-height
      />
      <text class="char-count">{{ caption.length }}/500</text>
    </view>

    <!-- Post button -->
    <view class="button-area">
      <button
        class="post-btn"
        :disabled="!canPost || posting"
        @click="postStory"
      >
        {{ posting ? '发布中...' : '发布' }}
      </button>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { storiesApi } from '../../api/index.js'

const photoPath = ref('')
const caption = ref('')
const posting = ref(false)

const canPost = computed(() => photoPath.value && caption.value.trim())

function choosePhotoSource() {
  uni.showActionSheet({
    itemList: ['从相册选择', '拍照'],
    success: (res) => {
      if (res.tapIndex === 0) {
        chooseFromAlbum()
      } else {
        takePhoto()
      }
    }
  })
}

function chooseFromAlbum() {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album'],
    success: (res) => {
      photoPath.value = res.tempFilePaths[0]
    }
  })
}

function takePhoto() {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['camera'],
    success: (res) => {
      photoPath.value = res.tempFilePaths[0]
    }
  })
}

async function postStory() {
  if (!canPost.value || posting.value) return

  posting.value = true

  try {
    // Call API to create story
    await storiesApi.createStory({
      photoFile: { path: photoPath.value },
      caption: caption.value.trim()
    })

    // Show success toast
    uni.showToast({
      title: '发布成功！',
      icon: 'success',
      duration: 2000
    })

    // Navigate back to timeline
    setTimeout(() => {
      uni.navigateBack()
    }, 500)
  } catch (error) {
    console.error('Failed to post story:', error)
    uni.showToast({
      title: '发布失败，请重试',
      icon: 'none',
      duration: 2000
    })
  } finally {
    posting.value = false
  }
}
</script>

<style lang="scss" scoped>
.add-story-page {
  padding: 32rpx;
  min-height: 100vh;
  background-color: $uni-bg-color-grey;
}

.photo-area {
  width: 100%;
  height: 500rpx;
  background-color: #fff;
  border-radius: 24rpx;
  border: 4rpx dashed #ccc;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  margin-bottom: 32rpx;

  &:active {
    opacity: 0.8;
  }
}

.photo-preview {
  width: 100%;
  height: 100%;
}

.photo-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.placeholder-icon {
  font-size: 80rpx;
  margin-bottom: 16rpx;
}

.placeholder-text {
  font-size: 28rpx;
  color: $uni-text-color-grey;
}

.source-buttons {
  display: flex;
  gap: 24rpx;
  margin-bottom: 32rpx;
}

.source-btn {
  flex: 1;
  height: 88rpx;
  background-color: #fff;
  border: 2rpx solid $uni-border-color;
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;

  &:active {
    background-color: #f5f5f5;
  }
}

.btn-icon {
  font-size: 36rpx;
}

.btn-label {
  font-size: 28rpx;
  color: $uni-text-color;
}

.caption-area {
  background-color: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 32rpx;
}

.caption-input {
  width: 100%;
  min-height: 200rpx;
  font-size: 32rpx;
  color: $uni-text-color;
  line-height: 1.5;
}

.char-count {
  font-size: 24rpx;
  color: $uni-text-color-grey;
  text-align: right;
  display: block;
  margin-top: 16rpx;
}

.button-area {
  padding: 0;
}

.post-btn {
  width: 100%;
  height: 88rpx;
  background-color: $uni-color-primary;
  color: #fff;
  font-size: 32rpx;
  font-weight: 500;
  border-radius: 16rpx;
  border: none;

  &:active:not([disabled]) {
    opacity: 0.8;
  }

  &[disabled] {
    opacity: 0.3;
  }
}
</style>
