// api/index.js
// WeChat Cloud API service layer

import { cacheManager, CacheKeys, CacheTTL } from '../utils/cache.js'

const db = wx.cloud.database()
const _ = db.command

/**
 * Helper to create notification
 */
async function createNotification({ type, targetId, actorId, actorName, actorAvatar, storyId, preview }) {
  try {
    // Don't notify yourself
    if (targetId === actorId) return

    await db.collection('notifications').add({
      data: {
        type,
        targetId,
        actorId,
        actorName,
        actorAvatar,
        storyId,
        preview,
        isRead: false,
        createdAt: db.serverDate()
      }
    })
  } catch (e) {
    console.error('Failed to create notification:', e)
  }
}

/**
 * Extract @mentions from content
 * @param {string} content - Comment content
 * @returns {Array<{name: string, id: string}>} Array of mentioned users
 */
function extractMentions(content) {
  if (!content) return []

  // Match @username patterns (Chinese, English, numbers, underscores)
  const mentionRegex = /@([\w\u4e00-\u9fa5]+)/g
  const mentions = []
  let match

  while ((match = mentionRegex.exec(content)) !== null) {
    const name = match[1]
    // Avoid duplicates
    if (!mentions.find(m => m.name === name)) {
      mentions.push({ name })
    }
  }

  return mentions
}

/**
 * Create mention notifications for mentioned users
 */
async function createMentionNotifications({ content, storyId, actorId, actorName, actorAvatar }) {
  const mentions = extractMentions(content)
  if (mentions.length === 0) return

  try {
    // Get all family members to resolve names to IDs
    const { data: members } = await db.collection('family_members').get()

    for (const mention of mentions) {
      // Find member by nickname (partial match for flexibility)
      const member = members.find(m =>
        m.nickName && m.nickName.includes(mention.name)
      )

      if (member && member._id !== actorId) {
        await createNotification({
          type: 'mention',
          targetId: member._id,
          actorId,
          actorName,
          actorAvatar,
          storyId,
          preview: content.slice(0, 50)
        })
      }
    }
  } catch (e) {
    console.error('Failed to create mention notifications:', e)
  }
}

/**
 * Stories API
 */
