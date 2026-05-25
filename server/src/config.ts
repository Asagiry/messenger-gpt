import dotenv from "dotenv";

dotenv.config();

export type AppConfig = {
  databaseUrl: string;
  jwtSecret: string;
  port: number;
  publicOrigin: string;
};

export function getConfig(): AppConfig {
  return {
    databaseUrl: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/app",
    jwtSecret: process.env.JWT_SECRET ?? "change-this-development-secret",
    port: Number(process.env.PORT ?? 3000),
    publicOrigin: process.env.PUBLIC_ORIGIN ?? "http://gpt-messenger.voimaxgm.online"
  };
}
