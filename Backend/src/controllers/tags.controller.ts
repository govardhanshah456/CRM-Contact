import type { Request, Response } from "express";
import { toTag } from "../serializers.js";
import { tagsService } from "../services/tags.service.js";
import { parseBulkTags, parseTagName, parseUuid, pathParam } from "../validation.js";

export const tagsController = {
  async create(req: Request, res: Response) {
    const tag = await tagsService.create(parseTagName(req.body));
    res.status(201).json(toTag(tag));
  },

  async list(_req: Request, res: Response) {
    const tags = await tagsService.list();
    res.json({ tags: tags.map(toTag) });
  },

  async assign(req: Request, res: Response) {
    const contactId = parseUuid(pathParam(req.params.id, "id"), "id");
    const tagId = parseUuid(pathParam(req.params.tagId, "tagId"), "tagId");
    await tagsService.assign(contactId, tagId);
    res.status(204).send();
  },

  async unassign(req: Request, res: Response) {
    const contactId = parseUuid(pathParam(req.params.id, "id"), "id");
    const tagId = parseUuid(pathParam(req.params.tagId, "tagId"), "tagId");
    await tagsService.unassign(contactId, tagId);
    res.status(204).send();
  },

  async bulkAssign(req: Request, res: Response) {
    const input = parseBulkTags(req.body);
    const assigned = await tagsService.bulkAssign(input.contactIds, input.tagId);
    res.json({ assigned, tagId: input.tagId });
  },
};
