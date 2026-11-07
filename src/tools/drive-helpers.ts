import { docs_v1 } from 'googleapis';

export type DriveSearchField = 'name' | 'fullText';

const DRIVE_DOCS_READ_ONLY_TOOLS = new Set([
  'drive_search_files',
  'drive_get_file_metadata',
  'docs_get_document'
]);

export function isDriveDocsTool(name: string): boolean {
  return DRIVE_DOCS_READ_ONLY_TOOLS.has(name);
}

export function buildDriveSearchQuery(searchTerm: string, field: DriveSearchField = 'name'): string {
  if (typeof searchTerm !== 'string' || !searchTerm.trim()) {
    throw new Error('A search term is required');
  }
  if (field !== 'name' && field !== 'fullText') {
    throw new Error('Search field must be name or fullText');
  }

  const escapedTerm = searchTerm.trim()
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'");

  return `trashed = false and ${field} contains '${escapedTerm}'`;
}

function extractStructuralContent(content: docs_v1.Schema$StructuralElement[] = []): string {
  return content.map(element => {
    if (element.paragraph) {
      return (element.paragraph.elements ?? [])
        .map(paragraphElement => paragraphElement.textRun?.content ?? '')
        .join('');
    }

    if (element.table) {
      const rows = (element.table.tableRows ?? []).map(row =>
        (row.tableCells ?? [])
          .map(cell => extractStructuralContent(cell.content).replace(/\n$/, ''))
          .join('\t')
      );
      return rows.length > 0 ? `${rows.join('\n')}\n` : '';
    }

    if (element.tableOfContents) {
      return extractStructuralContent(element.tableOfContents.content);
    }

    return '';
  }).join('');
}

function extractTabContent(tab: docs_v1.Schema$Tab): string {
  const content = extractStructuralContent(tab.documentTab?.body?.content);
  const childContent = (tab.childTabs ?? []).map(extractTabContent).join('');
  return content + childContent;
}

export function extractDocumentText(document: docs_v1.Schema$Document): string {
  if (document.tabs?.length) {
    return document.tabs.map(extractTabContent).join('');
  }

  return extractStructuralContent(document.body?.content);
}
