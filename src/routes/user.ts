import User from "../User/schema/User";
import { Router } from "express";
import passport from "passport";
import auth from "../middleware/auth";
import { uploadToCloudinary } from "../utils/cloudinary";
import log from "../logger";
import { socialAuth } from "../utils/socialProvidersAuth";
let token = "";

const router = Router();

router.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile"] })
);

router.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/api/passport/failure" }),
  async function (req, res, next) {
    token = await socialAuth(req, res);
    res.redirect(process.env.HTTP_LINK_FRONT_END);
  }
);

router.get(
  "/auth/github",
  passport.authenticate("github", { scope: ["user:email"] })
);

router.get(
  "/auth/github/callback",
  passport.authenticate("github", { failureRedirect: "/api/passport/failure" }),
  async function (req, res) {
    token = await socialAuth(req, res);
    res.redirect(process.env.HTTP_LINK_FRONT_END);
  }
);

router.get("/api/passport/success", async (req, res) => {
  try {
    if(token.trim() !== ""){
      res.status(200).send({ token: token });
      token = "";
    }
    else{
      throw new Error("Can't not access");
    }
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

router.get("/api/passport/failure", (req, res) => {
  res.send("Login Failed");
});

router.get("/api/passport/logout", (req, res) => {
  req.logOut();
  req.logout();
  res.send("success");
});

router.post("/api/upload-file", async (req, res) => {
  try {
    await auth(req, res);
    const user = await User.findById(res.locals.user._id, "images");
    let encoded = "";
    if (req.file.mimetype === "image/gif") {
      encoded = "data:image/gif;base64," + req.file.buffer.toString("base64");
    } else {
      encoded = "data:image/png;base64," + req.file.buffer.toString("base64");
    }
    const result = await (<any>uploadToCloudinary(encoded, user._id));

    user.images.push(result.url);
    await user.save();
    res.status(200).send(result.url);
  } catch (error) {
    log.error(error.message, "Error uploading");
    res.status(500).send(error.message);
  }
});

router.post("/api/fetch-url", async (req, res) => {
  try {
    await auth(req, res);
    if (!req.body.url) {
      throw new Error("Url not found");
    }
    res.status(200).send(req.body.url);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

export default router;
