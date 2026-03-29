<template>
  <view class="add-story-page">
    <!-- Photo grid area -->
    <view class="photo-grid">
      <!-- Selected photos -->
      <view
        v-for="(photo, index) in photoPaths"
        :key="index"
        class="photo-item"
      >
        <image :src="photo" mode="aspectFill" class="photo-preview" />
        <view class="remove-btn" @click="removePhoto(index)">
          <text>✕</text>
        </view>
        <view v-if="index === 0" class="cover-badge">
          <text>封面</text>
        </view>
      </view>

      <!-- Add photo button (max MAX_PHOTOS) -->
      <view
        v-if="photoPaths.length < MAX_PHOTOS"
        class="photo-add"
        @click="choosePhotoSource"
      >
        <text class="add-icon">+</text>
        <text class="add-text">添加照片</text>
        <text class="add-count">{{ photoPaths.length }}/{{ MAX_PHOTOS }}</text>
      </view>
    </view>

    <!-- Source buttons -->
    <view class="source-buttons">
      <button class="source-btn" @click="chooseFromAlbum">
        <text class="btn-icon">📷</text>
        <text class="btn-label">从相册选择</text>
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
      <text class="progress-text">上传中 {{ uploadProgress }}% ({{ uploadedCount }}/{{ photoPaths.length }})</text>
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
import { isOnline, saveStoryToQueue, getPendingStories } from '../../utils/offline.js'

const MAX_PHOTOS = 9  // 3×3 grid, common pattern for photo pickers

const photoPaths = ref([])
const caption = ref('')
const posting = ref(false)
const uploadProgress = ref(0)
const uploadedCount = ref(0)

const canPost = computed(() => photoPaths.value.length > 0 && caption.value.trim())

function choosePhotoSource() {
  const remaining = MAX_PHOTOS - photoPaths.value.length

  uni.showActionSheet({
    itemList: ['从相册选择', '拍照'],
    success: (res) => {
      if (res.tapIndex === 0) {
        chooseFromAlbum(remaining)
      } else {
        takePhoto()
      }
    }
  })
}

