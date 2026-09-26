// Public API of the automatic engine (C-14). The engine sits at the TOP of the
// module DAG: it reads downward through the periods/tasks/customers/employees/
// settings barrels, and NOTHING imports it back (importing this would risk a
// cycle). The two triggers — POST /api/engine/run and the CLI scripts/engine.ts —
// import `runEngine` from here; the /engine page imports `listRecentRuns`.
//
// The pure orchestrator (engine.orchestrator), the decision guards (engine.guards)
// and the port contract (engine.types) are deliberately NOT re-exported: they are
// internal, and the twice-run proof drives them directly via relative imports in
// __tests__, so nothing outside the module ever needs them.

export { runEngine, listRecentRuns } from "./engine.service";
export type { EngineRunView } from "./engine.service";
