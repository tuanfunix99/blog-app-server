import express from "express";
import { createServer } from "http";
import log from "./logger";
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
import { v4 as uuidv4 } from "uuid";

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
    file.mimeType === "image/gif"
  ) {
    callback(null, true);
  } else {
    callback(null, false);
  }
};

const uploadToCloudinary = (image: any) => {
  return new Promise(function (resolve, reject) {
    cloudinary.v2.uploader.upload(
      image,
      { public_id: `${Date.now()}-${uuidv4()}` },
      async function (error, result) {
        if (error) {
          return reject(error);
        }
        return resolve(result);
      }
    );
  });
};

async function startApolloServer() {
  const app = express();
  const httpServer = createServer(app);
  app.use(cors());
  app.use(bodyParser.json({ limit: "5mb" }));

  app.use(multer({ fileFilter: fileFilter }).single("upload"));

  app.post("/api/upload-file", async (req, res) => {
    try {
      let encoded = "";
      encoded = "data:image/png;base64," + req.file.buffer.toString("base64");
      const result = await (<any>uploadToCloudinary(encoded));
      res.status(200).send(result.url);
    } catch (error) {
      res.status(500).send(error.message);
    }
  });

  app.post("/api/fetch-url", (req, res) => {
    try {
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
