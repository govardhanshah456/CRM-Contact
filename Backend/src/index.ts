import "reflect-metadata";
import { createApp } from "./app.js";
import { AppDataSource } from "./data-source.js";

const port = Number(process.env.PORT) || 3010;

await AppDataSource.initialize();

const app = createApp();

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
