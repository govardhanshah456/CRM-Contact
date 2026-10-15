import "dotenv/config";
import "reflect-metadata";
import { DataSource } from "typeorm";
import { Contact } from "./entities/contact.js";
import { ContactActivity } from "./entities/contact-activity.js";
import { Tag } from "./entities/tag.js";
import { InitSchema1730000000000 } from "./migrations/1730000000000-init-schema.js";
import { AddContactSearchIndexes1730000000001 } from "./migrations/1730000000001-add-contact-search-indexes.js";

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME ?? "postgres",
  password: process.env.DB_PASSWORD ?? "postgres",
  database: process.env.DB_NAME ?? "crm_contact",
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
  entities: [Contact, Tag, ContactActivity],
  migrations: [InitSchema1730000000000, AddContactSearchIndexes1730000000001],
  migrationsRun: true,
  synchronize: false,
});
