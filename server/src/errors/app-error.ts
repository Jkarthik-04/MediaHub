export type ErrorDetail = {
  field: string;
  message: string;
};

export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly details?: ErrorDetail[],
  ) {
    super(message);
    this.name = 'AppError';
  }
}
