// utils/performance.js
export const performanceMonitor = (req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    const method = req.method;
    const url = req.originalUrl;
    const status = res.statusCode;

    console.log(`${method} ${url} - ${status} - ${duration}ms`);

    // Slow query warning
    if (duration > 5000) {
      console.warn(`⚠️ Slow request: ${method} ${url} took ${duration}ms`);
    }
  });

  next();
};
