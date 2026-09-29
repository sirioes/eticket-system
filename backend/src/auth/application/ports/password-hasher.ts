export abstract class PasswordHasher {
  abstract verify(plainPassword: string, passwordHash: string | null): Promise<boolean>;
}