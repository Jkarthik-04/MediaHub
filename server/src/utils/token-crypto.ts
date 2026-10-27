import { createCipheriv, createHash, randomBytes } from 'node:crypto';

const getEncryptionKey = () => {
  const secret = process.env.CONNECTION_TOKEN_ENCRYPTION_KEY;
  if (!secret) throw new Error('CONNECTION_TOKEN_ENCRYPTION_KEY must be configured.');
  return createHash('sha256').update(secret).digest();
};

export const encryptConnectionToken = (token: string) => {
  const initializationVector = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), initializationVector);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const authenticationTag = cipher.getAuthTag();

  return [
    'v1',
    initializationVector.toString('base64url'),
    authenticationTag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join(':');
};
