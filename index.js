import express from 'express';
import mysql2 from 'mysql2';
import cors from 'cors';
import axios from 'axios';
import multer from 'multer';
import fs from 'fs';

const upload = multer({ dest: '/tmp/uploads/' });

const app = express()
const port = 3000

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
  NUMBER: {
    SToV: (v) => Number(v)
  },
  STRING: (l) => ({
    SToV: (v) => {
      return String(v);
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
  createStatement: 'CREATE TABLE IF NOT EXISTS RESTRICTIONS(restrictionID int NOT NULL AUTO_INCREMENT, imageID int, title varchar(255), message varchar(500), groupID int NOT NULL, active BOOLEAN, textColor varchar(10), backgroundColor varchar(10), fontWeight varchar(30), displayOrder int, PRIMARY KEY (restrictionID), FOREIGN KEY(groupID) REFERENCES RESTRICTION_GROUPS(groupID) ON DELETE CASCADE, FOREIGN KEY(imageID) REFERENCES IMAGES(imageID) ON DELETE CASCADE)',
  pk: 'restrictionID',
  columns: [
    {key: 'restrictionID', type: COLUMN_TYPES.NUMBER},
    {key: 'imageID', type: COLUMN_TYPES.NUMBER},
    {key: 'title', type: COLUMN_TYPES.STRING(255)},
    {key: 'message', type: COLUMN_TYPES.STRING(500)},
    {key: 'groupID', type: COLUMN_TYPES.NUMBER},
    {key: 'active', type: COLUMN_TYPES.BOOLEAN},
    {key: 'textColor', type: COLUMN_TYPES.STRING(10)},
    {key: 'backgroundColor', type: COLUMN_TYPES.STRING(10)},
    {key: 'fontWeight', type: COLUMN_TYPES.STRING(30)},
    {key: 'displayOrder', type: COLUMN_TYPES.NUMBER}
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
  createStatement: 'CREATE TABLE IF NOT EXISTS IMAGES(imageID int NOT NULL AUTO_INCREMENT, version int, PRIMARY KEY (imageID))',
  pk: 'imageID',
  columns: [
    {key: 'imageID', type: COLUMN_TYPES.NUMBER},
    {key: 'version', type: COLUMN_TYPES.NUMBER}
  ]
}

//Action: Enable, Disable, Toggle
//Type: Time, State
//Info
//

const restrictionConditionTableInfo = {
  tableName: 'RESTRICTION_CONDITIONS',
  createStatement: 'CREATE TABLE IF NOT EXISTS RESTRICTION_CONDITIONS(conditionID int NOT NULL AUTO_INCREMENT, restrictionID int, conditionAction int, conditionType int, conditionInfo varchar(2000), PRIMARY KEY(conditionID), FOREIGN KEY(restrictionID) REFERENCES RESTRICTIONS(restrictionID))',
  pk: 'conditionID',
  columns: [
    {key: 'conditionID', type: COLUMN_TYPES.NUMBER},
    {key: 'restrictionID', type: COLUMN_TYPES.NUMBER},
    {key: 'conditionAction', type: COLUMN_TYPES.NUMBER},
    {key: 'conditionType', type: COLUMN_TYPES.NUMBER},
    {key: 'conditionInfo', type: COLUMN_TYPES.STRING(2000)}
  ]
}

function createTables(){
    connection.query(imageTableInfo.createStatement);
    connection.query(restrictionGroupTableInfo.createStatement);
    connection.query(restrictionTableInfo.createStatement);
    connection.query(logoImageTableInfo.createStatement);
    connection.query(restrictionConditionTableInfo.createStatement);
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
    const body = req.body;
    connection.query('DELETE FROM ' + tableInfo.tableName + ' WHERE ' + tableInfo.pk + ' = ?;', [body[tableInfo.pk]], (err, result) => {
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

deleteTable(restrictionGroupTableInfo, '/restrictionGroup');
deleteTable(restrictionTableInfo, '/restriction');
deleteTable(logoImageTableInfo, '/logoImage');

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

app.get('/fotv', async (req, res, next) => {
  const sunset = await getSunsetTime();
  connection.query('SELECT * FROM ' + restrictionTableInfo.tableName + ';SELECT * FROM ' + restrictionGroupTableInfo.tableName + ';SELECT * FROM ' + logoImageTableInfo.tableName + ';SELECT * FROM ' + imageTableInfo.tableName + ';SELECT * FROM ' + restrictionConditionTableInfo.tableName + ';', [], (err, result) => {
    if(err)
      next(err);
    res.json({
      sunset: sunset.toString(),
      restrictions: result[0].map((a) => parseRow(a, restrictionTableInfo)),//adaptDBToJson(restrictions, restrictionsID), 
      restrictionGroups: result[1].map((a) => parseRow(a, restrictionGroupTableInfo)),// adaptDBToJson(restrictionGroups, restrictionGroupsID),
      logoImages: result[2].map((a) => parseRow(a, logoImageTableInfo)),
      images: result[3].map((a) => parseRow(a, imageTableInfo)),
      restrictionConditions: result[4].map((a) => parseRow(a, restrictionConditionTableInfo)),
      activeProgramID: 0
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

function logoImageDir(image_id){
  return '/root/logoImages/image' + image_id + '.img';
}

app.post('/uploadImage/:imageId', upload.single('image'), (req, res, next) => {
  const image = req.file;

  if (!image) return res.sendStatus(400);

  const image_id_params = parseInt(req.params.imageId);

  const uploadImage = (image, isNew) => {
    const image_id = isNew ? image.imageID : image;
    console.log(image);
    console.log(isNew);
    fs.rename(image.path, logoImageDir(image_id), (err) => {
      if(err){
        next(err);
      }else{
        if(isNew){
          res.json(image).end();
        }else {
          connection.query('UPDATE ' + imageTableInfo.tableName + ' SET version = version + 1 WHERE imageID = ?,SELECT * FROM ' + imageTableInfo.tableName + ' WHERE imageID = ?;', [image_id, image_id], (err2, results) => {
            if(err2)
              next(err2)
            else
              res.json(parseResult(results, imageTableInfo)).end();
          })
        }
      }
    });
  }

  if(isNaN(image_id_params) || image_id_params < 0){
    updateRowsStatement(imageTableInfo, [{version: 0}], (err, results) => {
      if(err)
        next(err)
      else
        uploadImage(parseResult(results, imageTableInfo), true);
    });
  }else{
    uploadImage(image_id_params, false);
  }
});

app.get('/images/:image_id/:image_version', (req, res) => {
  res.sendFile(logoImageDir(parseInt(req.params.image_id)));
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