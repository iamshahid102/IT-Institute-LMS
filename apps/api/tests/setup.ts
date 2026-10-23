// Runs before every test file, ahead of application imports, so the API is quiet and
// deterministic while tests execute.
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.STORAGE_LOCAL_DIR = './var/test-storage';
process.env.APP_PUBLIC_URL = 'http://localhost:3000';
process.env.WEB_ORIGIN = 'http://localhost:3000';
