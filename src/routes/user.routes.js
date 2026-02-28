import {Router} from "express";
import { registerUser } from "../controllers/user.controllers.js";
const router = Router()
console.log("🔥 user.routes.js loaded");
router.route("/register").post(registerUser)
// router.post("/register", (req, res) => {
//     res.json({ test: "route working" });
// });
export default router