import auth from "../middleware/auth";
import Post from "./schema/Post";
import cloudinary from "cloudinary";
import { v4 as uuidv4 } from "uuid";
import log from "../logger";
import GraphQLJSON from "graphql-type-json";
import { GraphQLScalarType } from "graphql";
import Category from "../Category/schema/Category";

const JSon = GraphQLJSON;
const ObjectScalar = new GraphQLScalarType({
  name: "Object",
  description: "Object custom scalar type",
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
  async post(parent: any, args: any) {
    const { input } = args;
    try {
      const post = await Post.findOne({ _id: input })
        .populate("categories", "name")
        .populate("createdBy", "username profilePic");
      return post;
    } catch (error) {
      log.error(error.message, "Error get post");
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
      log.error(error.message, "Error get posts");
      throw new Error("Not found");
    }
  },
  async postsPage(parent: any, args: any) {
    const {
      input: { page, perPage },
    } = args;
    const start = perPage * page - perPage;
    try {
      let amount = await Post.count();
      const count = Math.ceil(amount / perPage);
      let posts = await Post.find(
        {},
        "title backgroundPic createdAt categories",
        { skip: start, limit: perPage }
      )
        .sort({ createdAt: -1 })
        .populate("categories", "name")
        .populate("createdBy", "username profilePic");
      return { posts, count };
    } catch (error) {
      log.error(error.message, "Error get posts");
      throw new Error("Not found");
    }
  },
  async postCategory(parent: any, args: any) {
    const {
      input: { page, perPage, cat },
    } = args;
    const start = perPage * page - perPage;
    try {
      const category = await Category.findOne({ name: cat });
      let amount = await (await Post.find({ categories: category._id })).length;
      const count = Math.ceil(amount / perPage);
      if (!category) {
        throw new Error("Not found");
      }
      let posts = await Post.find(
        { categories: category._id },
        "title backgroundPic createdAt categories",
        { skip: start, limit: perPage }
      )
        .sort({ createdAt: -1 })
        .populate("categories", "name")
        .populate("createdBy", "username profilePic");
      return { posts, count };
    } catch (error) {
      log.error(error.message, "Error get post category");
      throw new Error("Not found");
    }
  },
  async myPost(parent: any, args: any, context: any) {
    const { input } = args;
    const { req, res } = context;
    try {
      await auth(req, res);
      if (res.locals.user._id != input) {
        throw new Error("User not allow");
      }
      let posts = await Post.find(
        { createdBy: input },
        "title backgroundPic createdAt categories"
      )
        .sort({ createdAt: -1 })
        .populate("categories", "name")
        .populate("createdBy", "username profilePic");
      return posts;
    } catch (error) {
      log.error(error.message, "Error get my post");
      throw new Error("Not found");
    }
  },
};

const Mutation = {
  async createPost(parent: any, args: any, context: any) {
    const { req, res } = context;
    const { input } = args;
    try {
      await auth(req, res);
      if (res.locals.user._id != input.userId) {
        throw new Error("User not allowed");
      }
      const post = new Post({
        title: input.title,
        content: input.content,
        categories: input.categories,
        createdBy: input.userId,
      });
      if (input.backgroundPic !== "./background-post.jpg") {
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

  async deletePost(parent: any, args: any, context: any) {
    const { req, res } = context;
    const { input } = args;
    try {
      await auth(req, res);
      const post = await Post.findOne(
        { _id: input },
        "createdBy content backgroundPic"
      );
      if (!post) {
        throw new Error("Post not found");
      }
      if (post.createdBy.toString() !== res.locals.user._id.toString()) {
        throw new Error("User not allowed");
      }
      if (post.backgroundPic !== "/background.jpg") {
        const arr = post.backgroundPic.split("/");
        const public_id = arr[arr.length - 1].split(".")[0];
        destroyCloudinary(public_id);
      }
      post.content.blocks.map((block: any) => {
        if (
          block.type === "image" &&
          block.data.file.url.includes(
            "http://res.cloudinary.com/dqvbasiry/image/upload/"
          )
        ) {
          const arr = block.data.file.url.split("/");
          const public_id = arr[arr.length - 1].split(".")[0];
          destroyCloudinary(public_id);
        }
      });
      await Post.findOneAndRemove({ _id: input });
      return true;
    } catch (error) {
      log.error(error.message, "Error delete post");
      throw new Error("");
    }
  },

  async updatePost(parent: any, args: any, context: any) {
    const { req, res } = context;
    const { input } = args;
    try {
      await auth(req, res);
      if (res.locals.user._id != input.userId) {
        throw new Error("User not allowed");
      }
      const post = await Post.findById({ _id: input.postId });
      if (!post) {
        throw new Error("Post not found");
      }
      post.title = input.title;
      post.categories = [...input.categories];
      if (
        input.backgroundPic !== "./background-post.jpg" &&
        input.backgroundPic !== post.backgroundPic
      ) {
        const arr = post.backgroundPic.split("/");
        const public_id = arr[arr.length - 1].split(".")[0];
        destroyCloudinary(public_id);
        const result = await (<any>uploadToCloudinary(input.backgroundPic));
        post.backgroundPic = result.url;
      }
      let imageBlocks = input.content.blocks
        .filter((block: any) => block.type === "image")
        .map((block: any) => block.data.file.url);
      for (let block of post.content.blocks) {
        if (
          block.type === "image" &&
          block.data.file.url.includes(
            "http://res.cloudinary.com/dqvbasiry/image/upload/"
          )
        ) {
          if (!imageBlocks.includes(block.data.file.url)) {
            const arr = block.data.file.url.split("/");
            const public_id = arr[arr.length - 1].split(".")[0];
            destroyCloudinary(public_id);
          }
        }
      }
      post.content = { ...input.content };
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

const destroyCloudinary = (public_id: string) => {
  return new Promise(function (resolve, reject) {
    cloudinary.v2.uploader.destroy(public_id, function (error, result) {
      if (error) {
        return reject(error);
      }
      return resolve(result);
    });
  });
};

export default { Query, Mutation, ObjectScalar };
