<template>
  <view class="profile-page">
    <!-- Loading State -->
    <view v-if="loading" class="loading-container">
      <view class="loading-avatar"></view>
      <view class="loading-name"></view>
      <view class="loading-stats"></view>
      <view class="loading-list">
        <view class="loading-item"></view>
        <view class="loading-item"></view>
        <view class="loading-item"></view>
      </view>
    </view>

    <!-- Content -->
    <view v-else>
      <!-- Header -->
      <view class="profile-header" @click="openEditModal">
        <view class="avatar-wrapper">
          <image class="profile-avatar" :src="displayAvatar || defaultAvatar" mode="aspectFill" @error="onAvatarError" />
          <view class="avatar-edit-icon">
            <text>+</text>
          </view>
        </view>
        <view class="edit-hint">
          <text>点击编辑资料</text>
        </view>
        <view class="profile-info">
          <text class="profile-name">{{ displayName || '点击设置昵称' }}</text>
        </view>
      </view>

      <!-- Stats -->
      <view class="stats-row">
        <view class="stat-item">
          <text class="stat-value">{{ myStories.length }}</text>
          <text class="stat-label">我的故事</text>
        </view>
      </view>

      <!-- Story List with Pull to Refresh -->
      <scroll-view
        scroll-y
        class="story-scroll"
        refresher-enabled
        :refresher-triggered="refreshing"
        refresher-default-style="black"
        @refresherrefresh="onRefresh"
      >
        <!-- Refresh indicator -->
        <view class="refresh-container" slot="refresher">
          <text class="refresh-text">{{ refreshing ? '刷新中...' : '下拉刷新' }}</text>
        </view>

        <!-- My Story List -->
        <view v-if="myStories.length > 0" class="story-list">
          <view
            v-for="story in myStories"
            :key="story._id"
            class="story-item"
          >
            <image class="story-thumb" :src="getStoryThumb(story)" mode="aspectFill" @click="goToStory(story)" />
            <view class="story-info" @click="goToStory(story)">
              <text class="story-caption">{{ story.caption }}</text>
              <text class="story-date">{{ formatDate(story.createdAt) }}</text>
            </view>
            <view class="story-actions">
              <text class="action-edit" @click="editStory(story)">编辑</text>
              <text class="action-delete" @click="confirmDeleteStory(story)">删除</text>
            </view>
          </view>
        </view>

        <!-- Empty state -->
        <EmptyState v-else @add-story="goToAddStory" />
      </scroll-view>
    </view>

    <!-- Edit Profile Modal -->
    <view v-if="showEditModal" class="modal-overlay" @click="showEditModal = false">
      <view class="modal-content" @click.stop>
        <text class="modal-title">编辑资料</text>

        <view class="avatar-edit" @click="chooseAvatar" v-if="showEditModal">
          <image class="avatar-preview" :src="editAvatarPreview || displayAvatar || '/static/default-avatar.svg'" mode="aspectFill" @error="onAvatarError" />
          <text class="avatar-hint">点击更换头像</text>
        </view>

        <view class="form-item">
          <text class="form-label">昵称</text>
          <input
            class="form-input"
            v-model="editName"
            placeholder="输入昵称"
            :maxlength="20"
          />
        </view>

        <view class="modal-buttons">
          <button class="modal-btn cancel" @click="showEditModal = false">取消</button>
          <button class="modal-btn confirm" :disabled="savingProfile" @click="saveProfile">
            {{ savingProfile ? '保存中...' : '保存' }}
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { storiesApi } from '../../api/index.js'

// Lazy database initialization
let db = null
function getDb() {
  if (!db) db = wx.cloud.database()
  return db
}

// Default avatar (simple SVG as data URI)
const defaultAvatar = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Ccircle cx="50" cy="50" r="50" fill="%23e0e0e0"/%3E%3Ccircle cx="50" cy="40" r="18" fill="%23bdbdbd"/%3E%3Cellipse cx="50" cy="75" rx="28" ry="20" fill="%23bdbdbd"/%3E%3C/svg%3E'

// Loading state
const loading = ref(true)
const refreshing = ref(false)

const displayName = ref('')
const displayAvatar = ref('')
const myStories = ref([])
const currentUserId = ref('')
const storyThumbUrls = ref({}) // Map of story._id -> temp thumb URL

// Handle avatar load error (fall back to default)
function onAvatarError() {
  displayAvatar.value = ''
}

