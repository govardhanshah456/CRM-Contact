import { In, type EntityManager } from "typeorm";
import { AppDataSource } from "../data-source.js";
import { Contact } from "../entities/contact.js";
import { Tag } from "../entities/tag.js";
import { HttpError, rethrowAsHttp } from "../errors.js";
import { recordActivity } from "./activities.service.js";
import {
  CONTACT_FIELDS,
  type ContactPatch,
  type CreateContactInput,
  type ListContactsQuery,
} from "../validation.js";

export const contactsService = {
  async create(input: CreateContactInput): Promise<Contact> {
    try {
      return await AppDataSource.transaction(async (manager) => {
        const tags = await loadTags(manager, input.tagIds);
        const contact = manager.create(Contact, {
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          phone: input.phone,
          company: input.company,
          firstNameVersion: 1,
          lastNameVersion: 1,
          emailVersion: 1,
          phoneVersion: 1,
          companyVersion: 1,
          overallVersion: 1,
          tags,
        });
        const saved = await manager.save(contact);
        await recordActivity(manager, saved.id, "created contact");
        for (const tag of tags) {
          await recordActivity(manager, saved.id, `added tag ${tag.name}`);
        }
        return saved;
      });
    } catch (error) {
      rethrowAsHttp(error);
    }
  },

  async list(query: ListContactsQuery): Promise<{ contacts: Contact[]; total: number }> {
    const filtered = AppDataSource.getRepository(Contact)
      .createQueryBuilder("contact");

    if (query.q) {
      filtered.andWhere(
        `(contact.first_name ILIKE :q ESCAPE '\\' OR contact.last_name ILIKE :q ESCAPE '\\' OR contact.email ILIKE :q ESCAPE '\\' OR contact.phone ILIKE :q ESCAPE '\\' OR contact.company ILIKE :q ESCAPE '\\' OR (COALESCE(contact.first_name, '') || ' ' || COALESCE(contact.last_name, '')) ILIKE :q ESCAPE '\\')`,
        { q: likePattern(query.q) },
      );
    }

    if (query.company) {
      filtered.andWhere("LOWER(contact.company) = :company", {
        company: query.company.toLowerCase(),
      });
    }

    if (query.tags.length > 0) {
      filtered.andWhere(
        `contact.id IN (
          SELECT contact_tag.contact_id
          FROM contact_tags contact_tag
          INNER JOIN tags tag ON tag.id = contact_tag.tag_id
          WHERE lower(tag.name) IN (:...tagNames)
          GROUP BY contact_tag.contact_id
          HAVING COUNT(DISTINCT lower(tag.name)) = :tagCount
        )`,
        {
          tagNames: query.tags.map((tag) => tag.toLowerCase()),
          tagCount: query.tags.length,
        },
      );
    }

    const total = await filtered.clone().getCount();

    if (query.sortBy === "name") {
      filtered
        .orderBy("contact.lastName", query.order)
        .addOrderBy("contact.firstName", query.order);
    } else if (query.sortBy === "company") {
      filtered.orderBy("contact.company", query.order);
    } else if (query.sortBy === "updated_at") {
      filtered.orderBy("contact.updatedAt", query.order);
    } else {
      filtered.orderBy("contact.createdAt", query.order);
    }

    filtered.addOrderBy("contact.id", "ASC");

    const page = await filtered
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getMany();

    if (page.length === 0) {
      return { contacts: [], total };
    }

    const ids = page.map((contact) => contact.id);
    const withTags = await AppDataSource.getRepository(Contact).find({
      where: { id: In(ids) },
      relations: { tags: true },
    });
    const byId = new Map(withTags.map((contact) => [contact.id, contact]));

    return {
      contacts: ids.map((id) => byId.get(id)!),
      total,
    };
  },

  async get(id: string): Promise<Contact> {
    const contact = await AppDataSource.getRepository(Contact).findOne({
      where: { id },
      relations: { tags: true },
    });

    if (!contact) {
      throw new HttpError(404, "Contact not found");
    }

    return contact;
  },

  async update(id: string, patch: ContactPatch): Promise<Contact> {
    try {
      return await AppDataSource.transaction(async (manager) => {
        const sets = ["overall_version = overall_version + 1", "updated_at = NOW()"];
        const params: unknown[] = [id];
        const checks = ["id = $1"];

        for (const field of Object.keys(patch.values) as (keyof typeof patch.values)[]) {
          const mapping = CONTACT_FIELDS[field];
          params.push(patch.values[field]);
          sets.unshift(`${mapping.column} = $${params.length}`);
          sets.unshift(`${mapping.versionColumn} = ${mapping.versionColumn} + 1`);
          params.push(patch.expectedVersions[field]);
          checks.push(`${mapping.versionColumn} = $${params.length}`);
        }

        const [rows]: [{ id: string }[], number] = await manager.query(
          `UPDATE contacts SET ${sets.join(", ")} WHERE ${checks.join(" AND ")} RETURNING id`,
          params,
        );

        if (rows.length === 0) {
          const existing = await manager.findOne(Contact, {
            where: { id },
            select: { id: true },
          });
          if (!existing) {
            throw new HttpError(404, "Contact not found");
          }
          throw new HttpError(409, "Contact field version conflict");
        }

        const changed = Object.keys(patch.values).join(", ");
        await recordActivity(manager, id, `updated ${changed}`);

        const contact = await manager.findOne(Contact, {
          where: { id },
          relations: { tags: true },
        });

        if (!contact) {
          throw new HttpError(404, "Contact not found");
        }

        return contact;
      });
    } catch (error) {
      rethrowAsHttp(error);
    }
  },

  async remove(id: string): Promise<void> {
    const result = await AppDataSource.getRepository(Contact).delete({ id });
    if (!result.affected) {
      throw new HttpError(404, "Contact not found");
    }
  },
};

async function loadTags(manager: EntityManager, tagIds: string[]): Promise<Tag[]> {
  if (tagIds.length === 0) {
    return [];
  }

  const tags = await manager.find(Tag, { where: { id: In(tagIds) } });
  if (tags.length !== tagIds.length) {
    throw new HttpError(400, "One or more tagIds do not exist");
  }
  return tags;
}

function likePattern(value: string): string {
  return `%${value.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
}
