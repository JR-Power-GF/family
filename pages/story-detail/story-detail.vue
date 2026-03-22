<template>
  <view class="detail-page">
    <!-- Loading -->
    <view v-if="loading" class="loading-area">
      <text>加载中...</text>
    </view>

    <!-- Story content -->
    <view v-else-if="story" class="story-content">
      <!-- Full photo -->
      <image
        :src="displayPhotoUrl"
        mode="widthFix"
        class="full-photo"
        lazy-load
      />

      <!-- Caption (view or edit mode) -->
      <view class="caption-section">
        <textarea
          v-if="isEditing"
          v-model="editCaption"
          class="edit-textarea"
          :maxlength="500"
          auto-height
          focus
        />
        <text v-else class="full-caption">{{ story.caption }}</text>
      </view>

      <!-- Action buttons -->
      <view v-if="isOwner && !isEditing" class="action-section">
        <button class="action-btn edit-btn" @click="startEdit">
          <text>编辑</text>
        </button>
        <button class="action-btn delete-btn" @click="confirmDelete">
          <text>删除</text>
        </button>
      </view>

      <!-- Edit buttons -->
      <view v-if="isEditing" class="edit-buttons">
        <button class="edit-action-btn cancel-btn" @click="cancelEdit">取消</button>
        <button class="edit-action-btn save-btn" :disabled="saving" @click="saveEdit">
          {{ saving ? '保存中...' : '保存' }}
        </button>
      </view>

      <!-- Meta info -->
      <view class="meta-section">
        <view class="meta-divider"></view>
        <view class="author-row">
          <image :src="displayAvatar" class="author-avatar" mode="aspectFill" />
          <text class="author-name">{{ story.authorName }}</text>
        </view>
        <text class="story-date">{{ formattedDate }}</text>
      </view>
    </view>

    <!-- Not found -->
    <view v-else class="not-found">
      <text>故事不存在</text>
      <button class="back-btn" @click="goBack">返回</button>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { storiesApi } from '../../api/index.js'

const story = ref(null)
const loading = ref(true)
const tempPhotoUrl = ref('')
const tempAvatarUrl = ref('')
const isOwner = ref(false)
const isEditing = ref(false)
const editCaption = ref('')
const saving = ref(false)

const displayPhotoUrl = computed(() => {
  if (story.value?.photoUrl?.startsWith('cloud://')) {
    return tempPhotoUrl.value || story.value.photoUrl
  }
  return story.value?.photoUrl || ''
})

const displayAvatar = computed(() => {
  if (story.value?.authorAvatar?.startsWith('cloud://')) {
    return tempAvatarUrl.value || story.value.authorAvatar
  }
  return story.value?.authorAvatar || ''
})

const formattedDate = computed(() => {
  if (!story.value) return ''
  const date = new Date(story.value.createdAt)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
})

onMounted(async () => {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  const storyId = currentPage.options?.id

  if (!storyId) {
    loading.value = false
    return
  }

  try {
    story.value = await storiesApi.getStory(storyId)

    if (story.value) {
      await convertCloudUrls()
      // Check if current user is the owner
      isOwner.value = await storiesApi.isStoryOwner(storyId)
    }
  } catch (error) {
    console.error('Failed to load story:', error)
    story.value = null
    uni.showToast({
      title: '加载失败',
      icon: 'none'
    })
  } finally {
    loading.value = false
  }
})

async function convertCloudUrls() {
  const fileIds = []

  if (story.value.photoUrl?.startsWith('cloud://')) {
    fileIds.push(story.value.photoUrl)
  }
  if (story.value.authorAvatar?.startsWith('cloud://')) {
    fileIds.push(story.value.authorAvatar)
  }

  if (fileIds.length === 0) return

  try {
    const { fileList } = await wx.cloud.getTempFileURL({ fileList: fileIds })

    fileList.forEach(file => {
      if (file.tempFileURL) {
        if (file.fileID === story.value.photoUrl) {
          tempPhotoUrl.value = file.tempFileURL
        } else if (file.fileID === story.value.authorAvatar) {
          tempAvatarUrl.value = file.tempFileURL
        }
      }
    })
  } catch (e) {
    console.error('Failed to get temp URLs:', e)
  }
}

function startEdit() {
  editCaption.value = story.value.caption
  isEditing.value = true
}

