const {app, connection} = require('./index')

function updateRowsStatement(tableInfo, body, cb) {
  var values = [];
  const query = body.map(bn => {
    const activeColumns = tableInfo.columns.filter((a) => bn[a.key] !== undefined).map((a) => a.key);
    const activeColumnsNotPK = activeColumns.filter((a) => a.key != tableInfo.pk);
    var queryI = "INSERT INTO " + tableInfo.tableName + " (" + activeColumns.reduce((a, b, i) => (a + " " + b + (i + 1 < activeColumns.length ? ',' : '')), '') +
      ') VALUES (' + activeColumns.reduce((a, b, i) => (a + " ?" + (i + 1 < activeColumns.length ? ',' : '')), '') + ')';
    values = values.concat(activeColumns.map((a) => bn[a]));
    if (bn[tableInfo.pk]) {
      values = values.concat(activeColumnsNotPK.map((a) => bn[a])).concat([bn[tableInfo.pk]]);
      queryI = queryI + " ON DUPLICATE KEY UPDATE " + activeColumnsNotPK.reduce((a, b, i) => (a + " " + b + " = ?" + (i + 1 < activeColumnsNotPK.length ? ',' : '')), '') + ';SELECT * FROM ' + tableInfo.tableName + ' WHERE ' + tableInfo.pk + ' = ?;';
    } else {
      queryI = queryI + ";SELECT * FROM " + tableInfo.tableName + " WHERE " + tableInfo.pk + " = LAST_INSERT_ID();";
    }
    return queryI;
  }).reduce((a, b) => a + b, '');
  connection.query(query, values, cb);
}

function parseRow(row, tableInfo) {
  const parsedRow = {};
  if (row == undefined)
    return parsedRow;
  tableInfo.columns.forEach((a) => {
    parsedRow[a.key] = a.type.SToV(row[a.key]);
  });
  return parsedRow;
}

function parseResult(result, tableInfo) {
  return result.filter((a, i) => i % 2 == 1).map((a) => parseRow(a[0], tableInfo));
}

function postTable(tableInfo, path) {
  app.post(path, (req, res, next) => {
    const body = req.body;
    const cb = (err, result) => {
      if (err)
        next(err);

      else
        res.json(parseResult(result, tableInfo)).end();
    };
    updateRowsStatement(tableInfo, body, cb);
  });
}
function deleteTable(tableInfo, path) {
  app.delete(path, (req, res, next) => {
    const body = Array.isArray(req.body) ? req.body : [req.body];
    var query = '';
    var values = [];
    body.forEach((a) => {
      query = query + 'DELETE FROM ' + tableInfo.tableName + ' WHERE ' + tableInfo.pk + ' = ?;';
      values.push(a[tableInfo.pk]);
    });
    console.log(body);
    console.log(query);
    console.log(values);
    connection.query(query, values, (err, result) => {
      if (err)
        next(err);

      else
        res.json({ result: 'ok' }).end();
    });
  });
}
module.exports = {postTable, deleteTable, parseResult, parseRow, updateRowsStatement}

