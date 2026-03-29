<template>
  <view class="welcome-page">
    <!-- Background -->
    <view class="bg-gradient"></view>

    <!-- Checking state -->
    <view v-if="checking" class="checking-state">
      <text class="checking-text">加载中...</text>
    </view>

    <!-- Content -->
    <view v-else class="content">
      <!-- Logo -->
      <view class="logo-section">
        <text class="logo-icon">👨‍👩‍👧‍👦</text>
        <text class="logo-title">温暖一大家</text>
        <text class="logo-subtitle">记录家庭美好时光</text>
      </view>

      <!-- Welcome Message -->
      <view class="welcome-section">
        <text class="welcome-title">欢迎使用</text>
        <text class="welcome-desc">获取你的微信头像和昵称，让家人认识你</text>
      </view>

      <!-- Avatar Preview -->
      <view class="avatar-section" v-if="tempAvatar">
        <image class="avatar-preview" :src="tempAvatar" mode="aspectFill" />
        <text class="nickname-preview">{{ tempNickname || '微信用户' }}</text>
      </view>

      <!-- Buttons -->
      <view class="button-section">
        <button v-if="!tempAvatar" class="auth-btn" @click="getUserProfile">
          <text class="btn-icon">👤</text>
          <text>使用微信头像和昵称</text>
        </button>

        <template v-else>
          <button class="confirm-btn" @click="confirmProfile" :disabled="saving">
            {{ saving ? '保存中...' : '确认使用' }}
          </button>
          <button class="change-btn" @click="getUserProfile">
            <text>换一个</text>
          </button>
        </template>

        <button class="skip-btn" @click="skipAuth">
          <text>暂时跳过</text>
        </button>
      </view>

      <!-- Tips -->
      <view class="tips-section">
        <text class="tip-text">• 头像和昵称将显示在家庭故事中</text>
        <text class="tip-text">• 稍后可以在"我的"页面修改</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const tempAvatar = ref('')
const tempNickname = ref('')
const saving = ref(false)
const checking = ref(true)

// Check if user already has profile
onMounted(() => {
  // Initialize cloud
  if (wx.cloud) {
    wx.cloud.init({
      env: 'cloud1-6geq4sla3d88052d',
      traceUser: true
    })
  }

  // Check local storage for completed welcome
  const welcomeCompleted = uni.getStorageSync('welcome_completed')
  if (welcomeCompleted === 'true' || welcomeCompleted === true) {
    uni.switchTab({
      url: '/pages/index/index'
    })
    return
  }

  checking.value = false
})

// Get user profile from WeChat
function getUserProfile() {
  uni.getUserProfile({
    desc: '用于展示你的头像和昵称',
    success: (res) => {
      console.log('getUserProfile success:', res)
      tempAvatar.value = res.userInfo.avatarUrl
      tempNickname.value = res.userInfo.nickName
    },
    fail: (err) => {
      console.error('getUserProfile fail:', err)
      uni.showToast({
        title: '获取失败，请重试',
        icon: 'none'
      })
    }
  })
}

