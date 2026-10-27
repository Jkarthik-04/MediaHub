import { Router } from 'express';

import {
  finishAniListConnection,
  finishTraktConnection,
  removeConnection,
  showConnections,
  startAniListConnection,
  startTraktConnection,
} from '../controllers/connection.controller.js';
import { requireUser } from '../middleware/require-user.js';

export const connectionRouter = Router();

connectionRouter.use(requireUser);
connectionRouter.get('/', showConnections);
connectionRouter.get('/anilist/connect', startAniListConnection);
connectionRouter.get('/anilist/callback', finishAniListConnection);
connectionRouter.get('/trakt/connect', startTraktConnection);
connectionRouter.get('/trakt/callback', finishTraktConnection);
connectionRouter.delete('/:sourceKey', removeConnection);
