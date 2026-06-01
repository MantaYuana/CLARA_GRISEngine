import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import jwt from "jsonwebtoken";
import { upsertUser } from "../services/user/userService";

const GOOGLE_CLIENT_ID =
    process.env.GOOGLE_CLIENT_ID ??
    process.env.OAUTH_GOOGLE_CLIENT_ID ??
    "";

const GOOGLE_CLIENT_SECRET =
    process.env.GOOGLE_CLIENT_SECRET ??
    process.env.OAUTH_GOOGLE_CLIENT_SECRET ??
    "";

const GOOGLE_CALLBACK_URL =
    process.env.GOOGLE_CALLBACK_URL ??
    "http://localhost:3001/api/v1/auth/google/callback";

const JWT_SECRET = process.env.JWT_SECRET ?? "change_me_in_production";

passport.use(
    new GoogleStrategy(
        {
            clientID: GOOGLE_CLIENT_ID,
            clientSecret: GOOGLE_CLIENT_SECRET,
            callbackURL: GOOGLE_CALLBACK_URL, // ✅ pakai absolute URL
        },
        async (_accessToken, _refreshToken, profile, done) => {
            try {
                const email =
                    profile.emails?.[0]?.value ?? `${profile.id}@google.com`;
                const name = profile.displayName ?? email;

                const user = await upsertUser(profile.id, email, name);

                const token = jwt.sign(
                    { userId: user.id, email: user.email, name: user.name },
                    JWT_SECRET,
                    { expiresIn: "24h" }
                );

                const authUser: Express.User & { token: string } = {
                    userId: user.id,
                    email: user.email,
                    name: user.name,
                    token,
                };
                done(null, authUser);
            } catch (err) {
                done(err as Error);
            }
        }
    )
);

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj as Express.User));

export { passport as configuredPassport };