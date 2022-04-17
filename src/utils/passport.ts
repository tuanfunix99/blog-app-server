const GoogleStrategy = require("passport-google-oauth20").Strategy;
const GitHubStrategy = require("passport-github").Strategy;
const passport = require("passport");
import User from "../User/schema/User";
import AuthType from "../constants/authType";
import log from "../logger";

require("dotenv").config();

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/auth/google/callback",
    },
    async function (
      accessToken: any,
      refreshToken: any,
      profile: any,
      done: any
    ) {
      try {
        const { emails } = profile;
        const user = await User.findOne({
          email: emails[0].value ?? "",
          authType: AuthType.GOOGLE,
        });
        if (user) {
          done(null, user);
        } else {
          const newUser = await User.create({
            username: `Google${profile.id}`,
            isActive: true,
            email: emails[0].value,
            authType: AuthType.GOOGLE,
          });
          done(null, newUser);
        }
      } catch (error) {
        log.error({ error: error.message });
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
        const username = "user" + profile.id;
        if (user) {
          done(null, user);
        } else {
          const newUser = await User.create({
            username: username,
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
