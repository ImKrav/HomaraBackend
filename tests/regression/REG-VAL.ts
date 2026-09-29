// REG-VAL · Regresión del validador de IDs CUID
// Protege: aecb5e1 refactor(validators): replace deprecated z.cuid with regex cuidValidator
//
// El reemplazo de `z.cuid()` por `CUID_REGEX` no debe cambiar qué IDs pasan ni
// los mensajes que ve el usuario. Los casos de tabla comparan por índice para
// que el mensaje de fallo diga qué ID cambió de veredicto.

import { test, expect } from "../harness.js";
import {
  cuidParamSchema,
  itemIdParamSchema,
  listOrdersQuerySchema,
} from "../../src/infrastructure/http/validators/common.validator.js";
import { addItemSchema } from "../../src/infrastructure/http/validators/cart.validator.js";

test("REG-VAL-01", "Acepta CUIDs reales, incluidos los de Prisma y en mayúsculas", () => {
  // Arrange
  const ids = [
    "cju055a6d0000y8v760ny8rq5", // cuid v1
    "cm1x9k2ab0001qz8f3h4j5k6l", // formato que genera Prisma @default(cuid())
    "CJU055A6D0000Y8V760NY8RQ5", // la regex es insensible a mayúsculas
    "c12345678", // longitud mínima: c + 8
  ];

  // Act
  const veredictos = ids.map((id) => cuidParamSchema.safeParse({ id }).success);

  // Assert
  ids.forEach((id, i) => expect(veredictos[i], `id: ${id}`).toBe(true));
});

test("REG-VAL-02", "Rechaza IDs que no son CUID", () => {
  // Arrange
  const ids = [
    "",
    "123",
    "c1234567", // una posición menos que el mínimo
    "c50e8400-e29b-41d4-a716-446655440000", // UUID: los guiones no se permiten
    "cju055a6d 0000y8v760ny8rq5", // espacio interno
    "xju055a6d0000y8v760ny8rq5", // no empieza por c
  ];

  // Act
  const veredictos = ids.map((id) => cuidParamSchema.safeParse({ id }).success);

  // Assert
  ids.forEach((id, i) => expect(veredictos[i], `id: ${JSON.stringify(id)}`).toBe(false));
});

test("REG-VAL-03", "Cada esquema conserva su mensaje de error propio", () => {
  // Arrange
  const invalido = "123";

  // Act
  const param = cuidParamSchema.safeParse({ id: invalido });
  const item = itemIdParamSchema.safeParse({ itemId: invalido });
  const pedidos = listOrdersQuerySchema.safeParse({ userId: invalido });
  const carrito = addItemSchema.safeParse({ productId: invalido, quantity: 1 });

  // Assert
  expect(param.error?.issues[0].message).toBe("El ID proporcionado debe ser un formato CUID válido.");
  expect(item.error?.issues[0].message).toBe("El ID de ítem proporcionado debe ser un formato CUID válido.");
  expect(pedidos.error?.issues[0].message).toBe("El ID de usuario de consulta debe ser un formato CUID válido.");
  expect(carrito.error?.issues[0].message).toBe("ID de producto inválido");
});

test("REG-VAL-04", "El userId de los listados sigue siendo opcional", () => {
  // Arrange
  const sinFiltro = {};

  // Act
  const resultado = listOrdersQuerySchema.safeParse(sinFiltro);

  // Assert
  expect(resultado.success).toBe(true);
  expect(resultado.data?.userId).toBeUndefined();
});
