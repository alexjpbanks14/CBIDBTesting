const express = require('express')
const mysql2 = require('mysql2')
const cors = require('cors')
const multer = require('multer')
const fs = require('fs')
const ini = require('ini')
const util = require('util')
var cookies = require("cookie-parser")

const config = ini.parse(fs.readFileSync(`./config.ini`, 'utf-8'))
exports.config = config
const upload = multer({ dest: config.imageTempDir })
exports.upload = upload
const app = express()
const port = config.port
exports.port = port

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cookies())

var allowedOrigins = ['http://tv.community-boating.org:3001',
  'http://tv.community-boating.org']

app.use(cors({
  origin: function(origin, callback){
    if(!origin) return callback(null, true);
    if(allowedOrigins.indexOf(origin) === -1){
      var msg = 'The CORS policy for this site does not ' +
                'allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  }
}))

exports.app = app
const connection = mysql2.createConnection({
  multipleStatements: true,
  host: config.mysql.host,
  user: config.mysql.user,
  password: config.mysql.password,
  database: config.mysql.database
})
connection.connect()
exports.connection = connection
const query = util.promisify(connection.query).bind(connection)
exports.query = query
exports.config = config
exports.apiPrefix = config.apiPrefix
