function handleError(err, req, res) {
  const code = err.code || 500
  const message = err.message || 500
  console.log("Sending error, " + code + ": " + message)
  res.json({
    success: false,
    code: code,
    message: message
  })
}

function sendUnauthorized(req, res){
  handleError({code: 401, message: "Unauthorized"}, req, res)
}

module.exports = { handleError, sendUnauthorized }
