import type { RequestHandler } from 'express';

import {
  addToLibrary,
  editLibraryEntry,
  getUserLibrary,
  removeLibraryEntry,
  updateProgress,
} from '../services/library.service.js';
import type {
  CreateLibraryEntryBody,
  LibraryEntryParams,
  LibraryListQuery,
  ProgressBody,
  UpdateLibraryEntryBody,
} from '../validation/library.validation.js';

export const listLibrary: RequestHandler = async (_request, response) => {
  const query = response.locals.validatedRequest.query as LibraryListQuery;
  response.json(await getUserLibrary(response.locals.userId as string, query));
};

export const createLibrary: RequestHandler = async (_request, response) => {
  const body = response.locals.validatedRequest.body as CreateLibraryEntryBody;
  const result = await addToLibrary(response.locals.userId as string, body);
  response.status(201).json(result);
};

export const updateLibrary: RequestHandler = async (_request, response) => {
  const { libraryEntryId } = response.locals.validatedRequest.params as LibraryEntryParams;
  const body = response.locals.validatedRequest.body as UpdateLibraryEntryBody;
  response.json(await editLibraryEntry(response.locals.userId as string, libraryEntryId, body));
};

export const deleteLibrary: RequestHandler = async (_request, response) => {
  const { libraryEntryId } = response.locals.validatedRequest.params as LibraryEntryParams;
  await removeLibraryEntry(response.locals.userId as string, libraryEntryId);
  response.status(204).send();
};

export const createProgress: RequestHandler = async (_request, response) => {
  const { libraryEntryId } = response.locals.validatedRequest.params as LibraryEntryParams;
  const body = response.locals.validatedRequest.body as ProgressBody;
  response.json(await updateProgress(response.locals.userId as string, libraryEntryId, body));
};
