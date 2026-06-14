const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  app.use('/api', createProxyMiddleware({ target: 'http://localhost:8001', changeOrigin: true }));
  app.use('/ia', createProxyMiddleware({ target: 'http://localhost:8002', changeOrigin: true }));
};
