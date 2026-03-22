// cloudfunctions/getUserInfo/index.js
// 获取用户信息云函数

const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  // Default response
  const result = {
    openid,
    appid: wxContext.APPID,
    unionid: wxContext.UNIONID,
    nickName: '匿名用户',
    avatarUrl: ''
  }

  // Try to get user's saved profile from family_members
  try {
    const { data: members } = await db.collection('family_members')
      .where({
        userId: openid
      })
      .limit(1)
      .get()

    if (members.length > 0) {
      const member = members[0]
      result.nickName = member.nickName || '匿名用户'
      result.avatarUrl = member.avatar || ''
      result.familyId = member.familyId
      result.isAdmin = member.isAdmin || false
    }
  } catch (e) {
    console.error('Failed to get user profile:', e)
  }

  return result
}
