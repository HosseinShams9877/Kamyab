// Public API of the search module (C-16 global search). Server code imports
// from "@/modules/search" only (rule 8). The SearchBox is a client leaf — it is
// re-exported here for convenience, but clients that mount it can also import
// the component file directly; either way it pulls only the isomorphic types.

// --- Service (server-only) --------------------------------------------------
export { search } from "./search.service";

// --- Types (isomorphic) -----------------------------------------------------
export {
  SEARCH_MIN_LENGTH,
  type SearchCustomerHit,
  type SearchCaseHit,
  type SearchResults,
} from "./search.types";

// --- Module UI (client leaf) ------------------------------------------------
export { SearchBox } from "./components/search-box";
