# Generación de ejercicios con IA

Una lección compuesta solo de teoría (sin ejercicios) puede
convertirse en una lección practicable si haces que la IA
**genere ejercicios** a partir de sus tarjetas. Esta es la
pipeline EXP-036. Necesita una clave de IA configurada (Ajustes →
IA); sin ella, el botón es visible pero está desactivado, y su
tooltip indica el motivo.

<!-- TODO: Captura de pantalla - el botón "Generar ejercicios" en una lección solo de teoría -->

---

## La pipeline

La generación no es una única llamada a la IA - es una pipeline de
**generar → control de calidad → equilibrar → feedback**:

1. **Generar.** Un prompt de generación pide al modelo ejercicios
   de los tipos admitidos; un parser JSON defensivo tolera las
   peculiaridades de formato habituales de los modelos.
2. **Control de calidad.** Un control determinista rechaza los
   ejercicios mal formados, triviales o que duplican otros ya
   existentes - antes de que llegues a verlos.
3. **Equilibrar.** El conjunto de ejercicios generados se equilibra
   entre los tipos de ejercicio, para que una lección no tenga
   todos la misma forma.
4. **Regenerar con feedback.** Si el resultado no es el adecuado,
   puedes regenerar con feedback para orientar el siguiente
   intento.

---

## Por lección y por conjunto

- **Una sola lección:** en las lecciones solo de teoría aparece un
  botón **"Generar ejercicios"**.
- **Conjunto completo:** la generación por lotes completa los
  ejercicios de todas las lecciones solo de teoría de un conjunto
  en una sola ejecución.

---

## Calidad y confianza

Como el control de calidad es determinista, los ejercicios
generados cumplen el mismo listón mínimo que los creados por
autores (suficientes ejercicios, más de un tipo, ninguna tarjeta
vacía). La generación complementa el contenido creado por autores -
nunca sobrescribe en silencio tus ejercicios existentes.

Para comprobar la calidad del contenido *existente* (creado por
autores o generado), consulta
[Revisión de contenido con IA](../user-guide/ai-validation.md).

---

## Páginas relacionadas

- [Revisión de contenido con IA](../user-guide/ai-validation.md) - revisiones de calidad de todo el conjunto
- [Crear lecciones](../content-creation/overview.md) - crea lecciones tú mismo
- [Lecciones y repasos](../user-guide/lessons.md) - los tipos de ejercicio
