import dotenv from 'dotenv';

// Con NODE_ENV=test (npm test) se usan las variables de .env.test; si no, las de .env
const isTestRun = process.env.NODE_ENV === 'test';

dotenv.config({ path: isTestRun ? '.env.test' : '.env', quiet: true });

const requiredVars = ['PORT', 'MONGODB_URI', 'NODE_ENV'];

// server.js revisa esta lista al arrancar y frena la app con un log fatal
export const missingEnvVars = requiredVars.filter((variable) => !process.env[variable]);

export const config = Object.freeze({
  port: Number(process.env.PORT),
  mongoUri: process.env.MONGODB_URI,
  nodeEnv: process.env.NODE_ENV,
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
});
