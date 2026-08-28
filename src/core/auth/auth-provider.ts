export interface AuthProvider {
  verifyToken(token: string): Promise<{ userId: string } | null>;
}
