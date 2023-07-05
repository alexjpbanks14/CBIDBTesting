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


const restrictionGroupTableInfo = {
  tableName: 'RESTRICTION_GROUPS',
  createStatement: 'CREATE TABLE IF NOT EXISTS RESTRICTION_GROUPS(groupID int NOT NULL AUTO_INCREMENT, title varchar(255), displayOrder int, PRIMARY KEY (groupID))',
  pk: 'groupID',
  columns: [
    'groupID',
    'title',
    'displayOrder'
  ]
}

const restrictionTableInfo = {
  tableName: 'RESTRICTIONS',
  createStatement: 'CREATE TABLE IF NOT EXISTS RESTRICTIONS(restrictionID int NOT NULL AUTO_INCREMENT, title varchar(255), groupID int NOT NULL, active BOOLEAN, textColor varchar(10), backgroundColor varchar(10), fontWeight varchar(30), displayOrder int, PRIMARY KEY (restrictionID), FOREIGN KEY(groupID) REFERENCES RESTRICTION_GROUPS(groupID))',
  pk: 'restrictionID',
  columns: [
    'restrictionID',
    'title',
    'groupID',
    'active',
    'textColor',
    'backgroundColor',
    'fontWeight',
    'displayOrder'
  ]
}

function createTables(){
    connection.query(restrictionGroupTableInfo.createStatement);
    connection.query(restrictionTableInfo.createStatement);
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

function insertRowStatement(tableInfo,body, cb){
  const activeColumns = tableInfo.columns.filter((a) => body[a] !== undefined);
  const query = "INSERT INTO " + tableInfo.tableName + " (" + activeColumns.reduce((a, b, i) => (a + " " + b + (i+1 < activeColumns.length ? ',' : '')), '') +
  ') VALUES (' + activeColumns.reduce((a, b, i) => (a + " ?" + (i+1 < activeColumns.length ? ',' : '')), '') + ');SELECT * FROM ' + tableInfo.tableName + ' WHERE ' + tableInfo.pk + ' = LAST_INSERT_ID();';
  const values = activeColumns.map((a) => body[a]);
  connection.query(query, values, cb);
}

function updateRowStatement(tableInfo, body, cb){
  const activeColumns = tableInfo.columns.filter((a) => body[a] !== undefined && a != tableInfo.pk);
  const query = "UPDATE " + tableInfo.tableName + " SET " + activeColumns.reduce((a, b, i) => (a + " " + b + " = ?" + (i+1 < activeColumns.length ? ',' : '')), '') + ' WHERE ' + tableInfo.pk + ' = ?;SELECT * FROM ' + tableInfo.tableName + ' WHERE ' + tableInfo.pk + ' = ?;';
  const values = [...activeColumns, tableInfo.pk, tableInfo.pk].map((a) => body[a]);
  connection.query(query, values, cb);
}

function postTable(tableInfo, path){
  app.post(path, (req, res, next) => {
    const body = req.body;
    const cb = (err, result) => {
      if(err)
        next(err);
      else
        res.json(result[1][0]).end();
    }
    if(body[tableInfo.pk] === undefined){
      insertRowStatement(tableInfo, body, cb);
    }else{
      updateRowStatement(tableInfo, body, cb);
    }
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

deleteTable(restrictionGroupTableInfo, '/restrictionGroup');
deleteTable(restrictionTableInfo, '/restriction');

const flagRegex = /".*"/

const replaceRegex = new RegExp('\"', 'g');

app.get('/flag-color', (req, res) => {
  axios.get('https://api.community-boating.org/api/flag').then((axiosRes) => {
    const flagColor = String(axiosRes.data).match(flagRegex)[0].replace(replaceRegex, '');
    console.log(axiosRes.data);
    console.log(typeof flagColor);
    res.json({
      flagColor: flagColor
    }).end();
  }).catch((e) => {
    throw e;
  })
});

app.get('/fotv', async (req, res, next) => {
  const sunset = await getSunsetTime();
  connection.query('SELECT * FROM ' + restrictionTableInfo.tableName + ';SELECT * FROM ' + restrictionGroupTableInfo.tableName + ';', [], (err, result) => {
    if(err)
      next(err);
    res.json({
      sunset: sunset.toString(),
      restrictions: result[0],//adaptDBToJson(restrictions, restrictionsID), 
      restrictionGroups: result[1],// adaptDBToJson(restrictionGroups, restrictionGroupsID),
      activeProgramID: 0
    }).end();
  });
  //const restrictions = await db.collection(restrictionsCol).list();
  //const restrictionGroups = await db.collection(restrictionGroupsCol).list();
  //console.log(restrictions.results[0].props);
});

const ap_image_dir = "/root/ap_image"

app.post('/ap_image', upload.single('image'), (req, res, next) => {
  const image = req.file;

  if (!image) return res.sendStatus(400);

  fs.rename(image.path, ap_image_dir, (err) => {
    if(err)
      next(err);
    else
      res.sendStatus(200);
  });
});

app.get('/ap_image', (req, res) => {
  res.sendFile(ap_image_dir);
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})