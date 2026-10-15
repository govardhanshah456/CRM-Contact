import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import request from "supertest";
import { createApp } from "../app.js";
import { AppDataSource } from "../data-source.js";

const app = createApp();

describe("crm api", { concurrency: false }, () => {
  before(async () => {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
  });

  after(async () => {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  });

  it("creates a contact and rejects a duplicate email", async () => {
    const email = `ada.${Date.now()}@example.com`;
    const created = await request(app)
      .post("/api/contacts")
      .send({ first_name: "Ada", last_name: "Lovelace", email, company: "Analytical" })
      .expect(201);

    assert.equal(created.body.first_name, "Ada");
    assert.equal(created.body.first_name_version, 1);
    assert.equal(created.body.email, email);
    assert.deepEqual(created.body.tags, []);

    const duplicate = await request(app)
      .post("/api/contacts")
      .send({ first_name: "Other", email: email.toUpperCase() })
      .expect(409);

    assert.equal(duplicate.body.error, "Email already exists");

    await request(app).delete(`/api/contacts/${created.body.id}`).expect(204);
  });

  it("rejects malformed ids, empty names, and unsupported sort fields", async () => {
    await request(app).get("/api/contacts/not-a-uuid").expect(400);
    await request(app)
      .post("/api/contacts")
      .send({ first_name: "   " })
      .expect(400);
    await request(app).get("/api/contacts?sortBy=password").expect(400);
  });

  it("updates fields independently and records activity", async () => {
    const created = await request(app)
      .post("/api/contacts")
      .send({ first_name: "Grace", last_name: "Hopper", company: "Navy" })
      .expect(201);

    const id = created.body.id as string;

    const renamed = await request(app)
      .patch(`/api/contacts/${id}`)
      .send({ first_name: "Grace M.", expectedVersions: { first_name: 1 } })
      .expect(200);

    assert.equal(renamed.body.first_name, "Grace M.");
    assert.equal(renamed.body.first_name_version, 2);
    assert.equal(renamed.body.last_name, "Hopper");
    assert.equal(renamed.body.last_name_version, 1);

    const conflict = await request(app)
      .patch(`/api/contacts/${id}`)
      .send({ first_name: "Stale", expectedVersions: { first_name: 1 } })
      .expect(409);
    assert.equal(conflict.body.error, "Contact field version conflict");

    const lastName = await request(app)
      .patch(`/api/contacts/${id}`)
      .send({ last_name: "Murray", expectedVersions: { last_name: 1 } })
      .expect(200);
    assert.equal(lastName.body.last_name, "Murray");
    assert.equal(lastName.body.last_name_version, 2);
    assert.equal(lastName.body.first_name_version, 2);

    const activities = await request(app)
      .get(`/api/contacts/${id}/activities`)
      .expect(200);
    const actions = activities.body.activities.map((activity: { action: string }) => activity.action);
    assert.ok(actions.includes("created contact"));
    assert.ok(actions.includes("updated first_name"));
    assert.ok(actions.includes("updated last_name"));

    await request(app).delete(`/api/contacts/${id}`).expect(204);
    await request(app).get(`/api/contacts/${id}`).expect(404);
  });

  it("assigns tags, skips duplicates, and lists matches", async () => {
    const tag = await request(app)
      .post("/api/tags")
      .send({ name: `cohort-${Date.now()}` })
      .expect(201);

    const first = await request(app)
      .post("/api/contacts")
      .send({
        first_name: "Searchable",
        phone: "555-867-5309",
        company: "FilterCo",
        tagIds: [tag.body.id],
      })
      .expect(201);
    const second = await request(app)
      .post("/api/contacts")
      .send({ first_name: "Searchable", company: "FilterCo" })
      .expect(201);

    await request(app)
      .patch(`/api/contacts/${second.body.id}/tags/${tag.body.id}`)
      .expect(204);
    await request(app)
      .patch(`/api/contacts/${second.body.id}/tags/${tag.body.id}`)
      .expect(204);

    const bulk = await request(app)
      .post("/api/contacts/bulk-tags")
      .send({ contactIds: [first.body.id, second.body.id], tagId: tag.body.id })
      .expect(200);
    assert.equal(bulk.body.assigned, 0);

    const listed = await request(app)
      .get("/api/contacts")
      .query({
        q: "Searchable",
        company: "filterco",
        tags: tag.body.name.toUpperCase(),
        sortBy: "created_at",
        order: "desc",
        page: 1,
        limit: 20,
      })
      .expect(200);

    assert.equal(listed.body.total, 2);
    assert.equal(listed.body.page, 1);
    assert.equal(listed.body.limit, 20);
    assert.equal(listed.body.contacts.length, 2);
    assert.ok(
      listed.body.contacts.every((contact: { tags: { id: string }[] }) =>
        contact.tags.some((item) => item.id === tag.body.id),
      ),
    );

    const byPhone = await request(app)
      .get("/api/contacts")
      .query({ q: "867-5309" })
      .expect(200);
    assert.equal(byPhone.body.total, 1);
    assert.equal(byPhone.body.contacts[0].id, first.body.id);

    const detail = await request(app).get(`/api/contacts/${first.body.id}`).expect(200);
    assert.equal(detail.body.tags[0].id, tag.body.id);

    await request(app)
      .delete(`/api/contacts/${first.body.id}/tags/${tag.body.id}`)
      .expect(204);

    const afterRemove = await request(app)
      .get(`/api/contacts/${first.body.id}/activities`)
      .expect(200);
    const actions = afterRemove.body.activities.map((activity: { action: string }) => activity.action);
    assert.ok(actions.includes(`added tag ${tag.body.name}`));
    assert.ok(actions.includes(`removed tag ${tag.body.name}`));

    await request(app).delete(`/api/contacts/${first.body.id}`).expect(204);
    await request(app).delete(`/api/contacts/${second.body.id}`).expect(204);
    await AppDataSource.getRepository("Tag").delete({ id: tag.body.id });
  });

  it("allows simultaneous updates to different fields on the same contact", async () => {
    const created = await request(app)
      .post("/api/contacts")
      .send({ first_name: "Concurrent", last_name: "Contact" })
      .expect(201);
    const id = created.body.id as string;

    const [firstName, lastName] = await Promise.all([
      request(app)
        .patch(`/api/contacts/${id}`)
        .send({ first_name: "First changed", expectedVersions: { first_name: 1 } }),
      request(app)
        .patch(`/api/contacts/${id}`)
        .send({ last_name: "Last changed", expectedVersions: { last_name: 1 } }),
    ]);

    assert.equal(firstName.status, 200);
    assert.equal(lastName.status, 200);

    const current = await request(app).get(`/api/contacts/${id}`).expect(200);
    assert.equal(current.body.first_name, "First changed");
    assert.equal(current.body.first_name_version, 2);
    assert.equal(current.body.last_name, "Last changed");
    assert.equal(current.body.last_name_version, 2);
    assert.equal(current.body.overall_version, 3);

    await request(app).delete(`/api/contacts/${id}`).expect(204);
  });

  it("allows only one simultaneous update to the same field version", async () => {
    const created = await request(app)
      .post("/api/contacts")
      .send({ first_name: "Original" })
      .expect(201);
    const id = created.body.id as string;

    const responses = await Promise.all([
      request(app)
        .patch(`/api/contacts/${id}`)
        .send({ first_name: "Writer A", expectedVersions: { first_name: 1 } }),
      request(app)
        .patch(`/api/contacts/${id}`)
        .send({ first_name: "Writer B", expectedVersions: { first_name: 1 } }),
    ]);

    assert.deepEqual(
      responses.map((response) => response.status).sort(),
      [200, 409],
    );
    assert.equal(
      responses.find((response) => response.status === 409)?.body.error,
      "Contact field version conflict",
    );

    const current = await request(app).get(`/api/contacts/${id}`).expect(200);
    assert.ok(["Writer A", "Writer B"].includes(current.body.first_name));
    assert.equal(current.body.first_name_version, 2);

    const activities = await request(app)
      .get(`/api/contacts/${id}/activities`)
      .expect(200);
    assert.equal(
      activities.body.activities.filter(
        (activity: { action: string }) => activity.action === "updated first_name",
      ).length,
      1,
    );

    await request(app).delete(`/api/contacts/${id}`).expect(204);
  });

  it("lets the database settle simultaneous duplicate email and tag creation", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const email = `race-${suffix}@example.com`;
    const tagName = `Race-${suffix}`;

    const contactResponses = await Promise.all([
      request(app).post("/api/contacts").send({ first_name: "Email A", email }),
      request(app)
        .post("/api/contacts")
        .send({ first_name: "Email B", email: email.toUpperCase() }),
    ]);
    assert.deepEqual(
      contactResponses.map((response) => response.status).sort(),
      [201, 409],
    );
    assert.equal(
      contactResponses.find((response) => response.status === 409)?.body.error,
      "Email already exists",
    );

    const [{ count: emailCount }] = await AppDataSource.query(
      `SELECT COUNT(*)::int AS count FROM contacts WHERE lower(email) = lower($1)`,
      [email],
    );
    assert.equal(emailCount, 1);

    const tagResponses = await Promise.all([
      request(app).post("/api/tags").send({ name: tagName }),
      request(app).post("/api/tags").send({ name: tagName.toLowerCase() }),
    ]);
    assert.deepEqual(
      tagResponses.map((response) => response.status).sort(),
      [201, 409],
    );
    assert.equal(
      tagResponses.find((response) => response.status === 409)?.body.error,
      "Tag name already exists",
    );

    const [{ count: tagCount }] = await AppDataSource.query(
      `SELECT COUNT(*)::int AS count FROM tags WHERE lower(name) = lower($1)`,
      [tagName],
    );
    assert.equal(tagCount, 1);

    const contactId = contactResponses.find((response) => response.status === 201)?.body.id;
    const tagId = tagResponses.find((response) => response.status === 201)?.body.id;
    await request(app).delete(`/api/contacts/${contactId}`).expect(204);
    await AppDataSource.getRepository("Tag").delete({ id: tagId });
  });

  it("deduplicates simultaneous assignment of the same tag and activity", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const contact = await request(app)
      .post("/api/contacts")
      .send({ first_name: "Tag race" })
      .expect(201);
    const tag = await request(app)
      .post("/api/tags")
      .send({ name: `tag-race-${suffix}` })
      .expect(201);

    const assignments = await Promise.all([
      request(app).patch(`/api/contacts/${contact.body.id}/tags/${tag.body.id}`),
      request(app).patch(`/api/contacts/${contact.body.id}/tags/${tag.body.id}`),
    ]);
    assert.deepEqual(
      assignments.map((response) => response.status),
      [204, 204],
    );

    const [{ count: linkCount }] = await AppDataSource.query(
      `SELECT COUNT(*)::int AS count
       FROM contact_tags
       WHERE contact_id = $1 AND tag_id = $2`,
      [contact.body.id, tag.body.id],
    );
    assert.equal(linkCount, 1);

    const [{ count: activityCount }] = await AppDataSource.query(
      `SELECT COUNT(*)::int AS count
       FROM contact_activities
       WHERE contact_id = $1 AND action = $2`,
      [contact.body.id, `added tag ${tag.body.name}`],
    );
    assert.equal(activityCount, 1);

    await request(app).delete(`/api/contacts/${contact.body.id}`).expect(204);
    await AppDataSource.getRepository("Tag").delete({ id: tag.body.id });
  });
});
