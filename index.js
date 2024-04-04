const axios = require('axios');
const fs = require('fs');
const bcrypt = require('bcrypt');
const { userTableInfo, imageTableInfo, restrictionGroupTableInfo, restrictionTableInfo, logoImageTableInfo, restrictionConditionTableInfo, singletonDataTableInfo, sessionTableInfo, permissionTableInfo } = require('./tableInfo');
const { parseResult, updateRowsStatement, parseRow, postTable, deleteTable  } = require('./sqlFunc');
const { connection, app, upload, config, port, query, apiPrefix } = require('./connection');
var proxy = require('express-http-proxy');
const { PERMISSIONS, getUserPermissions, checkPermission, getCurrentSession } = require('./permissions');
const { randomBytes } = require('node:crypto');

module.exports = {app, connection}

function createTables() {
    connection.query(userTableInfo.createStatement);
    connection.query(sessionTableInfo.createStatement);
    connection.query(permissionTableInfo.createStatement);
    connection.query(imageTableInfo.createStatement);
    connection.query(restrictionGroupTableInfo.createStatement);
    connection.query(restrictionTableInfo.createStatement);
    connection.query(logoImageTableInfo.createStatement);
    connection.query(restrictionConditionTableInfo.createStatement);
    connection.query(singletonDataTableInfo.createStatement);
}
//connection.query("DROP TABLE PERMISSIONS")
createTables();

var lastSunset = null;
var lastTime = new Date();

async function getSunsetTime() {
  if(lastSunset == null || Math.abs((lastTime.getTime() - new Date().getTime()) >= 4 * 60 * 60)){
    const axiosRes = await axios.get('https://api.sunrise-sunset.org/json?lat=42.3598986&lng=-71.0730733&formatted=0');
    const time = new Date(axiosRes.data.results.sunset);
    lastSunset = time;//timeInUTC.utcOffset(-5);
    //if(lastSunset.isDST()){
    //  lastSunset = lastSunset.add(1, 'hour');
    //}
    lastTime = new Date();
  }
  return lastSunset;
}

postTable(restrictionGroupTableInfo, '/restrictionGroup', [PERMISSIONS.UPDATE_RESTRICTION]);
postTable(restrictionTableInfo, '/restriction', [PERMISSIONS.UPDATE_RESTRICTION]);
postTable(logoImageTableInfo, '/logoImage', [PERMISSIONS.UPDATE_IMAGE]);
postTable(restrictionConditionTableInfo, '/restrictionCondition', [PERMISSIONS.UPDATE_RESTRICTION]);
postTable(singletonDataTableInfo, '/singletonData', [PERMISSIONS.CHANGE_PROGRAM]);

deleteTable(restrictionGroupTableInfo, '/restrictionGroup', [PERMISSIONS.DELETE_RESTRICTION]);
deleteTable(restrictionTableInfo, '/restriction', [PERMISSIONS.DELETE_RESTRICTION]);
deleteTable(logoImageTableInfo, '/logoImage', [PERMISSIONS.DELETE_IMAGE]);
deleteTable(restrictionConditionTableInfo, '/restrictionCondition', [PERMISSIONS.DELETE_RESTRICTION]);
deleteTable(singletonDataTableInfo, '/singletonData', [PERMISSIONS.CHANGE_PROGRAM]);
deleteTable(userTableInfo, '/users', [PERMISSIONS.DELETE_USER]);

const flagRegex = /".*"/

const replaceRegex = new RegExp('\"', 'g');

app.get(apiPrefix + '/flag-color', (req, res) => {
  axios.get('https://api.community-boating.org/api/flag').then((axiosRes) => {
    const flagColor = String(axiosRes.data).match(flagRegex)[0].replace(replaceRegex, '');
    res.json({
      flagColor: flagColor
    }).end();
  }).catch((e) => {
    throw e;
  })
});

app.get(apiPrefix + '/fotv', async (req, res, next) => {
  const sunset = await getSunsetTime();
  connection.query('SELECT * FROM ' + restrictionTableInfo.tableName + ';SELECT * FROM ' + restrictionGroupTableInfo.tableName + ';SELECT * FROM ' + logoImageTableInfo.tableName + ';SELECT * FROM ' + imageTableInfo.tableName + ';SELECT * FROM ' + restrictionConditionTableInfo.tableName + ';SELECT * FROM ' + singletonDataTableInfo.tableName + ';', [], (err, result) => {
    if(err)
      next(err);
    res.json({
      sunset: sunset.toString(),
      restrictions: result[0].map((a) => parseRow(a, restrictionTableInfo)),//adaptDBToJson(restrictions, restrictionsID), 
      restrictionGroups: result[1].map((a) => parseRow(a, restrictionGroupTableInfo)),// adaptDBToJson(restrictionGroups, restrictionGroupsID),
      logoImages: result[2].map((a) => parseRow(a, logoImageTableInfo)),
      images: result[3].map((a) => parseRow(a, imageTableInfo)),
      restrictionConditions: result[4].map((a) => parseRow(a, restrictionConditionTableInfo)),
      singletonData: result[5].map((a) => parseRow(a, singletonDataTableInfo))
      //activeProgramID: 0
    }).end();
  });
  //const restrictions = await db.collection(restrictionsCol).list();
  //const restrictionGroups = await db.collection(restrictionGroupsCol).list();
});

