import User from "./schema/User";
import { UserInputError, AuthenticationError } from "apollo-server-express";
import log from "../logger";
import { hash, compare } from "bcrypt";
import generator from "generate-password";
import { sendMail } from "../utils/mail/nodemailer";
import { Error } from "mongoose";
import jwt from "jsonwebtoken";
import { config } from "dotenv";
import auth from "../middleware/auth";
import { subscribe } from "graphql";
import { PubSub } from "graphql-subscriptions";
import validator from "validator";
import GraphQLJSON from "graphql-type-json";
import { uploadToCloudinary, destroyCloudinary } from "../utils/cloudinary";
import Contact from "./schema/Contact";

config();

interface Errors {
  [c: string]: any;
}

interface CloudData {
  url: string;
  public_id: string;
}

const pubsub = new PubSub();

const JSon = GraphQLJSON;

const Query = {
  async user(parent: any, args: any, context: any) {
    try {
      const { req, res } = context;
      await auth(req, res);
      return res.locals.user;
    } catch (error) {
      throw new AuthenticationError("Not Authenticate");
    }
  },
};

const Mutation = {
  async register(parent: any, args: any) {
    const { input } = args;
    let errors: Errors = {};
    try {
      const user = await User.create({
        username: input.username,
        email: input.email,
        password: input.password,
      });
      user.password = await hash(user.password, 8);
      user.code = generator.generate({
        length: 8,
        numbers: true,
      });
      await user.save();
      await sendMail({ email: user.email, code: user.code, password: null });
      pubsub.publish("REGISTED", {
        registed: user,
      });
      return true;
    } catch (error) {
      if (error.name === "ValidationError") {
        for (const property in error.errors) {
          if (error.errors[property].kind === "unique") {
            continue;
          }
          errors[property] = error.errors[property].message;
        }
      } else if (error.name === "MongoServerError" && error.code === 11000) {
        const property = Object.keys(error.keyPattern)[0];
        errors[property] = `${property} is already taken`;
      }
      log.error(errors, "Error Register");
      throw new UserInputError("Bad Input", { errors });
    }
  },

  async activeAccount(parent: any, args: any) {
    const { input } = args;
    let errors: Errors = {};
    let error = new Error.ValidationError();
    try {
      const user = await User.findOne({ code: input });
      if (!user) {
        error.errors.code = new Error.ValidatorError({
          message: "Code not exist",
          path: "code",
        });
        throw error;
      }
      user.isActive = true;
      user.code = "";
      await user.save();
      return true;
    } catch (error) {
      if (error.name === "ValidationError") {
        for (const property in error.errors) {
          if (error.errors[property].kind === "unique") {
            continue;
          }
          errors[property] = error.errors[property].message;
        }
      }
      log.error(errors, "Active Account");
      throw new UserInputError("Bad Input", { errors });
    }
  },

  async login(parent: any, args: any) {
    const {
      input: { email, password },
    } = args;
    let errors: Errors = {};
    let error = new Error.ValidationError();
    try {
      const user = await User.findOne({ email: email });
      if (!user) {
        error.errors.email = new Error.ValidatorError({
          message: "Email not found",
          path: "email",
        });
        throw error;
      }
      if (!user.isActive) {
        error.errors.email = new Error.ValidatorError({
          message: "Account not active",
          path: "email",
        });
        throw error;
      }
      const isMatchPassword = await compare(password, user.password);
      if (!isMatchPassword) {
        error.errors.password = new Error.ValidatorError({
          message: "Password not match",
          path: "password",
        });
        throw error;
      }
      user.token = jwt.sign({ _id: user._id }, process.env.PRIVATE_KEY, {
        expiresIn: "24h",
      });
      await user.save();
      return user.token;
    } catch (error) {
      if (error.name === "ValidationError") {
        for (const property in error.errors) {
          if (error.errors[property].kind === "unique") {
            continue;
          }
          errors[property] = error.errors[property].message;
        }
      }
      log.error(errors, "Active Account");
      throw new UserInputError("Bad Input", { errors });
    }
  },

  async forgotPassword(parent: any, args: any) {
    const { input } = args;
    let errors: Errors = {};
    let error = new Error.ValidationError();
    try {
      const user = await User.findOne({ email: input });
      if (!user) {
        error.errors.email = new Error.ValidatorError({
          message: "Email not found",
          path: "email",
        });
        throw error;
      }
      const newPassword = generator.generate({
        length: 8,
        numbers: true,
      });
      user.password = await hash(newPassword, 8);
      await user.save();
      await sendMail({ email: user.email, code: null, password: newPassword });
      return true;
    } catch (error) {
      if (error.name === "ValidationError") {
        for (const property in error.errors) {
          if (error.errors[property].kind === "unique") {
            continue;
          }
          errors[property] = error.errors[property].message;
        }
      }
      log.error(errors, "Forgot Password");
      throw new UserInputError("Bad Input", { errors });
    }
  },

  async logout(parent: any, args: any, context: any) {
    try {
      const { req, res } = context;
      await auth(req, res);
      req.logout();
      const user = await User.findById(res.locals.user._id);
      user.token = "";
      await user.save();
      return true;
    } catch (error) {
      throw new AuthenticationError("Not Authenticate");
    }
  },

  async uploadProfilePic(parent: any, args: any, context: any) {
    try {
      const { req, res } = context;
      await auth(req, res);
      const user = await User.findById(res.locals.user._id);
      let cloud_data: CloudData = {
        url: "",
        public_id: "",
      };
      if (args.input.profilePic !== "/default-profile.png") {
        await destroyCloudinary(args.input.profilePic);
      }
      const result = await (<any>(
        uploadToCloudinary(args.input.image, user._id)
      ));
      user.profilePic = result.url;
      cloud_data.url = result.url;
      cloud_data.public_id = result.public_id;
      pubsub.publish("UPLOADED_PROFILEPIC", {
        uplodedProfilePic: {
          user_id: user._id,
          image: user.profilePic,
        },
      });
      await user.save();
      return cloud_data;
    } catch (error) {
      throw new AuthenticationError("Not Authenticate");
    }
  },

  async updateInfo(parent: any, args: any, context: any) {
    try {
      const { req, res } = context;
      await auth(req, res);
      const user = await User.findById(res.locals.user._id);
      const { username, email } = args.input;
      if (!user.passportId) {
        if (validator.isEmpty(username) || validator.isEmpty(email)) {
          throw new Error("Value is required");
        }
        if (!validator.isEmail(email)) {
          throw new Error("Email not valid");
        }
      } else {
        if (validator.isEmpty(username)) {
          throw new Error("Value is required");
        }
      }
      user.username = username;
      user.email = email;
      await user.save();
      return user;
    } catch (error) {
      log.error(error.message, "Error updating info");
      throw new AuthenticationError("Not Authenticate");
    }
  },

  async updatePassword(parent: any, args: any, context: any) {
    let errors: Errors = {};
    let error = new Error.ValidationError();
    try {
      const { req, res } = context;
      await auth(req, res);
      const user = await User.findById(res.locals.user._id);
      const { password, newPassword } = args.input;
      const isMatchPassword = await compare(password, user.password);
      if (!isMatchPassword) {
        error.errors.password = new Error.ValidatorError({
          message: "Password not match",
          path: "password",
        });
        throw error;
      }
      if (newPassword.length < 8 || newPassword.length > 64) {
        error.errors.newPassword = new Error.ValidatorError({
          message: "Password at least 8 chracters and max 64 characters",
          path: "newPassword",
        });
        throw error;
      }
      user.password = await hash(newPassword, 8);
      await user.save();
      return true;
    } catch (error) {
      if (error.name === "ValidationError") {
        for (const property in error.errors) {
          if (error.errors[property].kind === "unique") {
            continue;
          }
          errors[property] = error.errors[property].message;
        }
      }
      log.error(errors, "Active Account");
      throw new UserInputError("Bad Input", { errors });
    }
  },

  async contact(parent: any, args: any) {
    let errors: Errors = {};
    const { input } = args;
    try {
      await Contact.create(input);
      return true;
    } catch (error) {
      if (error.name === "ValidationError") {
        for (const property in error.errors) {
          if (error.errors[property].kind === "unique") {
            continue;
          }
          errors[property] = error.errors[property].message;
        }
      }
      log.error(errors, "Contact");
      throw new UserInputError("Bad Input", { errors });
    }
  },
};

const Subscription = {
  uplodedProfilePic: {
    subscribe: () => pubsub.asyncIterator(["UPLOADED_PROFILEPIC"]),
  },
  registed: {
    subscribe: () => pubsub.asyncIterator(["REGISTED"]),
  },
};

export default { Query, Mutation, Subscription, JSon };
