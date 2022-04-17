import User from "./schema/User";
import { UserInputError, AuthenticationError } from "apollo-server-express";
import log from "../logger";
import { hash, compare } from "bcrypt";
import generator from "generate-password";
import { sendMail } from "../utils/mail/nodemailer";
import jwt from "jsonwebtoken";
import { config } from "dotenv";
import auth from "../middleware/auth";
import { subscribe } from "graphql";
import { PubSub } from "graphql-subscriptions";
import validator from "validator";
import GraphQLJSON from "graphql-type-json";
import { uploadToCloudinary, destroyCloudinary } from "../utils/cloudinary";
import Contact from "./schema/Contact";
import AuthType from "../constants/authType";
import { throwValidationError, handleValidationError } from "../utils/error";
import ErrorValidation, { ErrorMessages } from "../constants/errorValidation";

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
      const emailExists = await User.findOne(
        {
          email: input.email,
          authType: AuthType.EMAIL,
        },
        "email"
      );
      if (emailExists) {
        errors.email = "Email is already taken.";
      }
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
      errors = handleValidationError(error, errors);
      log.error(errors, "Error Register");
      throw new UserInputError("Bad Input", { errors });
    }
  },

  async activeAccount(parent: any, args: any) {
    const { input } = args;
    let errors: Errors = {};
    try {
      const user = await User.findOne({ code: input }, "isActive code");
      const params = [
        {
          valid: !user,
          path: ErrorValidation.CODE,
          message: ErrorMessages.CodeError.NOT_EXIST,
        },
      ];
      throwValidationError(params);
      user.isActive = true;
      user.code = null;
      await user.save();
      return true;
    } catch (error) {
      errors = handleValidationError(error, errors);
      log.error(errors, "Active Account");
      throw new UserInputError("Bad Input", { errors });
    }
  },

  async login(parent: any, args: any) {
    const {
      input: { email, password },
    } = args;
    let errors: Errors = {};
    try {
      const user = await User.findOne(
        {
          email: email,
          authType: AuthType.EMAIL,
        },
        "_id token isActive password"
      );
      const isMatchPassword = await compare(password, user?.password ?? "");
      const params = [
        {
          valid: !user,
          path: ErrorValidation.EMAIL,
          message: ErrorMessages.EmailError.NOT_FOUND,
        },
        {
          valid: !user?.isActive,
          path: ErrorValidation.EMAIL,
          message: ErrorMessages.EmailError.NOT_ACTIVE,
        },
        {
          valid: !isMatchPassword,
          path: ErrorValidation.PASSWORD,
          message: ErrorMessages.PasswordError.NOT_MATCH,
        },
      ];
      throwValidationError(params);
      user.token = jwt.sign({ _id: user._id }, process.env.PRIVATE_KEY, {
        expiresIn: "24h",
      });
      await user.save();
      return user.token;
    } catch (error) {
      errors = handleValidationError(error, errors);
      log.error({ error: errors }, "Login Account");
      throw new UserInputError("Bad Input", { errors });
    }
  },

  async forgotPassword(parent: any, args: any) {
    const { input } = args;
    let errors: Errors = {};
    try {
      const user = await User.findOne({
        email: input,
        authType: AuthType.EMAIL,
      });
      const params = [
        {
          valid: !user,
          path: ErrorValidation.EMAIL,
          message: ErrorMessages.EmailError.NOT_FOUND,
        },
      ];
      throwValidationError(params);
      const newPassword = generator.generate({
        length: 8,
        numbers: true,
      });
      user.password = await hash(newPassword, 8);
      await user.save();
      await sendMail({ email: user.email, code: null, password: newPassword });
      return true;
    } catch (error) {
      errors = handleValidationError(error, errors);
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
    let errors = {};
    try {
      const { req, res } = context;
      await auth(req, res);
      const user = await User.findById(res.locals.user._id);
      const { username, email } = args.input;
      const emailExists = await User.findOne(
        {
          email: email,
          authType: user.authType,
        },
        "email"
      );
      const usernameExists = await User.findOne(
        { username: username },
        "username"
      );
      const params = [
        {
          valid: validator.isEmpty(username),
          path: ErrorValidation.USERNAME,
          message: ErrorMessages.UsernameError.REQUIRED,
        },
        {
          valid: validator.isEmpty(email),
          path: ErrorValidation.EMAIL,
          message: ErrorMessages.EmailError.REQUIRED,
        },
        {
          valid: !validator.isEmail(email),
          path: ErrorValidation.EMAIL,
          message: ErrorMessages.EmailError.VALID,
        },
        {
          valid: user.email == email || !emailExists ? false : true,
          path: ErrorValidation.EMAIL,
          message: ErrorMessages.EmailError.UNIQUE,
        },
        {
          valid: user.username == username || !usernameExists ? false : true,
          path: ErrorValidation.USERNAME,
          message: ErrorMessages.UsernameError.UNIQUE,
        },
      ];
      throwValidationError(params);
      user.username = username;
      user.email = email;
      await user.save();
      return user;
    } catch (error) {
      errors = handleValidationError(error, errors);
      log.error({ error: errors }, "Error updating info");
      throw new UserInputError("Bad Input", { errors });
    }
  },

  async updatePassword(parent: any, args: any, context: any) {
    let errors: Errors = {};
    try {
      const { req, res } = context;
      await auth(req, res);
      const user = await User.findById(res.locals.user._id);
      const { password, newPassword } = args.input;
      const isMatchPassword = await compare(password, user.password);
      const params = [
        {
          valid: !isMatchPassword,
          path: ErrorValidation.PASSWORD,
          message: ErrorMessages.PasswordError.NOT_MATCH,
        },
        {
          valid: newPassword.length < 8 || newPassword.length > 64,
          path: ErrorValidation.NEW_PASSWORD,
          message: ErrorMessages.PasswordError.VALID,
        },
      ];
      throwValidationError(params);
      user.password = await hash(newPassword, 8);
      await user.save();
      return true;
    } catch (error) {
      errors = handleValidationError(error, errors);
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
      errors = handleValidationError(error, errors);
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
