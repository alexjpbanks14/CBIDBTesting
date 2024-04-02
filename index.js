const axios = require('axios');
const fs = require('fs');
const bcrypt = require('bcrypt');
const { userTableInfo, imageTableInfo, restrictionGroupTableInfo, restrictionTableInfo, logoImageTableInfo, restrictionConditionTableInfo, singletonDataTableInfo } = require('./tableInfo');
const { parseResult, updateRowsStatement, parseRow, postTable, deleteTable  } = require('./sqlFunc');
const { connection, app, upload, config, port } = require('./connection');
const { v4: uuidv4 } = require('uuid');
const { kMaxLength } = require('buffer');

module.exports = {app, connection}

function createTables(){
    connection.query(userTableInfo.createStatement);
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
  const username = new String(req.body.username);
  const password = new String(req.body.password);
  if(!checkPermission(req, res)){
    res.sendStatus(401)
    return
  }
  console.log(password);
  bcrypt.hash(password, parseInt(config.saltRounds)).then(hash => {
      connection.query("INSERT INTO " + userTableInfo.tableName + " (username, passhash) VALUES (?, ?); SELECT (username, passhash) FROM " + userTableInfo.tableName + " WHERE userID = LAST_INSERT_ID();", [username, hash], (err, results) => {
      if(err){
        next(err)
      }else{
        res.json(results[0]);
      }
    })
  })
})

console.log(config.saltRounds);

app.post('/change_password', (req, res, next) => {
  const username = new String(req.body.username);
  const password = new String(req.body.password).replace("\g ", "");
  if(!checkPermission(req, res)){
    res.sendStatus(401)
    return
  }
  if(!checkPassword(password)){
    res.sendStatus(400)
    return
  }
  bcrypt.hash(password, parseInt(config.saltRounds)).then(hash => {
    connection.query("UPDATE " + userTableInfo.tableName + " SET passhash = ? WHERE username = ?", [], (err, results))
    res.json({
      hash: hash 
    })
  })
})

app.post('/login', (req, res, next) => {
  const username = new String(req.username);
  const password = new String(req.password);
  connection.query("SELECT passhash FROM " + userTableInfo.tableName + " WHERE username = ?;", [], (err, results) => {
    if(err){
      next(err)
      return
    }else{
      
    }
  })
  res.json({
    uuid: uuidv4().length
  })
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})