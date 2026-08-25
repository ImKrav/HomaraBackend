import { describe, it, expect, beforeEach } from "vitest";
import { LoginUserUseCase } from "../../src/application/use-cases/auth.use-cases.js";
import { loginSchema } from "../../src/infrastructure/http/validators/auth.validator.js";
import { hashPassword } from "../../src/shared/utils/authHelper.js";
import { AppError } from "../../src/shared/errors/AppError.js";
import { mockUserRepository, usuario } from "../_ayudas.js";

const MENSAJE_GENERICO = "Credenciales incorrectas. Verifique correo y contraseña.";

describe("F-AUTH-02 · Inicio de sesión", () => {
  let repo: ReturnType<typeof mockUserRepository>;
  let caso: LoginUserUseCase;

  beforeEach(() => {
    repo = mockUserRepository();
    caso = new LoginUserUseCase(repo);
  });

  it("CP-F-AUTH-02-01: Rechaza correo con formato inválido antes de consultar repositorio", () => {
    const resultado = loginSchema.safeParse({ email: "ana-sin-arroba", password: "loQueSea" });

    expect(resultado.success).toBe(false);
    expect(repo.findByEmail).not.toHaveBeenCalled();
  });

  it("CP-F-AUTH-02-02: Rechaza credenciales cuando el correo no existe", async () => {
    repo.findByEmail.mockResolvedValue(null);

    await expect(caso.execute("nadie@homara.com", "ClaveSegura8")).rejects.toThrow(AppError);
    await expect(caso.execute("nadie@homara.com", "ClaveSegura8")).rejects.toThrow(MENSAJE_GENERICO);
  });

  it("CP-F-AUTH-02-03: Rechaza credenciales cuando la contraseña no coincide", async () => {
    repo.findByEmail.mockResolvedValue(usuario({ password: await hashPassword("LaCorrecta8") }));

    await expect(caso.execute("ana@homara.com", "LaEquivocada8")).rejects.toThrow(MENSAJE_GENERICO);
  });

  it("CP-F-AUTH-02-04: Emite credencial de sesión al ingresar credenciales válidas", async () => {
    repo.findByEmail.mockResolvedValue(usuario({ password: await hashPassword("ClaveSegura8") }));

    const salida = await caso.execute("ana@homara.com", "ClaveSegura8");

    expect(salida.token).toEqual(expect.any(String));
    expect(salida.user.id).toBe("usr_001");
    expect((salida.user as any).password).toBeUndefined();
  });

  it("CP-F-AUTH-02-03b: Devuelve el mismo mensaje de error para correo inexistente y clave incorrecta", async () => {
    repo.findByEmail.mockResolvedValue(null);
    const sinCorreo = await caso.execute("nadie@homara.com", "x").catch((e) => e.message);

    repo.findByEmail.mockResolvedValue(usuario({ password: await hashPassword("LaCorrecta8") }));
    const claveMala = await caso.execute("ana@homara.com", "otra").catch((e) => e.message);

    expect(sinCorreo).toBe(claveMala);
  });

  it("CP-F-AUTH-02-04b: Normaliza correo antes de consultar", async () => {
    repo.findByEmail.mockResolvedValue(usuario({ password: await hashPassword("ClaveSegura8") }));
    await caso.execute("  ANA@HOMARA.COM  ", "ClaveSegura8");

    expect(repo.findByEmail).toHaveBeenCalledWith("ana@homara.com");
  });
});
