import type { MigrationInterface, QueryRunner } from "typeorm";

export class InitSchema1730000000000 implements MigrationInterface {
  name = "InitSchema1730000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE tags (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name varchar NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX tags_name_lower_unique ON tags (lower(name))
    `);

    await queryRunner.query(`
      CREATE TABLE contacts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        first_name varchar,
        first_name_version integer NOT NULL DEFAULT 1,
        last_name varchar,
        last_name_version integer NOT NULL DEFAULT 1,
        email varchar,
        email_version integer NOT NULL DEFAULT 1,
        phone varchar,
        phone_version integer NOT NULL DEFAULT 1,
        company varchar,
        company_version integer NOT NULL DEFAULT 1,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        overall_version integer NOT NULL DEFAULT 1
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX contacts_email_lower_unique
      ON contacts (lower(email))
      WHERE email IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE TABLE contact_tags (
        contact_id uuid NOT NULL REFERENCES contacts (id) ON DELETE CASCADE,
        tag_id uuid NOT NULL REFERENCES tags (id) ON DELETE CASCADE,
        PRIMARY KEY (contact_id, tag_id)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE contact_activities (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        contact_id uuid NOT NULL REFERENCES contacts (id) ON DELETE CASCADE,
        action varchar NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX contact_activities_contact_created_idx
      ON contact_activities (contact_id, created_at DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS contact_activities CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS contact_tags CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS contacts CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS tags CASCADE`);
  }
}
