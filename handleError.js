function handleError(err, req, res) {
  const code = err.code || 500;
  const message = err.message || 500;
  res.json({
    success: false,
    code: code,
    message: message
  });
}

function sendUnauthorized(req, res){
  handleError({code: 401, message: "Unauthorized"}, req, res)
}

console.log(sendUnauthorized)

module.exports = { handleError, sendUnauthorized };
