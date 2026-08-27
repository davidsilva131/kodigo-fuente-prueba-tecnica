export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export interface ValidationIssue {
  path: string;
  message: string;
}

/** Error de validación con detalles por campo (mismo shape que zod). */
export class ValidationError extends Error {
  constructor(public readonly issues: ValidationIssue[]) {
    super('Datos inválidos');
    this.name = 'ValidationError';
  }
}