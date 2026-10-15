import { AppDataSource } from "./data-source.js";
import { Contact } from "./entities/contact.js";
import { Tag } from "./entities/tag.js";

const TAG_COUNT = 100;
const CONTACT_COUNT = 1000;

const firstNames = [
  "Ada", "Ben", "Chloe", "Diego", "Elena", "Farah", "Gabriel", "Hana",
  "Ivan", "Jade", "Kai", "Lila", "Mateo", "Nora", "Omar", "Priya",
  "Quinn", "Rosa", "Samir", "Tara", "Uma", "Victor", "Wendy", "Xavier",
  "Yara", "Zoe",
];

const lastNames = [
  "Adler", "Brooks", "Chen", "Diaz", "Ellis", "Foster", "Gupta", "Hansen",
  "Ibrahim", "Johansson", "Khan", "Lopez", "Meyer", "Nakamura", "Owens",
  "Patel", "Quinn", "Rossi", "Singh", "Torres", "Ueda", "Vargas", "Walsh",
  "Xu", "Young", "Zimmer",
];

const companies = [
  "Northwind", "Initech", "Hooli", "Umbrella", "Stark", "Wayne", "Globex",
  "Acme", "Soylent", "Vandelay", "Pied Piper", "Massive Dynamic",
];

const tagNames = [
  "vip", "lead", "customer", "prospect", "partner", "vendor", "churn-risk",
  "newsletter", "webinar", "trial", "enterprise", "smb", "startup",
  "renewal", "upsell", "referral", "inbound", "outbound", "priority",
  "follow-up", "demo", "proposal", "contract", "onboarding", "active",
  "inactive", "paused", "won", "lost", "nurture", "hot", "warm", "cold",
  "decision-maker", "champion", "blocker", "finance", "engineering",
  "marketing", "sales", "support", "product", "design", "operations",
  "legal", "hr", "healthcare", "finance-industry", "education", "retail",
  "saas", "ecommerce", "manufacturing", "logistics", "media", "nonprofit",
  "government", "emea", "amer", "apac", "latam", "q1", "q2", "q3", "q4",
  "conference", "event", "content", "ads", "seo", "social", "email-campaign",
  "high-value", "low-touch", "high-touch", "expansion", "at-risk",
  "advocate", "beta", "design-partner", "case-study", "invoice-due",
  "paid", "overdue", "annual", "monthly", "self-serve", "assisted",
  "new-logo", "existing", "strategic", "technical", "executive", "manager",
  "ic", "west", "east", "central", "remote", "hybrid", "office",
];

function pickTagIds(tagIds: string[]): string[] {
  const count = 3 + Math.floor(Math.random() * 2);
  const pool = [...tagIds];
  const picked: string[] = [];

  for (let i = 0; i < count; i += 1) {
    const index = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(index, 1)[0]!);
  }

  return picked;
}

await AppDataSource.initialize();

await AppDataSource.query(
  "TRUNCATE contacts, tags RESTART IDENTITY CASCADE",
);

const tagRepo = AppDataSource.getRepository(Tag);
const insertedTags = await tagRepo.insert(
  tagNames.slice(0, TAG_COUNT).map((name) => ({ name })),
);
const tagIds = insertedTags.identifiers.map((row) => row.id as string);

const contactRepo = AppDataSource.getRepository(Contact);
const contactRows = Array.from({ length: CONTACT_COUNT }, (_, index) => {
  const firstName = firstNames[index % firstNames.length]!;
  const lastName = lastNames[Math.floor(index / firstNames.length) % lastNames.length]!;
  const company = companies[index % companies.length]!;

  return {
    firstName,
    lastName,
    email: `${firstName}.${lastName}.${index + 1}@example.com`.toLowerCase(),
    phone: `555-010-${String(index + 1).padStart(4, "0")}`,
    company,
  };
});

const insertedContacts = await contactRepo.insert(contactRows);
const contactIds = insertedContacts.identifiers.map((row) => row.id as string);

const links = contactIds.flatMap((contactId) =>
  pickTagIds(tagIds).map((tagId) => ({ contactId, tagId })),
);

await AppDataSource.createQueryBuilder()
  .insert()
  .into("contact_tags")
  .values(links.map((link) => ({ contact_id: link.contactId, tag_id: link.tagId })))
  .execute();

const [{ contacts, tags, contact_tags, min_tags, max_tags }] =
  await AppDataSource.query(`
    SELECT
      (SELECT COUNT(*) FROM contacts) AS contacts,
      (SELECT COUNT(*) FROM tags) AS tags,
      (SELECT COUNT(*) FROM contact_tags) AS contact_tags,
      (SELECT MIN(tag_count) FROM (
        SELECT COUNT(*) AS tag_count FROM contact_tags GROUP BY contact_id
      ) counts) AS min_tags,
      (SELECT MAX(tag_count) FROM (
        SELECT COUNT(*) AS tag_count FROM contact_tags GROUP BY contact_id
      ) counts) AS max_tags
  `);

console.log(
  `Seeded ${contacts} contacts, ${tags} tags, ${contact_tags} links (tags per contact ${min_tags}-${max_tags})`,
);

await AppDataSource.destroy();
