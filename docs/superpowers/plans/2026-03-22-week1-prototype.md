# Family Stories Week 1 Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working prototype with Timeline view, Add Story flow, and Story Detail page using mock data — no backend yet.

**Architecture:** Vue 3 + uni-app for WeChat mini-program. Component-based with mock data layer. State managed via Vue reactive refs (lightweight for this scope). Design tokens extend uni.scss.

**Tech Stack:** uni-app, Vue 3 (Composition API), SCSS, mock data

**Spec:** `gaofang_design.md`

---

## File Structure

```
pages/
  index/index.vue              # Timeline (modify) - main home screen
  add-story/add-story.vue      # Add Story (create) - photo + caption
  story-detail/story-detail.vue # Story Detail (create) - full view

components/
  StoryCard.vue                # Photo + caption + author card
  MonthHeader.vue              # Month section divider
  EmptyState.vue               # "No stories yet" with CTA
  LoadingSkeleton.vue          # Skeleton cards for loading
  OfflineBanner.vue            # Network status banner

data/
  mockStories.js               # Mock story data

styles/
  tokens.scss                  # Product design tokens
```

---

## Task 1: Setup Design Tokens

**Files:**
- Create: `styles/tokens.scss`

- [ ] **Step 1: Create tokens.scss extending uni.scss**

```scss
// Product-specific design tokens
// Extends uni.scss base variables

// Spacing scale (beyond uni.scss)
$spacing-xs: 8rpx;
$spacing-sm: 16rpx;
$spacing-md: 32rpx;
$spacing-lg: 48rpx;
$spacing-xl: 64rpx;

// Card specs
$card-radius: 24rpx;
$card-margin-bottom: 32rpx;
$card-text-padding: 24rpx;

// Month header
$month-header-height: 96rpx;
$month-header-font-size: 36rpx;

// Touch targets
$touch-target-min: 88rpx;

// Animation
$transition-fast: 150ms;
$transition-normal: 200ms;
$toast-duration: 2000ms;
```

- [ ] **Step 2: Import tokens in App.vue**

Modify `App.vue`:

```vue
<script>
export default {
  onLaunch: function() {
    console.log('App Launch')
  },
  onShow: function() {
    console.log('App Show')
  },
  onHide: function() {
    console.log('App Hide')
  }
}
</script>

<style lang="scss">
@import './styles/tokens.scss';

/* Global styles */
page {
  background-color: $uni-bg-color-grey;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
</style>
```

- [ ] **Step 3: Verify compilation**

Run: Build in WeChat DevTools
Expected: No errors, app loads

- [ ] **Step 4: Commit**

```bash
git add styles/tokens.scss App.vue
git commit -m "feat: add design tokens and global styles"
```

---

## Task 2: Create Mock Data

**Files:**
- Create: `data/mockStories.js`

- [ ] **Step 1: Create mock story data**

```javascript
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
```

- [ ] **Step 2: Commit**

```bash
git add data/mockStories.js
git commit -m "feat: add mock story data with grouping helper"
```

---

## Task 3: Create MonthHeader Component

**Files:**
- Create: `components/MonthHeader.vue`

- [ ] **Step 1: Create MonthHeader component**

```vue
<template>
  <view class="month-header">
    <text class="month-label">{{ label }}</text>
    <view class="divider"></view>
  </view>
</template>

<script setup>
defineProps({
  label: {
    type: String,
    required: true
  }
})
</script>

<style lang="scss" scoped>
.month-header {
  height: 96rpx;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 0 32rpx;
}

.month-label {
  font-size: 36rpx;
  font-weight: 600;
  color: $uni-text-color;
  line-height: 1.4;
}

.divider {
  height: 1px;
  background-color: #eee;
  margin-top: 16rpx;
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add components/MonthHeader.vue
git commit -m "feat: add MonthHeader component"
```

---

## Task 4: Create StoryCard Component

**Files:**
- Create: `components/StoryCard.vue`

- [ ] **Step 1: Create StoryCard component**

