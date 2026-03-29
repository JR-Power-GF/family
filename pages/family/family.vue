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
      <!-- Header -->
      <view class="header-section">
        <text class="header-title">家庭成员</text>
        <text class="header-subtitle">管理你的家庭群组</text>
      </view>

      <!-- Invite Code Section -->
      <view class="invite-section">
        <view class="invite-card">
          <text class="invite-label">邀请码</text>
          <text class="invite-code">{{ inviteCode || '加载中...' }}</text>
          <view class="invite-actions">
            <button class="copy-btn" @click="copyInviteCode">复制</button>
            <button class="share-btn" open-type="share">分享</button>
          </view>
        </view>
        <text class="invite-tip">分享邀请码给家人，即可加入</text>
      </view>

      <!-- Action Buttons -->
      <view class="action-section">
        <button class="action-btn join-btn" @click="showJoinModal = true">
          <text class="action-icon">➕</text>
          <text>加入其他家庭</text>
        </button>
        <button class="action-btn exit-btn" @click="confirmExit">
          <text class="action-icon">🚪</text>
          <text>退出当前家庭</text>
        </button>
      </view>

      <!-- Members List -->
      <view class="members-section">
        <view class="section-header">
          <text class="section-title">成员列表</text>
          <text class="member-count">{{ members.length }} 人</text>
        </view>

        <view class="members-list">
          <view v-for="member in members" :key="member._id" class="member-item">
            <image class="member-avatar" :src="member.avatar || '/static/default-avatar.svg'" mode="aspectFill" @error="() => member.avatar = ''" />
            <view class="member-info">
              <text class="member-name">{{ member.nickName || '匿名用户' }}</text>
              <text class="member-joined">加入于 {{ formatDate(member.joinedAt) }}</text>
            </view>
            <view v-if="member.isAdmin" class="admin-badge">
              <text>管理员</text>
            </view>
            <!-- Remove member button (admin only, not for self) -->
            <view
              v-if="isAdmin && !member.isAdmin && member.userId !== currentUserId"
              class="member-actions"
            >
              <text class="transfer-btn" @click="confirmTransferAdmin(member)">转让管理员</text>
              <text class="remove-btn" @click="confirmRemoveMember(member)">移除</text>
            </view>
          </view>
        </view>
      </view>

      <!-- Empty State -->
      <view v-if="members.length === 0" class="empty-state">
        <text class="empty-text">暂无家庭成员</text>
        <text class="empty-tip">分享邀请码邀请家人加入</text>
      </view>
    </view>

    <!-- Join Family Modal -->
    <view v-if="showJoinModal" class="modal-overlay" @click="showJoinModal = false">
      <view class="modal-content" @click.stop>
        <text class="modal-title">加入家庭</text>
        <text class="modal-subtitle">请输入6位邀请码</text>
        <input
          class="code-input"
          v-model="inputCode"
          placeholder="输入邀请码"
          maxlength="6"
          @input="inputCode = inputCode.toUpperCase()"
        />
        <view class="modal-buttons">
          <button class="modal-btn cancel" @click="showJoinModal = false">取消</button>
          <button class="modal-btn confirm" :disabled="joining" @click="joinFamily">
            {{ joining ? '加入中...' : '加入' }}
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
  background-color: $uni-bg-color-grey;
  padding: 32rpx;
  padding-bottom: 100rpx;
}

.header-section {
  padding: 32rpx 0;
  text-align: center;
}

.header-title {
  font-size: 48rpx;
  font-weight: 600;
  color: $uni-text-color;
  display: block;
  margin-bottom: 12rpx;
}

.header-subtitle {
  font-size: 28rpx;
  color: $uni-text-color-grey;
}

.invite-section {
  margin-bottom: 32rpx;
}

.invite-card {
  background-color: #fff;
  border-radius: 24rpx;
  padding: 32rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.invite-label {
  font-size: 26rpx;
  color: $uni-text-color-grey;
  margin-bottom: 16rpx;
}

.invite-code {
  font-size: 48rpx;
  font-weight: 600;
  color: $uni-color-primary;
  letter-spacing: 8rpx;
  margin-bottom: 24rpx;
}

.invite-actions {
  display: flex;
  gap: 24rpx;
  justify-content: center;
}

.copy-btn,
.share-btn {
  background-color: $uni-color-primary;
  color: #fff;
  font-size: 28rpx;
  padding: 12rpx 48rpx;
  border-radius: 40rpx;
  border: none;

  &:active {
    opacity: 0.8;
  }
}

.share-btn {
  background-color: #07C160;
}

.invite-tip {
  display: block;
  text-align: center;
  font-size: 24rpx;
  color: $uni-text-color-grey;
  margin-top: 16rpx;
}

.action-section {
  display: flex;
  gap: 24rpx;
  margin-bottom: 32rpx;
}

.action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  border: none;
  font-size: 28rpx;
  color: $uni-text-color;

  &:active {
    opacity: 0.8;
  }
}

.action-icon {
  margin-right: 12rpx;
}

.exit-btn {
  color: #ff4d4f;
}

.members-section {
  background-color: #fff;
  border-radius: 24rpx;
  padding: 32rpx;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24rpx;
}

.section-title {
  font-size: 32rpx;
  font-weight: 500;
  color: $uni-text-color;
}

.member-count {
  font-size: 26rpx;
  color: $uni-text-color-grey;
}

.members-list {
  display: flex;
  flex-direction: column;
}

.member-item {
  display: flex;
  align-items: center;
  padding: 24rpx 0;
  border-bottom: 1px solid #f0f0f0;

  &:last-child {
    border-bottom: none;
  }
}

.member-avatar {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  background-color: #f0f0f0;
  margin-right: 24rpx;
}

.member-info {
  flex: 1;
}

.member-name {
  font-size: 30rpx;
  color: $uni-text-color;
  display: block;
  margin-bottom: 8rpx;
}

.member-joined {
  font-size: 24rpx;
  color: $uni-text-color-grey;
}

.admin-badge {
  background-color: $uni-color-primary;
  color: #fff;
  font-size: 22rpx;
  padding: 8rpx 16rpx;
  border-radius: 8rpx;
}

.member-actions {
  display: flex;
  gap: 16rpx;
}

.transfer-btn {
  color: $uni-color-primary;
  font-size: 24rpx;
  padding: 8rpx 16rpx;
  background-color: rgba(0, 122, 255, 0.1);
  border-radius: 8rpx;

  &:active {
    opacity: 0.7;
  }
}

.remove-btn {
  color: #ff4d4f;
  font-size: 24rpx;
  padding: 8rpx 16rpx;
  background-color: rgba(255, 77, 79, 0.1);
  border-radius: 8rpx;

  &:active {
    opacity: 0.7;
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80rpx 0;
}

.empty-text {
  font-size: 32rpx;
  color: $uni-text-color-grey;
  margin-bottom: 16rpx;
}

.empty-tip {
  font-size: 26rpx;
  color: $uni-text-color-grey;
  opacity: 0.7;
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
  display: block;
  text-align: center;
  margin-bottom: 12rpx;
}

.modal-subtitle {
  font-size: 28rpx;
  color: $uni-text-color-grey;
  display: block;
  text-align: center;
  margin-bottom: 32rpx;
}

.code-input {
  width: 100%;
  height: 88rpx;
  background-color: #f5f5f5;
  border-radius: 16rpx;
  padding: 0 24rpx;
  font-size: 36rpx;
  text-align: center;
  letter-spacing: 16rpx;
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
