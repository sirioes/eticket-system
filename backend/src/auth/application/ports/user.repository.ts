import { AuthUser, UserCredentials } from '../../domain/auth-user';

export abstract class UserRepository {
  abstract findCredentialsByFullName(
    normalizedFullName: string,
  ): Promise<UserCredentials | null>;

  abstract findAuthUserById(id: number): Promise<AuthUser | null>;
}