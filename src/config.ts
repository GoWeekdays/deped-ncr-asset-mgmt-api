import * as dotenv from "dotenv";
dotenv.config();

export const MONGO_URI = (process.env.MONGO_URI || "mongodb://localhost:27017") as string;
export const MONGO_DB = (process.env.MONGO_DB || "default") as string;

export const PORT = Number(process.env.PORT || 3001);
export const SECRET_KEY = process.env.SECRET_KEY as string;
export const isDev = process.env.NODE_ENV !== "production";

export const MAILER_TRANSPORT_HOST = process.env.MAILER_TRANSPORT_HOST as string;
export const MAILER_TRANSPORT_PORT = Number(process.env.MAILER_TRANSPORT_PORT || 465);
export const MAILER_TRANSPORT_SECURE = process.env.MAILER_TRANSPORT_SECURE === "true";
export const MAILER_EMAIL = process.env.MAILER_EMAIL as string;
export const MAILER_PASSWORD = process.env.MAILER_PASSWORD as string;

export const ACCESS_TOKEN_SECRET = (process.env.ACCESS_TOKEN_SECRET as string) || "access_token_secret";
export const REFRESH_TOKEN_SECRET = (process.env.REFRESH_TOKEN_SECRET as string) || "refresh_token_secret";
export const ACCESS_TOKEN_EXPIRY = (process.env.ACCESS_TOKEN_EXPIRY as string) || "15s";
export const REFRESH_TOKEN_EXPIRY = (process.env.REFRESH_TOKEN_EXPIRY as string) || "30d";
export const APP_ACCOUNT = (process.env.APP_ACCOUNT as string) || "http:localhost:3000";
export const OTP_FORGET_PASSWORD_DURATION = (process.env.OTP_FORGET_PASSWORD_DURATION as string) || "10 minutes";
export const OTP_USER_INVITE_DURATION = (process.env.OTP_USER_INVITE_DURATION as string) || "3 days";
export const OTP_UPDATE_EMAIL_DURATION = (process.env.OTP_UPDATE_EMAIL_DURATION as string) || "10 minutes";

export const REDIS_HOST = process.env.REDIS_HOST as string;
export const REDIS_PORT = Number(process.env.REDIS_PORT || 6379);
export const REDIS_PASSWORD = process.env.REDIS_PASSWORD as string;

export const DEFAULT_USER_EMAIL = process.env.DEFAULT_USER_EMAIL as string;
export const DEFAULT_USER_PASSWORD = process.env.DEFAULT_USER_PASSWORD as string;
export const DEFAULT_USER_FIRST_NAME = process.env.DEFAULT_USER_FIRST_NAME as string;
export const DEFAULT_USER_LAST_NAME = process.env.DEFAULT_USER_LAST_NAME as string;

export const DEFAULT_ADMIN_HEAD_USER_EMAIL = (process.env.DEFAULT_ADMIN_HEAD_USER_EMAIL as string) || "admin-head@deped-ncr.com";
export const DEFAULT_ADMIN_USER_EMAIL = (process.env.DEFAULT_ADMIN_USER_EMAIL as string) || "admin@deped-ncr.com";
export const DEFAULT_OFFICE_CHIEF_USER_EMAIL = (process.env.DEFAULT_OFFICE_CHIEF_USER_EMAIL as string) || "office-chief@deped-ncr.com";
export const DEFAULT_PERSONNEL_USER_EMAIL = (process.env.DEFAULT_PERSONNEL_USER_EMAIL as string) || "personnel@deped-ncr.com";

export const SPACES_ACCESS_KEY = process.env.SPACES_ACCESS_KEY as string;
export const SPACES_SECRET_KEY = process.env.SPACES_SECRET_KEY as string;
export const SPACES_ENDPOINT = process.env.SPACES_ENDPOINT as string;
export const SPACES_REGION = process.env.SPACES_REGION as string;
export const SPACES_BUCKET = process.env.SPACES_BUCKET as string;

export const FRONTEND_URL = (process.env.FRONTEND_URL || "http://localhost:3000") as string;

export const DEFAULT_ENTITY_NAME = (process.env.DEFAULT_ENTITY_NAME as string) || "DEPED NCR";
export const DEFAULT_FUND_CLUSTER = (process.env.DEFAULT_FUND_CLUSTER as string) || "M003";