```vue
<template>
  <view class="story-card" @click="handleTap">
    <image
      class="story-photo"
      :src="story.photoUrl"
      mode="aspectFill"
      lazy-load
    />
    <view class="story-content">
      <text class="story-caption">{{ story.caption }}</text>
      <view class="story-meta">
        <image class="author-avatar" :src="story.authorAvatar" mode="aspectFill" />
        <text class="author-name">{{ story.authorName }}</text>
        <text class="story-date"> · {{ formattedDate }}</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  story: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['tap'])

const formattedDate = computed(() => {
  const date = new Date(props.story.createdAt)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
})

function handleTap() {
  emit('tap', props.story)
}
</script>

<style lang="scss" scoped>
.story-card {
  background-color: $uni-bg-color;
  border-radius: 24rpx;
  margin-bottom: 32rpx;
  overflow: hidden;

  &:active {
    opacity: 0.7;
  }
}

.story-photo {
  width: 100%;
  height: 400rpx; /* 4:3 aspect ratio at 300rpx width is 400rpx height for card */
  background-color: #f0f0f0;
}

.story-content {
  padding: 24rpx;
}

.story-caption {
  font-size: 32rpx;
  color: $uni-text-color;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}

.story-meta {
  display: flex;
  align-items: center;
  margin-top: 16rpx;
}

.author-avatar {
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  margin-right: 12rpx;
  background-color: #f0f0f0;
}

.author-name {
  font-size: 24rpx;
  color: $uni-text-color-grey;
}

.story-date {
  font-size: 24rpx;
  color: $uni-text-color-grey;
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add components/StoryCard.vue
git commit -m "feat: add StoryCard component with tap feedback"
```

---

## Task 5: Create EmptyState Component

**Files:**
- Create: `components/EmptyState.vue`

- [ ] **Step 1: Create EmptyState component**

```vue
<template>
  <view class="empty-state">
    <view class="empty-icon">
      <text class="icon">📷</text>
    </view>
    <text class="empty-title">No stories yet</text>
    <text class="empty-body">Be the first to share a family memory!</text>
    <button class="cta-button" @click="emit('addStory')">
      Add first story
    </button>
  </view>
</template>

<script setup>
const emit = defineEmits(['addStory'])
</script>

<style lang="scss" scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80rpx 48rpx;
}

.empty-icon {
  width: 160rpx;
  height: 160rpx;
  background-color: #f5f5f5;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 32rpx;
}

.icon {
  font-size: 80rpx;
}

.empty-title {
  font-size: 36rpx;
  font-weight: 500;
  color: $uni-text-color;
  margin-bottom: 16rpx;
}

.empty-body {
  font-size: 28rpx;
  color: #666;
  text-align: center;
  line-height: 1.6;
  margin-bottom: 48rpx;
}

.cta-button {
  background-color: $uni-color-primary;
  color: #fff;
  font-size: 32rpx;
  font-weight: 500;
  border-radius: 16rpx;
  padding: 24rpx 48rpx;
  border: none;

  &:active {
    opacity: 0.8;
  }
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add components/EmptyState.vue
git commit -m "feat: add EmptyState component with CTA"
```

---

## Task 6: Create LoadingSkeleton Component

**Files:**
- Create: `components/LoadingSkeleton.vue`

- [ ] **Step 1: Create LoadingSkeleton component**

```vue
<template>
  <view class="skeleton-list">
    <view v-for="i in count" :key="i" class="skeleton-card">
      <view class="skeleton-photo"></view>
      <view class="skeleton-content">
        <view class="skeleton-line skeleton-line-long"></view>
        <view class="skeleton-line skeleton-line-medium"></view>
        <view class="skeleton-meta"></view>
      </view>
    </view>
  </view>
</template>

<script setup>
defineProps({
  count: {
    type: Number,
    default: 3
  }
})
</script>

<style lang="scss" scoped>
.skeleton-list {
  padding: 0 32rpx;
}

.skeleton-card {
  background-color: $uni-bg-color;
  border-radius: 24rpx;
  margin-bottom: 32rpx;
  overflow: hidden;
}

.skeleton-photo {
  width: 100%;
  height: 400rpx;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

.skeleton-content {
  padding: 24rpx;
}

.skeleton-line {
  height: 28rpx;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4rpx;
  margin-bottom: 12rpx;

  &.skeleton-line-long {
    width: 100%;
  }

  &.skeleton-line-medium {
    width: 70%;
  }
}

.skeleton-meta {
  height: 48rpx;
  width: 200rpx;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4rpx;
  margin-top: 16rpx;
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add components/LoadingSkeleton.vue
git commit -m "feat: add LoadingSkeleton with shimmer animation"
```

---

## Task 7: Create OfflineBanner Component

**Files:**
- Create: `components/OfflineBanner.vue`

- [ ] **Step 1: Create OfflineBanner component**

