import type { RequestHandler } from 'express';

import { completeImport, getImportJob, previewImport } from '../services/import.service.js';
import type {
  ImportConfirmBody,
  ImportJobParams,
  ImportPreviewBody,
} from '../validation/import.validation.js';

export const createImportPreview: RequestHandler = async (_request, response) => {
  const body = response.locals.validatedRequest.body as ImportPreviewBody;
  response.status(201).json(await previewImport(response.locals.userId as string, body));
};

export const showImportJob: RequestHandler = async (_request, response) => {
  const { jobId } = response.locals.validatedRequest.params as ImportJobParams;
  response.json(await getImportJob(response.locals.userId as string, jobId));
};

export const confirmImportJob: RequestHandler = async (_request, response) => {
  const { jobId } = response.locals.validatedRequest.params as ImportJobParams;
  const body = response.locals.validatedRequest.body as ImportConfirmBody;
  response.json(await completeImport(response.locals.userId as string, jobId, body));
};
