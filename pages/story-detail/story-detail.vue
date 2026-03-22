<template>
  <view class="detail-page">
    <!-- Loading -->
    <view v-if="loading" class="loading-area">
      <text>加载中...</text>
    </view>

    <!-- Story content -->
    <view v-else-if="story" class="story-content">
      <!-- Multiple photos swiper -->
      <swiper
        v-if="displayPhotoUrls.length > 1"
        class="photo-swiper"
        :indicator-dots="true"
        indicator-color="rgba(255, 255, 255, 0.5)"
        indicator-active-color="#ffffff"
        :autoplay="false"
        :circular="false"
        @change="onPhotoChange"
      >
        <swiper-item v-for="(url, index) in displayPhotoUrls" :key="index">
          <image
            :src="url"
            mode="aspectFill"
            class="swiper-photo"
            lazy-load
            @click="openImageViewer(index)"
            @longpress="saveImage(url)"
          />
        </swiper-item>
      </swiper>

      <!-- Single photo -->
      <image
        v-else-if="displayPhotoUrls.length === 1"
        :src="displayPhotoUrls[0]"
        mode="widthFix"
        class="full-photo"
        lazy-load
        @click="openImageViewer(0)"
        @longpress="saveImage(displayPhotoUrls[0])"
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

      <!-- Like & Comment & Share section -->
      <view class="like-comment-section">
        <view class="action-item" @click="toggleLike">
          <text class="action-icon">{{ isLiked ? '❤️' : '🤍' }}</text>
          <text class="action-count">{{ likesCount || '' }}</text>
        </view>
        <view class="action-item" @click="showComments">
          <text class="action-icon">💬</text>
          <text class="action-count">{{ comments.length || '' }}</text>
        </view>
        <button class="action-item share-btn" open-type="share">
          <text class="action-icon">🔗</text>
          <text class="action-count">分享</text>
        </button>
        <view class="action-item" @click="generateShareImage">
          <text class="action-icon">📷</text>
          <text class="action-count">海报</text>
        </view>
      </view>

      <!-- Comments list -->
      <view v-if="showCommentsList && comments.length > 0" class="comments-list">
        <view v-for="comment in comments" :key="comment._id" class="comment-item">
          <image class="comment-avatar" :src="comment.authorAvatar || '/static/default-avatar.png'" mode="aspectFill" />
          <view class="comment-content">
            <view class="comment-header">
              <text class="comment-author">{{ comment.authorName }}</text>
              <!-- Delete comment button (only for own comments) -->
              <text v-if="isCommentOwner(comment)" class="delete-comment-btn" @click="confirmDeleteComment(comment)">删除</text>
            </view>
            <text class="comment-text">{{ comment.content }}</text>
            <!-- Reply button -->
            <text class="reply-btn" @click="replyToComment(comment)">回复</text>
            <!-- Replies list -->
            <view v-if="comment.replies && comment.replies.length > 0" class="replies-list">
              <view v-for="reply in comment.replies" :key="reply._id" class="reply-item">
                <text class="reply-author">{{ reply.authorName }}</text>
                <text v-if="reply.replyToName" class="reply-to">回复 {{ reply.replyToName }}</text>
                <text class="reply-text">: {{ reply.content }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>

      <!-- Comment input -->
      <view v-if="showCommentInput" class="comment-input-area">
        <input
          class="comment-input"
          v-model="newComment"
          :placeholder="replyTo ? `回复 ${replyTo.authorName}...` : '写下评论...'"
          @confirm="submitComment"
          @input="onCommentInput"
          focus
        />
        <button v-if="replyTo" class="cancel-reply-btn" @click="cancelReply">取消</button>
        <button class="send-btn" @click="submitComment">发送</button>
      </view>

      <!-- @mention popup -->
      <view v-if="showMentionList" class="mention-popup">
        <view class="mention-header">
          <text>选择要@的成员</text>
        </view>
        <scroll-view scroll-y class="mention-list">
          <view
            v-for="member in familyMembers"
            :key="member._id"
            class="mention-item"
            @click="selectMention(member)"
          >
            <image class="mention-avatar" :src="member.avatar || '/static/default-avatar.png'" mode="aspectFill" />
            <text class="mention-name">{{ member.nickName || '匿名用户' }}</text>
          </view>
        </scroll-view>
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

    <!-- Image Viewer -->
    <ImageViewer
      :visible="showImageViewer"
      :images="displayPhotoUrls"
      :current="currentPhotoIndex"
      @close="closeImageViewer"
    />

    <!-- Hidden canvas for share image generation -->
    <canvas canvas-id="shareCanvas" class="share-canvas" />
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import { storiesApi } from '../../api/index.js'

const story = ref(null)
const loading = ref(true)
const tempPhotoUrl = ref('')
const tempAvatarUrl = ref('')
const isOwner = ref(false)
const isEditing = ref(false)
const editCaption = ref('')
const saving = ref(false)

// Like & Comment state
const isLiked = ref(false)
const likesCount = ref(0)
const comments = ref([])
const showCommentsList = ref(false)
const showCommentInput = ref(false)
const newComment = ref('')
const replyTo = ref(null) // Comment being replied to
const showMentionList = ref(false)
const familyMembers = ref([])
const mentionStartIndex = ref(-1)
const currentOpenId = ref('') // Current user's openid

// Image viewer state
const showImageViewer = ref(false)
const currentPhotoIndex = ref(0)

// All photo URLs (temporary URLs for cloud files)
const tempPhotoUrls = ref([])

const displayPhotoUrls = computed(() => {
  // If we have temp URLs, use them
  if (tempPhotoUrls.value.length > 0) {
    return tempPhotoUrls.value
  }
  // Otherwise return the original URLs
  if (story.value?.photoUrls && story.value.photoUrls.length > 0) {
    return story.value.photoUrls
  }
  if (story.value?.photoUrl) {
    return [story.value.photoUrl]
  }
  return []
})

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
    // Get current user's openid
    const { result: userInfo } = await wx.cloud.callFunction({
      name: 'getUserInfo'
    }).catch(() => ({ result: { openid: '' } }))
    currentOpenId.value = userInfo.openid || ''

    story.value = await storiesApi.getStory(storyId)

    if (story.value) {
      await convertCloudUrls()
      // Check if current user is the owner
      isOwner.value = await storiesApi.isStoryOwner(storyId)
      // Set likes count from story data
      likesCount.value = story.value.likeCount || 0
      // Check if user has liked
      isLiked.value = await storiesApi.hasLiked(storyId)
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

  // Collect all photo URLs (multiple photos)
  if (story.value.photoUrls && story.value.photoUrls.length > 0) {
    story.value.photoUrls.forEach(url => {
      if (url?.startsWith('cloud://')) {
        fileIds.push(url)
      }
    })
  } else if (story.value.photoUrl?.startsWith('cloud://')) {
    fileIds.push(story.value.photoUrl)
  }

  // Collect avatar URL
  if (story.value.authorAvatar?.startsWith('cloud://')) {
    fileIds.push(story.value.authorAvatar)
  }

  if (fileIds.length === 0) return

  try {
    const { fileList } = await wx.cloud.getTempFileURL({ fileList: fileIds })

    // Create a map of fileID -> tempFileURL
    const urlMap = {}
    fileList.forEach(file => {
      if (file.tempFileURL) {
        urlMap[file.fileID] = file.tempFileURL
      }
    })

    // Update photo URLs
    if (story.value.photoUrls && story.value.photoUrls.length > 0) {
      tempPhotoUrls.value = story.value.photoUrls.map(url => urlMap[url] || url)
    } else if (story.value.photoUrl) {
      tempPhotoUrls.value = [urlMap[story.value.photoUrl] || story.value.photoUrl]
    }

    // Update avatar URL
    if (story.value.authorAvatar) {
      tempAvatarUrl.value = urlMap[story.value.authorAvatar] || story.value.authorAvatar
    }
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

// Image viewer functions
function openImageViewer(index = 0) {
  currentPhotoIndex.value = index
  showImageViewer.value = true
}

function closeImageViewer() {
  showImageViewer.value = false
}

function onPhotoChange(e) {
  currentPhotoIndex.value = e.detail.current
}

// Long press to save image
async function saveImage(imageUrl) {
  uni.showActionSheet({
    itemList: ['保存图片到相册'],
    success: async (res) => {
      if (res.tapIndex === 0) {
        uni.showLoading({ title: '保存中...', mask: true })

        try {
          // Download image if it's a URL
          let filePath = imageUrl
          if (imageUrl.startsWith('http')) {
            const downloadResult = await new Promise((resolve, reject) => {
              uni.downloadFile({
                url: imageUrl,
                success: resolve,
                fail: reject
              })
            })
            filePath = downloadResult.tempFilePath
          }

          // Save to album
          uni.saveImageToPhotosAlbum({
            filePath: filePath,
            success: () => {
              uni.hideLoading()
              uni.showToast({
                title: '已保存到相册',
                icon: 'success'
              })
            },
            fail: (err) => {
              uni.hideLoading()
              if (err.errMsg?.includes('auth deny')) {
                uni.showModal({
                  title: '提示',
                  content: '需要您授权保存图片到相册',
                  confirmText: '去设置',
                  success: (modalRes) => {
                    if (modalRes.confirm) {
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
          })
        } catch (error) {
          uni.hideLoading()
          console.error('Failed to save image:', error)
          uni.showToast({
            title: '保存失败',
            icon: 'none'
          })
        }
      }
    }
  })
}

// Like function with debounce protection
const isLiking = ref(false)

async function toggleLike() {
  // Prevent rapid taps
  if (isLiking.value) return
  isLiking.value = true

  try {
    const result = await storiesApi.likeStory(story.value._id)
    isLiked.value = result.liked
    likesCount.value = result.liked
      ? likesCount.value + 1
      : Math.max(0, likesCount.value - 1)
  } catch (error) {
    console.error('Failed to toggle like:', error)
    uni.showToast({
      title: '操作失败',
      icon: 'none'
    })
  } finally {
    // Small delay before allowing next tap
    setTimeout(() => {
      isLiking.value = false
    }, 300)
  }
}

// Comments functions
function showComments() {
  showCommentsList.value = !showCommentsList.value
  showCommentInput.value = showCommentsList.value

  if (showCommentsList.value && comments.value.length === 0) {
    loadComments()
  }
}

async function loadComments() {
  try {
    comments.value = await storiesApi.getComments(story.value._id)
  } catch (error) {
    console.error('Failed to load comments:', error)
  }
}

async function submitComment() {
  if (!newComment.value.trim()) {
    uni.showToast({
      title: '请输入评论内容',
      icon: 'none'
    })
    return
  }

  try {
    if (replyTo.value) {
      // Add reply to comment
      const reply = await storiesApi.addReply(replyTo.value._id, newComment.value.trim())
      // Add reply to the comment's replies array
      const commentIndex = comments.value.findIndex(c => c._id === replyTo.value._id)
      if (commentIndex !== -1) {
        if (!comments.value[commentIndex].replies) {
          comments.value[commentIndex].replies = []
        }
        comments.value[commentIndex].replies.push(reply.data || reply)
      }
      replyTo.value = null
    } else {
      // Add new comment
      const comment = await storiesApi.addComment(story.value._id, newComment.value.trim())
      comments.value.push(comment.data || comment)
    }
    newComment.value = ''
    uni.showToast({
      title: '发送成功',
      icon: 'success'
    })
  } catch (error) {
    console.error('Failed to add comment:', error)
    uni.showToast({
      title: '发送失败',
      icon: 'none'
    })
  }
}

// Reply functions
function replyToComment(comment) {
  replyTo.value = comment
  showCommentInput.value = true
  showCommentsList.value = true
}

function cancelReply() {
  replyTo.value = null
}

// Delete comment functions
function isCommentOwner(comment) {
  // Check if current user is the comment author
  return currentOpenId.value && comment.authorId === currentOpenId.value
}

async function confirmDeleteComment(comment) {
  uni.showModal({
    title: '确认删除',
    content: '确定要删除这条评论吗？',
    confirmColor: '#ff4d4f',
    success: (res) => {
      if (res.confirm) {
        deleteComment(comment)
      }
    }
  })
}

async function deleteComment(comment) {
  try {
    await storiesApi.deleteComment(comment._id)

    // Remove from local list
    comments.value = comments.value.filter(c => c._id !== comment._id)

    uni.showToast({
      title: '删除成功',
      icon: 'success'
    })
  } catch (error) {
    console.error('Failed to delete comment:', error)
    uni.showToast({
      title: '删除失败',
      icon: 'none'
    })
  }
}

// @mention functions
function onCommentInput(e) {
  const value = e.detail.value
  const cursorPos = e.detail.cursor

  // Check if user typed @
  if (value.charAt(cursorPos - 1) === '@') {
    mentionStartIndex.value = cursorPos - 1
    loadFamilyMembers()
    showMentionList.value = true
  } else {
    // Check if there's an @ in the text near cursor
    const textBeforeCursor = value.substring(0, cursorPos)
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')

    if (lastAtIndex !== -1 && !value.substring(lastAtIndex, cursorPos).includes(' ')) {
      // User is still typing @mention
      mentionStartIndex.value = lastAtIndex
      showMentionList.value = true

      // Filter members by text after @
      const searchText = value.substring(lastAtIndex + 1, cursorPos).toLowerCase()
      filterFamilyMembers(searchText)
    } else {
      showMentionList.value = false
    }
  }
}

async function loadFamilyMembers() {
  try {
    const { result: userInfo } = await wx.cloud.callFunction({
      name: 'getUserInfo'
    }).catch(() => ({ result: { openid: null } }))

    if (!userInfo.openid) return

    // Get user's family
    const db = wx.cloud.database()
    const { data: memberRecord } = await db.collection('family_members')
      .where({ userId: userInfo.openid })
      .get()

    if (memberRecord.length > 0) {
      const { data: members } = await db.collection('family_members')
        .where({ familyId: memberRecord[0].familyId })
        .get()
      familyMembers.value = members
    }
  } catch (error) {
    console.error('Failed to load family members:', error)
  }
}

function filterFamilyMembers(searchText) {
  // This is called while typing, already loaded members are filtered
}

function selectMention(member) {
  const name = member.nickName || '匿名用户'
  const beforeMention = newComment.value.substring(0, mentionStartIndex.value)
  const afterCursor = newComment.value.substring(mentionStartIndex.value + 1)

  newComment.value = `${beforeMention}@${name} ${afterCursor}`
  showMentionList.value = false
}

// Share functions
onShareAppMessage(() => {
  return {
    title: story.value?.caption || '分享一个家庭故事',
    path: `/pages/story-detail/story-detail?id=${story.value?._id}`,
    imageUrl: displayPhotoUrl.value
  }
})

onShareTimeline(() => {
  return {
    title: story.value?.caption || '分享一个家庭故事',
    query: `id=${story.value?._id}`,
    imageUrl: displayPhotoUrl.value
  }
})

async function generateShareImage() {
  if (!story.value) return

  uni.showLoading({ title: '生成中...', mask: true })

  try {
    // Download image first
    let imagePath = displayPhotoUrl.value

    if (displayPhotoUrl.value.startsWith('http')) {
      const downloadResult = await new Promise((resolve, reject) => {
        uni.downloadFile({
          url: displayPhotoUrl.value,
          success: resolve,
          fail: reject
        })
      })
      imagePath = downloadResult.tempFilePath
    }

    // Get image info
    const imageInfo = await new Promise((resolve, reject) => {
      uni.getImageInfo({
        src: imagePath,
        success: resolve,
        fail: reject
      })
    })

    // Canvas dimensions
    const canvasWidth = 750
    const padding = 40
    const imageWidth = canvasWidth - padding * 2
    const imageHeight = (imageInfo.height / imageInfo.width) * imageWidth

    // Calculate text height
    const caption = story.value.caption || ''
    const maxTextWidth = imageWidth
    const fontSize = 32
    const lineHeight = fontSize * 1.5
    const lines = wrapText(caption, maxTextWidth, fontSize)
    const textHeight = lines.length * lineHeight + 40

    const canvasHeight = imageHeight + textHeight + 200

    // Create canvas context
    const ctx = uni.createCanvasContext('shareCanvas')

    // Draw white background
    ctx.setFillStyle('#ffffff')
    ctx.fillRect(0, 0, canvasWidth, canvasHeight)

    // Draw image
    ctx.drawImage(imagePath, padding, padding, imageWidth, imageHeight)

    // Draw caption
    ctx.setFillStyle('#333333')
    ctx.setFontSize(fontSize)
    let textY = imageHeight + padding + 50
    lines.forEach(line => {
      ctx.fillText(line, padding, textY)
      textY += lineHeight
    })

    // Draw footer
    const footerY = canvasHeight - 80
    ctx.setFillStyle('#999999')
    ctx.setFontSize(24)
    ctx.fillText(`来自「温暖一大家」`, padding, footerY)
    ctx.fillText(formattedDate.value, canvasWidth - padding - 150, footerY)

    // Draw to image
    ctx.draw(false, () => {
      setTimeout(() => {
        uni.canvasToTempFilePath({
          canvasId: 'shareCanvas',
          width: canvasWidth,
          height: canvasHeight,
          destWidth: canvasWidth * 2,
          destHeight: canvasHeight * 2,
          success: (res) => {
            uni.hideLoading()
            saveShareImage(res.tempFilePath)
          },
          fail: (err) => {
            console.error('Canvas to image failed:', err)
            uni.hideLoading()
            uni.showToast({
              title: '生成失败',
              icon: 'none'
            })
          }
        })
      }, 300)
    })
  } catch (error) {
    console.error('Generate share image failed:', error)
    uni.hideLoading()
    uni.showToast({
      title: '生成失败',
      icon: 'none'
    })
  }
}

function wrapText(text, maxWidth, fontSize) {
  const chars = text.split('')
  const lines = []
  let currentLine = ''

  chars.forEach(char => {
    const testLine = currentLine + char
    const width = testLine.length * fontSize * 0.6 // Approximate width

    if (width > maxWidth && currentLine) {
      lines.push(currentLine)
      currentLine = char
    } else {
      currentLine = testLine
    }
  })

  if (currentLine) {
    lines.push(currentLine)
  }

  return lines.slice(0, 5) // Max 5 lines
}

function saveShareImage(tempFilePath) {
  uni.showActionSheet({
    itemList: ['保存到相册', '发送给朋友'],
    success: (res) => {
      if (res.tapIndex === 0) {
        // Save to album
        uni.saveImageToPhotosAlbum({
          filePath: tempFilePath,
          success: () => {
            uni.showToast({
              title: '已保存到相册',
              icon: 'success'
            })
          },
          fail: (err) => {
            if (err.errMsg.includes('auth deny')) {
              uni.showModal({
                title: '提示',
                content: '需要您授权保存图片到相册',
                success: (modalRes) => {
                  if (modalRes.confirm) {
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
        })
      } else if (res.tapIndex === 1) {
        // Share image
        uni.shareImage({
          path: tempFilePath,
          success: () => {
            uni.showToast({
              title: '分享成功',
              icon: 'success'
            })
          },
          fail: () => {
            uni.showToast({
              title: '分享取消',
              icon: 'none'
            })
          }
        })
      }
    }
  })
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

.photo-swiper {
  width: 100%;
  height: 500rpx;
  background-color: #f0f0f0;
}

.swiper-photo {
  width: 100%;
  height: 100%;
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

.like-comment-section {
  display: flex;
  padding: 0 32rpx;
  margin-bottom: 32rpx;
}

.action-item {
  display: flex;
  align-items: center;
  margin-right: 48rpx;

  &.share-btn {
    background: transparent;
    border: none;
    padding: 0;
    margin: 0;
    margin-right: 48rpx;

    &::after {
      border: none;
    }
  }
}

.action-icon {
  font-size: 48rpx;
  margin-right: 8rpx;
}

.action-count {
  font-size: 28rpx;
  color: $uni-text-color-grey;
}

.comments-list {
  padding: 0 32rpx;
  margin-bottom: 32rpx;
}

.comment-item {
  display: flex;
  padding: 20rpx 0;
  border-bottom: 1px solid #f0f0f0;

  &:last-child {
    border-bottom: none;
  }
}

.comment-avatar {
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  margin-right: 16rpx;
  background-color: #f0f0f0;
}

.comment-content {
  flex: 1;
}

.comment-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8rpx;
}

.comment-author {
  font-size: 26rpx;
  color: $uni-text-color;
  font-weight: 500;
  margin-right: 12rpx;
}

.delete-comment-btn {
  font-size: 22rpx;
  color: #ff4d4f;
  padding: 4rpx 12rpx;
  background-color: rgba(255, 77, 79, 0.1);
  border-radius: 8rpx;

  &:active {
    opacity: 0.7;
  }
}

.comment-text {
  font-size: 26rpx;
  color: $uni-text-color;
  margin-top: 8rpx;
}

.reply-btn {
  font-size: 24rpx;
  color: $uni-text-color-grey;
  margin-top: 8rpx;
  display: inline-block;
  padding: 4rpx 12rpx;

  &:active {
    opacity: 0.7;
  }
}

.replies-list {
  margin-top: 16rpx;
  padding: 16rpx;
  background-color: #f8f8f8;
  border-radius: 12rpx;
}

.reply-item {
  margin-bottom: 12rpx;
  line-height: 1.5;

  &:last-child {
    margin-bottom: 0;
  }
}

.reply-author {
  font-size: 24rpx;
  color: $uni-color-primary;
  font-weight: 500;
}

.reply-to {
  font-size: 24rpx;
  color: $uni-text-color-grey;
  margin: 0 8rpx;
}

.reply-text {
  font-size: 24rpx;
  color: $uni-text-color;
}

.cancel-reply-btn {
  background-color: #f0f0f0;
  color: $uni-text-color-grey;
  font-size: 28rpx;
  padding: 0 24rpx;
  border-radius: 36rpx;
  height: 72rpx;
  line-height: 72rpx;
  margin-right: 16rpx;
}

/* Mention popup */
.mention-popup {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 120rpx;
  background-color: #fff;
  border-radius: 24rpx 24rpx 0 0;
  max-height: 500rpx;
  box-shadow: 0 -4rpx 20rpx rgba(0, 0, 0, 0.1);
  z-index: 100;
}

.mention-header {
  padding: 24rpx 32rpx;
  border-bottom: 1px solid #f0f0f0;
  font-size: 28rpx;
  color: $uni-text-color-grey;
}

.mention-list {
  max-height: 400rpx;
}

.mention-item {
  display: flex;
  align-items: center;
  padding: 24rpx 32rpx;

  &:active {
    background-color: #f5f5f5;
  }
}

.mention-avatar {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  margin-right: 20rpx;
}

.mention-name {
  font-size: 30rpx;
  color: $uni-text-color;
}

.comment-input-area {
  display: flex;
  padding: 16rpx 32rpx;
  background-color: #fff;
  border-top: 1px solid #eee;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
}

.comment-input {
  flex: 1;
  height: 72rpx;
  background-color: #f5f5f5;
  border-radius: 36rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
}

.send-btn {
  margin-left: 16rpx;
  background-color: $uni-color-primary;
  color: #fff;
  font-size: 28rpx;
  padding: 0 32rpx;
  border-radius: 36rpx;
  height: 72rpx;
  line-height: 72rpx;
}

.share-btn {
  background: transparent;
  border: none;
  padding: 0;
  margin: 0;
  line-height: normal;

  &::after {
    border: none;
  }
}

.action-item.share-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.share-canvas {
  position: fixed;
  left: -9999rpx;
  top: -9999rpx;
  width: 750px;
  height: 1500px;
}
</style>
