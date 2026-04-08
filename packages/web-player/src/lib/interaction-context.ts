export type ActiveInteractionContext = "diagram" | "browse" | "diagnostics";

export const ACTIVE_INTERACTION_CONTEXT_ATTRIBUTE = "data-active-interaction-context";

export function readActiveInteractionContext(input: {
  isBrowseOpen: boolean;
  isDiagnosticsOpen: boolean;
}): ActiveInteractionContext {
  if (input.isBrowseOpen) {
    return "browse";
  }

  if (input.isDiagnosticsOpen) {
    return "diagnostics";
  }

  return "diagram";
}

export function readActiveInteractionContextFromDocument(
  documentValue: Document
): ActiveInteractionContext {
  const marker = documentValue.querySelector<HTMLElement>(
    `[${ACTIVE_INTERACTION_CONTEXT_ATTRIBUTE}]`
  );
  const contextValue = marker?.getAttribute(ACTIVE_INTERACTION_CONTEXT_ATTRIBUTE);

  return isActiveInteractionContext(contextValue) ? contextValue : "diagram";
}

function isActiveInteractionContext(
  value: string | null | undefined
): value is ActiveInteractionContext {
  return value === "diagram" || value === "browse" || value === "diagnostics";
}
