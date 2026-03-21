import {Router} from "express";
import { logoutUser, registerUser,loginUser } from "../controllers/user.controllers.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
const router = Router()
console.log("🔥 user.routes.js loaded");
router.route("/register").post(
    upload.fields([
        {
            name:"avatar",
            maxCount:1
        },
        {
            name:"coverImage",
            maxCount:1
        }
    ]),registerUser)
// router.post("/register", (req, res) => {
//     res.json({ test: "route working" });
// });
router.route("/login").post(loginUser)
// secured routes
router.route("/logout").post(verifyJWT,logoutUser);
router.route("/refresh-token").post(refreshAccessToken)
export default router