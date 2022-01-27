import auth from "../middleware/auth";
import Post from "./schema/Post";
import log from "../logger";
import GraphQLJSON from "graphql-type-json";
import { GraphQLScalarType } from "graphql";
import Category from "../Category/schema/Category";
import User from "../User/schema/User";
import { subscribe } from "graphql";
import { PubSub } from "graphql-subscriptions";
import { uploadToCloudinary, destroyCloudinary } from "../utils/cloudinary";

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

const pubsub = new PubSub();

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
  async search(parent: any, args: any) {
    const {
      input: { page, perPage, title },
    } = args;
    const start = perPage * page - perPage;
    try {
      let posts = await Post.find(
        { title: { $regex: ".*" + title + ".*" } },
        "title backgroundPic createdAt categories",
        { skip: start, limit: perPage }
      )
        .sort({ createdAt: -1 })
        .populate("categories", "name")
        .populate("createdBy", "username profilePic");
      let amount = posts.length;
      const count = Math.ceil(amount / perPage);
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
      const user = await User.findById(res.locals.user._id, "images");
      if (user._id != input.userId) {
        throw new Error("User not allowed");
      }
      const post = new Post({
        title: input.title,
        content: input.content,
        categories: input.categories,
        createdBy: input.userId,
      });
      if (input.backgroundPic !== "./background-post.jpg") {
        const result = await (<any>(
          uploadToCloudinary(input.backgroundPic, user._id)
        ));
        post.backgroundPic = result.url;
      }
      let imageBlocks = input.content.blocks
        .filter(
          (block: any) =>
            block.type === "image" &&
            block.data.file.url.includes(
              "http://res.cloudinary.com/dqvbasiry/image/upload/"
            )
        )
        .map((block: any) => block.data.file.url);
      post.images = [...imageBlocks];
      for (let image of user.images) {
        if (!imageBlocks.includes(image)) {
          destroyCloudinary(image);
        }
      }
      user.images = [""];
      await user.save();
      await post.save();
      let p = await Post.findOne(
        { _id: post._id },
        "title backgroundPic createdAt categories"
      )
        .populate("categories", "name")
        .populate("createdBy", "username profilePic");
      pubsub.publish("CREATED_POST", {
        createdPost: p,
      });
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
        "createdBy content backgroundPic images"
      );
      if (!post) {
        throw new Error("Post not found");
      }
      if (post.createdBy.toString() !== res.locals.user._id.toString()) {
        throw new Error("User not allowed");
      }
      if (post.backgroundPic !== "/background.jpg") {
        destroyCloudinary(post.backgroundPic);
      }
      for (let image of post.images) {
        destroyCloudinary(image);
      }
      await Post.findOneAndRemove({ _id: input });
      return true;
    } catch (error) {
      log.error(error.message, "Error delete post");
      throw new Error("");
    }
  },

  async deletePosts(parent: any, args: any, context: any) {
    const { req, res } = context;
    const { input } = args;
    try {
      await auth(req, res);
      for (let postId of input) {
        const post = await Post.findOne(
          { _id: postId },
          "createdBy content backgroundPic images"
        );
        if (!post) {
          continue;
        }
        if (post.createdBy.toString() !== res.locals.user._id.toString()) {
          continue;
        }
        if (post.backgroundPic !== "/background.jpg") {
          destroyCloudinary(post.backgroundPic);
        }
        for (let image of post.images) {
          destroyCloudinary(image);
        }
        await Post.findOneAndRemove({ _id: postId });
      }
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
      const user = await User.findById(res.locals.user._id, "images");
      if (user._id != input.userId) {
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
        destroyCloudinary(post.backgroundPic);
        const result = await (<any>(
          uploadToCloudinary(input.backgroundPic, user._id)
        ));
        post.backgroundPic = result.url;
      }
      let imageBlocks = input.content.blocks
        .filter(
          (block: any) =>
            block.type === "image" &&
            block.data.file.url.includes(
              "http://res.cloudinary.com/dqvbasiry/image/upload/"
            )
        )
        .map((block: any) => block.data.file.url);
      for (let image of post.images) {
        if (!imageBlocks.includes(image)) {
          destroyCloudinary(image);
        }
      }
      for (let image of user.images) {
        if (!imageBlocks.includes(image)) {
          destroyCloudinary(image);
        }
      }
      post.content = { ...input.content };
      user.images = [""];
      await user.save();
      await post.save();
      return post._id;
    } catch (error) {
      log.error(error.message, "Error publish post");
      throw new Error("");
    }
  },
};

const Subscription = {
  createdPost: {
    subscribe: () => pubsub.asyncIterator(["CREATED_POST"]),
  },
};

export default { Query, Mutation, ObjectScalar, Subscription };
