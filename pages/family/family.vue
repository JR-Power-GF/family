<template>
  <view class="family-page">
    <!-- Loading State -->
    <view v-if="loading" class="loading-container">
      <view class="loading-header"></view>
      <view class="loading-card"></view>
      <view class="loading-actions"></view>
      <view class="loading-members">
        <view class="loading-member-item"></view>
        <view class="loading-member-item"></view>
      </view>
    </view>

    <!-- Content -->
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

      <!-- Quick Actions -->
      <view class="quick-actions">
        <view class="action-card" @click="showJoinModal = true">
          <view class="action-icon-wrap join">
            <text class="action-card-icon">➕</text>
          </view>
          <text class="action-card-title">加入其他家庭</text>
          <text class="action-card-desc">使用邀请码加入</text>
        </view>
        <view class="action-card" @click="confirmExit">
          <view class="action-icon-wrap exit">
            <text class="action-card-icon">🚪</text>
          </view>
          <text class="action-card-title">退出家庭</text>
          <text class="action-card-desc">离开当前家庭</text>
        </view>
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

    <!-- Join Family Modal -->
    <view v-if="showJoinModal" class="modal-overlay" @click="showJoinModal = false">
      <view class="modal-content" @click.stop>
        <view class="modal-header">
          <text class="modal-title">加入其他家庭</text>
          <view class="modal-close" @click="showJoinModal = false">
            <text>✕</text>
          </view>
        </view>
        <view class="modal-body">
          <text class="modal-desc">请输入6位邀请码</text>
          <view class="code-input-wrapper">
            <input
              class="code-input"
              v-model="inputCode"
              placeholder="XXXXXX"
              maxlength="6"
              @input="inputCode = inputCode.toUpperCase()"
            />
          </view>
        </view>
        <view class="modal-footer">
          <button class="modal-btn cancel" @click="showJoinModal = false">取消</button>
          <button class="modal-btn confirm" :disabled="joining || inputCode.length !== 6" @click="joinFamily">
            {{ joining ? '加入中...' : '立即加入' }}
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useShareAppMessage, onLoad } from '@dcloudio/uni-app'

// Lazy database initialization
let db = null
function getDb() {
  if (!db) {
    db = wx.cloud.database()
  }
  return db
}

const loading = ref(true)
const inviteCode = ref('')
const members = ref([])
const isAdmin = ref(false)
const currentUserId = ref('')
const currentFamilyId = ref('')

// Join family modal
const showJoinModal = ref(false)
const inputCode = ref('')
const joining = ref(false)

// Share handler for WeChat
useShareAppMessage(() => {
  return {
    title: '邀请你加入我的家庭',
    path: `/pages/family/family?inviteCode=${inviteCode.value}`,
    imageUrl: '/static/logo.png'
  }
})

onMounted(async () => {
  await loadFamilyData()
})

// Handle share link with invite code
onLoad((options) => {
  if (options?.inviteCode) {
    // User came via share link
    inputCode.value = options.inviteCode.toUpperCase()
    showJoinModal.value = true
  }
})

