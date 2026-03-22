<script>
export default {
  onLaunch: function() {
    console.log('App Launch')

    // Initialize WeChat Cloud
    if (wx.cloud) {
      wx.cloud.init({
        env: 'cloud1-6geq4sla3d88052d',
        traceUser: true
      })
      console.log('WeChat Cloud initialized')
    }
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
