import type { ListItem, ListKind } from "../settings.types";
import { LIST_LABELS } from "../lib/labels";
import { EditableList } from "./editable-list";

// A single managed-list section: heading + the shared editable list. Server
// component (composes the client list); rendered once per ListKind by the page.

type Props = {
  kind: ListKind;
  items: ListItem[];
  canEdit: boolean;
};

export function ListSection({ kind, items, canEdit }: Props) {
  const label = LIST_LABELS[kind];
  return (
    <section className="rounded-card border border-border bg-card p-6 shadow-card">
      <h2 className="mb-4 text-lg font-bold text-text">{label.title}</h2>
      <EditableList
        kind={kind}
        items={items}
        canEdit={canEdit}
        withEffect={kind === "followUpResults"}
        addLabel={label.addLabel}
      />
    </section>
  );
}
