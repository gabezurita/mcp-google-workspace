import { EmbeddedResource, ImageContent, TextContent, Tool } from '@modelcontextprotocol/sdk/types.js';
import { OAuth2Client } from 'google-auth-library';
import { docs_v1, drive_v3, google } from 'googleapis';
import { USER_ID_ARG } from '../types/tool-handler.js';
import { buildDriveSearchQuery, extractDocumentText } from './drive-helpers.js';

const DRIVE_FILE_METADATA_FIELDS = 'id,name,mimeType,modifiedTime,webViewLink,description,size,parents,owners(displayName,emailAddress)';
const DRIVE_SEARCH_FIELDS = `nextPageToken,files(${DRIVE_FILE_METADATA_FIELDS})`;

interface DriveApi {
  listFiles(params: {
    q: string;
    pageSize: number;
    pageToken?: string;
    fields: string;
  }): Promise<drive_v3.Schema$FileList>;
  getFileMetadata(params: {
    fileId: string;
    fields: string;
  }): Promise<drive_v3.Schema$File>;
  getDocument(params: {
    documentId: string;
    includeTabsContent: true;
  }): Promise<docs_v1.Schema$Document>;
}

function createGoogleApi(auth: OAuth2Client): DriveApi {
  const drive = google.drive({ version: 'v3', auth });
  const docs = google.docs({ version: 'v1', auth });

  return {
    listFiles: async params => (await drive.files.list(params)).data,
    getFileMetadata: async params => (await drive.files.get(params)).data,
    getDocument: async params => (await docs.documents.get(params)).data
  };
}

export class DriveTools {
  constructor(
    auth: OAuth2Client,
    private readonly api: DriveApi = createGoogleApi(auth)
  ) {}

  getTools(): Tool[] {
    return [
      {
        name: 'drive_search_files',
        description: 'Searches Google Drive by file name or full text and returns matching file metadata.',
        inputSchema: {
          type: 'object',
          properties: {
            [USER_ID_ARG]: {
              type: 'string',
              description: 'Email address of the user'
            },
            query: {
              type: 'string',
              minLength: 1,
              description: 'Search term to match against file names or file content'
            },
            search_field: {
              type: 'string',
              enum: ['name', 'fullText'],
              default: 'name',
              description: 'Search file names or full text content'
            },
            max_results: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 20,
              description: 'Maximum number of files to return'
            },
            page_token: {
              type: 'string',
              description: 'Page token returned by the previous search'
            }
          },
          required: [USER_ID_ARG, 'query'],
          additionalProperties: false
        }
      },
      {
        name: 'drive_get_file_metadata',
        description: 'Retrieves read-only metadata for a Google Drive file by its ID.',
        inputSchema: {
          type: 'object',
          properties: {
            [USER_ID_ARG]: {
              type: 'string',
              description: 'Email address of the user'
            },
            file_id: {
              type: 'string',
              minLength: 1,
              description: 'Google Drive file ID'
            }
          },
          required: [USER_ID_ARG, 'file_id'],
          additionalProperties: false
        }
      },
      {
        name: 'docs_get_document',
        description: 'Retrieves the text content of a Google Doc, including all tabs and tables.',
        inputSchema: {
          type: 'object',
          properties: {
            [USER_ID_ARG]: {
              type: 'string',
              description: 'Email address of the user'
            },
            document_id: {
              type: 'string',
              minLength: 1,
              description: 'Google Docs document ID'
            }
          },
          required: [USER_ID_ARG, 'document_id'],
          additionalProperties: false
        }
      }
    ];
  }

  async handleTool(name: string, args: Record<string, any>): Promise<Array<TextContent | ImageContent | EmbeddedResource>> {
    switch (name) {
      case 'drive_search_files':
        return this.searchFiles(args);
      case 'drive_get_file_metadata':
        return this.getFileMetadata(args);
      case 'docs_get_document':
        return this.getDocument(args);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  private async searchFiles(args: Record<string, any>): Promise<Array<TextContent>> {
    const searchField = args.search_field ?? 'name';
    if (searchField !== 'name' && searchField !== 'fullText') {
      throw new Error('search_field must be name or fullText');
    }

    const maxResults = args.max_results ?? 20;
    if (!Number.isInteger(maxResults) || maxResults < 1 || maxResults > 100) {
      throw new Error('max_results must be between 1 and 100');
    }
    if (args.page_token !== undefined && typeof args.page_token !== 'string') {
      throw new Error('page_token must be a string');
    }

    const response = await this.api.listFiles({
      q: buildDriveSearchQuery(args.query, searchField),
      pageSize: maxResults,
      pageToken: args.page_token,
      fields: DRIVE_SEARCH_FIELDS
    });

    return [{
      type: 'text',
      text: JSON.stringify({
        files: response.files ?? [],
        next_page_token: response.nextPageToken ?? null
      }, null, 2)
    }];
  }

  private async getFileMetadata(args: Record<string, any>): Promise<Array<TextContent>> {
    const fileId = args.file_id;
    if (typeof fileId !== 'string' || !fileId.trim()) {
      throw new Error('file_id is required');
    }

    const file = await this.api.getFileMetadata({
      fileId,
      fields: DRIVE_FILE_METADATA_FIELDS
    });

    return [{
      type: 'text',
      text: JSON.stringify(file, null, 2)
    }];
  }

  private async getDocument(args: Record<string, any>): Promise<Array<TextContent>> {
    const documentId = args.document_id;
    if (typeof documentId !== 'string' || !documentId.trim()) {
      throw new Error('document_id is required');
    }

    const document = await this.api.getDocument({
      documentId,
      includeTabsContent: true
    });

    return [{
      type: 'text',
      text: JSON.stringify({
        document_id: document.documentId ?? documentId,
        title: document.title,
        text: extractDocumentText(document)
      }, null, 2)
    }];
  }
}
