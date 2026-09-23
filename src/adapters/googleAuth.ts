import { JWT } from 'google-auth-library';

export const createAuthClient = (credentials) =>
  new JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });