import { AuthenticationError } from "apollo-server-core";
import jwt from "jsonwebtoken";
import User from "../User/schema/User";

export const socialAuth = async (req: any, res: any) => {
  const { _id } = req.user;
  try {
    const user = await User.findById(_id);
    if (!user) {
      throw new Error();
    }
    const token = jwt.sign({ _id: user._id }, process.env.PRIVATE_KEY, {
      expiresIn: "24h",
    });
    user.token = token;
    await user.save();
    req.logout();
    return token;
  } catch (error) {
    throw new AuthenticationError("Not Authenticate");
  }
};
