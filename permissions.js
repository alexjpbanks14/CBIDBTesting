const { query } = require('./connection')
const { sessionTableInfo, permissionTableInfo } = require('./tableInfo')

const PERMISSIONS = {
    DELETE_RESTRICTION: 0,
    UPDATE_RESTRICTION: 1,
    TOGGLE_RESTRICTION: 2,
    DELETE_IMAGE: 3,
    UPDATE_IMAGE: 4,
    CHANGE_PROGRAM: 5,
    CHANGE_OWN_PASSWORD: 6,
    MANAGE_USERS: 7,
    VIEW_USERS: 8,
    VIEW_PERMISSIONS: 9,
    UPDATE_PERMISSIONS: 10,
    DELETE_PERMISSIONS: 11
}

async function getCurrentSession(req){
    const sessionUUID = String(req.cookies.sessionUUID)
    return await query("SELECT userID FROM " + sessionTableInfo.tableName + " WHERE sessionUUID = ? AND active = TRUE",[sessionUUID])
}

async function checkPermission(req, res, requiredPermissions) {
    const permissions = await getUserPermissions(req)
    var hasIt = true
    requiredPermissions.forEach((a) => {
      hasIt = hasIt && permissions.find((b) => a == b)
    })
    return hasIt
}

async function getUserPermissions(request){
    const currentSession = await getCurrentSession(request)
    if(currentSession.length > 0){
      const permissions = await query("SELECT permissionKey FROM " + permissionTableInfo.tableName + " WHERE userID = ?", [currentSession[0].userID])
      return permissions.map((a) => a.permissionKey)
    }else{
      return []
    }
  }

module.exports = {PERMISSIONS, checkPermission, getUserPermissions, getCurrentSession}