// data/mockStories.js
// Mock data for Week 1 prototype

export const mockStories = [
  {
    id: '1',
    photoUrl: 'https://picsum.photos/seed/story1/800/600',
    caption: '奶奶80大寿！全家人在饭店聚在一起庆祝，特别热闹。',
    authorId: 'user1',
    authorName: '妈妈',
    authorAvatar: 'https://i.pravatar.cc/100?img=1',
    createdAt: new Date('2024-03-15').getTime()
  },
  {
    id: '2',
    photoUrl: 'https://picsum.photos/seed/story2/800/600',
    caption: '院子里的花开了，春天来了。',
    authorId: 'user2',
    authorName: '爸爸',
    authorAvatar: 'https://i.pravatar.cc/100?img=2',
    createdAt: new Date('2024-03-10').getTime()
  },
  {
    id: '3',
    photoUrl: 'https://picsum.photos/seed/story3/800/600',
    caption: '年夜饭！一桌好菜，年年有余。',
    authorId: 'user3',
    authorName: '玲阿姨',
    authorAvatar: 'https://i.pravatar.cc/100?img=3',
    createdAt: new Date('2024-02-10').getTime()
  },
  {
    id: '4',
    photoUrl: 'https://picsum.photos/seed/story4/800/600',
    caption: '今年的第一场雪，孩子们堆了个大雪人，玩得可开心了。',
    authorId: 'user1',
    authorName: '妈妈',
    authorAvatar: 'https://i.pravatar.cc/100?img=1',
    createdAt: new Date('2024-01-20').getTime()
  },
  {
    id: '5',
    photoUrl: 'https://picsum.photos/seed/story5/800/600',
    caption: '全家一起去爬山，山顶的风景真美！',
    authorId: 'user2',
    authorName: '爸爸',
    authorAvatar: 'https://i.pravatar.cc/100?img=2',
    createdAt: new Date('2023-12-28').getTime()
  }
]

// Helper to group stories by month
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

// Simulated API delay
export function fetchStories(delay = 500) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        stories: mockStories,
        hasMore: false
      })
    }, delay)
  })
}