function chooseFromAlbum(maxCount = MAX_PHOTOS) {
  const remaining = Math.min(maxCount, MAX_PHOTOS - photoPaths.value.length)

  uni.chooseImage({
    count: remaining,
    sizeType: ['original'],
    sourceType: ['album'],
    success: (res) => {
      photoPaths.value = [...photoPaths.value, ...res.tempFilePaths]
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
  if (photoPaths.value.length >= MAX_PHOTOS) {
    uni.showToast({
      title: `最多只能添加${MAX_PHOTOS}张照片`,
      icon: 'none'
    })
    return
  }

  uni.chooseImage({
    count: 1,
    sizeType: ['original'],
    sourceType: ['camera'],
    success: (res) => {
      photoPaths.value = [...photoPaths.value, ...res.tempFilePaths]
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

function removePhoto(index) {
  photoPaths.value.splice(index, 1)
}

async function postStory() {
  if (!canPost.value || posting.value) return

  posting.value = true
  uploadProgress.value = 0
  uploadedCount.value = 0

  try {
    // Check if online
    const online = await isOnline()

    if (!online) {
      // OFFLINE: Save to queue
      await postOffline()
      return
    }

    // ONLINE: Normal upload flow
    await postOnline()

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

// Online posting flow (existing logic extracted)
async function postOnline() {
  const totalPhotos = photoPaths.value.length

  // Compress all photos first
  const compressedPhotos = []
  for (let i = 0; i < totalPhotos; i++) {
    uploadProgress.value = Math.floor((i / totalPhotos) * 20)
    uni.showLoading({ title: `压缩图片 ${i + 1}/${totalPhotos}...`, mask: true })

    const compressed = await getCompressedImage(photoPaths.value[i], {
      maxSizeKB: 500,
      quality: 80
    })
    compressedPhotos.push({ path: compressed.path })
  }
  uni.hideLoading()

  // Upload all photos and create story
  uploadProgress.value = 20

  await storiesApi.createStory({
    photoFiles: compressedPhotos,
    caption: caption.value.trim()
  }, (progress) => {
    // Upload progress (20-100%)
    uploadProgress.value = 20 + Math.floor(progress * 0.8)
    uploadedCount.value = Math.ceil((progress / 100) * totalPhotos)
  })

  uploadProgress.value = 100
  uploadedCount.value = totalPhotos

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
}

// Offline posting flow
async function postOffline() {
  // Get user info for story metadata
  const { result: userInfo } = await wx.cloud.callFunction({
    name: 'getUserInfo'
  }).catch(() => ({
    result: {
      openid: 'anonymous',
      nickName: '匿名用户',
      avatarUrl: ''
    }
  }))

  // Compress photos for local storage
  const compressedPhotos = []
  for (let i = 0; i < photoPaths.value.length; i++) {
    const compressed = await getCompressedImage(photoPaths.value[i], {
      maxSizeKB: 500,
      quality: 80
    })
    compressedPhotos.push({ path: compressed.path })
  }

  // Save to offline queue
  const localId = saveStoryToQueue({
    photoFiles: compressedPhotos,
    caption: caption.value.trim(),
    authorId: userInfo.openid,
    authorName: userInfo.nickName || '匿名用户',
    authorAvatar: userInfo.avatarUrl || ''
  })

  if (!localId) {
    throw new Error('Failed to save to offline queue')
  }

  // Show success toast
  uni.showToast({
    title: '已保存，联网后自动同步',
    icon: 'none',
    duration: 2000
  })

  // Navigate back (index page will show pending story)
  setTimeout(() => {
    uni.navigateBack()
  }, 500)
}
</script>

<style lang="scss" scoped>
.add-story-page {
  padding: 32rpx;
  min-height: 100vh;
  background-color: $uni-bg-color-grey;
  padding-bottom: 200rpx;
}

.photo-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-bottom: 32rpx;
}

.photo-item {
  width: calc(33.33% - 12rpx);
  height: 200rpx;
  position: relative;
  border-radius: 12rpx;
  overflow: hidden;
}

.photo-preview {
  width: 100%;
  height: 100%;
  background-color: #f0f0f0;
}

.remove-btn {
  position: absolute;
  top: 8rpx;
  right: 8rpx;
  width: 40rpx;
  height: 40rpx;
  background-color: rgba(0, 0, 0, 0.5);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;

  text {
    color: #fff;
    font-size: 24rpx;
  }

  &:active {
    opacity: 0.8;
  }
}

.cover-badge {
  position: absolute;
  bottom: 8rpx;
  left: 8rpx;
  background-color: $uni-color-primary;
  color: #fff;
  font-size: 20rpx;
  padding: 4rpx 12rpx;
  border-radius: 4rpx;
}

.photo-add {
  width: calc(33.33% - 12rpx);
  height: 200rpx;
  background-color: #fff;
  border: 2rpx dashed #ccc;
  border-radius: 12rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;

  &:active {
    background-color: #f5f5f5;
  }
}

.add-icon {
  font-size: 48rpx;
  color: $uni-text-color-grey;
  margin-bottom: 8rpx;
}

.add-text {
  font-size: 24rpx;
  color: $uni-text-color-grey;
}

.add-count {
  font-size: 20rpx;
  color: $uni-text-color-grey;
  opacity: 0.7;
  margin-top: 4rpx;
}

.source-buttons {
  display: flex;
  gap: 24rpx;
  margin-bottom: 32rpx;
}

.source-btn {
  flex: 1;
  height: 86rpx;
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
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 24rpx 32rpx;
  padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
  background-color: #fff;
  box-shadow: 0 -2rpx 10rpx rgba(0, 0, 0, 0.05);
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
