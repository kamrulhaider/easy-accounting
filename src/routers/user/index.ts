import { Router } from "express";
import { loginUser } from "../../controllers/user/loginUser";
import { getUserProfile } from "../../controllers/user/getUserProfile";
import { changePassword } from "../../controllers/user/changePassword";

export const userRouter = Router();

userRouter.post("/login", loginUser);
userRouter.get("/me", getUserProfile);
userRouter.post("/change-password", changePassword);
