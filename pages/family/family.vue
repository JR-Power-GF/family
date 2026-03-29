<template>
  <view class="family-page">
    <!-- Loading State -->
    <view v-if="loading" class="loading-container">
      <view class="loading-header"></view>
      <view class="loading-card"></view>
      <view class="loading-members">
        <view class="loading-member-item"></view>
        <view class="loading-member-item"></view>
      </view>
    </view>

    <!-- Content -->
    <view v-else>
      <!-- Connection Error State -->
      <view v-if="connectionError" class="error-state">
        <text class="error-icon">⚠️</text>
        <text class="error-title">无法连接到服务器</text>
        <text class="error-desc">请检查：</text>
        <text class="error-tip">1. 是否在微信开发者工具中</text>
        <text class="error-tip">2. 云开发是否已开通</text>
        <text class="error-tip">3. 云函数 getUserInfo 是否已部署</text>
        <button class="retry-btn" @click="loadFamilyData">重新加载</button>
      </view>

      <!-- Normal Content -->
      <view v-else>
        <!-- Header with gradient -->
      <view class="header-section">
        <view class="header-bg"></view>
        <view class="header-content">
          <text class="header-icon">👨‍👩‍👧‍👦</text>
          <text class="header-title">我的家庭</text>
          <text class="header-subtitle">{{ members.length }} 位成员</text>
        </view>
      </view>

      <!-- Invite Code Card -->
      <view class="invite-section">
        <view class="invite-card">
          <view class="invite-header">
            <text class="invite-label">邀请家人加入</text>
            <view class="invite-divider"></view>
          </view>
          <view class="invite-code-wrapper">
            <text class="invite-code-char" v-for="(char, index) in (inviteCode || '------').split('')" :key="index">{{ char }}</text>
          </view>
          <view class="invite-actions">
            <button class="action-btn-primary" @click="copyInviteCode">
              <text class="btn-icon">📋</text>
              <text>复制邀请码</text>
            </button>
            <button class="action-btn-secondary" open-type="share">
              <text class="btn-icon">📤</text>
              <text>分享给微信好友</text>
            </button>
          </view>
        </view>
        <text class="invite-tip">家人通过邀请码即可加入</text>
      </view>

      <!-- Members List -->
      <view class="members-section">
        <view class="section-header">
          <text class="section-title">成员列表</text>
          <text class="member-count-badge">{{ members.length }} 人</text>
        </view>

        <view class="members-list">
          <view v-for="member in members" :key="member._id" class="member-card">
            <view class="member-avatar-wrap">
              <image class="member-avatar" :src="member.avatar || '/static/default-avatar.svg'" mode="aspectFill" @error="() => member.avatar = ''" />
              <view v-if="member.isAdmin" class="admin-dot"></view>
            </view>
            <view class="member-info">
              <view class="member-name-row">
                <text class="member-name">{{ member.nickName || '匿名用户' }}</text>
                <view v-if="member.isAdmin" class="admin-tag">
                  <text>管理员</text>
                </view>
              </view>
              <text class="member-joined">{{ formatDate(member.joinedAt) }} 加入</text>
            </view>
            <!-- Admin actions -->
            <view
              v-if="isAdmin && !member.isAdmin && member.userId !== currentUserId"
              class="member-actions"
            >
              <view class="action-icon-btn" @click="confirmTransferAdmin(member)">
                <text>👑</text>
              </view>
              <view class="action-icon-btn danger" @click="confirmRemoveMember(member)">
                <text>✕</text>
              </view>
            </view>
          </view>
        </view>

        <!-- Empty State -->
        <view v-if="members.length === 0" class="empty-state">
          <text class="empty-icon">👋</text>
          <text class="empty-text">还没有家庭成员</text>
          <text class="empty-tip">分享邀请码邀请家人加入吧</text>
        </view>
      </view>
    </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'

// Lazy database initialization
let db = null
function getDb() {
  if (!db) {
    db = wx.cloud.database()
  }
  return db
}

const loading = ref(true)
const connectionError = ref(false)
const inviteCode = ref('')
const members = ref([])
const isAdmin = ref(false)
const currentUserId = ref('')
const currentFamilyId = ref('')

