import JWT from "jsonwebtoken";

async function authMiddleware (req, res, next) {
    const authHeader = req?.headers?.authorization;
    console.log("AuthHeader: ", authHeader);
    if(!authHeader || !(authHeader?.startsWith("Bearer"))) {
        return res.status(401).json({
            status: "failed",
            message: "Authentication Failed",
        });
    }

    
    try {
        const token = authHeader?.split(" ")[1];
        const userToken = JWT.verify(token, process.env.JWT_SECRET);
        req.user = {
            userId: userToken.userId,
            userEmail: userToken.userEmail,
        };

        next();
    } catch (error) {
        console.log(error);
        return res.status(401).json({
            status: "auth-failed",
            message: "Authentication Failed",
        });
    }
}

export default authMiddleware;