// Prueba de estrés (stress) acotada: rampa hasta ~60 VUs durante ~2 min.
// Se mantiene moderada porque otros agentes comparten el stack. ESC38.
import { sleep } from "k6";
import { flujoPublico, flujoLogin, flujoAutenticado, umbrales } from "./comun.js";
import { construirResumen } from "./resumen.js";

export const options = {
  stages: [
    { duration: "45s", target: 60 }, // rampa de subida agresiva
    { duration: "45s", target: 60 }, // meseta
    { duration: "30s", target: 0 },  // rampa de bajada
  ],
  // En estrés los umbrales se declaran igual, pero el objetivo es observar el
  // punto de quiebre: documentamos si fallan, no hacemos fallar el pipeline.
  thresholds: umbrales,
};

export default function () {
  flujoPublico();
  if (__VU % 2 === 0) {
    const token = flujoLogin();
    flujoAutenticado(token);
  }
  sleep(0.5);
}

export function handleSummary(data) {
  return construirResumen("stress", data);
}