onMounted(async () => {
  await loadFamilyData()
})

// Share handler
const onShareAppMessage = () => {
  return {
    title: '邀请你加入我的家庭',
    path: `/pages/family/family?inviteCode=${inviteCode.value}`,
    imageUrl: '/static/logo.png'
  }
}

defineExpose({
  onShareAppMessage
})

async function loadFamilyData() {
  loading.value = true
  connectionError.value = false

  try {
    // Get current user's openid
    const { result: userInfo } = await wx.cloud.callFunction({
      name: 'getUserInfo'
    }).catch((e) => {
      console.error('Cloud function error:', e)
      return { result: { openid: null, nickName: '匿名用户', avatarUrl: '' } }
    })

    if (!userInfo || !userInfo.openid) {
      connectionError.value = true
      loading.value = false
      return
    }

    currentUserId.value = userInfo.openid

    // Check if user is in a family
    const { data: memberRecord } = await getDb().collection('family_members')
      .where({
        userId: userInfo.openid
      })
      .get()

    if (memberRecord.length === 0) {
      // Create a new family for this user
      const inviteCode_gen = generateInviteCode()
      const { _id: familyId } = await getDb().collection('families').add({
        data: {
          inviteCode: inviteCode_gen,
          createdBy: userInfo.openid,
          createdAt: getDb().serverDate()
        }
      })

      await getDb().collection('family_members').add({
        data: {
          familyId,
          userId: userInfo.openid,
          nickName: userInfo.nickName || '匿名用户',
          avatar: userInfo.avatarUrl || '',
          isAdmin: true,
          joinedAt: getDb().serverDate()
        }
      })

      inviteCode.value = inviteCode_gen
      currentFamilyId.value = familyId
      isAdmin.value = true
      members.value = [{
        _id: 'self',
        userId: userInfo.openid,
        nickName: userInfo.nickName || '匿名用户',
        avatar: userInfo.avatarUrl || '',
        isAdmin: true,
        joinedAt: new Date()
      }]
    } else {
      const family = memberRecord[0]
      currentFamilyId.value = family.familyId
      isAdmin.value = family.isAdmin

      // Get invite code
      const familyData = await getDb().collection('families').doc(family.familyId).get()
      inviteCode.value = familyData.data.inviteCode

      // Get all members
      const { data: allMembers } = await getDb().collection('family_members')
        .where({
          familyId: family.familyId
        })
        .get()

      members.value = allMembers
    }
  } catch (error) {
    console.error('Failed to load family data:', error)
    uni.showToast({
      title: '加载失败',
      icon: 'none'
    })
  } finally {
    loading.value = false
  }
}

function confirmRemoveMember(member) {
  uni.showModal({
    title: '移除成员',
    content: `确定要将 ${member.nickName || '该成员'} 移出家庭吗？`,
    confirmColor: '#ff4d4f',
    success: (res) => {
      if (res.confirm) {
        removeMember(member)
      }
    }
  })
}

async function removeMember(member) {
  try {
    await getDb().collection('family_members').doc(member._id).remove()

    uni.showToast({
      title: '已移除',
      icon: 'success'
    })

    // Reload members
    await loadFamilyData()
  } catch (error) {
    console.error('Failed to remove member:', error)
    uni.showToast({
      title: '移除失败',
      icon: 'none'
    })
  }
}

function confirmTransferAdmin(member) {
  uni.showModal({
    title: '转让管理员',
    content: `确定要将管理员权限转让给 ${member.nickName || '该成员'} 吗？转让后您将成为普通成员。`,
    confirmColor: '#007AFF',
    success: (res) => {
      if (res.confirm) {
        transferAdmin(member)
      }
    }
  })
}

