export interface SelectionState {
  query: string;
  id: string | undefined;
}

export function resolveSelection(state: SelectionState, query: string, orderedIds: string[]): string | undefined {
  if (state.query === query && state.id !== undefined && orderedIds.includes(state.id)) {
    return state.id;
  }

  return orderedIds[0];
}
