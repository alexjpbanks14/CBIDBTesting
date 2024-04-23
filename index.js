const { handleError, sendUnauthorized } = require('./handleError')
const axios = require('axios')
const fs = require('fs')
const bcrypt = require('bcrypt')
const { userTableInfo, imageTableInfo, restrictionGroupTableInfo, restrictionTableInfo, logoImageTableInfo, restrictionConditionTableInfo, singletonDataTableInfo, sessionTableInfo, permissionTableInfo } = require('./tableInfo')
const { parseResult, updateRowsStatement, parseRow, postTable, deleteTable  } = require('./sqlFunc')
const { connection, app, upload, config, port, query, apiPrefix } = require('./connection')
var proxy = require('express-http-proxy')
const { PERMISSIONS, getUserPermissions, getUserPermissionsM, checkPermission, checkPermissionM, getCurrentSession } = require('./permissions')
const { randomBytes } = require('node:crypto')

module.exports = {app, connection}

async function createTables() {
    await query(userTableInfo.createStatement)
    await query(sessionTableInfo.createStatement)
    await query(permissionTableInfo.createStatement)
    await query(imageTableInfo.createStatement)
    await query(restrictionGroupTableInfo.createStatement)
    await query(restrictionTableInfo.createStatement)
    await query(logoImageTableInfo.createStatement)
    await query(restrictionConditionTableInfo.createStatement)
    await query(singletonDataTableInfo.createStatement)
}

async function doPurge(){
  await query("DROP DATABASE cbidbtesting; CREATE DATABASE cbidbtesting; USE cbidbtesting")
  await createTables()
  await createUser('tester', 'testpassword')
  await giveAllPermissions(1)
}

createTables()

//giveAllPermissions(2)

//doPurge()

var lastSunset = null
var lastTime = new Date()

async function getSunsetTime() {
  if(lastSunset == null || (Math.abs(lastTime.getTime() - new Date().getTime()) >= 4 * 60 * 60 * 1000)){
    const axiosRes = await axios.get('https://api.sunrise-sunset.org/json?lat=42.3598986&lng=-71.0730733&formatted=0')
    const time = new Date(axiosRes.data.results.sunset)
    lastSunset = time;//timeInUTC.utcOffset(-5)
    //if(lastSunset.isDST()){
    //  lastSunset = lastSunset.add(1, 'hour')
    //}
    lastTime = new Date()
  }
  return lastSunset
}

const corsOptions = {
  origin : ['http://tv.community-boating.org:3001', 'http://tv.community-boating.org:80']
}

//stupid github

postTable(restrictionGroupTableInfo, '/restrictionGroup', [PERMISSIONS.UPDATE_RESTRICTION])
postTable(restrictionTableInfo, '/restriction', [PERMISSIONS.UPDATE_RESTRICTION])
postTable(logoImageTableInfo, '/logoImage', [PERMISSIONS.UPDATE_IMAGE])
postTable(restrictionConditionTableInfo, '/restrictionCondition', [PERMISSIONS.UPDATE_RESTRICTION])
postTable(singletonDataTableInfo, '/singletonData', [PERMISSIONS.CHANGE_PROGRAM])

deleteTable(restrictionGroupTableInfo, '/restrictionGroup', [PERMISSIONS.DELETE_RESTRICTION])
deleteTable(restrictionTableInfo, '/restriction', [PERMISSIONS.DELETE_RESTRICTION])
deleteTable(logoImageTableInfo, '/logoImage', [PERMISSIONS.DELETE_IMAGE])
deleteTable(restrictionConditionTableInfo, '/restrictionCondition', [PERMISSIONS.DELETE_RESTRICTION])
deleteTable(singletonDataTableInfo, '/singletonData', [PERMISSIONS.CHANGE_PROGRAM])
deleteTable(userTableInfo, '/users', [PERMISSIONS.DELETE_USER])

const flagRegex = /".*"/

const replaceRegex = new RegExp('\"', 'g')

app.get(apiPrefix + '/flag-color', (req, res) => {
  axios.get('https://api.community-boating.org/api/flag').then((axiosRes) => {
    const flagColor = String(axiosRes.data).match(flagRegex)[0].replace(replaceRegex, '')
    res.json({
      flagColor: flagColor
    }).end()
  }).catch((e) => {
    throw e
  })
})

