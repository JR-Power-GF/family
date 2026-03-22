// cloudfunctions/getUserInfo/index.js
// 获取用户信息云函数

const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()

  return {
    openid: wxContext.OPENID,
    appid: wxContext.APPID,
    unionid: wxContext.UNIONID,
    // 尝试获取用户昵称和头像（需要用户授权）
    nickName: event.nickName || '匿名用户',
    avatarUrl: event.avatarUrl || ''
  }
}
