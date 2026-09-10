import { test, is, ok } from "./harness.js";
import { cuidParamSchema, itemIdParamSchema, listProjectsQuerySchema, listOrdersQuerySchema } from "../src/infrastructure/http/validators/common.validator.js";
import { createOrderSchema, updateOrderStatusSchema } from "../src/infrastructure/http/validators/order.validator.js";
import { createProjectSchema, updateProjectSchema } from "../src/infrastructure/http/validators/project.validator.js";

test("UNIT-VAL-01", "Valida cuidParamSchema y itemIdParamSchema con CUID válido e inválido", () => {
  const validCuid = "cju055a6d0000y8v760ny8rq5";
  is(cuidParamSchema.safeParse({ id: validCuid }).success, true);
  is(cuidParamSchema.safeParse({ id: "123" }).success, false);

  is(itemIdParamSchema.safeParse({ itemId: validCuid }).success, true);
  is(itemIdParamSchema.safeParse({ itemId: "invalid" }).success, false);
});

test("UNIT-VAL-02", "Valida listOrdersQuerySchema y transformación de admin boolean", () => {
  const parsed = listOrdersQuerySchema.safeParse({ admin: "true" });
  is(parsed.success, true);
  if (parsed.success) {
    is(parsed.data.admin, true);
  }

  const parsedFalse = listOrdersQuerySchema.safeParse({ admin: "false" });
  is(parsedFalse.success, true);
  if (parsedFalse.success) {
    is(parsedFalse.data.admin, false);
  }

  is(listProjectsQuerySchema.safeParse({}).success, true);
});

test("UNIT-VAL-03", "Valida createOrderSchema y updateOrderStatusSchema", () => {
  const validOrder = {
    paymentMethod: "TARJETA_CREDITO",
    shippingAddress: "Calle 123 #45-67",
    shippingCity: "Bogotá",
  };
  is(createOrderSchema.safeParse(validOrder).success, true);
  is(createOrderSchema.safeParse({}).success, false);

  is(updateOrderStatusSchema.safeParse({ status: "ENVIADO" }).success, true);
  is(updateOrderStatusSchema.safeParse({ status: "DESCONOCIDO" }).success, false);
});

test("UNIT-VAL-04", "Valida createProjectSchema y updateProjectSchema", () => {
  const validProject = {
    name: "Remodelación Cocina",
    type: "PISO",
    area: 25.5,
    wastePercent: 10,
  };
  is(createProjectSchema.safeParse(validProject).success, true);
  is(createProjectSchema.safeParse({ name: "", type: "PISO", area: 10 }).success, false);

  const validUpdate = {
    area: 30,
    status: "COMPLETADO",
  };
  is(updateProjectSchema.safeParse(validUpdate).success, true);
  is(updateProjectSchema.safeParse({ area: -5 }).success, false);
});
