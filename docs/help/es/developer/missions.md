# Arquitectura de misiones diarias

Las misiones diarias (EXP-010, Fase 56) añaden motivación activa y
opcional sobre las recompensas pasivas de XP/insignias/racha. Funcionan
en ambos modos de almacenamiento y añaden exactamente una tabla de
seguimiento.

## Componentes

| Módulo | Función |
|---|---|
| `plugins/.../missions/templates.yaml` | Catálogo estático de misiones (22 plantillas, 5 categorías), sincronizado al frontend por `make sync-missions`. |
| `MissionTemplate` (Pydantic) | Forma de la entrada del catálogo (configuración, NO una tabla). |
| `UserMission` (modelo) | La única tabla nueva: asignación + progreso + guardia `xp_awarded` por usuario/por día. Alembic `0021`, Dexie v20, superficie de sincronización (MUTABLE). |
| `lib/missions/generator.ts` + `generator.py` | Selección adaptativa determinista (PRNG con semilla): una selección por franja de dificultad, elegibilidad por historial (nuevo/activo/veterano), sin repeticiones consecutivas. |
| `lib/missions/checks.ts` + `SUPPORTED_CHECK_FUNCTIONS` | Solo se pueden asignar verificaciones computables a partir de datos existentes (las otras 5 entradas del catálogo permanecen sin asignar hasta que exista el seguimiento). |
| `lib/missions/progress.ts` | `check_function` pura + instantánea de estadísticas → {current, target, completed}. |
| `lib/missions/schedule.ts` | `today` local a medianoche (idioma→zona horaria) + comodín de racha. |
| `storage/missions-dexie.ts` | Dexie: recopila una instantánea de estadísticas "de hoy", asigna de forma idempotente, evalúa, otorga XP al completar. |
| `service.py` del plugin de misiones | El mismo flujo contra SQLAlchemy para el modo API (`GET /today`, `POST /regenerate`). |

## Flujo

1. El widget del dashboard (o la finalización de una lección) llama a
   `getStorage().missions.getDaily(userId, {todayIso})`.
2. Si no existen filas para ese día local, el generador asigna un
   conjunto nuevo (con semilla `userId + date`, excluyendo el del día anterior).
3. El progreso se reevalúa contra los datos existentes
   (LessonProgress / ElementError / racha). Una misión recién completada
   activa `completed` y, una sola vez, otorga su `xp_reward`
   (idempotente mediante `xp_awarded`).
4. `celebrateMissions` (bus de celebración) reproduce el sonido de misión +
   muestra una frase de elogio; un "todo despejado" reproduce el sonido
   más grande + una explosión de confeti.

## Reglas

- Determinista por (userId, date); un usuario usa un backend de almacenamiento,
  por lo que la paridad exacta entre backends no es necesaria.
- Sin seguimiento más allá de `UserMission`; las verificaciones no rastreables
  no se asignan.
- Las misiones son suplementarias: un fallo nunca interrumpe el flujo de la
  lección (todas las lecturas son defensivas). No hay penalización por días
  omitidos.
