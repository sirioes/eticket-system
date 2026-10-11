import { assertTestDatabase } from './test-database';

describe('assertTestDatabase', () => {
  const original = process.env.DATABASE_URL;

  afterEach(() => {
    process.env.DATABASE_URL = original;
  });

  const withUrl = (url: string | undefined) => {
    if (url === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = url;
    return () => assertTestDatabase();
  };

  it.each([
    'mysql://eticket:x@127.0.0.1:3306/eticket_test',
    'mysql://eticket:x@localhost:3307/eticket_system_test',
  ])('allows %s', (url) => {
    expect(withUrl(url)).not.toThrow();
  });

  it.each([
    ['the dev database', 'mysql://eticket:x@127.0.0.1:3307/eticket_system'],
    ['a name that only contains _test', 'mysql://eticket:x@127.0.0.1/eticket_test_backup'],
    ['a remote host', 'mysql://eticket:x@db.example.com:3306/eticket_test'],
    ['a LAN address', 'mysql://eticket:x@192.168.1.10:3306/eticket_test'],
  ])('refuses %s', (_label, url) => {
    expect(withUrl(url)).toThrow(/_test/);
  });

  it('refuses to run without DATABASE_URL', () => {
    expect(withUrl(undefined)).toThrow(/DATABASE_URL/);
  });
});
