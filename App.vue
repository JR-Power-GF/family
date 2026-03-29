<script setup>
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app'
import { cacheManager, CacheKeys } from './utils/cache.js'
import { recoverStaleItems } from './utils/offline.js'
import { syncManager } from './utils/syncManager.js'

onLaunch(() => {
  console.log('App Launch')

  // Initialize WeChat Cloud
  if (wx.cloud) {
    wx.cloud.init({
      env: 'cloud1-6geq4sla3d88052d',
      traceUser: true
    })
    console.log('WeChat Cloud initialized')
  }

  // Clear expired cache entries
  cacheManager.clearExpired()

  // Recover stale items (app killed during sync)
  recoverStaleItems()

  // Listen for network changes
  uni.onNetworkStatusChange((res) => {
    console.log(`[Network] ${res.isConnected ? 'Connected' : 'Disconnected'}`)

    if (res.isConnected) {
      syncManager.syncAll()
    }
  })

  // Trigger initial sync if online
  syncManager.syncAll()
})

onShow(() => {
  console.log('App Show')
})

onHide(() => {
  console.log('App Hide')
})
</script>

<style lang="scss">
@import './styles/tokens.scss';

/* Global styles */
page {
  background-color: $uni-bg-color-grey;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
</style>
