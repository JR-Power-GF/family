// api/index.js
// WeChat Cloud API service layer

const db = wx.cloud.database()
const _ = db.command

/**
 * Stories API
 */
export const storiesApi = {
  /**
   * Get stories with pagination and month grouping
   */
  async getStories(options = {}) {
    const { limit = 20, skip = 0 } = options

    const { data: stories, errMsg } = await db.collection('stories')
      .orderBy('createdAt', 'desc')
      .skip(skip)
      .limit(limit)
      .get()

    // Get total count for pagination
    const { total } = await db.collection('stories').count()

    return {
      stories,
      hasMore: skip + stories.length < total,
      total
    }
  },

  /**
   * Get a single story by ID
   */
  async getStory(id) {
    const { data: story } = await db.collection('stories').doc(id).get()
    return story
  },

  /**
   * Create a new story
   */
  async createStory({ photoFile, caption }) {
    // Get current user info
    const { result: userInfo } = await wx.cloud.callFunction({
      name: 'getUserInfo'
    }).catch(() => ({ result: { openid: 'anonymous', nickName: '匿名用户', avatarUrl: '' } }))

    // Upload photo to cloud storage
    const ext = photoFile.path.split('.').pop() || 'jpg'
    const cloudPath = `stories/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const { fileID } = await wx.cloud.uploadFile({
      cloudPath,
      filePath: photoFile.path
    })

    // Create story record
    const { _id } = await db.collection('stories').add({
      data: {
        photoUrl: fileID,
        caption,
        authorId: userInfo.openid || 'anonymous',
        authorName: userInfo.nickName || '匿名用户',
        authorAvatar: userInfo.avatarUrl || '',
        createdAt: db.serverDate()
      }
    })

    // Return the created story
    return await this.getStory(_id)
  },

  /**
   * Update a story (only caption can be updated)
   */
  async updateStory(id, { caption }) {
    await db.collection('stories').doc(id).update({
      data: {
        caption,
        updatedAt: db.serverDate()
      }
    })
    return await this.getStory(id)
  },

  /**
   * Delete a story (deletes photo from storage too)
   */
  async deleteStory(id) {
    // Get story to find photo URL
    const story = await this.getStory(id)

    // Delete photo from cloud storage
    if (story.photoUrl) {
      await wx.cloud.deleteFile({
        fileList: [story.photoUrl]
      }).catch(() => {}) // Ignore delete errors
    }

    // Delete story record
    await db.collection('stories').doc(id).remove()

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
