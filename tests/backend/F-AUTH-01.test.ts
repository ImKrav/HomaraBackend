import { describe, it, expect, beforeEach } from "vitest";
import { RegisterUserUseCase } from "../../src/application/use-cases/auth.use-cases.js";
import { registerSchema } from "../../src/infrastructure/http/validators/auth.validator.js";
import { AppError } from "../../src/shared/errors/AppError.js";
import { mockUserRepository, usuario, datosRegistro } from "../_ayudas.js";

describe("F-AUTH-01 · Registro de usuario", () => {
  let repo: ReturnType<typeof mockUserRepository>;
  let caso: RegisterUserUseCase;

  beforeEach(() => {
    repo = mockUserRepository();
    caso = new RegisterUserUseCase(repo);
  });

  it("CP-F-AUTH-01-01: Rechaza contraseña corta en validación de esquema sin consultar repositorio", () => {
    const resultado = registerSchema.safeParse(datosRegistro({ password: "1234567" }));

    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.error.issues[0].message).toContain("al menos 8 caracteres");
    }
    expect(repo.findByEmail).not.toHaveBeenCalled();
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("CP-F-AUTH-01-02: Rechaza registro si el correo ya existe", async () => {
    repo.findByEmail.mockResolvedValue(usuario());

    await expect(caso.execute(datosRegistro() as any)).rejects.toThrow(AppError);
    await expect(caso.execute(datosRegistro() as any)).rejects.toThrow(
      "El correo electrónico ya está registrado."
    );
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("CP-F-AUTH-01-03: Crea la cuenta con contraseña cifrada y retorna token de sesión", async () => {
    repo.findByEmail.mockResolvedValue(null);
    repo.create.mockImplementation(async (u: any) => usuario({ ...u, id: "usr_nuevo" }));

    const salida = await caso.execute(datosRegistro() as any);

    const guardado = repo.create.mock.calls[0][0];
    expect(guardado.role).toBe("CUSTOMER");
    expect(guardado.password).not.toBe("ClaveSegura8");
    expect(guardado.password).toMatch(/^\$2[aby]\$/);
    expect(salida.token).toEqual(expect.any(String));
    expect(salida.user.email).toBe("ana@homara.com");
    expect((salida.user as any).password).toBeUndefined();
  });

  it("CP-F-AUTH-01-03b: Normaliza correo con mayúsculas y espacios y acepta contraseña de 8 caracteres", async () => {
    expect(registerSchema.safeParse(datosRegistro({ password: "12345678" })).success).toBe(true);

    repo.findByEmail.mockResolvedValue(null);
    repo.create.mockImplementation(async (u: any) => usuario({ ...u, id: "usr_nuevo" }));
    await caso.execute(datosRegistro({ email: "  ANA@HOMARA.COM  " }) as any);

    expect(repo.findByEmail).toHaveBeenCalledWith("ana@homara.com");
    expect(repo.create.mock.calls[0][0].email).toBe("ana@homara.com");
  });
});
