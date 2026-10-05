export abstract class PasswordHasher {
  abstract hash(plainPassword: string): Promise<string>;

  abstract verify(plainPassword: string, passwordHash: string | null): Promise<boolean>;
}