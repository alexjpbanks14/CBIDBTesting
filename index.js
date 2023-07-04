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

app.get('/fotv', (req, res) => {
    connection.query('SELECT * ', )
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})