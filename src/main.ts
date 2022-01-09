import express from "express";
import { createServer } from "http";
import log from "./logger";
import { config } from "dotenv";
import { ApolloServer } from "apollo-server-express";
import { ApolloServerPluginDrainHttpServer } from "apollo-server-core";
import graphqlSchema from "./graphql.schema";
import "./utils/mongodb";

config();

const PORT = process.env.PORT || 9000;

async function startApolloServer() {
  const app = express();
  const httpServer = createServer(app);

  const server = new ApolloServer({
    context: ({ req, res }) => ({ req, res }),
    schema: graphqlSchema,
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
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
