const sendSuccess = (
  res,
  {
    statusCode = 200,
    message = "Request processed successfully.",
    data = [],
    meta = null,
  } = {}
) =>
  res.status(statusCode).json({
    success: true,
    message,
    data,
    ...(meta ? { meta } : {}),
  });

module.exports = {
  sendSuccess,
};
