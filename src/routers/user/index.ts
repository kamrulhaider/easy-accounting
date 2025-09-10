import { Router } from "express";
import { loginUser } from "../../controllers/user/loginUser";

export const userRouter = Router();

userRouter.post("/login", loginUser);
