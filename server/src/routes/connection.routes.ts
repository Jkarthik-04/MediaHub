import { Router } from 'express';

import { removeConnection, showConnections } from '../controllers/connection.controller.js';
import { requireUser } from '../middleware/require-user.js';

export const connectionRouter = Router();

connectionRouter.use(requireUser);
connectionRouter.get('/', showConnections);
connectionRouter.delete('/:sourceKey', removeConnection);
