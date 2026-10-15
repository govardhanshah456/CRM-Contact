import type { Request, Response } from "express";
import { toActivity } from "../serializers.js";
import { activitiesService } from "../services/activities.service.js";
import { parseLimit, parseUuid, pathParam } from "../validation.js";

export const activitiesController = {
  async list(req: Request, res: Response) {
    const contactId = parseUuid(pathParam(req.params.id, "id"), "id");
    const limit = parseLimit(req.query.limit, 20);
    const activities = await activitiesService.list(contactId, limit);
    res.json({ activities: activities.map(toActivity) });
  },
};
