// F-AUTH-02 · Inicio de sesión
// Unidad: LoginUserUseCase.execute()  (POST /api/v1/users/login)

import { test, is, ok, grab } from "./harness.js";
import { fakeUsuarios, usuario, calledWith, neverCalled } from "./helpers.js";
import { LoginUserUseCase } from "../src/application/use-cases/auth.use-cases.js";
import { loginSchema } from "../src/infrastructure/http/validators/auth.validator.js";
import { hashPassword } from "../src/shared/utils/authHelper.js";
import { AppError } from "../src/shared/errors/AppError.js";

const MENSAJE_GENERICO = "Credenciales incorrectas. Verifique correo y contraseña.";

test("CP-F-AUTH-02-01", "Rechaza correo con formato inválido antes de consultar repositorio", () => {
  const repo = fakeUsuarios();
  const r = loginSchema.safeParse({ email: "ana-sin-arroba", password: "loQueSea" });

  is(r.success, false);
  ok(neverCalled(repo.findByEmail));
});

test("CP-F-AUTH-02-02", "Rechaza credenciales cuando el correo no existe", async () => {
  const repo = fakeUsuarios();
  const caso = new LoginUserUseCase(repo as any);
  repo.findByEmail.resolves(null);

  const e = await grab(caso.execute("nadie@homara.com", "ClaveSegura8"));
  ok(e instanceof AppError);
  is(e.message, MENSAJE_GENERICO);
});

test("CP-F-AUTH-02-03", "Rechaza credenciales cuando la contraseña no coincide", async () => {
  const repo = fakeUsuarios();
  const caso = new LoginUserUseCase(repo as any);
  repo.findByEmail.resolves(usuario({ password: await hashPassword("LaCorrecta8") }));

  const e = await grab(caso.execute("ana@homara.com", "LaEquivocada8"));
  is(e.message, MENSAJE_GENERICO);
});

test("CP-F-AUTH-02-04", "Emite credencial de sesión al ingresar credenciales válidas", async () => {
  const repo = fakeUsuarios();
  const caso = new LoginUserUseCase(repo as any);
  repo.findByEmail.resolves(usuario({ password: await hashPassword("ClaveSegura8") }));

  const salida = await caso.execute("ana@homara.com", "ClaveSegura8");

  is(typeof salida.token, "string");
  is(salida.user.id, "usr_001");
  is((salida.user as any).password, undefined);
});

test("CP-F-AUTH-02-03b", "Devuelve el mismo mensaje de error para correo inexistente y clave incorrecta", async () => {
  const repo = fakeUsuarios();
  const caso = new LoginUserUseCase(repo as any);

  repo.findByEmail.resolves(null);
  const sinCorreo = await caso.execute("nadie@homara.com", "x").catch((e) => e.message);

  repo.findByEmail.resolves(usuario({ password: await hashPassword("LaCorrecta8") }));
  const claveMala = await caso.execute("ana@homara.com", "otra").catch((e) => e.message);

  is(sinCorreo, claveMala);
});

test("CP-F-AUTH-02-04b", "Normaliza correo antes de consultar", async () => {
  const repo = fakeUsuarios();
  const caso = new LoginUserUseCase(repo as any);
  repo.findByEmail.resolves(usuario({ password: await hashPassword("ClaveSegura8") }));

  await caso.execute("  ANA@HOMARA.COM  ", "ClaveSegura8");

  ok(calledWith(repo.findByEmail, "ana@homara.com"));
});
