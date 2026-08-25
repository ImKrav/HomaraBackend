// ============================================================================
// F-AUTH-02 · Inicio de sesión — Backend
// Grafo:   03_F-AUTH-02_BACKEND_Inicio_de_sesion.drawio
// Unidad:  LoginUserUseCase.execute()  ·  POST /api/v1/users/login
// Métrica: N=17  A=19  P=3  →  V(G) = 19 − 17 + 2 = 4
// Cobertura de ruta básica: 4 caminos independientes → 4 casos de prueba
// Trazabilidad: RF02 · HU2 · ESC02 · RNF01–ESC35
// ============================================================================
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

  it("CP-F-AUTH-02-01 · camino 1,2,3,4,7,F · Paso 3 = NO → correo con formato inválido se rechaza antes de consultar", () => {
    const resultado = loginSchema.safeParse({ email: "ana-sin-arroba", password: "loQueSea" });

    expect(resultado.success).toBe(false);
    expect(repo.findByEmail).not.toHaveBeenCalled();
  });

  it("CP-F-AUTH-02-02 · camino 1,2,3,5,6,8,9,12,F · Paso 3 = SI, Paso 8 = NO → el correo no existe", async () => {
    repo.findByEmail.mockResolvedValue(null);                    // fuerza Paso 8 = NO

    await expect(caso.execute("nadie@homara.com", "ClaveSegura8")).rejects.toThrow(AppError);
    await expect(caso.execute("nadie@homara.com", "ClaveSegura8")).rejects.toThrow(MENSAJE_GENERICO);
  });

  it("CP-F-AUTH-02-03 · camino 1,2,3,5,6,8,10,11,13,16,F · Paso 8 = SI, Paso 11 = NO → la contraseña no coincide", async () => {
    repo.findByEmail.mockResolvedValue(usuario({ password: await hashPassword("LaCorrecta8") }));

    await expect(caso.execute("ana@homara.com", "LaEquivocada8")).rejects.toThrow(MENSAJE_GENERICO);
  });

  it("CP-F-AUTH-02-04 · camino 1,2,3,5,6,8,10,11,14,15,F · Paso 8 = SI, Paso 11 = SI → se emite la credencial de sesión", async () => {
    repo.findByEmail.mockResolvedValue(usuario({ password: await hashPassword("ClaveSegura8") }));

    const salida = await caso.execute("ana@homara.com", "ClaveSegura8");

    expect(salida.token).toEqual(expect.any(String));
    expect(salida.user.id).toBe("usr_001");
    expect((salida.user as any).password).toBeUndefined();
  });

  it("CP-F-AUTH-02-03b · RNF de seguridad: los nodos 9 y 13 devuelven el mismo mensaje", async () => {
    // El atacante no puede distinguir 'correo inexistente' de 'contraseña incorrecta'.
    repo.findByEmail.mockResolvedValue(null);
    const sinCorreo = await caso.execute("nadie@homara.com", "x").catch((e) => e.message);

    repo.findByEmail.mockResolvedValue(usuario({ password: await hashPassword("LaCorrecta8") }));
    const claveMala = await caso.execute("ana@homara.com", "otra").catch((e) => e.message);

    expect(sinCorreo).toBe(claveMala);
  });

  it("CP-F-AUTH-02-04b · nodo 5: el correo se normaliza antes de consultar", async () => {
    repo.findByEmail.mockResolvedValue(usuario({ password: await hashPassword("ClaveSegura8") }));
    await caso.execute("  ANA@HOMARA.COM  ", "ClaveSegura8");

    expect(repo.findByEmail).toHaveBeenCalledWith("ana@homara.com");
  });
});