```vue
<template>
  <view v-if="!isOnline" class="offline-banner">
    <text class="offline-icon">⚠️</text>
    <text class="offline-text">Offline — stories will sync when connected</text>
  </view>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const isOnline = ref(true)

function updateOnlineStatus() {
  isOnline.value = uni.getNetworkType
    ? true // In mini-program, assume online for mock
    : navigator.onLine
}

onMounted(() => {
  updateOnlineStatus()
  // For real app, would listen to network changes
})

defineExpose({ isOnline })
</script>

<style lang="scss" scoped>
.offline-banner {
  background-color: #fff3cd;
  padding: 20rpx 32rpx;
  display: flex;
  align-items: center;
}

.offline-icon {
  margin-right: 12rpx;
}

.offline-text {
  font-size: 26rpx;
  color: #856404;
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add components/OfflineBanner.vue
git commit -m "feat: add OfflineBanner component"
```

---

## Task 8: Build Timeline Page

**Files:**
- Modify: `pages/index/index.vue`
- Modify: `pages.json`

- [ ] **Step 1: Update pages.json for timeline**

```json
{
  "pages": [
    {
      "path": "pages/index/index",
      "style": {
        "navigationBarTitleText": "Home",
        "navigationBarBackgroundColor": "#F8F8F8"
      }
    },
    {
      "path": "pages/add-story/add-story",
      "style": {
        "navigationBarTitleText": "Add Story"
      }
    },
    {
      "path": "pages/story-detail/story-detail",
      "style": {
        "navigationBarTitleText": "Story"
      }
    }
  ],
  "globalStyle": {
    "navigationBarTextStyle": "black",
    "navigationBarTitleText": "Family Stories",
    "navigationBarBackgroundColor": "#F8F8F8",
    "backgroundColor": "#F8F8F8"
  },
  "uniIdRouter": {}
}
```

- [ ] **Step 2: Create Timeline page**

```vue
<template>
  <view class="timeline-page">
    <OfflineBanner />

    <!-- Loading state -->
    <LoadingSkeleton v-if="loading" :count="3" />

    <!-- Empty state -->
    <EmptyState
      v-else-if="!loading && monthlyGroups.length === 0"
      @add-story="goToAddStory"
    />

    <!-- Timeline content -->
    <scroll-view
      v-else
      scroll-y
      class="timeline-scroll"
      refresher-enabled
      :refresher-triggered="refreshing"
      @refresherrefresh="onRefresh"
    >
      <view class="timeline-content">
        <template v-for="group in monthlyGroups" :key="group.key">
          <MonthHeader :label="group.label" />
          <StoryCard
            v-for="story in group.stories"
            :key="story.id"
            :story="story"
            @tap="goToDetail"
          />
        </template>
      </view>
    </scroll-view>

    <!-- FAB -->
    <view class="fab" @click="goToAddStory">
      <text class="fab-icon">+</text>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { fetchStories, groupByMonth } from '../../data/mockStories.js'
import MonthHeader from '../../components/MonthHeader.vue'
import StoryCard from '../../components/StoryCard.vue'
import EmptyState from '../../components/EmptyState.vue'
import LoadingSkeleton from '../../components/LoadingSkeleton.vue'
import OfflineBanner from '../../components/OfflineBanner.vue'

const loading = ref(true)
const refreshing = ref(false)
const stories = ref([])
const monthlyGroups = ref([])

onMounted(async () => {
  await loadStories()
})

async function loadStories() {
  loading.value = true
  try {
    const result = await fetchStories()
    stories.value = result.stories
    monthlyGroups.value = groupByMonth(result.stories)
  } finally {
    loading.value = false
  }
}

async function onRefresh() {
  refreshing.value = true
  await loadStories()
  refreshing.value = false
}

function goToAddStory() {
  uni.navigateTo({
    url: '/pages/add-story/add-story'
  })
}

function goToDetail(story) {
  uni.navigateTo({
    url: `/pages/story-detail/story-detail?id=${story.id}`
  })
}
</script>

<style lang="scss" scoped>
.timeline-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.timeline-scroll {
  flex: 1;
}

.timeline-content {
  padding: 16rpx 32rpx 120rpx;
}

.fab {
  position: fixed;
  right: 32rpx;
  bottom: 48rpx;
  width: 112rpx;
  height: 112rpx;
  background-color: $uni-color-primary;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4rpx 16rpx rgba(0, 122, 255, 0.3);

  &:active {
    opacity: 0.8;
    transform: scale(0.95);
  }
}

.fab-icon {
  color: #fff;
  font-size: 56rpx;
  font-weight: 300;
}
</style>
```

- [ ] **Step 3: Create placeholder pages for navigation**

Create `pages/add-story/add-story.vue`:

