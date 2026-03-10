import {Router} from "express";
import { registerUser } from "../controllers/user.controllers.js";
import { upload } from "../middlewares/multer.middleware.js";
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
export default router