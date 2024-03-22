import express from 'express';
import mysql2 from 'mysql2';
import cors from 'cors';
import axios from 'axios';
import multer from 'multer';
import fs from 'fs';

const upload = multer({ dest: '/home/alexb/tmp/uploads/' });

const app = express()
const port = 6969

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

var allowedOrigins = ['http://localhost:8081',
                      'http://yourapp.com'];
app.use(cors({
  origin: function(origin, callback){
    return callback(null, true);
  }
}));

const connection = mysql2.createConnection({
  multipleStatements: true,
  host: 'localhost',
  user: 'root',
  password: 'tokugawa',
  database: 'cbidbtesting'
})

connection.connect();

const COLUMN_TYPES = {
  NUMBER_NULL: {
    SToV: (v) => (v == null ? null : Number(v))
  },
  NUMBER: {
    SToV: (v) => Number(v)
  },
  STRING: (l) => ({
    SToV: (v) => {
      return String(v);
    }
  }),
  STRING_NULL: (l) => ({
    SToV: (v) => {
      return v == null ? null : String(v);
    }
  }),
  BOOLEAN: {
    SToV: (v) => Boolean(v)
  }
}

const restrictionGroupTableInfo = {
  tableName: 'RESTRICTION_GROUPS',
  createStatement: 'CREATE TABLE IF NOT EXISTS RESTRICTION_GROUPS(groupID int NOT NULL AUTO_INCREMENT, title varchar(255), displayOrder int, PRIMARY KEY (groupID))',
  pk: 'groupID',
  columns: [
    {key: 'groupID', type: COLUMN_TYPES.NUMBER},
    {key: 'title', type: COLUMN_TYPES.STRING(255)},
    {key: 'displayOrder', type: COLUMN_TYPES.NUMBER}
  ]
}

const restrictionTableInfo = {
  tableName: 'RESTRICTIONS',
  createStatement: 'CREATE TABLE IF NOT EXISTS RESTRICTIONS(restrictionID int NOT NULL AUTO_INCREMENT, imageID int, title varchar(255), message varchar(500), groupID int NOT NULL, active BOOLEAN, textColor varchar(10), backgroundColor varchar(10), fontWeight varchar(30), displayOrder int, isPriority BOOLEAN, PRIMARY KEY (restrictionID), FOREIGN KEY(groupID) REFERENCES RESTRICTION_GROUPS(groupID) ON DELETE CASCADE, FOREIGN KEY(imageID) REFERENCES IMAGES(imageID) ON DELETE CASCADE)',
  pk: 'restrictionID',
  columns: [
    {key: 'restrictionID', type: COLUMN_TYPES.NUMBER},
    {key: 'imageID', type: COLUMN_TYPES.NUMBER_NULL},
    {key: 'title', type: COLUMN_TYPES.STRING(255)},
    {key: 'message', type: COLUMN_TYPES.STRING(500)},
    {key: 'groupID', type: COLUMN_TYPES.NUMBER},
    {key: 'active', type: COLUMN_TYPES.BOOLEAN},
    {key: 'textColor', type: COLUMN_TYPES.STRING(10)},
    {key: 'backgroundColor', type: COLUMN_TYPES.STRING(10)},
    {key: 'fontWeight', type: COLUMN_TYPES.STRING(30)},
    {key: 'displayOrder', type: COLUMN_TYPES.NUMBER},
    {key: 'isPriority', type: COLUMN_TYPES.BOOLEAN}
  ]
}

const logoImageTableInfo = {
  tableName: 'LOGO_IMAGES',
  createStatement: 'CREATE TABLE IF NOT EXISTS LOGO_IMAGES(logoImageID int NOT NULL AUTO_INCREMENT, imageID int, title varchar(255), displayOrder int, imageType int, imageVersion int, PRIMARY KEY (logoImageID), FOREIGN KEY(imageID) REFERENCES IMAGES(imageID) ON DELETE CASCADE)',
  pk: 'logoImageID',
  columns: [
    {key: 'logoImageID', type: COLUMN_TYPES.NUMBER},
    {key: 'imageID', type: COLUMN_TYPES.NUMBER},
    {key: 'title', type: COLUMN_TYPES.STRING(255)},
    {key: 'displayOrder', type: COLUMN_TYPES.NUMBER},
    {key: 'imageType', type: COLUMN_TYPES.NUMBER},
  ]
}

const imageTableInfo = {
  tableName: 'IMAGES',
  createStatement: 'CREATE TABLE IF NOT EXISTS IMAGES(imageID int NOT NULL AUTO_INCREMENT, imageSuffix varchar(20), version int, PRIMARY KEY (imageID))',
  pk: 'imageID',
  columns: [
    {key: 'imageID', type: COLUMN_TYPES.NUMBER},
    {key: 'imageSuffix', type: COLUMN_TYPES.STRING(20)},
    {key: 'version', type: COLUMN_TYPES.NUMBER}
  ]
}

