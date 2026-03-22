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

    <!-- Upload progress -->
    <view v-if="uploadProgress > 0 && uploadProgress < 100" class="progress-area">
      <view class="progress-bar">
        <view class="progress-fill" :style="{ width: uploadProgress + '%' }"></view>
      </view>
      <text class="progress-text">上传中 {{ uploadProgress }}%</text>
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
import { getCompressedImage } from '../../utils/image.js'

const photoPath = ref('')
const caption = ref('')
const posting = ref(false)
const uploadProgress = ref(0)

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
    sizeType: ['original'],
    sourceType: ['album'],
    success: (res) => {
      photoPath.value = res.tempFilePaths[0]
    },
    fail: (err) => {
      if (err.errMsg?.includes('auth deny')) {
        uni.showToast({
          title: '请授权访问相册',
          icon: 'none'
        })
      }
    }
  })
}

function takePhoto() {
  uni.chooseImage({
    count: 1,
    sizeType: ['original'],
    sourceType: ['camera'],
    success: (res) => {
      photoPath.value = res.tempFilePaths[0]
    },
    fail: (err) => {
      if (err.errMsg?.includes('auth deny')) {
        uni.showToast({
          title: '请授权访问相机',
          icon: 'none'
        })
      }
    }
  })
}

async function postStory() {
  if (!canPost.value || posting.value) return

  posting.value = true
  uploadProgress.value = 0

  try {
    // Step 1: Compress image
    uploadProgress.value = 10
    uni.showLoading({ title: '压缩图片...', mask: true })

    const compressed = await getCompressedImage(photoPath.value, {
      maxSizeKB: 500,
      quality: 80
    })

    uni.hideLoading()
    uploadProgress.value = 30

    // Step 2: Upload to cloud with progress
    const story = await storiesApi.createStory({
      photoFile: { path: compressed.path },
      caption: caption.value.trim()
    }, (progress) => {
      // Upload progress callback (30-90%)
      uploadProgress.value = 30 + Math.floor(progress * 0.6)
    })

    uploadProgress.value = 100

    // Show success
    uni.showToast({
      title: '发布成功！',
      icon: 'success',
      duration: 1500
    })

    // Navigate back
    setTimeout(() => {
      uni.navigateBack()
    }, 500)

  } catch (error) {
    uni.hideLoading()
    console.error('Failed to post story:', error)

    let errorMsg = '发布失败，请重试'
    if (error.errMsg?.includes('network')) {
      errorMsg = '网络错误，请检查网络连接'
    } else if (error.errMsg?.includes('upload')) {
      errorMsg = '图片上传失败，请重试'
    }

    uni.showToast({
      title: errorMsg,
      icon: 'none',
      duration: 2500
    })
    uploadProgress.value = 0
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
  font-size: 32rpx;
  color: $uni-text-color-grey;
}

.source-buttons {
  display: flex;
  gap: 24rpx;
  margin-bottom: 32rpx;
}

.source-btn {
  flex: 1;
  height: 96rpx;
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
  font-size: 40rpx;
}

.btn-label {
  font-size: 32rpx;
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
  font-size: 36rpx;
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

.progress-area {
  padding: 24rpx 0;
}

.progress-bar {
  height: 8rpx;
  background-color: #e0e0e0;
  border-radius: 4rpx;
  overflow: hidden;
  margin-bottom: 12rpx;
}

.progress-fill {
  height: 100%;
  background-color: $uni-color-primary;
  border-radius: 4rpx;
  transition: width 0.2s ease;
}

.progress-text {
  font-size: 24rpx;
  color: $uni-color-primary;
  text-align: center;
  display: block;
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
