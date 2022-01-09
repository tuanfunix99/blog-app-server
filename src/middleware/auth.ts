import { Request, Response } from "express";
import User from "../User/schema/User";
import { config } from "dotenv";
import * as jwt from "jsonwebtoken";
import { AuthenticationError } from "apollo-server-express";

config();

const auth = async (req: Request, res: Response) => {  
  const token = req.headers.authorization as string;
  try {
    const userDecode = <any>jwt.verify(token, process.env.PRIVATE_KEY);
    const user = await User.findById(userDecode._id, "username email profilePic token isActive");
    if (!user) {
      throw new Error();
    }
    if (!user.isActive) {
        throw new Error();
      }
    if (user.token !== token) {
      throw new Error();
    }
    res.locals.user = user;
  } catch (error) {
    throw new AuthenticationError("Not Authenticate");
  }
};

export default auth;
