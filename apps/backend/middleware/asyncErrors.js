// middleware/asyncErrors.js
// Express 4 ignores promises returned by handlers: an error thrown inside an async
// handler, outside its own try/catch, never reaches the error handler and the request
// hangs until the client gives up. Forward those rejections to next(err) instead.
// (Express 5 does this natively; remove this file when upgrading.)

const Layer = require('express/lib/router/layer');

if (!Layer.prototype.__forwardsAsyncErrors) {
  Layer.prototype.handle_request = function handle(req, res, next) {
    const fn = this.handle;
    if (fn.length > 3) return next(); // error-handling middleware is invoked elsewhere
    try {
      const result = fn(req, res, next);
      if (result && typeof result.catch === 'function') result.catch(next);
    } catch (err) {
      next(err);
    }
  };
  Layer.prototype.__forwardsAsyncErrors = true;
}