app.get(apiPrefix + '/fotv', async (req, res, next) => {
  const sunset = await getSunsetTime()
  const result = await query('SELECT * FROM ' + restrictionTableInfo.tableName + ';SELECT * FROM ' + restrictionGroupTableInfo.tableName + ';SELECT * FROM ' + logoImageTableInfo.tableName + ';SELECT * FROM ' + imageTableInfo.tableName + ';SELECT * FROM ' + restrictionConditionTableInfo.tableName + ';SELECT * FROM ' + singletonDataTableInfo.tableName + ';', [])
  .catch((e) => handleError(e, req, res))
  res.json({
    sunset: sunset.toString(),
    restrictions: result[0].map((a) => parseRow(a, restrictionTableInfo)),//adaptDBToJson(restrictions, restrictionsID), 
    restrictionGroups: result[1].map((a) => parseRow(a, restrictionGroupTableInfo)),// adaptDBToJson(restrictionGroups, restrictionGroupsID),
    logoImages: result[2].map((a) => parseRow(a, logoImageTableInfo)),
    images: result[3].map((a) => parseRow(a, imageTableInfo)),
    restrictionConditions: result[4].map((a) => parseRow(a, restrictionConditionTableInfo)),
    singletonData: result[5].map((a) => parseRow(a, singletonDataTableInfo))
    //activeProgramID: 0
  }).end()
  //const restrictions = await db.collection(restrictionsCol).list()
  //const restrictionGroups = await db.collection(restrictionGroupsCol).list()
})

//createUser("alexb", "password")

//giveAllPermissions(1)

async function giveAllPermissions(userid){
  await query("INSERT IGNORE INTO " + permissionTableInfo.tableName + " (userID, permissionKey) VALUES " + Object.values(PERMISSIONS).map((a) => "(?,?)").join(","), Object.values(PERMISSIONS).flatMap((a) => [userid, a]))
}

async function createUser(username, password){
  const hash = await hashPass(password)
  await query("INSERT INTO " + userTableInfo.tableName + " (username, passhash) VALUES (?, ?)", [username, hash])
}

if(config.imageDir)
  fs.mkdir(config.imageDir, () => {})

function logoImageDir(image_id, image_suffix){
  return config.imageDir + image_id + '.' + image_suffix
}

const validSuffixes = ['img', 'svg', 'webp', 'jpeg', 'jpg', 'png', 'gif']

app.post(apiPrefix + '/uploadImage/:imageId/:imageSuffix', upload.single('image'), async (req, res, next) => {
  if(!checkPermission(req, res, [PERMISSIONS.UPDATE_IMAGE]))
    return sendUnauthorized(req, res)
  const image = req.file
  if (!image) return handleError({code: 400, message: "No Image"}, req, res)

  const suffix = req.params.imageSuffix

  if(validSuffixes.findIndex((a) => a == suffix) == -1)
    return handleError({code: 400, message: "Invalid Image Type", req, res})

  const image_id_params = parseInt(req.params.imageId)

  const uploadImage = async (image_id, image_new, isNew) => {
    try{
      await fs.renameSync(image.path, logoImageDir(image_id, suffix))
      if(isNew){
        res.json(image_new[0]).end()
      }else {
        const results = await query('UPDATE ' + imageTableInfo.tableName + ' SET version = version + 1, imageSuffix = ? WHERE imageID = ?;SELECT * FROM ' + imageTableInfo.tableName + ' WHERE imageID = ?;', [suffix, image_id, image_id])
        .catch((e) => handleError(e, req, res))
        return res.json(parseResult(results[0], imageTableInfo)).end()
      }
    }catch(e){
      handleError(e, req, res)
    }
  }

  if(isNaN(image_id_params) || image_id_params < 0){
    const results = parseResult(await (updateRowsStatement(imageTableInfo, [{version: 0, imageSuffix: suffix}]).catch(e => handleError(e, req, res))), imageTableInfo)
        return await uploadImage(results[0].imageID, results, true)
  }else{
    return await uploadImage(image_id_params, undefined, false)
  }
})

app.get(apiPrefix + "/users", async (req, res, next) => {
  if(!await checkPermission(req, res, [PERMISSIONS.VIEW_USERS])){
    return sendUnauthorized(req, res)
  }
  const users = await query("SELECT username, userID FROM " + userTableInfo.tableName + "", []).catch(e => handleError(e, req, res))
  res.json(users)
})

app.get(apiPrefix + "/permissions", async (req, res, next) => {
  if(!await checkPermission(req, res, [PERMISSIONS.VIEW_PERMISSIONS])){
    sendUnauthorized(req, res)
    return
  }
  const permissions = await query("SELECT * FROM " + permissionTableInfo.tableName + "", [])
  res.json(permissions)
})

app.get(apiPrefix + '/images/:image_id/:image_version', async (req, res, next) => {
  const imageID = parseInt(req.params.image_id)
  if(isNaN(imageID))
    return res.sendStatus(404)
  const results = await query('SELECT imageSuffix FROM ' + imageTableInfo.tableName + ' WHERE imageID = ?', [imageID]).catch((e) => handleError(e))
  if(results.length == 0){
    return handleError({code: 404, message: "Image Not Found"}, req, res)
  }
  res.sendFile(logoImageDir(imageID, results[0].imageSuffix))
})

