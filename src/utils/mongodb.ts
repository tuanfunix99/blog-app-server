import { ConnectOptions, connect } from "mongoose";
import { config } from "dotenv";
import log from "../logger";

config();

const MONGODB_URL = process.env.MONGODB_URL;
const options = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
};

connect(MONGODB_URL, options as ConnectOptions)
  .then(() => {
    log.info("Connected to MongoDB");
  })
  .catch((err) => log.error(err.message, "Error connect to MongoDB"));
