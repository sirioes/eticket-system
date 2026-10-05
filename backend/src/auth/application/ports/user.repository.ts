import { AuthUser, UserCredentials } from '../../domain/auth-user';

export abstract class UserRepository {
  abstract findCredentialsByFullName(
    normalizedFullName: string,
  ): Promise<UserCredentials | null>;

  abstract findAuthUserById(id: number): Promise<AuthUser | null>;

  abstract findCredentialsById(id: number): Promise<UserCredentials | null>;

  abstract updatePassword(
    id: number,
    passwordHash: string,
    passwordChangedAt: Date,
  ): Promise<void>;
}