// Prueba de carga (load): rampa hasta ~30 VUs durante ~2 min. Evalúa el
// comportamiento bajo carga sostenida frente a los umbrales. ESC38.
import { sleep } from "k6";
import { flujoPublico, flujoLogin, flujoAutenticado, umbrales } from "./comun.js";
import { construirResumen } from "./resumen.js";

export const options = {
  stages: [
    { duration: "30s", target: 30 }, // rampa de subida
    { duration: "60s", target: 30 }, // meseta
    { duration: "30s", target: 0 },  // rampa de bajada
  ],
  thresholds: umbrales,
};

export default function () {
  flujoPublico();
  // Un tercio de los iteradores ejerce el flujo autenticado (login + lecturas).
  if (__VU % 3 === 0) {
    const token = flujoLogin();
    flujoAutenticado(token);
  }
  sleep(1);
}

export function handleSummary(data) {
  return construirResumen("load", data);
}
