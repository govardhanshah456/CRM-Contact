import { Router } from "express";
import { activitiesController } from "../controllers/activities.controller.js";
import { contactsController } from "../controllers/contacts.controller.js";
import { tagsController } from "../controllers/tags.controller.js";

export const contactsRouter = Router();

contactsRouter.post("/", contactsController.create);
contactsRouter.get("/", contactsController.list);
contactsRouter.post("/bulk-tags", tagsController.bulkAssign);
contactsRouter.get("/:id", contactsController.get);
contactsRouter.patch("/:id", contactsController.update);
contactsRouter.delete("/:id", contactsController.remove);
contactsRouter.patch("/:id/tags/:tagId", tagsController.assign);
contactsRouter.delete("/:id/tags/:tagId", tagsController.unassign);
contactsRouter.get("/:id/activities", activitiesController.list);
