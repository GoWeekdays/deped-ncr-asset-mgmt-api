import { MONGO_DB, MONGO_URI, PORT } from "./config";
import setup from "./setup";
import { logger, useAtlas } from "@ph-deped-ncr/utils";

useAtlas.initialize({
  uri: MONGO_URI,
  db: MONGO_DB,
});

const atlas = useAtlas.getInstance();

atlas.connect()
  .then(() => {
    logger.log({
      level: "info",
      message: "Successfully connected to MongoDB.",
    });
    // Run setup
    setup();

    const app = require("./app").default;

    app.listen(PORT, () => {
      logger.log({
        level: "info",
        message: `Server is running on http://localhost:${PORT}`,
      });
    });
  })
  .catch((err) => {
    console.log(err);
    logger.log({ level: "error", message: `${err}` });
  });