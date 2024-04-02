const express = require('express');
const mysql2 = require('mysql2');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const ini = require('ini');
const util = require('util');

const config = ini.parse(fs.readFileSync(`./config.ini`, 'utf-8'));
exports.config = config;
const upload = multer({ dest: config.imageTempDir });
exports.upload = upload;
const app = express();
const port = config.port;
exports.port = port;
console.log("connection.js");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
var allowedOrigins = ['http://localhost:8081',
  'http://yourapp.com'];
app.use(cors({
  origin: function (origin, callback) {
    return callback(null, true);
  }
}));
exports.app = app;
const connection = mysql2.createConnection({
  multipleStatements: true,
  host: config.mysql.host,
  user: config.mysql.user,
  password: config.mysql.password,
  database: config.mysql.database
});
connection.connect();
exports.connection = connection;
const query = util.promisify(conn.query).bind(conn);
exports.query = query