//Action: Enable, Disable, Toggle
//Type: Time, State
//Info
//

const restrictionConditionTableInfo = {
  tableName: 'RESTRICTION_CONDITIONS',
  createStatement: 'CREATE TABLE IF NOT EXISTS RESTRICTION_CONDITIONS(conditionID int NOT NULL AUTO_INCREMENT, restrictionID int, conditionAction int, conditionType int, conditionInfo varchar(2000), PRIMARY KEY(conditionID), FOREIGN KEY(restrictionID) REFERENCES RESTRICTIONS(restrictionID) ON DELETE CASCADE)',
  pk: 'conditionID',
  columns: [
    {key: 'conditionID', type: COLUMN_TYPES.NUMBER},
    {key: 'restrictionID', type: COLUMN_TYPES.NUMBER},
    {key: 'conditionAction', type: COLUMN_TYPES.NUMBER_NULL},
    {key: 'conditionType', type: COLUMN_TYPES.NUMBER_NULL},
    {key: 'conditionInfo', type: COLUMN_TYPES.STRING_NULL(2000)}
  ]
}

const singletonDataTableInfo = {
  tableName: 'SINGLETON_DATA',
  createStatement: 'CREATE TABLE IF NOT EXISTS SINGLETON_DATA(data_key VARCHAR(40) NOT NULL, data_value VARCHAR(100), PRIMARY_KEY(data_key))',
  pk: 'data_key',
  columns: [
    {key: "data_key", type: COLUMN_TYPES.STRING(40)},
    {key: "data_value", type: COLUMN_TYPES.STRING_NULL(100)}
  ]
}

function createTables(){
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

function getSingleRow(table, columns, pk, id, cb){
  connection.query("SELECT * FROM " + table + " WHERE " + pk + " = ?", [id], cb);
}

function updateRowsStatement(tableInfo,body,cb){
  var values = [];
  const query= body.map(bn => {
    const activeColumns = tableInfo.columns.filter((a) => bn[a.key] !== undefined && a.key != tableInfo.pk).map((a) => a.key);
    values = values.concat(activeColumns.map((a) => bn[a]));
    if(bn[tableInfo.pk] == undefined){
      const query = "INSERT INTO " + tableInfo.tableName + " (" + activeColumns.reduce((a, b, i) => (a + " " + b + (i+1 < activeColumns.length ? ',' : '')), '') +
      ') VALUES (' + activeColumns.reduce((a, b, i) => (a + " ?" + (i+1 < activeColumns.length ? ',' : '')), '') + ');SELECT * FROM ' + tableInfo.tableName + ' WHERE ' + tableInfo.pk + ' = LAST_INSERT_ID();';
      return query;
    }else{
      values = values.concat([bn[tableInfo.pk], bn[tableInfo.pk]]);
      return "UPDATE " + tableInfo.tableName + " SET " + activeColumns.reduce((a, b, i) => (a + " " + b + " = ?" + (i+1 < activeColumns.length ? ',' : '')), '') + ' WHERE ' + tableInfo.pk + ' = ?;SELECT * FROM ' + tableInfo.tableName + ' WHERE ' + tableInfo.pk + ' = ?;';
    }
  }).reduce((a, b) => a + b, '');
  connection.query(query, values, cb);
}

function parseResult(result, tableInfo) {
  return result.filter((a, i) => i % 2 == 1).map((a) => parseRow(a[0], tableInfo))
}

function postTable(tableInfo, path){
  app.post(path, (req, res, next) => {
    const body = req.body;
    const cb = (err, result) => {
      if(err)
        next(err);
      else
        res.json(parseResult(result, tableInfo)).end();
    }
    updateRowsStatement(tableInfo, body, cb);
  })
}

function deleteTable(tableInfo, path){
  app.delete(path, (req, res, next) => {
    const body = Array.isArray(req.body) ? req.body : [req.body];
    var query = '';
    var values = [];
    body.forEach((a) => {
      query = query + 'DELETE FROM ' + tableInfo.tableName + ' WHERE ' + tableInfo.pk + ' = ?;'
      values.push(a[tableInfo.pk]);
    })
    console.log(body);
    console.log(query);
    console.log(values);
    connection.query(query, values, (err, result) => {
      if(err)
        next(err);
      else
        res.json({result: 'ok'}).end();
    })
  })
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

function parseRow(row, tableInfo){
  const parsedRow = {};
  if(row == undefined)
    return parsedRow;
  tableInfo.columns.forEach((a) => {
    parsedRow[a.key] = a.type.SToV(row[a.key]);
  })
  return parsedRow;
}

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
      singletonData: results[5].map((a) => parseRow(a, singletonDataTableInfo))
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
        console.log(res[0]);
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

app.get('/ap_image', (req, res) => {
  res.sendFile(ap_image_dir);
});

app.get('/jp_image', (req, res) => {
  res.sendFile(jp_image_dir);
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})