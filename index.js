import express from 'express';
import mysql2 from 'mysql2';
import cors from 'cors';
import axios from 'axios';


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
    'title',
    'displayOrder'
  ]
}

const restrictionTableInfo = {
  tableName: 'RESTRICTIONS',
  createStatement: 'CREATE TABLE IF NOT EXISTS RESTRICTIONS(restrictionID int NOT NULL AUTO_INCREMENT, title varchar(255), groupID int NOT NULL, active BOOLEAN, textColor varchar(10), backgroundColor varchar(10), fontWeight varchar(30), displayOrder int, PRIMARY KEY (restrictionID), FOREIGN KEY(groupID) REFERENCES RESTRICTION_GROUPS(groupID))',
  pk: 'restrictionID',
  columns: [
    'groupID',
    'textColor',
    'backgroundColor',
    'fontWeight',
    'title',
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
  if(lastSunset == null || Math.abs((lastTime.getTime() - new Date().getTime()) >= 12)){
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

function insertRowStatement(table, columns, body, cb){
  const activeColumns = columns.filter((a) => body[a] !== undefined);
  const query = "INSERT INTO " + table + " (" + activeColumns.reduce((a, b, i) => (a + " " + b + (i+1 < activeColumns.length ? ',' : '')), '') +
  ') VALUES (' + activeColumns.reduce((a, b, i) => (a + " ?" + (i+1 < activeColumns.length ? ',' : '')), '') + ')';
  const values = activeColumns.map((a) => body[a]);
  connection.query(query, values, cb);
}

function updateRowStatement(table, columns, body, cb, pk){
  const activeColumns = columns.filter((a) => body[a] !== undefined);
  const query = "UPDATE " + table + " SET " + activeColumns.reduce((a, b, i) => (a + " " + b + " = ?" + (i+1 < activeColumns.length ? ',' : '')), '') + ' WHERE ' + pk + ' = ?';
  const values = [...activeColumns, pk].map((a) => body[a]);
  connection.query(query, values, cb);
}

app.post('/restrictionGroup', (req, res) => {
  const body = req.body;
  const cb = (err, results) => {
    if(err)
      throw err;
    res.json(results).end();
  }
  if(body.groupID === undefined){
    insertRowStatement(restrictionGroupTableInfo.tableName, restrictionGroupTableInfo.columns, body, cb);
  }else{
    updateRowStatement(restrictionGroupTableInfo.tableName, restrictionGroupTableInfo.columns, body, cb, restrictionGroupTableInfo.pk)
  }
})

app.post('/restriction', (req, res) => {
  const body = req.body;
  const title = String(body.title);
})

const flagRegex = /".*"/

app.get('/flag-color', (req, res) => {
  axios.get('https://api.community-boating.org/api/flag').then((axiosRes) => {
    const flagColor = axiosRes.data.toString().match(flagRegex)[0].replaceAll('\"', '');
    res.json({
      flagColor: flagColor
    }).end();
  }).catch((e) => {
    throw e;
  })
});

app.get('/fotv', async (req, res) => {
  const sunset = await getSunsetTime();
  //const restrictions = await db.collection(restrictionsCol).list();
  //const restrictionGroups = await db.collection(restrictionGroupsCol).list();
  //console.log(restrictions.results[0].props);
  res.json({
    sunset: sunset.toLocaleString('en-US', { timeZone: 'UTC-5' }),
    restrictions: [],//adaptDBToJson(restrictions, restrictionsID), 
    restrictionGroups: [],// adaptDBToJson(restrictionGroups, restrictionGroupsID),
    activeProgramID: 0
  }).end();
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})