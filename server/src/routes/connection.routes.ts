import { Router } from 'express';

import {
  finishAniListConnection,
  removeConnection,
  showConnections,
  startAniListConnection,
} from '../controllers/connection.controller.js';
import { requireUser } from '../middleware/require-user.js';

export const connectionRouter = Router();

connectionRouter.use(requireUser);
connectionRouter.get('/', showConnections);
connectionRouter.get('/anilist/connect', startAniListConnection);
connectionRouter.get('/anilist/callback', finishAniListConnection);
connectionRouter.delete('/:sourceKey', removeConnection);