// Edit profile
const showEditModal = ref(false)
const editName = ref('')
const editAvatarPreview = ref('') // Temp URL for preview
const editAvatarFileId = ref('') // Cloud fileID to save
const savingProfile = ref(false)

onMounted(async () => {
  await loadProfile()
})

// Refresh when returning to this page
onShow(async () => {
  await loadProfile()
})

async function loadProfile() {
  loading.value = true

  try {
    // Get current user's openid
    const { result: userInfo } = await wx.cloud.callFunction({
      name: 'getUserInfo'
    }).catch(() => ({ result: { openid: null, nickName: '用户', avatarUrl: '' } }))

    currentUserId.value = userInfo.openid
    displayName.value = userInfo.nickName || '用户'

    if (userInfo.avatarUrl) {
      if (userInfo.avatarUrl.startsWith('cloud://')) {
        try {
          const { fileList } = await wx.cloud.getTempFileURL({
            fileList: [userInfo.avatarUrl]
          })
          displayAvatar.value = fileList[0]?.tempFileURL || userInfo.avatarUrl
        } catch (e) {
          displayAvatar.value = userInfo.avatarUrl
        }
      } else {
        displayAvatar.value = userInfo.avatarUrl
      }
    }

    // Load only current user's stories
    const { data: stories } = await getDb().collection('stories')
      .where({
        authorId: userInfo.openid
      })
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get()

    myStories.value = stories

    // Convert cloud:// URLs for story thumbnails
    await convertStoryThumbUrls(stories)

  } catch (error) {
    console.error('Failed to load profile:', error)
    displayName.value = '用户'
  } finally {
    loading.value = false
  }
}

// Convert cloud:// URLs to temp URLs for story thumbnails
async function convertStoryThumbUrls(stories) {
  const cloudFileIds = []

  // Collect all cloud:// photo URLs
  stories.forEach(story => {
    const thumbUrl = story.photoUrls?.[0] || story.photoUrl
    if (thumbUrl?.startsWith('cloud://')) {
      cloudFileIds.push({ storyId: story._id, fileID: thumbUrl })
    }
  })

  if (cloudFileIds.length === 0) return

  try {
    const { fileList } = await wx.cloud.getTempFileURL({
      fileList: cloudFileIds.map(item => item.fileID)
    })

    // Map storyId -> tempFileURL
    const urlMap = {}
    fileList.forEach(file => {
      const matchingItem = cloudFileIds.find(item => item.fileID === file.fileID)
      if (matchingItem && file.tempFileURL) {
        urlMap[matchingItem.storyId] = file.tempFileURL
      }
    })

    storyThumbUrls.value = urlMap
  } catch (e) {
    console.error('Failed to convert story thumb URLs:', e)
  }
}

// Pull to refresh
async function onRefresh() {
  refreshing.value = true

  try {
    // Reload stories only (not the full profile)
    const { result: userInfo } = await wx.cloud.callFunction({
      name: 'getUserInfo'
    }).catch(() => ({ result: { openid: currentUserId.value } }))

    const { data: stories } = await getDb().collection('stories')
      .where({
        authorId: currentUserId.value
      })
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get()

    myStories.value = stories
    await convertStoryThumbUrls(stories)
  } catch (e) {
    console.error('Refresh failed:', e)
    uni.showToast({
      title: '刷新失败',
      icon: 'none'
    })
  } finally {
    refreshing.value = false
  }
}

// Open edit modal and pre-fill current values
function openEditModal() {
  editName.value = displayName.value || ''
  editAvatarPreview.value = ''
  editAvatarFileId.value = ''
  showEditModal.value = true
}

