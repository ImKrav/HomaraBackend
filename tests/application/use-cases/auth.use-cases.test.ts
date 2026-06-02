import { describe, it, expect, vi } from "vitest";
import { RegisterUserUseCase, LoginUserUseCase, GetUserProfileUseCase } from "../../../src/application/use-cases/auth.use-cases.js";
import { User } from "../../../src/domain/entities/user.js";
import { hashPassword } from "../../../src/shared/utils/authHelper.js";
import { AppError } from "../../../src/shared/errors/AppError.js";

// Mock IUserRepository
const mockUserRepository = {
  findById: vi.fn(),
  findByEmail: vi.fn(),
  create: vi.fn(),
  update: vi.fn()
};

describe("Auth Use Cases", () => {
  describe("RegisterUserUseCase", () => {
    it("debe registrar exitosamente un nuevo usuario si el email no existe", async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);
      
      const createdUser = new User(
        "user-123",
        "test@homara.com",
        "hashed-password",
        "Alejo",
        "Kravs",
        null,
        null,
        null,
        null,
        null,
        "CUSTOMER",
        new Date(),
        new Date()
      );
      mockUserRepository.create.mockResolvedValue(createdUser);

      const useCase = new RegisterUserUseCase(mockUserRepository);
      const result = await useCase.execute({
        email: "  TEST@homara.com  ",
        password: "secretpassword",
        firstName: "Alejo",
        lastName: "Kravs"
      });

      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith("test@homara.com");
      expect(mockUserRepository.create).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.token).toBeDefined();
      expect(result.user).toEqual({
        id: "user-123",
        email: "test@homara.com",
        firstName: "Alejo",
        lastName: "Kravs",
        phone: null,
        address: null,
        city: null,
        state: null,
        zipCode: null,
        role: "CUSTOMER"
      });
    });

    it("debe registrar exitosamente un nuevo usuario con todos los campos opcionales del perfil", async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);
      
      const createdUser = new User(
        "user-123",
        "test@homara.com",
        "hashed-password",
        "Alejo",
        "Kravs",
        "300 999 8888",
        "Calle Falsa 123",
        "Medellin",
        "Antioquia",
        "050001",
        "CUSTOMER",
        new Date(),
        new Date()
      );
      mockUserRepository.create.mockResolvedValue(createdUser);

      const useCase = new RegisterUserUseCase(mockUserRepository);
      const result = await useCase.execute({
        email: "test@homara.com",
        password: "secretpassword",
        firstName: "Alejo",
        lastName: "Kravs",
        phone: "300 999 8888",
        address: "Calle Falsa 123",
        city: "Medellin",
        state: "Antioquia",
        zipCode: "050001"
      });

      expect(mockUserRepository.create).toHaveBeenCalledWith({
        email: "test@homara.com",
        password: expect.any(String),
        firstName: "Alejo",
        lastName: "Kravs",
        phone: "300 999 8888",
        address: "Calle Falsa 123",
        city: "Medellin",
        state: "Antioquia",
        zipCode: "050001",
        role: "CUSTOMER"
      });
      expect(result.user).toEqual({
        id: "user-123",
        email: "test@homara.com",
        firstName: "Alejo",
        lastName: "Kravs",
        phone: "300 999 8888",
        address: "Calle Falsa 123",
        city: "Medellin",
        state: "Antioquia",
        zipCode: "050001",
        role: "CUSTOMER"
      });
    });

    it("debe lanzar AppError 400 si el email ya existe", async () => {
      const existingUser = new User("user-existing", "test@homara.com", "hash");
      mockUserRepository.findByEmail.mockResolvedValue(existingUser);

      const useCase = new RegisterUserUseCase(mockUserRepository);

      await expect(
        useCase.execute({
          email: "test@homara.com",
          password: "password123",
          firstName: "Alejo",
          lastName: "Kravs"
        })
      ).rejects.toThrowError(
        new AppError("El correo electrónico ya está registrado.", 400)
      );
    });
  });

  describe("LoginUserUseCase", () => {
    it("debe iniciar sesión exitosamente con credenciales válidas", async () => {
      const plainPassword = "secretpassword";
      const hashedPassword = await hashPassword(plainPassword);
      const user = new User(
        "user-123",
        "test@homara.com",
        hashedPassword,
        "Alejo",
        "Kravs",
        null,
        null,
        null,
        null,
        null,
        "CUSTOMER"
      );
      mockUserRepository.findByEmail.mockResolvedValue(user);

      const useCase = new LoginUserUseCase(mockUserRepository);
      const result = await useCase.execute("  TEST@homara.com  ", plainPassword);

      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith("test@homara.com");
      expect(result).toBeDefined();
      expect(result.token).toBeDefined();
      expect(result.user).toEqual({
        id: "user-123",
        email: "test@homara.com",
        firstName: "Alejo",
        lastName: "Kravs",
        phone: null,
        address: null,
        city: null,
        state: null,
        zipCode: null,
        role: "CUSTOMER"
      });
    });

    it("debe lanzar AppError 401 si el usuario no existe", async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);

      const useCase = new LoginUserUseCase(mockUserRepository);

      await expect(
        useCase.execute("nonexistent@homara.com", "password123")
      ).rejects.toThrowError(
        new AppError("Credenciales incorrectas. Verifique correo y contraseña.", 401)
      );
    });

    it("debe lanzar AppError 401 si la contraseña no coincide", async () => {
      const hashedPassword = await hashPassword("correctpassword");
      const user = new User("user-123", "test@homara.com", hashedPassword);
      mockUserRepository.findByEmail.mockResolvedValue(user);

      const useCase = new LoginUserUseCase(mockUserRepository);

      await expect(
        useCase.execute("test@homara.com", "wrongpassword")
      ).rejects.toThrowError(
        new AppError("Credenciales incorrectas. Verifique correo y contraseña.", 401)
      );
    });
  });

  describe("GetUserProfileUseCase", () => {
    it("debe retornar el perfil si el usuario existe", async () => {
      const user = new User("user-123", "test@homara.com");
      mockUserRepository.findById.mockResolvedValue(user);

      const useCase = new GetUserProfileUseCase(mockUserRepository);
      const result = await useCase.execute("user-123");

      expect(mockUserRepository.findById).toHaveBeenCalledWith("user-123");
      expect(result).toEqual(user);
    });

    it("debe lanzar AppError 404 si el usuario no existe", async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      const useCase = new GetUserProfileUseCase(mockUserRepository);

      await expect(useCase.execute("user-999")).rejects.toThrowError(
        new AppError("Usuario no encontrado", 404)
      );
    });
  });
});
