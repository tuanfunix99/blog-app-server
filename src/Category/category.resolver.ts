import { AuthenticationError } from "apollo-server-core";
import auth from "../middleware/auth";
import Category from "./schema/Category";

const Query = {
  async categories() {
    try {
        const categories = await Category.find();
        return categories;
    } catch (error) {}
  },
};

const Mutation = {
  async createCategory(parent: any, args: any, context: any) {
    const { input } = args;
    const { req, res } = context;
    try {
      await auth(req, res);
      const isCategory = await Category.findOne({ name: input.name });
      if(isCategory) {
          throw new Error("");
      }
      const category = new Category({name: input.name});
      await category.save();
      return category;
    } catch (error) {
        throw new AuthenticationError("Not Authenticate");
    }
  },
};

export default { Query, Mutation };
