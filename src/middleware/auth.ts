import { Request, Response } from "express";
import User from "../User/schema/User";
import { config } from "dotenv";
import * as jwt from "jsonwebtoken";
import { AuthenticationError } from "apollo-server-express";
import log from "../logger";

config();

const auth = async (req: Request, res: Response) => {
  const token = req.headers.authorization as string;
  try {
    const userDecode = <any>jwt.verify(token, process.env.PRIVATE_KEY);
    const user = await User.findById(
      userDecode._id,
      "username email role profilePic token isActive authType"
    );
    if (!user) {
      throw new Error("User not found");
    }
    if (!user.isActive) {
      throw new Error("User is not active");
    }
    if (user.token !== token) {
      throw new Error("Token not valid");
    }
    res.locals.user = user;
  } catch (error) {
    log.error({ error: error.message }, "Error authenticate");
    throw new AuthenticationError("Not Authenticate");
  }
};

// exports.authorizationRole = (user: any, roles: string[]) => {
//   if(!roles.includes(user.role)){
//     throw new AuthenticationError("Not Authenticate");
//   }
// }

export default auth;