app.post(apiPrefix + '/grant_permissions', async (req, res, next) => {
  if(!await checkPermission(req, res, [PERMISSIONS.UPDATE_PERMISSIONS])){
    return sendUnauthorized(req, res)
  }
  const permissions = req.body.permissions
  const userID = req.body.userID
  const results = await query("INSERT IGNORE INTO " + permissionTableInfo.tableName + " (userID, permissionKey) VALUES " + permissions.map((a) => "(?,?)").join(",") + ";SELECT * FROM " + permissionTableInfo.tableName + " WHERE userID = ?;", permissions.flatMap((a) => [userID, a]).concat(userID))
  res.json(results[1])
})

app.post(apiPrefix + '/revoke_permissions', async (req, res, next) => {
  if(!await checkPermission(req, res, [PERMISSIONS.DELETE_PERMISSIONS])){
    res.sendStatus(401)
    return
  }
  const permissions = req.body.permissions
  const userID = req.body.userID
  if(permissions.length == 0){
    res.sendStatus(400)
    return
  }
  const results = await query("DELETE FROM " + permissionTableInfo.tableName + " WHERE userID = ? AND (" + permissions.map((a) => "permissionKey = ?").join(" OR ") + ");SELECT * FROM " + permissionTableInfo.tableName + " WHERE userID = ?;", [userID].concat(permissions.map((a) => a)).concat(userID))
  res.json(results[1])
})

function checkPassword(password){
  return password.length > 6 && password.length < 30
}

async function hashPass(password){
  return await bcrypt.hashSync(password, parseInt(config.saltRounds))
}

app.post(apiPrefix + '/create_user', async (req, res, next) => {
  const username = String(req.body.username)
  const password = String(req.body.password).replace("\g ", "")
  if(!await checkPermission(req, res, [PERMISSIONS.ADD_USER])){
    res.sendStatus(401)
    return
  }
  if(!checkPassword(password)){
    res.json({
      result: "BADPASS"
    })
    return
  }
  if(await doesUsernameExist(username)){
    res.json({result: "USER EXISTS"})
    return
  }
  const hash = await hashPass(password)
  const queryS = "INSERT INTO " + userTableInfo.tableName + " (username, passhash) VALUES (?, ?); SELECT username, userID FROM " + userTableInfo.tableName + " WHERE userID = LAST_INSERT_ID();"
  const results = await query(queryS, [username, hash])
  res.json(results[1][0])
})

async function doesUsernameExist(username){
  return (await query("SELECT userID FROM " + userTableInfo.tableName + " WHERE username = ?", [username])).length > 0
}

app.post(apiPrefix + '/update_user', async (req, res, next) => {
  const username = String(req.body.username)
  const password = String(req.body.password).replace("\g ", "")
  const changedUsername = req.body.changedUsername
  const changedPassword = req.body.changedPassword
  const forceLogout = req.body.forceLogout
  const userID = req.body.userID
  const session = await getCurrentSession(req)
  const permissions = await getUserPermissionsM(session)
  if(forceLogout){
    await query("UPDATE " + sessionTableInfo.tableName + " SET active = FALSE WHERE userID = ?", [userID]).catch((e) => {
      handleError(e, req, res)
    })
  }
  if(!changedPassword && !changedUsername){
    res.json({
      result: "OK"
    })
  }
  if(!checkPermissionM(permissions, [(session && userID == session.userID) ? PERMISSIONS.CHANGE_OWN_PASSWORD : PERMISSIONS.MANAGE_USERS])){
    handleError({code: 401, message: "Unauthorized"})
    return
  }
  if(changedPassword && !checkPassword(password)){
    res.json({
      result: "BADPASS"
    })
    return
  }
  var values = []
  if(changedUsername){
    if(await doesUsernameExist(username)){
      res.json({
        result: "USERNAME TAKEN"
      })
      return
    }
    values.push(username)
  }
  if(changedPassword){
    values.push(await hashPass(password))
  }
  values.push(userID)
  const results = query("UPDATE " + userTableInfo.tableName + " SET " + (changedUsername ? "username = ? " : "") + ((changedUsername && changedPassword) ? "," : "") + (changedPassword ? "passhash = ? " : "") + " WHERE userID = ?;", values)
  .catch(e => handleError(e, req, res))
    if(results.affectedRows == 0){
      return handleError({code: 400, message: "User Not Found"}, req, res)
    }
  res.json({
    result: "OK"
  })
})

