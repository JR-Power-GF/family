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
