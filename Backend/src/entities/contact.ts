import {
  Column,
  CreateDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import type { ContactActivity } from "./contact-activity.js";
import type { Tag } from "./tag.js";

@Entity({ name: "contacts" })
export class Contact {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "first_name", type: "varchar", nullable: true })
  firstName!: string | null;

  @Column({ name: "first_name_version", type: "int", default: 1 })
  firstNameVersion!: number;

  @Column({ name: "last_name", type: "varchar", nullable: true })
  lastName!: string | null;

  @Column({ name: "last_name_version", type: "int", default: 1 })
  lastNameVersion!: number;

  @Column({ type: "varchar", nullable: true })
  email!: string | null;

  @Column({ name: "email_version", type: "int", default: 1 })
  emailVersion!: number;

  @Column({ type: "varchar", nullable: true })
  phone!: string | null;

  @Column({ name: "phone_version", type: "int", default: 1 })
  phoneVersion!: number;

  @Column({ type: "varchar", nullable: true })
  company!: string | null;

  @Column({ name: "company_version", type: "int", default: 1 })
  companyVersion!: number;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;

  @Column({ name: "overall_version", type: "int", default: 1 })
  overallVersion!: number;

  @ManyToMany("Tag", (tag: Tag) => tag.contacts)
  @JoinTable({
    name: "contact_tags",
    joinColumn: { name: "contact_id", referencedColumnName: "id" },
    inverseJoinColumn: { name: "tag_id", referencedColumnName: "id" },
  })
  tags!: Tag[];

  @OneToMany("ContactActivity", (activity: ContactActivity) => activity.contact)
  activities!: ContactActivity[];
}
