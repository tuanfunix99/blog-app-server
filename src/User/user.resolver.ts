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

config();

interface Errors {
  [c: string]: any;
}

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
      await sendMail(user.email, user.code);
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
      const key_secret = generator.generate({
        length: 15,
        symbols: true,
      });
      user.token = jwt.sign(
        { _id: user._id, key_secret },
        process.env.PRIVATE_KEY,
        {
          expiresIn: "24h",
        }
      );
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

  async logout(parent: any, args: any, context: any) {
    try {
      const { req, res } = context;
      await auth(req, res);
      const user = await User.findById(res.locals.user._id);
      user.token = "";
      await user.save();
      return true;
    } catch (error) {
      throw new AuthenticationError("Not Authenticate");
    }
  },
};

export default { Query, Mutation };
