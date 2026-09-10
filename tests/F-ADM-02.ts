// F-ADM-02 · Gestión de productos
// Unidad: CreateProductUseCase.execute() y UpdateProductUseCase.execute()  (POST y PUT /api/v1/products)

import { test, is, eq, ok, subset, grab } from "./harness.js";
import { fakeProductos, fakeUsuarios, producto, datosProducto, contextoExpress, errorDeNext, usuario, arg, calledWith, neverCalled } from "./helpers.js";
import jwt from "jsonwebtoken";
import { requireAdmin, setUserRepositoryForTests } from "../src/infrastructure/http/middlewares/auth.js";
import { CreateProductUseCase, UpdateProductUseCase } from "../src/application/use-cases/catalog.use-cases.js";
import { createProductSchema, updateProductSchema } from "../src/infrastructure/http/validators/catalog.validator.js";
import { AppError } from "../src/shared/errors/AppError.js";

const SECRETO = process.env.JWT_SECRET || "homara_jwt_secret_key_2026_secure";
const tokenDe = (payload: object) => jwt.sign(payload, SECRETO, { expiresIn: "7d" });

function montar() {
  const repo = fakeProductos();
  const crear = new CreateProductUseCase(repo as any);
  const actualizar = new UpdateProductUseCase(repo as any);
  return { repo, crear, actualizar };
}

test("CP-F-ADM-02-01", "Rechaza con 403 a usuarios con rol CUSTOMER antes de modificar productos", async () => {
  const { repo } = montar();
  const usuarios = fakeUsuarios();
  usuarios.findById.resolves(usuario({ role: "CUSTOMER" }));
  setUserRepositoryForTests(usuarios as any);

  const { req, res, next } = contextoExpress(
    `Bearer ${tokenDe({ id: "usr_001", email: "ana@homara.com", role: "ADMIN" })}`,
  );

  await requireAdmin(req, res, next);

  const error = errorDeNext(next);
  ok(error instanceof AppError);
  is(error.statusCode, 403);
  is(error.message, "Acceso denegado. Se requieren permisos de administrador.");
  ok(neverCalled(repo.create));
  ok(neverCalled(repo.update));
});

test("CP-F-ADM-02-02", "Rechaza campos inválidos (precio negativo, stock negativo, nombre vacío) en validación", () => {
  const { repo } = montar();

  const precioNegativo = createProductSchema.safeParse(datosProducto({ price: -1 }));
  is(precioNegativo.success, false);
  if (!precioNegativo.success) is(precioNegativo.error.issues[0].message, "El precio no puede ser negativo.");

  const stockNegativo = createProductSchema.safeParse(datosProducto({ stockQuantity: -5 }));
  is(stockNegativo.success, false);
  if (!stockNegativo.success) is(stockNegativo.error.issues[0].message, "El stock no puede ser negativo.");

  const sinNombre = createProductSchema.safeParse(datosProducto({ name: "" }));
  is(sinNombre.success, false);
  if (!sinNombre.success) is(sinNombre.error.issues[0].message, "El nombre es obligatorio y no puede estar vacío.");

  is(updateProductSchema.safeParse({ price: -1 }).success, false);
  ok(neverCalled(repo.create));
  ok(neverCalled(repo.update));
});

test("CP-F-ADM-02-03", "Retorna 404 al intentar actualizar un producto que no existe", async () => {
  const { repo, actualizar } = montar();
  repo.findById.resolves(null);

  const error = await grab(actualizar.execute("prd_borrado", { price: 45000 }));
  ok(error instanceof AppError);
  is(error.message, "Producto no encontrado");
  ok(calledWith(repo.findById, "prd_borrado"));
  ok(neverCalled(repo.update));
});

test("CP-F-ADM-02-04", "Crea producto nuevo con valores derivados y valida precio mayor a 0", async () => {
  const { repo, crear } = montar();
  repo.create.does(async (p: any) => producto({ ...p, id: "prd_nuevo" }));

  const salida = await crear.execute(datosProducto() as any);

  const guardado = arg(repo.create);
  is(guardado.inStock, true);
  is(guardado.image, "/products/placeholder.jpg");
  is(guardado.rating, 0);
  is(guardado.reviewCount, 0);
  is(guardado.originalPrice, null);
  eq(guardado.tags, []);
  is(salida.id, "prd_nuevo");
  is(salida.name, "Cemento Gris 50 kg");

  repo.create.reset();
  repo.create.does(async (p: any) => producto({ ...p, id: "prd_nuevo" }));
  const sinExistencias = datosProducto({ stockQuantity: 0 });
  is(createProductSchema.safeParse(sinExistencias).success, true);

  await crear.execute(sinExistencias as any);

  const guardadoSinExistencias = arg(repo.create);
  is(guardadoSinExistencias.stockQuantity, 0);
  is(guardadoSinExistencias.inStock, false);

  // DEFECTO: el esquema del servidor acepta precio 0 cuando debería exigir precio > 0 (RF32)
  const precioCero = createProductSchema.safeParse(datosProducto({ price: 0 }));
  is(precioCero.success, false);
});

test("CP-F-ADM-02-05", "Aplica parche parcial en actualización y actualiza inStock si stockQuantity llega a 0", async () => {
  const { repo, actualizar } = montar();
  repo.findById.resolves(producto());
  repo.update.does(async (id: string, d: any) => producto({ id, ...d }));

  const salida = await actualizar.execute("prd_001", { price: 45000, stockQuantity: 30 });

  const parche = arg(repo.update, 0, 1);
  is(parche.price, 45000);
  is(parche.stockQuantity, 30);
  ok(!("name" in parche));
  ok(!("description" in parche));
  ok(!("categoryId" in parche));
  is(salida.price, 45000);
  is(salida.name, "Piso Ceramico Beige 60x60");

  // DEFECTO: reducir existencias a 0 en PUT debería marcar inStock = false
  repo.update.reset();
  repo.update.does(async (id: string, d: any) => producto({ id, ...d }));
  await actualizar.execute("prd_001", { stockQuantity: 0 });
  subset(arg(repo.update, 0, 1), { stockQuantity: 0, inStock: false });
});
