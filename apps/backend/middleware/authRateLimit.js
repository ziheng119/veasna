const rateLimit = require("express-rate-limit");

module.exports = function createAuthRateLimit() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    // Mounted at /api/auth. Profile reads on navigation still use the general API
    // limit, but must not consume the small credential-attempt budget.
    skip: (req) => req.method !== "POST" ||
      !/^\/(login|register)\/?$/i.test(req.path),
    message: "Too many authentication attempts, please try again later.",
  });
};
