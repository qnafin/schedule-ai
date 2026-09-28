import { JWT } from "google-auth-library";

type GoogleAuthParams = {
  googleServiceAccountEmail: string;
  googlePrivateKey: string;
};

export const createGoogleAuth = ({
  googleServiceAccountEmail,
  googlePrivateKey,
}: GoogleAuthParams): JWT =>
  new JWT({
    email: googleServiceAccountEmail,
    key: googlePrivateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });