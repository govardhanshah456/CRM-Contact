# CRM Contact API

Node.js, Express, TypeScript, TypeORM, and PostgreSQL.

## Setup

```bash
npm install
npm run dev
npm run seed
npm test
```

Copy `.env.example` to `.env` to override the database connection. The server runs pending migrations on startup. `npm run seed` loads 1000 contacts and 100 tags, replacing existing contacts and tags.

## Contacts

`POST /api/contacts`

```json
{
  "first_name": "Ansh",
  "last_name": "Shah",
  "email": "ansh@example.com",
  "phone": "555",
  "company": "Google",
  "tagIds": []
}
```

`GET /api/contacts?q=ansh&company=Google&tags=VIP&page=1&limit=20&sortBy=created_at&order=desc`

Sort fields: `name`, `company`, `created_at`, `updated_at`.

The list response is `{ contacts, total, page, limit }`. Contact objects include each field version and `tags`.

`GET /api/contacts/:id`

`PATCH /api/contacts/:id`

```json
{
  "first_name": "Ansh",
  "expectedVersions": {
    "first_name": 2
  }
}
```

Only supplied fields change. A stale field version returns `409`. A duplicate email returns `409`.

`DELETE /api/contacts/:id`

## Tags

`POST /api/tags` with `{ "name": "VIP" }`

`GET /api/tags`

`PATCH /api/contacts/:id/tags/:tagId` assigns a tag.

`DELETE /api/contacts/:id/tags/:tagId` removes it.

`POST /api/contacts/bulk-tags`

```json
{
  "contactIds": ["uuid-1", "uuid-2"],
  "tagId": "uuid-4"
}
```

Bulk assignment is one transaction. The join table primary key ignores duplicates.

## Activities

`GET /api/contacts/:id/activities`

Activities are written by the server when a contact is created, a field is updated, or a tag is added or removed.