const ap_image_dir = "/root/ap_image"
const jp_image_dir = "/root/jp_image"

function postImage(path, dir){
  app.post(apiPrefix + path, upload.single('image'), (req, res, next) => {
    const image = req.file;
  
    if (!image) return res.sendStatus(400);
  
    fs.rename(image.path, dir, (err) => {
      if(err)
        next(err);
      else
        res.sendStatus(200);
    });
  });
}

//createUser("alexb", "password")

//giveAllPermissions(8)

async function giveAllPermissions(userid){
  query("INSERT IGNORE INTO " + permissionTableInfo.tableName + " (userID, permissionKey) VALUES " + Object.values(PERMISSIONS).map((a) => "(?,?)").join(","), Object.values(PERMISSIONS).flatMap((a) => [userid, a]))
}

async function createUser(username, password){
  const hash = await hashPass(password)
  query("INSERT INTO " + userTableInfo.tableName + " (username, passhash) VALUES (?, ?)", [username, hash])
}

fs.mkdir('/root/logoImages', () => {})

function logoImageDir(image_id, image_suffix){
  return config.imageDir + image_id + '.' + image_suffix;
}

const validSuffixes = ['img', 'svg', 'webp', 'jpeg', 'jpg', 'png', 'gif'];

app.post(apiPrefix + '/uploadImage/:imageId/:imageSuffix', upload.single('image'), (req, res, next) => {
  const image = req.file;
  if (!image) return res.sendStatus(400);

  const suffix = req.params.imageSuffix;

  if(validSuffixes.findIndex((a) => a == suffix) == -1)
    return res.sendStatus(400);

  const image_id_params = parseInt(req.params.imageId);

  const uploadImage = (image_id, image_new, isNew) => {
    fs.rename(image.path, logoImageDir(image_id, suffix), (err) => {
      if(err){
        next(err);
      }else{
        if(isNew){
          res.json(image_new[0]).end();
        }else {
          connection.query('UPDATE ' + imageTableInfo.tableName + ' SET version = version + 1, imageSuffix = ? WHERE imageID = ?;SELECT * FROM ' + imageTableInfo.tableName + ' WHERE imageID = ?;', [suffix, image_id, image_id], (err2, results) => {
            if(err2)
              next(err2)
            else
              res.json(parseResult(results, imageTableInfo)[0]).end();
          })
        }
      }
    });
  }

  if(isNaN(image_id_params) || image_id_params < 0){
    updateRowsStatement(imageTableInfo, [{version: 0, imageSuffix: suffix}], (err, results) => {
      if(err){
        next(err)
      }
      else{
        const res = parseResult(results, imageTableInfo);
        uploadImage(res[0].imageID, res, true);
      }
    });
  }else{
    uploadImage(image_id_params, undefined, false);
  }
});

app.get(apiPrefix + "/users", async (req, res, next) => {
  if(!await checkPermission(req, res, [PERMISSIONS.VIEW_USERS])){
    res.sendStatus(401)
    return
  }
  const users = await query("SELECT username, userID FROM " + userTableInfo.tableName + "", [])
  res.json(users)
})

app.get(apiPrefix + "/permissions", async (req, res, next) => {
  if(!await checkPermission(req, res, [PERMISSIONS.VIEW_PERMISSIONS])){
    res.sendStatus(401)
    return
  }
  const permissions = await query("SELECT * FROM " + permissionTableInfo.tableName + "", [])
  res.json(permissions)
})

app.get(apiPrefix + '/images/:image_id/:image_version', (req, res, next) => {
  const imageID = parseInt(req.params.image_id);
  if(isNaN(imageID))
    return res.sendStatus(404);
  connection.query('SELECT imageSuffix FROM ' + imageTableInfo.tableName + ' WHERE imageID = ?', [imageID], (err, results) => {
    if(err){
      next(err)
    }else{
      if(results.length == 0){
        res.sendStatus(404);
        return;
      }
      res.sendFile(logoImageDir(imageID, results[0].imageSuffix));
    }
  })
})