// Confirm and save profile
async function confirmProfile() {
  if (!tempAvatar.value) {
    uni.showToast({
      title: '请先获取头像',
      icon: 'none'
    })
    return
  }

  saving.value = true

  try {
    // Upload avatar to cloud storage
    let avatarUrl = tempAvatar.value

    // If it's a WeChat CDN URL, we can use it directly or download and re-upload
    // For simplicity, we'll download and re-upload to ensure it persists
    if (tempAvatar.value.startsWith('http')) {
      try {
        // Download the avatar
        const downloadResult = await new Promise((resolve, reject) => {
          uni.downloadFile({
            url: tempAvatar.value,
            success: resolve,
            fail: reject
          })
        })

        if (downloadResult.tempFilePath) {
          // Upload to cloud storage
          const cloudPath = `avatars/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
          const uploadResult = await new Promise((resolve, reject) => {
            wx.cloud.uploadFile({
              cloudPath,
              filePath: downloadResult.tempFilePath,
              success: resolve,
              fail: reject
            })
          })
          avatarUrl = uploadResult.fileID
        }
      } catch (e) {
        console.error('Failed to upload avatar:', e)
        // Use original URL if upload fails
      }
    }

    // Get current user's openid
    const { result: userInfo } = await wx.cloud.callFunction({
      name: 'getUserInfo'
    }).catch(() => ({ result: { openid: null } }))

    if (!userInfo || !userInfo.openid) {
      throw new Error('获取用户信息失败')
    }

    // Update or create user profile in family_members
    const db = wx.cloud.database()
    const { data: existingMember } = await db.collection('family_members')
      .where({
        userId: userInfo.openid
      })
      .get()

    if (existingMember.length > 0) {
      // Update existing record
      await db.collection('family_members').doc(existingMember[0]._id).update({
        data: {
          nickName: tempNickname.value || '微信用户',
          avatar: avatarUrl
        }
      })
    } else {
      // This shouldn't happen normally, but handle it
      // User should have a family_members record from family page
      console.log('No family_members record found')
    }

    uni.showToast({
      title: '设置成功',
      icon: 'success'
    })

    // Mark welcome as completed
    uni.setStorageSync('welcome_completed', 'true')

    // Navigate to home
    setTimeout(() => {
      uni.switchTab({
        url: '/pages/index/index'
      })
    }, 1000)

  } catch (error) {
    console.error('Failed to save profile:', error)
    uni.showToast({
      title: error.message || '保存失败',
      icon: 'none'
    })
  } finally {
    saving.value = false
  }
}

// Skip authentication
function skipAuth() {
  uni.setStorageSync('welcome_completed', 'true')
  uni.switchTab({
    url: '/pages/index/index'
  })
}
</script>

<style lang="scss" scoped>
.welcome-page {
  min-height: 100vh;
  position: relative;
  overflow: hidden;
}

.bg-gradient {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 60%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 0 0 50% 50% / 0 0 80rpx 80rpx;
}

.checking-state {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
}

.checking-text {
  font-size: 32rpx;
  color: #fff;
}

.content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120rpx 48rpx 48rpx;
}

.logo-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 80rpx;
}

.logo-icon {
  font-size: 120rpx;
  margin-bottom: 24rpx;
}

.logo-title {
  font-size: 48rpx;
  font-weight: 700;
  color: #fff;
  margin-bottom: 12rpx;
}

.logo-subtitle {
  font-size: 28rpx;
  color: rgba(255, 255, 255, 0.85);
}

.welcome-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 48rpx;
}

.welcome-title {
  font-size: 40rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 16rpx;
}

.welcome-desc {
  font-size: 28rpx;
  color: #666;
  text-align: center;
}

.avatar-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 48rpx;
  padding: 40rpx;
  background: #fff;
  border-radius: 24rpx;
  box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.08);
}

.avatar-preview {
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
  margin-bottom: 20rpx;
  border: 4rpx solid #667eea;
}

.nickname-preview {
  font-size: 32rpx;
  font-weight: 500;
  color: #333;
}

.button-section {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24rpx;
}

.auth-btn,
.confirm-btn {
  width: 100%;
  height: 96rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
  border-radius: 48rpx;
  border: none;
  font-size: 32rpx;
  font-weight: 500;
}

.auth-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  box-shadow: 0 8rpx 24rpx rgba(102, 126, 234, 0.4);

  &:active {
    opacity: 0.9;
  }
}

.confirm-btn {
  background: linear-gradient(135deg, #52c41a 0%, #389e0d 100%);
  color: #fff;
  box-shadow: 0 8rpx 24rpx rgba(82, 196, 26, 0.4);

  &[disabled] {
    opacity: 0.6;
  }
}

.btn-icon {
  font-size: 36rpx;
}

.change-btn {
  background: transparent;
  color: #667eea;
  font-size: 28rpx;
  padding: 16rpx 48rpx;
  border: none;

  &:active {
    opacity: 0.7;
  }
}

.skip-btn {
  background: transparent;
  color: #999;
  font-size: 28rpx;
  padding: 20rpx;
  border: none;
  margin-top: 16rpx;

  &:active {
    opacity: 0.7;
  }
}

.tips-section {
  margin-top: 60rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
}

.tip-text {
  font-size: 24rpx;
  color: #999;
}
</style>
