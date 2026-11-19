import { verifyToken } from "../utils/generateToken.js";

export const isGuest = (req, res, next) => {
    res.setHeader(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
    );
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Surrogate-Control", "no-store");

    try {
        const token = req.cookies?.token;

        if (token) {
            const decoded = verifyToken(token);

            if (decoded?.userId || decoded?._id) {
                const rawRedirect = req.query.redirect;
                const safeRedirect = (typeof rawRedirect === "string" && rawRedirect.startsWith("/") && !rawRedirect.startsWith("//"))
                    ? rawRedirect
                    : "/";
                return res.redirect(safeRedirect);
            }
        }
    } catch (error) {
        if (res.clearCookie) {
            res.clearCookie("token", { path: "/", httpOnly: true, sameSite: "lax" });
        }
    }
    next();
};
