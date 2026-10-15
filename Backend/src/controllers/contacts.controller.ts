import type { Request, Response } from "express";
import { toContact } from "../serializers.js";
import { contactsService } from "../services/contacts.service.js";
import {
  parseContactPatch,
  parseCreateContact,
  parseListContactsQuery,
  parseUuid,
  pathParam,
} from "../validation.js";

export const contactsController = {
  async create(req: Request, res: Response) {
    const contact = await contactsService.create(parseCreateContact(req.body));
    res.status(201).json(toContact(contact));
  },

  async list(req: Request, res: Response) {
    const query = parseListContactsQuery(req.query);
    const result = await contactsService.list(query);
    res.json({
      contacts: result.contacts.map(toContact),
      total: result.total,
      page: query.page,
      limit: query.limit,
    });
  },

  async get(req: Request, res: Response) {
    const id = parseUuid(pathParam(req.params.id, "id"), "id");
    res.json(toContact(await contactsService.get(id)));
  },

  async update(req: Request, res: Response) {
    const id = parseUuid(pathParam(req.params.id, "id"), "id");
    const contact = await contactsService.update(id, parseContactPatch(req.body));
    res.json(toContact(contact));
  },

  async remove(req: Request, res: Response) {
    const id = parseUuid(pathParam(req.params.id, "id"), "id");
    await contactsService.remove(id);
    res.status(204).send();
  },
};
