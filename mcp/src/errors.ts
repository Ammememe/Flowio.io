/** Shared between both `DeckBackend` implementations (`httpBackend.ts`, `directBackend.ts`). */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly issues?: unknown,
  ) {
    super(message);
  }
}

export class VersionConflictError extends ApiError {
  constructor(public readonly currentVersion: number) {
    super(409, "Deck was changed elsewhere since it was last read");
  }
}
