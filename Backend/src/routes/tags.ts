import { Router } from "express";
import { tagsController } from "../controllers/tags.controller.js";

export const tagsRouter = Router();

tagsRouter.post("/", tagsController.create);
tagsRouter.get("/", tagsController.list);