```vue
<template>
  <view class="page">
    <text>Add Story (coming next)</text>
  </view>
</template>

<style>
.page { padding: 32rpx; }
</style>
```

Create `pages/story-detail/story-detail.vue`:

```vue
<template>
  <view class="page">
    <text>Story Detail (coming next)</text>
  </view>
</template>

<style>
.page { padding: 32rpx; }
</style>
```

- [ ] **Step 4: Verify timeline loads with mock data**

Run: Build in WeChat DevTools
Expected: Timeline shows 3 month groups with 5 stories total

- [ ] **Step 5: Commit**

```bash
git add pages/index/index.vue pages.json pages/add-story/add-story.vue pages/story-detail/story-detail.vue
git commit -m "feat: implement Timeline page with mock data"
```

---

## Task 9: Build Add Story Page

**Files:**
- Modify: `pages/add-story/add-story.vue`

- [ ] **Step 1: Implement Add Story page**

```vue
<template>
  <view class="add-story-page">
    <!-- Photo area -->
    <view class="photo-area" @click="choosePhotoSource">
      <image
        v-if="photoPath"
        :src="photoPath"
        mode="aspectFill"
        class="photo-preview"
      />
      <view v-else class="photo-placeholder">
        <text class="placeholder-icon">📷</text>
        <text class="placeholder-text">Tap to add photo</text>
      </view>
    </view>

    <!-- Source buttons -->
    <view class="source-buttons">
      <button class="source-btn" @click="chooseFromAlbum">
        <text class="btn-icon">📷</text>
        <text class="btn-label">Album</text>
      </button>
      <button class="source-btn" @click="takePhoto">
        <text class="btn-icon">📸</text>
        <text class="btn-label">Camera</text>
      </button>
    </view>

    <!-- Caption input -->
    <view class="caption-area">
      <textarea
        v-model="caption"
        class="caption-input"
        placeholder="Write your story..."
        :maxlength="500"
        auto-height
        :show-confirm-bar="false"
      />
      <text class="char-count">{{ caption.length }}/500</text>
    </view>

    <!-- Post button -->
    <view class="button-area">
      <button
        class="post-btn"
        :disabled="!canPost || posting"
        @click="postStory"
      >
        {{ posting ? 'Posting...' : 'Post' }}
      </button>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'

const photoPath = ref('')
const caption = ref('')
const posting = ref(false)

const canPost = computed(() => photoPath.value && caption.value.trim())

function choosePhotoSource() {
  uni.showActionSheet({
    itemList: ['Choose from Album', 'Take Photo'],
    success: (res) => {
      if (res.tapIndex === 0) {
        chooseFromAlbum()
      } else {
        takePhoto()
      }
    }
  })
}

function chooseFromAlbum() {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album'],
    success: (res) => {
      photoPath.value = res.tempFilePaths[0]
    }
  })
}

function takePhoto() {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['camera'],
    success: (res) => {
      photoPath.value = res.tempFilePaths[0]
    }
  })
}

async function postStory() {
  if (!canPost.value || posting.value) return

  posting.value = true

  // Simulate upload delay
  await new Promise(resolve => setTimeout(resolve, 1500))

  // Show success toast
  uni.showToast({
    title: 'Posted!',
    icon: 'success',
    duration: 2000
  })

  // Navigate back to timeline
  setTimeout(() => {
    uni.navigateBack()
  }, 500)
}
</script>

<style lang="scss" scoped>
.add-story-page {
  padding: 32rpx;
  min-height: 100vh;
  background-color: $uni-bg-color-grey;
}

.photo-area {
  width: 100%;
  height: 500rpx;
  background-color: #fff;
  border-radius: 24rpx;
  border: 4rpx dashed #ccc;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  margin-bottom: 32rpx;

  &:active {
    opacity: 0.8;
  }
}

.photo-preview {
  width: 100%;
  height: 100%;
}

.photo-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.placeholder-icon {
  font-size: 80rpx;
  margin-bottom: 16rpx;
}

.placeholder-text {
  font-size: 28rpx;
  color: $uni-text-color-grey;
}

.source-buttons {
  display: flex;
  gap: 24rpx;
  margin-bottom: 32rpx;
}

.source-btn {
  flex: 1;
  height: 88rpx;
  background-color: #fff;
  border: 2rpx solid $uni-border-color;
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;

  &:active {
    background-color: #f5f5f5;
  }
}

.btn-icon {
  font-size: 36rpx;
}

.btn-label {
  font-size: 28rpx;
  color: $uni-text-color;
}

.caption-area {
  background-color: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 32rpx;
}

.caption-input {
  width: 100%;
  min-height: 200rpx;
  font-size: 32rpx;
  color: $uni-text-color;
  line-height: 1.5;
}

.char-count {
  font-size: 24rpx;
  color: $uni-text-color-grey;
  text-align: right;
  display: block;
  margin-top: 16rpx;
}

.button-area {
  padding: 0 32rpx;
}

.post-btn {
  width: 100%;
  height: 88rpx;
  background-color: $uni-color-primary;
  color: #fff;
  font-size: 32rpx;
  font-weight: 500;
  border-radius: 16rpx;
  border: none;

  &:active:not([disabled]) {
    opacity: 0.8;
  }

  &[disabled] {
    opacity: 0.3;
  }
}
</style>
```

