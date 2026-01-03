import Dexie, { type Table } from 'dexie';

export interface PageHistory {
  id?: number;
  url: string;
  title: string;
  timestamp: number;
  description: string;
  snippet?: string;
  favIcon?: string;
  heading?: string;
  image?: string;
}

export class AppDB extends Dexie {
  history!: Table<PageHistory>;

  constructor() {
    super('ContextHubDB');
    this.version(1).stores({
      history: '++id, url, title, timestamp, description'
    });
  }
}

export const db = new AppDB();
