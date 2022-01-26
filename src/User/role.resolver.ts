import User from "./schema/User";
import auth from "../middleware/auth";
import authRole from "../middleware/authRole";
import { AuthenticationError, UserInputError } from "apollo-server-core";
import log from "../logger";
import { GraphQLScalarType } from "graphql";
import QueryApi from "../utils/QueryApi";
import Contact from "../User/schema/Contact";

interface Errors {
  [c: string]: any;
}

const OptionScalar = new GraphQLScalarType({
  name: "Option",
  description: "Option custom",
  serialize(value: object) {
    return value;
  },
  parseValue(value: object) {
    return value;
  },
  parseLiteral(ast) {
    return null;
  },
});

const Query = {
  async users(parent: any, args: any, context: any) {
    try {
      const { req, res } = context;
      await auth(req, res);
      authRole(req, res, ["admin", "manager"]);
      const { options } = args;
      if (res.locals.user.role === "admin") {
        options.filter = { ...options.filter, role: "user" };
      }
      const api = new QueryApi(
        User.find(
          {},
          "username email role profilePic isActive passportId createdAt"
        ).sort({
          createdAt: -1,
        }),
        options
      )
        .search()
        .filter();
      let users = await api.query;
      const count = Math.ceil(users.length / options.pagination.perpage);
      api.pagination();
      users = await api.query.clone();
      return { users, count };
    } catch (error) {
      throw new AuthenticationError("Not Authenticate");
    }
  },
  async contacts(parent: any, args: any) {
    const { options } = args;
    try {
      const api = new QueryApi(
        Contact.find().sort({
          createdAt: -1,
        }),
        options
      )
        .search()
        .filter();
      let contacts = await api.query;
      const count = Math.ceil(contacts.length / options.pagination.perpage);
      api.pagination();
      contacts = await api.query.clone();
      return { contacts, count };
    } catch (error) {
      throw new AuthenticationError("Not Authenticate");
    }
  },
};

const Mutation = {
  async updateUserFromRole(parent: any, args: any, context: any) {
    const roles = ["user", "admin", "manager"];
    let errors: Errors = {};
    try {
      const { req, res } = context;
      const { input } = args;
      await auth(req, res);
      authRole(req, res, ["admin", "manager"]);
      const user = await User.findById(input._id);
      if (!user) {
        throw new Error("User not found");
      }
      user.username = input.username;
      user.isActive = input.isActive;
      if (res.locals.user.role === "manager") {
        if (roles.includes(input.role)) {
          user.role = input.role;
        }
      }
      if (!user.passportId) {
        user.email = input.email;
      }
      await User.findByIdAndUpdate(user._id, user, {
        new: true,
        runValidators: true,
      });
      return user;
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
      } else {
        errors.system = "Error System";
      }
      log.error(errors, "Error Register");
      throw new UserInputError("Bad Input", { errors });
    }
  },
};

export default { Query, Mutation, OptionScalar };