- [ ] **Step 2: Verify add story flow**

Run: Build in WeChat DevTools
Expected: Can choose photo, enter caption, post shows toast and navigates back

- [ ] **Step 3: Commit**

```bash
git add pages/add-story/add-story.vue
git commit -m "feat: implement Add Story page with photo picker and caption"
```

---

## Task 10: Build Story Detail Page

**Files:**
- Modify: `pages/story-detail/story-detail.vue`

- [ ] **Step 1: Implement Story Detail page**

```vue
<template>
  <view class="detail-page">
    <!-- Loading -->
    <view v-if="loading" class="loading-area">
      <text>Loading...</text>
    </view>

    <!-- Story content -->
    <view v-else-if="story" class="story-content">
      <!-- Full photo -->
      <image
        :src="story.photoUrl"
        mode="widthFix"
        class="full-photo"
        lazy-load
      />

      <!-- Caption -->
      <view class="caption-section">
        <text class="full-caption">{{ story.caption }}</text>
      </view>

      <!-- Meta info -->
      <view class="meta-section">
        <view class="meta-divider"></view>
        <view class="author-row">
          <image :src="story.authorAvatar" class="author-avatar" mode="aspectFill" />
          <text class="author-name">{{ story.authorName }}</text>
        </view>
        <text class="story-date">{{ formattedDate }}</text>
      </view>
    </view>

    <!-- Not found -->
    <view v-else class="not-found">
      <text>Story not found</text>
      <button class="back-btn" @click="goBack">Go Back</button>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { mockStories } from '../../data/mockStories.js'

const story = ref(null)
const loading = ref(true)

const formattedDate = computed(() => {
  if (!story.value) return ''
  const date = new Date(story.value.createdAt)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
})

onMounted(() => {
  // Get story ID from query params
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  const storyId = currentPage.options?.id

  // Simulate loading
  setTimeout(() => {
    story.value = mockStories.find(s => s.id === storyId) || null
    loading.value = false
  }, 300)
})

function goBack() {
  uni.navigateBack()
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

.caption-section {
  padding: 32rpx;
}

.full-caption {
  font-size: 34rpx;
  color: $uni-text-color;
  line-height: 1.6;
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
</style>
```

- [ ] **Step 2: Verify story detail navigation**

Run: Build in WeChat DevTools
Expected: Tap story card → detail page shows full photo + caption + author

- [ ] **Step 3: Commit**

```bash
git add pages/story-detail/story-detail.vue
git commit -m "feat: implement Story Detail page with full content view"
```

---

## Task 11: Final Integration & Testing

**Files:**
- All files

- [ ] **Step 1: Test complete user flow**

1. Open app → see timeline with 5 mock stories
2. Pull to refresh → stories reload
3. Tap story card → detail page opens
4. Tap back → returns to timeline
5. Tap "+" FAB → add story page opens
6. Choose photo → preview shows
7. Enter caption → char count updates
8. Tap Post → toast shows, navigates back
9. Empty state → remove all stories, verify empty state shows

- [ ] **Step 2: Test empty state**

Temporarily set `mockStories` to empty array, verify empty state displays correctly.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete Week 1 prototype - timeline, add story, detail pages"
```

---

## Summary

| Task | Description | Status |
|------|-------------|--------|
| 1 | Design tokens setup | - [ ] |
| 2 | Mock data | - [ ] |
| 3 | MonthHeader component | - [ ] |
| 4 | StoryCard component | - [ ] |
| 5 | EmptyState component | - [ ] |
| 6 | LoadingSkeleton component | - [ ] |
| 7 | OfflineBanner component | - [ ] |
| 8 | Timeline page | - [ ] |
| 9 | Add Story page | - [ ] |
| 10 | Story Detail page | - [ ] |
| 11 | Integration testing | - [ ] |

**Total estimated time:** 2-3 hours