function chooseAvatar() {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: async (res) => {
      const tempFilePath = res.tempFilePaths[0]

      uni.showLoading({ title: '上传中...', mask: true })

      try {
        // Upload avatar to cloud storage
        const cloudPath = `avatars/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
        const { fileID } = await wx.cloud.uploadFile({
          cloudPath,
          filePath: tempFilePath
        })

        // Store cloud fileID for saving to database
        editAvatarFileId.value = fileID

        // Get temp URL for preview display
        const { fileList } = await wx.cloud.getTempFileURL({
          fileList: [fileID]
        })

        editAvatarPreview.value = fileList[0]?.tempFileURL || fileID

        uni.hideLoading()
      } catch (error) {
        uni.hideLoading()
        console.error('Failed to upload avatar:', error)
        uni.showToast({
          title: '上传失败',
          icon: 'none'
        })
      }
    }
  })
}

async function saveProfile() {
  if (!editName.value.trim()) {
    uni.showToast({
      title: '请输入昵称',
      icon: 'none'
    })
    return
  }

  savingProfile.value = true

  try {
    // Determine the avatar to save (prefer cloud fileID, fallback to current)
    const avatarToSave = editAvatarFileId.value || displayAvatar.value
    const newName = editName.value.trim()

    // First, check if user has a family_members record
    const { data: existingMembers } = await getDb().collection('family_members')
      .where({
        userId: currentUserId.value
      })
      .get()

    if (existingMembers.length > 0) {
      // Update existing record
      const memberId = existingMembers[0]._id
      await getDb().collection('family_members')
        .doc(memberId)
        .update({
          data: {
            nickName: newName,
            avatar: avatarToSave
          }
        })
    } else {
      // Create new record (user might not have joined a family yet)
      await getDb().collection('family_members').add({
        data: {
          userId: currentUserId.value,
          nickName: newName,
          avatar: avatarToSave,
          isAdmin: false,
          joinedAt: getDb().serverDate()
        }
      })
    }

    // Update user's stories author info
    await getDb().collection('stories')
      .where({
        authorId: currentUserId.value
      })
      .update({
        data: {
          authorName: newName,
          authorAvatar: avatarToSave
        }
      })

    displayName.value = newName
    if (editAvatarPreview.value) {
      displayAvatar.value = editAvatarPreview.value
    }

    showEditModal.value = false
    editName.value = ''
    editAvatarPreview.value = ''
    editAvatarFileId.value = ''

    uni.showToast({
      title: '保存成功',
      icon: 'success'
    })
  } catch (error) {
    console.error('Failed to save profile:', error)
    uni.showToast({
      title: '保存失败',
      icon: 'none'
    })
  } finally {
    savingProfile.value = false
  }
}

function getStoryThumb(story) {
  // Return converted temp URL if available
  if (storyThumbUrls.value[story._id]) {
    return storyThumbUrls.value[story._id]
  }

  // Get the original URL
  const originalUrl = story.photoUrls?.[0] || story.photoUrl || ''

  // If it's a cloud:// URL that hasn't been converted yet, return empty
  // (prevents broken image from showing)
  if (originalUrl.startsWith('cloud://')) {
    return ''
  }

  return originalUrl
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

function goToAddStory() {
  uni.navigateTo({
    url: '/pages/add-story/add-story'
  })
}

function goToStory(story) {
  uni.navigateTo({
    url: `/pages/story-detail/story-detail?id=${story._id}`
  })
}

function editStory(story) {
  uni.navigateTo({
    url: `/pages/story-detail/story-detail?id=${story._id}`
  })
}

function confirmDeleteStory(story) {
  uni.showModal({
    title: '确认删除',
    content: '删除后无法恢复，确定要删除这个故事吗？',
    confirmColor: '#ff4d4f',
    success: (res) => {
      if (res.confirm) {
        deleteStory(story)
      }
    }
  })
}

async function deleteStory(story) {
  uni.showLoading({ title: '删除中...', mask: true })

  try {
    await storiesApi.deleteStory(story._id)

    // Remove from local list
    myStories.value = myStories.value.filter(s => s._id !== story._id)

    uni.hideLoading()
    uni.showToast({
      title: '删除成功',
      icon: 'success'
    })
  } catch (error) {
    uni.hideLoading()
    console.error('Failed to delete story:', error)
    uni.showToast({
      title: '删除失败',
      icon: 'none'
    })
  }
}
</script>

<style lang="scss" scoped>
.profile-page {
  min-height: 100vh;
  background-color: $uni-bg-color-grey;
}

.profile-header {
  padding: 48rpx 32rpx;
  background-color: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}

.edit-hint {
  position: absolute;
  top: 16rpx;
  right: 32rpx;
  font-size: 24rpx;
  color: $uni-text-color-grey;
}

.avatar-wrapper {
  position: relative;
  margin-bottom: 24rpx;
}

.profile-avatar {
  width: 180rpx;
  height: 180rpx;
  border-radius: 50%;
  background-color: #e0e0e0;
}

.avatar-edit-icon {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 48rpx;
  height: 48rpx;
  background-color: $uni-color-primary;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;

  text {
    color: #fff;
    font-size: 32rpx;
    font-weight: 300;
  }
}

.profile-info {
  flex: 1;
  text-align: center;
}

.profile-name {
  font-size: 40rpx;
  font-weight: 600;
  color: $uni-text-color;
  margin-bottom: 8rpx;
  display: block;
}

.profile-bio {
  font-size: 28rpx;
  color: $uni-text-color-grey;
  line-height: 1.5;
}

.stats-row {
  display: flex;
  justify-content: center;
  padding: 32rpx;
  background-color: #fff;
  margin-bottom: 32rpx;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24rpx 48rpx;
}

.stat-value {
  font-size: 48rpx;
  font-weight: 600;
  color: $uni-color-primary;
}

.stat-label {
  font-size: 24rpx;
  color: $uni-text-color-grey;
  margin-top: 8rpx;
}

.story-scroll {
  height: calc(100vh - 500rpx);
}

.refresh-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 80rpx;
}

.refresh-text {
  font-size: 24rpx;
  color: $uni-text-color-grey;
}

.story-list {
  padding: 0 32rpx;
}

.story-item {
  display: flex;
  align-items: center;
  background-color: #fff;
  border-radius: 24rpx;
  margin-bottom: 24rpx;
  padding: 16rpx;
  overflow: hidden;

  &:active {
    opacity: 0.8;
  }
}

.story-thumb {
  width: 120rpx;
  height: 120rpx;
  border-radius: 16rpx;
  background-color: #f0f0f0;
  flex-shrink: 0;
}

.story-info {
  flex: 1;
  padding: 0 16rpx;
  min-width: 0;
}

.story-caption {
  font-size: 28rpx;
  color: $uni-text-color;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}

.story-date {
  font-size: 24rpx;
  color: $uni-text-color-grey;
  margin-top: 8rpx;
  display: block;
}

.story-actions {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  flex-shrink: 0;
}

.action-edit,
.action-delete {
  font-size: 24rpx;
  padding: 8rpx 16rpx;
  border-radius: 8rpx;
}

.action-edit {
  color: $uni-color-primary;
  background-color: rgba(0, 122, 255, 0.1);
}

.action-delete {
  color: #ff4d4f;
  background-color: rgba(255, 77, 79, 0.1);
}

/* Modal styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  width: 600rpx;
  background-color: #fff;
  border-radius: 24rpx;
  padding: 48rpx;
}

.modal-title {
  font-size: 36rpx;
  font-weight: 600;
  color: $uni-text-color;
  text-align: center;
  margin-bottom: 32rpx;
  display: block;
}

.avatar-edit {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 32rpx;
  padding: 24rpx;
  background-color: #f5f5f5;
  border-radius: 16rpx;
}

.avatar-preview {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  background-color: #e0e0e0;
  margin-bottom: 16rpx;
}

.avatar-hint {
  font-size: 24rpx;
  color: $uni-text-color-grey;
}

.form-item {
  margin-bottom: 24rpx;
}

.form-label {
  font-size: 28rpx;
  color: $uni-text-color;
  margin-bottom: 12rpx;
  display: block;
}

.form-input {
  width: 100%;
  height: 80rpx;
  background-color: #f5f5f5;
  border-radius: 12rpx;
  padding: 0 24rpx;
  font-size: 32rpx;
  box-sizing: border-box;
}

.modal-buttons {
  display: flex;
  gap: 24rpx;
  margin-top: 32rpx;
}

.modal-btn {
  flex: 1;
  height: 80rpx;
  font-size: 30rpx;
  border-radius: 40rpx;
  border: none;

  &.cancel {
    background-color: #f0f0f0;
    color: $uni-text-color-grey;
  }

  &.confirm {
    background-color: $uni-color-primary;
    color: #fff;

    &[disabled] {
      opacity: 0.5;
    }
  }
}

/* Loading skeleton styles */
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48rpx 32rpx;
}

.loading-avatar {
  width: 180rpx;
  height: 180rpx;
  border-radius: 50%;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
  margin-bottom: 24rpx;
}

.loading-name {
  width: 200rpx;
  height: 40rpx;
  border-radius: 8rpx;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
  margin-bottom: 32rpx;
}

.loading-stats {
  width: 100%;
  height: 100rpx;
  background: #fff;
  border-radius: 16rpx;
  margin-bottom: 32rpx;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
}

.loading-list {
  width: 100%;
  padding: 0 32rpx;
  box-sizing: border-box;
}

.loading-item {
  width: 100%;
  height: 152rpx;
  border-radius: 24rpx;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
  margin-bottom: 24rpx;
}

@keyframes skeleton-loading {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
</style>
