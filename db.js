import pg from "pg";
import dotenv from "dotenv";
import {fileURLToPath} from "url";
import {dirname, join} from "path";

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), ".env") });

const {Pool} = pg;

export const pool = new Pool(
    process.env.DATABASE_URL 
    ? {
        connectionString : process.env.DATABASE_URL,
        ssl : {
            rejectUnauthorized : false
        }
    }
    : {
        user: "postgres",
        host: "localhost",
        database: "PdfParse_semantic_db",
        password: process.env.DB_PASSWORD,
        port: 5432
    }
) 