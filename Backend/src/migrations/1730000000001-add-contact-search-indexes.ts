import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddContactSearchIndexes1730000000001 implements MigrationInterface {
  name = "AddContactSearchIndexes1730000000001";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
    await queryRunner.query(`
      CREATE INDEX contacts_first_name_trgm_idx
      ON contacts USING gin (first_name gin_trgm_ops)
    `);
    await queryRunner.query(`
      CREATE INDEX contacts_last_name_trgm_idx
      ON contacts USING gin (last_name gin_trgm_ops)
    `);
    await queryRunner.query(`
      CREATE INDEX contacts_email_trgm_idx
      ON contacts USING gin (email gin_trgm_ops)
      WHERE email IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX contacts_phone_trgm_idx
      ON contacts USING gin (phone gin_trgm_ops)
      WHERE phone IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX contacts_company_trgm_idx
      ON contacts USING gin (company gin_trgm_ops)
      WHERE company IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX contacts_full_name_trgm_idx
      ON contacts USING gin (
        ((COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))) gin_trgm_ops
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS contacts_full_name_trgm_idx`);
    await queryRunner.query(`DROP INDEX IF EXISTS contacts_company_trgm_idx`);
    await queryRunner.query(`DROP INDEX IF EXISTS contacts_phone_trgm_idx`);
    await queryRunner.query(`DROP INDEX IF EXISTS contacts_email_trgm_idx`);
    await queryRunner.query(`DROP INDEX IF EXISTS contacts_last_name_trgm_idx`);
    await queryRunner.query(`DROP INDEX IF EXISTS contacts_first_name_trgm_idx`);
  }
}
