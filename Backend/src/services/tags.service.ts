import type { EntityManager } from "typeorm";
import { AppDataSource } from "../data-source.js";
import { Contact } from "../entities/contact.js";
import { Tag } from "../entities/tag.js";
import { HttpError, rethrowAsHttp } from "../errors.js";
import { recordActivity } from "./activities.service.js";

export const tagsService = {
  async create(name: string): Promise<Tag> {
    try {
      return await AppDataSource.getRepository(Tag).save(
        AppDataSource.getRepository(Tag).create({ name }),
      );
    } catch (error) {
      rethrowAsHttp(error);
    }
  },

  async list(): Promise<Tag[]> {
    return AppDataSource.getRepository(Tag).find({ order: { name: "ASC" } });
  },

  async assign(contactId: string, tagId: string): Promise<void> {
    try {
      await AppDataSource.transaction(async (manager) => {
        const tag = await requireTag(manager, tagId);
        await requireContact(manager, contactId);
        await assignTag(manager, [contactId], tag);
      });
    } catch (error) {
      rethrowAsHttp(error);
    }
  },

  async unassign(contactId: string, tagId: string): Promise<void> {
    await AppDataSource.transaction(async (manager) => {
      const tag = await requireTag(manager, tagId);
      await requireContact(manager, contactId);
      const [removed]: [{ contact_id: string }[], number] = await manager.query(
        `DELETE FROM contact_tags WHERE contact_id = $1 AND tag_id = $2 RETURNING contact_id`,
        [contactId, tagId],
      );

      if (removed.length === 0) {
        throw new HttpError(404, "Tag is not assigned to this contact");
      }

      await recordActivity(manager, contactId, `removed tag ${tag.name}`);
    });
  },

  async bulkAssign(contactIds: string[], tagId: string): Promise<number> {
    try {
      return await AppDataSource.transaction(async (manager) => {
        const tag = await requireTag(manager, tagId);
        const found = await manager
          .createQueryBuilder(Contact, "contact")
          .where("contact.id IN (:...contactIds)", { contactIds })
          .getCount();

        if (found !== contactIds.length) {
          throw new HttpError(404, "One or more contacts do not exist");
        }

        return assignTag(manager, contactIds, tag);
      });
    } catch (error) {
      rethrowAsHttp(error);
    }
  },
};

async function requireContact(manager: EntityManager, contactId: string): Promise<void> {
  const contact = await manager.findOne(Contact, {
    where: { id: contactId },
    select: { id: true },
  });
  if (!contact) {
    throw new HttpError(404, "Contact not found");
  }
}

async function requireTag(manager: EntityManager, tagId: string): Promise<Tag> {
  const tag = await manager.findOne(Tag, { where: { id: tagId } });
  if (!tag) {
    throw new HttpError(404, "Tag not found");
  }
  return tag;
}

async function assignTag(
  manager: EntityManager,
  contactIds: string[],
  tag: Tag,
): Promise<number> {
  const params: unknown[] = [tag.id, `added tag ${tag.name}`];
  const values = contactIds.map((contactId) => {
    params.push(contactId);
    return `($${params.length}::uuid, $1::uuid)`;
  });

  const inserted: { contact_id: string }[] = await manager.query(
    `
      WITH inserted AS (
        INSERT INTO contact_tags (contact_id, tag_id)
        VALUES ${values.join(", ")}
        ON CONFLICT (contact_id, tag_id) DO NOTHING
        RETURNING contact_id
      )
      INSERT INTO contact_activities (contact_id, action)
      SELECT contact_id, $2 FROM inserted
      RETURNING contact_id
    `,
    params,
  );

  return inserted.length;
}