function cancelEdit() {
  isEditing.value = false
  editCaption.value = ''
}

async function saveEdit() {
  if (!editCaption.value.trim()) {
    uni.showToast({
      title: '内容不能为空',
      icon: 'none'
    })
    return
  }

  saving.value = true

  try {
    story.value = await storiesApi.updateStory(story.value.id || story.value._id, {
      caption: editCaption.value.trim()
    })
    isEditing.value = false
    uni.showToast({
      title: '修改成功',
      icon: 'success'
    })
  } catch (error) {
    console.error('Failed to update story:', error)
    uni.showToast({
      title: '修改失败',
      icon: 'none'
    })
  } finally {
    saving.value = false
  }
}

function confirmDelete() {
  uni.showModal({
    title: '确认删除',
    content: '删除后无法恢复，确定要删除吗？',
    confirmColor: '#ff4d4f',
    success: (res) => {
      if (res.confirm) {
        deleteStory()
      }
    }
  })
}

async function deleteStory() {
  uni.showLoading({ title: '删除中...', mask: true })

  try {
    await storiesApi.deleteStory(story.value.id || story.value._id)
    uni.hideLoading()
    uni.showToast({
      title: '删除成功',
      icon: 'success'
    })
    setTimeout(() => {
      uni.navigateBack()
    }, 500)
  } catch (error) {
    uni.hideLoading()
    console.error('Failed to delete story:', error)
    uni.showToast({
      title: '删除失败',
      icon: 'none'
    })
  }
}

function goBack() {
  uni.navigateBack()
}
</script>

<style lang="scss" scoped>
.detail-page {
  min-height: 100vh;
  background-color: $uni-bg-color;
}

.loading-area {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  color: $uni-text-color-grey;
}

.full-photo {
  width: 100%;
  background-color: #f0f0f0;
}

.caption-section {
  padding: 32rpx;
}

.full-caption {
  font-size: 38rpx;
  color: $uni-text-color;
  line-height: 1.6;
}

.edit-textarea {
  width: 100%;
  min-height: 200rpx;
  font-size: 38rpx;
  color: $uni-text-color;
  line-height: 1.6;
  background-color: #f9f9f9;
  border-radius: 12rpx;
  padding: 24rpx;
  box-sizing: border-box;
}

.action-section {
  display: flex;
  gap: 24rpx;
  padding: 0 32rpx;
  margin-bottom: 32rpx;
}

.action-btn {
  flex: 1;
  height: 72rpx;
  font-size: 28rpx;
  border-radius: 12rpx;
  border: none;

  &.edit-btn {
    background-color: #f0f0f0;
    color: $uni-text-color;
  }

  &.delete-btn {
    background-color: #fff1f0;
    color: #ff4d4f;
  }

  &:active {
    opacity: 0.7;
  }
}

.edit-buttons {
  display: flex;
  gap: 24rpx;
  padding: 0 32rpx;
  margin-bottom: 32rpx;
}

.edit-action-btn {
  flex: 1;
  height: 80rpx;
  font-size: 30rpx;
  border-radius: 12rpx;
  border: none;

  &.cancel-btn {
    background-color: #f0f0f0;
    color: $uni-text-color-grey;
  }

  &.save-btn {
    background-color: $uni-color-primary;
    color: #fff;

    &[disabled] {
      opacity: 0.5;
    }
  }

  &:active:not([disabled]) {
    opacity: 0.8;
  }
}

.meta-section {
  padding: 0 32rpx 32rpx;
}

.meta-divider {
  height: 1px;
  background-color: #eee;
  margin-bottom: 24rpx;
}

.author-row {
  display: flex;
  align-items: center;
  margin-bottom: 12rpx;
}

.author-avatar {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  margin-right: 16rpx;
  background-color: #f0f0f0;
}

.author-name {
  font-size: 28rpx;
  color: $uni-text-color;
  font-weight: 500;
}

.story-date {
  font-size: 26rpx;
  color: $uni-text-color-grey;
}

.not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  color: $uni-text-color-grey;
}

.back-btn {
  margin-top: 32rpx;
  background-color: $uni-color-primary;
  color: #fff;
  font-size: 28rpx;
  border-radius: 12rpx;
  padding: 20rpx 40rpx;
}
</style>
