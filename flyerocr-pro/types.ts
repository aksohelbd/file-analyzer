
export interface ProductData {
  description: string;
  arabicDescription: string;
  qty: number;
  regularPrice: string;
  offerPrice: string;
}

export interface ExtractionResult {
  products: ProductData[];
  rawMarkdown: string;
}

export enum AppStatus {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}