export const storiesApi = {
  /**
   * Get stories with pagination and month grouping
   */
  async getStories(options = {}) {
    const { limit = 20, skip = 0, forceRefresh = false } = options

    // Check cache for first page only
    if (skip === 0 && !forceRefresh) {
      const cached = cacheManager.get(CacheKeys.STORIES)
      if (cached) {
        return cached
      }
    }

    const { data: stories, errMsg } = await db.collection('stories')
      .orderBy('createdAt', 'desc')
      .skip(skip)
      .limit(limit)
      .get()

    // Get total count for pagination
    const { total } = await db.collection('stories').count()

    // Get like counts and comment counts for each story
    const storiesWithCounts = await Promise.all(stories.map(async (story) => {
      const [likeCount, commentCount] = await Promise.all([
        db.collection('likes').where({ storyId: story._id }).count().catch(() => ({ total: 0 })),
        db.collection('comments').where({ storyId: story._id }).count().catch(() => ({ total: 0 }))
      ])
      return {
        ...story,
        likeCount: likeCount.total,
        commentCount: commentCount.total
      }
    }))

    const result = {
      stories: storiesWithCounts,
      hasMore: skip + stories.length < total,
      total
    }

    // Cache first page
    if (skip === 0) {
      cacheManager.set(CacheKeys.STORIES, result, CacheTTL.MEDIUM)
    }

    return result
  },

  /**
   * Get a single story by ID
   */
  async getStory(id, forceRefresh = false) {
    // Check cache first
    if (!forceRefresh) {
      const cached = cacheManager.get(CacheKeys.STORY(id))
      if (cached) {
        return cached
      }
    }

    const { data: story } = await db.collection('stories').doc(id).get()

    // Get like count and comment count
    const [likeCount, commentCount] = await Promise.all([
      db.collection('likes').where({ storyId: id }).count().catch(() => ({ total: 0 })),
      db.collection('comments').where({ storyId: id }).count().catch(() => ({ total: 0 }))
    ])

    const result = {
      ...story,
      likeCount: likeCount.total,
      commentCount: commentCount.total
    }

    // Cache the result
    cacheManager.set(CacheKeys.STORY(id), result, CacheTTL.MEDIUM)

    return result
  },

  /**
   * Create a new story with multiple photos
   * @param {Object} options - Story data
   * @param {Array} options.photoFiles - Array of photo files [{ path }]
   * @param {string} options.caption - Story caption
   * @param {Function} onProgress - Progress callback (0-100)
   */
  async createStory({ photoFiles, caption }, onProgress) {
    // Get current user info
    const { result: userInfo } = await wx.cloud.callFunction({
      name: 'getUserInfo'
    }).catch(() => ({ result: { openid: 'anonymous', nickName: '匿名用户', avatarUrl: '' } }))

    // Upload all photos to cloud storage
    const uploadedFileIds = []
    const totalPhotos = photoFiles.length

    for (let i = 0; i < totalPhotos; i++) {
      const photoFile = photoFiles[i]
      const ext = photoFile.path.split('.').pop() || 'jpg'
      const cloudPath = `stories/${Date.now()}-${i}-${Math.random().toString(36).slice(2)}.${ext}`

      const { fileID } = await wx.cloud.uploadFile({
        cloudPath,
        filePath: photoFile.path,
        onProgressUpdate: (res) => {
          // Calculate overall progress: each photo contributes equally
          const overallProgress = Math.floor(((i / totalPhotos) * 100) + (res.progress / totalPhotos))
          onProgress?.(overallProgress)
        }
      })

      uploadedFileIds.push(fileID)
    }

    onProgress?.(100)

    // Create story record with multiple photos
    const { _id } = await db.collection('stories').add({
      data: {
        photoUrls: uploadedFileIds, // Store array of photo URLs
        photoUrl: uploadedFileIds[0], // Keep first photo as cover for backward compatibility
        caption,
        authorId: userInfo.openid || 'anonymous',
        authorName: userInfo.nickName || '匿名用户',
        authorAvatar: userInfo.avatarUrl || '',
        createdAt: db.serverDate()
      }
    })

    // Return the created story
    const story = await this.getStory(_id)

    // Invalidate stories list cache
    cacheManager.delete(CacheKeys.STORIES)

    return story
  },

  /**
   * Create a story from offline queue (with pre-uploaded URLs)
   * Preserves original queued timestamp
   */
  async createStoryFromQueue({ photoUrls, caption, authorId, authorName, authorAvatar, queuedAt }) {
    const db = wx.cloud.database()

    // Check for duplicate by queuedAt timestamp (prevent double-posting)
    const { data: existing } = await db.collection('stories')
      .where({
        authorId,
        createdAt: new Date(queuedAt)
      })
      .get()

    if (existing.length > 0) {
      console.log('Story already synced, returning existing:', existing[0]._id)
      cacheManager.delete(CacheKeys.STORIES)
      return await this.getStory(existing[0]._id, true)
    }

    const { _id } = await db.collection('stories').add({
      data: {
        photoUrls,
        photoUrl: photoUrls[0],
        caption,
        authorId,
        authorName,
        authorAvatar,
        createdAt: new Date(queuedAt),  // Preserve original timestamp
        syncedAt: db.serverDate()
      }
    })

    // Invalidate cache
    cacheManager.delete(CacheKeys.STORIES)

    // Return the created story
    return await this.getStory(_id, true)
  },

  /**
   * Update a story (only caption can be updated)
   */
  async updateStory(id, { caption }) {
    // Verify ownership before update
    const isOwner = await this.isStoryOwner(id)
    if (!isOwner) {
      throw new Error('无权限修改此故事')
    }

    await db.collection('stories').doc(id).update({
      data: {
        caption,
        updatedAt: db.serverDate()
      }
    })

    // Invalidate cache
    cacheManager.delete(CacheKeys.STORY(id))
    cacheManager.delete(CacheKeys.STORIES)

    return await this.getStory(id, true)
  },

  /**
   * Delete a story (deletes all photos from storage too)
   * Only the story owner can delete
   */
  async deleteStory(id) {
    // Verify ownership before delete
    const isOwner = await this.isStoryOwner(id)
    if (!isOwner) {
      throw new Error('无权删除此故事')
    }

    // Get story to find photo URLs
    const story = await this.getStory(id)

    // Get all photos to delete (both photoUrls array and single photoUrl)
    const photosToDelete = story.photoUrls || (story.photoUrl ? [story.photoUrl] : [])

    // Delete all photos from cloud storage
    if (photosToDelete.length > 0) {
      await wx.cloud.deleteFile({
        fileList: photosToDelete
      }).catch(() => {}) // Ignore delete errors
    }

    // Delete all likes and comments (ignore if collections don't exist)
    await Promise.all([
      db.collection('likes').where({ storyId: id }).remove().catch(() => {}),
      db.collection('comments').where({ storyId: id }).remove().catch(() => {})
    ])

    // Delete story record
    await db.collection('stories').doc(id).remove()

    // Invalidate cache
    cacheManager.delete(CacheKeys.STORY(id))
    cacheManager.delete(CacheKeys.STORIES)
    cacheManager.delete(CacheKeys.COMMENTS(id))
    cacheManager.delete(CacheKeys.LIKES(id))

    return { success: true }
  },

  /**
   * Check if current user owns a story
   */
  async isStoryOwner(storyId) {
    const { result: userInfo } = await wx.cloud.callFunction({
      name: 'getUserInfo'
    }).catch(() => ({ result: { openid: null } }))

    const story = await this.getStory(storyId)
    return story.authorId === userInfo.openid
  },

  /**
   * Like a story
   */
  async likeStory(storyId) {
    const { result: userInfo } = await wx.cloud.callFunction({
      name: 'getUserInfo'
    }).catch(() => ({ result: { openid: 'anonymous', nickName: '匿名用户', avatarUrl: '' } }))

    try {
      // Check if already liked
      const { data: existing } = await db.collection('likes')
        .where({
          storyId,
          userId: userInfo.openid
        })
        .get()

      if (existing.length > 0) {
        // Unlike
        await db.collection('likes').doc(existing[0]._id).remove()
        return { liked: false }
      } else {
        // Like
        await db.collection('likes').add({
          data: {
            storyId,
            userId: userInfo.openid,
            createdAt: db.serverDate()
          }
        })

        // Create notification to story author
        const story = await this.getStory(storyId)
        await createNotification({
          type: 'like',
          targetId: story.authorId,
          actorId: userInfo.openid,
          actorName: userInfo.nickName || '匿名用户',
          actorAvatar: userInfo.avatarUrl || '',
          storyId,
          preview: story.caption ? story.caption.slice(0, 50) : '你的故事'
        })

        return { liked: true }
      }
    } catch (e) {
      console.error('Like failed:', e)
      throw e
    }
  },

  /**
   * Check if user liked a story
   */
  async hasLiked(storyId) {
    const { result: userInfo } = await wx.cloud.callFunction({
      name: 'getUserInfo'
    }).catch(() => ({ result: { openid: null } }))

    if (!userInfo.openid) return false

    try {
      const { total } = await db.collection('likes')
        .where({
          storyId,
          userId: userInfo.openid
        })
        .count()

      return total > 0
    } catch (e) {
      return false
    }
  },

  /**
   * Get comments for a story
   */
  async getComments(storyId, options = {}) {
    const { limit = 20, skip = 0, forceRefresh = false } = options

    // Check cache for first page
    if (skip === 0 && !forceRefresh) {
      const cached = cacheManager.get(CacheKeys.COMMENTS(storyId))
      if (cached) {
        return cached
      }
    }

    try {
      const { data: comments } = await db.collection('comments')
        .where({ storyId })
        .orderBy('createdAt', 'asc')
        .skip(skip)
        .limit(limit)
        .get()

      // Cache first page
      if (skip === 0) {
        cacheManager.set(CacheKeys.COMMENTS(storyId), comments, CacheTTL.SHORT)
      }

      return comments
    } catch (e) {
      return []
    }
  },

  /**
   * Add a comment
   */
  async addComment(storyId, content) {
    const { result: userInfo } = await wx.cloud.callFunction({
      name: 'getUserInfo'
    }).catch(() => ({ result: { openid: 'anonymous', nickName: '匿名用户', avatarUrl: '' } }))

    const { _id } = await db.collection('comments').add({
      data: {
        storyId,
        content,
        authorId: userInfo.openid,
        authorName: userInfo.nickName || '匿名用户',
        authorAvatar: userInfo.avatarUrl || '',
        createdAt: db.serverDate()
      }
    })

    // Create notification to story author
    const story = await this.getStory(storyId)
    await createNotification({
      type: 'comment',
      targetId: story.authorId,
      actorId: userInfo.openid,
      actorName: userInfo.nickName || '匿名用户',
      actorAvatar: userInfo.avatarUrl || '',
      storyId,
      preview: content.slice(0, 50)
    })

    // Create mention notifications for @mentioned users
    await createMentionNotifications({
      content,
      storyId,
      actorId: userInfo.openid,
      actorName: userInfo.nickName || '匿名用户',
      actorAvatar: userInfo.avatarUrl || ''
    })

    // Invalidate comments cache
    cacheManager.delete(CacheKeys.COMMENTS(storyId))

    return await db.collection('comments').doc(_id).get()
  },

  /**
   * Add a reply to a comment
   */
  async addReply(commentId, content) {
    const { result: userInfo } = await wx.cloud.callFunction({
      name: 'getUserInfo'
    }).catch(() => ({ result: { openid: 'anonymous', nickName: '匿名用户', avatarUrl: '' } }))

    // Get parent comment to find replyToName
    const parentComment = await db.collection('comments').doc(commentId).get()
    const replyToName = parentComment.data.authorName

    const replyId = `reply_${Date.now()}_${Math.random().toString(36).slice(2)}`

    await db.collection('comments').doc(commentId).update({
      data: {
        replies: db.command.push({
          _id: replyId,
          content,
          authorId: userInfo.openid,
          authorName: userInfo.nickName || '匿名用户',
          authorAvatar: userInfo.avatarUrl || '',
          replyToName,
          createdAt: db.serverDate()
        })
      }
    })

    // Create notification to comment author
    await createNotification({
      type: 'reply',
      targetId: parentComment.data.authorId,
      actorId: userInfo.openid,
      actorName: userInfo.nickName || '匿名用户',
      actorAvatar: userInfo.avatarUrl || '',
      storyId: parentComment.data.storyId,
      preview: content.slice(0, 50)
    })

    // Create mention notifications for @mentioned users
    await createMentionNotifications({
      content,
      storyId: parentComment.data.storyId,
      actorId: userInfo.openid,
      actorName: userInfo.nickName || '匿名用户',
      actorAvatar: userInfo.avatarUrl || ''
    })

    // Invalidate comments cache for this story
    cacheManager.delete(CacheKeys.COMMENTS(parentComment.data.storyId))

    return {
      _id: replyId,
      content,
      authorId: userInfo.openid,
      authorName: userInfo.nickName || '匿名用户',
      authorAvatar: userInfo.avatarUrl || '',
      replyToName
    }
  },

  /**
   * Delete a comment
   */
  async deleteComment(commentId) {
    const comment = await db.collection('comments').doc(commentId).get()

    // Get current user
    const { result: userInfo } = await wx.cloud.callFunction({
      name: 'getUserInfo'
    }).catch(() => ({ result: { openid: null } }))

    // Check ownership
    if (comment.data.authorId !== userInfo.openid) {
      throw new Error('Not authorized')
    }

    await db.collection('comments').doc(commentId).remove()
    return { success: true }
  }
}

/**
 * Group stories by month
 */
export function groupByMonth(stories) {
  const groups = {}

  stories.forEach(story => {
    const date = new Date(story.createdAt)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const label = date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' })

    if (!groups[key]) {
      groups[key] = { key, label, stories: [] }
    }
    groups[key].stories.push(story)
  })

  // Sort by key descending (newest first)
  return Object.values(groups).sort((a, b) => b.key.localeCompare(a.key))
}
