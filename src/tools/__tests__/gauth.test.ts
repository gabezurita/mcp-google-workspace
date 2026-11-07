import { test } from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GAuthService } from '../../services/gauth.js';

async function createGAuthService(directory: string, driveDocsOnly: boolean): Promise<GAuthService> {
  const credentialsFile = join(directory, 'oauth-client.json');
  await writeFile(credentialsFile, JSON.stringify({ installed: {} }));

  const config = {
    gauthFile: credentialsFile,
    accountsFile: join(directory, 'accounts.json'),
    credentialsDir: directory,
    driveDocsOnly
  };
  const gauth = new GAuthService(config);
  await gauth.initialize();
  return gauth;
}

test('Drive/Docs-only authorization requests only identity and read-only Drive/Docs scopes', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'mcp-google-workspace-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const gauth = await createGAuthService(directory, true);

  const authorizationUrl = new URL(await gauth.getAuthorizationUrl('user@example.com', {}));
  const scopes = authorizationUrl.searchParams.get('scope')?.split(' ').sort();

  assert.deepEqual(scopes, [
    'https://www.googleapis.com/auth/documents.readonly',
    'https://www.googleapis.com/auth/drive.metadata.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
    'openid'
  ]);
});

test('Drive/Docs-only authorization stores credentials apart from the full-access profile', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'mcp-google-workspace-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const gauth = await createGAuthService(directory, true);

  await gauth.storeCredentials(gauth.getClient(), 'user@example.com');

  const files = await readdir(directory);
  assert.ok(files.includes('.oauth2.drive-docs.user@example.com.json'));
  await assert.rejects(access(join(directory, '.oauth2.user@example.com.json')));
});

test('full authorization preserves existing Gmail and Calendar scopes while adding read-only Drive/Docs scopes', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'mcp-google-workspace-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const gauth = await createGAuthService(directory, false);

  const authorizationUrl = new URL(await gauth.getAuthorizationUrl('user@example.com', {}));
  const scopes = authorizationUrl.searchParams.get('scope')?.split(' ').sort();

  assert.deepEqual(scopes, [
    'https://mail.google.com/',
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/documents.readonly',
    'https://www.googleapis.com/auth/drive.metadata.readonly',
    'https://www.googleapis.com/auth/gmail.settings.basic',
    'https://www.googleapis.com/auth/userinfo.email',
    'openid'
  ]);
});
