import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OAuth2Client } from 'google-auth-library';

const toolModulePath: string = '../drive.js';
const loadTools = () => import(toolModulePath);

test('drive_search_files returns bounded metadata results and a next-page token', async () => {
  const { DriveTools } = await loadTools();
  let request: {
    q: string;
    pageSize: number;
    pageToken?: string;
    fields: string;
  } | undefined;
  const tools = new DriveTools(new OAuth2Client(), {
    listFiles: async (params: typeof request extends undefined ? never : NonNullable<typeof request>) => {
      request = params;
      return {
        files: [{
          id: 'file-1',
          name: 'Budget',
          mimeType: 'application/vnd.google-apps.document',
          modifiedTime: '2026-03-01T10:00:00Z',
          webViewLink: 'https://drive.google.com/file/d/file-1/view'
        }],
        nextPageToken: 'next-page'
      };
    },
    getFileMetadata: async () => ({ id: 'unused' }),
    getDocument: async () => ({ documentId: 'unused' })
  });

  const result = await tools.handleTool('drive_search_files', {
    query: 'budget',
    search_field: 'fullText',
    max_results: 5,
    page_token: 'current-page'
  });

  assert.deepEqual(JSON.parse(result[0].text), {
    files: [{
      id: 'file-1',
      name: 'Budget',
      mimeType: 'application/vnd.google-apps.document',
      modifiedTime: '2026-03-01T10:00:00Z',
      webViewLink: 'https://drive.google.com/file/d/file-1/view'
    }],
    next_page_token: 'next-page'
  });
  assert.deepEqual(request, {
    q: "trashed = false and fullText contains 'budget'",
    pageSize: 5,
    pageToken: 'current-page',
    fields: 'nextPageToken,files(id,name,mimeType,modifiedTime,webViewLink,description,size,parents,owners(displayName,emailAddress))'
  });
});

test('drive_get_file_metadata returns the requested file metadata', async () => {
  const { DriveTools } = await loadTools();
  let requestedFileId = '';
  const tools = new DriveTools(new OAuth2Client(), {
    listFiles: async () => ({ files: [] }),
    getFileMetadata: async ({ fileId }: { fileId: string }) => {
      requestedFileId = fileId;
      return {
        id: fileId,
        name: 'Research',
        mimeType: 'application/vnd.google-apps.document',
        webViewLink: 'https://drive.google.com/file/d/file-2/view'
      };
    },
    getDocument: async () => ({ documentId: 'unused' })
  });

  const result = await tools.handleTool('drive_get_file_metadata', { file_id: 'file-2' });

  assert.equal(requestedFileId, 'file-2');
  assert.deepEqual(JSON.parse(result[0].text), {
    id: 'file-2',
    name: 'Research',
    mimeType: 'application/vnd.google-apps.document',
    webViewLink: 'https://drive.google.com/file/d/file-2/view'
  });
});

test('docs_get_document retrieves every tab and returns readable document text', async () => {
  const { DriveTools } = await loadTools();
  let requestedDocumentId = '';
  const tools = new DriveTools(new OAuth2Client(), {
    listFiles: async () => ({ files: [] }),
    getFileMetadata: async () => ({ id: 'unused' }),
    getDocument: async ({ documentId, includeTabsContent }: { documentId: string; includeTabsContent: boolean }) => {
      assert.equal(includeTabsContent, true);
      requestedDocumentId = documentId;
      return {
        documentId,
        title: 'Planning',
        tabs: [{
          documentTab: {
            body: {
              content: [{
                paragraph: {
                  elements: [{ textRun: { content: 'Overview\n' } }]
                }
              }]
            }
          },
          childTabs: [{
            documentTab: {
              body: {
                content: [{
                  paragraph: {
                    elements: [{ textRun: { content: 'Details\n' } }]
                  }
                }]
              }
            }
          }]
        }]
      };
    }
  });

  const result = await tools.handleTool('docs_get_document', { document_id: 'document-1' });

  assert.equal(requestedDocumentId, 'document-1');
  assert.deepEqual(JSON.parse(result[0].text), {
    document_id: 'document-1',
    title: 'Planning',
    text: 'Overview\nDetails\n'
  });
});

test('drive_search_files rejects an out-of-range result limit', async () => {
  const { DriveTools } = await loadTools();
  const tools = new DriveTools(new OAuth2Client(), {
    listFiles: async () => ({ files: [] }),
    getFileMetadata: async () => ({ id: 'unused' }),
    getDocument: async () => ({ documentId: 'unused' })
  });

  await assert.rejects(
    tools.handleTool('drive_search_files', { query: 'budget', max_results: 101 }),
    /max_results must be between 1 and 100/i
  );
});
