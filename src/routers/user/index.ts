import { Router } from "express";
import { loginUser } from "../../controllers/user/loginUser";
import { getUserProfile } from "../../controllers/user/getUserProfile";
import { changePassword } from "../../controllers/user/changePassword";
import { updateOwnProfile } from "../../controllers/user/updateOwnProfile";

export const userRouter = Router();

userRouter.post("/login", loginUser);
userRouter.get("/me", getUserProfile);
userRouter.post("/change-password", changePassword);
userRouter.patch("/me", updateOwnProfile);