app.post(apiPrefix + '/toggleRestriction', async (req, res, next) => {
  if(!await checkPermission(req, res, [PERMISSIONS.TOGGLE_RESTRICTION])){
    sendUnauthorized(req, res)
    return
  }
  const restrictionID = req.body.restrictionID
  const active = req.body.active
  const result = await query("UPDATE " + restrictionTableInfo.tableName + " SET active = ? WHERE restrictionID = ?;SELECT * FROM " + restrictionTableInfo.tableName + " WHERE restrictionID = ?", [active, restrictionID, restrictionID]).catch(e => handleError(e, req, res))
  return res.json(result[1][0])
})

app.post(apiPrefix + '/authenticate-staff', async (req, res, next) => {
  res.header("Access-Control-Allow-Credentials", true)
  const username = String(req.body.username)
  const password = String(req.body.password)
  const resultSQL = await query("SELECT passhash, userID FROM " + userTableInfo.tableName + " WHERE username = ?;", [username])
  .catch(e => handleError(e, req, res))
  if(resultSQL.length > 0){
    try{
      var passwordMatch = false
      if(resultSQL[0].passhash == "NO_PASS")
        passwordMatch = true
      else
        passwordMatch = await bcrypt.compareSync(password, resultSQL[0].passhash)
      if(passwordMatch){
        const decoder = new TextDecoder('UTF-8')
        const bytes = await randomBytes(parseInt(config.authSessionUUIDBytes || "256"))
        const uuid = decoder.decode(bytes)
        const createSessionRes = await query("INSERT INTO " + sessionTableInfo.tableName + " (userID, sessionUUID, active, createdOn) VALUES (?, ?, ?, NOW());", [resultSQL[0].userID, uuid, true])
        .catch(e => handleError(e, req, res))
        const newID = createSessionRes.insertId
        res.cookie("sessionUUID", uuid, {maxAge: parseInt(config.authDurationDays) * 1000 * 60 * 60 * 24, secure: false})
        res.cookie("sessionID", newID, {maxAge: parseInt(config.authDurationDays) * 1000 * 60 * 60 * 24, secure: false})
        res.json(true)
      }else {
        res.json({result: "BAD"})
      }
    }catch(e){
      return handleError(e, req, res)
    }
  }else{
    res.json({result: "BAD"})
  }
})

async function getCurrentUsername(currentSession){
  const currentUsername = await query("SELECT username FROM " + userTableInfo.tableName + " WHERE userID = ?", [currentSession.userID])
    .catch(e => handleError(e, req, res))
  return currentUsername.length == 0 ? undefined : currentUsername[0].username
}

console.log("starting")

app.get(apiPrefix + '/is-logged-in-as-staff', async(req, res, next) => {
  const currentSession = await getCurrentSession(req)
  console.log("what")
  if(currentSession){
    const currentUsername = await getCurrentUsername(currentSession)
    if(currentUsername){
      console.log("found it")
      res.json({
        value: currentUsername
      })
    }else{
      res.json({
        error: {
          code: "access_denied",
          message: "Authentication failure."
        }
      })
      console.log("Invalid user")
    }
  }else{
    res.json({
      error: {
        code: "access_denied",
        message: "Authentication failure."
      }
    })
    console.log("no session found")
  }
})

app.post(apiPrefix + "/logout", async (req, res, next) => {
  await query("UPDATE " + sessionTableInfo.tableName + " SET active = FALSE WHERE sessionUUID = ?", [req.cookies.sessionUUID])
  .catch(e => handleError(e, req, res))
  res.json({result: "OK"})
})

app.get(apiPrefix + '/staff/user-permissions', async (req, res, next) => {
  const a = await getUserPermissions(req)
  res.json(a)
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})

app.get(apiPrefix + '/testerror', async (req, res, next) => {
    const b = await query("SELECT * FROM USERS WHERE usertype = ?;", []).catch((e) => {
      //console.log(e.sql)
      
      //res.sendStatus(500)
    })
})

app.use((err, req, res, next) => {
  console.log("RUNNING")
  const status = err.status || 500
  const message = err.message || 'Internal Server Error'
  res.status(status).json({
    success: false,
    status: status,
    message: message
  })
})

const redirectedAPIs = ['ap-class-instances',
'jp-class-sections']

for(const a of redirectedAPIs){
  console.log(apiPrefix + '/' + a + '/')
  app.get(apiPrefix + '/' + a + '/', (req, res) => {
    res.redirect('https://api.community-boating.org/api/' + a)
  })
}

//app.use('/api/ap-class-instances/', proxy("https://api.community-boating.org"))

//app.use('/api/jp-class-sections', proxy("https://api.community-boating.org/api/jp-class-sections"))

app.use('/', proxy(config.proxyURL))