async function transferAdmin(member) {
  uni.showLoading({ title: '转让中...', mask: true })

  try {
    // Get current admin record
    const { data: currentAdmin } = await getDb().collection('family_members')
      .where({
        familyId: currentFamilyId.value,
        userId: currentUserId.value,
        isAdmin: true
      })
      .get()

    if (currentAdmin.length === 0) {
      throw new Error('找不到当前管理员记录')
    }

    // Remove admin from current user
    await getDb().collection('family_members').doc(currentAdmin[0]._id).update({
      data: {
        isAdmin: false
      }
    })

    // Set admin to new user
    await getDb().collection('family_members').doc(member._id).update({
      data: {
        isAdmin: true
      }
    })

    uni.hideLoading()
    uni.showToast({
      title: '转让成功',
      icon: 'success'
    })

    // Reload family data
    await loadFamilyData()

    // Navigate back to index page
    setTimeout(() => {
      uni.switchTab({
        url: '/pages/index/index'
      })
    }, 1000)
  } catch (error) {
    uni.hideLoading()
    console.error('Failed to transfer admin:', error)
    uni.showToast({
      title: '转让失败',
      icon: 'none'
    })
  }
}

function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

function copyInviteCode() {
  uni.setClipboardData({
    data: inviteCode.value,
    success: () => {
      uni.showToast({
        title: '已复制',
        icon: 'success'
      })
    }
  })
}

/**
 * Notify all admins when a new member joins the family
 */
async function notifyAdminsOfNewMember({ familyId, newMemberName, newMemberId }) {
  try {
    // Get all admins of this family
    const { data: admins } = await getDb().collection('family_members')
      .where({
        familyId,
        isAdmin: true
      })
      .get()

    // Create notification for each admin (except if the new member is an admin)
    for (const admin of admins) {
      if (admin.userId === newMemberId) continue

      await getDb().collection('notifications').add({
        data: {
          type: 'member_join',
          targetId: admin.userId,
          actorId: newMemberId,
          actorName: newMemberName,
          actorAvatar: '',
          storyId: null,
          preview: `${newMemberName} 加入了家庭`,
          isRead: false,
          createdAt: getDb().serverDate()
        }
      })
    }

    console.log(`[Family] Notified ${admins.length} admins of new member`)
  } catch (error) {
    console.error('[Family] Failed to notify admins:', error)
    // Don't fail the join operation if notification fails
  }
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric'
  })
}
</script>

<style lang="scss" scoped>
.family-page {
  min-height: 100vh;
  background-color: #f5f7fa;
  padding-bottom: 100rpx;
}

/* Header Section with Gradient */
.header-section {
  position: relative;
  padding: 48rpx 32rpx 80rpx;
  margin-bottom: -40rpx;
}

.header-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 100%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 0 0 48rpx 48rpx;
}

.header-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.header-icon {
  font-size: 64rpx;
  margin-bottom: 16rpx;
}

.header-title {
  font-size: 44rpx;
  font-weight: 700;
  color: #fff;
  margin-bottom: 8rpx;
}

.header-subtitle {
  font-size: 28rpx;
  color: rgba(255, 255, 255, 0.85);
}

/* Invite Card */
.invite-section {
  padding: 0 32rpx;
  margin-bottom: 32rpx;
}

.invite-card {
  background: #fff;
  border-radius: 24rpx;
  padding: 40rpx 32rpx;
  box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.08);
}

.invite-header {
  display: flex;
  align-items: center;
  margin-bottom: 32rpx;
}

.invite-label {
  font-size: 28rpx;
  color: #333;
  font-weight: 500;
}

.invite-divider {
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, #eee 0%, transparent 100%);
  margin-left: 24rpx;
}

.invite-code-wrapper {
  display: flex;
  justify-content: center;
  gap: 12rpx;
  margin-bottom: 32rpx;
}

.invite-code-char {
  width: 72rpx;
  height: 88rpx;
  background: linear-gradient(135deg, #f8f9ff 0%, #eef1ff 100%);
  border-radius: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40rpx;
  font-weight: 700;
  color: #667eea;
  box-shadow: 0 4rpx 12rpx rgba(102, 126, 234, 0.15);
}

.invite-actions {
  display: flex;
  gap: 20rpx;
}

.action-btn-primary,
.action-btn-secondary {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  padding: 24rpx 0;
  border-radius: 16rpx;
  font-size: 28rpx;
  font-weight: 500;
  border: none;

  .btn-icon {
    font-size: 32rpx;
  }
}

.action-btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  box-shadow: 0 6rpx 20rpx rgba(102, 126, 234, 0.35);

  &:active {
    opacity: 0.9;
    transform: scale(0.98);
  }
}

