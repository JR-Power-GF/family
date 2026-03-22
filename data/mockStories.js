// data/mockStories.js
// Mock data for Week 1 prototype

export const mockStories = [
  {
    id: '1',
    photoUrl: 'https://picsum.photos/seed/story1/800/600',
    caption: 'Grandma\'s 80th birthday celebration! The whole family gathered at the restaurant.',
    authorId: 'user1',
    authorName: 'Mom',
    authorAvatar: 'https://i.pravatar.cc/100?img=1',
    createdAt: new Date('2024-03-15').getTime()
  },
  {
    id: '2',
    photoUrl: 'https://picsum.photos/seed/story2/800/600',
    caption: 'Spring flowers blooming in the garden.',
    authorId: 'user2',
    authorName: 'Dad',
    authorAvatar: 'https://i.pravatar.cc/100?img=2',
    createdAt: new Date('2024-03-10').getTime()
  },
  {
    id: '3',
    photoUrl: 'https://picsum.photos/seed/story3/800/600',
    caption: 'Lunar New Year reunion dinner. So much good food!',
    authorId: 'user3',
    authorName: 'Auntie Ling',
    authorAvatar: 'https://i.pravatar.cc/100?img=3',
    createdAt: new Date('2024-02-10').getTime()
  },
  {
    id: '4',
    photoUrl: 'https://picsum.photos/seed/story4/800/600',
    caption: 'First snow of the winter. Kids had so much fun building a snowman.',
    authorId: 'user1',
    authorName: 'Mom',
    authorAvatar: 'https://i.pravatar.cc/100?img=1',
    createdAt: new Date('2024-01-20').getTime()
  },
  {
    id: '5',
    photoUrl: 'https://picsum.photos/seed/story5/800/600',
    caption: 'Family hiking trip up the mountain. Beautiful view from the top!',
    authorId: 'user2',
    authorName: 'Dad',
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
    const label = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })

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
