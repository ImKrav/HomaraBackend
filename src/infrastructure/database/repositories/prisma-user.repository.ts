import { IUserRepository } from "../../../domain/repositories/user-repository.interface.js";
import { User } from "../../../domain/entities/user.js";
import { prisma } from "../prisma-client.js";

export class PrismaUserRepository implements IUserRepository {
  async findById(id: string): Promise<User | null> {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return null;
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
      user.role as any,
      user.createdAt,
      user.updatedAt
    );
  }

  async findByEmail(email: string): Promise<User | null> {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return null;
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
      user.role as any,
      user.createdAt,
      user.updatedAt
    );
  }

  async create(data: Omit<User, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<User> {
    const user = await prisma.user.create({
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
      user.role as any,
      user.createdAt,
      user.updatedAt
    );
  }

  async update(id: string, data: Partial<Omit<User, "id" | "createdAt" | "updatedAt">>): Promise<User> {
    const user = await prisma.user.update({
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
      user.role as any,
      user.createdAt,
      user.updatedAt
    );
  }
}