.action-btn-secondary {
  background: #f5f7fa;
  color: #333;

  &:active {
    background: #eef1f5;
  }
}

.invite-tip {
  display: block;
  text-align: center;
  font-size: 24rpx;
  color: #999;
  margin-top: 20rpx;
}

/* Members Section */
.members-section {
  margin: 0 32rpx;
  background: #fff;
  border-radius: 24rpx;
  padding: 32rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24rpx;
}

.section-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
}

.member-count-badge {
  font-size: 24rpx;
  color: #667eea;
  background: rgba(102, 126, 234, 0.1);
  padding: 6rpx 16rpx;
  border-radius: 20rpx;
}

.members-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.member-card {
  display: flex;
  align-items: center;
  padding: 20rpx;
  background: #f8f9fc;
  border-radius: 16rpx;
  transition: all 0.2s;

  &:active {
    background: #f0f2f7;
  }
}

.member-avatar-wrap {
  position: relative;
  margin-right: 20rpx;
}

.member-avatar {
  width: 80rpx;
  height: 80rpx;
  border-radius: 20rpx;
  background-color: #e0e0e0;
}

.admin-dot {
  position: absolute;
  bottom: -2rpx;
  right: -2rpx;
  width: 24rpx;
  height: 24rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 50%;
  border: 3rpx solid #fff;
}

.member-info {
  flex: 1;
}

.member-name-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 6rpx;
}

.member-name {
  font-size: 30rpx;
  color: #333;
  font-weight: 500;
}

.admin-tag {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  font-size: 20rpx;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
}

.member-joined {
  font-size: 24rpx;
  color: #999;
}

.member-actions {
  display: flex;
  gap: 12rpx;
}

.action-icon-btn {
  width: 56rpx;
  height: 56rpx;
  border-radius: 14rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(102, 126, 234, 0.1);
  font-size: 28rpx;

  &:active {
    opacity: 0.7;
  }

  &.danger {
    background: rgba(255, 77, 79, 0.1);
    color: #ff4d4f;
  }
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60rpx 0;
}

.empty-icon {
  font-size: 80rpx;
  margin-bottom: 20rpx;
}

.empty-text {
  font-size: 32rpx;
  color: #666;
  font-weight: 500;
  margin-bottom: 12rpx;
}

.empty-tip {
  font-size: 26rpx;
  color: #999;
}

/* Error State */
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80rpx 40rpx;
  margin: 0 32rpx;
  background: #fff;
  border-radius: 24rpx;
}

.error-icon {
  font-size: 80rpx;
  margin-bottom: 24rpx;
}

.error-title {
  font-size: 36rpx;
  color: #333;
  font-weight: 600;
  margin-bottom: 24rpx;
}

.error-desc {
  font-size: 28rpx;
  color: #666;
  margin-bottom: 16rpx;
}

.error-tip {
  font-size: 24rpx;
  color: #999;
  margin-bottom: 8rpx;
  align-self: flex-start;
  margin-left: 60rpx;
}

.retry-btn {
  margin-top: 32rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  font-size: 28rpx;
  padding: 20rpx 60rpx;
  border-radius: 40rpx;
  border: none;
}

/* Loading skeleton styles */
.loading-container {
  padding: 32rpx;
}

.loading-header {
  width: 300rpx;
  height: 48rpx;
  border-radius: 8rpx;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
  margin: 32rpx auto;
}

.loading-card {
  width: 100%;
  height: 200rpx;
  border-radius: 24rpx;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
  margin-bottom: 32rpx;
}

.loading-members {
  background-color: #fff;
  border-radius: 24rpx;
  padding: 32rpx;
}

.loading-member-item {
  height: 80rpx;
  margin-bottom: 24rpx;
  border-radius: 8rpx;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
}

.loading-member-item:last-child {
  margin-bottom: 0;
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
