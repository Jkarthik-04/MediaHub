import { Router } from 'express';

import {
  finishAniListConnection,
  finishGoogleBooksConnection,
  finishTraktConnection,
  removeConnection,
  showConnections,
  startAniListConnection,
  startGoogleBooksConnection,
  startTraktConnection,
  syncAniListConnection,
  syncGoogleBooksConnection,
  syncTraktConnection,
} from '../controllers/connection.controller.js';
import { requireUser } from '../middleware/require-user.js';

export const connectionRouter = Router();

connectionRouter.use(requireUser);
connectionRouter.get('/', showConnections);
connectionRouter.get('/anilist/connect', startAniListConnection);
connectionRouter.get('/anilist/callback', finishAniListConnection);
connectionRouter.post('/anilist/sync', syncAniListConnection);
connectionRouter.get('/trakt/connect', startTraktConnection);
connectionRouter.get('/trakt/callback', finishTraktConnection);
connectionRouter.post('/trakt/sync', syncTraktConnection);
connectionRouter.get('/google-books/connect', startGoogleBooksConnection);
connectionRouter.get('/google-books/callback', finishGoogleBooksConnection);
connectionRouter.post('/google-books/sync', syncGoogleBooksConnection);
connectionRouter.delete('/:sourceKey', removeConnection);
