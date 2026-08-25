// ============================================================================
// F-AUTH-01 · Registro de usuario — Backend
// Grafo:   01_F-AUTH-01_BACKEND_Registro_de_usuario.drawio
// Unidad:  RegisterUserUseCase.execute()  ·  POST /api/v1/users/register
// Métrica: N=15  A=16  P=2  →  V(G) = 16 − 15 + 2 = 3
// Cobertura de ruta básica: 3 caminos independientes → 3 casos de prueba
// Trazabilidad: RF01 · HU1 · ESC01 · RNF01–ESC35
// ============================================================================
import { describe, it, expect, beforeEach, vi } from "vitest";
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

  it("CP-F-AUTH-01-01 · camino 1,2,3,4,7,F · Paso 3 = NO → se rechaza en la validación sin tocar la base de datos", () => {
    // El paso 3 se evalúa en validateZod(registerSchema), antes del caso de uso.
    const resultado = registerSchema.safeParse(datosRegistro({ password: "1234567" }));

    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.error.issues[0].message).toContain("al menos 8 caracteres");
    }
    // Salida esperada: el flujo termina en el errorHandler; el repositorio nunca se consulta.
    expect(repo.findByEmail).not.toHaveBeenCalled();
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("CP-F-AUTH-01-02 · camino 1,2,3,5,6,8,9,12,F · Paso 3 = SI, Paso 8 = SI → el correo ya está registrado", async () => {
    repo.findByEmail.mockResolvedValue(usuario());               // fuerza Paso 8 = SI

    await expect(caso.execute(datosRegistro() as any)).rejects.toThrow(AppError);
    await expect(caso.execute(datosRegistro() as any)).rejects.toThrow(
      "El correo electrónico ya está registrado."
    );
    // Salida esperada: no se crea el usuario.
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("CP-F-AUTH-01-03 · camino 1,2,3,5,6,8,10,11,13,14,F · Paso 3 = SI, Paso 8 = NO → la cuenta se crea y la sesión queda iniciada", async () => {
    repo.findByEmail.mockResolvedValue(null);                    // fuerza Paso 8 = NO
    repo.create.mockImplementation(async (u: any) => usuario({ ...u, id: "usr_nuevo" }));

    const salida = await caso.execute(datosRegistro() as any);

    // Nodo 11: se guarda con rol CUSTOMER y la contraseña cifrada (nodo 10).
    const guardado = repo.create.mock.calls[0][0];
    expect(guardado.role).toBe("CUSTOMER");
    expect(guardado.password).not.toBe("ClaveSegura8");
    expect(guardado.password).toMatch(/^\$2[aby]\$/);
    // Nodos 13 y 14: se emite el token y se devuelve el usuario.
    expect(salida.token).toEqual(expect.any(String));
    expect(salida.user.email).toBe("ana@homara.com");
    expect((salida.user as any).password).toBeUndefined();
  });

  it("CP-F-AUTH-01-03b · valor límite y normalización sobre el camino exitoso", async () => {
    // Complementa el camino 3: contraseña de 8 caracteres exactos y correo con mayúsculas.
    expect(registerSchema.safeParse(datosRegistro({ password: "12345678" })).success).toBe(true);

    repo.findByEmail.mockResolvedValue(null);
    repo.create.mockImplementation(async (u: any) => usuario({ ...u, id: "usr_nuevo" }));
    await caso.execute(datosRegistro({ email: "  ANA@HOMARA.COM  " }) as any);

    // Nodo 5: el correo se normaliza antes de consultar y de guardar.
    expect(repo.findByEmail).toHaveBeenCalledWith("ana@homara.com");
    expect(repo.create.mock.calls[0][0].email).toBe("ana@homara.com");
  });
});
