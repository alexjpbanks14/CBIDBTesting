const axios = require('axios');
const fs = require('fs');
const bcrypt = require('bcrypt');
const { userTableInfo, imageTableInfo, restrictionGroupTableInfo, restrictionTableInfo, logoImageTableInfo, restrictionConditionTableInfo, singletonDataTableInfo, sessionTableInfo } = require('./tableInfo');
const { parseResult, updateRowsStatement, parseRow, postTable, deleteTable  } = require('./sqlFunc');
const { connection, app, upload, config, port, query } = require('./connection');
const { v4: uuidv4 } = require('uuid');
const { kMaxLength } = require('buffer');

module.exports = {app, connection}

function createTables(){
    connection.query(userTableInfo.createStatement);
    connection.query(sessionTableInfo.createStatement);
    connection.query(imageTableInfo.createStatement);
    connection.query(restrictionGroupTableInfo.createStatement);
    connection.query(restrictionTableInfo.createStatement);
    connection.query(logoImageTableInfo.createStatement);
    connection.query(restrictionConditionTableInfo.createStatement);
    connection.query(singletonDataTableInfo.createStatement);
}

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

postTable(restrictionGroupTableInfo, '/restrictionGroup');
postTable(restrictionTableInfo, '/restriction');
postTable(logoImageTableInfo, '/logoImage');
postTable(restrictionConditionTableInfo, '/restrictionCondition');
postTable(singletonDataTableInfo, '/singletonData');

deleteTable(restrictionGroupTableInfo, '/restrictionGroup');
deleteTable(restrictionTableInfo, '/restriction');
deleteTable(logoImageTableInfo, '/logoImage');
deleteTable(restrictionConditionTableInfo, '/restrictionCondition');
deleteTable(singletonDataTableInfo, '/singletonData');

const flagRegex = /".*"/

const replaceRegex = new RegExp('\"', 'g');

app.get('/flag-color', (req, res) => {
  axios.get('https://api.community-boating.org/api/flag').then((axiosRes) => {
    const flagColor = String(axiosRes.data).match(flagRegex)[0].replace(replaceRegex, '');
    res.json({
      flagColor: flagColor
    }).end();
  }).catch((e) => {
    throw e;
  })
});

function mergeRowsOTM(rowO, rowM, pkO, pkM, refName){
  var byPK = [];
  rowM.forEach((a) => {
    byPK[a[pkM]] = a;
  });
  return rowO.map((a) => {
    const b = {...a};
    delete b[pkO];
    b[refName] = byPK[a[pkO]];
    return b;
  })
}

async function isLoggedIn(request){
  const sessionUUID = String(request.cookies.sessionUUID)
  await query("SELECT active FROM " + sessionTableInfo.tableName + " WHERE sessionUUID = ?",[sessionUUID]).then((a) => {
    if(a.length > 0){
      return a[0].active
    }else{
      return false
    }
  })
}

app.get('/fotv', async (req, res, next) => {
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
  //console.log(restrictions.results[0].props);
});

const ap_image_dir = "/root/ap_image"
const jp_image_dir = "/root/jp_image"

function postImage(path, dir){
  app.post(path, upload.single('image'), (req, res, next) => {
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

postImage('/ap_image', ap_image_dir);
postImage('/jp_image', jp_image_dir);

fs.mkdir('/root/logoImages', () => {})

function logoImageDir(image_id, image_suffix){
  return '/home/alexb/server/CBIDBTesting/logoImages/image' + image_id + '.' + image_suffix;
}

const validSuffixes = ['img', 'svg', 'webp', 'jpeg', 'jpg', 'png', 'gif'];

app.post('/uploadImage/:imageId/:imageSuffix', upload.single('image'), (req, res, next) => {
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
            console.log(results);
            console.log(parseResult(results, imageTableInfo));
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

console.log("index.js");

app.get('/images/:image_id/:image_version', (req, res, next) => {
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

function checkPermission(req, res) {
  return true
}

app.get('/ap_image', (req, res) => {
  res.sendFile(ap_image_dir);
})

app.get('/jp_image', (req, res) => {
  res.sendFile(jp_image_dir);
})

function checkPassword(password){
  return password.length > 6 && password.length < 30;
}

app.post('/create_user', (req, res, next) => {
  const username = String(req.body.username);
  const password = String(req.body.password).replace("\g ", "");
  if(!checkPermission(req, res)){
    res.sendStatus(401)
    return
  }
  connection.query("SELECT userID FROM " + userTableInfo.tableName + " WHERE username = ?;", [username], (err, results) => {
    if(results.length > 0){
      res.json({result: "USER EXISTS"})
      return
    }
    bcrypt.hash(password, parseInt(config.saltRounds)).then(hash => {
        const query = "INSERT INTO " + userTableInfo.tableName + " (username, passhash) VALUES (?, ?); SELECT username, userID FROM " + userTableInfo.tableName + " WHERE userID = LAST_INSERT_ID();";
        connection.query(query, [username, hash], (err, results) => {
        if(err){
          next(err)
        }else{
          res.json(results[1]);
        }
      })
    })
  })
})

console.log(config.saltRounds);

app.post('/change_password', (req, res, next) => {
  isLoggedIn(req)
  const username = String(req.body.username);
  const password = String(req.body.password).replace("\g ", "");
  if(!checkPermission(req, res)){
    res.sendStatus(401)
    return
  }
  if(!checkPassword(password)){
    res.json({
      result: "BADPASS"
    })
    return
  }
  bcrypt.hash(password, parseInt(config.saltRounds)).then(hash => {
    const query = "UPDATE " + userTableInfo.tableName + " SET passhash = ? WHERE username = ?;";
    connection.query(query, [hash, username], (err, results) => {
      console.log(results)
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
})

app.post('/api/authenticate-staff', (req, res, next) => {
  const username = String(req.body.username);
  const password = String(req.body.password);
  connection.query("SELECT passhash, userID FROM " + userTableInfo.tableName + " WHERE username = ?;", [username], (err, results) => {
    if(err){
      next(err)
      return
    }else{
      if(results.length > 0){
        bcrypt.compare(password, results[0].passhash).then(result => {
          if(result){
            const uuid = uuidv4();
            console.log(results[0].userID);
            connection.query("INSERT INTO " + sessionTableInfo.tableName + " (userID, sessionUUID, active) VALUES (?, ?, ?);", [results[0].userID, uuid, true], (err2, results2) => {
              if(err2){
                next(err2)
                return
              }else{
                res.cookie("sessionUUID", uuid)
                res.json({
                  success: true
                })
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

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})