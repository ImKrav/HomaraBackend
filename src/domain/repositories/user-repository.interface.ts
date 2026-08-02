import { User } from "../entities/user.js";

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(user: Omit<User, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<User>;
  update(id: string, user: Partial<Omit<User, "id" | "createdAt" | "updatedAt">>): Promise<User>;
}
