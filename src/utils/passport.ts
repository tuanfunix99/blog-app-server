const GoogleStrategy = require("passport-google-oauth20").Strategy;
const GitHubStrategy = require("passport-github2").Strategy;
const passport = require("passport");
import User from "../User/schema/User";

require("dotenv").config();

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/auth/google/callback",
      proxy: true,
    },
    async function (
      accessToken: any,
      refreshToken: any,
      profile: any,
      done: any
    ) {
      try {
        const id = profile.id + "gg";
        const user = await User.findOne({ passportId: id });
        const email = id + "@blog.com";
        const username = profile.name.givenName + profile.name.familyName;
        if (user) {
          done(null, user);
        } else {
          const newUser = await User.create({
            username: username.trim(),
            isActive: true,
            passportId: id,
            email: email,
          });
          done(null, newUser);
        }
      } catch (error) {
        console.log(error.message);
        if (error.name === "MongoServerError" && error.code === 11000) {
          //"Your email address has been already used. Please try login again."
        } else {
          //"Error system. Please try login again."
        }
      }
    }
  )
);

passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: "/auth/github/callback",
      proxy: true,
    },
    async function (
      accessToken: any,
      refreshToken: any,
      profile: any,
      done: any
    ) {
      try {
        const id = profile.id + "gh";
        const user = await User.findOne({ passportId: id });
        const email = id + "@blog.com";
        if (user) {
          done(null, user);
        } else {
          const newUser = await User.create({
            username: profile.username,
            isActive: true,
            passportId: id,
            email: email,
          });
          done(null, newUser);
        }
      } catch (error) {
        console.log(error.message);
        if (error.name === "MongoServerError" && error.code === 11000) {
          //"Your email address has been already used. Please try login again."
        } else {
          //"Error system. Please try login again."
        }
      }
    }
  )
);

passport.serializeUser((user: any, done: any) => {
  done(null, user._id);
});

passport.deserializeUser(async (userId: any, done: any) => {
  const user = await User.findById(userId);
  done(null, user);
});
