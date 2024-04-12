const { app, apiPrefix, query } = require('./connection')
const { handleError, sendUnauthorized } = require('./handleError')
const { checkPermission } = require('./permissions')

function updateRowsStatement(tableInfo, body) {
  var values = []
  const queryS = body.map(bn => {
    const activeColumns = tableInfo.columns.filter((a) => bn[a.key] !== undefined).map((a) => a.key)
    const activeColumnsNotPK = activeColumns.filter((a) => a.key != tableInfo.pk)
    var queryI = "INSERT INTO " + tableInfo.tableName + " (" + activeColumns.reduce((a, b, i) => (a + " " + b + (i + 1 < activeColumns.length ? ',' : '')), '') +
      ') VALUES (' + activeColumns.reduce((a, b, i) => (a + " ?" + (i + 1 < activeColumns.length ? ',' : '')), '') + ')'
    values = values.concat(activeColumns.map((a) => bn[a]))
    if (bn[tableInfo.pk]) {
      values = values.concat(activeColumnsNotPK.map((a) => bn[a])).concat([bn[tableInfo.pk]])
      queryI = queryI + " ON DUPLICATE KEY UPDATE " + activeColumnsNotPK.reduce((a, b, i) => (a + " " + b + " = ?" + (i + 1 < activeColumnsNotPK.length ? ',' : '')), '') + ';SELECT * FROM ' + tableInfo.tableName + ' WHERE ' + tableInfo.pk + ' = ?;'
    } else {
      queryI = queryI + ";SELECT * FROM " + tableInfo.tableName + " WHERE " + tableInfo.pk + " = LAST_INSERT_ID();"
    }
    return queryI
  }).reduce((a, b) => a + b, '')
  return query(queryS, values)
}

function parseRow(row, tableInfo) {
  const parsedRow = {}
  if (row == undefined)
    return parsedRow
  tableInfo.columns.forEach((a) => {
    parsedRow[a.key] = a.type.SToV(row[a.key])
  })
  return parsedRow
}

function parseResult(result, tableInfo) {
  console.log(result)
  console.log("voop")
  return result.filter((a, i) => i % 2 == 1).map((a) => parseRow(a[0], tableInfo))
}

async function postTable(tableInfo, path, permissions) {
  app.post(apiPrefix + path, async (req, res, next) => {
    if(!await checkPermission(req, res, permissions)){
      return sendUnauthorized(req, res)
    }
    const body = req.body
    const result = await (updateRowsStatement(tableInfo, body).catch((e) => {
      handleError(e, req, res)
    }))
    console.log("RESULT:")
    console.log(result)
    return res.json(parseResult(result, tableInfo))
  })
}

async function deleteTable(tableInfo, path, permissions) {
  await app.delete(apiPrefix + path, async (req, res, next) => {
    if(!await checkPermission(req, res, permissions)){
      return sendUnauthorized(req, res)
    }
    const body = Array.isArray(req.body) ? req.body : [req.body]
    var queryS = ''
    var values = []
    body.forEach((a) => {
      queryS = queryS + 'DELETE FROM ' + tableInfo.tableName + ' WHERE ' + tableInfo.pk + ' = ?;'
      values.push(a[tableInfo.pk])
    })
    await query(queryS, values).catch((e) => handleError(e, req, res, next))
    res.json({
      success: true,
      result: "OK"
    })
  })
}
module.exports = {postTable, deleteTable, parseResult, parseRow, updateRowsStatement}

