export interface CypressResult {
  status: 'fulfilled' | 'rejected';
  index: number;
  code?: number;
}

export interface FileInfo {
  file: string;
  weight: number;
}
