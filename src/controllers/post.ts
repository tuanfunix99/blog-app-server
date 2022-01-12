import cloudinary from "cloudinary";
import { v4 as uuidv4 } from "uuid";
import log from "../logger";
import { Request, Response } from "express";
import auth from "../middleware/auth";
import Post from "../Post/schema/Post";

export const post = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const post = await Post.findOne({_id: id});
    post.content = JSON.stringify(post.content);
    res.status(200).send(post);
  } catch (error) {
    log.error(error.message, "Error get post");
    res.status(500).send(error.message);
  }
};

export const createPost = async (req: Request, res: Response) => {
  const { title, content, categories, userId, backgroundPic } = req.body;
  try {
    await auth(req, res);
    if (res.locals.user._id != userId) {
        throw new Error("User not allowed");
    }
    const post = new Post({
        title,
        content,
        categories,
        createdBy: userId,
    });
    if (backgroundPic !== "./background.jpg") {
        const result = await (<any>uploadToCloudinary(backgroundPic));
        post.backgroundPic = result.url;
    }
    await post.save();
    res.status(200).send(post._id);
  } catch (error) {
    log.error(error.message, "Error publish post");
    res.status(500).send(error.message);
  }
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
