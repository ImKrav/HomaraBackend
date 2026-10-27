# Pruebas de API con Postman y Postbot

Colección de Postman que recorre todos los módulos de la API de Homara con casos
positivos y negativos. Cada petición tiene en su descripción el **objetivo** y el
**resultado esperado**; las pruebas (`pm.test`) verifican el resultado. Sobre esta
colección se usa **Postbot**, el asistente de IA de Postman, para generar y
ampliar pruebas.

| Archivo | Contenido |
|---|---|
| `Homara.postman_collection.json` | 34 peticiones en 6 carpetas: autenticación, catálogo, carrito, pedidos, proyectos y administración |
| `Homara.postman_environment.json` | Entorno local (`http://localhost:5000/api/v1`) y usuarios de prueba |
| `Homara-VPS.postman_environment.json` | Entorno del despliegue (`https://homara-api.nodalix.tech/api/v1`) |

La colección no corre en ningún pipeline (Jenkins / GitHub Actions); se ejecuta a mano. Las evidencias (`evidencias/`) no se versionan.

## Ejecutar

Con [Newman](https://www.npmjs.com/package/newman), contra el despliegue (o `Homara.postman_environment.json` para local):

```bash
npx newman@6.2.1 run postman/Homara.postman_collection.json -e postman/Homara-VPS.postman_environment.json \
  --reporters cli,junit,json \
  --reporter-junit-export postman/evidencias/newman-junit.xml \
  --reporter-json-export postman/evidencias/newman-resultados.json
```

Resultado contra el despliegue, sobre el backend refactorizado: **34 peticiones, 52 aserciones, 0 fallidas**.

La primera corrida dio 2 fallos: "Consultar perfil sin token" respondió 200 y "Agregar al carrito sin sesión" 201. No era un defecto: con `curl` sin cookies ambos responden 401. Desde DEF-SEG-FE-02 el login también deja la sesión en la cookie HttpOnly `homara_session`, y Postman la reenviaba. Esas dos peticiones desactivan ahora las cookies (`protocolProfileBehavior.disableCookies`).

En la app de Postman: **Import** → seleccionar la colección y el entorno → elegir el entorno
**Homara VPS** (o **Homara local**) → en la colección, **Run** (Collection Runner). Las peticiones
dependen del orden (el login guarda el token que usan las demás), así que se
ejecuta la colección completa.

## Postbot (IA)

Postbot solo está disponible dentro de la app de Postman (icono de Postbot en la
barra inferior, o el botón de IA en la pestaña **Scripts → Post-response**).

Postbot trabaja petición por petición:

1. Abrir una petición y enviarla (**Send**) para que Postbot vea la respuesta (si no la hay, Postbot pide enviarla primero).
2. En **Scripts → Post-response**, abrir Postbot y pedirle, por ejemplo:
   - `Add tests to this request` — genera pruebas de estado, esquema y tiempos.
   - `Add more tests to check the response body` — amplía las aserciones existentes.
   - `Test that the error response has success false and an error message` — para los casos negativos.
3. Revisar el código que propone y aceptarlo solo si la aserción es correcta para la regla de negocio.
4. Repetir en las peticiones de cada carpeta y ejecutar de nuevo la colección con el Runner; guardar el resultado como evidencia.

Para la entrega conviene comparar, en una petición, las pruebas escritas por el
equipo con las que propone Postbot: qué validó cada uno, qué le faltó a la IA y
qué aserciones propuso que no eran correctas.

## Casos

| Carpeta | Peticiones | Escenarios |
|---|---|---|
| 01 Autenticación | registro válido, correo duplicado, contraseña corta, login cliente y admin, login inválido, perfil con y sin token | ESC01, ESC02, ESC04, ESC35 |
| 02 Catálogo | categorías, listado, búsqueda con y sin resultados, detalle, producto inexistente, vitrina | ESC08–ESC12, ESC41 |
| 03 Carrito | sin sesión, agregar, totales, modificar cantidad, cantidad inválida | ESC13–ESC16 |
| 04 Pedidos | generar pedido, carrito vacío tras el pedido, pedido sin productos, historial, cambio de estado como cliente y como admin | ESC27–ESC29, ESC34 |
| 05 Proyectos | crear, crear inválido, consultar, editar, eliminar | ESC17, ESC19, ESC23 |
| 06 Administración | métricas como admin y como cliente, inventario | ESC06, ESC31, ESC33 |
