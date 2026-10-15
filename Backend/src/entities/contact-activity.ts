import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import type { Contact } from "./contact.js";

@Entity({ name: "contact_activities" })
export class ContactActivity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar" })
  action!: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @ManyToOne("Contact", (contact: Contact) => contact.activities, {
    nullable: false,
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "contact_id" })
  contact!: Contact;
}