async function loadFamilyData() {
  loading.value = true

  try {
    // Get current user's openid
    const { result: userInfo } = await wx.cloud.callFunction({
      name: 'getUserInfo'
    }).catch(() => ({ result: { openid: null, nickName: '匿名用户', avatarUrl: '' } }))

    if (!userInfo.openid) {
      uni.showToast({
        title: '请先登录',
        icon: 'none'
      })
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

async function joinFamily() {
  const code = inputCode.value.trim().toUpperCase()

  if (code.length !== 6) {
    uni.showToast({
      title: '请输入6位邀请码',
      icon: 'none'
    })
    return
  }

  if (code === inviteCode.value) {
    uni.showToast({
      title: '已经是当前家庭成员',
      icon: 'none'
    })
    return
  }

  joining.value = true

  try {
    // Find family by invite code
    const { data: families } = await getDb().collection('families')
      .where({
        inviteCode: code
      })
      .get()

    if (families.length === 0) {
      uni.showToast({
        title: '邀请码不存在',
        icon: 'none'
      })
      joining.value = false
      return
    }

    const targetFamily = families[0]

    // Leave current family first
    await leaveCurrentFamily()

    // Get user info
    const { result: userInfo } = await wx.cloud.callFunction({
      name: 'getUserInfo'
    }).catch(() => ({ result: { openid: currentUserId.value, nickName: '匿名用户', avatarUrl: '' } }))

    // Join new family
    await getDb().collection('family_members').add({
      data: {
        familyId: targetFamily._id,
        userId: currentUserId.value,
        nickName: userInfo.nickName || '匿名用户',
        avatar: userInfo.avatarUrl || '',
        isAdmin: false,
        joinedAt: getDb().serverDate()
      }
    })

    // Notify all admins of the family about new member
    await notifyAdminsOfNewMember({
      familyId: targetFamily._id,
      newMemberName: userInfo.nickName || '匿名用户',
      newMemberId: currentUserId.value
    })

    showJoinModal.value = false
    inputCode.value = ''

    uni.showToast({
      title: '加入成功',
      icon: 'success'
    })

    // Reload family data
    await loadFamilyData()
  } catch (error) {
    console.error('Failed to join family:', error)
    uni.showToast({
      title: '加入失败',
      icon: 'none'
    })
  } finally {
    joining.value = false
  }
}

async function leaveCurrentFamily() {
  // Find and remove current membership
  const { data: memberRecord } = await getDb().collection('family_members')
    .where({
      userId: currentUserId.value
    })
    .get()

  if (memberRecord.length > 0) {
    const membership = memberRecord[0]

    // If admin, check if there are other members
    if (membership.isAdmin) {
      const { total } = await getDb().collection('family_members')
        .where({
          familyId: membership.familyId
        })
        .count()

      if (total > 1) {
        throw new Error('请先移除其他成员或转让管理员')
      }

      // Delete family if admin is the only member
      await getDb().collection('families').doc(membership.familyId).remove()
    }

    // Remove membership
    await getDb().collection('family_members').doc(membership._id).remove()
  }
}

function confirmExit() {
  if (isAdmin.value && members.value.length > 1) {
    uni.showModal({
      title: '无法退出',
      content: '管理员需要先转让管理员权限或移除其他成员才能退出家庭',
      showCancel: false
    })
    return
  }

  uni.showModal({
    title: '确认退出',
    content: '退出后将无法查看家庭故事，确定要退出吗？',
    confirmColor: '#ff4d4f',
    success: (res) => {
      if (res.confirm) {
        exitFamily()
      }
    }
  })
}

async function exitFamily() {
  uni.showLoading({ title: '退出中...', mask: true })

  try {
    await leaveCurrentFamily()

    uni.hideLoading()
    uni.showToast({
      title: '已退出家庭',
      icon: 'success'
    })

    // Reload to create new family
    await loadFamilyData()
  } catch (error) {
    uni.hideLoading()
    console.error('Failed to exit family:', error)
    uni.showToast({
      title: error.message || '退出失败',
      icon: 'none'
    })
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

/* Quick Actions */
.quick-actions {
  display: flex;
  gap: 20rpx;
  padding: 0 32rpx;
  margin-bottom: 32rpx;
}

.action-card {
  flex: 1;
  background: #fff;
  border-radius: 20rpx;
  padding: 28rpx 24rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);

  &:active {
    background: #fafafa;
  }
}

.action-icon-wrap {
  width: 72rpx;
  height: 72rpx;
  border-radius: 18rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16rpx;

  &.join {
    background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%);
  }

  &.exit {
    background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
  }
}

.action-card-icon {
  font-size: 36rpx;
}

.action-card-title {
  font-size: 28rpx;
  color: #333;
  font-weight: 500;
  margin-bottom: 4rpx;
}

.action-card-desc {
  font-size: 22rpx;
  color: #999;
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

/* Modal Styles */
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
  width: 620rpx;
  background-color: #fff;
  border-radius: 28rpx;
  overflow: hidden;
  animation: modal-in 0.25s ease-out;
}

@keyframes modal-in {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(20rpx);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 32rpx;
  border-bottom: 1px solid #f0f0f0;
}

.modal-title {
  font-size: 34rpx;
  font-weight: 600;
  color: #333;
}

.modal-close {
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
  border-radius: 50%;
  font-size: 28rpx;
  color: #999;

  &:active {
    background: #eee;
  }
}

.modal-body {
  padding: 32rpx;
}

.modal-desc {
  font-size: 28rpx;
  color: #666;
  text-align: center;
  margin-bottom: 24rpx;
}

.code-input-wrapper {
  background: #f5f7fa;
  border-radius: 16rpx;
  padding: 8rpx;
}

.code-input {
  width: 100%;
  height: 96rpx;
  background-color: #fff;
  border-radius: 12rpx;
  padding: 0 24rpx;
  font-size: 40rpx;
  font-weight: 600;
  text-align: center;
  letter-spacing: 20rpx;
  box-sizing: border-box;
  color: #333;
}

.modal-footer {
  display: flex;
  gap: 20rpx;
  padding: 0 32rpx 32rpx;
}

.modal-btn {
  flex: 1;
  height: 88rpx;
  font-size: 32rpx;
  font-weight: 500;
  border-radius: 16rpx;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;

  &.cancel {
    background-color: #f5f7fa;
    color: #666;
  }

  &.confirm {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #fff;

    &[disabled] {
      opacity: 0.5;
    }
  }
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

.loading-actions {
  display: flex;
  gap: 24rpx;
  margin-bottom: 32rpx;
}

.loading-actions::before,
.loading-actions::after {
  content: '';
  flex: 1;
  height: 96rpx;
  border-radius: 16rpx;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
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
