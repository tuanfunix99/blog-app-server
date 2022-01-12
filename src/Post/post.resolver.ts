import auth from "../middleware/auth";
import Post from "./schema/Post";
import cloudinary from "cloudinary";
import { v4 as uuidv4 } from "uuid";
import log from "../logger";
import GraphQLJSON from 'graphql-type-json';

const JSon = GraphQLJSON;

const Query = {
  async post(parent: any, args: any) {
    const { input } = args;
    try {
      const post = await Post.findOne({_id: input});
      post.content = JSON.stringify(post.content);
      return post;
    } catch (error) {
      throw new Error("Not found");
    }
  },
  async posts() {
    try {
      let posts = await Post.find(
        {},
        "title backgroundPic createdAt categories"
      )
      .sort({ createdAt: -1 })
      .populate("categories", "name")
      .populate("createdBy", "username profilePic");
      return posts;
    } catch (error) {
      throw new Error("Not found");
    }
  },
};

const Mutation = {
  async createPost(parent: any, args: any, context: any) {
    const { req, res } = context;
    const { input } = args;
    let objectContent = <any>JSon.parseValue(input.content);
    try {
      await auth(req, res);
      if(res.locals.user._id != input.userId) {
        throw new Error("User not allowed");
      }
      const post = new Post({
        title: input.title,
        content: objectContent,
        categories: input.categories,
        createdBy: input.userId
      });
      if (input.backgroundPic !== "./background.jpg") {
        const result = await (<any>uploadToCloudinary(input.backgroundPic));
        post.backgroundPic = result.url;
      }
      await post.save();
      return post._id;
    } catch (error) {
      log.error(error.message, "Error publish post");
      throw new Error("");
    }
  },
};

const uploadToCloudinary = (image: any) => {
  return new Promise(function (resolve, reject) {
    cloudinary.v2.uploader.upload(
      image,
      { public_id: `${Date.now()}-${uuidv4()}` },
      async function (error, result) {
        if (error) {
          return reject(error);
        }
        return resolve(result);
      }
    );
  });
};

export default { Query, Mutation, JSon };
