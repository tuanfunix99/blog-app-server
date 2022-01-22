import express from "express";
import { createServer } from "http";
import { config } from "dotenv";
import { ApolloServer } from "apollo-server-express";
import graphqlSchema from "./graphql.schema";
import { execute, subscribe } from "graphql";
import { SubscriptionServer } from "subscriptions-transport-ws";
import cors from "cors";
import cloudinary from "cloudinary";
import bodyParser from "body-parser";
import "./utils/mongodb";
import multer from "multer";
import auth from "./middleware/auth";
import User from "./User/schema/User";
import log from "./logger";
import { uploadToCloudinary } from "./utils/cloudinary";

config();

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const PORT = process.env.PORT || 9000;

const fileFilter = (req: any, file: any, callback: any) => {
  if (
    file.mimetype === "image/png" ||
    file.mimetype === "image/jpg" ||
    file.mimetype === "image/jpeg" ||
    file.mimetype === "image/gif"
  ) {
    callback(null, true);
  } else {
    callback(null, false);
  }
};

async function startApolloServer() {
  const app = express();
  const httpServer = createServer(app);
  app.use(cors());
  app.use(bodyParser.json({ limit: "5mb" }));

  app.use(multer({ fileFilter: fileFilter }).single("upload"));

  app.post("/api/upload-file", async (req, res) => {
    try {
      await auth(req, res);
      const user = await User.findById(res.locals.user._id, "images");
      let encoded = "";
      if (req.file.mimetype === "image/gif") {
        encoded = "data:image/gif;base64," + req.file.buffer.toString("base64");
      } else {
        encoded = "data:image/png;base64," + req.file.buffer.toString("base64");
      }
      const result = await (<any>uploadToCloudinary(encoded, user._id));

      user.images.push(result.url);
      await user.save();
      res.status(200).send(result.url);
    } catch (error) {
      log.error(error.message, "Error uploading");
      res.status(500).send(error.message);
    }
  });

  app.post("/api/fetch-url", async (req, res) => {
    try {
      await auth(req, res);
      if (!req.body.url) {
        throw new Error("Url not found");
      }
      res.status(200).send(req.body.url);
    } catch (error) {
      res.status(500).send(error.message);
    }
  });

  const subscriptionServer = SubscriptionServer.create(
    { schema: graphqlSchema, execute, subscribe },
    { server: httpServer, path: "/graphiql" }
  );

  const server = new ApolloServer({
    context: ({ req, res }) => ({ req, res }),
    schema: graphqlSchema,
    plugins: [
      {
        async serverWillStart() {
          return {
            async drainServer() {
              subscriptionServer.close();
            },
          };
        },
      },
    ],
  });

  await server.start();

  server.applyMiddleware({
    app,
    path: "/graphiql",
  });

  await new Promise<void>((resolve) =>
    httpServer.listen({ port: PORT }, resolve)
  );
  log.info("server listening on port " + PORT);
}

startApolloServer();
