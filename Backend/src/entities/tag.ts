import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import type { Contact } from "./contact.js";

@Entity({ name: "tags" })
export class Tag {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar" })
  name!: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @ManyToMany("Contact", (contact: Contact) => contact.tags)
  contacts!: Contact[];
}
