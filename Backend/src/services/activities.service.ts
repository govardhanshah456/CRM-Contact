import type { EntityManager } from "typeorm";
import { AppDataSource } from "../data-source.js";
import { ContactActivity } from "../entities/contact-activity.js";
import { Contact } from "../entities/contact.js";
import { HttpError } from "../errors.js";

export const activitiesService = {
  async list(contactId: string, limit: number): Promise<ContactActivity[]> {
    const contact = await AppDataSource.getRepository(Contact).findOne({
      where: { id: contactId },
      select: { id: true },
    });

    if (!contact) {
      throw new HttpError(404, "Contact not found");
    }

    return AppDataSource.getRepository(ContactActivity).find({
      where: { contact: { id: contactId } },
      relations: { contact: true },
      order: { createdAt: "DESC" },
      take: limit,
    });
  },
};

export async function recordActivity(
  manager: EntityManager,
  contactId: string,
  action: string,
): Promise<void> {
  await manager.query(
    `INSERT INTO contact_activities (contact_id, action) VALUES ($1, $2)`,
    [contactId, action],
  );
}