app.post(apiPrefix + '/grant_permissions', async (req, res, next) => {
  if(!await checkPermission(req, res, [PERMISSIONS.UPDATE_PERMISSIONS])){
    res.sendStatus(401)
    return
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
  return password.length > 6 && password.length < 30;
}

async function hashPass(password){
  return await bcrypt.hashSync(password, parseInt(config.saltRounds))
}

app.post(apiPrefix + '/create_user', async (req, res, next) => {
  const username = String(req.body.username);
  const password = String(req.body.password).replace("\g ", "");
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
    const query = "INSERT INTO " + userTableInfo.tableName + " (username, passhash) VALUES (?, ?); SELECT username, userID FROM " + userTableInfo.tableName + " WHERE userID = LAST_INSERT_ID();";
    connection.query(query, [username, hash], (err, results) => {
    if(err){
      next(err)
    }else{
      res.json(results[1][0]);
    }
  })
})

async function doesUsernameExist(username){
  return (await query("SELECT userID FROM " + userTableInfo.tableName + " WHERE username = ?", [username])).length > 0
}

app.post(apiPrefix + '/update_user', async (req, res, next) => {
  const username = String(req.body.username);
  const password = String(req.body.password).replace("\g ", "");
  const changedUsername = req.body.changedUsername;
  const changedPassword = req.body.changedPassword;
  const forceLogout = req.body.forceLogout;
  const userID = req.body.userID;
  if(forceLogout){
    await query("UPDATE " + sessionTableInfo.tableName + " SET active = FALSE WHERE userID = ?", [userID])
  }
  if(!changedPassword && !changedUsername){
    res.json({
      result: "OK"
    })
  }
  if(!await checkPermission(req, res, [])){
    res.sendStatus(401)
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
  connection.query("UPDATE " + userTableInfo.tableName + " SET " + (changedUsername ? "username = ? " : "") + ((changedUsername && changedPassword) ? "," : "") + (changedPassword ? "passhash = ? " : "") + " WHERE userID = ?;", values, (err, results) => {
    if(err){
      next(err)
      return
    }
    if(results.affectedRows == 0){
      res.json({
        result: "FAIL"
      })
      return
    }
    res.json({
      result: "OK"
    })
  })
})

app.post('/toggleRestriction', async (req, res, next) => {
  if(!await checkPermission(req, res, [PERMISSIONS.TOGGLE_RESTRICTION])){
    res.sendStatus(401)
    return
  }
  const restrictionID = req.body.restrictionID
  const active = req.body.active
  res.json((await query("UPDATE " + restrictionTableInfo.tableName + " SET active = ? WHERE restrictionID = ?;SELECT * FROM " + restrictionTableInfo.tableName + " WHERE restrictionID = ?", [active, restrictionID, restrictionID]))[1][0])
})

app.post(apiPrefix + '/authenticate-staff', async (req, res, next) => {
  const username = String(req.body.username)
  const password = String(req.body.password)
  connection.query("SELECT passhash, userID FROM " + userTableInfo.tableName + " WHERE username = ?;", [username], async (err, results) => {
    if(err){
      next(err)
      return
    }else{
      if(results.length > 0){
        bcrypt.compare(password, results[0].passhash).then(async result => {
          if(result){
            const decoder = new TextDecoder("UTF-16")
            const uuid = decoder.decode(await randomBytes(256));
            connection.query("INSERT INTO " + sessionTableInfo.tableName + " (userID, sessionUUID, active) VALUES (?, ?, ?);", [results[0].userID, uuid, true], (err2, results2) => {
              if(err2){
                next(err2)
                return
              }else{
                res.header("Access-Control-Allow-Credentials", true)
                res.cookie("sessionUUID", uuid)
                res.json(true)
              }
            })
          }else {
            res.json({result: "BAD"})
          }
        })
      }else{
        res.json({result: "BAD"})
      }
    }
  })
})

app.get(apiPrefix + '/is-logged-in-as-staff', async(req, res, next) => {
  const currentSession = await getCurrentSession(req);
  if(currentSession.length > 0){
    const currentUsername = await query("SELECT username FROM " + userTableInfo.tableName + " WHERE userID = ?", [currentSession[0].userID])
    if(currentUsername.length > 0){
      res.json({
        value: currentUsername[0].username
      })
    }else{
      res.json({
        error: {
          code: "access_denied",
          message: "Authentication failure."
        }
      })
    }
  }else{
    res.json({
      error: {
        code: "access_denied",
        message: "Authentication failure."
      }
    })
  }
})

app.post(apiPrefix + "/logout", async (req, res, next) => {
  await query("UPDATE " + sessionTableInfo.tableName + " SET active = FALSE WHERE sessionUUID = ?", [req.cookies.sessionUUID])
  res.json({result: "OK"})
})

app.get(apiPrefix + '/staff/user-permissions', async (req, res, next) => {
  const a = await getUserPermissions(req)
  res.json(a);
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})

app.use('/', proxy(config.proxyURL))