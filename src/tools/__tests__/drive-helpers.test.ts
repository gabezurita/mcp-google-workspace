import { test } from 'node:test';
import assert from 'node:assert/strict';

const helperModulePath: string = '../drive-helpers.js';
const loadHelpers = () => import(helperModulePath);

test('escapes apostrophes and backslashes in Drive search terms', async () => {
  const { buildDriveSearchQuery } = await loadHelpers();

  assert.equal(
    buildDriveSearchQuery("quinn's paper\\essay", 'name'),
    "trashed = false and name contains 'quinn\\'s paper\\\\essay'"
  );
});

test('searches Drive file content when fullText is selected', async () => {
  const { buildDriveSearchQuery } = await loadHelpers();

  assert.equal(
    buildDriveSearchQuery('project plan', 'fullText'),
    "trashed = false and fullText contains 'project plan'"
  );
});

test('rejects a blank Drive search term', async () => {
  const { buildDriveSearchQuery } = await loadHelpers();

  assert.throws(() => buildDriveSearchQuery('   ', 'name'), /search term is required/i);
});

test('allows only Drive and Docs tools in Drive/Docs-only mode', async () => {
  const { isDriveDocsTool } = await loadHelpers();

  assert.equal(isDriveDocsTool('drive_search_files'), true);
  assert.equal(isDriveDocsTool('drive_get_file_metadata'), true);
  assert.equal(isDriveDocsTool('docs_get_document'), true);
  assert.equal(isDriveDocsTool('gmail_query_emails'), false);
  assert.equal(isDriveDocsTool('calendar_create_event'), false);
  assert.equal(isDriveDocsTool('drive_delete_file'), false);
  assert.equal(isDriveDocsTool('docs_batch_update'), false);
});

test('extracts paragraphs and table cell text from a document body', async () => {
  const { extractDocumentText } = await loadHelpers();

  const text = extractDocumentText({
    body: {
      content: [
        {
          paragraph: {
            elements: [{ textRun: { content: 'Agenda\n' } }]
          }
        },
        {
          table: {
            tableRows: [
              {
                tableCells: [
                  {
                    content: [{
                      paragraph: {
                        elements: [{ textRun: { content: 'Topic\n' } }]
                      }
                    }]
                  },
                  {
                    content: [{
                      paragraph: {
                        elements: [{ textRun: { content: 'Owner\n' } }]
                      }
                    }]
                  }
                ]
              }
            ]
          }
        }
      ]
    }
  });

  assert.equal(text, 'Agenda\nTopic\tOwner\n');
});

test('extracts content from nested tabs without duplicating document body', async () => {
  const { extractDocumentText } = await loadHelpers();

  const text = extractDocumentText({
    body: {
      content: [{
        paragraph: {
          elements: [{ textRun: { content: 'Legacy body\n' } }]
        }
      }]
    },
    tabs: [
      {
        documentTab: {
          body: {
            content: [{
              paragraph: {
                elements: [{ textRun: { content: 'Main tab\n' } }]
              }
            }]
          }
        },
        childTabs: [{
          documentTab: {
            body: {
              content: [{
                paragraph: {
                  elements: [{ textRun: { content: 'Nested tab\n' } }]
                }
              }]
            }
          }
        }]
      }
    ]
  });

  assert.equal(text, 'Main tab\nNested tab\n');
});
