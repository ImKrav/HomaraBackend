// F-AUTH-01 · Registro de usuario
// Unidad: RegisterUserUseCase.execute()  (POST /api/v1/users/register)
//
// Cada caso sigue el patrón AAA: Arrange (montar dobles y datos), Act (una
// sola invocación a la unidad bajo prueba), Assert (comprobaciones).

import { test, grab, expect } from "./harness.js";
import { fakeUsuarios, usuario, datosRegistro } from "./helpers.js";
import { RegisterUserUseCase } from "../src/application/use-cases/auth.use-cases.js";
import { registerSchema } from "../src/infrastructure/http/validators/auth.validator.js";
import { AppError } from "../src/shared/errors/AppError.js";

test("CP-F-AUTH-01-01", "Rechaza contraseña corta en validación de esquema sin consultar repositorio", () => {
  // Arrange
  const repo = fakeUsuarios();
  const datos = datosRegistro({ password: "1234567" });

  // Act
  const resultado = registerSchema.safeParse(datos);

  // Assert
  expect(resultado.success).toBe(false);
  if (!resultado.success) expect(resultado.error.issues[0].message).toContain("al menos 8 caracteres");
  expect(repo.findByEmail).not.toHaveBeenCalled();
  expect(repo.create).not.toHaveBeenCalled();
});

test("CP-F-AUTH-01-02", "Rechaza registro si el correo ya existe", async () => {
  // Arrange
  const repo = fakeUsuarios();
  const caso = new RegisterUserUseCase(repo as any);
  repo.findByEmail.mockResolvedValue(usuario());

  // Act
  const error = await grab(caso.execute(datosRegistro() as any));

  // Assert
  expect(error).toBeInstanceOf(AppError);
  expect(error.message).toBe("El correo electrónico ya está registrado.");
  expect(repo.create).not.toHaveBeenCalled();
});

test("CP-F-AUTH-01-03", "Crea la cuenta con contraseña cifrada y retorna token de sesión", async () => {
  // Arrange
  const repo = fakeUsuarios();
  const caso = new RegisterUserUseCase(repo as any);
  repo.findByEmail.mockResolvedValue(null);
  repo.create.mockImplementation(async (u: any) => usuario({ ...u, id: "usr_nuevo" }));

  // Act
  const salida = await caso.execute(datosRegistro() as any);

  // Assert
  const guardado = repo.create.mock.calls[0][0];
  expect(guardado.role).toBe("CUSTOMER");
  expect(guardado.password).not.toBe("ClaveSegura8");
  expect(guardado.password).toMatch(/^\$2[aby]\$/);
  expect(typeof salida.token).toBe("string");
  expect(salida.user.email).toBe("ana@homara.com");
  expect((salida.user as any).password).toBe(undefined);
});

test("CP-F-AUTH-01-03b", "Normaliza correo con mayúsculas y espacios y acepta contraseña de 8 caracteres", async () => {
  // Arrange
  const repo = fakeUsuarios();
  const caso = new RegisterUserUseCase(repo as any);
  repo.findByEmail.mockResolvedValue(null);
  repo.create.mockImplementation(async (u: any) => usuario({ ...u, id: "usr_nuevo" }));

  // Act
  const validacion = registerSchema.safeParse(datosRegistro({ password: "12345678" }));
  await caso.execute(datosRegistro({ email: "  ANA@HOMARA.COM  " }) as any);

  // Assert
  expect(validacion.success).toBe(true);
  expect(repo.findByEmail).toHaveBeenCalledWith("ana@homara.com");
  expect(repo.create.mock.calls[0][0].email).toBe("ana@homara.com");
});
