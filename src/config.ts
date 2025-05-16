import * as dotenv from "dotenv";
dotenv.config();

export const MONGO_URI = (process.env.MONGO_URI || "mongodb://localhost:27017") as string;
export const MONGO_DB = (process.env.MONGO_DB || "default") as string;
export const MONGO_DB_DEV = (process.env.MONGO_DB_DEV || `${process.env.MONGO_DB}-dev`) as string;
export const PORT = Number(process.env.PORT || 3001);
export const SECRET_KEY = process.env.SECRET_KEY as string;
export const isDev = process.env.NODE_ENV !== "production";
export const ACCESS_TOKEN_SECRET = (process.env.ACCESS_TOKEN_SECRET as string) || "access_token_secret";
export const REDIS_HOST = process.env.REDIS_HOST as string;
export const REDIS_PORT = Number(process.env.REDIS_PORT || 6379);
export const REDIS_PASSWORD = process.env.REDIS_PASSWORD as string;

export const SPACES_ACCESS_KEY = process.env.SPACES_ACCESS_KEY as string;
export const SPACES_SECRET_KEY = process.env.SPACES_SECRET_KEY as string;
export const SPACES_ENDPOINT = process.env.SPACES_ENDPOINT as string;
export const SPACES_REGION = process.env.SPACES_REGION as string;
export const SPACES_BUCKET = process.env.SPACES_BUCKET as string;
