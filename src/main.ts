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
import log from "./logger";
import cookieParser from "cookie-parser";
import passport from "passport";
import session from "express-session";
const MongoDBStore = require("connect-mongodb-session")(session);
import userRoutes from './routes/user';
require("./utils/passport");

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

const store = new MongoDBStore({
  uri: process.env.MONGODB_URL,
  expires: 1000 * 3600 * 24,
});

async function startApolloServer() {
  const app = express();
  const httpServer = createServer(app);
  const corsOptions = {
    origin: "*",
    credentials: true,
    exposedHeaders: ["Authorization"],
  };
  app.use(cors());
  app.use(bodyParser.json({ limit: "5mb" }));
  app.use(cookieParser());
  app.use(multer({ fileFilter: fileFilter }).single("upload"));
  app.use(
    session({
      secret: process.env.SESSION_SECRET,
      saveUninitialized: true,
      resave: true,
      store: store,
    })
  );
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(userRoutes);

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
    cors: corsOptions,
    path: "/graphiql",
  });

  await new Promise<void>((resolve) =>
    httpServer.listen({ port: PORT }, resolve)
  );
  log.info("server listening on port " + PORT);
}

startApolloServer();
