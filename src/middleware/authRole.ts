import { AuthenticationError } from "apollo-server-express";

const authorizationRole = (req: any, res: any, roles: any) => {
  const user = res.locals.user;
  if(!user){
    throw new AuthenticationError("User not found");
  }
  if(!roles.includes(user.role)){
    throw new AuthenticationError("Not Authenticate");
  }
}

export default authorizationRole;