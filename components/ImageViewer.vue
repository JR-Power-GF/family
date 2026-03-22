<template>
  <view v-if="visible" class="image-viewer" @click="close">
    <view class="viewer-header" @click.stop>
      <text class="close-btn" @click="close">✕</text>
      <text class="counter">{{ currentIndex + 1 }} / {{ images.length }}</text>
    </view>

    <swiper
      class="image-swiper"
      :current="currentIndex"
      @change="onSwipeChange"
      @click.stop
    >
      <swiper-item v-for="(img, index) in images" :key="index">
        <view class="image-wrapper">
          <image
            :src="img"
            mode="aspectFit"
            class="full-image"
            @click.stop
            @load="onImageLoad(index)"
          />
        </view>
      </swiper-item>
    </swiper>

    <view class="viewer-footer" @click.stop>
      <button class="save-btn" @click="saveImage">保存图片</button>
    </view>
  </view>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  images: {
    type: Array,
    default: () => []
  },
  current: {
    type: Number,
    default: 0
  }
})

const emit = defineEmits(['close'])

const currentIndex = ref(0)

watch(() => props.visible, (val) => {
  if (val) {
    currentIndex.value = props.current
  }
})

function onSwipeChange(e) {
  currentIndex.value = e.detail.current
}

function onImageLoad(index) {
  // Image loaded
}

function close() {
  emit('close')
}

async function saveImage() {
  const currentImage = props.images[currentIndex.value]

  // If it's a cloud file, get temp URL first
  let downloadUrl = currentImage
  if (currentImage.startsWith('cloud://')) {
    try {
      const { fileList } = await wx.cloud.getTempFileURL({
        fileList: [currentImage]
      })
      if (fileList[0]?.tempFileURL) {
        downloadUrl = fileList[0].tempFileURL
      }
    } catch (e) {
      console.error('Failed to get temp URL:', e)
    }
  }

  uni.showLoading({ title: '保存中...' })

  try {
    // Download image first
    const { tempFilePath } = await uni.downloadFile({ url: downloadUrl })

    // Save to album
    await uni.saveImageToPhotosAlbum({ filePath: tempFilePath })

    uni.hideLoading()
    uni.showToast({
      title: '已保存到相册',
      icon: 'success'
    })
  } catch (error) {
    uni.hideLoading()
    console.error('Failed to save image:', error)

    if (error.errMsg?.includes('auth deny')) {
      uni.showModal({
        title: '提示',
        content: '请授权访问相册',
        confirmText: '去设置',
        success: (res) => {
          if (res.confirm) {
            uni.openSetting()
          }
        }
      })
    } else {
      uni.showToast({
        title: '保存失败',
        icon: 'none'
      })
    }
  }
}
</script>

<style lang="scss" scoped>
.image-viewer {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.95);
  z-index: 9999;
  display: flex;
  flex-direction: column;
}

.viewer-header {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 100rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32rpx;
  padding-top: env(safe-area-inset-top);
  z-index: 10;
}

.close-btn {
  color: #fff;
  font-size: 48rpx;
  padding: 16rpx;
}

.counter {
  color: #fff;
  font-size: 28rpx;
  opacity: 0.8;
}

.image-swiper {
  flex: 1;
  width: 100%;
}

.image-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.full-image {
  width: 100%;
  height: 100%;
}

.viewer-footer {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 32rpx;
  padding-bottom: calc(32rpx + env(safe-area-inset-bottom));
  display: flex;
  justify-content: center;
  z-index: 10;
}

.save-btn {
  background-color: rgba(255, 255, 255, 0.2);
  color: #fff;
  font-size: 28rpx;
  padding: 20rpx 48rpx;
  border-radius: 40rpx;
  border: none;

  &:active {
    background-color: rgba(255, 255, 255, 0.3);
  }
}
</style>
