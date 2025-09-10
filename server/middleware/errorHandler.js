// middleware/errorHandler.js
module.exports = (err, req, res, next) => {
  console.error('❌ Error middleware caught:', err.stack || err.message);

  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';

  res.status(status).json({
    success: false,
    message,
  });
};
