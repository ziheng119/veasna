// Set this before server.js loads dotenv; works in Windows and POSIX shells.
process.env.NODE_ENV = "production";
require("../server").run();
