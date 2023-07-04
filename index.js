import express from 'express';
import mysql2 from 'mysql2';
import cors from 'cors';
import axios from 'axios';


const app = express()
const port = 3000

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

function createTables(){
    connection.query('CREATE TABLE IF NOT EXISTS RESTRICTION_GROUPS(groupID int NOT NULL, title varchar(255), displayOrder int, PRIMARY KEY (groupID))');
    connection.query('CREATE TABLE IF NOT EXISTS RESTRICTIONS(restrictionID int NOT NULL, title varchar(255), groupID int NOT NULL, active BOOLEAN, textColor varchar(10), backgroundColor varchar(10), fontWeight varchar(30), displayOrder int, PRIMARY KEY (restrictionID), FOREIGN KEY(groupID) REFERENCES RESTRICTION_GROUPS(groupID))');
}

createTables();

var lastSunset = null;
var lastTime = new Date();

async function getSunsetTime() {
  if(lastSunset == null || Math.abs((lastTime.getTime() - new Date().getTime()) >= 12)){
    const axiosRes = await axios.get('https://api.sunrise-sunset.org/json?lat=42.3598986&lng=-71.0730733&formatted=0');
    const time = Date.parse(axiosRes.data.results.sunset);
    //lastSunset = timeInUTC.utcOffset(-5);
    //if(lastSunset.isDST()){
    //  lastSunset = lastSunset.add(1, 'hour');
    //}
    lastTime = new Date();
  }
  return lastSunset;
}

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
    sunset: sunset.toString(),
    restrictions: [],//adaptDBToJson(restrictions, restrictionsID), 
    restrictionGroups: [],// adaptDBToJson(restrictionGroups, restrictionGroupsID),
    activeProgramID: 0
  }).end();
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})