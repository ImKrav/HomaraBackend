// Ayudante compartido: genera el resumen de k6 como JSON + TXT en /salida.
// Sin imports remotos (no dependemos de jslib externo).

function ms(v) {
  return v === undefined ? "n/a" : `${v.toFixed(1)}ms`;
}

export function construirResumen(nombre, data) {
  const m = data.metrics;
  const dur = m.http_req_duration ? m.http_req_duration.values : {};
  const fallos = m.http_req_failed ? m.http_req_failed.values : {};
  const reqs = m.http_reqs ? m.http_reqs.values : {};
  const iters = m.iterations ? m.iterations.values : {};

  const lineas = [];
  lineas.push(`===== Resumen k6 — ${nombre} =====`);
  lineas.push(`Peticiones totales : ${reqs.count ?? "n/a"}`);
  lineas.push(`Iteraciones        : ${iters.count ?? "n/a"}`);
  lineas.push(`http_req_failed    : ${fallos.rate !== undefined ? (fallos.rate * 100).toFixed(2) + "%" : "n/a"}`);
  lineas.push(`Duración (todas)   : avg=${ms(dur.avg)} p90=${ms(dur["p(90)"])} p95=${ms(dur["p(95)"])} max=${ms(dur.max)}`);

  // Sub-métricas por tipo (lectura / login), si fueron declaradas como Trend.
  for (const clave of Object.keys(m)) {
    if (clave.startsWith("dur_")) {
      const v = m[clave].values;
      lineas.push(`${clave.padEnd(18)} : avg=${ms(v.avg)} p95=${ms(v["p(95)"])} max=${ms(v.max)}`);
    }
  }

  // Estado de los umbrales (acceptance criteria).
  lineas.push("");
  lineas.push("Umbrales:");
  let algunoFallo = false;
  for (const [mName, mData] of Object.entries(m)) {
    if (mData.thresholds) {
      for (const [th, res] of Object.entries(mData.thresholds)) {
        const ok = res.ok !== false;
        if (!ok) algunoFallo = true;
        lineas.push(`  [${ok ? "OK " : "FALLA"}] ${mName}: ${th}`);
      }
    }
  }
  lineas.push("");
  lineas.push(`RESULTADO: ${algunoFallo ? "ALGÚN UMBRAL FALLÓ" : "TODOS LOS UMBRALES PASARON"}`);

  const texto = lineas.join("\n") + "\n";
  return {
    stdout: texto,
    [`/salida/${nombre}.json`]: JSON.stringify(data, null, 2),
    [`/salida/${nombre}.txt`]: texto,
  };
}
