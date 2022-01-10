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

config();

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const PORT = process.env.PORT || 9000;

async function startApolloServer() {
  const app = express();
  const httpServer = createServer(app);
  app.use(cors());
  app.use(bodyParser.json({ limit: "5mb" }));

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
