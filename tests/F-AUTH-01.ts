// F-AUTH-01 · Registro de usuario
// Unidad: RegisterUserUseCase.execute()  (POST /api/v1/users/register)

import { test, is, isNot, ok, matches, has, grab } from "./harness.js";
import { fakeUsuarios, usuario, datosRegistro, arg, calledWith, neverCalled } from "./helpers.js";
import { RegisterUserUseCase } from "../src/application/use-cases/auth.use-cases.js";
import { registerSchema } from "../src/infrastructure/http/validators/auth.validator.js";
import { AppError } from "../src/shared/errors/AppError.js";

test("CP-F-AUTH-01-01", "Rechaza contraseña corta en validación de esquema sin consultar repositorio", () => {
  const repo = fakeUsuarios();
  const r = registerSchema.safeParse(datosRegistro({ password: "1234567" }));

  is(r.success, false);
  if (!r.success) has(r.error.issues[0].message, "al menos 8 caracteres");
  ok(neverCalled(repo.findByEmail));
  ok(neverCalled(repo.create));
});

test("CP-F-AUTH-01-02", "Rechaza registro si el correo ya existe", async () => {
  const repo = fakeUsuarios();
  const caso = new RegisterUserUseCase(repo as any);
  repo.findByEmail.resolves(usuario());

  const e = await grab(caso.execute(datosRegistro() as any));
  ok(e instanceof AppError);
  is(e.message, "El correo electrónico ya está registrado.");
  ok(neverCalled(repo.create));
});

test("CP-F-AUTH-01-03", "Crea la cuenta con contraseña cifrada y retorna token de sesión", async () => {
  const repo = fakeUsuarios();
  const caso = new RegisterUserUseCase(repo as any);
  repo.findByEmail.resolves(null);
  repo.create.does(async (u: any) => usuario({ ...u, id: "usr_nuevo" }));

  const salida = await caso.execute(datosRegistro() as any);

  const guardado = arg(repo.create);
  is(guardado.role, "CUSTOMER");
  isNot(guardado.password, "ClaveSegura8");
  matches(guardado.password, /^\$2[aby]\$/);
  is(typeof salida.token, "string");
  is(salida.user.email, "ana@homara.com");
  is((salida.user as any).password, undefined);
});

test("CP-F-AUTH-01-03b", "Normaliza correo con mayúsculas y espacios y acepta contraseña de 8 caracteres", async () => {
  is(registerSchema.safeParse(datosRegistro({ password: "12345678" })).success, true);

  const repo = fakeUsuarios();
  const caso = new RegisterUserUseCase(repo as any);
  repo.findByEmail.resolves(null);
  repo.create.does(async (u: any) => usuario({ ...u, id: "usr_nuevo" }));

  await caso.execute(datosRegistro({ email: "  ANA@HOMARA.COM  " }) as any);

  ok(calledWith(repo.findByEmail, "ana@homara.com"));
  is(arg(repo.create).email, "ana@homara.com");
});
