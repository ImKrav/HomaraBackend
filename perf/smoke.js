// Prueba de humo (smoke): 2 VUs durante 30s. Verifica que la API responde
// correctamente y mide la línea base de latencia sin carga. ESC38.
import { sleep } from "k6";
import { flujoPublico, flujoLogin, flujoAutenticado, umbrales } from "./comun.js";
import { construirResumen } from "./resumen.js";

export const options = {
  vus: 2,
  duration: "30s",
  thresholds: umbrales,
};

export default function () {
  flujoPublico();
  const token = flujoLogin();
  flujoAutenticado(token);
  sleep(1);
}

export function handleSummary(data) {
  return construirResumen("smoke", data);
}
