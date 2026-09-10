import { IUserRepository } from "../../../domain/repositories/user-repository.interface.js";
import { User } from "../../../domain/entities/user.js";
import { prisma } from "../prisma-client.js";

export class PrismaUserRepository implements IUserRepository {
  constructor(private readonly db = prisma) {}

  private toEntity(user: any): User {
    return new User(
      user.id,
      user.email,
      user.password,
      user.firstName,
      user.lastName,
      user.phone,
      user.address,
      user.city,
      user.state,
      user.zipCode,
      user.role as "CUSTOMER" | "ADMIN",
      user.createdAt,
      user.updatedAt
    );
  }

  async findById(id: string): Promise<User | null> {
    const user = await this.db.user.findUnique({ where: { id } });
    if (!user) return null;
    return this.toEntity(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    const user = await this.db.user.findUnique({ where: { email } });
    if (!user) return null;
    return this.toEntity(user);
  }

  async create(data: Omit<User, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<User> {
    const user = await this.db.user.create({
      data: {
        id: data.id,
        email: data.email,
        password: data.password!,
        firstName: data.firstName!,
        lastName: data.lastName!,
        phone: data.phone,
        address: data.address,
        city: data.city,
        state: data.state,
        zipCode: data.zipCode,
        role: data.role || "CUSTOMER",
        cart: {
          create: {} // Inicializa un carrito vacío de forma atómica
        }
      }
    });

    return this.toEntity(user);
  }

  async update(id: string, data: Partial<Omit<User, "id" | "createdAt" | "updatedAt">>): Promise<User> {
    const user = await this.db.user.update({
      where: { id },
      data: {
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        address: data.address,
        city: data.city,
        state: data.state,
        zipCode: data.zipCode,
        role: data.role
      }
    });

    return this.toEntity(user);
  }
}
