# Revisión de contenido con IA

Adaptive Learner puede, **de forma opcional, hacer que una IA
revise** un conjunto de lecciones descargado (EXP-033). La IA examina
las tarjetas del conjunto en busca de problemas de traducción,
gramática y nivel e informa de lo que encuentra: nunca bloquea nada,
solo aconseja. Por otro lado, los repositorios llevan un **nivel de
confianza** que puedes leer de un vistazo.

<!-- TODO: Captura de pantalla - Explorador de contenido, tarjeta de conjunto con el botón "Revisar con IA" + la insignia "Revisado por IA" -->

---

## Niveles de confianza de los repositorios

Cada conjunto de lecciones muestra en el Explorador de contenido una
insignia de origen con un nivel de confianza. Se refiere a la
**procedencia**, no a la calidad del contenido:

- **Confianza 0 - sin validar.** Un repo recién conectado cuya
  comprobación automática no se ha superado (todavía).
- **Confianza 1 - validado técnicamente.** El repo contiene al menos
  una lección y ningún código ejecutable. La comprobación se repite
  en cada sincronización.
- **Confianza 3 - recomendado oficialmente.** Un repo curado de la
  lista oficial de recomendaciones.

Las valoraciones de la comunidad (Confianza 2) y un índice central
todavía no están implementados.

---

## Requisitos para la revisión con IA

La revisión con IA llama a un proveedor de IA directamente desde el
navegador. Necesitas:

- una **clave API guardada** (Ajustes > IA) para uno de los
  proveedores (Anthropic, OpenAI o Gemini);
- el **modo navegador** (Dexie) - la revisión se ejecuta directamente
  desde el navegador;
- un **conjunto descargado** (la revisión trabaja sobre las tarjetas
  almacenadas en caché localmente).

Sin clave, el botón está visible pero desactivado; un aviso enlaza a
Ajustes.

> **Coste:** la revisión gasta tokens de tu propia cuenta del
> proveedor y se factura según las tarifas de ese proveedor. Antes de
> empezar, el diálogo muestra una **estimación de coste** que debes
> confirmar.

---

## Revisar un conjunto paso a paso

1. Abre el **Explorador de contenido** y elige un conjunto descargado.
2. Haz clic en **"Revisar con IA"**.
3. El diálogo muestra una **estimación de coste**. Confírmala para
   iniciar la revisión.
4. Las tarjetas se revisan por **lotes**; una barra de progreso
   muestra el avance, y puedes **cancelar** en cualquier momento.
5. Al final obtienes un **informe por tarjeta**: solo aparecen las
   tarjetas con un hallazgo, cada una con la lección a la que
   pertenece y la nota de la IA.

Entre dos revisiones hay un breve **periodo de espera** (alrededor de
un minuto) para que no se te cobre dos veces por accidente.

---

## Aplicar sugerencias (tus propios conjuntos)

Tus propios conjuntos los revisas en **Contenido > Mi contenido**:
cada fila de conjunto lleva allí el mismo botón **Revisar con IA**. En
un conjunto que creaste tú, el informe incluye el botón **Aplicar
sugerencias**. Abre una tabla con una fila por cada sugerencia que
nombra un campo de tarjeta (anverso, reverso, notas): lección,
tarjeta, campo, el valor actual y el valor sugerido. Todas las filas
están marcadas; desmarca lo que sea una explicación en lugar de un
valor. Los hallazgos sin un valor aplicable solo se cuentan, nunca se
escriben. El botón de confirmación indica el número de campos y
tarjetas que cambia.

La escritura sigue el mismo camino que el editor: el conjunto completo
con todas sus lecciones, de modo que el título, los idiomas, el nivel
y la descripción se mantienen, los ids de las tarjetas no cambian y tu
progreso de aprendizaje se conserva. Los valores anteriores se guardan
y **Deshacer la última aplicación** los restaura. Tras una aplicación,
el informe guardado queda desactualizado y se descarta; vuelve a
revisar el conjunto cuando quieras un resultado nuevo. En los
conjuntos descargados el botón está desactivado, con una nota de que
solo se aplica a tus propias lecciones.

## Informe, caché y la insignia "Revisado por IA"

- **En caché.** El informe se guarda localmente (IndexedDB) y se
  vuelve a mostrar la próxima vez sin pagar de nuevo. Lleva un hash
  del contenido + una firma, de modo que un conjunto modificado
  sugiere una revisión nueva.
- **Exportable.** Puedes descargar el informe como **Markdown**,
  práctico para pegarlo en una revisión de una lección o en un issue.
- **Insignia.** Un conjunto revisado muestra una insignia **"Revisado
  por IA"** en el Explorador de contenido, para que veas que existe una
  revisión.

La IA es **orientativa**: señala posibles problemas, pero nunca te
impide aprender, editar o compartir un conjunto. La decisión es tuya.

---

Para saber cómo funciona esto internamente, consulta la documentación
para desarrolladores sobre la
[integración de IA](../developer/ai-integration.md).
