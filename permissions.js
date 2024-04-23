const { query, config } = require('./connection')
const { sessionTableInfo, permissionTableInfo } = require('./tableInfo')
const { handleError } = require('./handleError')
const { timingSafeEqual } = require('node:crypto')

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
    DELETE_PERMISSIONS: 11,
    ADD_USER: 12,
    DELETE_USER: 13,
    MODIFY_FILES: 14,
}

const encoder = new TextEncoder('UTF-8')

async function getCurrentSession(req){
    const sessionUUID = String(req.cookies.sessionUUID)
    const sessionID = Number(req.cookies.sessionID)
    console.log(req.cookies)
    if(isNaN(sessionID))
      return undefined
    const session = await query("SELECT * FROM " + sessionTableInfo.tableName + " WHERE sessionID = ? AND active = TRUE", [sessionID])
    if(session.length > 0 && ((new Date() - session[0].createdOn) / 1000 / 60 / 60 / 24) < parseInt(config.authDurationDays)){
      const sessionUUIDCli = encoder.encode(sessionUUID)
      const sessionUUIDSer = encoder.encode(session[0].sessionUUID)
      if(timingSafeEqual(sessionUUIDCli, sessionUUIDSer))
        return session[0]
    }
    return undefined
}

async function getUserPermissionsM(currentSession){
  if(currentSession){
    const permissions = await query("SELECT permissionKey FROM " + permissionTableInfo.tableName + " WHERE userID = ?", [currentSession.userID])
    return permissions.map((a) => a.permissionKey)
  }else{
    return []
  }
}

async function getUserPermissions(request){
  const currentSession = await getCurrentSession(request)
  return await getUserPermissionsM(currentSession)
}

function checkPermissionM(permissions, requiredPermissions) {
  var hasIt = true
  requiredPermissions.forEach((a) => {
    hasIt = (hasIt && (permissions.find((b) => a == b) != undefined))
  })
  return hasIt
}

async function checkPermission(req, res, requiredPermissions) {
    const permissions = await getUserPermissions(req).catch((e) => {
        handleError(e, req, res)
    })
    return checkPermissionM(permissions, requiredPermissions)
}

module.exports = {PERMISSIONS, checkPermission, checkPermissionM, getUserPermissions, getUserPermissionsM, getCurrentSession}