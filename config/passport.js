import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";

const googleConfigured =
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_CALLBACK_URL;

if (googleConfigured) {
    passport.use(
        new GoogleStrategy(
            {
                clientID: process.env.GOOGLE_CLIENT_ID,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                callbackURL: process.env.GOOGLE_CALLBACK_URL
            },
            async (
                accessToken,
                refreshToken,
                profile,
                done
            ) => {
                try {
                    const rawEmail = profile.emails?.[0]?.value || profile._json?.email;
                    const email = rawEmail ? rawEmail.trim().toLowerCase() : null;

                    const profileImage =
                        profile.photos?.[0]?.value || profile._json?.picture || null;

                    const name =
                        profile.displayName ||
                        (profile.name?.givenName ? `${profile.name.givenName} ${profile.name.familyName || ''}`.trim() : null) ||
                        (email ? email.split('@')[0] : 'Collector');

                    return done(null, {
                        provider: "google",
                        providerId: profile.id,
                        name,
                        email,
                        profileImage
                    });
                } catch (error) {
                    return done(error, null);
                }
            }
        )
    );
} else {
    console.warn(
        "Google OAuth is not configured. Google login is disabled."
    );
}

export default passport;
