// ============================================
// Homara — Authentication Use Cases (TS)
// ============================================

import { IUserRepository } from "../../domain/repositories/user-repository.interface.js";
import { User } from "../../domain/entities/user.js";
import { hashPassword, comparePassword, generateToken } from "../../shared/utils/authHelper.js";
import { AppError } from "../../shared/errors/AppError.js";

export class RegisterUserUseCase {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(data: Omit<User, "id" | "role" | "createdAt" | "updatedAt">) {
    const normalizedEmail = data.email.toLowerCase().trim();

    // Validar si el email ya existe
    const existingUser = await this.userRepository.findByEmail(normalizedEmail);
    if (existingUser) {
      throw new AppError("El correo electrónico ya está registrado.", 400);
    }

    // Encriptar contraseña
    const hashedPassword = await hashPassword(data.password!);

    // Guardar usuario
    const user = await this.userRepository.create({
      ...data,
      email: normalizedEmail,
      password: hashedPassword,
      role: "CUSTOMER",
    });

    // Firmar token
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role!,
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }
}

export class LoginUserUseCase {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(email: string, password: string) {
    const normalizedEmail = email.toLowerCase().trim();

    const user = await this.userRepository.findByEmail(normalizedEmail);
    if (!user) {
      throw new AppError("Credenciales incorrectas. Verifique correo y contraseña.", 401);
    }

    const isMatch = await comparePassword(password, user.password!);
    if (!isMatch) {
      throw new AppError("Credenciales incorrectas. Verifique correo y contraseña.", 401);
    }

    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role!,
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }
}

export class GetUserProfileUseCase {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(id: string) {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new AppError("Usuario no encontrado", 404);
    }
    return user;
  }
}
